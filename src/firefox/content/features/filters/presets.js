import {
  PREF_DEFAULTS,
  loadStoredPreferences,
  savePreferences,
} from "../../../shared/prefs.js";

export const FILTER_PRESET_KEYS = [
  "hideDeadTorrents",
  "minSeedersFilterEnabled",
  "minSeedersFilterValue",
  "blockKeywordsFilterEnabled",
  "requireKeywordsFilterEnabled",
  "blockKeywords",
  "requireKeywords",
  "fileSizeFilterEnabled",
  "fileSizeMinBytes",
  "fileSizeMaxBytes",
  "completedDownloadsFilterEnabled",
  "completedDownloadsFilterOperator",
  "completedDownloadsFilterValue",
  "uploadDateFilterEnabled",
  "uploadDateFilterRange",
  "uploadDateFilterFrom",
  "uploadDateFilterTo",
  "historyHideFilterEnabled",
  "historyHideActions",
];

export const FILTER_PRESETS_MAX = 20;
export const FILTER_PRESET_NAME_MAX = 40;

export function cloneFilterValue(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
}

export function snapshotFilterState(prefs) {
  const snapshot = {};
  for (const key of FILTER_PRESET_KEYS) {
    const value = prefs?.[key];
    snapshot[key] = cloneFilterValue(
      value === undefined ? PREF_DEFAULTS[key] : value,
    );
  }
  return snapshot;
}

export function filterValueEquals(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    const a = Array.isArray(left) ? left.map(String).sort() : [];
    const b = Array.isArray(right) ? right.map(String).sort() : [];
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  if (typeof left === "boolean" || typeof right === "boolean") {
    return !!left === !!right;
  }
  if (typeof left === "number" || typeof right === "number") {
    return Number(left) === Number(right);
  }
  return left === right;
}

export function filterStatesEqual(a, b) {
  const left = snapshotFilterState(a);
  const right = snapshotFilterState(b);
  return FILTER_PRESET_KEYS.every((key) =>
    filterValueEquals(left[key], right[key]),
  );
}

export function findMatchingFilterPreset(presets, prefs) {
  const current = snapshotFilterState(prefs);
  return (
    (presets || []).find((preset) =>
      filterStatesEqual(current, preset.filters),
    ) || null
  );
}

export function createFilterPresetId() {
  return `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function neNormalizeFilterPresetName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FILTER_PRESET_NAME_MAX);
}

export function normalizeFilterPresets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((preset, index) => {
      if (!preset || typeof preset !== "object") return null;
      const id = String(preset.id || "").trim();
      const name = neNormalizeFilterPresetName(preset.name);
      if (!id || !name) return null;
      const filters =
        preset.filters && typeof preset.filters === "object"
          ? snapshotFilterState({ ...preset.filters })
          : {};
      const order = Number.isFinite(preset.order) ? preset.order : index;
      return { id, name, order, filters };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((preset, index) => ({ ...preset, order: index }));
}

export async function loadFilterPresets() {
  const prefs = await loadStoredPreferences();
  return normalizeFilterPresets(prefs.filterPresets);
}

export async function saveFilterPresets(presets) {
  const normalized = normalizeFilterPresets(presets);
  await new Promise((resolve) =>
    savePreferences({ filterPresets: normalized }, resolve),
  );
  return normalized;
}

export async function addFilterPreset(name, prefs) {
  const normalizedName = neNormalizeFilterPresetName(name);
  if (!normalizedName) return { error: "empty" };

  const presets = await loadFilterPresets();
  if (presets.length >= FILTER_PRESETS_MAX) {
    return { error: "limit", limit: FILTER_PRESETS_MAX };
  }

  const preset = {
    id: createFilterPresetId(),
    name: normalizedName,
    order: presets.length,
    filters: snapshotFilterState(prefs),
  };
  const next = await saveFilterPresets([...presets, preset]);
  return { preset, presets: next };
}

export async function renameFilterPreset(id, name) {
  const normalizedName = neNormalizeFilterPresetName(name);
  if (!normalizedName) return { error: "empty" };
  const presets = await loadFilterPresets();
  const next = presets.map((preset) =>
    preset.id === id ? { ...preset, name: normalizedName } : preset,
  );
  return { presets: await saveFilterPresets(next) };
}

export async function updateFilterPresetFromCurrent(id, prefs) {
  const presets = await loadFilterPresets();
  const next = presets.map((preset) =>
    preset.id === id
      ? { ...preset, filters: snapshotFilterState(prefs) }
      : preset,
  );
  return { presets: await saveFilterPresets(next) };
}

export async function removeFilterPreset(id) {
  const presets = await loadFilterPresets();
  return {
    presets: await saveFilterPresets(
      presets.filter((preset) => preset.id !== id),
    ),
  };
}

export async function moveFilterPreset(id, direction) {
  const presets = await loadFilterPresets();
  const index = presets.findIndex((preset) => preset.id === id);
  if (index < 0) return { presets };
  const target = index + direction;
  if (target < 0 || target >= presets.length) return { presets };
  const next = [...presets];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return { presets: await saveFilterPresets(next) };
}

export async function reorderFilterPresets(orderedIds) {
  const presets = await loadFilterPresets();
  const byId = new Map(presets.map((preset) => [preset.id, preset]));
  const next = [];
  for (const id of orderedIds) {
    const preset = byId.get(id);
    if (preset) {
      next.push(preset);
      byId.delete(id);
    }
  }
  for (const preset of byId.values()) next.push(preset);
  return saveFilterPresets(next);
}

export function findFilterPreset(presets, id) {
  return presets.find((preset) => preset.id === id) || null;
}
