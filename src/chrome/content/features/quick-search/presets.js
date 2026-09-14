import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";

export const QUICK_SEARCH_PRESETS_MAX = 20;
export const QUICK_SEARCH_PRESET_NAME_MAX = 40;
const QS_PRESET_SIZE_MAX_BYTES = 51200 * 1024 * 1024;

export function getQuickSearchPresetDefaults() {
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
    fileSizeMaxBytes: QS_PRESET_SIZE_MAX_BYTES,
    fileSizeMinUnit: "MiB",
    fileSizeMaxUnit: "GiB",
  };
}

export function cloneQuickSearchValue(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
}

export function snapshotQuickSearchState(state) {
  const defaults = getQuickSearchPresetDefaults();
  const snapshot = {};
  for (const key of Object.keys(defaults)) {
    const value = state?.[key];
    snapshot[key] = cloneQuickSearchValue(
      value === undefined ? defaults[key] : value,
    );
  }
  return snapshot;
}

export function createQuickSearchPresetId() {
  return `qs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function neNormalizeQuickSearchPresetName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, QUICK_SEARCH_PRESET_NAME_MAX);
}

export function normalizeQuickSearchPresets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((preset, index) => {
      if (!preset || typeof preset !== "object") return null;
      const id = String(preset.id || "").trim();
      const name = neNormalizeQuickSearchPresetName(preset.name);
      if (!id || !name) return null;
      const state = snapshotQuickSearchState(preset.state || preset.filters || {});
      const order = Number.isFinite(preset.order) ? preset.order : index;
      return { id, name, order, state };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((preset, index) => ({ ...preset, order: index }));
}

export async function loadQuickSearchPresets() {
  const prefs = await loadStoredPreferences();
  return normalizeQuickSearchPresets(prefs.quickSearchPresets);
}

export async function saveQuickSearchPresets(presets) {
  const normalized = normalizeQuickSearchPresets(presets);
  await savePreferences({ quickSearchPresets: normalized });
  return normalized;
}

export async function addQuickSearchPreset(name, state) {
  const normalizedName = neNormalizeQuickSearchPresetName(name);
  if (!normalizedName) return { error: "empty" };

  const presets = await loadQuickSearchPresets();
  if (presets.length >= QUICK_SEARCH_PRESETS_MAX) {
    return { error: "limit", limit: QUICK_SEARCH_PRESETS_MAX };
  }

  const preset = {
    id: createQuickSearchPresetId(),
    name: normalizedName,
    order: presets.length,
    state: snapshotQuickSearchState(state),
  };
  const next = await saveQuickSearchPresets([...presets, preset]);
  return { preset, presets: next };
}

export async function renameQuickSearchPreset(id, name) {
  const normalizedName = neNormalizeQuickSearchPresetName(name);
  if (!normalizedName) return { error: "empty" };
  const presets = await loadQuickSearchPresets();
  const next = presets.map((preset) =>
    preset.id === id ? { ...preset, name: normalizedName } : preset,
  );
  return { presets: await saveQuickSearchPresets(next) };
}

export async function updateQuickSearchPresetFromCurrent(id, state) {
  const presets = await loadQuickSearchPresets();
  const next = presets.map((preset) =>
    preset.id === id
      ? { ...preset, state: snapshotQuickSearchState(state) }
      : preset,
  );
  return { presets: await saveQuickSearchPresets(next) };
}

export async function removeQuickSearchPreset(id) {
  const presets = await loadQuickSearchPresets();
  return {
    presets: await saveQuickSearchPresets(
      presets.filter((preset) => preset.id !== id),
    ),
  };
}

export async function moveQuickSearchPreset(id, direction) {
  const presets = await loadQuickSearchPresets();
  const index = presets.findIndex((preset) => preset.id === id);
  if (index < 0) return { presets };
  const target = index + direction;
  if (target < 0 || target >= presets.length) return { presets };
  const next = [...presets];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return { presets: await saveQuickSearchPresets(next) };
}
