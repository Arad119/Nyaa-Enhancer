import { getPreferences, loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { convertToBytes, fetchJsonViaBackground, formatNekoBTBytes, isNyaaTorrentDataRow, showNotification, syncSelectionToVisibleRows } from "../../internal.js";

// Function to filter torrents by last 30 days
export function filterByLast30Days() {
  const rows = document.querySelectorAll("table.torrent-list tbody tr");
  const now = Date.now() / 1000; // Current time in seconds (Unix timestamp)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60; // 30 days in seconds
  let hiddenCount = 0;
  let visibleCount = 0;

  rows.forEach((row) => {
    // Find the date cell with data-timestamp attribute
    const dateCell = row.querySelector("td[data-timestamp]");

    if (dateCell) {
      const timestamp = parseInt(dateCell.getAttribute("data-timestamp"), 10);

      // Hide rows older than 30 days
      if (timestamp < thirtyDaysAgo) {
        row.style.display = "none";
        hiddenCount++;
      } else {
        row.style.display = "";
        visibleCount++;
      }
    }
  });

  showNotification(
    `Showing ${visibleCount} torrents from the last 30 days (${hiddenCount} hidden)`,
    true,
  );
  syncSelectionToVisibleRows();
}

export const QS_FILE_SIZE_SLIDER_MAX_MB = 51200;
export const QS_FILE_SIZE_ABSOLUTE_MAX_BYTES = QS_FILE_SIZE_SLIDER_MAX_MB * 1024 * 1024;
export const QS_FILE_SIZE_UNIT_MULTIPLIERS = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
  TiB: 1024 * 1024 * 1024 * 1024,
};

export function formatQuickSearchFileSizeValue(value, unit) {
  if (unit === "B") {
    return String(Math.round(value));
  }
  if (value >= 100) {
    return String(Math.round(value));
  }
  if (value >= 10) {
    return String(Math.round(value * 10) / 10);
  }
  return String(Math.round(value * 100) / 100);
}

export function bytesToQuickSearchDisplay(bytes, preferredUnit) {
  if (
    preferredUnit &&
    QS_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit] !== undefined
  ) {
    const value = bytes / QS_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit];
    return {
      value: formatQuickSearchFileSizeValue(value, preferredUnit),
      unit: preferredUnit,
    };
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const unit = units[unitIndex];
  return {
    value: formatQuickSearchFileSizeValue(value, unit),
    unit,
  };
}

export function quickSearchDisplayToBytes(value, unit) {
  const num = parseFloat(value);
  const multiplier = QS_FILE_SIZE_UNIT_MULTIPLIERS[unit];
  if (!Number.isFinite(num) || num < 0 || multiplier === undefined) {
    return 0;
  }
  return Math.round(num * multiplier);
}

export function clampQuickSearchFileSizeBounds(minBytes, maxBytes) {
  let min = Math.max(0, Math.min(minBytes, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES));
  let max = Math.max(0, Math.min(maxBytes, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES));
  if (min > max) {
    if (minBytes > maxBytes) {
      min = max;
    } else {
      max = min;
    }
  }
  return { min, max };
}

export function formatQuickSearchFileSizeSummary(minBytes, maxBytes) {
  if (minBytes <= 0 && maxBytes >= QS_FILE_SIZE_ABSOLUTE_MAX_BYTES) {
    return "Any size";
  }
  return `${formatNekoBTBytes(minBytes)} – ${formatNekoBTBytes(maxBytes)}`;
}

export function updateQuickSearchFileSizeFill() {
  const minSlider = document.getElementById("qs-file-size-min-slider");
  const maxSlider = document.getElementById("qs-file-size-max-slider");
  const fill = document.getElementById("qs-file-size-fill");
  if (!minSlider || !maxSlider || !fill) return;

  const minVal = parseInt(minSlider.value, 10);
  const maxVal = parseInt(maxSlider.value, 10);
  const minPercent = (minVal / QS_FILE_SIZE_SLIDER_MAX_MB) * 100;
  const maxPercent = (maxVal / QS_FILE_SIZE_SLIDER_MAX_MB) * 100;
  fill.style.left = `${minPercent}%`;
  fill.style.width = `${maxPercent - minPercent}%`;
}

export function syncQuickSearchFileSizeControls(minBytes, maxBytes) {
  const bounds = clampQuickSearchFileSizeBounds(minBytes, maxBytes);
  const minUnitSelect = document.getElementById("qs-file-size-min-unit");
  const maxUnitSelect = document.getElementById("qs-file-size-max-unit");
  const minDisp = bytesToQuickSearchDisplay(bounds.min, minUnitSelect?.value);
  const maxDisp = bytesToQuickSearchDisplay(bounds.max, maxUnitSelect?.value);

  if (minUnitSelect) minUnitSelect.value = minDisp.unit;
  if (maxUnitSelect) maxUnitSelect.value = maxDisp.unit;

  document.getElementById("qs-file-size-min-input").value = String(
    minDisp.value,
  );
  document.getElementById("qs-file-size-max-input").value = String(
    maxDisp.value,
  );
  document.getElementById("qs-file-size-min-slider").value = String(
    Math.round(bounds.min / (1024 * 1024)),
  );
  document.getElementById("qs-file-size-max-slider").value = String(
    Math.round(bounds.max / (1024 * 1024)),
  );
  document.getElementById("qs-file-size-summary").textContent =
    formatQuickSearchFileSizeSummary(bounds.min, bounds.max);
  updateQuickSearchFileSizeFill();
  return bounds;
}

export function readQuickSearchFileSizeBounds() {
  const minBytes = quickSearchDisplayToBytes(
    document.getElementById("qs-file-size-min-input").value,
    document.getElementById("qs-file-size-min-unit").value,
  );
  const maxBytes = quickSearchDisplayToBytes(
    document.getElementById("qs-file-size-max-input").value,
    document.getElementById("qs-file-size-max-unit").value,
  );
  return clampQuickSearchFileSizeBounds(minBytes, maxBytes);
}

export function isQuickSearchFileSizeFilterActive(enabled, minBytes, maxBytes) {
  return (
    enabled &&
    (minBytes > 0 || maxBytes < QS_FILE_SIZE_ABSOLUTE_MAX_BYTES)
  );
}

export function initQuickSearchFileSizeControls() {
  syncQuickSearchFileSizeControls(0, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES);

  const sizeSection = document.getElementById("qs-file-size-section");
  const sizeEnabledCheckbox = document.getElementById("qs-file-size-enabled");

  sizeEnabledCheckbox.addEventListener("change", () => {
    sizeSection.hidden = !sizeEnabledCheckbox.checked;
    if (sizeEnabledCheckbox.checked) {
      syncQuickSearchFileSizeControls(
        500 * 1024 * 1024,
        4 * 1024 * 1024 * 1024,
      );
    }
  });

  const handleSliderInput = (isMinSlider) => {
    const minSlider = document.getElementById("qs-file-size-min-slider");
    const maxSlider = document.getElementById("qs-file-size-max-slider");
    let minMb = parseInt(minSlider.value, 10);
    let maxMb = parseInt(maxSlider.value, 10);

    if (isMinSlider && minMb > maxMb) {
      maxMb = minMb;
      maxSlider.value = String(maxMb);
    } else if (!isMinSlider && maxMb < minMb) {
      minMb = maxMb;
      minSlider.value = String(minMb);
    }

    syncQuickSearchFileSizeControls(
      minMb * 1024 * 1024,
      maxMb * 1024 * 1024,
    );
  };

  document
    .getElementById("qs-file-size-min-slider")
    .addEventListener("input", () => handleSliderInput(true));
  document
    .getElementById("qs-file-size-max-slider")
    .addEventListener("input", () => handleSliderInput(false));

  ["qs-file-size-min-input", "qs-file-size-max-input"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const bounds = readQuickSearchFileSizeBounds();
      syncQuickSearchFileSizeControls(bounds.min, bounds.max);
    });
  });

  ["qs-file-size-min-unit", "qs-file-size-max-unit"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const bounds = readQuickSearchFileSizeBounds();
      syncQuickSearchFileSizeControls(bounds.min, bounds.max);
    });
  });
}

export function getQuickSearchClientFilterOptions() {
  const urlParams = new URLSearchParams(window.location.search);
  const last30Days = urlParams.get("dateFilter") === "30days";
  const sizeMinParam = urlParams.get("sizeMin");
  const sizeMaxParam = urlParams.get("sizeMax");
  const sizeEnabled = sizeMinParam !== null && sizeMaxParam !== null;

  if (!last30Days && !sizeEnabled) return null;

  return {
    last30Days,
    sizeEnabled,
    sizeMin: sizeEnabled ? parseInt(sizeMinParam, 10) : 0,
    sizeMax: sizeEnabled
      ? parseInt(sizeMaxParam, 10)
      : QS_FILE_SIZE_ABSOLUTE_MAX_BYTES,
  };
}

export function shouldHideRowByQuickSearch(row, options) {
  if (!options) return false;

  if (options.last30Days) {
    const dateCell = row.querySelector("td[data-timestamp]");
    if (dateCell) {
      const timestamp = parseInt(dateCell.getAttribute("data-timestamp"), 10);
      const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;
      if (timestamp < thirtyDaysAgo) return true;
    }
  }

  if (options.sizeEnabled) {
    const sizeCell = row.querySelector("td:nth-of-type(4)");
    if (sizeCell) {
      const sizeInBytes = convertToBytes(sizeCell.textContent);
      if (sizeInBytes < options.sizeMin || sizeInBytes > options.sizeMax) {
        return true;
      }
    }
  }

  return false;
}

export function applyQuickSearchClientFilters(options) {
  const rows = document.querySelectorAll("table.torrent-list tbody tr");
  let hiddenCount = 0;
  let visibleCount = 0;
  const filterParts = [];

  rows.forEach((row) => {
    if (!isNyaaTorrentDataRow(row)) return;

    if (shouldHideRowByQuickSearch(row, options)) {
      row.style.display = "none";
      hiddenCount++;
      return;
    }

    if (row.style.display === "none") {
      hiddenCount++;
      return;
    }

    visibleCount++;
  });

  if (options.last30Days) filterParts.push("last 30 days");
  if (options.sizeEnabled) {
    filterParts.push(
      `size ${formatNekoBTBytes(options.sizeMin)} – ${formatNekoBTBytes(options.sizeMax)}`,
    );
  }

  const filterLabel = filterParts.length
    ? ` filtered by ${filterParts.join(" and ")}`
    : "";

  showNotification(
    `Showing ${visibleCount} torrents (${hiddenCount} hidden)${filterLabel}`,
    true,
  );
  syncSelectionToVisibleRows();
}

export const XEM_ALL_NAMES_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TMDB_SEARCH_DEBOUNCE_MS = 500;
export const TMDB_SEARCH_MIN_INTERVAL_MS = 600;
export let tmdbSearchThrottleChain = Promise.resolve();
export let tmdbSearchNextAllowedAt = 0;
export const quickSearchAnimeMemoryCache = {
  tmdbSearch: new Map(),
  tmdbExternalIds: new Map(),
  tmdbAltTitles: new Map(),
  xemShowNames: new Map(),
  xemAllNames: { tvdb: null, anidb: null },
  xemAllNamesPromises: { tvdb: null, anidb: null },
};

export function clearQuickSearchAnimeCaches() {
  quickSearchAnimeMemoryCache.tmdbSearch.clear();
  quickSearchAnimeMemoryCache.tmdbExternalIds.clear();
  quickSearchAnimeMemoryCache.tmdbAltTitles.clear();
  quickSearchAnimeMemoryCache.xemShowNames.clear();
  quickSearchAnimeMemoryCache.xemAllNames.tvdb = null;
  quickSearchAnimeMemoryCache.xemAllNames.anidb = null;
  quickSearchAnimeMemoryCache.xemAllNamesPromises.tvdb = null;
  quickSearchAnimeMemoryCache.xemAllNamesPromises.anidb = null;
  tmdbSearchThrottleChain = Promise.resolve();
  tmdbSearchNextAllowedAt = 0;
}

export function normalizeAnimeAliasName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function flattenXemNamesPayload(payload) {
  const names = new Set();
  if (!payload || typeof payload !== "object") return [];

  for (const value of Object.values(payload)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) names.add(trimmed);
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const trimmed = String(entry || "").trim();
        if (trimmed) names.add(trimmed);
      });
      continue;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach((entry) => {
        if (Array.isArray(entry)) {
          entry.forEach((name) => {
            const trimmed = String(name || "").trim();
            if (trimmed) names.add(trimmed);
          });
        }
      });
    }
  }

  return [...names];
}

export function addAnimeAliasNames(targetSet, names) {
  names.forEach((name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    targetSet.add(trimmed);
  });
}

export function dedupeAnimeAliasNames(names, preferredFirst = []) {
  const seen = new Set();
  const ordered = [];

  const pushName = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const key = normalizeAnimeAliasName(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(trimmed);
  };

  preferredFirst.forEach(pushName);
  names.forEach(pushName);
  return ordered;
}

export async function getXemAllNames(origin) {
  if (quickSearchAnimeMemoryCache.xemAllNames[origin]) {
    return quickSearchAnimeMemoryCache.xemAllNames[origin];
  }

  const storageKey = `xemAllNames_${origin}`;
  const stored = await chrome.storage.local.get({ [storageKey]: null });
  const cached = stored[storageKey];
  if (
    cached?.data &&
    cached.fetchedAt &&
    Date.now() - cached.fetchedAt < XEM_ALL_NAMES_TTL_MS
  ) {
    quickSearchAnimeMemoryCache.xemAllNames[origin] = cached.data;
    return cached.data;
  }

  if (!quickSearchAnimeMemoryCache.xemAllNamesPromises[origin]) {
    quickSearchAnimeMemoryCache.xemAllNamesPromises[origin] = (async () => {
      const url = `https://thexem.info/map/allNames?origin=${encodeURIComponent(origin)}&defaultNames=1`;
      const result = await fetchJsonViaBackground(url);
      if (!result.ok || result.data?.result !== "success") {
        throw new Error(
          result.data?.message || result.error || "TheXEM request failed",
        );
      }
      quickSearchAnimeMemoryCache.xemAllNames[origin] = result.data.data || {};
      await chrome.storage.local.set({
        [storageKey]: {
          fetchedAt: Date.now(),
          data: result.data.data || {},
        },
      });
      return result.data.data || {};
    })().finally(() => {
      quickSearchAnimeMemoryCache.xemAllNamesPromises[origin] = null;
    });
  }

  return quickSearchAnimeMemoryCache.xemAllNamesPromises[origin];
}

export async function fetchXemShowNames(origin, entityId) {
  const cacheKey = `${origin}:${entityId}`;
  if (quickSearchAnimeMemoryCache.xemShowNames.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.xemShowNames.get(cacheKey);
  }

  const url = `https://thexem.info/map/names?origin=${encodeURIComponent(origin)}&id=${encodeURIComponent(entityId)}&defaultNames=1`;
  const result = await fetchJsonViaBackground(url);
  if (!result.ok || result.data?.result !== "success") {
    quickSearchAnimeMemoryCache.xemShowNames.set(cacheKey, []);
    return [];
  }

  const names = flattenXemNamesPayload(result.data.data);
  quickSearchAnimeMemoryCache.xemShowNames.set(cacheKey, names);
  return names;
}

export function getAllNamesEntryNames(allNamesData, entityId) {
  const entry = allNamesData?.[String(entityId)];
  if (!entry) return [];
  return Array.isArray(entry) ? entry.filter(Boolean) : [];
}

export function findLinkedAnidbIds(names, anidbAllNames) {
  const normalizedNames = new Set(
    names.map((name) => normalizeAnimeAliasName(name)).filter(Boolean),
  );
  if (!normalizedNames.size || !anidbAllNames) return [];

  const linkedIds = new Set();
  for (const [anidbId, entries] of Object.entries(anidbAllNames)) {
    if (!Array.isArray(entries)) continue;
    const hasOverlap = entries.some((name) =>
      normalizedNames.has(normalizeAnimeAliasName(name)),
    );
    if (hasOverlap) linkedIds.add(String(anidbId));
  }
  return [...linkedIds];
}

export async function fetchTmdbJson(url) {
  return new Promise((resolve, reject) => {
    tmdbSearchThrottleChain = tmdbSearchThrottleChain
      .then(async () => {
        const waitMs = Math.max(0, tmdbSearchNextAllowedAt - Date.now());
        if (waitMs > 0) {
          await new Promise((delayResolve) => setTimeout(delayResolve, waitMs));
        }

        const result = await fetchJsonViaBackground(url);
        tmdbSearchNextAllowedAt = Date.now() + TMDB_SEARCH_MIN_INTERVAL_MS;

        if (result.ok && result.data?.status_code === 429) {
          tmdbSearchNextAllowedAt = Date.now() + 2000;
          resolve({
            ok: false,
            error: "rate_limited",
            data: result.data,
          });
          return;
        }

        resolve(result);
      })
      .catch(reject);
  });
}

export async function searchTmdbAnime(query, apiKey) {
  const cacheKey = `${apiKey}:${query.toLowerCase()}`;
  if (quickSearchAnimeMemoryCache.tmdbSearch.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.tmdbSearch.get(cacheKey);
  }

  const url = `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US`;
  const result = await fetchTmdbJson(url);
  if (!result.ok || !Array.isArray(result.data?.results)) {
    if (result.error === "rate_limited") {
      throw new Error("rate_limited");
    }
    quickSearchAnimeMemoryCache.tmdbSearch.set(cacheKey, []);
    return [];
  }

  const shows = result.data.results
    .filter((entry) => entry?.id && entry?.name)
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      originalName: entry.original_name || "",
      firstAirDate: entry.first_air_date || "",
      overview: entry.overview || "",
    }));

  quickSearchAnimeMemoryCache.tmdbSearch.set(cacheKey, shows);
  return shows;
}

export async function getTmdbTvdbId(tmdbId, apiKey) {
  const cacheKey = `${apiKey}:${tmdbId}`;
  if (quickSearchAnimeMemoryCache.tmdbExternalIds.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.tmdbExternalIds.get(cacheKey);
  }

  const url = `https://api.themoviedb.org/3/tv/${encodeURIComponent(tmdbId)}/external_ids?api_key=${encodeURIComponent(apiKey)}`;
  const result = await fetchTmdbJson(url);
  const tvdbId = result.ok ? result.data?.tvdb_id || null : null;
  quickSearchAnimeMemoryCache.tmdbExternalIds.set(cacheKey, tvdbId);
  return tvdbId;
}

export async function getTmdbAlternativeTitles(tmdbId, apiKey) {
  const cacheKey = `${apiKey}:${tmdbId}`;
  if (quickSearchAnimeMemoryCache.tmdbAltTitles.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.tmdbAltTitles.get(cacheKey);
  }

  const url = `https://api.themoviedb.org/3/tv/${encodeURIComponent(tmdbId)}/alternative_titles?api_key=${encodeURIComponent(apiKey)}`;
  const result = await fetchTmdbJson(url);
  const titles = result.ok
    ? (result.data?.results || [])
        .map((entry) => entry?.title)
        .filter(Boolean)
    : [];
  quickSearchAnimeMemoryCache.tmdbAltTitles.set(cacheKey, titles);
  return titles;
}

export async function resolveAnimeAliasesForSelection(selection, apiKey) {
  const aliasSet = new Set();
  addAnimeAliasNames(aliasSet, [selection.name, selection.originalName]);

  const [tvdbId, tmdbAltTitles] = await Promise.all([
    getTmdbTvdbId(selection.id, apiKey),
    getTmdbAlternativeTitles(selection.id, apiKey),
  ]);
  addAnimeAliasNames(aliasSet, tmdbAltTitles);

  let tvdbAllNames = null;
  let anidbAllNames = null;

  try {
    [tvdbAllNames, anidbAllNames] = await Promise.all([
      getXemAllNames("tvdb"),
      getXemAllNames("anidb"),
    ]);
  } catch {
    tvdbAllNames = null;
    anidbAllNames = null;
  }

  const tvdbNames = [];
  if (tvdbId) {
    const [xemTvdbNames, cachedTvdbNames] = await Promise.all([
      fetchXemShowNames("tvdb", tvdbId),
      Promise.resolve(getAllNamesEntryNames(tvdbAllNames, tvdbId)),
    ]);
    tvdbNames.push(...xemTvdbNames, ...cachedTvdbNames);
    addAnimeAliasNames(aliasSet, tvdbNames);
  }

  if (tvdbId && anidbAllNames) {
    const linkedAnidbIds = findLinkedAnidbIds([...aliasSet, ...tvdbNames], anidbAllNames);
    const anidbNameLists = await Promise.all(
      linkedAnidbIds.map(async (anidbId) => {
        const [xemAnidbNames, cachedAnidbNames] = await Promise.all([
          fetchXemShowNames("anidb", anidbId),
          Promise.resolve(getAllNamesEntryNames(anidbAllNames, anidbId)),
        ]);
        return [...xemAnidbNames, ...cachedAnidbNames];
      }),
    );
    anidbNameLists.forEach((names) => addAnimeAliasNames(aliasSet, names));
  }

  return dedupeAnimeAliasNames([...aliasSet], [selection.name]);
}

export function initQuickSearchAnimeAutocomplete(popup) {
  const animeInput = popup.querySelector("#anime-name");
  const suggestionsEl = popup.querySelector("#anime-name-suggestions");
  const aliasesPanel = popup.querySelector("#anime-name-aliases");
  const aliasesListEl = popup.querySelector("#anime-aliases-list");
  const aliasesPreviewEl = popup.querySelector("#anime-aliases-preview");
  const aliasesMetaEl = popup.querySelector("#anime-aliases-meta");
  const aliasesClearBtn = popup.querySelector("#anime-aliases-clear");
  const aliasesInvertBtn = popup.querySelector("#anime-aliases-invert");
  const aliasesApplyBtn = popup.querySelector("#anime-aliases-apply");
  const hintEl = popup.querySelector("#anime-name-hint");
  let searchTimer = null;
  let activeSearchToken = 0;
  let selectedAliases = [];
  let lastAliasCheckbox = null;

  const getAliasCheckboxes = () => [
    ...aliasesListEl.querySelectorAll('input[type="checkbox"]'),
  ];

  const hideSuggestions = () => {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  };

  const setAliasActionsEnabled = (enabled) => {
    aliasesClearBtn.disabled = !enabled;
    aliasesInvertBtn.disabled = !enabled;
    aliasesApplyBtn.disabled = !enabled;
  };

  const hideAliasesPanel = () => {
    aliasesPanel.hidden = true;
    aliasesPanel.classList.remove("is-ready");
    aliasesListEl.innerHTML = "";
    aliasesListEl.removeAttribute("title");
    aliasesPreviewEl.textContent = "";
    aliasesMetaEl.textContent = "";
    selectedAliases = [];
    lastAliasCheckbox = null;
    setAliasActionsEnabled(false);
  };

  const updateAliasPreview = () => {
    const boxes = getAliasCheckboxes();
    const checked = boxes
      .filter((input) => input.checked)
      .map((input) => input.value);
    const hasBoxes = boxes.length > 0;

    aliasesPreviewEl.textContent = checked.length
      ? checked.join("|")
      : hasBoxes
        ? "Select at least one alias"
        : "";
    aliasesMetaEl.textContent = hasBoxes
      ? `${checked.length} of ${boxes.length} selected · Shift+click a range`
      : "";
    aliasesClearBtn.disabled = checked.length === 0;
    aliasesInvertBtn.disabled = !hasBoxes;
    aliasesApplyBtn.disabled = checked.length === 0;
  };

  const onAliasCheckboxClick = function (event) {
    if (event.shiftKey && lastAliasCheckbox && lastAliasCheckbox !== this) {
      const boxes = getAliasCheckboxes();
      const start = boxes.indexOf(this);
      const end = boxes.indexOf(lastAliasCheckbox);
      if (start !== -1 && end !== -1) {
        const checked = this.checked;
        boxes
          .slice(Math.min(start, end), Math.max(start, end) + 1)
          .forEach((box) => {
            box.checked = checked;
          });
      }
    }

    lastAliasCheckbox = this;
    updateAliasPreview();
  };

  const renderAliasCheckboxes = (aliases) => {
    selectedAliases = aliases;
    lastAliasCheckbox = null;
    aliasesListEl.innerHTML = "";
    aliases.forEach((alias) => {
      const label = document.createElement("label");
      label.className = "qf-anime-alias-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = alias;
      input.checked = true;
      input.addEventListener("click", onAliasCheckboxClick);
      const text = document.createElement("span");
      text.textContent = alias;
      label.append(input, text);
      aliasesListEl.appendChild(label);
    });
    aliasesPanel.hidden = aliases.length === 0;
    aliasesPanel.classList.toggle("is-ready", aliases.length > 0);
    aliasesListEl.title = aliases.length
      ? "Shift+click to select or deselect a range"
      : "";
    updateAliasPreview();
  };

  const applySelectedAliases = () => {
    const checked = getAliasCheckboxes()
      .filter((input) => input.checked)
      .map((input) => input.value.trim())
      .filter(Boolean);
    if (!checked.length) {
      showNotification("Select at least one alias to apply", false);
      return;
    }
    animeInput.value = checked.join("|");
    hideSuggestions();
    showNotification("Anime search aliases applied", true);
  };

  aliasesClearBtn.addEventListener("click", () => {
    getAliasCheckboxes().forEach((box) => {
      box.checked = false;
    });
    updateAliasPreview();
  });

  aliasesInvertBtn.addEventListener("click", () => {
    getAliasCheckboxes().forEach((box) => {
      box.checked = !box.checked;
    });
    updateAliasPreview();
  });

  aliasesApplyBtn.addEventListener("click", applySelectedAliases);
  suggestionsEl.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  loadStoredPreferences().then((prefs) => {
    if (!prefs.tmdbApiKey) {
      hintEl.hidden = false;
      hintEl.textContent =
        "Add a TMDB API key in extension settings to search anime titles and load aliases.";
    }
  });

  animeInput.addEventListener("input", () => {
    hideAliasesPanel();
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
      const query = animeInput.value.trim();
      if (query.length < 2) {
        hideSuggestions();
        return;
      }

      const prefs = await loadStoredPreferences();
      if (!prefs.tmdbApiKey) {
        hideSuggestions();
        return;
      }

      const token = ++activeSearchToken;
      suggestionsEl.hidden = false;
      suggestionsEl.innerHTML =
        '<div class="qf-anime-suggestion qf-anime-suggestion--status">Searching…</div>';

      try {
        const results = await searchTmdbAnime(query, prefs.tmdbApiKey);
        if (token !== activeSearchToken) return;

        if (!results.length) {
          suggestionsEl.innerHTML =
            '<div class="qf-anime-suggestion qf-anime-suggestion--status">No matches found</div>';
          return;
        }

        suggestionsEl.innerHTML = "";
        results.forEach((result) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "qf-anime-suggestion";
          const title = document.createElement("span");
          title.className = "qf-anime-suggestion-title";
          title.textContent = result.name;
          button.appendChild(title);
          const meta = [result.originalName, result.firstAirDate]
            .filter(Boolean)
            .join(" · ");
          if (meta) {
            const metaEl = document.createElement("span");
            metaEl.className = "qf-anime-suggestion-meta";
            metaEl.textContent = meta;
            button.appendChild(metaEl);
          }
          button.addEventListener("click", async () => {
            hideSuggestions();
            animeInput.value = result.name;
            aliasesPanel.hidden = false;
            aliasesPanel.classList.remove("is-ready");
            lastAliasCheckbox = null;
            setAliasActionsEnabled(false);
            aliasesMetaEl.textContent = "";
            aliasesListEl.innerHTML =
              '<div class="qf-anime-suggestion qf-anime-suggestion--status">Loading aliases…</div>';
            aliasesPreviewEl.textContent = "";

            try {
              const aliases = await resolveAnimeAliasesForSelection(
                result,
                prefs.tmdbApiKey,
              );
              if (!aliases.length) {
                aliasesListEl.innerHTML =
                  '<div class="qf-anime-suggestion qf-anime-suggestion--status">No aliases found</div>';
                return;
              }
              renderAliasCheckboxes(aliases);
            } catch {
              aliasesListEl.innerHTML =
                '<div class="qf-anime-suggestion qf-anime-suggestion--status">Failed to load aliases</div>';
            }
          });
          suggestionsEl.appendChild(button);
        });
      } catch (error) {
        if (token !== activeSearchToken) return;
        suggestionsEl.innerHTML =
          error?.message === "rate_limited"
            ? '<div class="qf-anime-suggestion qf-anime-suggestion--status">TMDB rate limit reached — wait a moment</div>'
            : '<div class="qf-anime-suggestion qf-anime-suggestion--status">Search failed</div>';
      }
    }, TMDB_SEARCH_DEBOUNCE_MS);
  });

  animeInput.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 150);
  });

  animeInput.addEventListener("focus", () => {
    if (suggestionsEl.childElementCount > 0) {
      suggestionsEl.hidden = false;
    }
  });

  return () => {
    hideSuggestions();
    hideAliasesPanel();
  };
}

export function getDefaultQuickSearchState() {
  return {
    animeName: "",
    encoder: "",
    quality: "",
    format: "",
    source: "",
    category: "0",
    dualAudio: false,
    seasonPack: false,
    last30Days: false,
    fileSizeEnabled: false,
    fileSizeMinBytes: 0,
    fileSizeMaxBytes: QS_FILE_SIZE_ABSOLUTE_MAX_BYTES,
    fileSizeMinUnit: "MiB",
    fileSizeMaxUnit: "GiB",
  };
}

export function readQuickSearchFormState() {
  const sizeBounds = readQuickSearchFileSizeBounds();
  return {
    animeName: document.getElementById("anime-name")?.value || "",
    encoder: document.getElementById("encoder-name")?.value || "",
    quality: document.getElementById("quality")?.value || "",
    format: document.getElementById("format")?.value || "",
    source: document.getElementById("source")?.value || "",
    category: document.getElementById("category")?.value || "0",
    dualAudio: document.getElementById("dual-audio")?.checked || false,
    seasonPack: document.getElementById("season-pack")?.checked || false,
    last30Days: document.getElementById("last-30-days")?.checked || false,
    fileSizeEnabled:
      document.getElementById("qs-file-size-enabled")?.checked || false,
    fileSizeMinBytes: sizeBounds.min,
    fileSizeMaxBytes: sizeBounds.max,
    fileSizeMinUnit:
      document.getElementById("qs-file-size-min-unit")?.value || "MiB",
    fileSizeMaxUnit:
      document.getElementById("qs-file-size-max-unit")?.value || "GiB",
  };
}

export function applyQuickSearchFormState(state) {
  const merged = { ...getDefaultQuickSearchState(), ...state };

  document.getElementById("anime-name").value = merged.animeName;
  document.getElementById("encoder-name").value = merged.encoder;
  document.getElementById("quality").value = merged.quality;
  document.getElementById("format").value = merged.format;
  document.getElementById("source").value = merged.source;
  document.getElementById("category").value = merged.category;
  document.getElementById("dual-audio").checked = merged.dualAudio;
  document.getElementById("season-pack").checked = merged.seasonPack;
  document.getElementById("last-30-days").checked = merged.last30Days;
  document.getElementById("qs-file-size-enabled").checked =
    merged.fileSizeEnabled;
  document.getElementById("qs-file-size-section").hidden =
    !merged.fileSizeEnabled;

  const minUnitSelect = document.getElementById("qs-file-size-min-unit");
  const maxUnitSelect = document.getElementById("qs-file-size-max-unit");
  if (minUnitSelect) minUnitSelect.value = merged.fileSizeMinUnit;
  if (maxUnitSelect) maxUnitSelect.value = merged.fileSizeMaxUnit;

  syncQuickSearchFileSizeControls(
    merged.fileSizeMinBytes,
    merged.fileSizeMaxBytes,
  );
}

export function loadQuickSearchPreferences() {
  return new Promise((resolve) => {
    getPreferences(
      {
        quickSearchRememberSelection: true,
        quickSearchState: getDefaultQuickSearchState(),
      },
      (items) => {
        resolve({
          rememberSelection: items.quickSearchRememberSelection !== false,
          state: {
            ...getDefaultQuickSearchState(),
            ...(items.quickSearchState || {}),
          },
        });
      },
    );
  });
}

export function loadQuickSearchState() {
  return loadQuickSearchPreferences().then((prefs) => prefs.state);
}

export function saveQuickSearchState(state) {
  return new Promise((resolve) => {
    savePreferences({ quickSearchState: state }, resolve);
  });
}

export function clearQuickSearchState() {
  return saveQuickSearchState(getDefaultQuickSearchState());
}

export function closeQuickFilterPopup(immediate = false) {
  const popup = document.querySelector(".quick-filter-popup");
  const overlay = document.querySelector(".quick-filter-overlay");
  if (!popup && !overlay) return;
  document.body.style.overflow = "";
  if (immediate) {
    popup?.remove();
    overlay?.remove();
    return;
  }
  popup?.classList.add("hiding");
  overlay?.classList.add("hiding");
  popup?.addEventListener("animationend", () => popup.remove(), { once: true });
  overlay?.addEventListener("animationend", () => overlay.remove(), {
    once: true,
  });
}

// Function to show Quick Filter popup
export function showQuickFilterPopup(options = {}) {
  closeQuickFilterPopup(true);
  const popup = document.createElement("div");
  popup.className = "quick-filter-popup";

  popup.innerHTML = `
    <h3 class="qf-title">Quick Search</h3>

    <div class="qf-body">
      <div class="qf-grid qf-grid--2 qf-grid--anime-row">
        <div class="qf-field qf-field--anime-name">
          <label class="qf-label" for="anime-name">Anime Name</label>
          <div class="qf-anime-search">
            <input type="text" id="anime-name" class="qf-input" placeholder="Search by title…" autocomplete="off">
            <div class="qf-anime-suggestions" id="anime-name-suggestions" hidden></div>
          </div>
        </div>
        <div class="qf-field">
          <label class="qf-label" for="encoder-name">Encoder</label>
          <input type="text" id="encoder-name" class="qf-input" placeholder="e.g. SubsPlease">
        </div>
        <p class="qf-anime-hint" id="anime-name-hint" hidden></p>
        <div class="qf-anime-aliases" id="anime-name-aliases" hidden>
          <div class="qf-anime-aliases-header">
            <div class="qf-anime-aliases-heading">
              <span class="qf-anime-aliases-title">Select aliases for search</span>
              <span class="qf-anime-aliases-meta" id="anime-aliases-meta"></span>
            </div>
            <div class="qf-anime-aliases-actions">
              <button type="button" id="anime-aliases-clear" class="qf-btn qf-btn--outline qf-btn--compact" title="Uncheck all aliases" disabled>Clear selected</button>
              <button type="button" id="anime-aliases-invert" class="qf-btn qf-btn--outline qf-btn--compact" title="Toggle all aliases" disabled>Invert selection</button>
              <button type="button" id="anime-aliases-apply" class="qf-btn qf-btn--secondary qf-btn--compact" title="Fill the search field with selected aliases" disabled>Apply selected</button>
            </div>
          </div>
          <div class="qf-anime-aliases-list" id="anime-aliases-list"></div>
          <div class="qf-anime-aliases-preview" id="anime-aliases-preview"></div>
        </div>
      </div>

      <div class="qf-grid qf-grid--3">
        <div class="qf-field">
          <label class="qf-label" for="quality">Quality</label>
          <select id="quality" class="qf-select">
            <option value="">Any quality</option>
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="2160p">2160p (4K)</option>
          </select>
        </div>
        <div class="qf-field">
          <label class="qf-label" for="format">Format</label>
          <select id="format" class="qf-select">
            <option value="">Any format</option>
            <option value="264">H264/AVC</option>
            <option value="x265">x265/HEVC</option>
            <option value="AV1">AV1</option>
            <option value="VP9">VP9</option>
          </select>
        </div>
        <div class="qf-field">
          <label class="qf-label" for="source">Source</label>
          <select id="source" class="qf-select">
            <option value="">Any source</option>
            <option value="BD">BD (Blu-ray)</option>
            <option value="Web">Web (Streaming Service)</option>
            <option value="DVD">DVD</option>
          </select>
        </div>
      </div>

      <div class="qf-field">
        <label class="qf-label" for="category">Category</label>
        <select id="category" class="qf-select">
          <option value="0">All categories</option>
          <option value="1">Anime Music Video</option>
          <option value="2">English-translated</option>
          <option value="3">Non-English-translated</option>
          <option value="4">Raw</option>
        </select>
      </div>

      <div class="qf-options">
        <label class="qf-checkbox">
          <input type="checkbox" id="dual-audio">
          <span>Dual Audio</span>
        </label>
        <label class="qf-checkbox">
          <input type="checkbox" id="season-pack">
          <span>Season Pack</span>
        </label>
        <label class="qf-checkbox">
          <input type="checkbox" id="last-30-days">
          <span>Last 30 Days</span>
        </label>
        <label class="qf-checkbox">
          <input type="checkbox" id="qs-file-size-enabled">
          <span>File Size</span>
        </label>
      </div>

      <div class="qf-size-filter" id="qs-file-size-section" hidden>
        <div class="qf-size-inputs">
          <div class="qf-size-field">
            <label for="qs-file-size-min-input">Minimum</label>
            <div class="qf-size-value-row">
              <input type="number" id="qs-file-size-min-input" min="0" step="any">
              <select id="qs-file-size-min-unit">
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB" selected>MiB</option>
                <option value="GiB">GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
          <div class="qf-size-field">
            <label for="qs-file-size-max-input">Maximum</label>
            <div class="qf-size-value-row">
              <input type="number" id="qs-file-size-max-input" min="0" step="any">
              <select id="qs-file-size-max-unit">
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB">MiB</option>
                <option value="GiB" selected>GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
        </div>
        <div class="qf-size-slider">
          <div class="qf-size-track">
            <div class="qf-size-fill" id="qs-file-size-fill"></div>
          </div>
          <input type="range" id="qs-file-size-min-slider" min="0" max="51200" step="1">
          <input type="range" id="qs-file-size-max-slider" min="0" max="51200" step="1">
        </div>
        <div class="qf-size-summary" id="qs-file-size-summary">Any size</div>
      </div>
    </div>

    <div class="qf-footer">
      <button id="reset-filter" type="button" class="qf-btn qf-btn--outline qf-btn--compact">Reset filters</button>
      <label class="qf-checkbox qf-remember-selection" for="qs-remember-selection">
        <input type="checkbox" id="qs-remember-selection" checked>
        <span>Remember selection</span>
      </label>
      <div class="qf-footer-spacer" aria-hidden="true"></div>
      <button id="cancel-filter" type="button" class="qf-btn qf-btn--secondary">Cancel</button>
      <button id="apply-filter" type="button" class="qf-btn qf-btn--primary">Search</button>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.className = "quick-filter-overlay";

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  document.body.style.overflow = "hidden";

  initQuickSearchFileSizeControls();

  let resetAnimeAutocomplete = initQuickSearchAnimeAutocomplete(popup);

  const rememberSelectionCheckbox = document.getElementById(
    "qs-remember-selection",
  );

  loadQuickSearchPreferences().then(({ rememberSelection, state }) => {
    rememberSelectionCheckbox.checked = rememberSelection;
    const formState = rememberSelection
      ? { ...state }
      : getDefaultQuickSearchState();
    const animeName = String(options.animeName || "").trim();
    if (animeName) formState.animeName = animeName;
    applyQuickSearchFormState(formState);
    if (animeName) {
      const input = document.getElementById("anime-name");
      input?.focus();
      input?.select();
    }
  });

  rememberSelectionCheckbox.addEventListener("change", () => {
    savePreferences({
      quickSearchRememberSelection: rememberSelectionCheckbox.checked,
    });
  });

  const textInputs = [
    document.getElementById("anime-name"),
    document.getElementById("encoder-name"),
  ];

  textInputs.forEach((input) => {
    input.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("apply-filter").click();
      }
    });
  });

  const resetQuickSearchFileSizeControls = () => {
    document.getElementById("qs-file-size-enabled").checked = false;
    document.getElementById("qs-file-size-section").hidden = true;
    syncQuickSearchFileSizeControls(0, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES);
  };

  const hasActiveQuickSearchFilters = () => {
    const sizeBounds = readQuickSearchFileSizeBounds();
    const fileSizeEnabled = document.getElementById("qs-file-size-enabled")
      .checked;
    const fileSizeActive = isQuickSearchFileSizeFilterActive(
      fileSizeEnabled,
      sizeBounds.min,
      sizeBounds.max,
    );

    return (
      document.getElementById("anime-name").value.trim() ||
      document.getElementById("encoder-name").value.trim() ||
      document.getElementById("quality").value ||
      document.getElementById("format").value ||
      document.getElementById("source").value ||
      document.getElementById("category").value !== "0" ||
      document.getElementById("dual-audio").checked ||
      document.getElementById("season-pack").checked ||
      document.getElementById("last-30-days").checked ||
      fileSizeActive
    );
  };

  document.getElementById("reset-filter").addEventListener("click", async () => {
    if (hasActiveQuickSearchFilters()) {
      document.getElementById("anime-name").value = "";
      if (resetAnimeAutocomplete) resetAnimeAutocomplete();
      document.getElementById("encoder-name").value = "";
      document.getElementById("quality").value = "";
      document.getElementById("format").value = "";
      document.getElementById("source").value = "";
      document.getElementById("category").value = "0";
      document.getElementById("dual-audio").checked = false;
      document.getElementById("season-pack").checked = false;
      document.getElementById("last-30-days").checked = false;
      resetQuickSearchFileSizeControls();
      if (rememberSelectionCheckbox.checked) {
        await clearQuickSearchState();
      }
      showNotification("All filters have been reset", true);
    } else {
      showNotification("No active filters to reset", false);
    }
  });

  document.getElementById("apply-filter").addEventListener("click", async () => {
    const searchParams = [];
    const category = document.getElementById("category").value;

    const animeName = document.getElementById("anime-name").value.trim();
    const encoder = document.getElementById("encoder-name").value.trim();
    const quality = document.getElementById("quality").value;
    const format = document.getElementById("format").value;
    const source = document.getElementById("source").value;
    const dualAudio = document.getElementById("dual-audio").checked;
    const seasonPack = document.getElementById("season-pack").checked;
    const last30Days = document.getElementById("last-30-days").checked;
    const fileSizeEnabled = document.getElementById("qs-file-size-enabled")
      .checked;
    const sizeBounds = readQuickSearchFileSizeBounds();
    const fileSizeActive = isQuickSearchFileSizeFilterActive(
      fileSizeEnabled,
      sizeBounds.min,
      sizeBounds.max,
    );

    if (animeName) searchParams.push(animeName);
    if (encoder) searchParams.push(encoder);
    if (quality) searchParams.push(quality);
    if (format) searchParams.push(format);
    if (source) searchParams.push(source);
    if (dualAudio) searchParams.push("Dual");
    if (seasonPack) searchParams.push("Season");

    const hasSearchFilters =
      animeName ||
      encoder ||
      quality ||
      format ||
      source ||
      dualAudio ||
      seasonPack ||
      category !== "0";

    const hasClientFilters = last30Days || fileSizeActive;
    const hasAnyFilters = hasSearchFilters || hasClientFilters;

    if (!hasAnyFilters) {
      showNotification(
        "No filter options selected. Please select at least one option to search.",
        false,
      );
      return;
    }

    if (rememberSelectionCheckbox.checked) {
      await saveQuickSearchState(readQuickSearchFormState());
    }

    if (!hasSearchFilters && hasClientFilters) {
      closePopup();
      applyQuickSearchClientFilters({
        last30Days,
        sizeEnabled: fileSizeActive,
        sizeMin: sizeBounds.min,
        sizeMax: sizeBounds.max,
      });
      return;
    }

    const searchQuery = searchParams.join(" ");
    const categoryParam = category === "0" ? "0_0" : `1_${category}`;
    let targetUrl = `${
      window.location.origin
    }/?f=0&c=${categoryParam}&q=${encodeURIComponent(searchQuery)}`;

    if (last30Days) {
      targetUrl += "&dateFilter=30days";
    }
    if (fileSizeActive) {
      targetUrl += `&sizeMin=${sizeBounds.min}&sizeMax=${sizeBounds.max}`;
    }

    window.location.href = targetUrl;
  });

  const closePopup = () => {
    popup.classList.add("hiding");
    overlay.classList.add("hiding");
    document.body.style.overflow = "";

    popup.addEventListener(
      "animationend",
      () => {
        popup.remove();
      },
      { once: true },
    );

    overlay.addEventListener(
      "animationend",
      () => {
        overlay.remove();
      },
      { once: true },
    );
  };

  document
    .getElementById("cancel-filter")
    .addEventListener("click", closePopup);
  overlay.addEventListener("click", closePopup);
}

export function checkAndApplyQuickSearchFilters() {
  const options = getQuickSearchClientFilterOptions();
  if (!options) return;

  setTimeout(() => {
    applyQuickSearchClientFilters(options);
  }, 500);
}
