// Cloud sync: keeps a copy of the user's settings (and optionally history and
// credentials) in a WebDAV folder and merges it across devices.
//
// The cloud copy is one JSON file in the same format as Settings → Export.
// Every settings change marks its key as pending and schedules an upload.
// Before each upload the cloud copy is read first: settings changed on this
// device since the last upload win, everything else takes the cloud value.
// Writes use If-Match, so a device that lost a race re-reads and merges
// instead of overwriting what another device just saved.
import {
  CLOUD_SYNC_PREF_KEYS,
  PREFS_EXPORT_FORMAT,
  PREFS_EXPORT_VERSION,
  exportPreferences,
  getPreferencesAsync,
  importPreferences,
  isPortablePrefKey,
  loadStoredPreferences,
  savePreferencesAsync,
} from "../shared/prefs.js";
import {
  CLOUD_SYNC_CHECK_DEFAULT,
  CLOUD_SYNC_STATE_KEY,
  cloudSyncCheckGapMs,
  cloudSyncErrorMessage,
  cloudSyncFileUrl,
  cloudSyncFolderUrl,
  normalizeCloudSyncCheckMinutes,
  validateWebdavUrl,
  webdavPermissionPattern,
} from "../shared/webdav.js";
import {
  HISTORY_STORAGE_KEY,
  loadHistoryState,
  mergeHistoryState,
} from "../content/features/history/store.js";

const PUSH_DELAY_MS = 4000;
// History changes on every page visit, so it is batched. 20 s stays well
// inside the background's ~30 s idle lifetime; if the background is stopped
// first, the pending change is saved and goes out on the next wake.
const HISTORY_PUSH_DELAY_MS = 20_000;
// Checks for changes from other browsers happen on browser start and when a
// Nyaa page loads (as often as the user's check setting allows), and always
// when Settings opens.
const SETTINGS_WAKE_MIN_GAP_MS = 30_000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PUSH_ATTEMPTS = 4;
// On servers that ignore If-Match, how long after an upload to check that no
// other browser replaced it without seeing it.
const CONFIRM_DELAY_MS = 2500;
const WRITE_CHECK_FILE = ".write-check";
const SUPPRESS_WINDOW_MS = 4000;

// The include toggles travel with the cloud copy, so every device agrees on
// whether credentials and history are shared.
const SHARED_TOGGLE_KEYS = ["cloudSyncIncludeCredentials", "cloudSyncIncludeHistory"];

// Uploaded with the other credentials, but never applied from the cloud: this
// browser's own WebDAV login is what reaches the cloud in the first place,
// and services like Nextcloud give each device its own app password.
const KEEP_LOCAL_ON_PULL = ["webdavUsername", "webdavPassword"];

const CONFIG_DEFAULTS = {
  cloudSyncEnabled: false,
  cloudSyncUrl: "",
  cloudSyncIncludeCredentials: false,
  cloudSyncIncludeHistory: false,
  webdavUsername: "",
  webdavPassword: "",
  cloudSyncCheckMinutes: CLOUD_SYNC_CHECK_DEFAULT,
};

export class CloudSyncError extends Error {
  constructor(code, { status = 0, detail = "", retryAfterMs = 0 } = {}) {
    super(cloudSyncErrorMessage(code));
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.retryAfterMs = retryAfterMs;
  }
}

// ── Config and state ────────────────────────────────────────────────────────

export async function getCloudSyncConfig(overrides = {}) {
  const prefs = { ...(await getPreferencesAsync(CONFIG_DEFAULTS)), ...overrides };
  const validated = validateWebdavUrl(prefs.cloudSyncUrl);
  return {
    enabled: !!prefs.cloudSyncEnabled,
    url: validated.ok ? validated.url : "",
    urlError: validated.ok ? "" : validated.empty ? "not_configured" : "invalid_url",
    includeCredentials: !!prefs.cloudSyncIncludeCredentials,
    includeHistory: !!prefs.cloudSyncIncludeHistory,
    checkMinutes: normalizeCloudSyncCheckMinutes(prefs.cloudSyncCheckMinutes),
    username: String(prefs.webdavUsername || ""),
    password: String(prefs.webdavPassword || ""),
  };
}

function newDeviceId() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// dirty: { key: changeStamp } for settings edited here since the last upload.
// historyDirty: the stamp of the latest unsent history change (0 = none).
function defaultState() {
  return {
    deviceId: "",
    remoteKey: "",
    etag: "",
    dirty: {},
    historyDirty: 0,
    lastPushAt: 0,
    lastPullAt: 0,
    lastSyncAt: 0,
    lastPushedRevision: "",
    lastRemoteUpdatedAt: 0,
    lastRemoteDevice: "",
    lastError: null,
    // Automatic syncing waits until then after the server said "too many
    // requests" (often a lockout after wrong passwords).
    pausedUntil: 0,
    // Whether the server honours If-Match, probed once per server and login.
    writeCheck: null,
  };
}

function normalizeState(raw) {
  // Deep copy: the caller compares against raw to decide whether to write.
  const copy = raw && typeof raw === "object" ? JSON.parse(JSON.stringify(raw)) : {};
  const state = { ...defaultState(), ...copy };
  if (!state.deviceId) state.deviceId = newDeviceId();
  if (!state.dirty || typeof state.dirty !== "object" || Array.isArray(state.dirty)) {
    state.dirty = {};
  }
  state.historyDirty = Number(state.historyDirty) || 0;
  return state;
}

let stateChain = Promise.resolve();

// Every state change goes through this queue, so a sync finishing never
// overwrites pending edits that were recorded while it was running.
function updateCloudSyncState(mutate) {
  const run = stateChain.then(async () => {
    const stored = await chrome.storage.local.get(CLOUD_SYNC_STATE_KEY);
    const raw = stored?.[CLOUD_SYNC_STATE_KEY];
    const state = normalizeState(raw);
    await mutate(state);
    // Reads must not write: the settings page refreshes on every change.
    if (JSON.stringify(state) !== JSON.stringify(raw)) {
      await chrome.storage.local.set({ [CLOUD_SYNC_STATE_KEY]: state });
    }
    return state;
  });
  stateChain = run.catch(() => {});
  return run;
}

// Going through the queue also stores a new device ID on first use.
export function getCloudSyncState() {
  return updateCloudSyncState(() => {});
}

let changeCounter = 0;

function nextChangeStamp() {
  changeCounter = (changeCounter + 1) % 1000;
  return Date.now() * 1000 + changeCounter;
}

function hasPendingChanges(state) {
  return Object.keys(state.dirty).length > 0 || state.historyDirty > 0;
}

function remoteKeyFor(config) {
  return `${config.url}|${config.username}`;
}

export function describeDevice() {
  const ua = String(globalThis.navigator?.userAgent || "");
  const browser = /Firefox\//.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Linux/.test(ua)
          ? "Linux"
          : "";
  return os ? `${browser} on ${os}` : browser;
}

// ── WebDAV requests ─────────────────────────────────────────────────────────

function basicAuthHeader(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `Basic ${btoa(binary)}`;
}

async function hasServerPermission(url) {
  try {
    return await chrome.permissions.contains({
      origins: [webdavPermissionPattern(url)],
    });
  } catch {
    return false;
  }
}

// Busy answers worth retrying right away: 423 Locked (Nextcloud locks a file
// while it is being written, e.g. by another browser syncing at the same
// moment) and 503 Service Unavailable. 429 Too Many Requests is not retried:
// servers like Koofr use it to lock an account after wrong passwords, and
// more attempts only make that worse.
const BUSY_STATUSES = new Set([423, 503]);
const RATE_LIMIT_PAUSE_MS = 10 * 60_000;
const RATE_LIMIT_PAUSE_MIN_MS = 60_000;
const RATE_LIMIT_PAUSE_MAX_MS = 60 * 60_000;
// About 10 s in total: long enough for another browser's upload to finish.
const BUSY_RETRY_DELAYS_MS = [700, 1500, 3000, 5000];
const MAX_RETRY_AFTER_MS = 10_000;

function busyRetryDelay(res, attempt) {
  const seconds = Number(res.headers.get("Retry-After"));
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  return BUSY_RETRY_DELAYS_MS[attempt];
}

async function davFetchOnce(config, method, url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      headers: {
        Authorization: basicAuthHeader(config.username, config.password),
        ...headers,
      },
      body,
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err) {
    throw new CloudSyncError(err?.name === "AbortError" ? "timeout" : "network", {
      detail: err?.message || "",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function davFetch(config, method, url, { headers = {}, body } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await davFetchOnce(config, method, url, headers, body);
    if (res.status === 429) {
      await res.text().catch(() => {});
      const seconds = Number(res.headers.get("Retry-After"));
      throw new CloudSyncError("rate_limited", {
        status: 429,
        retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0,
      });
    }
    if (!BUSY_STATUSES.has(res.status) || attempt >= BUSY_RETRY_DELAYS_MS.length) {
      return res;
    }
    await res.text().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, busyRetryDelay(res, attempt)));
  }
}

function errorForStatus(status) {
  if (status === 429) return "rate_limited";
  if (BUSY_STATUSES.has(status)) return "busy";
  if (status === 401) return "auth_failed";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 409) return "not_found";
  if (status === 405 || status === 501) return "not_webdav";
  if (status >= 500) return "server_error";
  return "unknown";
}

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/></d:prop></d:propfind>';

function propfind(config, url) {
  return davFetch(config, "PROPFIND", url, {
    headers: { Depth: "0", "Content-Type": "application/xml; charset=utf-8" },
    body: PROPFIND_BODY,
  });
}

// Apache's mod_deflate appends -gzip (or -br) to the ETag of compressed
// responses but compares If-Match against the original tag, so the suffix is
// stripped. Browsers always ask for compressed responses.
function normalizeEtag(raw) {
  return String(raw || "")
    .trim()
    .replace(/-(gzip|br|deflate|zstd)"$/i, '"');
}

function isWeakEtag(etag) {
  return /^W\//i.test(etag);
}

// Servers write the folder marker differently: <d:collection/>, <D:collection>
// </D:collection>, or with attributes like <D:collection xmlns:D="DAV:"/>
// (Koofr).
function isCollectionResponse(xml) {
  return /<(?:[\w.-]+:)?collection\b[^>]*>/i.test(xml);
}

function etagFromPropfind(xml) {
  const match = String(xml).match(/<(?:[a-z0-9]+:)?getetag>\s*([^<]+?)\s*<\//i);
  return match ? normalizeEtag(match[1].replace(/&quot;/g, '"')) : "";
}

async function ensureConfigReady(config) {
  if (config.urlError) throw new CloudSyncError(config.urlError);
  if (!config.username || !config.password) throw new CloudSyncError("no_credentials");
  if (!(await hasServerPermission(config.url))) throw new CloudSyncError("needs_permission");
}

// Creates the nyaa-enhancer folder if it isn't there yet.
async function ensureSyncFolder(config) {
  const res = await davFetch(config, "MKCOL", cloudSyncFolderUrl(config.url));
  // 201: created, 405: already exists.
  if (res.ok || res.status === 405) return;
  throw new CloudSyncError(errorForStatus(res.status), { status: res.status });
}

function errorResult(err) {
  const code = err instanceof CloudSyncError ? err.code : "unknown";
  if (!(err instanceof CloudSyncError)) {
    console.error("[Nyaa Enhancer] Cloud sync error:", err);
  }
  return {
    ok: false,
    code,
    status: err?.status || 0,
    message: cloudSyncErrorMessage(code),
  };
}

// ── Test connection ─────────────────────────────────────────────────────────

// Checks the address, login and write access, and reports what is already
// stored in the cloud. Overrides let the popup test values it hasn't saved.
export async function testCloudSyncConnection(overrides = {}) {
  const config = await getCloudSyncConfig(overrides);
  try {
    await ensureConfigReady(config);

    const res = await propfind(config, `${config.url}/`);
    if (res.status !== 207) {
      throw new CloudSyncError(
        res.ok ? "not_webdav" : errorForStatus(res.status),
        { status: res.status },
      );
    }
    const looksLikeFolder = isCollectionResponse(await res.text());

    // Creating the sync folder inside the address is the real test: it only
    // fails with 404/409 when the address isn't a folder. The marker check
    // above is just a hint, since servers format it differently.
    try {
      await ensureSyncFolder(config);
    } catch (err) {
      if (!looksLikeFolder && (err.status === 404 || err.status === 409)) {
        throw new CloudSyncError("not_folder", { status: err.status });
      }
      throw err;
    }
    // Some servers (Koofr) answer "already exists" when asked to create a
    // folder inside a file, so without a marker, check the folder is there.
    if (!looksLikeFolder) {
      const check = await propfind(config, cloudSyncFolderUrl(config.url));
      await check.text().catch(() => "");
      if (check.status !== 207) {
        throw new CloudSyncError("not_folder", { status: check.status });
      }
    }

    const fileRes = await davFetch(config, "GET", cloudSyncFileUrl(config.url));
    let remote = null;
    if (fileRes.ok) {
      try {
        const doc = JSON.parse(await fileRes.text());
        remote = {
          updatedAt: Number(doc?.updatedAt) || 0,
          device: String(doc?.deviceName || ""),
          valid: doc?.format === PREFS_EXPORT_FORMAT,
        };
      } catch {
        remote = { updatedAt: 0, device: "", valid: false };
      }
    } else if (fileRes.status !== 404) {
      throw new CloudSyncError(errorForStatus(fileRes.status), { status: fileRes.status });
    }
    // A working connection should also clear an old error in the status.
    const saved = await getCloudSyncConfig();
    if (saved.enabled && saved.url === config.url) requestSync();
    return { ok: true, url: config.url, remote };
  } catch (err) {
    return errorResult(err);
  }
}

// ── Change tracking ─────────────────────────────────────────────────────────

// Values written while applying the cloud copy, so their change events don't
// get counted as local edits and uploaded straight back. Matching on the value
// (not just the key) keeps a real edit made right afterwards.
const expectedWrites = new Map();

function expectWrites(items) {
  const until = Date.now() + SUPPRESS_WINDOW_MS;
  Object.entries(items).forEach(([key, value]) => {
    expectedWrites.set(key, { json: JSON.stringify(value), until });
  });
}

function isExpectedWrite(key, change) {
  const expected = expectedWrites.get(key);
  if (!expected) return false;
  expectedWrites.delete(key);
  return Date.now() <= expected.until && JSON.stringify(change?.newValue) === expected.json;
}

function isSyncedKey(key, config) {
  if (SHARED_TOGGLE_KEYS.includes(key)) return true;
  if (key === HISTORY_STORAGE_KEY) return config.includeHistory;
  return isPortablePrefKey(key, { includeCredentials: config.includeCredentials });
}

async function handleStorageChanges(changes, area) {
  if (area !== "local" && area !== "sync") return;
  const keys = Object.keys(changes || {}).filter((key) => key !== CLOUD_SYNC_STATE_KEY);
  if (!keys.length) return;

  const config = await getCloudSyncConfig();
  const setupChanged = keys.some(
    (key) => CLOUD_SYNC_PREF_KEYS.includes(key) && !SHARED_TOGGLE_KEYS.includes(key),
  );
  if (setupChanged) await onSetupChanged(config, changes);
  if (!config.enabled) return;

  const changed = keys.filter(
    (key) => !isExpectedWrite(key, changes[key]) && isSyncedKey(key, config),
  );
  if (!changed.length) return;

  await updateCloudSyncState((state) => {
    changed.forEach((key) => {
      if (key === HISTORY_STORAGE_KEY) state.historyDirty = nextChangeStamp();
      else state.dirty[key] = nextChangeStamp();
    });
  });
  schedulePush(changed.every((key) => key === HISTORY_STORAGE_KEY));
}

// Changing how often to check needs no sync of its own.
const QUIET_SETUP_KEYS = new Set(["cloudSyncCheckMinutes"]);

async function onSetupChanged(config, changes) {
  const needsSync = Object.keys(changes).some(
    (key) =>
      CLOUD_SYNC_PREF_KEYS.includes(key) &&
      !SHARED_TOGGLE_KEYS.includes(key) &&
      !QUIET_SETUP_KEYS.has(key),
  );
  if (!needsSync) return;
  if (!config.enabled) {
    clearTimeout(pushTimer);
    clearTimeout(historyTimer);
    pushTimer = 0;
    historyTimer = 0;
    return;
  }

  // A changed login or address deserves a fresh attempt even while automatic
  // syncing is paused after a wrong password or a lockout.
  await updateCloudSyncState((state) => {
    state.lastError = null;
    state.pausedUntil = 0;
  });

  const turnedOn = changes.cloudSyncEnabled?.newValue === true;
  if (turnedOn) {
    // Turning sync on starts from the cloud copy: nothing on this device
    // counts as a newer edit yet. (A new address or login keeps pending
    // edits; the next sync re-reads the cloud copy before uploading them.)
    await updateCloudSyncState((state) => {
      state.dirty = {};
      state.historyDirty = 0;
      state.etag = "";
      state.lastError = null;
    });
  }
  requestSync();
}

let pushTimer = 0;
let historyTimer = 0;

function schedulePush(historyOnly) {
  if (historyOnly) {
    // Not restarted by later visits, so steady browsing still uploads.
    if (historyTimer) return;
    historyTimer = setTimeout(() => {
      historyTimer = 0;
      requestSync({ automatic: true });
    }, HISTORY_PUSH_DELAY_MS);
    return;
  }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = 0;
    requestSync({ automatic: true });
  }, PUSH_DELAY_MS);
}

// ── Pull / push ─────────────────────────────────────────────────────────────

function parseRemoteDocument(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new CloudSyncError("bad_file");
  }
  if (
    doc?.format !== PREFS_EXPORT_FORMAT ||
    !doc.settings ||
    typeof doc.settings !== "object" ||
    Array.isArray(doc.settings)
  ) {
    throw new CloudSyncError("bad_file");
  }
  if (!Number.isInteger(doc.version) || doc.version > PREFS_EXPORT_VERSION) {
    throw new CloudSyncError("newer_version");
  }
  return doc;
}

// Applies the cloud copy to this device. Keys edited here since the last
// upload keep their local value (they are uploaded next).
async function applyRemoteDocument(config, doc, { force = false } = {}) {
  const pending = force ? { dirty: {} } : await getCloudSyncState();
  const dirty = new Set(Object.keys(pending.dirty));
  const skipKeys = new Set([...dirty, ...KEEP_LOCAL_ON_PULL]);

  const toggles = {};
  if (!dirty.has("cloudSyncIncludeCredentials")) {
    toggles.cloudSyncIncludeCredentials = !!doc.includesCredentials;
  }
  if (!dirty.has("cloudSyncIncludeHistory")) {
    toggles.cloudSyncIncludeHistory = !!doc.history;
  }
  const includeCredentials = toggles.cloudSyncIncludeCredentials ?? config.includeCredentials;
  const includeHistory = toggles.cloudSyncIncludeHistory ?? config.includeHistory;

  expectWrites(toggles);
  await savePreferencesAsync(toggles);
  await importPreferences(doc.settings, {
    includeCredentials: includeCredentials && !!doc.includesCredentials,
    skipKeys,
    beforeSave: expectWrites,
  });

  let historyNeedsUpload = false;
  if (includeHistory && doc.history) {
    const prefs = await loadStoredPreferences();
    const merged = await mergeHistoryState(doc.history, prefs.historyMaxEvents, {
      beforeWrite: (state) => expectWrites({ [HISTORY_STORAGE_KEY]: state }),
    });
    // Entries only this device has still need uploading. (A smaller history
    // cap here just trims; that alone doesn't make it upload.)
    historyNeedsUpload = merged.localOnly > 0;
  }
  return { historyNeedsUpload };
}

// Some servers (Koofr) can hand out a half-written file while another
// browser is uploading it, so an unreadable copy is read again before it
// counts as broken.
const UNREADABLE_RETRY_DELAYS_MS = [1000, 2000];

async function pullRemote(config, run, { force = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pullRemoteOnce(config, run, { force, fresh: attempt > 0 });
    } catch (err) {
      if (err?.code !== "bad_file" || attempt >= UNREADABLE_RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, UNREADABLE_RETRY_DELAYS_MS[attempt]));
    }
  }
}

// fresh: ignore the cached version (a re-read), without force's meaning of
// "discard this browser's pending edits".
async function pullRemoteOnce(config, run, { force = false, fresh = false } = {}) {
  const fileUrl = cloudSyncFileUrl(config.url);
  const headers = run.etag && !force && !fresh ? { "If-None-Match": run.etag } : {};
  const res = await davFetch(config, "GET", fileUrl, { headers });
  run.lastPullAt = Date.now();

  if (res.status === 304) return { changed: false, notModified: true };
  if (res.status === 404) {
    run.etag = "";
    run.remoteRevision = "";
    return { changed: false, missing: true };
  }
  if (!res.ok) {
    throw new CloudSyncError(errorForStatus(res.status), { status: res.status });
  }
  // Some servers answer 200 instead of 304 (for example when they add -gzip
  // to the tag); an unchanged tag still means nothing new to apply.
  const responseEtag = normalizeEtag(res.headers.get("ETag"));
  if (!force && !fresh && responseEtag && responseEtag === run.etag) {
    return { changed: false, notModified: true };
  }

  const doc = parseRemoteDocument(await res.text());
  run.remoteRevision = String(doc.revision || "");
  run.lastRemoteUpdatedAt = Number(doc.updatedAt) || 0;
  run.lastRemoteDevice = String(doc.deviceName || "");

  const ownUpload =
    !force &&
    doc.deviceId === run.deviceId &&
    !!doc.revision &&
    doc.revision === run.lastPushedRevision;
  let historyNeedsUpload = false;
  if (!ownUpload) {
    ({ historyNeedsUpload } = await applyRemoteDocument(config, doc, { force }));
  }
  run.etag = responseEtag;
  return { changed: !ownUpload, historyNeedsUpload };
}

async function buildDocument(run) {
  const config = await getCloudSyncConfig();
  const doc = {
    format: PREFS_EXPORT_FORMAT,
    version: PREFS_EXPORT_VERSION,
    extensionVersion: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    includesCredentials: config.includeCredentials,
    settings: await exportPreferences({ includeCredentials: config.includeCredentials }),
    deviceId: run.deviceId,
    deviceName: describeDevice(),
    updatedAt: Date.now(),
    revision: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    // The cloud version this upload was built on, so other browsers can tell
    // whether it already contains their last upload.
    baseRevision: run.remoteRevision || "",
  };
  if (config.includeHistory) doc.history = await loadHistoryState();
  return doc;
}

async function fetchRemoteEtag(config) {
  const res = await propfind(config, cloudSyncFileUrl(config.url));
  if (res.status !== 207) return "";
  return etagFromPropfind(await res.text());
}

// Whether the cloud copy is still the given version. A conditional GET is
// cheap (304); servers that answer 200 anyway are compared by ETag, then by
// the revision stored in the file.
async function cloudCopyIs(config, etag, revision) {
  const headers = etag ? { "If-None-Match": etag } : {};
  const res = await davFetch(config, "GET", cloudSyncFileUrl(config.url), { headers });
  if (res.status === 304) return true;
  const text = await res.text().catch(() => "");
  if (res.status === 404) return !etag && !revision;
  if (!res.ok) throw new CloudSyncError(errorForStatus(res.status), { status: res.status });
  if (etag && normalizeEtag(res.headers.get("ETag")) === etag) return true;
  try {
    return !!revision && JSON.parse(text)?.revision === revision;
  } catch {
    return false;
  }
}

// Asks the server to replace a check file only if it has a version that
// can't exist. Servers that honour If-Match refuse (412); servers that
// don't (Koofr, for one) write it anyway, and the file is removed again.
async function serverHonoursIfMatch(config) {
  const url = `${cloudSyncFolderUrl(config.url)}${WRITE_CHECK_FILE}`;
  const res = await davFetch(config, "PUT", url, {
    headers: { "If-Match": '"nyaa-enhancer-write-check"', "Content-Type": "text/plain" },
    body: "Nyaa Enhancer write check",
  });
  await res.text().catch(() => "");
  if (res.status === 412) return true;
  if (res.ok) {
    const cleanup = await davFetch(config, "DELETE", url).catch(() => null);
    await cleanup?.text().catch(() => "");
  }
  return false;
}

// On servers without If-Match: waits briefly, then checks that the cloud
// copy is still ours, or was written by a browser that had already seen ours
// (then its changes are intentional). Otherwise ours was overwritten.
async function confirmUploadKept(config, etag, revision) {
  await new Promise((resolve) => setTimeout(resolve, CONFIRM_DELAY_MS));
  const headers = etag ? { "If-None-Match": etag } : {};
  const res = await davFetch(config, "GET", cloudSyncFileUrl(config.url), { headers });
  if (res.status === 304) return true;
  const text = await res.text().catch(() => "");
  if (!res.ok) return res.status !== 404;
  if (etag && normalizeEtag(res.headers.get("ETag")) === etag) return true;
  try {
    const doc = JSON.parse(text);
    return doc?.revision === revision || doc?.baseRevision === revision;
  } catch {
    return false;
  }
}

// Uploads this device's settings. Returns false when another device changed
// the cloud copy first (the caller pulls and tries again).
//
// Some servers (Koofr, for one) ignore If-Match, so the cloud copy is also
// checked right before the upload and again right after it. If another
// browser saved in between, this upload's edits stay pending and get merged
// and uploaded again instead of being lost.
async function pushLocal(config, run, { overwrite = false } = {}) {
  if (!overwrite && !(await cloudCopyIs(config, run.etag, run.remoteRevision))) {
    return false;
  }

  // Snapshot the pending edits before reading the values that get uploaded.
  const pending = await getCloudSyncState();
  const sentDirty = { ...pending.dirty };
  const sentHistory = pending.historyDirty;
  const doc = await buildDocument(run);
  const body = JSON.stringify(doc);
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  // Weak ETags can't be used with If-Match, and some servers reject a tag
  // they just handed out; those fall back to a plain upload.
  if (!overwrite && !run.ifMatchBroken) {
    if (run.etag && !isWeakEtag(run.etag)) headers["If-Match"] = run.etag;
    else if (!run.etag) headers["If-None-Match"] = "*";
  }

  const fileUrl = cloudSyncFileUrl(config.url);
  let res = await davFetch(config, "PUT", fileUrl, { headers, body });
  if (res.status === 404 || res.status === 409) {
    await ensureSyncFolder(config);
    res = await davFetch(config, "PUT", fileUrl, { headers, body });
  }
  if (res.status === 412) return false;
  if (!res.ok) {
    throw new CloudSyncError(errorForStatus(res.status), { status: res.status });
  }

  run.etag = normalizeEtag(res.headers.get("ETag")) || (await fetchRemoteEtag(config));
  run.remoteRevision = doc.revision;
  if (!overwrite && !(await cloudCopyIs(config, run.etag, doc.revision))) {
    return false;
  }
  if (!overwrite && run.writeCheck?.conditional === false) {
    if (!(await confirmUploadKept(config, run.etag, doc.revision))) return false;
  }
  run.lastPushedRevision = doc.revision;
  run.lastPushAt = Date.now();
  run.lastRemoteUpdatedAt = doc.updatedAt;
  run.lastRemoteDevice = doc.deviceName;
  run.sentDirty = { ...run.sentDirty, ...sentDirty };
  run.sentHistory = Math.max(run.sentHistory, sentHistory);
  return true;
}

const RUN_FIELDS = [
  "remoteKey",
  "etag",
  "lastPushAt",
  "lastPullAt",
  "lastSyncAt",
  "lastPushedRevision",
  "lastRemoteUpdatedAt",
  "lastRemoteDevice",
  "lastError",
  "pausedUntil",
  "writeCheck",
];

// Writes a finished run back. Only edits that were uploaded unchanged are
// cleared; an edit made again after the snapshot keeps its newer stamp.
function commitRun(run) {
  return updateCloudSyncState((state) => {
    RUN_FIELDS.forEach((field) => {
      if (field in run) state[field] = run[field];
    });
    if (run.clearPending) {
      state.dirty = {};
      state.historyDirty = 0;
    }
    Object.entries(run.sentDirty).forEach(([key, stamp]) => {
      if (state.dirty[key] === stamp) delete state.dirty[key];
    });
    if (run.sentHistory && state.historyDirty === run.sentHistory) {
      state.historyDirty = 0;
    }
    if (run.historyNeedsUpload && !state.historyDirty) {
      state.historyDirty = nextChangeStamp();
    }
  });
}

// mode: "sync" (pull, then upload local edits), "upload" (replace the cloud
// copy with this device), "download" (replace this device with the cloud copy).
// Why automatic syncing is on hold, if it is: after a wrong password (until
// the login changes) or after "too many requests" (for a while). Sync now
// and Test connection still try.
function automaticSyncHold(state) {
  if (state.lastError?.code === "auth_failed") return "auth_failed";
  if (state.pausedUntil > Date.now()) return "rate_limited";
  return "";
}

async function runSync({ mode = "sync", automatic = false } = {}) {
  const config = await getCloudSyncConfig();
  if (!config.enabled) {
    return { ok: false, code: "disabled", message: cloudSyncErrorMessage("disabled") };
  }

  const start = await getCloudSyncState();
  const hold = automatic ? automaticSyncHold(start) : "";
  if (hold) {
    return { ok: false, code: hold, paused: true, message: cloudSyncErrorMessage(hold) };
  }
  const run = {
    deviceId: start.deviceId,
    remoteKey: start.remoteKey,
    etag: start.etag,
    lastPushedRevision: start.lastPushedRevision,
    writeCheck: start.writeCheck,
    sentDirty: {},
    sentHistory: 0,
    historyNeedsUpload: false,
  };
  try {
    await ensureConfigReady(config);
    const remoteKey = remoteKeyFor(config);
    if (run.remoteKey !== remoteKey) {
      run.remoteKey = remoteKey;
      run.etag = "";
    }
    if (mode !== "download" && run.writeCheck?.key !== remoteKey) {
      await ensureSyncFolder(config);
      run.writeCheck = { key: remoteKey, conditional: await serverHonoursIfMatch(config) };
    }

    let pulled = false;
    let pushed = false;
    if (mode === "upload") {
      await ensureSyncFolder(config);
      pushed = await pushLocal(config, run, { overwrite: true });
    } else if (mode === "download") {
      const result = await pullRemote(config, run, { force: true });
      if (result.missing) throw new CloudSyncError("not_found");
      run.clearPending = true;
      pulled = true;
    } else {
      for (let attempt = 1; ; attempt++) {
        const result = await pullRemote(config, run);
        pulled = pulled || result.changed;
        // After a 412 the server says (304) that the very tag it rejected is
        // current: its If-Match handling is broken, so upload without it.
        if (result.notModified && run.rejectedEtag && run.rejectedEtag === run.etag) {
          run.ifMatchBroken = true;
        }
        run.historyNeedsUpload = run.historyNeedsUpload || result.historyNeedsUpload;
        const pending = await getCloudSyncState();
        if (!result.missing && !hasPendingChanges(pending) && !run.historyNeedsUpload) {
          break;
        }
        pushed = await pushLocal(config, run);
        if (pushed) {
          run.historyNeedsUpload = false;
          break;
        }
        // Another device saved first: re-read its copy and merge again.
        run.rejectedEtag = run.etag;
        if (attempt >= MAX_PUSH_ATTEMPTS) throw new CloudSyncError("conflict");
      }
    }

    run.lastSyncAt = Date.now();
    run.lastError = null;
    run.pausedUntil = 0;
    await commitRun(run);
    return { ok: true, pulled, pushed };
  } catch (err) {
    const result = errorResult(err);
    run.lastError = { code: result.code, message: result.message, at: Date.now() };
    if (result.code === "rate_limited") {
      run.pausedUntil =
        Date.now() +
        Math.min(
          RATE_LIMIT_PAUSE_MAX_MS,
          Math.max(RATE_LIMIT_PAUSE_MIN_MS, err?.retryAfterMs || RATE_LIMIT_PAUSE_MS),
        );
    }
    await commitRun(run);
    return result;
  }
}

let syncChain = Promise.resolve();
let queuedSync = null;

// Queues a sync; requests that arrive while one is waiting share that run.
// automatic: started by the extension itself (not by the user), so it
// respects a pause after a wrong password or a lockout.
export function requestSync({ mode = "sync", automatic = false } = {}) {
  if (mode === "sync" && queuedSync) {
    if (!automatic) queuedSync.automatic = false;
    return queuedSync.promise;
  }
  const entry = { automatic, promise: null };
  entry.promise = syncChain.then(() => {
    if (mode === "sync" && queuedSync === entry) queuedSync = null;
    return runSync({ mode, automatic: entry.automatic });
  });
  if (mode === "sync") queuedSync = entry;
  syncChain = entry.promise.catch(() => {});
  return entry.promise;
}

// Syncs when there are edits to upload, or when the last check is older
// than minGapMs ("check" uses the user's interval setting).
async function syncIfStale(minGapMs = "check") {
  const config = await getCloudSyncConfig();
  if (!config.enabled) return null;
  const gap = minGapMs === "check" ? cloudSyncCheckGapMs(config.checkMinutes) : minGapMs;
  const state = await getCloudSyncState();
  if (!hasPendingChanges(state) && Date.now() - state.lastPullAt < gap) return null;
  return requestSync({ automatic: true });
}

export async function getCloudSyncStatus() {
  const config = await getCloudSyncConfig();
  const state = await getCloudSyncState();
  return {
    enabled: config.enabled,
    url: config.url,
    urlError: config.urlError,
    hasCredentials: !!(config.username && config.password),
    username: config.username,
    hasPermission: config.url ? await hasServerPermission(config.url) : false,
    includeCredentials: config.includeCredentials,
    includeHistory: config.includeHistory,
    checkMinutes: config.checkMinutes,
    pending: Object.keys(state.dirty).length + (state.historyDirty ? 1 : 0),
    lastSyncAt: state.lastSyncAt,
    lastPushAt: state.lastPushAt,
    lastPullAt: state.lastPullAt,
    lastRemoteUpdatedAt: state.lastRemoteUpdatedAt,
    lastRemoteDevice: state.lastRemoteDevice,
    lastError: state.lastError,
    pausedUntil: state.pausedUntil,
    deviceName: describeDevice(),
  };
}

// ── Wiring ──────────────────────────────────────────────────────────────────

function pickStrings(entries) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => typeof value === "string"),
  );
}

const MESSAGE_HANDLERS = {
  cloudSyncTest: (message) =>
    testCloudSyncConnection(
      pickStrings({
        cloudSyncUrl: message.url,
        webdavUsername: message.username,
        webdavPassword: message.password,
      }),
    ),
  cloudSyncNow: () => requestSync(),
  cloudSyncUpload: () => requestSync({ mode: "upload" }),
  cloudSyncDownload: () => requestSync({ mode: "download" }),
  cloudSyncStatus: () => getCloudSyncStatus(),
  cloudSyncWake: async (message) => {
    if (message.source === "page") {
      // Nyaa pages don't need the status; don't make them wait for a sync.
      syncIfStale("check").catch(() => {});
      return { ok: true };
    }
    await syncIfStale(SETTINGS_WAKE_MIN_GAP_MS);
    return getCloudSyncStatus();
  },
};

export function handleCloudSyncMessage(message) {
  const handler = MESSAGE_HANDLERS[message?.type];
  if (!handler) return undefined;
  return Promise.resolve(handler(message)).catch((err) => errorResult(err));
}

export function initCloudSync() {
  chrome.storage.onChanged.addListener((changes, area) => {
    handleStorageChanges(changes, area).catch((err) => {
      console.error("[Nyaa Enhancer] Cloud sync change handling failed:", err);
    });
  });

  chrome.runtime.onMessage.addListener((message) => handleCloudSyncMessage(message));

  chrome.runtime.onStartup?.addListener(() => {
    syncIfStale("check");
  });

  // The background wakes up often; only sync here when there are unsent
  // edits or the last check was a while ago.
  syncIfStale("check").catch(() => {});
}
