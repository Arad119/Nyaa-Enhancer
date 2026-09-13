import { loadStoredPreferences } from "../../../shared/prefs.js";

export const HISTORY_STORAGE_KEY = "neHistory";
export const HISTORY_SCHEMA_VERSION = 2;
export const HISTORY_MAX_EVENTS_DEFAULT = 400;
export const HISTORY_MAX_EVENTS_MIN = 0;
export const HISTORY_MAX_EVENTS_MAX = 5000;
export const HISTORY_TITLE_MAX = 72;
export const HISTORY_VISIT_COALESCE_SEC = 30 * 60;
export const HISTORY_ACTION_COALESCE_SEC = 20;

export const HISTORY_ACTIONS = {
  visit: 0,
  download: 1,
  save: 2,
  send: 3,
};

export const HISTORY_ACTION_IDS = ["visit", "download", "save", "send"];

export const HISTORY_ACTION_META = {
  visit: { label: "Visit", verb: "Visited", icon: "fa-eye" },
  download: { label: "Download", verb: "Downloaded", icon: "fa-download" },
  save: { label: "Save", verb: "Saved magnet", icon: "fa-clipboard" },
  send: { label: "Send", verb: "Sent", icon: "fa-cloud-upload" },
};

function emptyState() {
  return { v: HISTORY_SCHEMA_VERSION, n: {}, h: {}, e: [] };
}

export function compactHistoryTitle(title) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= HISTORY_TITLE_MAX) return text;
  return `${text.slice(0, HISTORY_TITLE_MAX - 1).trimEnd()}…`;
}

export function compactHistoryHash(value) {
  const hash = String(value || "").trim().toLowerCase();
  if (/^[a-f0-9]{40}$/.test(hash)) return hash;
  if (/^[a-z2-7]{32}$/.test(hash)) return hash;
  return "";
}

export function parseHistoryTorrentId(value) {
  const id = parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function neNormalizeHistoryMaxEvents(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return HISTORY_MAX_EVENTS_DEFAULT;
  return Math.max(
    HISTORY_MAX_EVENTS_MIN,
    Math.min(HISTORY_MAX_EVENTS_MAX, parsed),
  );
}

export function normalizeHistoryAction(action) {
  if (typeof action === "number" && action >= 0 && action <= 3) {
    return action;
  }
  if (action === "copy") return HISTORY_ACTIONS.save;
  return Object.prototype.hasOwnProperty.call(HISTORY_ACTIONS, action)
    ? HISTORY_ACTIONS[action]
    : -1;
}

export function historyActionId(code) {
  return HISTORY_ACTION_IDS[code] || "";
}

export function normalizeHistoryHideActions(value) {
  if (!Array.isArray(value)) return [...HISTORY_ACTION_IDS];
  return HISTORY_ACTION_IDS.filter((id) => value.includes(id));
}

function filterEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter(
    (event) =>
      Array.isArray(event) &&
      event.length >= 3 &&
      parseHistoryTorrentId(event[0]) &&
      event[1] >= 0 &&
      event[1] <= 3 &&
      Number.isFinite(event[2]),
  );
}

function normalizeNameMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

function normalizeHashMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const hashes = {};
  for (const [id, value] of Object.entries(raw)) {
    const hash = compactHistoryHash(value);
    if (hash) hashes[id] = hash;
  }
  return hashes;
}

function normalizeState(raw) {
  if (!raw || (raw.v !== 1 && raw.v !== HISTORY_SCHEMA_VERSION)) {
    return emptyState();
  }
  return {
    v: HISTORY_SCHEMA_VERSION,
    n: normalizeNameMap(raw.n),
    h: normalizeHashMap(raw.h),
    e: filterEvents(raw.e),
  };
}

function storageGet() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(HISTORY_STORAGE_KEY, (items) => {
        if (chrome.runtime.lastError) {
          resolve(emptyState());
          return;
        }
        resolve(normalizeState(items?.[HISTORY_STORAGE_KEY]));
      });
    } catch {
      resolve(emptyState());
    }
  });
}

function storageSet(state) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: state }, () => {
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function pruneHistoryMaps(state) {
  const used = new Set(state.e.map((event) => String(event[0])));
  for (const key of Object.keys(state.n)) {
    if (!used.has(key)) delete state.n[key];
  }
  for (const key of Object.keys(state.h)) {
    if (!used.has(key)) delete state.h[key];
  }
}

function rememberTitle(state, id, title) {
  const compact = compactHistoryTitle(title);
  if (!compact) return;
  const key = String(id);
  const existing = state.n[key];
  if (!existing || compact.length >= existing.length) {
    state.n[key] = compact;
  }
}

function rememberHash(state, id, hash) {
  const compact = compactHistoryHash(hash);
  if (!compact) return;
  state.h[String(id)] = compact;
}

function coalesceIndex(state, id, action, ts, windowSec) {
  for (let i = state.e.length - 1; i >= 0; i--) {
    const event = state.e[i];
    if (event[0] !== id || event[1] !== action) continue;
    if (ts - event[2] <= windowSec) return i;
    return -1;
  }
  return -1;
}

function pushEvent(state, id, action, ts) {
  const windowSec =
    action === HISTORY_ACTIONS.visit
      ? HISTORY_VISIT_COALESCE_SEC
      : HISTORY_ACTION_COALESCE_SEC;
  const existing = coalesceIndex(state, id, action, ts, windowSec);
  if (existing >= 0) state.e.splice(existing, 1);
  state.e.push([id, action, ts]);
}

function trimEvents(state, cap) {
  const limit = neNormalizeHistoryMaxEvents(cap);
  if (limit <= 0) {
    state.e = [];
  } else if (state.e.length > limit) {
    state.e = state.e.slice(state.e.length - limit);
  }
  pruneHistoryMaps(state);
}

let writeChain = Promise.resolve();
let hashIndexCache = null;

export function invalidateHistoryHashIndex() {
  hashIndexCache = null;
}

export function buildHistoryHashIndex(state) {
  const hashes = {
    visit: new Set(),
    download: new Set(),
    save: new Set(),
    send: new Set(),
  };
  const ids = {
    visit: new Set(),
    download: new Set(),
    save: new Set(),
    send: new Set(),
  };
  const source = state || emptyState();
  for (const event of source.e) {
    const actionId = historyActionId(event[1]);
    if (!actionId) continue;
    const id = parseHistoryTorrentId(event[0]);
    if (id) ids[actionId].add(id);
    const hash = compactHistoryHash(source.h[String(event[0])]);
    if (hash) hashes[actionId].add(hash);
  }
  return { hashes, ids };
}

export async function getHistoryHashIndex() {
  if (hashIndexCache) return hashIndexCache;
  hashIndexCache = buildHistoryHashIndex(await storageGet());
  return hashIndexCache;
}

export function recordHistory(action, items) {
  const actionCode = normalizeHistoryAction(action);
  if (actionCode < 0) return writeChain;

  const list = (Array.isArray(items) ? items : [items])
    .map((item) => {
      const id = parseHistoryTorrentId(item?.id);
      if (!id) return null;
      return {
        id,
        title: item.title || "",
        hash: compactHistoryHash(item.hash),
      };
    })
    .filter(Boolean);

  if (!list.length) return writeChain;

  writeChain = writeChain
    .then(async () => {
      const prefs = await loadStoredPreferences();
      if (!prefs.historyEnabled) return;
      const cap = neNormalizeHistoryMaxEvents(prefs.historyMaxEvents);
      if (cap <= 0) return;

      const state = await storageGet();
      const ts = Math.floor(Date.now() / 1000);
      for (const item of list) {
        rememberTitle(state, item.id, item.title);
        rememberHash(state, item.id, item.hash);
        pushEvent(state, item.id, actionCode, ts);
      }
      trimEvents(state, cap);
      invalidateHistoryHashIndex();
      await storageSet(state);
    })
    .catch((err) => {
      console.error("Nyaa Enhancer: failed to record history", err);
    });

  return writeChain;
}

export async function loadHistoryState() {
  return storageGet();
}

export function expandHistoryEvents(state) {
  const source = state || emptyState();
  return source.e.map(([id, action, ts]) => ({
    id,
    action: historyActionId(action),
    actionCode: action,
    title: source.n[String(id)] || `#${id}`,
    hash: source.h[String(id)] || "",
    ts,
  }));
}

export async function loadHistoryEvents() {
  return expandHistoryEvents(await storageGet());
}

export async function removeHistoryEvent(id, actionCode, ts) {
  const state = await storageGet();
  const idx = state.e.findIndex(
    (event) => event[0] === id && event[1] === actionCode && event[2] === ts,
  );
  if (idx < 0) return;
  state.e.splice(idx, 1);
  pruneHistoryMaps(state);
  invalidateHistoryHashIndex();
  await storageSet(state);
}

export async function clearHistory() {
  invalidateHistoryHashIndex();
  await storageSet(emptyState());
}

export async function trimHistoryToCap(cap) {
  const limit = neNormalizeHistoryMaxEvents(cap);
  const state = await storageGet();
  trimEvents(state, limit);
  invalidateHistoryHashIndex();
  await storageSet(state);
}

export function historyMatchesQuery(event, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = `${event.title} ${event.id} ${event.hash || ""}`.toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export const HISTORY_DATE_PRESETS = [
  { id: "day", label: "Day", desc: "Last 24 hours", seconds: 24 * 60 * 60 },
  { id: "week", label: "Week", desc: "Last 7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "month", label: "Month", desc: "Last 30 days", seconds: 30 * 24 * 60 * 60 },
  { id: "3months", label: "3 Months", desc: "Last 90 days", seconds: 90 * 24 * 60 * 60 },
  { id: "6months", label: "6 Months", desc: "Last 180 days", seconds: 180 * 24 * 60 * 60 },
  { id: "year", label: "Year", desc: "Last 365 days", seconds: 365 * 24 * 60 * 60 },
];

export function historyPresetSeconds(presetId) {
  return HISTORY_DATE_PRESETS.find((preset) => preset.id === presetId)?.seconds || 0;
}

export function localDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((part) => parseInt(part, 10));
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
}

export function endOfLocalDay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((part) => parseInt(part, 10));
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d, 23, 59, 59, 999).getTime() / 1000);
}

export function eventInHistoryDateRange(event, { preset = "day", from = "", to = "" } = {}) {
  if (preset === "custom") {
    const start = startOfLocalDay(from);
    const end = endOfLocalDay(to);
    if (start != null && event.ts < start) return false;
    if (end != null && event.ts > end) return false;
    return true;
  }
  const seconds = historyPresetSeconds(preset);
  if (!seconds) return true;
  return event.ts >= Math.floor(Date.now() / 1000) - seconds;
}
