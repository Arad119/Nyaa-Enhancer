import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { failsCompletedDownloadsFilter, getCompletedDownloadsFromRow, getQuickSearchClientFilterOptions, getTitleFromRow, getTorrentIdFromRow, getTorrentInfoHashFromRow, handleSettingChange, isNyaaTorrentDataRow, isNyaaTorrentListPage, shouldHideRowByQuickSearch, showNotification, syncSelectionToVisibleRows, updateTorrentRowLinkActions } from "../../internal.js";
import {
  HISTORY_ACTION_IDS,
  HISTORY_ACTION_META,
  getHistoryHashIndex,
  normalizeHistoryHideActions,
} from "../history/store.js";
import {
  FILTER_PRESETS_MAX,
  addFilterPreset,
  findMatchingFilterPreset,
  loadFilterPresets,
  moveFilterPreset,
  neNormalizeFilterPresetName,
  normalizeFilterPresets,
  removeFilterPreset,
  renameFilterPreset,
  snapshotFilterState,
  updateFilterPresetFromCurrent,
} from "./presets.js";

// Function to hide dead torrents
export async function filterDeadTorrents(isInitialLoad = false) {
  await applyAllTorrentFilters({ notify: isInitialLoad });
}

// Add new function for keyword filtering
export async function filterByKeywords(isInitialLoad = false) {
  await applyAllTorrentFilters({ notify: isInitialLoad });
}

// Function to convert size string to bytes
export function convertToBytes(sizeStr) {
  const [value, unit] = sizeStr.trim().split(" ");
  const numValue = parseFloat(value);

  switch (unit) {
    case "B":
    case "Bytes":
      return numValue;
    case "KiB":
      return numValue * 1024;
    case "MiB":
      return numValue * 1024 * 1024;
    case "GiB":
      return numValue * 1024 * 1024 * 1024;
    case "TiB":
      return numValue * 1024 * 1024 * 1024 * 1024;
    default:
      return 0;
  }
}

// Function to check if size is within selected range
export const FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES = 51200 * 1024 * 1024;
export const FILE_SIZE_FILTER_DEFAULT_MIN_BYTES = 500 * 1024 * 1024;
export const FILE_SIZE_FILTER_DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024;

export const LEGACY_FILE_SIZE_RANGE_MAP = {
  less_than_256mb: { min: 0, max: 256 * 1024 * 1024 },
  less_than_512mb: { min: 0, max: 512 * 1024 * 1024 },
  less_than_768mb: { min: 0, max: 768 * 1024 * 1024 },
  less_than_1gb: { min: 0, max: 1024 * 1024 * 1024 },
  greater_than_1gb: {
    min: 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
  greater_than_5gb: {
    min: 5 * 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
  greater_than_10gb: {
    min: 10 * 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
  greater_than_20gb: {
    min: 20 * 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
};

export function getFileSizeFilterBounds(prefs) {
  if (
    typeof prefs.fileSizeMinBytes === "number" &&
    typeof prefs.fileSizeMaxBytes === "number"
  ) {
    return {
      min: prefs.fileSizeMinBytes,
      max: prefs.fileSizeMaxBytes,
    };
  }

  const legacy = LEGACY_FILE_SIZE_RANGE_MAP[prefs.fileSizeRange];
  if (legacy) return legacy;

  return {
    min: FILE_SIZE_FILTER_DEFAULT_MIN_BYTES,
    max: FILE_SIZE_FILTER_DEFAULT_MAX_BYTES,
  };
}

export function isInFileSizeFilterRange(sizeInBytes, prefs) {
  const { min, max } = getFileSizeFilterBounds(prefs);
  return sizeInBytes >= min && sizeInBytes <= max;
}

export function getMinSeedersThreshold(prefs) {
  const value = Number(prefs.minSeedersFilterValue);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.floor(value));
}

export function failsMinSeedersFilter(prefs, seeders) {
  if (!prefs.minSeedersFilterEnabled) return false;
  const minSeeders = getMinSeedersThreshold(prefs);
  if (minSeeders <= 0) return false;
  return seeders < minSeeders;
}

export const UPLOAD_DATE_FILTER_DEFAULT_RANGE = "month";
export const UPLOAD_DATE_FILTER_OPTIONS = [
  { id: "day", label: "Day", desc: "Last 24 hours", seconds: 24 * 60 * 60 },
  { id: "week", label: "Week", desc: "Last 7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "month", label: "Month", desc: "Last 30 days", seconds: 30 * 24 * 60 * 60 },
  { id: "3months", label: "3 Months", desc: "Last 90 days", seconds: 90 * 24 * 60 * 60 },
  { id: "6months", label: "6 Months", desc: "Last 180 days", seconds: 180 * 24 * 60 * 60 },
  { id: "year", label: "Year", desc: "Last 365 days", seconds: 365 * 24 * 60 * 60 },
];
export const UPLOAD_DATE_FILTER_RANGE_IDS = new Set(
  UPLOAD_DATE_FILTER_OPTIONS.map((option) => option.id),
);

export function neNormalizeUploadDateRange(value) {
  if (value === "custom") return "custom";
  return UPLOAD_DATE_FILTER_RANGE_IDS.has(value)
    ? value
    : UPLOAD_DATE_FILTER_DEFAULT_RANGE;
}

export function localDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map((part) => parseInt(part, 10));
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
}

export function endOfLocalDay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map((part) => parseInt(part, 10));
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d, 23, 59, 59, 999).getTime() / 1000);
}

export function getUploadDateFilterMaxAgeSeconds(prefs) {
  const rangeId = neNormalizeUploadDateRange(prefs.uploadDateFilterRange);
  if (rangeId === "custom") return 0;
  return UPLOAD_DATE_FILTER_OPTIONS.find((item) => item.id === rangeId).seconds;
}

export function getUploadTimestampFromRow(row) {
  const dateCell = row.querySelector("td[data-timestamp]");
  if (!dateCell) return null;
  const timestamp = parseInt(dateCell.getAttribute("data-timestamp"), 10);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function failsUploadDateFilter(prefs, timestampSeconds, nowSeconds = Date.now() / 1000) {
  if (!prefs.uploadDateFilterEnabled) return false;
  if (timestampSeconds == null) return false;
  const rangeId = neNormalizeUploadDateRange(prefs.uploadDateFilterRange);
  if (rangeId === "custom") {
    let from = prefs.uploadDateFilterFrom;
    let to = prefs.uploadDateFilterTo;
    if (from && to && from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    const start = startOfLocalDay(from);
    const end = endOfLocalDay(to);
    if (start != null && timestampSeconds < start) return true;
    if (end != null && timestampSeconds > end) return true;
    return false;
  }
  return timestampSeconds < nowSeconds - getUploadDateFilterMaxAgeSeconds(prefs);
}

export const KEYWORD_FILTER_KINDS = ["block", "require"];

export function neKeywordPrefKey(kind) {
  return kind === "require" ? "requireKeywords" : "blockKeywords";
}

export function neKeywordEnabledPrefKey(kind) {
  return kind === "require"
    ? "requireKeywordsFilterEnabled"
    : "blockKeywordsFilterEnabled";
}

export function neKeywordList(prefs, kind) {
  const list = prefs[neKeywordPrefKey(kind)];
  return Array.isArray(list) ? list : [];
}

export function titleMatchesAnyKeyword(title, keywords) {
  if (!keywords?.length) return false;
  const hay = (title || "").toLowerCase();
  return keywords.some((keyword) =>
    hay.includes(String(keyword).toLowerCase()),
  );
}

export function failsKeywordFilter(prefs, title) {
  if (
    prefs.blockKeywordsFilterEnabled &&
    titleMatchesAnyKeyword(title, neKeywordList(prefs, "block"))
  ) {
    return true;
  }
  if (prefs.requireKeywordsFilterEnabled) {
    const required = neKeywordList(prefs, "require");
    if (required.length && !titleMatchesAnyKeyword(title, required)) {
      return true;
    }
  }
  return false;
}

export function failsHistoryHideFilter(prefs, row, historyIndex) {
  if (!prefs.historyHideFilterEnabled || !historyIndex) return false;
  const actions = normalizeHistoryHideActions(prefs.historyHideActions);
  if (!actions.length) return false;

  const hash = getTorrentInfoHashFromRow(row);
  const id = parseInt(getTorrentIdFromRow(row), 10);

  return actions.some((action) => {
    if (hash && historyIndex.hashes?.[action]?.has(hash)) return true;
    if (Number.isFinite(id) && historyIndex.ids?.[action]?.has(id)) return true;
    return false;
  });
}

export function getActiveFilterLabels(prefs) {
  const labels = [];
  if (prefs.hideDeadTorrents) labels.push("dead torrents");
  if (prefs.minSeedersFilterEnabled && getMinSeedersThreshold(prefs) > 0) {
    labels.push("minimum seeders");
  }
  if (
    prefs.blockKeywordsFilterEnabled &&
    neKeywordList(prefs, "block").length > 0
  ) {
    labels.push("blocked keywords");
  }
  if (
    prefs.requireKeywordsFilterEnabled &&
    neKeywordList(prefs, "require").length > 0
  ) {
    labels.push("required keywords");
  }
  if (prefs.fileSizeFilterEnabled) labels.push("file size");
  if (prefs.completedDownloadsFilterEnabled) labels.push("completed downloads");
  if (prefs.uploadDateFilterEnabled) labels.push("upload date");
  if (prefs.historyHideFilterEnabled) labels.push("history");
  return labels;
}

export function formatFilterHiddenNotificationMessage(hiddenCount, activeFilterLabels) {
  const torrentWord = hiddenCount === 1 ? "torrent" : "torrents";
  if (activeFilterLabels.length === 1) {
    return `Hid ${hiddenCount} ${torrentWord} matching your ${activeFilterLabels[0]} filter`;
  }
  if (activeFilterLabels.length > 1) {
    return `Hid ${hiddenCount} ${torrentWord} matching your filters (${activeFilterLabels.join(", ")})`;
  }
  return `Hid ${hiddenCount} ${torrentWord} matching your active filters`;
}

export function shouldHideRowByFilters(row, prefs, historyIndex = null) {
  const title = getTitleFromRow(row);
  const sizeCell = row.querySelector("td:nth-of-type(4)");
  const seedersCell = row.querySelector("td:nth-of-type(6)");
  const leechersCell = row.querySelector("td:nth-of-type(7)");

  const seeders = seedersCell ? parseInt(seedersCell.textContent, 10) || 0 : 0;
  const leechers = leechersCell ? parseInt(leechersCell.textContent, 10) || 0 : 0;
  const sizeInBytes = sizeCell ? convertToBytes(sizeCell.textContent) : 0;

  if (prefs.hideDeadTorrents && seeders === 0 && leechers === 0) {
    return true;
  }

  if (failsMinSeedersFilter(prefs, seeders)) {
    return true;
  }

  if (failsKeywordFilter(prefs, title)) {
    return true;
  }

  if (
    prefs.fileSizeFilterEnabled &&
    !isInFileSizeFilterRange(sizeInBytes, prefs)
  ) {
    return true;
  }

  if (
    isNyaaTorrentListPage() &&
    failsCompletedDownloadsFilter(prefs, getCompletedDownloadsFromRow(row))
  ) {
    return true;
  }

  if (failsUploadDateFilter(prefs, getUploadTimestampFromRow(row))) {
    return true;
  }

  if (failsHistoryHideFilter(prefs, row, historyIndex)) {
    return true;
  }

  return false;
}

export async function applyAllTorrentFilters({ notify = false } = {}) {
  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody) return { newlyHidden: 0, totalHidden: 0 };

  const prefs = await loadStoredPreferences();
  const qsOptions = getQuickSearchClientFilterOptions();
  const historyIndex = prefs.historyHideFilterEnabled
    ? await getHistoryHashIndex()
    : null;
  const rows = tableBody.querySelectorAll("tr");
  let newlyHidden = 0;
  let totalHidden = 0;
  const newlyVisibleForAt = [];

  rows.forEach((row) => {
    if (!isNyaaTorrentDataRow(row)) return;

    const wasVisible = row.style.display !== "none";
    const shouldHide =
      shouldHideRowByFilters(row, prefs, historyIndex) ||
      shouldHideRowByQuickSearch(row, qsOptions);

    row.style.display = shouldHide ? "none" : "";

    if (shouldHide) {
      totalHidden++;
      if (wasVisible) newlyHidden++;
    } else if (
      !wasVisible &&
      row.querySelector(".link-action-at-placeholder")
    ) {
      newlyVisibleForAt.push(row);
    }
  });

  newlyVisibleForAt.forEach((row) => {
    updateTorrentRowLinkActions(row, prefs);
  });

  if (notify && prefs.showFilterNotifications && newlyHidden > 0) {
    showNotification(
      formatFilterHiddenNotificationMessage(
        newlyHidden,
        getActiveFilterLabels(prefs),
      ),
      true,
    );
  }

  syncSelectionToVisibleRows();
  return { newlyHidden, totalHidden };
}

export async function filterByCompletedDownloads() {
  await applyAllTorrentFilters({ notify: true });
}

export async function filterByFileSize() {
  await applyAllTorrentFilters({ notify: true });
}

export async function filterByUploadDate() {
  await applyAllTorrentFilters({ notify: true });
}

export function hasTorrentListTable() {
  return !!document.querySelector("table.torrent-list");
}

export const NE_FILTER_FILE_SIZE_SLIDER_MAX_MB = 51200;
export const NE_FILTER_FILE_SIZE_ABSOLUTE_MAX_BYTES =
  NE_FILTER_FILE_SIZE_SLIDER_MAX_MB * 1024 * 1024;
export const NE_FILTER_FILE_SIZE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];
export const NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
  TiB: 1024 * 1024 * 1024 * 1024,
};

export let neFilterFileSizeInputDebounceTimer = null;

export function neFormatFileSizeDisplayValue(value, unit) {
  if (unit === "B") return String(Math.round(value));
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 100) / 100);
}

export function neBytesToDisplayValue(bytes, preferredUnit) {
  if (
    preferredUnit &&
    NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit] !== undefined
  ) {
    const value = bytes / NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit];
    return {
      value: neFormatFileSizeDisplayValue(value, preferredUnit),
      unit: preferredUnit,
    };
  }

  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < NE_FILTER_FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const unit = NE_FILTER_FILE_SIZE_UNITS[unitIndex];
  return {
    value: neFormatFileSizeDisplayValue(value, unit),
    unit,
  };
}

export function neDisplayValueToBytes(value, unit) {
  const num = parseFloat(value);
  const multiplier = NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS[unit];
  if (!Number.isFinite(num) || num < 0 || multiplier === undefined) return 0;
  return Math.round(num * multiplier);
}

export function neClampFileSizeBounds(minBytes, maxBytes) {
  let min = Math.max(
    0,
    Math.min(minBytes, NE_FILTER_FILE_SIZE_ABSOLUTE_MAX_BYTES),
  );
  let max = Math.max(
    0,
    Math.min(maxBytes, NE_FILTER_FILE_SIZE_ABSOLUTE_MAX_BYTES),
  );
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

export function neBytesToSliderMb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

export function neSliderMbToBytes(mb) {
  return mb * 1024 * 1024;
}

export function neFormatFileSizeRangeSummary(minBytes, maxBytes) {
  const minDisp = neBytesToDisplayValue(minBytes);
  const maxDisp = neBytesToDisplayValue(maxBytes);
  return `${minDisp.value} ${minDisp.unit} – ${maxDisp.value} ${maxDisp.unit}`;
}

export function neUpdateFileSizeRangeFill() {
  const minSlider = document.getElementById("ne-fileSizeMinSlider");
  const maxSlider = document.getElementById("ne-fileSizeMaxSlider");
  const fill = document.getElementById("ne-fileSizeRangeFill");
  if (!minSlider || !maxSlider || !fill) return;

  const minVal = parseInt(minSlider.value, 10);
  const maxVal = parseInt(maxSlider.value, 10);
  const minPercent = (minVal / NE_FILTER_FILE_SIZE_SLIDER_MAX_MB) * 100;
  const maxPercent = (maxVal / NE_FILTER_FILE_SIZE_SLIDER_MAX_MB) * 100;
  fill.style.left = `${minPercent}%`;
  fill.style.width = `${maxPercent - minPercent}%`;
}

export function neReadFileSizeBoundsFromControls() {
  const minInput = document.getElementById("ne-fileSizeMinInput");
  const maxInput = document.getElementById("ne-fileSizeMaxInput");
  const minUnit = document.getElementById("ne-fileSizeMinUnit").value;
  const maxUnit = document.getElementById("ne-fileSizeMaxUnit").value;
  const minBytes = neDisplayValueToBytes(minInput.value, minUnit);
  const maxBytes = neDisplayValueToBytes(maxInput.value, maxUnit);
  return neClampFileSizeBounds(minBytes, maxBytes);
}

export async function neSyncFileSizeControlsFromBounds(
  minBytes,
  maxBytes,
  { updateStorage = false } = {},
) {
  const bounds = neClampFileSizeBounds(minBytes, maxBytes);
  const minUnitSelect = document.getElementById("ne-fileSizeMinUnit");
  const maxUnitSelect = document.getElementById("ne-fileSizeMaxUnit");
  const minDisp = neBytesToDisplayValue(bounds.min, minUnitSelect.value);
  const maxDisp = neBytesToDisplayValue(bounds.max, maxUnitSelect.value);

  document.getElementById("ne-fileSizeMinInput").value = String(minDisp.value);
  minUnitSelect.value = minDisp.unit;
  document.getElementById("ne-fileSizeMaxInput").value = String(maxDisp.value);
  maxUnitSelect.value = maxDisp.unit;
  document.getElementById("ne-fileSizeMinSlider").value = String(
    neBytesToSliderMb(bounds.min),
  );
  document.getElementById("ne-fileSizeMaxSlider").value = String(
    neBytesToSliderMb(bounds.max),
  );
  document.getElementById("ne-fileSizeRangeSummary").textContent =
    neFormatFileSizeRangeSummary(bounds.min, bounds.max);
  neUpdateFileSizeRangeFill();

  if (updateStorage) {
    try {
      await savePreferences({
        fileSizeMinBytes: bounds.min,
        fileSizeMaxBytes: bounds.max,
      });
    } catch {
      const prefs = await loadStoredPreferences();
      return neSyncFileSizeControlsFromBounds(prefs.fileSizeMinBytes, prefs.fileSizeMaxBytes);
    }
    handleSettingChange("fileSizeMinBytes", bounds.min);
    handleSettingChange("fileSizeMaxBytes", bounds.max);
  }
}

export function neSetFileSizeRangeControlsEnabled(enabled) {
  const container = document.getElementById("ne-fileSizeRangeContainer");
  if (!container) return;
  container.querySelectorAll("input, select").forEach((el) => {
    el.disabled = !enabled;
  });
  container.classList.toggle("disabled", !enabled);
}

export function neSetCompletedDownloadsControlsEnabled(enabled) {
  const container = document.getElementById("ne-completedDownloadsContainer");
  const operatorSelect = document.getElementById(
    "ne-completedDownloadsOperator",
  );
  const valueInput = document.getElementById("ne-completedDownloadsValue");
  if (operatorSelect) operatorSelect.disabled = !enabled;
  if (valueInput) valueInput.disabled = !enabled;
  if (container) container.classList.toggle("disabled", !enabled);
}

export function neSetUploadDateRangeSelection(range) {
  const normalized = neNormalizeUploadDateRange(range);
  document.querySelectorAll("[data-ne-date-range]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.neDateRange === normalized),
    );
  });
  const custom = document.getElementById("ne-uploadDateCustom");
  if (custom) custom.hidden = normalized !== "custom";
}

export function neSyncUploadDateCustomInputs(prefs) {
  const today = localDateInputValue();
  const from = document.getElementById("ne-uploadDateFrom");
  const to = document.getElementById("ne-uploadDateTo");
  if (from) {
    from.max = today;
    from.value = prefs.uploadDateFilterFrom || "";
  }
  if (to) {
    to.max = today;
    to.value = prefs.uploadDateFilterTo || "";
  }
}

export function neSetUploadDateControlsEnabled(enabled) {
  const container = document.getElementById("ne-uploadDateContainer");
  if (!container) return;
  container.querySelectorAll("button[data-ne-date-range], input[type='date']").forEach((el) => {
    el.disabled = !enabled;
  });
  container.classList.toggle("disabled", !enabled);
}

export function neSetKeywordFilterControlsEnabled(kind, enabled) {
  const container = document.getElementById(
    kind === "require"
      ? "ne-requireKeywordsContainer"
      : "ne-blockKeywordsContainer",
  );
  if (!container) return;
  container.querySelectorAll("button, input").forEach((el) => {
    el.disabled = !enabled;
  });
  container.classList.toggle("disabled", !enabled);
}

export function neSetHistoryHideActionSelection(actions) {
  const selected = new Set(normalizeHistoryHideActions(actions));
  document.querySelectorAll("[data-ne-history-hide-action]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(selected.has(button.dataset.neHistoryHideAction)),
    );
  });
}

export function neSetHistoryHideControlsEnabled(enabled) {
  const container = document.getElementById("ne-historyHideContainer");
  if (!container) return;
  container.querySelectorAll("button[data-ne-history-hide-action]").forEach((button) => {
    button.disabled = !enabled;
  });
  container.classList.toggle("disabled", !enabled);
}

export function neNormalizeMinSeedersValue(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 999999);
}

export function neSetMinSeedersControlsEnabled(enabled) {
  const container = document.getElementById("ne-minSeedersContainer");
  const valueInput = document.getElementById("ne-minSeedersValue");
  if (valueInput) valueInput.disabled = !enabled;
  if (container) container.classList.toggle("disabled", !enabled);
}

export function neSetFilterToggleState(toggleId, enabled) {
  const toggle = document.querySelector(
    `.ne-filters-panel [data-ne-toggle="${toggleId}"]`,
  );
  if (toggle) toggle.setAttribute("aria-checked", String(enabled));
}

export function neCountActiveFilters(prefs) {
  let count = 0;
  if (prefs.hideDeadTorrents) count++;
  if (prefs.minSeedersFilterEnabled) count++;
  if (prefs.blockKeywordsFilterEnabled) count++;
  if (prefs.requireKeywordsFilterEnabled) count++;
  if (prefs.fileSizeFilterEnabled) count++;
  if (prefs.completedDownloadsFilterEnabled) count++;
  if (prefs.uploadDateFilterEnabled) count++;
  if (prefs.historyHideFilterEnabled) count++;
  return count;
}

export async function resetAllTorrentFilters() {
  try {
    await savePreferences({
      hideDeadTorrents: false,
      minSeedersFilterEnabled: false,
      blockKeywordsFilterEnabled: false,
      requireKeywordsFilterEnabled: false,
      fileSizeFilterEnabled: false,
      completedDownloadsFilterEnabled: false,
      uploadDateFilterEnabled: false,
      historyHideFilterEnabled: false,
    });
  } catch {
    return false;
  }
  const prefs = await loadStoredPreferences();
  await neSyncFiltersPanelFromPrefs(prefs);
  await applyAllTorrentFilters({ notify: false });
  return true;
}

export function neUpdateActiveFilterBadge(prefs) {
  const badge = document.querySelector(".ne-filters-panel__badge");
  if (!badge) return;
  const count = neCountActiveFilters(prefs);
  badge.textContent = String(count);
  badge.hidden = count === 0;
  const reset = document.getElementById("ne-reset-filters");
  if (reset) reset.hidden = count === 0;
}

export async function neSaveFilterSetting(key, value) {
  try {
    await savePreferences({ [key]: value });
  } catch {
    await neSyncFiltersPanelFromPrefs(await loadStoredPreferences());
    return false;
  }
  await handleSettingChange(key, value);
  const prefs = await loadStoredPreferences();
  neUpdateActiveFilterBadge(prefs);
  return true;
}

export function neIsFilterPresetsManageMode() {
  return (
    document
      .getElementById("ne-preset-manage")
      ?.getAttribute("aria-pressed") === "true"
  );
}

export function neSetFilterPresetEditorOpen(open, { name = "", presetId = "" } = {}) {
  const editor = document.getElementById("ne-preset-editor");
  const input = document.getElementById("ne-preset-name");
  const confirm = document.getElementById("ne-preset-confirm");
  if (!editor || !input) return;
  editor.hidden = !open;
  editor.dataset.presetId = open ? presetId : "";
  editor.dataset.mode = presetId ? "rename" : "create";
  input.value = name;
  if (confirm) confirm.textContent = presetId ? "Rename" : "Save";
  if (open) {
    input.focus();
    input.select();
  }
}

export function neSyncActiveFilterPreset(prefs, presets) {
  const panel = document.querySelector(".ne-filters-panel");
  if (!panel) return null;

  const match = findMatchingFilterPreset(presets, prefs);
  if (match) panel.dataset.activePresetId = match.id;
  else delete panel.dataset.activePresetId;

  panel.querySelectorAll(".ne-filters-panel__preset").forEach((row) => {
    const isActive = !!match && row.dataset.presetId === match.id;
    row.classList.toggle("is-active", isActive);
    row
      .querySelector(".ne-filters-panel__preset-chip")
      ?.setAttribute("aria-pressed", String(isActive));
  });
  return match;
}

export async function neRenderFilterPresets(presets, prefs) {
  const list = document.getElementById("ne-preset-list");
  if (!list) return;
  const items = presets || (await loadFilterPresets());
  const currentPrefs = prefs || (await loadStoredPreferences());
  const managing = neIsFilterPresetsManageMode();
  const match = findMatchingFilterPreset(items, currentPrefs);
  const activeId = match?.id || "";
  list.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "ne-filters-panel__empty-keywords";
    empty.textContent = managing
      ? "No presets yet. Save the current filters to create one."
      : "No presets yet.";
    list.appendChild(empty);
    return;
  }

  items.forEach((preset, index) => {
    const row = document.createElement("div");
    row.className = "ne-filters-panel__preset";
    row.dataset.presetId = preset.id;
    if (preset.id === activeId) row.classList.add("is-active");

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "ne-filters-panel__preset-chip";
    apply.textContent = preset.name;
    apply.title = `Apply “${preset.name}”`;
    apply.setAttribute("aria-pressed", String(preset.id === activeId));
    apply.addEventListener("click", () => neApplyFilterPreset(preset.id));

    row.appendChild(apply);

    if (managing) {
      const tools = document.createElement("div");
      tools.className = "ne-filters-panel__preset-actions";

      const up = document.createElement("button");
      up.type = "button";
      up.className = "ne-filters-panel__preset-icon";
      up.title = "Move up";
      up.disabled = index === 0;
      up.innerHTML = '<i class="fa fa-angle-up" aria-hidden="true"></i>';
      up.addEventListener("click", async () => {
        const result = await moveFilterPreset(preset.id, -1);
        await neRenderFilterPresets(result.presets);
      });

      const down = document.createElement("button");
      down.type = "button";
      down.className = "ne-filters-panel__preset-icon";
      down.title = "Move down";
      down.disabled = index === items.length - 1;
      down.innerHTML = '<i class="fa fa-angle-down" aria-hidden="true"></i>';
      down.addEventListener("click", async () => {
        const result = await moveFilterPreset(preset.id, 1);
        await neRenderFilterPresets(result.presets);
      });

      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "ne-filters-panel__preset-icon";
      rename.title = "Rename";
      rename.innerHTML = '<i class="fa fa-pencil" aria-hidden="true"></i>';
      rename.addEventListener("click", () => {
        neSetFilterPresetEditorOpen(true, {
          name: preset.name,
          presetId: preset.id,
        });
      });

      const update = document.createElement("button");
      update.type = "button";
      update.className = "ne-filters-panel__preset-icon";
      update.title = "Replace with current filters";
      update.innerHTML = '<i class="fa fa-refresh" aria-hidden="true"></i>';
      update.addEventListener("click", async () => {
        const prefs = await loadStoredPreferences();
        const result = await updateFilterPresetFromCurrent(preset.id, prefs);
        await neRenderFilterPresets(result.presets);
        showNotification(`Updated “${preset.name}”`, true);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ne-filters-panel__preset-icon ne-filters-panel__preset-icon--danger";
      remove.title = "Remove preset";
      remove.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';
      remove.addEventListener("click", async () => {
        const result = await removeFilterPreset(preset.id);
        await neRenderFilterPresets(result.presets);
      });

      tools.append(up, down, rename, update, remove);
      row.appendChild(tools);
    }

    list.appendChild(row);
  });
  neSyncActiveFilterPreset(currentPrefs, items);
}

export async function neApplyFilterPreset(id) {
  const presets = await loadFilterPresets();
  const preset = presets.find((item) => item.id === id);
  if (!preset) return;

  const prefs = await loadStoredPreferences();
  const payload = snapshotFilterState({ ...prefs, ...preset.filters });
  try {
    await savePreferences(payload);
  } catch {
    return;
  }
  const next = await loadStoredPreferences();
  await neSyncFiltersPanelFromPrefs(next);
  await applyAllTorrentFilters({ notify: true });
  showNotification(`Applied “${preset.name}”`, true);
}

export async function neConfirmFilterPresetEditor() {
  const editor = document.getElementById("ne-preset-editor");
  const input = document.getElementById("ne-preset-name");
  const name = neNormalizeFilterPresetName(input?.value);
  if (!name) {
    showNotification("Enter a name for this preset.", false);
    input?.focus();
    return;
  }

  if (editor?.dataset.mode === "rename" && editor.dataset.presetId) {
    const result = await renameFilterPreset(editor.dataset.presetId, name);
    if (result.error) {
      showNotification("Enter a name for this preset.", false);
      return;
    }
    neSetFilterPresetEditorOpen(false);
    await neRenderFilterPresets(result.presets);
    return;
  }

  const prefs = await loadStoredPreferences();
  const result = await addFilterPreset(name, prefs);
  if (result.error === "limit") {
    showNotification(`You can save up to ${FILTER_PRESETS_MAX} presets.`, false);
    return;
  }
  if (result.error) {
    showNotification("Enter a name for this preset.", false);
    return;
  }
  neSetFilterPresetEditorOpen(false);
  await neRenderFilterPresets(result.presets, prefs);
  showNotification(`Saved “${name}”`, true);
}

export function neWireKeywordList(kind) {
  const addId =
    kind === "require" ? "ne-add-require-keyword" : "ne-add-block-keyword";
  const inputId =
    kind === "require" ? "ne-require-keyword-input" : "ne-block-keyword-input";
  const removeAllId =
    kind === "require"
      ? "ne-remove-all-require-keywords"
      : "ne-remove-all-block-keywords";
  document
    .getElementById(addId)
    ?.addEventListener("click", () => neAddFilterKeyword(kind));
  document.getElementById(inputId)?.addEventListener("keypress", (event) => {
    if (event.key === "Enter") neAddFilterKeyword(kind);
  });
  document
    .getElementById(removeAllId)
    ?.addEventListener("click", () => neRemoveAllFilterKeywords(kind));
}

export function neWireFilterPresets() {
  document.getElementById("ne-preset-save")?.addEventListener("click", () => {
    neSetFilterPresetEditorOpen(true);
  });
  document.getElementById("ne-preset-manage")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const next = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(next));
    button.textContent = next ? "Done" : "Manage";
    if (!next) neSetFilterPresetEditorOpen(false);
    await neRenderFilterPresets();
  });
  document
    .getElementById("ne-preset-confirm")
    ?.addEventListener("click", () => neConfirmFilterPresetEditor());
  document.getElementById("ne-preset-cancel")?.addEventListener("click", () => {
    neSetFilterPresetEditorOpen(false);
  });
  document.getElementById("ne-preset-name")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      neConfirmFilterPresetEditor();
    }
    if (event.key === "Escape") {
      neSetFilterPresetEditorOpen(false);
    }
  });
}

export function neDisplayFilterKeywords(kind, keywords) {
  const listId =
    kind === "require" ? "ne-require-keywords-list" : "ne-block-keywords-list";
  const containerId =
    kind === "require"
      ? "ne-requireKeywordsContainer"
      : "ne-blockKeywordsContainer";
  const keywordsList = document.getElementById(listId);
  if (!keywordsList) return;
  keywordsList.innerHTML = "";

  if (!keywords.length) {
    const empty = document.createElement("p");
    empty.className = "ne-filters-panel__empty-keywords";
    empty.textContent = "No keywords added yet.";
    keywordsList.appendChild(empty);
    const container = document.getElementById(containerId);
    if (container?.classList.contains("disabled")) {
      container.querySelectorAll("button, input").forEach((el) => {
        el.disabled = true;
      });
    }
    return;
  }

  keywords.forEach((keyword) => {
    const item = document.createElement("div");
    item.className = "ne-filters-panel__keyword-item";
    item.innerHTML = `
      <span class="ne-filters-panel__keyword-text"></span>
      <button type="button" class="ne-filters-panel__keyword-remove" title="Remove keyword">×</button>
    `;
    item.querySelector(".ne-filters-panel__keyword-text").textContent = keyword;
    item
      .querySelector(".ne-filters-panel__keyword-remove")
      .addEventListener("click", () => neRemoveFilterKeyword(kind, keyword));
    keywordsList.appendChild(item);
  });

  const container = document.getElementById(containerId);
  if (container?.classList.contains("disabled")) {
    container.querySelectorAll("button, input").forEach((el) => {
      el.disabled = true;
    });
  }
}

export async function neAddFilterKeyword(kind) {
  const inputId =
    kind === "require" ? "ne-require-keyword-input" : "ne-block-keyword-input";
  const input = document.getElementById(inputId);
  const keyword = input?.value.trim();
  if (!keyword) return;

  const prefs = await loadStoredPreferences();
  const prefKey = neKeywordPrefKey(kind);
  const current = neKeywordList(prefs, kind);
  if (current.includes(keyword)) {
    input.value = "";
    return;
  }

  const keywords = [...current, keyword];
  try {
    await savePreferences({ [prefKey]: keywords });
  } catch {
    return;
  }
  input.value = "";
  neDisplayFilterKeywords(kind, keywords);
  await applyAllTorrentFilters({ notify: true });
}

export async function neRemoveFilterKeyword(kind, keywordToRemove) {
  const prefs = await loadStoredPreferences();
  const prefKey = neKeywordPrefKey(kind);
  const keywords = neKeywordList(prefs, kind).filter(
    (item) => item !== keywordToRemove,
  );
  try {
    await savePreferences({ [prefKey]: keywords });
  } catch {
    return;
  }
  neDisplayFilterKeywords(kind, keywords);
  await applyAllTorrentFilters({ notify: true });
}

export async function neRemoveAllFilterKeywords(kind) {
  try {
    await savePreferences({ [neKeywordPrefKey(kind)]: [] });
  } catch {
    return;
  }
  neDisplayFilterKeywords(kind, []);
  await applyAllTorrentFilters({ notify: true });
}

export function neInitFileSizeRangeControls(prefs) {
  const bounds = getFileSizeFilterBounds(prefs);
  if (
    typeof prefs.fileSizeMinBytes !== "number" ||
    typeof prefs.fileSizeMaxBytes !== "number"
  ) {
    savePreferences({
      fileSizeMinBytes: bounds.min,
      fileSizeMaxBytes: bounds.max,
    });
  }
  neSyncFileSizeControlsFromBounds(bounds.min, bounds.max);
  neSetFileSizeRangeControlsEnabled(prefs.fileSizeFilterEnabled);
}

export async function nePersistFileSizeBoundsFromControls() {
  const bounds = neReadFileSizeBoundsFromControls();
  await neSyncFileSizeControlsFromBounds(bounds.min, bounds.max, {
    updateStorage: true,
  });
}

export function neScheduleFileSizePersistFromControls() {
  clearTimeout(neFilterFileSizeInputDebounceTimer);
  neFilterFileSizeInputDebounceTimer = setTimeout(() => {
    nePersistFileSizeBoundsFromControls();
  }, 250);
}

export function neHandleFileSizeSliderInput(isMinSlider) {
  const minSlider = document.getElementById("ne-fileSizeMinSlider");
  const maxSlider = document.getElementById("ne-fileSizeMaxSlider");
  let minMb = parseInt(minSlider.value, 10);
  let maxMb = parseInt(maxSlider.value, 10);

  if (isMinSlider && minMb > maxMb) {
    minMb = maxMb;
    minSlider.value = String(minMb);
  } else if (!isMinSlider && maxMb < minMb) {
    maxMb = minMb;
    maxSlider.value = String(maxMb);
  }

  neSyncFileSizeControlsFromBounds(
    neSliderMbToBytes(minMb),
    neSliderMbToBytes(maxMb),
  );
}

export async function neHandleFileSizeSliderCommit(isMinSlider) {
  const minSlider = document.getElementById("ne-fileSizeMinSlider");
  const maxSlider = document.getElementById("ne-fileSizeMaxSlider");
  let minMb = parseInt(minSlider.value, 10);
  let maxMb = parseInt(maxSlider.value, 10);

  if (isMinSlider && minMb > maxMb) {
    minMb = maxMb;
    minSlider.value = String(minMb);
  } else if (!isMinSlider && maxMb < minMb) {
    maxMb = minMb;
    maxSlider.value = String(maxMb);
  }

  await neSyncFileSizeControlsFromBounds(
    neSliderMbToBytes(minMb),
    neSliderMbToBytes(maxMb),
    { updateStorage: true },
  );
}

export function neWireFilterToggle(toggleId, settingKey, onChange) {
  const toggle = document.querySelector(
    `.ne-filters-panel [data-ne-toggle="${toggleId}"]`,
  );
  if (!toggle) return;

  toggle.addEventListener("click", async () => {
    if (toggle.disabled) return;
    const newState = toggle.getAttribute("aria-checked") !== "true";
    toggle.disabled = true;
    const saved = await neSaveFilterSetting(settingKey, newState);
    toggle.disabled = false;
    if (!saved) return;
    toggle.setAttribute("aria-checked", String(newState));
    if (onChange) onChange(newState);
  });
}

export function neSetFiltersPanelExpanded(expanded) {
  const panel = document.querySelector(".ne-filters-panel");
  const body = document.querySelector(".ne-filters-panel__body");
  const header = document.querySelector(".ne-filters-panel__header");
  if (!panel || !body || !header) return;

  panel.classList.toggle("ne-filters-panel--expanded", expanded);
  header.setAttribute("aria-expanded", String(expanded));
  body.hidden = !expanded;
}

export async function neSyncFiltersPanelFromPrefs(prefs) {
  neSetFilterToggleState("hideDeadTorrents", prefs.hideDeadTorrents);
  neSetFilterToggleState("minSeedersFilter", prefs.minSeedersFilterEnabled);
  neSetFilterToggleState("blockKeywordsFilter", prefs.blockKeywordsFilterEnabled);
  neSetFilterToggleState(
    "requireKeywordsFilter",
    prefs.requireKeywordsFilterEnabled,
  );
  neSetFilterToggleState("fileSizeFilter", prefs.fileSizeFilterEnabled);
  neSetFilterToggleState(
    "completedDownloadsFilter",
    prefs.completedDownloadsFilterEnabled,
  );
  neSetFilterToggleState("uploadDateFilter", prefs.uploadDateFilterEnabled);
  neSetFilterToggleState("historyHideFilter", prefs.historyHideFilterEnabled);

  neDisplayFilterKeywords("block", neKeywordList(prefs, "block"));
  neDisplayFilterKeywords("require", neKeywordList(prefs, "require"));
  neInitFileSizeRangeControls(prefs);
  neSetKeywordFilterControlsEnabled("block", prefs.blockKeywordsFilterEnabled);
  neSetKeywordFilterControlsEnabled(
    "require",
    prefs.requireKeywordsFilterEnabled,
  );

  const minSeedersInput = document.getElementById("ne-minSeedersValue");
  if (minSeedersInput) {
    minSeedersInput.value = String(
      neNormalizeMinSeedersValue(prefs.minSeedersFilterValue ?? 5),
    );
  }
  neSetMinSeedersControlsEnabled(prefs.minSeedersFilterEnabled);

  const operatorSelect = document.getElementById("ne-completedDownloadsOperator");
  const valueInput = document.getElementById("ne-completedDownloadsValue");
  if (operatorSelect) {
    operatorSelect.value = prefs.completedDownloadsFilterOperator || "gt";
  }
  if (valueInput) {
    valueInput.value = String(prefs.completedDownloadsFilterValue ?? 0);
  }
  neSetCompletedDownloadsControlsEnabled(
    prefs.completedDownloadsFilterEnabled,
  );
  neSetUploadDateRangeSelection(prefs.uploadDateFilterRange);
  neSyncUploadDateCustomInputs(prefs);
  neSetUploadDateControlsEnabled(prefs.uploadDateFilterEnabled);
  neSetHistoryHideActionSelection(prefs.historyHideActions);
  neSetHistoryHideControlsEnabled(prefs.historyHideFilterEnabled);
  neUpdateActiveFilterBadge(prefs);
  await neRenderFilterPresets(normalizeFilterPresets(prefs.filterPresets), prefs);
}

export function removeFiltersPanel() {
  document.querySelector(".ne-filters-panel")?.remove();
}

export async function addFiltersPanel() {
  if (!hasTorrentListTable()) return;

  const tableResponsive = document.querySelector(
    ".table-responsive:has(table.torrent-list)",
  );
  if (!tableResponsive) return;

  const prefs = await loadStoredPreferences();
  if (prefs.showFiltersPanel === false) {
    removeFiltersPanel();
    return;
  }
  if (document.querySelector(".ne-filters-panel")) return;

  const panel = document.createElement("div");
  panel.className = "ne-filters-panel";
  panel.innerHTML = `
    <div class="ne-filters-panel__toolbar">
      <button type="button" class="ne-filters-panel__header" aria-expanded="false">
        <span class="ne-filters-panel__title"><i class="fa fa-filter" aria-hidden="true"></i> Filters</span>
        <span class="ne-filters-panel__badge" hidden>0</span>
        <span class="ne-filters-panel__chevron" aria-hidden="true"></span>
      </button>
      <button type="button" class="ne-filters-panel__reset" id="ne-reset-filters" hidden>Reset all</button>
    </div>
    <div class="ne-filters-panel__body" hidden>
      <div class="ne-filters-panel__toggles">
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Hide dead torrents (0 S/L)</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="hideDeadTorrents" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Filter by minimum seeders</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="minSeedersFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Block keywords</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="blockKeywordsFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Require keywords</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="requireKeywordsFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Filter by file size</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="fileSizeFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Filter completed downloads</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="completedDownloadsFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Filter by upload date</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="uploadDateFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Hide torrents from history</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="historyHideFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
      </div>

      <div class="ne-filters-panel__options">
      <div class="ne-filters-panel__section ne-filters-panel__seeders-section" id="ne-minSeedersContainer">
        <h4 class="ne-filters-panel__section-title">Minimum seeders</h4>
        <p class="ne-filters-panel__section-desc">Hide torrents below this seeder count.</p>
        <div class="ne-filters-panel__seeders-row">
          <label for="ne-minSeedersValue">At least</label>
          <input type="number" id="ne-minSeedersValue" min="0" max="999999" step="1" inputmode="numeric" aria-label="Minimum seeders" disabled />
          <span class="ne-filters-panel__seeders-suffix">seeders</span>
        </div>
      </div>

      <div class="ne-filters-panel__section ne-filters-panel__completed-section" id="ne-completedDownloadsContainer">
        <h4 class="ne-filters-panel__section-title">Completed downloads</h4>
        <p class="ne-filters-panel__section-desc">Keep torrents matching this completed-count rule.</p>
        <div class="ne-filters-panel__completed-row">
          <select id="ne-completedDownloadsOperator" disabled>
            <option value="gt">Greater than</option>
            <option value="eq">Equal to</option>
            <option value="lt">Less than</option>
          </select>
          <input type="number" id="ne-completedDownloadsValue" min="0" step="1" placeholder="Count" disabled />
        </div>
      </div>

      <div class="ne-filters-panel__section ne-filters-panel__date-section" id="ne-uploadDateContainer">
        <h4 class="ne-filters-panel__section-title">Upload date</h4>
        <p class="ne-filters-panel__section-desc">Keep torrents uploaded in this period.</p>
        <div class="ne-filters-panel__date-options" role="radiogroup" aria-label="Upload date range">
          ${UPLOAD_DATE_FILTER_OPTIONS.map(
            (option) => `
          <button type="button" class="ne-filters-panel__date-option" data-ne-date-range="${option.id}" title="${option.desc}" aria-pressed="false" disabled>
            <span class="ne-filters-panel__date-option-label">${option.label}</span>
          </button>`,
          ).join("")}
          <button type="button" class="ne-filters-panel__date-option" data-ne-date-range="custom" title="Pick a from/to date range" aria-pressed="false" disabled>
            <span class="ne-filters-panel__date-option-label">Custom</span>
          </button>
        </div>
        <div class="ne-filters-panel__custom-dates" id="ne-uploadDateCustom" hidden>
          <label>
            From
            <input type="date" id="ne-uploadDateFrom" disabled />
          </label>
          <label>
            To
            <input type="date" id="ne-uploadDateTo" disabled />
          </label>
        </div>
      </div>

      <div class="ne-filters-panel__section" id="ne-fileSizeRangeContainer">
        <h4 class="ne-filters-panel__section-title">File size range</h4>
        <div class="ne-filters-panel__file-size-inputs">
          <div class="ne-filters-panel__file-size-field">
            <label for="ne-fileSizeMinInput">Minimum</label>
            <div class="ne-filters-panel__file-size-value-row">
              <input type="number" id="ne-fileSizeMinInput" min="0" step="any" disabled />
              <select id="ne-fileSizeMinUnit" disabled>
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB" selected>MiB</option>
                <option value="GiB">GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
          <div class="ne-filters-panel__file-size-field">
            <label for="ne-fileSizeMaxInput">Maximum</label>
            <div class="ne-filters-panel__file-size-value-row">
              <input type="number" id="ne-fileSizeMaxInput" min="0" step="any" disabled />
              <select id="ne-fileSizeMaxUnit" disabled>
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB">MiB</option>
                <option value="GiB" selected>GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
        </div>
        <div class="ne-filters-panel__file-size-slider">
          <div class="ne-filters-panel__file-size-track">
            <div class="ne-filters-panel__file-size-fill" id="ne-fileSizeRangeFill"></div>
          </div>
          <input type="range" id="ne-fileSizeMinSlider" min="0" max="${NE_FILTER_FILE_SIZE_SLIDER_MAX_MB}" step="1" disabled />
          <input type="range" id="ne-fileSizeMaxSlider" min="0" max="${NE_FILTER_FILE_SIZE_SLIDER_MAX_MB}" step="1" disabled />
        </div>
        <div class="ne-filters-panel__file-size-summary" id="ne-fileSizeRangeSummary"></div>
      </div>

      <div class="ne-filters-panel__section" id="ne-requireKeywordsContainer">
        <h4 class="ne-filters-panel__section-title">Required keywords</h4>
        <p class="ne-filters-panel__section-desc">Show only titles containing at least one of these words.</p>
        <div class="ne-filters-panel__keyword-input-row">
          <input type="text" id="ne-require-keyword-input" class="ne-filters-panel__keyword-input" placeholder="Enter keyword to require" disabled />
          <button type="button" id="ne-add-require-keyword" class="ne-filters-panel__keyword-add" disabled>Add</button>
        </div>
        <div class="ne-filters-panel__keyword-actions">
          <button type="button" id="ne-remove-all-require-keywords" class="ne-filters-panel__keyword-remove-all" disabled>Remove all</button>
        </div>
        <div id="ne-require-keywords-list" class="ne-filters-panel__keywords-list"></div>
      </div>

      <div class="ne-filters-panel__section" id="ne-blockKeywordsContainer">
        <h4 class="ne-filters-panel__section-title">Blocked keywords</h4>
        <p class="ne-filters-panel__section-desc">Hide titles containing any of these words.</p>
        <div class="ne-filters-panel__keyword-input-row">
          <input type="text" id="ne-block-keyword-input" class="ne-filters-panel__keyword-input" placeholder="Enter keyword to block" disabled />
          <button type="button" id="ne-add-block-keyword" class="ne-filters-panel__keyword-add" disabled>Add</button>
        </div>
        <div class="ne-filters-panel__keyword-actions">
          <button type="button" id="ne-remove-all-block-keywords" class="ne-filters-panel__keyword-remove-all" disabled>Remove all</button>
        </div>
        <div id="ne-block-keywords-list" class="ne-filters-panel__keywords-list"></div>
      </div>

      <div class="ne-filters-panel__section ne-filters-panel__history-section" id="ne-historyHideContainer">
        <h4 class="ne-filters-panel__section-title">Hide accessed torrents</h4>
        <p class="ne-filters-panel__section-desc">Hide torrents already in History for the selected actions.</p>
        <div class="ne-filters-panel__date-options" role="group" aria-label="History actions to hide">
          ${HISTORY_ACTION_IDS.map(
            (id) => `
          <button type="button" class="ne-filters-panel__date-option" data-ne-history-hide-action="${id}" title="${HISTORY_ACTION_META[id].verb}" aria-pressed="false" disabled>
            <span class="ne-filters-panel__date-option-label">${HISTORY_ACTION_META[id].label}</span>
          </button>`,
          ).join("")}
        </div>
      </div>
      </div>

      <div class="ne-filters-panel__presets" id="ne-filterPresets">
        <div class="ne-filters-panel__presets-head">
          <h4 class="ne-filters-panel__section-title">Presets</h4>
          <div class="ne-filters-panel__presets-tools">
            <button type="button" class="ne-filters-panel__preset-save" id="ne-preset-save">Save current</button>
            <button type="button" class="ne-filters-panel__preset-manage" id="ne-preset-manage" aria-pressed="false">Manage</button>
          </div>
        </div>
        <div class="ne-filters-panel__preset-editor" id="ne-preset-editor" hidden>
          <input type="text" id="ne-preset-name" class="ne-filters-panel__preset-name" maxlength="40" placeholder="Preset name" aria-label="Preset name" />
          <button type="button" class="ne-filters-panel__keyword-add" id="ne-preset-confirm">Save</button>
          <button type="button" class="ne-filters-panel__preset-cancel" id="ne-preset-cancel">Cancel</button>
        </div>
        <div class="ne-filters-panel__preset-list" id="ne-preset-list"></div>
      </div>
    </div>
  `;

  tableResponsive.parentNode.insertBefore(panel, tableResponsive);
  await neSyncFiltersPanelFromPrefs(prefs);

  panel.querySelector(".ne-filters-panel__header").addEventListener(
    "click",
    () => {
      const isExpanded = panel.classList.contains("ne-filters-panel--expanded");
      neSetFiltersPanelExpanded(!isExpanded);
    },
  );

  neWireFilterToggle("hideDeadTorrents", "hideDeadTorrents");
  neWireFilterToggle("minSeedersFilter", "minSeedersFilterEnabled", (enabled) => {
    neSetMinSeedersControlsEnabled(enabled);
    if (enabled) {
      const input = document.getElementById("ne-minSeedersValue");
      input?.focus();
      input?.select();
    }
  });
  neWireFilterToggle("blockKeywordsFilter", "blockKeywordsFilterEnabled", (enabled) => {
    neSetKeywordFilterControlsEnabled("block", enabled);
  });
  neWireFilterToggle(
    "requireKeywordsFilter",
    "requireKeywordsFilterEnabled",
    (enabled) => {
      neSetKeywordFilterControlsEnabled("require", enabled);
    },
  );
  neWireFilterToggle("fileSizeFilter", "fileSizeFilterEnabled", (enabled) => {
    neSetFileSizeRangeControlsEnabled(enabled);
  });
  neWireFilterToggle(
    "completedDownloadsFilter",
    "completedDownloadsFilterEnabled",
    (enabled) => {
      neSetCompletedDownloadsControlsEnabled(enabled);
    },
  );
  neWireFilterToggle("uploadDateFilter", "uploadDateFilterEnabled", (enabled) => {
    neSetUploadDateControlsEnabled(enabled);
  });
  neWireFilterToggle("historyHideFilter", "historyHideFilterEnabled", (enabled) => {
    neSetHistoryHideControlsEnabled(enabled);
  });

  document.getElementById("ne-reset-filters")?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await resetAllTorrentFilters();
  });

  neWireKeywordList("block");
  neWireKeywordList("require");
  neWireFilterPresets();

  document
    .getElementById("ne-fileSizeMinSlider")
    .addEventListener("input", () => neHandleFileSizeSliderInput(true));
  document
    .getElementById("ne-fileSizeMinSlider")
    .addEventListener("change", () => neHandleFileSizeSliderCommit(true));
  document
    .getElementById("ne-fileSizeMaxSlider")
    .addEventListener("input", () => neHandleFileSizeSliderInput(false));
  document
    .getElementById("ne-fileSizeMaxSlider")
    .addEventListener("change", () => neHandleFileSizeSliderCommit(false));

  ["ne-fileSizeMinInput", "ne-fileSizeMaxInput"].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("input", neScheduleFileSizePersistFromControls);
    input.addEventListener("change", () => {
      clearTimeout(neFilterFileSizeInputDebounceTimer);
      nePersistFileSizeBoundsFromControls();
    });
  });

  ["ne-fileSizeMinUnit", "ne-fileSizeMaxUnit"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      nePersistFileSizeBoundsFromControls();
    });
  });

  document
    .getElementById("ne-completedDownloadsOperator")
    .addEventListener("change", async (e) => {
      const newValue = e.target.value;
      await neSaveFilterSetting("completedDownloadsFilterOperator", newValue);
    });

  document
    .getElementById("ne-completedDownloadsValue")
    .addEventListener("change", async (e) => {
      const parsed = parseInt(e.target.value, 10);
      const newValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      e.target.value = String(newValue);
      await neSaveFilterSetting("completedDownloadsFilterValue", newValue);
    });

  document
    .getElementById("ne-minSeedersValue")
    .addEventListener("change", async (e) => {
      const newValue = neNormalizeMinSeedersValue(e.target.value);
      e.target.value = String(newValue);
      await neSaveFilterSetting("minSeedersFilterValue", newValue);
    });

  panel.querySelectorAll("[data-ne-date-range]").forEach((button) => {
    button.addEventListener("click", async () => {
      const newValue = neNormalizeUploadDateRange(button.dataset.neDateRange);
      if (button.getAttribute("aria-pressed") === "true") return;
      neSetUploadDateRangeSelection(newValue);
      if (newValue === "custom") {
        const fromEl = document.getElementById("ne-uploadDateFrom");
        const toEl = document.getElementById("ne-uploadDateTo");
        if (fromEl && toEl && !fromEl.value && !toEl.value) {
          const today = localDateInputValue();
          const monthAgo = localDateInputValue(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          );
          fromEl.value = monthAgo;
          toEl.value = today;
          try {
            await savePreferences({
              uploadDateFilterRange: "custom",
              uploadDateFilterFrom: monthAgo,
              uploadDateFilterTo: today,
            });
          } catch {
            await neSyncFiltersPanelFromPrefs(await loadStoredPreferences());
            return;
          }
          await handleSettingChange("uploadDateFilterRange", "custom");
          neUpdateActiveFilterBadge(await loadStoredPreferences());
          return;
        }
      }
      await neSaveFilterSetting("uploadDateFilterRange", newValue);
    });
  });

  const commitCustomUploadDates = async () => {
    const fromEl = document.getElementById("ne-uploadDateFrom");
    const toEl = document.getElementById("ne-uploadDateTo");
    let from = fromEl?.value || "";
    let to = toEl?.value || "";
    if (from && to && from > to) {
      const swap = from;
      from = to;
      to = swap;
      if (fromEl) fromEl.value = from;
      if (toEl) toEl.value = to;
    }
    try {
      await savePreferences({
        uploadDateFilterFrom: from,
        uploadDateFilterTo: to,
      });
    } catch {
      await neSyncFiltersPanelFromPrefs(await loadStoredPreferences());
      return;
    }
    await handleSettingChange("uploadDateFilterFrom", from);
    neUpdateActiveFilterBadge(await loadStoredPreferences());
  };

  document.getElementById("ne-uploadDateFrom")?.addEventListener("change", commitCustomUploadDates);
  document.getElementById("ne-uploadDateTo")?.addEventListener("change", commitCustomUploadDates);

  panel.querySelectorAll("[data-ne-history-hide-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const pressed = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", String(!pressed));
      const actions = Array.from(
        panel.querySelectorAll("[data-ne-history-hide-action][aria-pressed='true']"),
      ).map((el) => el.dataset.neHistoryHideAction);
      await neSaveFilterSetting("historyHideActions", actions);
    });
  });
}

export async function syncFiltersPanelUI(setting, value) {
  const panel = document.querySelector(".ne-filters-panel");
  if (!panel) return;

  const prefs = await loadStoredPreferences();

  switch (setting) {
    case "hideDeadTorrents":
      neSetFilterToggleState("hideDeadTorrents", value);
      break;
    case "minSeedersFilterEnabled":
      neSetFilterToggleState("minSeedersFilter", value);
      neSetMinSeedersControlsEnabled(value);
      break;
    case "minSeedersFilterValue":
      const minSeedersInput = document.getElementById("ne-minSeedersValue");
      if (minSeedersInput) {
        minSeedersInput.value = String(neNormalizeMinSeedersValue(value));
      }
      break;
    case "blockKeywordsFilterEnabled":
      neSetFilterToggleState("blockKeywordsFilter", value);
      neSetKeywordFilterControlsEnabled("block", value);
      break;
    case "requireKeywordsFilterEnabled":
      neSetFilterToggleState("requireKeywordsFilter", value);
      neSetKeywordFilterControlsEnabled("require", value);
      break;
    case "fileSizeFilterEnabled":
      neSetFilterToggleState("fileSizeFilter", value);
      neSetFileSizeRangeControlsEnabled(value);
      break;
    case "completedDownloadsFilterEnabled":
      neSetFilterToggleState("completedDownloadsFilter", value);
      neSetCompletedDownloadsControlsEnabled(value);
      break;
    case "uploadDateFilterEnabled":
      neSetFilterToggleState("uploadDateFilter", value);
      neSetUploadDateControlsEnabled(value);
      break;
    case "uploadDateFilterRange":
      neSetUploadDateRangeSelection(value);
      break;
    case "uploadDateFilterFrom":
    case "uploadDateFilterTo":
      neSyncUploadDateCustomInputs(prefs);
      break;
    case "historyHideFilterEnabled":
      neSetFilterToggleState("historyHideFilter", value);
      neSetHistoryHideControlsEnabled(value);
      break;
    case "historyHideActions":
      neSetHistoryHideActionSelection(value);
      break;
    case "fileSizeMinBytes":
    case "fileSizeMaxBytes":
      neSyncFileSizeControlsFromBounds(
        prefs.fileSizeMinBytes,
        prefs.fileSizeMaxBytes,
      );
      break;
    case "completedDownloadsFilterOperator":
      const operatorSelect = document.getElementById(
        "ne-completedDownloadsOperator",
      );
      if (operatorSelect) operatorSelect.value = value;
      break;
    case "completedDownloadsFilterValue":
      const valueInput = document.getElementById("ne-completedDownloadsValue");
      if (valueInput) valueInput.value = String(value ?? 0);
      break;
    case "blockKeywords":
      neDisplayFilterKeywords("block", Array.isArray(value) ? value : []);
      break;
    case "requireKeywords":
      neDisplayFilterKeywords("require", Array.isArray(value) ? value : []);
      break;
    case "filterPresets":
      await neRenderFilterPresets(normalizeFilterPresets(value), prefs);
      break;
  }

  neUpdateActiveFilterBadge(prefs);
  if (setting !== "filterPresets") {
    neSyncActiveFilterPreset(prefs, normalizeFilterPresets(prefs.filterPresets));
  }
}
