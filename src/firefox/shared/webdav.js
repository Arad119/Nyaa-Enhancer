// Shared WebDAV helpers for cloud sync (used by the background, the popup and
// the settings page).

export const CLOUD_SYNC_FOLDER = "nyaa-enhancer";
export const CLOUD_SYNC_FILE = "settings.json";
export const CLOUD_SYNC_STATE_KEY = "__neCloudSyncState";

// How often to check the cloud for changes from other browsers while Nyaa is
// in use (minutes). 0 = on every Nyaa page (at most every 30 s), -1 = only
// when Settings opens or Sync now is pressed. Uploads are not affected.
export const CLOUD_SYNC_CHECK_DEFAULT = 5;
export const CLOUD_SYNC_CHECK_MANUAL = -1;
export const CLOUD_SYNC_CHECK_OPTIONS = [
  { value: 0, label: "On every Nyaa page (at most every 30 seconds)" },
  { value: 1, label: "Every minute" },
  { value: 5, label: "Every 5 minutes (default)" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: CLOUD_SYNC_CHECK_MANUAL, label: "Only when I open Settings or press Sync now" },
];

export function normalizeCloudSyncCheckMinutes(value) {
  const number = Number(value);
  return CLOUD_SYNC_CHECK_OPTIONS.some((option) => option.value === number)
    ? number
    : CLOUD_SYNC_CHECK_DEFAULT;
}

// Minimum time between automatic checks, or Infinity for "manual".
export function cloudSyncCheckGapMs(minutes) {
  const value = normalizeCloudSyncCheckMinutes(minutes);
  if (value === CLOUD_SYNC_CHECK_MANUAL) return Infinity;
  return Math.max(30_000, value * 60_000);
}

const LOCAL_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^.]+\.local)$/i;

// Checks the folder address the user typed. Returns the normalized address
// (no trailing slash) plus any warnings worth showing next to the field.
export function validateWebdavUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return { ok: false, empty: true, message: "Enter your WebDAV folder address." };
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "That isn't a valid web address." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "The address must start with https:// or http://." };
  }
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      message: "Don't put your username or password in the address. Add them in the extension popup instead.",
    };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, message: "Remove the ? or # part from the end of the address." };
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  const warnings = [];
  if (parsed.protocol === "http:" && !LOCAL_HOSTNAMES.test(parsed.hostname)) {
    warnings.push(
      "This address isn't encrypted (http://), so your WebDAV password and synced settings travel in plain text. Use https:// if your server supports it.",
    );
  }
  if (!path) {
    warnings.push(
      "This is the server's root address. Most services need the full WebDAV path, for example …/remote.php/dav/files/USERNAME on Nextcloud.",
    );
  } else if (/\/remote\.php\/dav(\/files)?$/i.test(path)) {
    warnings.push(
      "Nextcloud addresses usually end with /files/USERNAME. Copy the full address from Files → Settings → WebDAV.",
    );
  }
  return { ok: true, url: `${parsed.origin}${path}`, warnings };
}

export function cloudSyncFolderUrl(baseUrl) {
  return `${baseUrl}/${CLOUD_SYNC_FOLDER}/`;
}

export function cloudSyncFileUrl(baseUrl) {
  return `${baseUrl}/${CLOUD_SYNC_FOLDER}/${CLOUD_SYNC_FILE}`;
}

// Host permission pattern for the WebDAV server. Firefox match patterns
// can't include a port, and hostname-only patterns cover every port.
export function webdavPermissionPattern(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

export const CLOUD_SYNC_ERROR_MESSAGES = {
  not_configured: "Add your WebDAV folder address on the Settings page.",
  invalid_url: "The WebDAV folder address isn't valid.",
  no_credentials: "Add your WebDAV username and password in the extension popup (Cloud Sync).",
  needs_permission: "The extension isn't allowed to reach this server yet. Open the extension popup, go to Cloud Sync and press Connect.",
  network: "Couldn't reach the server. Check the address and that the server is online.",
  timeout: "The server took too long to answer.",
  auth_failed: "The server rejected the username or password. Many services (like Nextcloud) need an app password here. Automatic syncing is paused until you change the login (or press Sync now).",
  rate_limited: "The server is refusing requests for now (often a temporary lock after several wrong passwords). Automatic syncing is paused for a while; press Sync now to try sooner.",
  forbidden: "The server refused access to this folder. Check that your account can write to it.",
  not_found: "That folder doesn't exist on the server. Check the WebDAV address.",
  not_webdav: "This address doesn't look like a WebDAV folder. Check the address in your service's WebDAV settings.",
  not_folder: "This address points to a file, not a folder.",
  server_error: "The server had an error. Try again later.",
  busy: "The server was busy (often another browser saving at the same moment). It tries again on your next change or check.",
  conflict: "Another device kept changing the cloud copy at the same time. Try again.",
  bad_file: "The cloud copy isn't a valid Nyaa Enhancer settings file.",
  newer_version: "The cloud copy was made by a newer version of Nyaa Enhancer. Update the extension on this device.",
  disabled: "Cloud sync is turned off.",
  unknown: "Something went wrong while syncing.",
};

export function cloudSyncErrorMessage(code, fallback) {
  return CLOUD_SYNC_ERROR_MESSAGES[code] || fallback || CLOUD_SYNC_ERROR_MESSAGES.unknown;
}
