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
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateBadge(tab.url);
    updatePopupState(tab.url);
  });
});

// Update badge and popup state when URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateBadge(changeInfo.url);
    updatePopupState(changeInfo.url);
  }
});

function updateBadge(url) {
  if (url && isNyaaSite(url)) {
    chrome.action.setBadgeText({ text: "On" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

function updatePopupState(url) {
  if (url && isNyaaSite(url)) {
    chrome.action.enable();
    chrome.action.setPopup({ popup: "popup.html" });
  } else {
    chrome.action.disable();
    chrome.action.setPopup({ popup: "" });
  }
}

// Proxy fetch requests from content scripts to bypass CORS restrictions
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "fetchUrl") {
    fetch(message.url)
      .then((response) => response.text())
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "testConnection") {
    handleTestConnection(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: "connection_failed", message: err.message }));
    return true;
  }

  if (message.type === "sendTorrent") {
    handleSendTorrent(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: "connection_failed", message: err.message }));
    return true;
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

// ── Top-level dispatchers ─────────────────────────────────────────────────────

async function handleTestConnection({ client, url, username, password }) {
  const baseUrl = normalizeUrl(url);
  switch (client) {
    case "transmission": return testTransmission(baseUrl, username, password);
    case "deluge":       return testDeluge(baseUrl, password);
    default:             return testQbt(baseUrl, username, password);
  }
}

async function handleSendTorrent({ client, url, username, password, magnetUrl }) {
  const baseUrl = normalizeUrl(url);
  switch (client) {
    case "transmission": return sendTransmission(baseUrl, username, password, magnetUrl);
    case "deluge":       return sendDeluge(baseUrl, password, magnetUrl);
    default:             return sendQbt(baseUrl, username, password, magnetUrl);
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
    if (await qbtLogin(baseUrl, username, password) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  const resp = await fetch(`${baseUrl}/api/v2/app/version`, { credentials: "include" });
  if (resp.ok) return { ok: true, version: (await resp.text()).trim() };
  if (resp.status === 403) return { ok: false, error: "auth_required" };
  return { ok: false, error: "connection_failed" };
}

async function sendQbt(baseUrl, username, password, magnetUrl) {
  if (username && password) {
    if (await qbtLogin(baseUrl, username, password) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await fetch(`${baseUrl}/api/v2/torrents/info?hashes=${infohash}`, { credentials: "include" });
    if (chk.ok) {
      const list = await chk.json();
      if (Array.isArray(list) && list.length > 0) return { ok: false, error: "already_exists" };
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
  return username && password ? "Basic " + btoa(`${username}:${password}`) : null;
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
  if (!sessionId) {
    const body = await resp.text();
    const m = body.match(/X-Transmission-Session-Id:\s*(\S+)/);
    sessionId = m ? m[1] : null;
  }
  return { status: resp.status, sessionId };
}

async function transmissionRequest(baseUrl, sessionId, authHeader, body) {
  const headers = { "Content-Type": "application/json", "X-Transmission-Session-Id": sessionId };
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
  const { status, sessionId } = await transmissionGetSessionId(baseUrl, auth);
  if (status === 401) return { ok: false, error: "auth_failed" };
  if (!sessionId) return { ok: false, error: "connection_failed" };

  const resp = await transmissionRequest(baseUrl, sessionId, auth, { method: "session-get", arguments: {} });
  if (resp.status === 401) return { ok: false, error: "auth_failed" };
  if (!resp.ok) return { ok: false, error: "connection_failed" };
  const data = await resp.json();
  if (data.result === "success") {
    return { ok: true, version: data.arguments?.version };
  }
  return { ok: false, error: "connection_failed" };
}

async function sendTransmission(baseUrl, username, password, magnetUrl) {
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
      if (data.arguments?.torrents?.length > 0) return { ok: false, error: "already_exists" };
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
  const resp = await delugePost(baseUrl, { method: "auth.login", params: [password || ""], id: 1 });
  if (!resp.ok) return { ok: false, error: "connection_failed" };
  const data = await resp.json();
  if (data.error) return { ok: false, error: "connection_failed" };
  if (data.result === true) return { ok: true };
  return { ok: false, error: "auth_failed" };
}

async function sendDeluge(baseUrl, password, magnetUrl) {
  const loginResp = await delugePost(baseUrl, { method: "auth.login", params: [password || ""], id: 1 });
  if (!loginResp.ok) return { ok: false, error: "connection_failed" };
  const loginData = await loginResp.json();
  if (!loginData.result) return { ok: false, error: "auth_failed" };

  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await delugePost(baseUrl, { method: "core.get_torrent_status", params: [infohash, ["name"]], id: 2 });
    if (chk.ok) {
      const data = await chk.json();
      if (data.result && Object.keys(data.result).length > 0) return { ok: false, error: "already_exists" };
    }
  }

  const resp = await delugePost(baseUrl, { method: "core.add_torrent_magnet", params: [magnetUrl, {}], id: 3 });
  if (!resp.ok) return { ok: false, error: "request_failed" };
  const data = await resp.json();
  if (data.error) return { ok: false, error: "request_failed" };
  return { ok: true };
}
