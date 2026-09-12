// Secrets and large lists stay in chrome.storage.local (no 8KB/item sync quota,
// and credentials are not uploaded to the user's chrome account).
// Booleans/toggles remain in chrome.storage.sync so they follow the user.
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
  "ameNZBRequestCount",
  "ameNZBRequestDate",
  "lastNyaaOrigin",
]);

export const PREF_DEFAULTS = {
  useDisplayName: true,
  useZip: true,
  showButtons: true,
  showATLinks: true,
  useNewATDomain: true,
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
  hideDeadTorrents: false,
  minSeedersFilterEnabled: false,
  minSeedersFilterValue: 5,
  keywords: [],
  keywordFilterEnabled: false,
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
  showChangelogNav: true,
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
  const message = err?.message || String(err);
  console.error(`Nyaa Enhancer: failed to save to storage.${area}:`, message);
  saveErrorHandler?.(message);
}

function areaGet(area, query) {
  const empty =
    query == null ||
    (Array.isArray(query) && query.length === 0) ||
    (!Array.isArray(query) && Object.keys(query).length === 0);
  if (empty) return Promise.resolve({});
  return new Promise((resolve, reject) => {
    chrome.storage[area].get(query, (items) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.error(
          `Nyaa Enhancer: failed to read storage.${area}:`,
          err.message,
        );
        reject(new Error(err.message));
        return;
      }
      resolve(items || {});
    });
  });
}

function areaSet(area, items) {
  if (!items || !Object.keys(items).length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    chrome.storage[area].set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        notifyStorageSaveError(area, err);
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

function areaRemove(area, keys) {
  if (!keys?.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    chrome.storage[area].remove(keys, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.error(
          `Nyaa Enhancer: failed to remove from storage.${area}:`,
          err.message,
        );
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
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

export async function getPreferencesAsync(keysOrDefaults) {
  await migrateLocalKeysFromSync();
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
}

export async function savePreferencesAsync(items) {
  await migrateLocalKeysFromSync();
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
    promise.then(() => callback(), () => callback());
  }
  return promise;
}

export function loadStoredPreferences() {
  return getPreferencesAsync(PREF_DEFAULTS);
}

export function savePreference(key, value) {
  return savePreferences({ [key]: value });
}
