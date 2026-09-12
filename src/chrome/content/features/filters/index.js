import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { failsCompletedDownloadsFilter, getCompletedDownloadsFromRow, getQuickSearchClientFilterOptions, getTitleFromRow, handleSettingChange, isNyaaTorrentDataRow, isNyaaTorrentListPage, shouldHideRowByQuickSearch, showNotification, syncSelectionToVisibleRows, updateTorrentRowLinkActions } from "../../internal.js";

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

export function getActiveFilterLabels(prefs) {
  const labels = [];
  if (prefs.hideDeadTorrents) labels.push("dead torrents");
  if (prefs.minSeedersFilterEnabled && getMinSeedersThreshold(prefs) > 0) {
    labels.push("minimum seeders");
  }
  if (prefs.keywordFilterEnabled && prefs.keywords.length > 0) {
    labels.push("blocked keywords");
  }
  if (prefs.fileSizeFilterEnabled) labels.push("file size");
  if (prefs.completedDownloadsFilterEnabled) labels.push("completed downloads");
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

export function shouldHideRowByFilters(row, prefs) {
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

  if (
    prefs.keywordFilterEnabled &&
    prefs.keywords.some((keyword) =>
      title?.toLowerCase().includes(keyword.toLowerCase()),
    )
  ) {
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

  return false;
}

export async function applyAllTorrentFilters({ notify = false } = {}) {
  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody) return { newlyHidden: 0, totalHidden: 0 };

  const prefs = await loadStoredPreferences();
  const qsOptions = getQuickSearchClientFilterOptions();
  const rows = tableBody.querySelectorAll("tr");
  let newlyHidden = 0;
  let totalHidden = 0;
  const newlyVisibleForAt = [];

  rows.forEach((row) => {
    if (!isNyaaTorrentDataRow(row)) return;

    const wasVisible = row.style.display !== "none";
    const shouldHide =
      shouldHideRowByFilters(row, prefs) ||
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

export function neSyncFileSizeControlsFromBounds(
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
    savePreferences({
      fileSizeMinBytes: bounds.min,
      fileSizeMaxBytes: bounds.max,
    });
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
  const operatorSelect = document.getElementById(
    "ne-completedDownloadsOperator",
  );
  const valueInput = document.getElementById("ne-completedDownloadsValue");
  if (operatorSelect) operatorSelect.disabled = !enabled;
  if (valueInput) valueInput.disabled = !enabled;
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
  if (prefs.keywordFilterEnabled) count++;
  if (prefs.fileSizeFilterEnabled) count++;
  if (prefs.completedDownloadsFilterEnabled) count++;
  return count;
}

export function neUpdateActiveFilterBadge(prefs) {
  const badge = document.querySelector(".ne-filters-panel__badge");
  if (!badge) return;
  const count = neCountActiveFilters(prefs);
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

export async function neSaveFilterSetting(key, value) {
  await new Promise((resolve) =>
    savePreferences({ [key]: value }, resolve),
  );
  await handleSettingChange(key, value);
  const prefs = await loadStoredPreferences();
  neUpdateActiveFilterBadge(prefs);
}

export function neDisplayFilterKeywords(keywords) {
  const keywordsList = document.getElementById("ne-keywords-list");
  if (!keywordsList) return;
  keywordsList.innerHTML = "";

  if (!keywords.length) {
    const empty = document.createElement("p");
    empty.className = "ne-filters-panel__empty-keywords";
    empty.textContent = "No keywords added yet.";
    keywordsList.appendChild(empty);
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
      .addEventListener("click", () => neRemoveFilterKeyword(keyword));
    keywordsList.appendChild(item);
  });
}

export async function neAddFilterKeyword() {
  const input = document.getElementById("ne-keyword-input");
  const keyword = input.value.trim();
  if (!keyword) return;

  const prefs = await loadStoredPreferences();
  if (prefs.keywords.includes(keyword)) {
    input.value = "";
    return;
  }

  const keywords = [...prefs.keywords, keyword];
  await new Promise((resolve) =>
    savePreferences({ keywords }, resolve),
  );
  input.value = "";
  neDisplayFilterKeywords(keywords);
  await applyAllTorrentFilters({ notify: true });
}

export async function neRemoveFilterKeyword(keywordToRemove) {
  const prefs = await loadStoredPreferences();
  const keywords = prefs.keywords.filter((k) => k !== keywordToRemove);
  await new Promise((resolve) =>
    savePreferences({ keywords }, resolve),
  );
  neDisplayFilterKeywords(keywords);
  await applyAllTorrentFilters({ notify: true });
}

export async function neRemoveAllFilterKeywords() {
  await new Promise((resolve) =>
    savePreferences({ keywords: [] }, resolve),
  );
  neDisplayFilterKeywords([]);
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

export function nePersistFileSizeBoundsFromControls() {
  const bounds = neReadFileSizeBoundsFromControls();
  neSyncFileSizeControlsFromBounds(bounds.min, bounds.max, {
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

export function neHandleFileSizeSliderCommit(isMinSlider) {
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
    { updateStorage: true },
  );
}

export function neWireFilterToggle(toggleId, settingKey, onChange) {
  const toggle = document.querySelector(
    `.ne-filters-panel [data-ne-toggle="${toggleId}"]`,
  );
  if (!toggle) return;

  toggle.addEventListener("click", async () => {
    const newState = toggle.getAttribute("aria-checked") !== "true";
    toggle.setAttribute("aria-checked", String(newState));
    if (onChange) onChange(newState);
    await neSaveFilterSetting(settingKey, newState);
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
  neSetFilterToggleState("keywordFilter", prefs.keywordFilterEnabled);
  neSetFilterToggleState("fileSizeFilter", prefs.fileSizeFilterEnabled);
  neSetFilterToggleState(
    "completedDownloadsFilter",
    prefs.completedDownloadsFilterEnabled,
  );

  neDisplayFilterKeywords(prefs.keywords);
  neInitFileSizeRangeControls(prefs);

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
  neUpdateActiveFilterBadge(prefs);
}

export async function addFiltersPanel() {
  if (!hasTorrentListTable()) return;
  if (document.querySelector(".ne-filters-panel")) return;

  const tableResponsive = document.querySelector(
    ".table-responsive:has(table.torrent-list)",
  );
  if (!tableResponsive) return;

  const prefs = await loadStoredPreferences();

  const panel = document.createElement("div");
  panel.className = "ne-filters-panel";
  panel.innerHTML = `
    <button type="button" class="ne-filters-panel__header" aria-expanded="false">
      <span class="ne-filters-panel__title"><i class="fa fa-filter" aria-hidden="true"></i> Filters</span>
      <span class="ne-filters-panel__badge" hidden>0</span>
      <span class="ne-filters-panel__chevron" aria-hidden="true"></span>
    </button>
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
          <span class="ne-filters-panel__toggle-label">Enable keyword filtering</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="keywordFilter" role="switch" aria-checked="false">
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
      </div>

      <div class="ne-filters-panel__section ne-filters-panel__seeders-section" id="ne-minSeedersContainer">
        <h4 class="ne-filters-panel__section-title">Minimum seeders</h4>
        <p class="ne-filters-panel__section-desc">Hide torrents with fewer seeders than this number. Dead torrents (0 S/L) can still be hidden separately.</p>
        <div class="ne-filters-panel__seeders-row">
          <label for="ne-minSeedersValue">At least</label>
          <input type="number" id="ne-minSeedersValue" min="0" max="999999" step="1" inputmode="numeric" aria-label="Minimum seeders" disabled />
          <span class="ne-filters-panel__seeders-suffix">seeders</span>
        </div>
      </div>

      <div class="ne-filters-panel__section">
        <h4 class="ne-filters-panel__section-title">Blocked keywords</h4>
        <p class="ne-filters-panel__section-desc">Torrents with these words in their title will be hidden when keyword filtering is enabled.</p>
        <div class="ne-filters-panel__keyword-input-row">
          <input type="text" id="ne-keyword-input" class="ne-filters-panel__keyword-input" placeholder="Enter keyword to filter" />
          <button type="button" id="ne-add-keyword" class="ne-filters-panel__keyword-add">Add</button>
        </div>
        <div class="ne-filters-panel__keyword-actions">
          <button type="button" id="ne-remove-all-keywords" class="ne-filters-panel__keyword-remove-all">Remove all</button>
        </div>
        <div id="ne-keywords-list" class="ne-filters-panel__keywords-list"></div>
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

      <div class="ne-filters-panel__section ne-filters-panel__completed-section">
        <h4 class="ne-filters-panel__section-title">Completed downloads threshold</h4>
        <div class="ne-filters-panel__completed-row">
          <select id="ne-completedDownloadsOperator" disabled>
            <option value="gt">Greater than</option>
            <option value="eq">Equal to</option>
            <option value="lt">Less than</option>
          </select>
          <input type="number" id="ne-completedDownloadsValue" min="0" step="1" placeholder="Count" disabled />
        </div>
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
  neWireFilterToggle("keywordFilter", "keywordFilterEnabled");
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

  document
    .getElementById("ne-add-keyword")
    .addEventListener("click", neAddFilterKeyword);
  document.getElementById("ne-keyword-input").addEventListener(
    "keypress",
    (e) => {
      if (e.key === "Enter") neAddFilterKeyword();
    },
  );
  document
    .getElementById("ne-remove-all-keywords")
    .addEventListener("click", neRemoveAllFilterKeywords);

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
    case "keywordFilterEnabled":
      neSetFilterToggleState("keywordFilter", value);
      break;
    case "fileSizeFilterEnabled":
      neSetFilterToggleState("fileSizeFilter", value);
      neSetFileSizeRangeControlsEnabled(value);
      break;
    case "completedDownloadsFilterEnabled":
      neSetFilterToggleState("completedDownloadsFilter", value);
      neSetCompletedDownloadsControlsEnabled(value);
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
    case "keywords":
      neDisplayFilterKeywords(value);
      break;
  }

  neUpdateActiveFilterBadge(prefs);
}
