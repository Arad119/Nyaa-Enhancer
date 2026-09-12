import { fetchJsonRequestViaBackground } from "../../core/fetch.js";
import { getAnimetoshoSeriesForHash } from "../animetosho/index.js";
import { seaDexFetch } from "../seadex/index.js";
import {
  applyExternalIdsToMatch,
  mappingFromAnimeApi,
  positiveAnimeId,
  tmdbTypeFromMapping,
} from "./ids.js";
import {
  filterRecommended,
  mergeRecommendedCards,
  mergeTmdbCards,
  uniqueCards,
} from "./recs.js";
import { scoreCandidate } from "./score.js";
import { searchQueriesFromAnimetoshoSeries } from "./title.js";
import {
  ANIMEAPI_CACHE_KEY,
  IDENTIFY_CACHE_KEY,
  RECS_CACHE_KEY,
} from "./cache.js";
import {
  VIBE_ANILIST_MIN,
  anilistTagNames,
  getVibeWeights,
  mergeSourceVibe,
  namesFromMalEntities,
  pickProducerId,
  scoreVibeCards,
  seedGenre,
  sourceVibeFromAnilist,
  sourceVibeFromTenrai,
  tenraiVibeSearchPaths,
} from "./vibe.js";

export { getVibeWeights, scoreVibeCards } from "./vibe.js";
export { clearSimilarCaches, similarCachesWereCleared } from "./cache.js";

const TENRAI_BASE = "https://api.tenrai.org/v1";
const ANILIST_URL = "https://graphql.anilist.co";
const ANIMEAPI_BASE = "https://animeapi.my.id";
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TENRAI_MIN_INTERVAL_MS = 320;
const ANIMEAPI_MIN_INTERVAL_MS = 400;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ANIMEAPI_HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ANIMEAPI_MISS_TTL_MS = CACHE_TTL_MS;

const IDENTIFY_CACHE_MAX = 80;
const RECS_CACHE_MAX = 40;
const ANIMEAPI_CACHE_MAX = 200;
const SKIP_FORMATS = new Set(["MUSIC", "CM", "PV"]);

const ANILIST_MEDIA_CORE = `
    id
    idMal
    title { romaji english native }
    synonyms
    format
    popularity
    status
    coverImage { large medium }
    genres
    tags { name rank isMediaSpoiler }
    studios(isMain: true) { nodes { name } }
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          idMal
          type
          format
          title { romaji english native }
          coverImage { large medium }
        }
      }
    }
`;

const ANILIST_BY_ID = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ${ANILIST_MEDIA_CORE}
  }
}`;

const ANILIST_BY_MAL = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    ${ANILIST_MEDIA_CORE}
  }
}`;

const ANILIST_RECS_CORE = `
    id
    idMal
    recommendations(page: 1, perPage: 25, sort: RATING_DESC) {
      nodes {
        rating
        mediaRecommendation {
          id
          idMal
          format
          title { romaji english native }
          coverImage { large medium }
        }
      }
    }
`;

const ANILIST_RECS_BY_ID = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ${ANILIST_RECS_CORE}
  }
}`;

const ANILIST_RECS_BY_MAL = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    ${ANILIST_RECS_CORE}
  }
}`;

const ANILIST_SEARCH = `
query ($search: String) {
  Page(page: 1, perPage: 8) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      idMal
      title { romaji english native }
      synonyms
      format
      popularity
      status
      coverImage { large medium }
    }
  }
}`;

const ANILIST_VIBE_MEDIA = `
      id
      idMal
      format
      popularity
      title { romaji english native }
      coverImage { large medium }
      genres
      tags { name rank isMediaSpoiler }
      studios(isMain: true) { nodes { name } }
`;

const ANILIST_VIBE = `
query ($genre: String) {
  Page(page: 1, perPage: 32) {
    media(type: ANIME, genre: $genre, sort: POPULARITY_DESC) {
      ${ANILIST_VIBE_MEDIA}
    }
  }
}`;

const ANILIST_TAG = `
query ($tag: String) {
  Page(page: 1, perPage: 32) {
    media(type: ANIME, tag: $tag, sort: POPULARITY_DESC) {
      ${ANILIST_VIBE_MEDIA}
    }
  }
}`;

const ANILIST_STUDIO = `
query ($name: String) {
  Studio(search: $name) {
    media(sort: POPULARITY_DESC, page: 1, perPage: 25) {
      nodes {
        type
        ${ANILIST_VIBE_MEDIA}
      }
    }
  }
}`;

let tenraiNextAllowedAt = 0;
let tenraiQueue = Promise.resolve();
let animeApiNextAllowedAt = 0;
let animeApiQueue = Promise.resolve();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneCacheMap(map, maxEntries) {
  const now = Date.now();
  const entries = Object.entries(map || {}).filter(
    ([, value]) => value?.fetchedAt && now - value.fetchedAt < CACHE_TTL_MS,
  );
  entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  return Object.fromEntries(entries.slice(0, maxEntries));
}

async function readCache(key) {
  const stored = await browser.storage.local.get({ [key]: {} });
  return stored[key] || {};
}

async function writeCache(key, map, maxEntries) {
  await browser.storage.local.set({ [key]: pruneCacheMap(map, maxEntries) });
}

function collectTitles(...groups) {
  const titles = [];
  const add = (value) => {
    const next = String(value || "").replace(/\s+/g, " ").trim();
    if (next && !titles.includes(next)) titles.push(next);
  };
  for (const group of groups) {
    if (!group) continue;
    if (Array.isArray(group)) {
      for (const item of group) {
        if (typeof item === "string") add(item);
        else if (item?.title) add(item.title);
      }
      continue;
    }
    if (typeof group === "string") add(group);
    else if (typeof group === "object") {
      add(group.romaji);
      add(group.english);
      add(group.native);
      add(group.title);
      add(group.title_english);
      add(group.title_japanese);
    }
  }
  return titles;
}

function pickSearchTitle(titles, fallback = "") {
  const list = titles.filter(Boolean);
  const latin = list.filter(
    (title) => /[a-zA-Z]/.test(title) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(title),
  );
  return latin[0] || list[0] || fallback;
}

function tenraiEntryTitles(entry) {
  return collectTitles(
    entry?.title,
    entry?.title_english,
    entry?.title_japanese,
    entry?.title_synonyms,
    entry?.titles,
    entry?.name,
  );
}

function anilistMediaTitles(media) {
  return collectTitles(media?.title, media?.synonyms);
}

function normalizeRelation(relation) {
  return String(relation || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

export function relationKinds(relation, format) {
  const rel = normalizeRelation(relation);
  const fmt = String(format || "").toUpperCase();
  const kinds = [];
  if (rel === "sequel") kinds.push("sequel");
  if (rel === "prequel") kinds.push("prequel");
  if (rel === "side story" || rel === "spin off") kinds.push("spinoff");
  if (fmt === "MOVIE" || rel === "movie") kinds.push("movie");
  return kinds;
}

function relationLabel(kinds, fallback) {
  const labels = [];
  if (kinds.includes("sequel")) labels.push("Sequel");
  if (kinds.includes("prequel")) labels.push("Prequel");
  if (kinds.includes("spinoff")) labels.push("Spin-off");
  if (kinds.includes("movie")) labels.push("Movie");
  return labels.join(" · ") || fallback || "Related";
}

function cardFromTenraiEntry(entry, reason, votes = 0, extra = {}) {
  const titles = tenraiEntryTitles(entry);
  const title = titles[0] || "";
  if (!title) return null;
  const format = extra.format || entry?.type || "";
  const kinds = extra.kinds || relationKinds(reason, format);
  return {
    malId: entry?.mal_id ?? extra.malId ?? null,
    alId: extra.alId ?? null,
    title,
    searchTitle: pickSearchTitle(titles, title),
    cover:
      extra.cover ||
      entry?.images?.jpg?.large_image_url ||
      entry?.images?.jpg?.image_url ||
      entry?.images?.webp?.image_url ||
      "",
    reason,
    votes,
    format,
    kinds,
    genres: extra.genres || namesFromMalEntities(entry?.genres),
    tags: extra.tags || namesFromMalEntities(entry?.themes),
    studios: extra.studios || namesFromMalEntities(entry?.studios),
    popularity: extra.popularity || entry?.members || 0,
  };
}

function cardFromAnilistMedia(media, reason, votes = 0) {
  if (!media) return null;
  const titles = anilistMediaTitles(media);
  const title = titles[0] || "";
  if (!title) return null;
  const format = String(media.format || "").toUpperCase();
  if (SKIP_FORMATS.has(format) || media.type === "MANGA") return null;
  return {
    malId: media.idMal ?? null,
    alId: media.id ?? null,
    title,
    searchTitle: pickSearchTitle(titles, title),
    cover: media.coverImage?.large || media.coverImage?.medium || "",
    reason,
    votes,
    format,
    kinds: relationKinds(reason, format),
    genres: [...(media.genres || [])],
    tags: anilistTagNames(media),
    studios: (media.studios?.nodes || []).map((node) => node.name).filter(Boolean),
    popularity: media.popularity || 0,
  };
}

function parseRetryAfterMs(retryAfter) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
  return 5000;
}

async function tenraiGet(path) {
  return new Promise((resolve, reject) => {
    tenraiQueue = tenraiQueue
      .then(async () => {
        const waitMs = Math.max(0, tenraiNextAllowedAt - Date.now());
        if (waitMs) await delay(waitMs);
        const result = await fetchJsonRequestViaBackground({
          url: `${TENRAI_BASE}${path}`,
        });
        tenraiNextAllowedAt = Date.now() + TENRAI_MIN_INTERVAL_MS;
        if (result?.status === 429) {
          tenraiNextAllowedAt =
            Date.now() + parseRetryAfterMs(result.retryAfter);
          resolve({ ok: false, error: "rate_limited", status: 429 });
          return;
        }
        resolve(result || { ok: false, error: "empty_response" });
      })
      .catch(reject);
  });
}

async function anilistQuery(query, variables) {
  const result = await fetchJsonRequestViaBackground({
    url: ANILIST_URL,
    method: "POST",
    body: { query, variables },
  });
  if (result?.status === 429) {
    return { ok: false, error: "rate_limited", status: 429 };
  }
  const payload = result?.data;
  const data = payload?.data;
  if (data && typeof data === "object") {
    return { ok: true, data };
  }
  return {
    ok: false,
    error: payload?.errors?.[0]?.message || result?.error || "anilist_failed",
    status: result?.status,
  };
}

async function anilistMediaByMatch(match, byIdQuery, byMalQuery) {
  if (match?.alId) return anilistQuery(byIdQuery, { id: Number(match.alId) });
  if (match?.malId) return anilistQuery(byMalQuery, { idMal: Number(match.malId) });
  return { ok: false, error: "no_id" };
}

async function fetchAnilistRecommendations(match) {
  const result = await anilistMediaByMatch(match, ANILIST_RECS_BY_ID, ANILIST_RECS_BY_MAL);
  if (!result.ok) return { cards: [], error: result.error };
  return { cards: recommendedFromAnilist(result.data?.Media) };
}

async function lookupSeaDexAlId(infoHash) {
  const hash = infoHash?.trim().toLowerCase();
  if (!hash) return null;
  const apiUrl =
    `https://releases.moe/api/collections/entries/records` +
    `?filter=${encodeURIComponent(`trs.infoHash?="${hash}"`)}&expand=trs&skipTotal=true`;
  const result = await seaDexFetch(apiUrl);
  if (!result?.ok) return null;
  try {
    const json = JSON.parse(result.text);
    const alId = json.items?.[0]?.alID;
    return Number.isFinite(Number(alId)) ? Number(alId) : null;
  } catch {
    return null;
  }
}

function relatedFromAnilist(media) {
  const edges = media?.relations?.edges || [];
  return uniqueCards(
    edges
      .filter((edge) => edge?.node?.type === "ANIME")
      .map((edge) => {
        const card = cardFromAnilistMedia(edge.node, edge.relationType);
        if (!card?.kinds?.length) return null;
        card.reason = relationLabel(card.kinds, edge.relationType);
        return card;
      }),
  );
}

function relatedFromTenrai(fullData) {
  const relations = fullData?.relations || [];
  const cards = [];
  for (const group of relations) {
    for (const entry of group.entry || []) {
      if (String(entry?.type || "").toLowerCase() !== "anime") continue;
      const kinds = relationKinds(group.relation, entry.type);
      if (!kinds.length) continue;
      cards.push(
        cardFromTenraiEntry(
          { mal_id: entry.mal_id, title: entry.name, type: entry.type },
          relationLabel(kinds, group.relation),
          0,
          { kinds },
        ),
      );
    }
  }
  return uniqueCards(cards);
}

function withSources(card, sources) {
  if (!card) return null;
  card.sources = sources;
  return card;
}

function recommendedFromTenrai(data) {
  const rows = Array.isArray(data) ? data : [];
  return uniqueCards(
    rows.map((row) =>
      withSources(
        cardFromTenraiEntry(row?.entry, "Recommended", Number(row?.votes) || 0),
        ["mal"],
      ),
    ),
  );
}

function recommendedFromAnilist(media) {
  const nodes = media?.recommendations?.nodes || [];
  return uniqueCards(
    nodes.map((node) =>
      withSources(
        cardFromAnilistMedia(
          node?.mediaRecommendation,
          "Recommended",
          Math.max(0, Number(node?.rating) || 0),
        ),
        ["anilist"],
      ),
    ),
  );
}

function cardFromTmdb(entry, reason, mediaType) {
  const title = String(entry?.name || entry?.title || "").trim();
  if (!title) return null;
  const poster = entry?.poster_path
    ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
    : "";
  return {
    malId: null,
    alId: null,
    tmdbId: entry.id,
    title,
    searchTitle: title,
    cover: poster,
    reason,
    votes: 0,
    format: mediaType === "movie" ? "MOVIE" : "TV",
    kinds: [],
    genres: [],
    tags: [],
    studios: [],
    popularity: entry.popularity || 0,
  };
}

function pruneAnimeApiCache(map) {
  const now = Date.now();
  const entries = Object.entries(map || {}).filter(([, value]) => {
    if (!value?.fetchedAt) return false;
    const ttl = value.tmdbId ? ANIMEAPI_HIT_TTL_MS : ANIMEAPI_MISS_TTL_MS;
    return now - value.fetchedAt < ttl;
  });
  entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  return Object.fromEntries(entries.slice(0, ANIMEAPI_CACHE_MAX));
}

function positiveTmdbId(value) {
  return positiveAnimeId(value);
}

function hasExpandedAnimeApiIds(mapping) {
  return mapping && typeof mapping === "object" && "anidbId" in mapping;
}

function storeAnimeApiMapping(cache, mapping) {
  if (!mapping) return;
  if (mapping.malId) cache[`mal:${mapping.malId}`] = mapping;
  if (mapping.alId) cache[`al:${mapping.alId}`] = mapping;
  if (mapping.tmdbId) cache[`tmdb:${mapping.tmdbId}`] = mapping;
}

async function animeApiGet(path) {
  return new Promise((resolve, reject) => {
    animeApiQueue = animeApiQueue
      .then(async () => {
        const waitMs = Math.max(0, animeApiNextAllowedAt - Date.now());
        if (waitMs) await delay(waitMs);
        const result = await fetchJsonRequestViaBackground({
          url: `${ANIMEAPI_BASE}${path}`,
        });
        animeApiNextAllowedAt = Date.now() + ANIMEAPI_MIN_INTERVAL_MS;
        if (result?.status === 429) {
          animeApiNextAllowedAt =
            Date.now() + parseRetryAfterMs(result.retryAfter);
          resolve({ ok: false, error: "rate_limited", status: 429 });
          return;
        }
        resolve(result || { ok: false, error: "empty_response" });
      })
      .catch(reject);
  });
}

function animeApiCacheKey(match) {
  const malId = positiveTmdbId(match?.malId);
  if (malId) return { key: `mal:${malId}`, malId, alId: null, tmdbId: null };
  const alId = positiveTmdbId(match?.alId);
  if (alId) return { key: `al:${alId}`, malId: null, alId, tmdbId: null };
  const tmdbId = positiveTmdbId(match?.tmdbId);
  if (tmdbId) return { key: `tmdb:${tmdbId}`, malId: null, alId: null, tmdbId };
  return { key: "", malId: null, alId: null, tmdbId: null };
}

function animeApiPath(match, ids) {
  if (ids.malId) return `/mal/${ids.malId}`;
  if (ids.alId) return `/anilist/${ids.alId}`;
  if (ids.tmdbId) {
    return `/themoviedb/${tmdbTypeFromMapping(match?.tmdbType)}/${ids.tmdbId}`;
  }
  return "";
}

async function resolveAnimeApiIds(match) {
  const ids = animeApiCacheKey(match);
  if (!ids.key) return { mapping: null, error: "no_id" };

  const cache = await readCache(ANIMEAPI_CACHE_KEY);
  const cached = cache[ids.key];
  if (cached?.fetchedAt && hasExpandedAnimeApiIds(cached)) {
    const ttl = cached.tmdbId ? ANIMEAPI_HIT_TTL_MS : ANIMEAPI_MISS_TTL_MS;
    if (Date.now() - cached.fetchedAt < ttl) {
      return { mapping: cached, fromCache: true };
    }
  }

  const path = animeApiPath(match, ids);
  const result = await animeApiGet(path);
  if (result?.error === "rate_limited") {
    return { mapping: null, error: "rate_limited" };
  }

  const mapping = result?.ok ? mappingFromAnimeApi(result.data) : null;
  const stored = mapping || {
    fetchedAt: Date.now(),
    tmdbId: ids.tmdbId,
    tmdbType: tmdbTypeFromMapping(match?.tmdbType),
    malId: ids.malId,
    alId: ids.alId,
    anidbId: null,
    imdbId: null,
    tvdbId: null,
    traktId: null,
    traktSlug: null,
    traktType: "shows",
  };
  storeAnimeApiMapping(cache, stored);
  await browser.storage.local.set({
    [ANIMEAPI_CACHE_KEY]: pruneAnimeApiCache(cache),
  });
  return { mapping: stored };
}

export async function lookupSimilarExternalIds(card) {
  try {
    const resolved = await resolveAnimeApiIds(card);
    return resolved.mapping || null;
  } catch {
    return null;
  }
}

async function resolveTmdbMapping(match) {
  const resolved = await resolveAnimeApiIds(match);
  if (resolved.error === "rate_limited") {
    return { mapping: null, error: "rate_limited" };
  }
  return {
    mapping: resolved.mapping?.tmdbId ? resolved.mapping : null,
    fromCache: resolved.fromCache,
  };
}

async function applyAnimeApiIdsToMatch(match) {
  if (!match) return null;
  const resolved = await resolveAnimeApiIds(match);
  applyExternalIdsToMatch(match, resolved.mapping);
  return resolved.mapping;
}

async function fetchTmdbList(mediaType, tmdbId, kind, apiKey) {
  const path = mediaType === "movie" ? "movie" : "tv";
  const result = await fetchJsonRequestViaBackground({
    url:
      `${TMDB_API_BASE}/${path}/${encodeURIComponent(tmdbId)}/${kind}` +
      `?api_key=${encodeURIComponent(apiKey)}&language=en-US`,
  });
  if (result?.status === 429) {
    return { ok: false, error: "rate_limited", cards: [] };
  }
  if (!result?.ok) {
    return { ok: false, error: result?.error || "tmdb_failed", cards: [] };
  }
  const rows = Array.isArray(result.data?.results) ? result.data.results : [];
  const reason = kind === "recommendations" ? "Recommended" : "Similar";
  return {
    ok: true,
    cards: rows.map((row) => cardFromTmdb(row, reason, mediaType)).filter(Boolean),
  };
}

async function fetchTmdbRecommended(match, apiKey) {
  const resolved = await resolveTmdbMapping(match);
  if (resolved.error === "rate_limited") {
    return { cards: [], error: "rate_limited" };
  }
  if (!resolved.mapping?.tmdbId) {
    return { cards: [], error: "tmdb_no_id" };
  }

  const mediaType = resolved.mapping.tmdbType;
  const tmdbId = resolved.mapping.tmdbId;
  const [recs, similar] = await Promise.all([
    fetchTmdbList(mediaType, tmdbId, "recommendations", apiKey),
    fetchTmdbList(mediaType, tmdbId, "similar", apiKey),
  ]);
  if (recs.error === "rate_limited" || similar.error === "rate_limited") {
    return {
      cards: mergeTmdbCards(recs.cards, similar.cards),
      error: "rate_limited",
    };
  }
  const cards = mergeTmdbCards(recs.cards, similar.cards);
  if (!cards.length && !recs.ok && !similar.ok) {
    return { cards: [], error: "tmdb_failed" };
  }
  return { cards };
}

function matchFromAnilist(media, source, parsedTitle) {
  if (!media?.idMal && !media?.id) return null;
  const titles = anilistMediaTitles(media);
  const title = titles[0] || parsedTitle;
  return {
    malId: media.idMal ?? null,
    alId: media.id ?? null,
    title,
    englishTitle: media.title?.english || "",
    searchTitle: pickSearchTitle(titles, title),
    cover: media.coverImage?.large || media.coverImage?.medium || "",
    source,
    parsedTitle,
    titles,
  };
}

function matchFromTenrai(entry, source, parsedTitle) {
  if (!entry?.mal_id) return null;
  const titles = tenraiEntryTitles(entry);
  const title = titles[0] || parsedTitle;
  return {
    malId: entry.mal_id,
    alId: null,
    title,
    englishTitle: entry.title_english || "",
    searchTitle: pickSearchTitle(titles, title),
    cover:
      entry.images?.jpg?.large_image_url ||
      entry.images?.jpg?.image_url ||
      "",
    source,
    parsedTitle,
    titles,
  };
}

async function searchTenrai(query) {
  const q = encodeURIComponent(query.slice(0, 200));
  const result = await tenraiGet(`/anime?q=${q}&limit=8`);
  if (!result?.ok) return { ok: false, error: result?.error, results: [] };
  const results = Array.isArray(result.data?.data) ? result.data.data : [];
  return { ok: true, results };
}

async function fetchTenraiFull(malId) {
  const result = await tenraiGet(`/anime/${malId}/full`);
  if (!result?.ok) return null;
  return result.data?.data || null;
}

async function fetchTenraiRecommendations(malId) {
  const result = await tenraiGet(`/anime/${malId}/recommendations?sfw`);
  if (!result?.ok) return { ok: false, error: result?.error, cards: [] };
  return { ok: true, cards: recommendedFromTenrai(result.data?.data) };
}

function pickBestTenrai(results, query, extra = {}) {
  let best = null;
  let bestScore = -Infinity;
  for (const entry of results) {
    const score = scoreCandidate(tenraiEntryTitles(entry), query, {
      ...entry,
      ...extra,
    });
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return { entry: best, score: bestScore };
}

function pickBestAnilist(results, query, extra = {}) {
  let best = null;
  let bestScore = -Infinity;
  for (const media of results) {
    const score = scoreCandidate(anilistMediaTitles(media), query, {
      ...media,
      ...extra,
    });
    if (score > bestScore) {
      best = media;
      bestScore = score;
    }
  }
  return { media: best, score: bestScore };
}

async function identifyFromAnimetoshoSeries(infoHash, prefs = {}) {
  const series = await getAnimetoshoSeriesForHash(
    infoHash,
    prefs.useNewATDomain !== false,
  );
  const parsedTitle =
    series?.displayTitle || series?.fullTitle || series?.title || "";
  const queries = searchQueriesFromAnimetoshoSeries(series);
  if (!queries.length) {
    return { match: null, parsedTitle, error: series ? "no_title" : "no_series" };
  }

  const seasonHint = series.season > 1 ? series.season : null;
  let tenraiBest = { entry: null, score: -Infinity, query: queries[0] };
  let rateLimited = false;
  for (const query of queries) {
    const searched = await searchTenrai(query);
    if (!searched.ok && searched.error === "rate_limited") {
      rateLimited = true;
      break;
    }
    const ranked = pickBestTenrai(searched.results, query, { seasonHint });
    if (ranked.score > tenraiBest.score) {
      tenraiBest = { ...ranked, query };
    }
    if (ranked.score >= 100) break;
  }

  if (tenraiBest.entry && tenraiBest.score >= 35) {
    const full = await fetchTenraiFull(tenraiBest.entry.mal_id);
    const match = matchFromTenrai(
      full || tenraiBest.entry,
      "animetosho",
      parsedTitle,
    );
    return { match, parsedTitle, tenraiFull: full };
  }

  for (const query of queries) {
    const searched = await anilistQuery(ANILIST_SEARCH, { search: query });
    if (!searched.ok) {
      if (searched.error === "rate_limited") {
        rateLimited = true;
        break;
      }
      continue;
    }
    const ranked = pickBestAnilist(searched.data?.Page?.media || [], query, {
      seasonHint,
    });
    if (ranked.media && ranked.score >= 30) {
      const detailed = await anilistQuery(ANILIST_BY_ID, { id: ranked.media.id });
      const media = detailed.ok ? detailed.data?.Media : ranked.media;
      return {
        match: matchFromAnilist(media, "animetosho", parsedTitle),
        parsedTitle,
        anilistMedia: media,
      };
    }
  }

  return {
    match: null,
    parsedTitle,
    error: rateLimited ? "rate_limited" : "no_match",
  };
}

async function identifyAnime(infoHash, prefs = {}) {
  const hash = infoHash.trim().toLowerCase();
  const identifyCache = await readCache(IDENTIFY_CACHE_KEY);
  const cached = identifyCache[hash];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { match: cached.match, parsedTitle: cached.parsedTitle, fromCache: true };
  }

  const alId = await lookupSeaDexAlId(hash);
  if (alId) {
    const anilist = await anilistQuery(ANILIST_BY_ID, { id: alId });
    if (anilist.ok && anilist.data?.Media) {
      const match = matchFromAnilist(anilist.data.Media, "seadex", "");
      identifyCache[hash] = {
        fetchedAt: Date.now(),
        match,
        parsedTitle: match.title,
      };
      await writeCache(IDENTIFY_CACHE_KEY, identifyCache, IDENTIFY_CACHE_MAX);
      return { match, parsedTitle: match.title, anilistMedia: anilist.data.Media };
    }

    const mapped = await resolveAnimeApiIds({ alId });
    const malId = positiveTmdbId(mapped.mapping?.malId);
    if (malId) {
      const full = await fetchTenraiFull(malId);
      if (full) {
        const match = matchFromTenrai(full, "seadex", "");
        match.alId = alId;
        identifyCache[hash] = {
          fetchedAt: Date.now(),
          match,
          parsedTitle: match.title,
        };
        await writeCache(IDENTIFY_CACHE_KEY, identifyCache, IDENTIFY_CACHE_MAX);
        return { match, parsedTitle: match.title, tenraiFull: full };
      }
    }
  }

  const identified = await identifyFromAnimetoshoSeries(hash, prefs);
  if (identified.error !== "rate_limited") {
    identifyCache[hash] = {
      fetchedAt: Date.now(),
      match: identified.match,
      parsedTitle: identified.parsedTitle,
    };
    await writeCache(IDENTIFY_CACHE_KEY, identifyCache, IDENTIFY_CACHE_MAX);
  }
  return identified;
}

async function fetchAnilistVibePool(sourceVibe) {
  const tasks = [];
  const genre = seedGenre(sourceVibe);
  if (genre) {
    tasks.push(
      anilistQuery(ANILIST_VIBE, { genre }).then((page) =>
        page.ok ? page.data?.Page?.media || [] : [],
      ),
    );
  }
  if (sourceVibe.tags?.[0]) {
    tasks.push(
      anilistQuery(ANILIST_TAG, { tag: sourceVibe.tags[0] }).then((page) =>
        page.ok ? page.data?.Page?.media || [] : [],
      ),
    );
  }
  if (sourceVibe.studios?.[0]) {
    tasks.push(
      anilistQuery(ANILIST_STUDIO, { name: sourceVibe.studios[0] }).then((studio) =>
        studio.ok ? studio.data?.Studio?.media?.nodes || [] : [],
      ),
    );
  }
  if (!tasks.length) return [];
  const chunks = await Promise.all(tasks);
  return uniqueCards(chunks.flat().map((media) => cardFromAnilistMedia(media, "Same vibe")));
}

async function resolveStudioIds(source, weights) {
  if (!source || (weights?.studio || 0) <= 0) return source;
  if (source.studioIds?.length || !source.studios?.[0]) return source;
  const result = await tenraiGet(
    `/producers?q=${encodeURIComponent(source.studios[0])}&limit=8`,
  );
  if (!result?.ok) return source;
  const rows = Array.isArray(result.data?.data) ? result.data.data : [];
  const studioId = pickProducerId(rows, source.studios[0]);
  if (!studioId) return source;
  return { ...source, studioIds: [studioId] };
}

async function fetchTenraiVibePool(sourceVibe, weights) {
  const sourced = await resolveStudioIds(sourceVibe, weights);
  const paths = tenraiVibeSearchPaths(sourced, weights);
  if (!paths.length) return [];
  const chunks = await Promise.all(
    paths.map(async (path) => {
      const result = await tenraiGet(path);
      if (!result?.ok) return [];
      const rows = Array.isArray(result.data?.data) ? result.data.data : [];
      return rows.map((entry) => cardFromTenraiEntry(entry, "Same vibe"));
    }),
  );
  return uniqueCards(chunks.flat());
}

async function fetchVibePool(sourceVibe, weights, skipAnilist = false) {
  if (!sourceVibe) return [];
  const anilistCards = skipAnilist ? [] : await fetchAnilistVibePool(sourceVibe);
  if (anilistCards.length >= VIBE_ANILIST_MIN) return anilistCards;
  const tenraiCards = await fetchTenraiVibePool(sourceVibe, weights);
  return uniqueCards([...anilistCards, ...tenraiCards]);
}

async function fetchMalAlRecommended(match, skipAnilist = false) {
  let malCards = [];
  let rateLimited = false;
  if (match?.malId) {
    const tenraiRecs = await fetchTenraiRecommendations(match.malId);
    if (tenraiRecs.ok) malCards = tenraiRecs.cards;
    else if (tenraiRecs.error === "rate_limited") rateLimited = true;
  }
  let alCards = [];
  if (!skipAnilist) {
    const alRecs = await fetchAnilistRecommendations(match);
    alCards = alRecs.cards;
    if (alRecs.error === "rate_limited") rateLimited = true;
  }
  return {
    cards: filterRecommended(mergeRecommendedCards([...malCards, ...alCards])),
    rateLimited,
  };
}

function applyTenraiMatchDetails(match, tenraiFull) {
  if (!match || !tenraiFull) return;
  const titles = tenraiEntryTitles(tenraiFull);
  if (titles.length) {
    match.titles = titles;
    match.title = titles[0];
    match.searchTitle = pickSearchTitle(titles, match.searchTitle);
  }
  match.cover =
    tenraiFull.images?.jpg?.large_image_url ||
    tenraiFull.images?.jpg?.image_url ||
    match.cover;
  if (!match.malId && tenraiFull.mal_id) match.malId = tenraiFull.mal_id;
}

export async function loadSimilarAnime(infoHash, prefs = {}) {
  if (!infoHash) {
    return { ok: false, error: "missing_hash" };
  }

  const identified = await identifyAnime(infoHash, prefs);
  const match = identified.match;
  if (!match?.malId && !match?.alId) {
    return {
      ok: false,
      error: identified.error || "no_match",
      parsedTitle: identified.parsedTitle,
      match: null,
    };
  }

  const useTmdb = !!prefs.similarUseTmdbRecs;
  const recsCache = await readCache(RECS_CACHE_KEY);
  await applyAnimeApiIdsToMatch(match);
  const recKey = `${match.malId || `al:${match.alId}`}:${useTmdb ? "tmdb" : "malal"}`;
  const cachedRecs = recsCache[recKey];
  const weights = getVibeWeights(prefs);
  if (cachedRecs && Date.now() - cachedRecs.fetchedAt < CACHE_TTL_MS) {
    const excludeIds = excludeSet(match, cachedRecs.related, cachedRecs.recommended);
    return {
      ok: true,
      match,
      related: cachedRecs.related || [],
      recommended: cachedRecs.recommended || [],
      recommendedSource: cachedRecs.recommendedSource || (useTmdb ? "tmdb" : "malal"),
      recommendedError: cachedRecs.recommendedError || null,
      vibePool: cachedRecs.vibePool || [],
      sourceVibe: cachedRecs.sourceVibe || null,
      vibe: scoreVibeCards(
        cachedRecs.vibePool,
        cachedRecs.sourceVibe,
        weights,
        excludeIds,
      ),
    };
  }

  let recommended = [];
  let recommendedSource = useTmdb ? "tmdb" : "malal";
  let recommendedError = null;
  let rateLimited = false;
  let tenraiFull = identified.tenraiFull || null;
  let anilistMedia = identified.anilistMedia || null;
  const malIdForTenrai = match.malId;

  const anilistPromise =
    !anilistMedia && (match.alId || match.malId)
      ? anilistMediaByMatch(match, ANILIST_BY_ID, ANILIST_BY_MAL)
      : Promise.resolve(null);
  const tenraiPromise =
    malIdForTenrai && !tenraiFull
      ? fetchTenraiFull(malIdForTenrai)
      : Promise.resolve(tenraiFull);

  let anilistUnavailable = false;
  const [anilistResult, tenraiResult] = await Promise.all([anilistPromise, tenraiPromise]);
  if (anilistResult) {
    if (anilistResult.ok && anilistResult.data?.Media) {
      anilistMedia = anilistResult.data.Media;
      if (!match.malId && anilistMedia.idMal) match.malId = anilistMedia.idMal;
      if (!match.alId && anilistMedia.id) match.alId = anilistMedia.id;
    } else {
      anilistUnavailable = !anilistMedia;
      if (anilistResult.error === "rate_limited") rateLimited = true;
    }
  }
  if (tenraiResult) tenraiFull = tenraiResult;
  if (!tenraiFull && match.malId && match.malId !== malIdForTenrai) {
    tenraiFull = await fetchTenraiFull(match.malId);
  }

  const related = uniqueCards([
    ...relatedFromAnilist(anilistMedia),
    ...relatedFromTenrai(tenraiFull),
  ]);
  applyTenraiMatchDetails(match, tenraiFull);

  if (useTmdb) {
    const apiKey = String(prefs.tmdbApiKey || "").trim();
    if (!apiKey) {
      recommendedError = "tmdb_key_missing";
    } else {
      const tmdbRecs = await fetchTmdbRecommended(match, apiKey);
      recommended = tmdbRecs.cards;
      if (tmdbRecs.error === "rate_limited") rateLimited = true;
      else if (tmdbRecs.error) recommendedError = tmdbRecs.error;
    }
    if (!recommended.length) {
      const fallback = await fetchMalAlRecommended(match, anilistUnavailable);
      recommended = fallback.cards;
      if (fallback.rateLimited) rateLimited = true;
      if (recommended.length) {
        recommendedSource = "malal";
        recommendedError = null;
      }
    }
  } else {
    const malAl = await fetchMalAlRecommended(match, anilistUnavailable);
    recommended = malAl.cards;
    if (malAl.rateLimited) rateLimited = true;
  }

  const sourceVibe = mergeSourceVibe(
    sourceVibeFromAnilist(anilistMedia),
    sourceVibeFromTenrai(tenraiFull),
  );
  let vibePool = [];
  if (
    sourceVibe &&
    (sourceVibe.genres.length || sourceVibe.tags.length || sourceVibe.studios.length)
  ) {
    vibePool = await fetchVibePool(sourceVibe, weights, anilistUnavailable);
  }
  const excludeIds = excludeSet(match, related, recommended);
  const vibe = scoreVibeCards(vibePool, sourceVibe, weights, excludeIds);

  const skipCache =
    recommendedError === "tmdb_key_missing" ||
    recommendedError === "tmdb_failed";
  if (
    !skipCache &&
    (!rateLimited || related.length || recommended.length || vibePool.length)
  ) {
    recsCache[recKey] = {
      fetchedAt: Date.now(),
      related,
      recommended,
      recommendedSource,
      recommendedError,
      vibePool,
      sourceVibe,
    };
    await writeCache(RECS_CACHE_KEY, recsCache, RECS_CACHE_MAX);
  }

  return {
    ok: true,
    match,
    related,
    recommended,
    recommendedSource,
    recommendedError,
    vibePool,
    sourceVibe,
    vibe,
    rateLimited,
  };
}

function excludeSet(match, related, recommended) {
  const ids = new Set();
  const add = (value) => {
    if (value != null && value !== "") ids.add(String(value));
  };
  add(match?.malId);
  add(match?.alId);
  for (const card of [...(related || []), ...(recommended || [])]) {
    add(card.malId);
    add(card.alId);
  }
  return ids;
}
