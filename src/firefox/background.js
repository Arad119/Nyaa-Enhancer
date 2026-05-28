// Array of supported Nyaa domains from manifest.json
const supportedDomains = [
  "nyaa.si",
  "nya.iss.one",
  "nyaa.ink",
  "nyaa.land",
  "nyaa.digital",
  "ny.iss.one",
];

// Check if a URL matches any supported domain
function isNyaaSite(url) {
  return supportedDomains.some((domain) => url.includes(domain));
}

// Update badge and popup state when tab changes
browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId, (tab) => {
    updateBadge(tab.url);
    updatePopupState(tab.url);
  });
});

// Update badge and popup state when URL changes
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateBadge(changeInfo.url);
    updatePopupState(changeInfo.url);
  }
});

function updateBadge(url) {
  if (url && isNyaaSite(url)) {
    browser.action.setBadgeText({ text: "On" });
    browser.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  } else {
    browser.action.setBadgeText({ text: "" });
  }
}

function updatePopupState(url) {
  if (url && isNyaaSite(url)) {
    browser.action.enable();
    browser.action.setPopup({ popup: "popup.html" });
  } else {
    browser.action.disable();
    browser.action.setPopup({ popup: "" });
  }
}

// Firefox cannot include a port in match patterns (unlike Chrome's `${origin}/*`).
// Hostname-only patterns still cover every port on that host (e.g. :8114).
function torrentOriginsForUrl(url) {
  const u = new URL(normalizeUrl(url));
  return [`${u.protocol}//${u.hostname}/*`];
}

async function hasTorrentClientHostAccess(url) {
  return browser.permissions.contains({ origins: torrentOriginsForUrl(url) });
}

// Proxy fetch requests from content scripts to bypass CORS restrictions
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "fetchUrl") {
    return fetch(message.url)
      .then((response) => response.text())
      .then((text) => ({ ok: true, text }))
      .catch((err) => ({ ok: false, error: err.message }));
  }

  if (message.type === "testConnection") {
    return handleTestConnection(message).catch((err) => ({
      ok: false,
      error: "connection_failed",
      message: err.message,
    }));
  }

  if (message.type === "sendTorrent") {
    return handleSendTorrent(message).catch((err) => ({
      ok: false,
      error: "connection_failed",
      message: err.message,
    }));
  }
});

// ── Shared utilities ─────────────────────────────────────────────────────────

function normalizeUrl(url) {
  return url ? url.trim() : "";
}

function extractInfohash(magnetUrl) {
  const m = magnetUrl.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function looksLikeHtml(text) {
  return /<!doctype\s+html|<html[\s>]/i.test(text);
}

function detectClientFromHtml(html) {
  const h = html.toLowerCase();
  if (
    h.includes("transmission web interface") ||
    h.includes("transmission-app")
  ) {
    return "transmission";
  }
  if (h.includes("qbittorrent") || h.includes("mousetrap.min.js")) {
    return "qbittorrent";
  }
  if (
    h.includes("deluge web") ||
    h.includes("deluge.ui") ||
    h.includes("deluge-webui") ||
    (h.includes("deluge") &&
      (h.includes("webui") || h.includes("ext-all") || h.includes("ext-base")))
  ) {
    return "deluge";
  }
  return null;
}

function detectClientFromJson(data) {
  if (!data || typeof data !== "object") return null;
  if (
    Number.isInteger(data.id) &&
    ("error" in data ||
      typeof data.result === "boolean" ||
      data.result === null ||
      (typeof data.result === "object" && data.result !== null))
  ) {
    return "deluge";
  }
  if (typeof data.result === "string") return "transmission";
  return null;
}

function detectClientFromResponse(body, contentType) {
  if (contentType?.includes("text/html") || looksLikeHtml(body)) {
    return detectClientFromHtml(body);
  }
  return null;
}

function detectClientFromBody(body, contentType) {
  const fromHtml = detectClientFromResponse(body, contentType);
  if (fromHtml) return fromHtml;
  try {
    return detectClientFromJson(JSON.parse(body));
  } catch {
    return null;
  }
}

function isDelugeRpcResponse(data) {
  return (
    data &&
    typeof data === "object" &&
    Number.isInteger(data.id) &&
    ("error" in data ||
      typeof data.result === "boolean" ||
      data.result === null ||
      (typeof data.result === "object" && data.result !== null))
  );
}

function isValidQbtVersion(text) {
  if (!text || text.length > 64 || looksLikeHtml(text)) return false;
  return /^v?\d+(\.\d+){0,3}([-.][\w]+)?$/i.test(text);
}

function wrongClientResult(detectedClient) {
  return { ok: false, error: "wrong_client", detectedClient };
}

async function probeQbtVersion(baseUrl) {
  try {
    const resp = await fetch(`${baseUrl}/api/v2/app/version`, {
      credentials: "include",
    });
    const body = (await resp.text()).trim();
    return resp.ok && isValidQbtVersion(body) ? "qbittorrent" : null;
  } catch {
    return null;
  }
}

async function probeDelugeRpc(baseUrl) {
  try {
    const resp = await delugePost(baseUrl, {
      method: "auth.login",
      params: [""],
      id: 0,
    });
    if (!resp.ok) return null;
    const data = JSON.parse(await resp.text());
    return isDelugeRpcResponse(data) ? "deluge" : null;
  } catch {
    return null;
  }
}

async function probeTransmissionRpc(baseUrl) {
  try {
    const resp = await fetch(`${baseUrl}/transmission/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "session-get", arguments: {} }),
      credentials: "include",
    });
    if (resp.headers.get("X-Transmission-Session-Id")) return "transmission";
    const body = await resp.text();
    if (/x-transmission-session-id/i.test(body)) return "transmission";
    try {
      if (typeof JSON.parse(body).result === "string") return "transmission";
    } catch {
      /* ignore */
    }
    return detectClientFromHtml(body) === "transmission" ? "transmission" : null;
  } catch {
    return null;
  }
}

async function probeAlternateClients(baseUrl, except) {
  if (except !== "qbittorrent") {
    const qbt = await probeQbtVersion(baseUrl);
    if (qbt) return qbt;
  }
  if (except !== "deluge") {
    const deluge = await probeDelugeRpc(baseUrl);
    if (deluge) return deluge;
  }
  if (except !== "transmission") {
    const transmission = await probeTransmissionRpc(baseUrl);
    if (transmission) return transmission;
  }
  return null;
}

// ── Top-level dispatchers ─────────────────────────────────────────────────────

async function handleTestConnection({ client, url, username, password }) {
  if (!(await hasTorrentClientHostAccess(url))) {
    return { ok: false, error: "permission_denied" };
  }
  const baseUrl = normalizeUrl(url);
  switch (client) {
    case "transmission":
      return testTransmission(baseUrl, username, password);
    case "deluge":
      return testDeluge(baseUrl, password);
    default:
      return testQbt(baseUrl, username, password);
  }
}

async function handleSendTorrent({
  client,
  url,
  username,
  password,
  magnetUrl,
}) {
  if (!(await hasTorrentClientHostAccess(url))) {
    return { ok: false, error: "permission_denied" };
  }
  const baseUrl = normalizeUrl(url);
  switch (client) {
    case "transmission":
      return sendTransmission(baseUrl, username, password, magnetUrl);
    case "deluge":
      return sendDeluge(baseUrl, password, magnetUrl);
    default:
      return sendQbt(baseUrl, username, password, magnetUrl);
  }
}

// ── qBittorrent ───────────────────────────────────────────────────────────────

async function qbtLogin(baseUrl, username, password) {
  const resp = await fetch(`${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    credentials: "include",
  });
  return (await resp.text()).trim(); // "Ok." or "Fails."
}

async function testQbt(baseUrl, username, password) {
  if (username && password) {
    if ((await qbtLogin(baseUrl, username, password)) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  const resp = await fetch(`${baseUrl}/api/v2/app/version`, {
    credentials: "include",
  });
  const body = (await resp.text()).trim();
  if (resp.ok) {
    if (isValidQbtVersion(body)) return { ok: true, version: body };
    const detected = detectClientFromBody(body, resp.headers.get("content-type"));
    if (detected) return wrongClientResult(detected);
    const probed = await probeAlternateClients(baseUrl, "qbittorrent");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }
  if (resp.status === 403) return { ok: false, error: "auth_required" };
  const probed = await probeAlternateClients(baseUrl, "qbittorrent");
  if (probed) return wrongClientResult(probed);
  return { ok: false, error: "connection_failed" };
}

async function sendQbt(baseUrl, username, password, magnetUrl) {
  const check = await testQbt(baseUrl, username, password);
  if (!check.ok) return check;
  if (username && password) {
    if ((await qbtLogin(baseUrl, username, password)) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await fetch(
      `${baseUrl}/api/v2/torrents/info?hashes=${infohash}`,
      { credentials: "include" },
    );
    if (chk.ok) {
      const list = await chk.json();
      if (Array.isArray(list) && list.length > 0)
        return { ok: false, error: "already_exists" };
    }
  }
  const resp = await fetch(`${baseUrl}/api/v2/torrents/add`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `urls=${encodeURIComponent(magnetUrl)}`,
    credentials: "include",
  });
  if (resp.ok) return { ok: true };
  if (resp.status === 403) return { ok: false, error: "auth_required" };
  return { ok: false, error: "request_failed" };
}

// ── Transmission ──────────────────────────────────────────────────────────────

function transmissionAuthHeader(username, password) {
  return username && password
    ? "Basic " + btoa(`${username}:${password}`)
    : null;
}

async function transmissionGetSessionId(baseUrl, authHeader) {
  const headers = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;

  const resp = await fetch(`${baseUrl}/transmission/rpc`, {
    method: "POST",
    headers,
    body: JSON.stringify({ method: "session-get", arguments: {} }),
    credentials: "include",
  });

  // Session ID comes in the response header (409) or can be parsed from body
  let sessionId = resp.headers.get("X-Transmission-Session-Id");
  const body = await resp.text();
  if (!sessionId) {
    const m = body.match(/X-Transmission-Session-Id:\s*(\S+)/);
    sessionId = m ? m[1] : null;
  }
  const detectedClient =
    !sessionId && looksLikeHtml(body) ? detectClientFromHtml(body) : null;
  return { status: resp.status, sessionId, detectedClient };
}

async function transmissionRequest(baseUrl, sessionId, authHeader, body) {
  const headers = {
    "Content-Type": "application/json",
    "X-Transmission-Session-Id": sessionId,
  };
  if (authHeader) headers["Authorization"] = authHeader;
  return fetch(`${baseUrl}/transmission/rpc`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });
}

async function testTransmission(baseUrl, username, password) {
  const auth = transmissionAuthHeader(username, password);
  const { status, sessionId, detectedClient } = await transmissionGetSessionId(
    baseUrl,
    auth,
  );
  if (status === 401) return { ok: false, error: "auth_failed" };
  if (detectedClient) return wrongClientResult(detectedClient);
  if (!sessionId) {
    const probed = await probeAlternateClients(baseUrl, "transmission");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }

  const resp = await transmissionRequest(baseUrl, sessionId, auth, {
    method: "session-get",
    arguments: {},
  });
  if (resp.status === 401) return { ok: false, error: "auth_failed" };
  if (!resp.ok) return { ok: false, error: "connection_failed" };
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const detected = detectClientFromBody(
      text,
      resp.headers.get("content-type"),
    );
    if (detected) return wrongClientResult(detected);
    return { ok: false, error: "connection_failed" };
  }
  if (data.result === "success") {
    return { ok: true, version: data.arguments?.version };
  }
  const detected = detectClientFromJson(data);
  if (detected) return wrongClientResult(detected);
  return { ok: false, error: "connection_failed" };
}

async function sendTransmission(baseUrl, username, password, magnetUrl) {
  const check = await testTransmission(baseUrl, username, password);
  if (!check.ok) return check;
  const auth = transmissionAuthHeader(username, password);
  const { status, sessionId } = await transmissionGetSessionId(baseUrl, auth);
  if (status === 401) return { ok: false, error: "auth_failed" };
  if (!sessionId) return { ok: false, error: "connection_failed" };

  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await transmissionRequest(baseUrl, sessionId, auth, {
      method: "torrent-get",
      arguments: { fields: ["hashString"], ids: [infohash] },
    });
    if (chk.ok) {
      const data = await chk.json();
      if (data.arguments?.torrents?.length > 0)
        return { ok: false, error: "already_exists" };
    }
  }

  const resp = await transmissionRequest(baseUrl, sessionId, auth, {
    method: "torrent-add",
    arguments: { filename: magnetUrl },
  });
  if (resp.status === 401) return { ok: false, error: "auth_failed" };
  if (!resp.ok) return { ok: false, error: "request_failed" };
  const data = await resp.json();
  if (data.result === "success") return { ok: true };
  return { ok: false, error: "request_failed" };
}

// ── Deluge ────────────────────────────────────────────────────────────────────

async function delugePost(baseUrl, body) {
  return fetch(`${baseUrl}/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
}

async function testDeluge(baseUrl, password) {
  const resp = await delugePost(baseUrl, {
    method: "auth.login",
    params: [password || ""],
    id: 1,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const detected = detectClientFromBody(text, resp.headers.get("content-type"));
    if (detected) return wrongClientResult(detected);
    const probed = await probeAlternateClients(baseUrl, "deluge");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const detected = detectClientFromBody(text, resp.headers.get("content-type"));
    if (detected) return wrongClientResult(detected);
    const probed = await probeAlternateClients(baseUrl, "deluge");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }
  if (isDelugeRpcResponse(data)) {
    if (data.result === true) return { ok: true };
    if (data.error) return { ok: false, error: "connection_failed" };
    return { ok: false, error: "auth_failed" };
  }
  const detected = detectClientFromJson(data);
  if (detected) return wrongClientResult(detected);
  const probed = await probeAlternateClients(baseUrl, "deluge");
  if (probed) return wrongClientResult(probed);
  return { ok: false, error: "connection_failed" };
}

async function sendDeluge(baseUrl, password, magnetUrl) {
  const check = await testDeluge(baseUrl, password);
  if (!check.ok) return check;
  const loginResp = await delugePost(baseUrl, {
    method: "auth.login",
    params: [password || ""],
    id: 1,
  });
  if (!loginResp.ok) return { ok: false, error: "connection_failed" };
  const loginData = await loginResp.json();
  if (!loginData.result) return { ok: false, error: "auth_failed" };

  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await delugePost(baseUrl, {
      method: "core.get_torrent_status",
      params: [infohash, ["name"]],
      id: 2,
    });
    if (chk.ok) {
      const data = await chk.json();
      if (data.result && Object.keys(data.result).length > 0)
        return { ok: false, error: "already_exists" };
    }
  }

  const resp = await delugePost(baseUrl, {
    method: "core.add_torrent_magnet",
    params: [magnetUrl, {}],
    id: 3,
  });
  if (!resp.ok) return { ok: false, error: "request_failed" };
  const data = await resp.json();
  if (data.error) return { ok: false, error: "request_failed" };
  return { ok: true };
}
