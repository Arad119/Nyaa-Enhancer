import { fetchJsonRequestViaBackground } from "../../core/fetch.js";
import { escapeHtml } from "../../core/html.js";
import { getAnimeSearchUrl } from "../../../shared/urls.js";
import { lookupSimilarExternalIds } from "./api.js";
import { DETAILS_CACHE_KEY } from "./cache.js";
import { applyExternalIdsToMatch, matchExternalLinks } from "./ids.js";
import { showQuickFilterPopup } from "../quick-search/index.js";

const ANILIST_URL = "https://graphql.anilist.co";
const TENRAI_FULL = (malId) => `https://api.tenrai.org/v1/anime/${malId}/full`;
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const DETAILS_CACHE_MAX = 80;
const DETAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SYNOPSIS_MAX_CHARS = 1800;

const ANILIST_DETAILS = `
query ($id: Int, $idMal: Int) {
  Media(id: $id, idMal: $idMal, type: ANIME) {
    id
    idMal
    title { romaji english native }
    description(asHtml: false)
    format
    status
    episodes
    duration
    season
    seasonYear
    averageScore
    coverImage { large medium }
    genres
    tags { name rank isMediaSpoiler }
    studios(isMain: true) { nodes { name } }
    startDate { year }
  }
}`;

const detailsCache = new Map();
let detailsStoreQueue = Promise.resolve();
let detailsModalLoadId = 0;
let detailsKeyHandler = null;
let detailsLastFocus = null;

function detailsCacheKey(card) {
  if (card?.malId) return `mal:${card.malId}`;
  if (card?.alId) return `al:${card.alId}`;
  if (card?.tmdbId) return `tmdb:${card.tmdbId}`;
  return `title:${card?.searchTitle || card?.title || ""}`;
}

export function similarCardKey(card) {
  const id = detailsCacheKey(card);
  return card?.section ? `${card.section}:${id}` : id;
}

export function similarCardActionLabel(prefs) {
  if (prefs?.similarCardDetailsEnabled !== false) return "View details";
  if (prefs?.similarOpenQuickSearch) return "Quick Search";
  return "Search on Nyaa";
}

export function similarCardSearchLabel(prefs) {
  return prefs?.similarOpenQuickSearch ? "Quick Search" : "Search on Nyaa";
}

export function clearSimilarDetailsMemory() {
  detailsCache.clear();
}

function isFreshDetailsEntry(entry) {
  return !!(
    entry?.fetchedAt &&
    Date.now() - entry.fetchedAt < DETAILS_CACHE_TTL_MS
  );
}

function pruneDetailsCacheMap(map) {
  const entries = Object.entries(map || {}).filter(([, value]) =>
    isFreshDetailsEntry(value),
  );
  entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  return Object.fromEntries(entries.slice(0, DETAILS_CACHE_MAX));
}

function rememberDetailsEntry(key, entry) {
  if (!key || !entry) return;
  detailsCache.set(key, entry);
  if (detailsCache.size > DETAILS_CACHE_MAX) {
    const first = detailsCache.keys().next().value;
    detailsCache.delete(first);
  }
}

async function readStoredDetailsMap() {
  const stored = await chrome.storage.local.get({ [DETAILS_CACHE_KEY]: {} });
  return stored[DETAILS_CACHE_KEY] || {};
}

async function readDetailsEntry(key) {
  const memory = detailsCache.get(key);
  if (isFreshDetailsEntry(memory)) return memory;
  if (memory) detailsCache.delete(key);

  const map = await readStoredDetailsMap();
  const stored = map[key];
  if (!isFreshDetailsEntry(stored)) return null;
  rememberDetailsEntry(key, stored);
  return stored;
}

function persistDetailsEntry(key, entry) {
  rememberDetailsEntry(key, entry);
  detailsStoreQueue = detailsStoreQueue
    .then(async () => {
      const map = await readStoredDetailsMap();
      map[key] = entry;
      await chrome.storage.local.set({
        [DETAILS_CACHE_KEY]: pruneDetailsCacheMap(map),
      });
    })
    .catch((err) => {
      console.error("Nyaa Enhancer: failed to cache similar details", err);
    });
  return detailsStoreQueue;
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function cleanAnilistDescription(raw) {
  if (!raw) return "";
  let text = String(raw);
  text = text.replace(/~![\s\S]*?!~/g, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?[^>]+>/g, "");
  text = decodeEntities(text);
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > SYNOPSIS_MAX_CHARS) {
    text = `${text.slice(0, SYNOPSIS_MAX_CHARS).trim()}…`;
  }
  return text;
}

function formatKindLabel(format) {
  const key = String(format || "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const labels = {
    TV: "TV",
    MOVIE: "Movie",
    OVA: "OVA",
    ONA: "ONA",
    SPECIAL: "Special",
    TV_SHORT: "TV Short",
    MUSIC: "Music",
  };
  return labels[key] || (format ? String(format) : "");
}

function statusLabel(status) {
  const key = String(status || "").toUpperCase().replace(/[\s-]+/g, "_");
  const labels = {
    FINISHED: "Finished",
    RELEASING: "Airing",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
    HIATUS: "Hiatus",
    CURRENTLY_AIRING: "Airing",
    FINISHED_AIRING: "Finished",
    NOT_YET_AIRED: "Upcoming",
    ENDED: "Ended",
    RETURNING_SERIES: "Airing",
  };
  return labels[key] || "";
}

function uniqueNames(values) {
  const seen = new Set();
  const names = [];
  for (const value of values || []) {
    const name = String(value || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

function seasonLine(season, year) {
  const s = String(season || "").toLowerCase();
  const pretty = s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  if (pretty && year) return `${pretty} ${year}`;
  if (year) return String(year);
  return pretty;
}

function metaBits(details) {
  const bits = [];
  const format = formatKindLabel(details.format);
  if (format) bits.push(format);
  if (details.yearLine) bits.push(details.yearLine);
  if (details.episodes) {
    bits.push(
      details.episodes === 1 ? "1 episode" : `${details.episodes} episodes`,
    );
  }
  if (details.scoreLabel) bits.push(details.scoreLabel);
  if (details.statusLabel) bits.push(details.statusLabel);
  return bits;
}

function detailsFromAnilist(media) {
  if (!media) return null;
  const tags = (media.tags || [])
    .filter((tag) => tag?.name && !tag.isMediaSpoiler)
    .sort((a, b) => (b.rank || 0) - (a.rank || 0))
    .slice(0, 8)
    .map((tag) => tag.name);
  const year = media.seasonYear || media.startDate?.year || "";
  return {
    alId: media.id ?? null,
    malId: media.idMal ?? null,
    title: media.title?.english || media.title?.romaji || "",
    nativeTitle: media.title?.native || "",
    cover: media.coverImage?.large || media.coverImage?.medium || "",
    synopsis: cleanAnilistDescription(media.description),
    format: media.format || "",
    statusLabel: statusLabel(media.status),
    episodes: media.episodes || 0,
    yearLine: seasonLine(media.season, year),
    scoreLabel: media.averageScore ? `${media.averageScore}% AniList` : "",
    genres: uniqueNames(media.genres),
    tags: uniqueNames(tags),
    studios: uniqueNames((media.studios?.nodes || []).map((node) => node.name)),
  };
}

function detailsFromTenrai(entry) {
  if (!entry) return null;
  const year = entry.year || entry.aired?.prop?.from?.year || "";
  const score = Number(entry.score);
  return {
    malId: entry.mal_id ?? null,
    title: entry.title_english || entry.title || "",
    nativeTitle: entry.title_japanese || "",
    cover:
      entry.images?.jpg?.large_image_url ||
      entry.images?.jpg?.image_url ||
      "",
    synopsis: cleanAnilistDescription(entry.synopsis),
    format: entry.type || "",
    statusLabel: statusLabel(entry.status),
    episodes: entry.episodes || 0,
    yearLine: seasonLine(entry.season, year),
    scoreLabel: Number.isFinite(score) && score > 0 ? `${score.toFixed(1)} MAL` : "",
    genres: uniqueNames((entry.genres || []).map((item) => item.name)),
    tags: uniqueNames((entry.themes || []).map((item) => item.name)),
    studios: uniqueNames((entry.studios || []).map((item) => item.name)),
  };
}

function detailsFromTmdb(entry, mediaType) {
  if (!entry) return null;
  const date = entry.first_air_date || entry.release_date || "";
  const year = date.slice(0, 4);
  const score = Number(entry.vote_average);
  const episodes = entry.number_of_episodes || 0;
  return {
    tmdbId: entry.id ?? null,
    tmdbType: mediaType,
    title: entry.name || entry.title || "",
    cover: entry.poster_path
      ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
      : "",
    synopsis: cleanAnilistDescription(entry.overview),
    format: mediaType === "movie" ? "MOVIE" : "TV",
    statusLabel: statusLabel(entry.status),
    episodes,
    yearLine: year,
    scoreLabel:
      Number.isFinite(score) && score > 0 ? `${score.toFixed(1)} TMDB` : "",
    genres: uniqueNames((entry.genres || []).map((item) => item.name)),
    tags: [],
    studios: uniqueNames(
      (entry.production_companies || []).slice(0, 3).map((item) => item.name),
    ),
  };
}

function mergeDetails(card, extra) {
  const merged = extra
    ? {
        ...card,
        alId: extra.alId ?? card.alId,
        malId: extra.malId ?? card.malId,
        tmdbId: extra.tmdbId ?? card.tmdbId,
        tmdbType: extra.tmdbType || card.tmdbType,
        nativeTitle: extra.nativeTitle || "",
        cover: extra.cover || card.cover,
        synopsis: extra.synopsis || "",
        format: extra.format || card.format,
        statusLabel: extra.statusLabel || "",
        episodes: extra.episodes || 0,
        yearLine: extra.yearLine || "",
        scoreLabel: extra.scoreLabel || "",
        genres: extra.genres?.length ? extra.genres : card.genres || [],
        tags: extra.tags?.length ? extra.tags : card.tags || [],
        studios: extra.studios?.length ? extra.studios : card.studios || [],
      }
    : { ...card };
  applyExternalIdsToMatch(merged, extra);
  return merged;
}

async function fetchAnilistDetails(card) {
  const variables = {};
  if (card.alId) variables.id = Number(card.alId);
  else if (card.malId) variables.idMal = Number(card.malId);
  else return null;
  const result = await fetchJsonRequestViaBackground({
    url: ANILIST_URL,
    method: "POST",
    body: { query: ANILIST_DETAILS, variables },
  });
  if (!result?.ok) return null;
  return detailsFromAnilist(result.data?.data?.Media);
}

async function fetchTenraiDetails(card) {
  if (!card.malId) return null;
  const result = await fetchJsonRequestViaBackground({
    url: TENRAI_FULL(card.malId),
  });
  if (!result?.ok) return null;
  return detailsFromTenrai(result.data?.data);
}

async function fetchTmdbDetails(card, prefs) {
  if (!card.tmdbId) return null;
  const apiKey = String(prefs?.tmdbApiKey || "").trim();
  if (!apiKey) return null;
  const path = card.tmdbType === "movie" ? "movie" : "tv";
  const result = await fetchJsonRequestViaBackground({
    url:
      `${TMDB_API_BASE}/${path}/${encodeURIComponent(card.tmdbId)}` +
      `?api_key=${encodeURIComponent(apiKey)}&language=en-US`,
  });
  if (!result?.ok) return null;
  return detailsFromTmdb(result.data, path);
}

async function fetchSynopsisExtra(card, prefs) {
  if (card.alId || card.malId) {
    const anilist = await fetchAnilistDetails(card);
    if (anilist) return anilist;
    if (card.malId) return fetchTenraiDetails(card);
    return null;
  }
  if (card.tmdbId) return fetchTmdbDetails(card, prefs);
  return null;
}

export async function fetchSimilarCardDetails(card, prefs) {
  const key = detailsCacheKey(card);
  const cached = await readDetailsEntry(key);
  if (cached?.extra) {
    const merged = mergeDetails(card, cached.extra);
    applyExternalIdsToMatch(merged, cached.mapping);
    if (cached.mapping) return merged;

    const mapping = await lookupSimilarExternalIds(card);
    applyExternalIdsToMatch(merged, mapping);
    if (mapping) {
      persistDetailsEntry(key, {
        fetchedAt: cached.fetchedAt || Date.now(),
        extra: cached.extra,
        mapping,
      });
    }
    return merged;
  }

  const [extra, mapping] = await Promise.all([
    fetchSynopsisExtra(card, prefs),
    lookupSimilarExternalIds(card),
  ]);
  if (extra) {
    persistDetailsEntry(key, {
      fetchedAt: Date.now(),
      extra,
      mapping: mapping || null,
    });
  }

  const merged = mergeDetails(card, extra);
  applyExternalIdsToMatch(merged, mapping);
  return merged;
}

function renderCover(url) {
  if (url) {
    return `<img class="nyaa-enhancer-similar-modal__cover" src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer">`;
  }
  return `<div class="nyaa-enhancer-similar-modal__cover nyaa-enhancer-similar-cover--empty" aria-hidden="true"></div>`;
}

function renderChips(label, values) {
  const names = uniqueNames(values).slice(0, 8);
  if (!names.length) return "";
  return `
    <div class="nyaa-enhancer-similar-modal__chips">
      <span class="nyaa-enhancer-similar-modal__chips-label">${escapeHtml(label)}</span>
      ${names
        .map(
          (name) =>
            `<span class="nyaa-enhancer-similar-modal__chip">${escapeHtml(name)}</span>`,
        )
        .join("")}
    </div>
  `;
}

function renderLinks(details) {
  const links = matchExternalLinks(details);
  if (!links.length) return "";
  return `<div class="nyaa-enhancer-similar-modal__links">${links
    .map(
      (link) =>
        `<a class="nyaa-enhancer-similar-id-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
    )
    .join("")}</div>`;
}

function renderModalBody(details, { loading, failed }) {
  const bits = metaBits(details);
  const native =
    details.nativeTitle && details.nativeTitle !== details.title
      ? `<p class="nyaa-enhancer-similar-modal__native">${escapeHtml(details.nativeTitle)}</p>`
      : "";
  const reason = details.reason
    ? `<p class="nyaa-enhancer-similar-modal__reason">${escapeHtml(details.reason)}</p>`
    : "";
  let synopsis;
  if (details.synopsis) {
    synopsis = `<p class="nyaa-enhancer-similar-modal__synopsis">${escapeHtml(details.synopsis)}</p>`;
  } else if (loading) {
    synopsis = `<p class="nyaa-enhancer-similar-modal__synopsis is-loading">Loading synopsis…</p>`;
  } else if (failed) {
    synopsis = `<p class="nyaa-enhancer-similar-modal__synopsis is-empty">Couldn't load a synopsis right now.</p>`;
  } else {
    synopsis = `<p class="nyaa-enhancer-similar-modal__synopsis is-empty">No synopsis available.</p>`;
  }

  return `
    <div class="nyaa-enhancer-similar-modal__hero">
      ${renderCover(details.cover)}
      <div class="nyaa-enhancer-similar-modal__headline">
        ${reason}
        <h3 class="nyaa-enhancer-similar-modal__title" id="ne-similar-modal-title">${escapeHtml(details.title || "Untitled")}</h3>
        ${native}
        ${
          bits.length
            ? `<p class="nyaa-enhancer-similar-modal__meta">${escapeHtml(bits.join(" · "))}</p>`
            : ""
        }
        ${renderLinks(details)}
      </div>
    </div>
    ${renderChips("Genres", details.genres)}
    ${renderChips("Tags", details.tags)}
    ${renderChips("Studio", details.studios)}
    <div class="nyaa-enhancer-similar-modal__synopsis-block">
      <h4 class="nyaa-enhancer-similar-modal__section-title">Synopsis</h4>
      ${synopsis}
    </div>
  `;
}

function searchFromDetails(details, prefs) {
  const title = details.searchTitle || details.title || "";
  closeSimilarCardModal(true);
  if (prefs?.similarOpenQuickSearch) {
    showQuickFilterPopup({ animeName: title });
    return;
  }
  window.open(getAnimeSearchUrl(title), "_blank", "noopener");
}

function modalFocusables(modal) {
  return [...modal.querySelectorAll("button, a[href]")].filter(
    (el) => !el.disabled && el.getClientRects().length > 0,
  );
}

export function closeSimilarCardModal(immediate = false) {
  const overlay = document.getElementById("ne-similar-card-overlay");
  if (detailsKeyHandler) {
    document.removeEventListener("keydown", detailsKeyHandler);
    detailsKeyHandler = null;
  }
  document.body.style.overflow = "";
  if (!overlay) {
    detailsLastFocus = null;
    return;
  }

  const restore = () => {
    if (!overlay.isConnected) return;
    overlay.remove();
    detailsLastFocus?.focus?.();
    detailsLastFocus = null;
  };

  if (immediate) {
    restore();
    return;
  }
  if (overlay.classList.contains("hiding")) return;
  overlay.classList.add("hiding");
  overlay.addEventListener("animationend", restore, { once: true });
  setTimeout(restore, 250);
}

export function openSimilarCardModal(card, prefs) {
  if (!card) return;
  closeSimilarCardModal(true);
  detailsLastFocus = document.activeElement;
  const loadId = ++detailsModalLoadId;
  const initial = mergeDetails(card, null);

  const overlay = document.createElement("div");
  overlay.className = "nyaa-enhancer-similar-modal-overlay";
  overlay.id = "ne-similar-card-overlay";

  const modal = document.createElement("div");
  modal.className = "nyaa-enhancer-similar-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "ne-similar-modal-title");
  modal.innerHTML = `
    <div class="nyaa-enhancer-similar-modal__header">
      <span class="nyaa-enhancer-similar-modal__kicker">Anime details</span>
      <button type="button" class="nyaa-enhancer-similar-modal__close" aria-label="Close">&times;</button>
    </div>
    <div class="nyaa-enhancer-similar-modal__body" data-similar-modal-body>
      ${renderModalBody(initial, { loading: true, failed: false })}
    </div>
    <div class="nyaa-enhancer-similar-modal__footer">
      <button type="button" class="nyaa-enhancer-similar-modal__btn nyaa-enhancer-similar-modal__btn--ghost" data-similar-modal-close>Close</button>
      <button type="button" class="nyaa-enhancer-similar-modal__btn nyaa-enhancer-similar-modal__btn--primary" data-similar-modal-search>${escapeHtml(similarCardSearchLabel(prefs))}</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const body = modal.querySelector("[data-similar-modal-body]");
  const closeBtn = modal.querySelector(".nyaa-enhancer-similar-modal__close");
  const searchBtn = modal.querySelector("[data-similar-modal-search]");
  closeBtn?.focus();

  const close = () => closeSimilarCardModal();
  closeBtn?.addEventListener("click", close);
  modal
    .querySelector("[data-similar-modal-close]")
    ?.addEventListener("click", close);
  overlay.addEventListener("mousedown", (event) => {
    overlay.dataset.overlayDown = event.target === overlay ? "1" : "0";
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && overlay.dataset.overlayDown === "1") close();
  });
  searchBtn?.addEventListener("click", () => {
    const cached = detailsCache.get(detailsCacheKey(card));
    const current = mergeDetails(card, cached?.extra);
    applyExternalIdsToMatch(current, cached?.mapping);
    searchFromDetails(current, prefs);
  });

  detailsKeyHandler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = modalFocusables(modal);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", detailsKeyHandler);

  fetchSimilarCardDetails(card, prefs)
    .then((details) => {
      if (loadId !== detailsModalLoadId || !body.isConnected) return;
      body.innerHTML = renderModalBody(details, {
        loading: false,
        failed: false,
      });
      const img = body.querySelector(".nyaa-enhancer-similar-modal__cover[src]");
      img?.addEventListener("error", () => {
        img.classList.add("nyaa-enhancer-similar-cover--empty");
        img.removeAttribute("src");
      });
    })
    .catch(() => {
      if (loadId !== detailsModalLoadId || !body.isConnected) return;
      body.innerHTML = renderModalBody(initial, {
        loading: false,
        failed: true,
      });
    });
}
