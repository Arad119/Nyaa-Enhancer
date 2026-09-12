import { loadStoredPreferences } from "../../../shared/prefs.js";
import { addCheckboxToTorrentRow, applyKeywordHighlights, applySeaDexToListPage, getQuickSearchClientFilterOptions, getTorrentIdFromRow, isNyaaTorrentDataRow, shouldHideRowByFilters, shouldHideRowByQuickSearch, showNotification, syncSelectionToVisibleRows, updateTorrentRowLinkActions, withTorrentTableObserverPaused } from "../../internal.js";

export const NE_SHOW_MORE_SKIP_DELAY_MS = 1500;

export const neShowMoreState = {
  initialized: false,
  loading: false,
  loadingLabel: "Loading…",
  currentPage: 1,
  hasMore: false,
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
  if (!button) return;

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

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function applyFiltersToShowMoreRows(rows, prefs) {
  const qsOptions = getQuickSearchClientFilterOptions();
  let hidden = 0;
  rows.forEach((row) => {
    const shouldHide =
      shouldHideRowByFilters(row, prefs) ||
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

  const filterResult = applyFiltersToShowMoreRows(newRows, prefs);
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

export async function loadNextNyaaResultsPage() {
  if (neShowMoreState.loading || !neShowMoreState.hasMore) return;

  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody) return;

  neShowMoreState.loading = true;
  neShowMoreState.loadingLabel = "Loading…";
  updateShowMoreButtonState();

  try {
    const prefs = await loadStoredPreferences();
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
        showNotification(
          skippedFilteredPages > 0
            ? "No more results match your current filters."
            : neShowMoreState.hasMore
              ? "No new results on this page."
              : "No more results.",
          true,
        );
        return;
      }

      skippedFilteredPages++;
    }

    if (!foundVisible) {
      showNotification(
        skippedFilteredPages > 0
          ? "No more results match your current filters."
          : "No more results.",
        true,
      );
    }
  } catch (error) {
    console.error("Failed to load more Nyaa results:", error);
    showNotification(
      error?.status === 429
        ? "Nyaa is rate limiting requests. Please wait and try again."
        : "Failed to load more results. Please try again.",
      false,
    );
  } finally {
    neShowMoreState.loading = false;
    neShowMoreState.loadingLabel = "Loading…";
    updateShowMoreButtonState();
  }
}

export function initShowMorePagination() {
  if (neShowMoreState.initialized) return;
  if (!document.querySelector("table.torrent-list tbody")) return;

  const currentPage = getNyaaPageNumberFromHref(window.location.href);
  if (!documentHasNextNyaaPage(document, currentPage)) return;

  const tableResponsive = document.querySelector(
    ".table-responsive:has(table.torrent-list)",
  );
  if (!tableResponsive) return;

  neShowMoreState.initialized = true;
  neShowMoreState.currentPage = currentPage;
  neShowMoreState.hasMore = true;

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

  container.appendChild(button);
  tableResponsive.insertAdjacentElement("afterend", container);
}
