import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { handleSettingChange } from "../../core/registry.js";
import { addCheckboxToTorrentRow, applyKeywordHighlights, applySeaDexToListPage, getQuickSearchClientFilterOptions, getTorrentIdFromRow, getVisibleTorrentDataRows, isNyaaTorrentDataRow, shouldHideRowByFilters, shouldHideRowByQuickSearch, showNotification, syncSelectionToVisibleRows, updateTorrentRowLinkActions, withTorrentTableObserverPaused } from "../../internal.js";
import { getHistoryHashIndex } from "../history/store.js";

export const NE_SHOW_MORE_SKIP_DELAY_MS = 1500;
export const NE_SHOW_MORE_AUTO_DELAY_MS = 2500;
export const NE_SHOW_MORE_AUTO_MAX_PAGES = 6;
export const NE_SHOW_MORE_AUTO_BURST_COOLDOWN_MS = 25000;
export const NE_SHOW_MORE_RATE_LIMIT_COOLDOWN_MS = 60000;
export const NE_SHOW_MORE_UNTIL_DEFAULT = 150;
export const NE_SHOW_MORE_UNTIL_MAX = 1000;
export const NE_SHOW_MORE_UNTIL_CHIPS = [25, 50, 150, 250, 500, 1000];
export const NE_SHOW_MORE_UNTIL_STEP = 25;

export const neShowMoreState = {
  initialized: false,
  loading: false,
  loadingLabel: "Loading…",
  currentPage: 1,
  hasMore: false,
  autoBusy: false,
  autoPausedUntil: 0,
  observer: null,
};

export function getNyaaPageNumberFromHref(href, base = window.location.href) {
  try {
    const url = new URL(href, base);
    const p = parseInt(url.searchParams.get("p"), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  } catch {
    return 1;
  }
}

export function buildNyaaPageUrl(pageNumber) {
  const url = new URL(window.location.href);
  if (pageNumber <= 1) {
    url.searchParams.delete("p");
  } else {
    url.searchParams.set("p", String(pageNumber));
  }
  return url.toString();
}

export function getMaxPageNumberFromDocument(doc) {
  let max = 1;
  doc.querySelectorAll("ul.pagination a").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const page = getNyaaPageNumberFromHref(href);
    if (page > max) max = page;
  });
  const activePage = parseInt(
    doc.querySelector("ul.pagination li.active a")?.textContent,
    10,
  );
  if (Number.isFinite(activePage) && activePage > max) max = activePage;
  return max;
}

export function documentHasNextNyaaPage(doc, currentPage) {
  const nextLink = doc.querySelector('ul.pagination a[rel="next"]');
  if (nextLink) {
    const href = nextLink.getAttribute("href");
    const parent = nextLink.closest("li");
    if (
      href &&
      href !== "#" &&
      !parent?.classList.contains("disabled")
    ) {
      return getNyaaPageNumberFromHref(href) > currentPage;
    }
  }

  return getMaxPageNumberFromDocument(doc) > currentPage;
}

export function getExistingTorrentIds() {
  const ids = new Set();
  document
    .querySelectorAll("table.torrent-list tbody tr")
    .forEach((row) => {
      const id = getTorrentIdFromRow(row);
      if (id) ids.add(id);
    });
  return ids;
}

export function getShowMoreButton() {
  return document.querySelector(".ne-show-more__button");
}

export function setShowMoreButtonContent(
  button,
  { loading = false, done = false, loadingLabel = "Loading…" } = {},
) {
  if (!button) return;
  if (loading) {
    button.innerHTML = `<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> ${loadingLabel}`;
    return;
  }
  if (done) {
    button.textContent = "No more results";
    return;
  }
  button.innerHTML =
    '<i class="fa fa-angle-down" aria-hidden="true"></i> Show more';
}

export function updateShowMoreButtonState() {
  const button = getShowMoreButton();
  if (button) {
    button.disabled = neShowMoreState.loading || !neShowMoreState.hasMore;
    button.setAttribute("aria-busy", neShowMoreState.loading ? "true" : "false");

    if (neShowMoreState.loading) {
      setShowMoreButtonContent(button, {
        loading: true,
        loadingLabel: neShowMoreState.loadingLabel,
      });
    } else if (!neShowMoreState.hasMore) {
      setShowMoreButtonContent(button, { done: true });
    } else {
      setShowMoreButtonContent(button);
    }
  }
  updateAutoLoadStatus();
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function applyFiltersToShowMoreRows(rows, prefs, historyIndex = null) {
  const qsOptions = getQuickSearchClientFilterOptions();
  let hidden = 0;
  rows.forEach((row) => {
    const shouldHide =
      shouldHideRowByFilters(row, prefs, historyIndex) ||
      shouldHideRowByQuickSearch(row, qsOptions);
    row.style.display = shouldHide ? "none" : "";
    if (shouldHide) hidden++;
  });
  return {
    hidden,
    visible: rows.length - hidden,
    total: rows.length,
  };
}

export function animateNewTorrentRows(rows) {
  const visibleRows = rows.filter((row) => row.style.display !== "none");
  if (!visibleRows.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  visibleRows.forEach((row, index) => {
    row.classList.add("ne-show-more-row-enter");
    row.style.animationDelay = `${Math.min(index, 16) * 18}ms`;
    const cleanup = () => {
      row.classList.remove("ne-show-more-row-enter");
      row.style.animationDelay = "";
      row.removeEventListener("animationend", cleanup);
    };
    row.addEventListener("animationend", cleanup);
  });
}

export function resolveAnimetoshoLinksForRows(rows, prefs) {
  if (!prefs.showATLinks) return;
  rows.forEach((row) => {
    if (row.style.display === "none") return;
    updateTorrentRowLinkActions(row, prefs);
  });
}

export function prepareImportedShowMoreRow(sourceRow, pageNumber, prefs) {
  const row = document.importNode(sourceRow, true);
  row.querySelectorAll("script").forEach((script) => script.remove());
  row.classList.add("ne-show-more-page");
  row.dataset.nePage = String(pageNumber);
  addCheckboxToTorrentRow(row, prefs);
  updateTorrentRowLinkActions(row, prefs, { deferAnimetosho: true });
  return row;
}

export async function fetchAndAppendNyaaPage(tableBody, prefs) {
  const nextPage = neShowMoreState.currentPage + 1;
  const nextUrl = buildNyaaPageUrl(nextPage);
  const response = await fetch(nextUrl, { credentials: "include" });

  if (!response.ok) {
    const error = new Error(`Failed to load page (${response.status})`);
    error.status = response.status;
    throw error;
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sourceRows = Array.from(
    doc.querySelectorAll("table.torrent-list tbody tr"),
  );
  const existingIds = getExistingTorrentIds();

  const newRows = [];
  for (const sourceRow of sourceRows) {
    if (!isNyaaTorrentDataRow(sourceRow)) continue;
    const torrentId = getTorrentIdFromRow(sourceRow);
    if (torrentId && existingIds.has(torrentId)) continue;
    if (torrentId) existingIds.add(torrentId);
    newRows.push(prepareImportedShowMoreRow(sourceRow, nextPage, prefs));
  }

  neShowMoreState.currentPage = nextPage;
  neShowMoreState.hasMore =
    sourceRows.length > 0 && documentHasNextNyaaPage(doc, nextPage);

  if (!newRows.length) {
    return { added: 0, visible: 0, visibleRows: [] };
  }

  const historyIndex = prefs.historyHideFilterEnabled
    ? await getHistoryHashIndex()
    : null;
  const filterResult = applyFiltersToShowMoreRows(newRows, prefs, historyIndex);
  const visibleRows = newRows.filter((row) => row.style.display !== "none");

  await withTorrentTableObserverPaused(async () => {
    newRows.forEach((row) => tableBody.appendChild(row));
    applyKeywordHighlights(newRows, prefs);
    if (visibleRows.length) {
      animateNewTorrentRows(newRows);
      // Resolve AnimeTosho links only after visible rows are in the table.
      resolveAnimetoshoLinksForRows(newRows, prefs);
    }
  });

  syncSelectionToVisibleRows();

  return {
    added: newRows.length,
    visible: filterResult.visible,
    visibleRows,
  };
}

export async function loadNextNyaaResultsPage({ auto = false } = {}) {
  if (neShowMoreState.loading || !neShowMoreState.hasMore) return;
  if (auto && Date.now() < neShowMoreState.autoPausedUntil) return;

  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody) return;

  neShowMoreState.loading = true;
  neShowMoreState.loadingLabel = auto ? "Loading more…" : "Loading…";
  updateShowMoreButtonState();

  try {
    const prefs = await loadStoredPreferences();
    if (auto) {
      const pageResult = await fetchAndAppendNyaaPage(tableBody, prefs);
      if (pageResult.visible > 0 && prefs.showSeaDex) {
        applySeaDexToListPage(pageResult.visibleRows);
      }
      return;
    }

    let foundVisible = false;
    let skippedFilteredPages = 0;
    let isFirstFetch = true;

    while (neShowMoreState.hasMore && !foundVisible) {
      if (!isFirstFetch) {
        neShowMoreState.loadingLabel = "Looking for more results…";
        updateShowMoreButtonState();
        await delay(NE_SHOW_MORE_SKIP_DELAY_MS);
      }
      isFirstFetch = false;

      const pageResult = await fetchAndAppendNyaaPage(tableBody, prefs);

      if (pageResult.visible > 0) {
        foundVisible = true;
        if (prefs.showSeaDex) {
          applySeaDexToListPage(pageResult.visibleRows);
        }
        break;
      }

      if (!pageResult.added) {
        if (!auto) {
          showNotification(
            skippedFilteredPages > 0
              ? "No more results match your current filters."
              : neShowMoreState.hasMore
                ? "No new results on this page."
                : "No more results.",
            true,
          );
        }
        return;
      }

      skippedFilteredPages++;
    }

    if (!foundVisible && !auto) {
      showNotification(
        skippedFilteredPages > 0
          ? "No more results match your current filters."
          : "No more results.",
        true,
      );
    }
  } catch (error) {
    console.error("Failed to load more Nyaa results:", error);
    if (error?.status === 429) {
      pauseShowMoreAuto(NE_SHOW_MORE_RATE_LIMIT_COOLDOWN_MS);
      window.setTimeout(
        () => scheduleAutoShowMore(),
        NE_SHOW_MORE_RATE_LIMIT_COOLDOWN_MS + 50,
      );
      showNotification(
        "Nyaa is rate limiting requests. Auto-load paused for a minute.",
        false,
      );
    } else if (!auto) {
      showNotification("Failed to load more results. Please try again.", false);
    }
  } finally {
    neShowMoreState.loading = false;
    neShowMoreState.loadingLabel = "Loading…";
    updateShowMoreButtonState();
  }
}

export function neNormalizeShowMoreUntilVisible(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return NE_SHOW_MORE_UNTIL_DEFAULT;
  return Math.min(NE_SHOW_MORE_UNTIL_MAX, parsed);
}

export function countVisibleTorrentRows() {
  return getVisibleTorrentDataRows().length;
}

export function pauseShowMoreAuto(ms) {
  neShowMoreState.autoPausedUntil = Date.now() + ms;
  updateAutoLoadStatus();
}

export function isShowMoreAutoEnabled() {
  return (
    document.getElementById("ne-show-more-auto")?.getAttribute("aria-checked") ===
    "true"
  );
}

export function setShowMoreAutoToggle(enabled) {
  const toggle = document.getElementById("ne-show-more-auto");
  if (!toggle) return;
  toggle.setAttribute("aria-checked", enabled ? "true" : "false");
  toggle.setAttribute("aria-label", enabled ? "Auto-load on" : "Auto-load off");
}

let autoLoadStatusTimer = 0;

export function updateAutoLoadStatus() {
  const bar = document.querySelector(".ne-auto-load");
  const status = document.getElementById("ne-auto-load-status");
  if (!bar || !status) return;

  const untilInput = document.getElementById("ne-show-more-until");
  const target = neNormalizeShowMoreUntilVisible(untilInput?.value);
  const visible = countVisibleTorrentRows();
  const autoOn = isShowMoreAutoEnabled();
  const remainingPause = Math.max(0, neShowMoreState.autoPausedUntil - Date.now());

  bar.classList.toggle("is-on", autoOn);
  bar.classList.toggle("is-loading", !!neShowMoreState.loading);
  bar.classList.toggle("is-dimmed", !autoOn);
  bar.querySelectorAll("[data-ne-until-chip]").forEach((chip) => {
    chip.classList.toggle(
      "is-active",
      Number(chip.dataset.neUntilChip) === target,
    );
  });

  if (!autoOn) {
    status.textContent = `${visible} visible`;
  } else if (neShowMoreState.loading) {
    status.innerHTML =
      '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Loading…';
  } else if (remainingPause > 0 && neShowMoreState.hasMore) {
    status.textContent = `Paused ${Math.ceil(remainingPause / 1000)}s`;
  } else if (!neShowMoreState.hasMore) {
    status.textContent =
      target > 0
        ? `${visible} / ${target} · end of results`
        : `${visible} visible · end of results`;
  } else if (target === 0) {
    status.textContent = `${visible} visible · one extra page`;
  } else {
    status.textContent = `${visible} / ${target} visible`;
  }

  window.clearTimeout(autoLoadStatusTimer);
  if (autoOn && remainingPause > 0 && neShowMoreState.hasMore) {
    autoLoadStatusTimer = window.setTimeout(updateAutoLoadStatus, 1000);
  }
}

export function syncShowMoreAutoControls(prefs) {
  setShowMoreAutoToggle(!!prefs.showMoreAutoEnabled);
  const until = document.getElementById("ne-show-more-until");
  if (until) {
    until.value = String(
      neNormalizeShowMoreUntilVisible(prefs.showMoreUntilVisible),
    );
  }
  updateAutoLoadStatus();
}

export async function runAutoShowMore() {
  if (neShowMoreState.autoBusy || neShowMoreState.loading) return;
  if (!neShowMoreState.hasMore) return;
  if (document.hidden) return;
  if (Date.now() < neShowMoreState.autoPausedUntil) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showMoreAutoEnabled) return;

  const target = neNormalizeShowMoreUntilVisible(prefs.showMoreUntilVisible);
  neShowMoreState.autoBusy = true;
  let pages = 0;

  try {
    while (
      neShowMoreState.hasMore &&
      pages < NE_SHOW_MORE_AUTO_MAX_PAGES &&
      !document.hidden &&
      Date.now() >= neShowMoreState.autoPausedUntil
    ) {
      const visible = countVisibleTorrentRows();
      if (target > 0 && visible >= target) break;
      if (target === 0 && pages >= 1) break;
      if (pages > 0) await delay(NE_SHOW_MORE_AUTO_DELAY_MS);
      if (!neShowMoreState.hasMore || document.hidden) break;
      await loadNextNyaaResultsPage({ auto: true });
      pages++;
      updateAutoLoadStatus();
    }

    if (pages >= NE_SHOW_MORE_AUTO_MAX_PAGES && neShowMoreState.hasMore) {
      pauseShowMoreAuto(NE_SHOW_MORE_AUTO_BURST_COOLDOWN_MS);
      window.setTimeout(
        () => scheduleAutoShowMore(),
        NE_SHOW_MORE_AUTO_BURST_COOLDOWN_MS + 50,
      );
    }
  } finally {
    neShowMoreState.autoBusy = false;
  }
}

export function scheduleAutoShowMore() {
  if (!neShowMoreState.initialized) return;
  window.clearTimeout(scheduleAutoShowMore.timer);
  scheduleAutoShowMore.timer = window.setTimeout(() => {
    runAutoShowMore();
  }, 400);
}

export function setupShowMoreAutoObserver() {
  neShowMoreState.observer?.disconnect();
  const button = getShowMoreButton();
  if (!button || !("IntersectionObserver" in window)) return;

  neShowMoreState.observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        scheduleAutoShowMore();
      }
    },
    { root: null, rootMargin: "80px 0px", threshold: 0 },
  );
  neShowMoreState.observer.observe(button);
}

export async function commitShowMoreUntilVisible(rawValue) {
  const value = neNormalizeShowMoreUntilVisible(rawValue);
  const until = document.getElementById("ne-show-more-until");
  if (until) until.value = String(value);
  await savePreferences({ showMoreUntilVisible: value });
  await handleSettingChange("showMoreUntilVisible", value);
}

export function wireShowMoreAutoControls() {
  const toggle = document.getElementById("ne-show-more-auto");
  const until = document.getElementById("ne-show-more-until");
  const minus = document.getElementById("ne-auto-load-minus");
  const plus = document.getElementById("ne-auto-load-plus");

  toggle?.addEventListener("click", async () => {
    const next = toggle.getAttribute("aria-checked") !== "true";
    setShowMoreAutoToggle(next);
    updateAutoLoadStatus();
    await savePreferences({ showMoreAutoEnabled: next });
    await handleSettingChange("showMoreAutoEnabled", next);
    if (next) scheduleAutoShowMore();
  });

  const commitUntil = async () => {
    if (!until) return;
    await commitShowMoreUntilVisible(until.value);
  };
  until?.addEventListener("change", commitUntil);
  until?.addEventListener("blur", commitUntil);
  until?.addEventListener("input", () => updateAutoLoadStatus());
  until?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      until.blur();
    }
  });

  minus?.addEventListener("click", async () => {
    const current = neNormalizeShowMoreUntilVisible(until?.value);
    await commitShowMoreUntilVisible(
      Math.max(0, current - NE_SHOW_MORE_UNTIL_STEP),
    );
  });
  plus?.addEventListener("click", async () => {
    const current = neNormalizeShowMoreUntilVisible(until?.value);
    await commitShowMoreUntilVisible(current + NE_SHOW_MORE_UNTIL_STEP);
  });

  document.querySelectorAll("[data-ne-until-chip]").forEach((chip) => {
    chip.addEventListener("click", async () => {
      await commitShowMoreUntilVisible(chip.dataset.neUntilChip);
    });
  });
}

export function mountAutoLoadBar(tableResponsive) {
  if (document.querySelector(".ne-auto-load")) return;

  const bar = document.createElement("div");
  bar.className = "ne-auto-load";
  bar.innerHTML = `
    <div class="ne-auto-load__main">
      <div class="ne-auto-load__switch">
        <span class="ne-auto-load__title">
          <i class="fa fa-bolt" aria-hidden="true"></i>
          Auto-load
        </span>
        <button type="button" class="ne-auto-load__toggle" id="ne-show-more-auto" role="switch" aria-checked="false" aria-label="Auto-load off">
          <span class="ne-auto-load__toggle-indicator"></span>
        </button>
      </div>
      <div class="ne-auto-load__until">
        <span class="ne-auto-load__until-label">Until</span>
        <div class="ne-auto-load__stepper">
          <button type="button" class="ne-auto-load__step" id="ne-auto-load-minus" aria-label="Decrease visible target by ${NE_SHOW_MORE_UNTIL_STEP}">−</button>
          <input type="number" id="ne-show-more-until" min="0" max="${NE_SHOW_MORE_UNTIL_MAX}" step="1" inputmode="numeric" aria-label="Load until this many torrents are visible" />
          <button type="button" class="ne-auto-load__step" id="ne-auto-load-plus" aria-label="Increase visible target by ${NE_SHOW_MORE_UNTIL_STEP}">+</button>
        </div>
        <span class="ne-auto-load__until-suffix">visible</span>
      </div>
      <div class="ne-auto-load__chips" role="group" aria-label="Visible count presets">
        ${NE_SHOW_MORE_UNTIL_CHIPS.map(
          (count) =>
            `<button type="button" class="ne-auto-load__chip" data-ne-until-chip="${count}">${count}</button>`,
        ).join("")}
      </div>
    </div>
    <p class="ne-auto-load__status" id="ne-auto-load-status" aria-live="polite">0 visible</p>
  `;
  bar.title =
    "Keep loading more results until this many torrents remain visible. 0 loads one extra page at a time.";

  const toolbar = document.querySelector(
    ".button-container.nyaa-enhancer-toolbar",
  );
  const filters = document.querySelector(".ne-filters-panel");
  if (toolbar) {
    toolbar.insertAdjacentElement("afterend", bar);
  } else if (filters) {
    filters.insertAdjacentElement("beforebegin", bar);
  } else {
    tableResponsive.insertAdjacentElement("beforebegin", bar);
  }
}

export function mountShowMoreButton(tableResponsive) {
  if (document.querySelector(".ne-show-more")) return;

  const container = document.createElement("div");
  container.className = "ne-show-more";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ne-show-more__button";
  button.setAttribute("aria-label", "Show more results");
  button.title = "Load the next page of results";
  setShowMoreButtonContent(button);
  button.addEventListener("click", () => {
    loadNextNyaaResultsPage();
  });

  container.append(button);
  tableResponsive.insertAdjacentElement("afterend", container);
}

export async function initShowMorePagination() {
  if (neShowMoreState.initialized) return;
  if (!document.querySelector("table.torrent-list tbody")) return;

  const tableResponsive = document.querySelector(
    ".table-responsive:has(table.torrent-list)",
  );
  if (!tableResponsive) return;

  const currentPage = getNyaaPageNumberFromHref(window.location.href);
  const hasMore = documentHasNextNyaaPage(document, currentPage);

  neShowMoreState.initialized = true;
  neShowMoreState.currentPage = currentPage;
  neShowMoreState.hasMore = hasMore;

  mountAutoLoadBar(tableResponsive);
  if (hasMore) {
    mountShowMoreButton(tableResponsive);
    setupShowMoreAutoObserver();
  }

  const prefs = await loadStoredPreferences();
  syncShowMoreAutoControls(prefs);
  wireShowMoreAutoControls();
  document.addEventListener("visibilitychange", () => {
    updateAutoLoadStatus();
    if (!document.hidden) scheduleAutoShowMore();
  });
  if (hasMore) scheduleAutoShowMore();
}
