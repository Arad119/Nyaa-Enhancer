import { normalizeCloudSyncCheckMinutes, validateWebdavUrl } from "./webdav.js";

// Secrets and large lists stay in browser.storage.local (no 8KB/item sync quota,
// and credentials are not uploaded to the user's browser account).
// Booleans/toggles remain in browser.storage.sync so they follow the user.
export const LOCAL_PREF_KEYS = new Set([
  "ameNZBApiKey",
  "tmdbApiKey",
  "torrentClientUrl",
  "qbtUsername",
  "qbtPassword",
  "transmissionUsername",
  "transmissionPassword",
  "delugePassword",
  "keywords",
  "blockKeywords",
  "requireKeywords",
  "filterPresets",
  "highlightKeywords",
  "monitoredUsers",
  "monitoredKeywords",
  "qbtCategories",
  "qbtTags",
  "qbtDefaultCategory",
  "qbtDefaultTags",
  "qbtLastCategory",
  "qbtLastTags",
  "quickSearchState",
  "quickSearchPresets",
  "ameNZBRequestCount",
  "ameNZBRequestDate",
  "lastNyaaOrigin",
  "showMoreAutoEnabled",
  "showMoreUntilVisible",
  "showMoreAutoDelayMs",
  "cloudSyncEnabled",
  "cloudSyncUrl",
  "cloudSyncIncludeCredentials",
  "cloudSyncIncludeHistory",
  "webdavUsername",
  "webdavPassword",
  "cloudSyncCheckMinutes",
]);

export const PREF_DEFAULTS = {
  useDisplayName: true,
  useZip: true,
  showButtons: true,
  showATLinks: true,
  showATComments: false,
  showATScreenshotsSection: true,
  showATFileInfoSection: true,
  showATAttachmentsSection: true,
  ameNZBApiKey: "",
  tmdbApiKey: "",
  showAmeNZBLinks: false,
  showAmeNZBSection: false,
  ameNZBRequestCount: 0,
  ameNZBRequestDate: "",
  showNekoBTLinks: false,
  showNekoBTSection: false,
  showNekoBTFullLangNames: true,
  showTsukihimeLinks: false,
  showTsukihimeSection: false,
  showSimilarSection: true,
  similarUseTmdbRecs: false,
  similarOpenAccordions: false,
  similarCardDetailsEnabled: true,
  similarOpenQuickSearch: false,
  similarVibeGenreWeight: 34,
  similarVibeTagWeight: 33,
  similarVibeStudioWeight: 33,
  showSeaDex: false,
  highlightKeywords: [],
  prioritizeSeaDexHighlights: true,
  screenshotPreviewEnabled: false,
  screenshotPreviewHoverDelay: 3,
  screenshotPreviewSlideDelay: 3,
  showMagnetButtons: true,
  showSendButtons: true,
  showQuickFilter: true,
  showMonitorButtons: true,
  showScrollToTop: true,
  hideDeadTorrents: false,
  minSeedersFilterEnabled: false,
  minSeedersFilterValue: 5,
  keywords: [],
  keywordFilterEnabled: false,
  keywordFilterMode: "block",
  keywordFilterMigrated: false,
  blockKeywords: [],
  requireKeywords: [],
  blockKeywordsFilterEnabled: false,
  requireKeywordsFilterEnabled: false,
  filterPresets: [],
  quickSearchPresets: [],
  quickSearchAnimeProvider: "tenrai",
  showMoreAutoEnabled: false,
  showMoreUntilVisible: 150,
  showMoreAutoDelayMs: 2500,
  showFiltersPanel: true,
  showAutoLoad: true,
  showFilterNotifications: true,
  hideComments: false,
  improvedFileList: true,
  copyTorrentTitle: true,
  copyTorrentInfoHash: true,
  fileSizeFilterEnabled: false,
  fileSizeMinBytes: 500 * 1024 * 1024,
  fileSizeMaxBytes: 4 * 1024 * 1024 * 1024,
  fileSizeRange: "less_than_1gb",
  completedDownloadsFilterEnabled: false,
  completedDownloadsFilterOperator: "gt",
  completedDownloadsFilterValue: 0,
  uploadDateFilterEnabled: false,
  uploadDateFilterRange: "month",
  uploadDateFilterFrom: "",
  uploadDateFilterTo: "",
  historyHideFilterEnabled: false,
  historyHideActions: ["visit", "download", "save", "send"],
  categoryFilterEnabled: false,
  categoryFilterNyaa: [],
  categoryFilterSukebei: [],
  historyEnabled: false,
  historyMaxEvents: 400,
  showChangelogNav: true,
  showNavbarUpload: true,
  showNavbarInfo: true,
  showNavbarRss: true,
  showNavbarTwitter: true,
  showNavbarFap: true,
  showNavbarFilter: true,
  showNavbarCategory: true,
  showNavbarAccount: true,
  monitoredUsers: [],
  monitoredKeywords: [],
  torrentClient: "qbittorrent",
  torrentClientUrl: "",
  qbtUsername: "",
  qbtPassword: "",
  transmissionUsername: "",
  transmissionPassword: "",
  delugePassword: "",
  qbtCategories: [],
  qbtTags: [],
  qbtDefaultCategory: "",
  qbtDefaultTags: [],
  qbtPromptOnSend: true,
  qbtLastCategory: null,
  qbtLastTags: null,
  lastNyaaOrigin: "",
  cloudSyncEnabled: false,
  cloudSyncUrl: "",
  cloudSyncIncludeCredentials: false,
  cloudSyncIncludeHistory: false,
  webdavUsername: "",
  webdavPassword: "",
  cloudSyncCheckMinutes: 5,
};

let saveErrorHandler = null;

export function setPrefsSaveErrorHandler(handler) {
  saveErrorHandler = handler;
}

export function registerFeaturePrefs({ defaults = {}, localKeys = [] } = {}) {
  Object.assign(PREF_DEFAULTS, defaults);
  for (const key of localKeys) LOCAL_PREF_KEYS.add(key);
}

function notifyStorageSaveError(area, err) {
  if (isExtensionContextInvalidated(err)) return;
  const message = err?.message || String(err);
  console.error(`Nyaa Enhancer: failed to save to storage.${area}:`, message);
  saveErrorHandler?.(message);
}

function isExtensionContextInvalidated(err) {
  const message = err?.message || String(err || "");
  return /extension context invalidated/i.test(message);
}

function getRuntimeLastError() {
  try {
    return browser.runtime?.lastError || null;
  } catch (err) {
    return err;
  }
}

function toStorageError(err) {
  return err instanceof Error ? err : new Error(err?.message || String(err));
}

function callStorageArea(area, method, payload, fallback) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishOk = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const finishInvalid = () => finishOk(fallback);
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(toStorageError(err));
    };

    const handleFailure = (err) => {
      if (settled) return;
      if (isExtensionContextInvalidated(err)) {
        if (method === "set" || method === "remove") fail(err);
        else finishInvalid();
        return;
      }
      if (method === "set") notifyStorageSaveError(area, err);
      else {
        console.error(
          `Nyaa Enhancer: failed to ${method} storage.${area}:`,
          err?.message || err,
        );
      }
      fail(err);
    };

    try {
      const api = browser?.storage?.[area];
      if (typeof api?.[method] !== "function") {
        if (method === "set" || method === "remove") {
          fail(new Error("Extension storage is unavailable."));
          return;
        }
        finishInvalid();
        return;
      }

      let maybePromise;
      try {
        maybePromise = api[method](payload, (result) => {
          try {
            const err = getRuntimeLastError();
            if (!err) {
              finishOk(method === "get" ? result || {} : undefined);
              return;
            }
            handleFailure(err);
          } catch (err) {
            handleFailure(err);
          }
        });
      } catch (err) {
        handleFailure(err);
        return;
      }

      // Firefox returns a Promise even when a callback is passed. After a reload
      // that Promise rejects with "Extension context invalidated" and is
      // otherwise uncaught, even if lastError is handled in the callback.
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(handleFailure);
      }
    } catch (err) {
      handleFailure(err);
    }
  });
}

function areaGet(area, query) {
  const empty =
    query == null ||
    (Array.isArray(query) && query.length === 0) ||
    (!Array.isArray(query) && Object.keys(query).length === 0);
  if (empty) return Promise.resolve({});
  return callStorageArea(area, "get", query, {});
}

function areaSet(area, items) {
  if (!items || !Object.keys(items).length) return Promise.resolve();
  return callStorageArea(area, "set", items, undefined);
}

function areaRemove(area, keys) {
  if (!keys?.length) return Promise.resolve();
  return callStorageArea(area, "remove", keys, undefined);
}

function splitPrefPayload(items) {
  const localItems = {};
  const syncItems = {};
  for (const [key, value] of Object.entries(items || {})) {
    if (LOCAL_PREF_KEYS.has(key)) localItems[key] = value;
    else syncItems[key] = value;
  }
  return { localItems, syncItems };
}

function splitPrefQuery(keysOrDefaults) {
  const isArray = Array.isArray(keysOrDefaults);
  const keys = isArray ? keysOrDefaults : Object.keys(keysOrDefaults || {});
  if (isArray) {
    return {
      isArray: true,
      localQuery: keys.filter((key) => LOCAL_PREF_KEYS.has(key)),
      syncQuery: keys.filter((key) => !LOCAL_PREF_KEYS.has(key)),
    };
  }
  const localQuery = {};
  const syncQuery = {};
  for (const key of keys) {
    if (LOCAL_PREF_KEYS.has(key)) localQuery[key] = keysOrDefaults[key];
    else syncQuery[key] = keysOrDefaults[key];
  }
  return { isArray: false, localQuery, syncQuery };
}

let localPrefMigrationPromise = null;

function migrateLocalKeysFromSync() {
  if (localPrefMigrationPromise) return localPrefMigrationPromise;
  localPrefMigrationPromise = (async () => {
    try {
      const { __neLocalMigrated: migrated } = await areaGet("local", {
        __neLocalMigrated: false,
      });
      if (migrated) return;

      const syncItems = await areaGet("sync", [...LOCAL_PREF_KEYS]);
      const toLocal = {};
      const toRemove = [];
      for (const key of LOCAL_PREF_KEYS) {
        if (Object.prototype.hasOwnProperty.call(syncItems, key)) {
          toLocal[key] = syncItems[key];
          toRemove.push(key);
        }
      }
      if (toRemove.length) {
        await areaSet("local", toLocal);
        await areaRemove("sync", toRemove);
      }
      await areaSet("local", { __neLocalMigrated: true });
    } catch (err) {
      console.error("Nyaa Enhancer: storage migration failed:", err);
      localPrefMigrationPromise = null;
    }
  })();
  return localPrefMigrationPromise;
}

let showMoreLocalMigrationPromise = null;

function migrateShowMorePrefsToLocal() {
  if (showMoreLocalMigrationPromise) return showMoreLocalMigrationPromise;
  showMoreLocalMigrationPromise = (async () => {
    try {
      const local = await areaGet("local", [
        "__neShowMoreLocal",
        "showMoreUntilVisible",
        "showMoreAutoEnabled",
      ]);
      if (local.__neShowMoreLocal) return;
      const syncItems = await areaGet("sync", [
        "showMoreUntilVisible",
        "showMoreAutoEnabled",
      ]);
      const toLocal = { __neShowMoreLocal: true };
      const toRemove = [];
      for (const key of ["showMoreUntilVisible", "showMoreAutoEnabled"]) {
        if (
          Object.prototype.hasOwnProperty.call(syncItems, key) &&
          local[key] === undefined
        ) {
          toLocal[key] = syncItems[key];
          toRemove.push(key);
        }
      }
      await areaSet("local", toLocal);
      if (toRemove.length) await areaRemove("sync", toRemove);
    } catch (err) {
      console.error("Nyaa Enhancer: show-more storage migration failed:", err);
      showMoreLocalMigrationPromise = null;
    }
  })();
  return showMoreLocalMigrationPromise;
}

export async function getPreferencesAsync(keysOrDefaults) {
  try {
    await migrateLocalKeysFromSync();
    await migrateShowMorePrefsToLocal();
    const { localQuery, syncQuery } = splitPrefQuery(keysOrDefaults);
    const [syncItems, localItems] = await Promise.all([
      areaGet("sync", syncQuery).catch(() =>
        Array.isArray(syncQuery) ? {} : syncQuery,
      ),
      areaGet("local", localQuery).catch(() =>
        Array.isArray(localQuery) ? {} : localQuery,
      ),
    ]);
    return { ...syncItems, ...localItems };
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      return Array.isArray(keysOrDefaults) ? {} : { ...(keysOrDefaults || {}) };
    }
    throw err;
  }
}

export async function savePreferencesAsync(items) {
  await migrateLocalKeysFromSync();
  await migrateShowMorePrefsToLocal();
  const { localItems, syncItems } = splitPrefPayload(items);
  await Promise.all([areaSet("sync", syncItems), areaSet("local", localItems)]);
}

export function getPreferences(keysOrDefaults, callback) {
  const promise = getPreferencesAsync(keysOrDefaults);
  if (typeof callback === "function") {
    promise.then(callback, () => {
      const fallback =
        keysOrDefaults &&
        typeof keysOrDefaults === "object" &&
        !Array.isArray(keysOrDefaults)
          ? keysOrDefaults
          : {};
      callback(fallback);
    });
    return;
  }
  return promise;
}

export function savePreferences(items, callback) {
  const promise = savePreferencesAsync(items);
  if (typeof callback === "function") {
    promise.then(() => callback(), () => {});
  } else {
    promise.catch(() => {});
  }
  return promise;
}

function migrateLegacyKeywordFilter(prefs) {
  if (prefs.keywordFilterMigrated) return null;

  const keywords = Array.isArray(prefs.keywords) ? prefs.keywords : [];
  const blockKeywords = Array.isArray(prefs.blockKeywords)
    ? prefs.blockKeywords
    : [];
  const requireKeywords = Array.isArray(prefs.requireKeywords)
    ? prefs.requireKeywords
    : [];
  const hasNewLists = blockKeywords.length > 0 || requireKeywords.length > 0;

  const payload = {
    keywordFilterMigrated: true,
    blockKeywords,
    requireKeywords,
    blockKeywordsFilterEnabled: !!prefs.blockKeywordsFilterEnabled,
    requireKeywordsFilterEnabled: !!prefs.requireKeywordsFilterEnabled,
  };

  if (!hasNewLists && keywords.length) {
    if (prefs.keywordFilterMode === "require") {
      payload.requireKeywords = keywords;
      payload.requireKeywordsFilterEnabled = !!prefs.keywordFilterEnabled;
    } else {
      payload.blockKeywords = keywords;
      payload.blockKeywordsFilterEnabled = !!prefs.keywordFilterEnabled;
    }
  } else if (
    !hasNewLists &&
    prefs.keywordFilterEnabled &&
    !payload.blockKeywordsFilterEnabled &&
    !payload.requireKeywordsFilterEnabled
  ) {
    if (prefs.keywordFilterMode === "require") {
      payload.requireKeywordsFilterEnabled = true;
    } else {
      payload.blockKeywordsFilterEnabled = true;
    }
  }

  return payload;
}

export async function loadStoredPreferences() {
  const prefs = await getPreferencesAsync(PREF_DEFAULTS);
  const migration = migrateLegacyKeywordFilter(prefs);
  if (!migration) return prefs;
  try {
    await savePreferencesAsync(migration);
  } catch (err) {
    if (!isExtensionContextInvalidated(err)) throw err;
  }
  return { ...prefs, ...migration };
}

export function savePreference(key, value) {
  return savePreferences({ [key]: value });
}

// ── Import / export / reset ────────────────────────────────────────────────

export const PREFS_EXPORT_FORMAT = "nyaa-enhancer-settings";
export const PREFS_EXPORT_VERSION = 1;

// Kept out of exports unless the user opts in: an export file holds them in
// plain text, and they are deliberately never written to browser sync.
export const CREDENTIAL_PREF_KEYS = new Set([
  "qbtPassword",
  "transmissionPassword",
  "delugePassword",
  "ameNZBApiKey",
  "tmdbApiKey",
  "webdavUsername",
  "webdavPassword",
]);

// Torrent client connection details. Exported normally, but kept on reset
// unless the user also asks to clear credentials.
const CONNECTION_PREF_KEYS = new Set([
  "torrentClient",
  "torrentClientUrl",
  "qbtUsername",
  "transmissionUsername",
]);

// Cloud sync setup is per device: it is never exported, synced, or reset by
// "Reset settings". The WebDAV login is the exception: it counts as a
// credential, so it travels only with "Include credentials" and is cleared
// only with "Also clear … API keys".
export const CLOUD_SYNC_PREF_KEYS = [
  "cloudSyncEnabled",
  "cloudSyncUrl",
  "cloudSyncIncludeCredentials",
  "cloudSyncIncludeHistory",
  "webdavUsername",
  "webdavPassword",
  "cloudSyncCheckMinutes",
];

// Runtime state and legacy keys that should not move between devices.
const NON_PORTABLE_PREF_KEYS = new Set([
  "ameNZBRequestCount",
  "ameNZBRequestDate",
  "lastNyaaOrigin",
  "keywordFilterMigrated",
  "keywords",
  "keywordFilterEnabled",
  "keywordFilterMode",
  ...CLOUD_SYNC_PREF_KEYS.filter((key) => !CREDENTIAL_PREF_KEYS.has(key)),
]);

// Stored settings that are read with inline defaults instead of PREF_DEFAULTS.
const EXTRA_PORTABLE_PREF_DEFAULTS = {
  changelogDismissed: false,
  quickSearchRememberSelection: true,
  // Quick Search's remembered form (when "Remember selection" is on).
  quickSearchState: {},
};

// Cloud Sync setup is included in manual backups (Export/Import) so a restore
// brings it back, but never in the cloud copy, which can't carry its own
// address. The on/off switch is left out on purpose: turning sync on adopts
// the cloud copy, which would replace the settings just restored.
const MANUAL_BACKUP_ONLY_DEFAULTS = {
  cloudSyncUrl: "",
  cloudSyncCheckMinutes: 5,
  cloudSyncIncludeCredentials: false,
  cloudSyncIncludeHistory: false,
};

function portablePrefDefaults() {
  const defaults = { ...PREF_DEFAULTS, ...EXTRA_PORTABLE_PREF_DEFAULTS };
  for (const key of NON_PORTABLE_PREF_KEYS) delete defaults[key];
  return defaults;
}

// Whether a stored key is part of an export (credentials only when asked).
export function isPortablePrefKey(key, { includeCredentials = false } = {}) {
  if (CREDENTIAL_PREF_KEYS.has(key)) return includeCredentials;
  return Object.prototype.hasOwnProperty.call(portablePrefDefaults(), key);
}

function isSitePath(value) {
  return typeof value === "string" && /^\/(?!\/)[^"'<>\s\\]*$/.test(value);
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// Monitored entries are rendered and fetched by URL, so imported ones are
// rebuilt from known fields instead of being stored as-is.
const PREF_IMPORT_SANITIZERS = {
  quickSearchState: (state) =>
    Object.fromEntries(
      Object.entries(state).filter(([, value]) =>
        ["string", "number", "boolean"].includes(typeof value),
      ),
    ),
  monitoredUsers: (list) =>
    list
      .filter((user) => typeof user?.username === "string" && user.username.trim())
      .map((user) => ({
        username: user.username,
        url: isSitePath(user.url)
          ? user.url
          : `/user/${encodeURIComponent(user.username)}`,
        torrentCount: finiteOr(user.torrentCount, 0),
        lastChecked: finiteOr(user.lastChecked, Date.now()),
        lastDismissedCount: finiteOr(user.lastDismissedCount, 0),
      })),
  monitoredKeywords: (list) =>
    list
      .filter((entry) => typeof entry?.keyword === "string" && entry.keyword.trim())
      .map((entry) => {
        const clean = { keyword: entry.keyword };
        if (isSitePath(entry.url)) clean.url = entry.url;
        for (const key of [
          "lastTorrentId",
          "lastDismissedTorrentId",
          "lastChecked",
          "lastCheckedAt",
        ]) {
          const value = entry[key];
          if (Number.isFinite(value) || typeof value === "string") {
            clean[key] = value;
          }
        }
        return clean;
      }),
};

const isPlainObject = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isStringList = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

// Keys whose valid values the default's type alone can't describe.
const PREF_IMPORT_VALIDATORS = {
  qbtLastCategory: (value) => value === null || typeof value === "string",
  qbtLastTags: (value) => value === null || isStringList(value),
  quickSearchState: isPlainObject,
  cloudSyncUrl: (value) =>
    typeof value === "string" && (value === "" || validateWebdavUrl(value).ok),
  cloudSyncCheckMinutes: (value) =>
    Number.isFinite(value) && normalizeCloudSyncCheckMinutes(value) === value,
};

function matchesDefaultType(value, defaultValue) {
  if (Array.isArray(defaultValue)) return Array.isArray(value);
  if (typeof defaultValue === "number") return Number.isFinite(value);
  return typeof value === typeof defaultValue;
}

// includeCloudSetup: also the Cloud Sync address and options (manual
// backups only, never the cloud copy).
export async function exportPreferences({
  includeCredentials = false,
  includeCloudSetup = false,
} = {}) {
  const defaults = portablePrefDefaults();
  if (!includeCredentials) {
    for (const key of CREDENTIAL_PREF_KEYS) delete defaults[key];
  }
  if (includeCloudSetup) Object.assign(defaults, MANUAL_BACKUP_ONLY_DEFAULTS);
  const prefs = await getPreferencesAsync(defaults);
  const out = {};
  for (const key of Object.keys(defaults)) {
    if (prefs[key] !== undefined) out[key] = prefs[key];
  }
  return out;
}

// Applies only known keys whose type matches the default. Credentials in the
// file are ignored unless includeCredentials is set; keys missing from the
// file, and keys in skipKeys, keep their current value. beforeSave sees the
// exact values about to be written.
export async function importPreferences(
  prefs,
  {
    includeCredentials = false,
    includeCloudSetup = false,
    skipKeys = null,
    beforeSave = null,
  } = {},
) {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    throw new Error("The file has no settings to import.");
  }
  const defaults = portablePrefDefaults();
  if (includeCloudSetup) Object.assign(defaults, MANUAL_BACKUP_ONLY_DEFAULTS);
  const payload = {};
  const skipped = [];
  for (const [key, value] of Object.entries(prefs)) {
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) {
      skipped.push(key);
      continue;
    }
    if (CREDENTIAL_PREF_KEYS.has(key) && !includeCredentials) continue;
    if (skipKeys?.has(key)) continue;
    const valid = PREF_IMPORT_VALIDATORS[key]
      ? PREF_IMPORT_VALIDATORS[key](value)
      : matchesDefaultType(value, defaults[key]);
    if (!valid) {
      skipped.push(key);
      continue;
    }
    payload[key] = PREF_IMPORT_SANITIZERS[key]?.(value) ?? value;
  }
  // Counted before the internal flag below, so the number matches the file.
  const applied = Object.keys(payload).length;
  // Imported lists already use the current keyword schema.
  if ("blockKeywords" in payload || "requireKeywords" in payload) {
    payload.keywordFilterMigrated = true;
  }
  beforeSave?.(payload);
  await savePreferencesAsync(payload);
  return { applied, skipped };
}

export async function resetPreferences({ clearCredentials = false } = {}) {
  const keys = Object.keys(portablePrefDefaults()).concat(
    "keywordFilterMigrated",
    "keywords",
    "keywordFilterEnabled",
    "keywordFilterMode",
    "tempDismissed",
  );
  const toRemove = keys.filter(
    (key) =>
      clearCredentials ||
      (!CREDENTIAL_PREF_KEYS.has(key) && !CONNECTION_PREF_KEYS.has(key)),
  );
  await migrateLocalKeysFromSync();
  await Promise.all([
    areaRemove("sync", toRemove.filter((key) => !LOCAL_PREF_KEYS.has(key))),
    areaRemove("local", toRemove.filter((key) => LOCAL_PREF_KEYS.has(key))),
  ]);
}
