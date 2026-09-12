import { loadStoredPreferences } from "../../../shared/prefs.js";
import { getAnimeSearchUrl } from "../../../shared/urls.js";
import {
  registerDescriptionSectionUpdater,
  switchDescriptionPanelTab,
} from "../../core/description-tabs.js";
import { escapeHtml } from "../../core/html.js";
import { isSupportedAnimeViewPageCategory, setAnimetoshoTabStatus } from "../animetosho/index.js";
import { showQuickFilterPopup } from "../quick-search/index.js";
import {
  getVibeWeights,
  loadSimilarAnime,
  scoreVibeCards,
} from "./api.js";
import { similarCachesWereCleared } from "./cache.js";
import {
  closeSimilarCardModal,
  openSimilarCardModal,
  similarCardActionLabel,
  similarCardKey,
  clearSimilarDetailsMemory,
} from "./details.js";
import { matchExternalLinks } from "./ids.js";
import { recommendedMeta } from "./recs.js";

const RELATED_FILTERS = [
  { id: "sequel", label: "Sequel" },
  { id: "prequel", label: "Prequel" },
  { id: "spinoff", label: "Spin-off" },
  { id: "movie", label: "Movie" },
];

let similarSectionLoadId = 0;
const similarPanelState = {
  loadedKey: null,
  loading: false,
  result: null,
  observers: [],
  cardMap: new Map(),
  prefs: null,
};

function getViewPageInfoHash() {
  return document.querySelector("kbd")?.textContent?.trim().toLowerCase() || "";
}

function disconnectSimilarObservers() {
  similarPanelState.observers.forEach((observer) => observer.disconnect());
  similarPanelState.observers = [];
}

export function invalidateSimilarPanel() {
  similarPanelState.loadedKey = null;
  similarPanelState.loading = false;
  similarPanelState.result = null;
  similarPanelState.cardMap = new Map();
  disconnectSimilarObservers();
  clearSimilarDetailsMemory();
  closeSimilarCardModal(true);
  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  const body = document.querySelector("#similar-torrent-panel");
  if (!body) return;
  if (panel?.querySelector('[data-section="similar"].active')) {
    loadSimilarPanel(body);
    return;
  }
  setAnimetoshoTabStatus(
    body,
    "Open this tab to load similar anime. Results are fetched once and cached for 24 hours.",
  );
}

export function initSimilarCacheInvalidation() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !similarCachesWereCleared(changes)) return;
    invalidateSimilarPanel();
  });
}

export function removeSimilarDescriptionSection(panel) {
  similarPanelState.loadedKey = null;
  similarPanelState.loading = false;
  similarPanelState.result = null;
  similarPanelState.cardMap = new Map();
  disconnectSimilarObservers();
  clearSimilarDetailsMemory();
  closeSimilarCardModal(true);
  panel.querySelector('[data-section="similar"]')?.remove();
  panel.querySelector("#similar-torrent-panel")?.remove();
}

function placeSimilarTab(panel, tab) {
  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return;

  const amenzbTab = panel.querySelector('[data-section="amenzb"]');
  if (amenzbTab) {
    if (tab.nextElementSibling !== amenzbTab) {
      tabsHeader.insertBefore(tab, amenzbTab);
    }
    return;
  }

  const afterTab =
    panel.querySelector('[data-section="atattachments"]') ||
    panel.querySelector('[data-section="atfileinfo"]') ||
    panel.querySelector('[data-section="atscreenshots"]') ||
    panel.querySelector('[data-section="description"]');
  if (!afterTab || afterTab === tab) {
    tabsHeader.appendChild(tab);
    return;
  }
  if (tab.previousElementSibling === afterTab) return;
  if (afterTab.nextSibling) {
    tabsHeader.insertBefore(tab, afterTab.nextSibling);
  } else {
    tabsHeader.appendChild(tab);
  }
}

export function ensureSimilarDescriptionTab(panel) {
  let tab = panel.querySelector('[data-section="similar"]');
  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return null;

  if (tab) {
    placeSimilarTab(panel, tab);
    return tab;
  }

  tab = document.createElement("button");
  tab.type = "button";
  tab.className = "nyaa-enhancer-desc-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.section = "similar";
  tab.textContent = "Similar";
  tab.addEventListener("click", () => {
    switchDescriptionPanelTab(panel, "similar");
    const body = getOrCreateSimilarPanelBody(panel);
    loadSimilarPanel(body);
    requestAnimationFrame(() => {
      body
        .querySelectorAll("[data-similar-shelf]")
        .forEach((section) => layoutShelf(section));
    });
  });
  placeSimilarTab(panel, tab);
  return tab;
}

export function getOrCreateSimilarPanelBody(panel) {
  let body = panel.querySelector("#similar-torrent-panel");
  if (body) {
    ensureSimilarCardClickHandler(body);
    return body;
  }

  body = document.createElement("div");
  body.id = "similar-torrent-panel";
  body.className = "panel-body nyaa-enhancer-similar-panel";
  body.hidden = true;
  setAnimetoshoTabStatus(
    body,
    "Open this tab to load similar anime. Results are fetched once and cached for 24 hours.",
  );
  panel.appendChild(body);
  ensureSimilarCardClickHandler(body);
  return body;
}

function sourceLabel(source) {
  if (source === "seadex") return "Matched via SeaDex";
  if (source === "animetosho") return "Matched via AnimeTosho series";
  if (source === "anilist") return "Matched via AniList title search";
  if (source === "tenrai") return "Matched via title search";
  return "Matched";
}

function bindCoverErrors(root) {
  root.querySelectorAll(".nyaa-enhancer-similar-cover[src]").forEach((img) => {
    img.addEventListener("error", () => {
      img.classList.add("nyaa-enhancer-similar-cover--empty");
      img.removeAttribute("src");
    });
  });
}

function renderCover(url, extraClass = "") {
  const classes = `nyaa-enhancer-similar-cover${extraClass ? ` ${extraClass}` : ""}`;
  if (url) {
    return `<img class="${classes}" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return `<div class="${classes} nyaa-enhancer-similar-cover--empty" aria-hidden="true"></div>`;
}

function renderCard(card, prefs) {
  const searchUrl = getAnimeSearchUrl(card.searchTitle || card.title);
  const title = card.title || "";
  const meta = card.reason || "";
  const action = similarCardActionLabel(prefs);
  const key = similarCardKey(card);
  const popupAttr =
    prefs?.similarCardDetailsEnabled !== false ? ` aria-haspopup="dialog"` : "";
  return `
    <a class="nyaa-enhancer-similar-card" href="${escapeHtml(searchUrl)}" data-similar-key="${escapeHtml(key)}" data-kinds="${escapeHtml((card.kinds || []).join(" "))}" title="${escapeHtml(`${action} · ${title}`)}"${popupAttr}>
      ${renderCover(card.cover)}
      <span class="nyaa-enhancer-similar-card__body">
        <span class="nyaa-enhancer-similar-card__title">${escapeHtml(title)}</span>
        ${meta ? `<span class="nyaa-enhancer-similar-card__meta">${escapeHtml(meta)}</span>` : ""}
        <span class="nyaa-enhancer-similar-search">${escapeHtml(action)}</span>
      </span>
    </a>
  `;
}

function renderRelatedFilters(cards) {
  const counts = Object.fromEntries(RELATED_FILTERS.map((filter) => [filter.id, 0]));
  for (const card of cards) {
    for (const kind of card.kinds || []) {
      if (counts[kind] != null) counts[kind] += 1;
    }
  }
  const chips = RELATED_FILTERS.filter((filter) => counts[filter.id] > 0)
    .map(
      (filter) => `
        <button type="button" class="nyaa-enhancer-similar-chip" data-kind="${filter.id}" aria-pressed="false">
          ${escapeHtml(filter.label)}
          <span class="nyaa-enhancer-similar-chip__count">${counts[filter.id]}</span>
        </button>`,
    )
    .join("");
  if (!chips) return "";
  return `
    <div class="nyaa-enhancer-similar-filters" role="group" aria-label="Related types">
      <button type="button" class="nyaa-enhancer-similar-chip is-active" data-kind="all" aria-pressed="true">All</button>
      ${chips}
    </div>
  `;
}

function renderShelf(id, title, subtitle, cards, extraHeader = "") {
  if (!cards?.length) return "";
  return `
    <section class="nyaa-enhancer-similar-section" data-similar-shelf="${escapeHtml(id)}">
      <div class="nyaa-enhancer-similar-section__head">
        <div>
          <h3 class="nyaa-enhancer-similar-section__title">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="nyaa-enhancer-similar-section__sub">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        ${extraHeader}
      </div>
      <div class="nyaa-enhancer-similar-row" data-similar-row></div>
      <details class="nyaa-enhancer-similar-extras" data-similar-extra hidden>
        <summary class="nyaa-enhancer-similar-extras__summary">
          <span data-similar-extra-label>More</span>
        </summary>
        <div class="nyaa-enhancer-similar-extras__body" data-similar-extra-body></div>
      </details>
    </section>
  `;
}

function scoredVibe(result, prefs) {
  const exclude = new Set(
    [result.match?.malId, result.match?.alId]
      .concat((result.related || []).flatMap((card) => [card.malId, card.alId]))
      .concat((result.recommended || []).flatMap((card) => [card.malId, card.alId]))
      .filter((value) => value != null)
      .map(String),
  );
  return scoreVibeCards(
    result.vibePool,
    result.sourceVibe,
    getVibeWeights(prefs),
    exclude,
  );
}

function matchAsCard(match) {
  if (!match) return null;
  return {
    ...match,
    section: "match",
    reason: sourceLabel(match.source),
  };
}

function renderMatchLinks(match) {
  const links = matchExternalLinks(match).map(
    (link) =>
      `<a class="nyaa-enhancer-similar-id-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
  );
  if (!links.length) return "";
  return `<div class="nyaa-enhancer-similar-match__links">${links.join("")}</div>`;
}

function renderSimilarContent(result, prefs) {
  const match = result.match;
  const matchCard = matchAsCard(match);
  const matchKey = similarCardKey(matchCard);
  const parsedHint =
    match.parsedTitle && match.parsedTitle !== match.title
      ? `<span class="nyaa-enhancer-similar-parsed">From AnimeTosho: ${escapeHtml(match.parsedTitle)}</span>`
      : "";
  const vibe = result.vibe || scoredVibe(result, prefs);
  const empty =
    !result.related.length && !result.recommended.length && !vibe.length
      ? `<p class="nyaa-enhancer-similar-empty">Matched this show, but nothing similar passed the filters.</p>`
      : "";
  const limited = result.rateLimited
    ? `<p class="nyaa-enhancer-similar-empty">Some results may be missing because a recommendation API was rate-limited.</p>`
    : "";
  const tmdbNote =
    result.recommendedError === "tmdb_key_missing"
      ? `<p class="nyaa-enhancer-similar-empty">TMDB recommendations need an API key. Add one in the extension popup under TMDB, then open this tab again.</p>`
      : result.recommendedError === "tmdb_no_id"
        ? `<p class="nyaa-enhancer-similar-empty">Couldn't find a TMDB listing for this show.</p>`
        : result.recommendedError === "tmdb_failed"
          ? `<p class="nyaa-enhancer-similar-empty">TMDB didn't return similar titles. Check the API key in the extension popup.</p>`
          : "";
  const recommendedSubtitle =
    result.recommendedSource === "tmdb"
      ? "TMDB similar and recommended"
      : "Merged from MyAnimeList and AniList";

  return `
    <div class="nyaa-enhancer-similar-content">
      <header class="nyaa-enhancer-similar-match">
        <button type="button" class="nyaa-enhancer-similar-match__hit" data-similar-match data-similar-key="${escapeHtml(matchKey)}" aria-haspopup="dialog" title="${escapeHtml(`View details · ${match.title || ""}`)}">
          ${renderCover(match.cover, "nyaa-enhancer-similar-match__cover")}
          <span class="nyaa-enhancer-similar-match__text">
            <span class="nyaa-enhancer-similar-match__source">${escapeHtml(sourceLabel(match.source))}</span>
            <span class="nyaa-enhancer-similar-match__title">${escapeHtml(match.title)}</span>
            ${parsedHint}
            <span class="nyaa-enhancer-similar-search">View details</span>
          </span>
        </button>
        ${renderMatchLinks(match)}
      </header>
      ${renderShelf("related", "Related", "Sequel, prequel, spin-off, and movie", result.related, renderRelatedFilters(result.related))}
      ${renderShelf("recommended", "Recommended", recommendedSubtitle, result.recommended)}
      ${renderShelf("vibe", "Same vibe", "Shared genres, tags, and studio", vibe)}
      ${empty}
      ${tmdbNote}
      ${limited}
    </div>
  `;
}

function rememberSimilarCards(cards) {
  if (!similarPanelState.cardMap) similarPanelState.cardMap = new Map();
  for (const card of cards || []) {
    if (!card) continue;
    similarPanelState.cardMap.set(similarCardKey(card), card);
  }
}

function fillShelf(section, cards) {
  const row = section.querySelector("[data-similar-row]");
  const extra = section.querySelector("[data-similar-extra]");
  const extraBody = section.querySelector("[data-similar-extra-body]");
  if (!row || !extra || !extraBody) return;
  extraBody.replaceChildren();
  row.replaceChildren();
  rememberSimilarCards(cards);
  const html = cards
    .map((card) => renderCard(card, similarPanelState.prefs || {}))
    .join("");
  row.insertAdjacentHTML("afterbegin", html);
  extra.hidden = true;
  extra.open = false;
  extra.classList.toggle("is-expanded", section.dataset.autoOpen === "1");
  if (section.dataset.autoOpen === "1") section.dataset.pendingAutoOpen = "1";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => layoutShelf(section));
  });
}

function extraCount(extra) {
  return extra.querySelectorAll(".nyaa-enhancer-similar-card").length;
}

function syncExtraLabel(extra) {
  const label = extra?.querySelector("[data-similar-extra-label]");
  if (!label) return;
  const count = extraCount(extra);
  if (extra.open) {
    label.textContent = "Show fewer";
    return;
  }
  label.textContent = count === 1 ? "Show 1 more" : `Show ${count} more`;
}

function layoutShelf(section) {
  const row = section.querySelector("[data-similar-row]");
  const extra = section.querySelector("[data-similar-extra]");
  const extraBody = section.querySelector("[data-similar-extra-body]");
  if (!row || !extra || !extraBody) return;

  const cards = [
    ...row.querySelectorAll(".nyaa-enhancer-similar-card"),
    ...extraBody.querySelectorAll(".nyaa-enhancer-similar-card"),
  ];
  cards.forEach((card) => row.appendChild(card));

  const styles = getComputedStyle(row);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 12;
  const maxWidth = row.clientWidth || section.clientWidth;
  if (maxWidth < 32) {
    extra.hidden = true;
    return;
  }
  let used = 0;
  const overflow = [];
  cards.forEach((card, index) => {
    const width = card.getBoundingClientRect().width || 176;
    const next = used + (index === 0 ? width : gap + width);
    if (index === 0 || next <= maxWidth + 0.5) {
      used = next;
    } else {
      overflow.push(card);
    }
  });
  overflow.forEach((card) => extraBody.appendChild(card));

  const count = overflow.length;
  extra.hidden = count === 0;
  if (count === 0) {
    extra.open = false;
  } else if (section.dataset.pendingAutoOpen === "1") {
    extra.open = true;
    section.dataset.pendingAutoOpen = "";
  }
  extra.classList.toggle("is-expanded", extra.open && section.dataset.autoOpen === "1");
  syncExtraLabel(extra);
}

function visibleRelatedCards(section, allCards) {
  const active = [...section.querySelectorAll(".nyaa-enhancer-similar-chip.is-active")]
    .map((chip) => chip.dataset.kind)
    .filter((kind) => kind && kind !== "all");
  if (!active.length) return allCards;
  return allCards.filter((card) =>
    (card.kinds || []).some((kind) => active.includes(kind)),
  );
}

function bindRelatedFilters(section, allCards) {
  const chips = [...section.querySelectorAll(".nyaa-enhancer-similar-chip")];
  if (!chips.length) return;
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const kind = chip.dataset.kind;
      if (kind === "all") {
        chips.forEach((item) => {
          const on = item.dataset.kind === "all";
          item.classList.toggle("is-active", on);
          item.setAttribute("aria-pressed", on ? "true" : "false");
        });
      } else {
        chip.classList.toggle("is-active");
        chip.setAttribute(
          "aria-pressed",
          chip.classList.contains("is-active") ? "true" : "false",
        );
        const any = chips.some(
          (item) => item.dataset.kind !== "all" && item.classList.contains("is-active"),
        );
        const allChip = chips.find((item) => item.dataset.kind === "all");
        if (allChip) {
          allChip.classList.toggle("is-active", !any);
          allChip.setAttribute("aria-pressed", any ? "false" : "true");
        }
        if (!any && allChip) {
          chips.forEach((item) => {
            if (item !== allChip) {
              item.classList.remove("is-active");
              item.setAttribute("aria-pressed", "false");
            }
          });
        }
      }
      fillShelf(section, visibleRelatedCards(section, allCards));
    });
  });
}

function observeShelf(section) {
  const extra = section.querySelector("[data-similar-extra]");
  extra?.addEventListener("toggle", () => {
    extra.classList.toggle(
      "is-expanded",
      extra.open && section.dataset.autoOpen === "1",
    );
    syncExtraLabel(extra);
  });
  const observer = new ResizeObserver(() => layoutShelf(section));
  observer.observe(section);
  similarPanelState.observers.push(observer);
}

function prepareShelf(section, autoOpen) {
  if (!section) return;
  section.dataset.autoOpen = autoOpen ? "1" : "";
}

function isModifiedCardClick(event) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function openStoredSimilarCard(key, prefs) {
  const card = similarPanelState.cardMap?.get(key);
  if (!prefs || !card) return false;
  openSimilarCardModal(card, prefs);
  return true;
}

function onSimilarCardClick(event) {
  const matchEl = event.target.closest("[data-similar-match]");
  if (matchEl) {
    openStoredSimilarCard(matchEl.dataset.similarKey, similarPanelState.prefs);
    return;
  }

  const cardEl = event.target.closest("a.nyaa-enhancer-similar-card");
  if (!cardEl) return;
  if (isModifiedCardClick(event)) return;

  const prefs = similarPanelState.prefs;
  const card = similarPanelState.cardMap?.get(cardEl.dataset.similarKey);
  if (!prefs || !card) return;

  if (prefs.similarCardDetailsEnabled !== false) {
    event.preventDefault();
    openSimilarCardModal(card, prefs);
    return;
  }
  if (prefs.similarOpenQuickSearch) {
    event.preventDefault();
    showQuickFilterPopup({ animeName: card.searchTitle || card.title });
  }
}

function ensureSimilarCardClickHandler(body) {
  if (body.dataset.similarClicks === "1") return;
  body.dataset.similarClicks = "1";
  body.addEventListener("click", onSimilarCardClick);
}

function mountSimilarContent(body, result, prefs) {
  disconnectSimilarObservers();
  closeSimilarCardModal(true);
  similarPanelState.prefs = prefs;
  similarPanelState.cardMap = new Map();
  const vibe = scoredVibe(result, prefs);
  result.vibe = vibe;
  rememberSimilarCards([matchAsCard(result.match)]);
  body.innerHTML = renderSimilarContent(result, prefs);
  bindCoverErrors(body);
  ensureSimilarCardClickHandler(body);
  const autoOpen = !!prefs.similarOpenAccordions;

  const relatedSection = body.querySelector('[data-similar-shelf="related"]');
  if (relatedSection) {
    prepareShelf(relatedSection, autoOpen);
    const relatedCards = (result.related || []).map((card) => ({
      ...card,
      section: "related",
    }));
    fillShelf(relatedSection, relatedCards);
    bindRelatedFilters(relatedSection, relatedCards);
    observeShelf(relatedSection);
  }
  const recommendedSection = body.querySelector('[data-similar-shelf="recommended"]');
  if (recommendedSection) {
    prepareShelf(recommendedSection, autoOpen);
    fillShelf(
      recommendedSection,
      (result.recommended || []).map((card) => ({
        ...card,
        reason: recommendedMeta(card),
        section: "recommended",
      })),
    );
    observeShelf(recommendedSection);
  }
  const vibeSection = body.querySelector('[data-similar-shelf="vibe"]');
  if (vibeSection) {
    prepareShelf(vibeSection, autoOpen);
    fillShelf(
      vibeSection,
      vibe.map((card) => ({ ...card, section: "vibe" })),
    );
    observeShelf(vibeSection);
  }
}

async function loadSimilarPanel(body) {
  if (!body) return;
  const infoHash = getViewPageInfoHash();
  if (!infoHash) {
    setAnimetoshoTabStatus(body, "Could not read info hash.");
    return;
  }
  if (similarPanelState.loadedKey === infoHash || similarPanelState.loading) {
    return;
  }

  const loadId = ++similarSectionLoadId;
  similarPanelState.loading = true;
  setAnimetoshoTabStatus(body, "Finding similar anime…");

  try {
    const prefs = await loadStoredPreferences();
    const result = await loadSimilarAnime(infoHash, prefs);
    if (loadId !== similarSectionLoadId) return;

    if (!result.ok) {
      const parsed = result.parsedTitle
        ? ` AnimeTosho series: “${result.parsedTitle}”.`
        : "";
      if (result.error === "rate_limited") {
        setAnimetoshoTabStatus(
          body,
          "Recommendation APIs are rate-limited right now. Try again in a minute.",
        );
        return;
      }
      if (result.error === "no_series") {
        setAnimetoshoTabStatus(
          body,
          "AnimeTosho has no series match for this torrent.",
        );
        similarPanelState.loadedKey = infoHash;
        return;
      }
      setAnimetoshoTabStatus(
        body,
        `Couldn't match this torrent to an anime.${parsed}`,
      );
      similarPanelState.loadedKey = infoHash;
      return;
    }

    similarPanelState.result = result;
    mountSimilarContent(body, result, prefs);
    if (
      !result.rateLimited ||
      result.related.length ||
      result.recommended.length ||
      result.vibe?.length
    ) {
      similarPanelState.loadedKey = infoHash;
    }
  } catch (err) {
    if (loadId !== similarSectionLoadId) return;
    console.error("Nyaa Enhancer: similar anime failed", err);
    setAnimetoshoTabStatus(body, "Failed to load similar anime. Open this tab again to retry.");
  } finally {
    if (loadId === similarSectionLoadId) similarPanelState.loading = false;
  }
}

export async function refreshSimilarVibeFromPrefs() {
  const body = document.querySelector("#similar-torrent-panel");
  if (!body || !similarPanelState.result) return;
  const prefs = await loadStoredPreferences();
  mountSimilarContent(body, similarPanelState.result, prefs);
}

export async function updateSimilarDescriptionSection() {
  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  if (!panel) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showSimilarSection) {
    const wasActive = panel.querySelector('[data-section="similar"].active');
    removeSimilarDescriptionSection(panel);
    if (wasActive) {
      switchDescriptionPanelTab(panel, "description");
    }
    return;
  }

  if (!window.location.pathname.startsWith("/view/")) {
    removeSimilarDescriptionSection(panel);
    return;
  }

  if (!isSupportedAnimeViewPageCategory()) {
    removeSimilarDescriptionSection(panel);
    return;
  }

  ensureSimilarDescriptionTab(panel);
  getOrCreateSimilarPanelBody(panel);
}

registerDescriptionSectionUpdater(updateSimilarDescriptionSection);
