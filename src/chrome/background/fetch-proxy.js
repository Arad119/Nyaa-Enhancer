import {
  hasTorrentClientHostAccess,
  normalizeUrl,
} from "./torrent-clients/detect.js";
import { sendDeluge, testDeluge } from "./torrent-clients/deluge.js";
import {
  fetchQbtCategoriesAndTags,
  sendQbt,
  testQbt,
} from "./torrent-clients/qbittorrent.js";
import {
  sendTransmission,
  testTransmission,
} from "./torrent-clients/transmission.js";

const JSON_FETCH_HOSTS = new Set([
  "api.tenrai.org",
  "graphql.anilist.co",
  "animeapi.my.id",
  "api.themoviedb.org",
]);

function isAllowedJsonFetchUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && JSON_FETCH_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function handleFetchUrl(message) {
  return fetch(message.url)
    .then((response) => response.text())
    .then((text) => ({ ok: true, text }))
    .catch((err) => ({ ok: false, error: err.message }));
}

export function handleFetchJson(message) {
  if (!isAllowedJsonFetchUrl(message.url)) {
    return Promise.resolve({ ok: false, error: "host_not_allowed" });
  }

  const method = (message.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return Promise.resolve({ ok: false, error: "method_not_allowed" });
  }

  const headers = {
    Accept: "application/json",
    ...(message.headers && typeof message.headers === "object"
      ? message.headers
      : {}),
  };
  const init = { method, headers };
  if (method === "POST" && message.body != null) {
    headers["Content-Type"] = "application/json";
    init.body =
      typeof message.body === "string"
        ? message.body
        : JSON.stringify(message.body);
  }

  return fetch(message.url, init)
    .then(async (response) => {
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return {
        ok: response.ok,
        status: response.status,
        retryAfter: response.headers.get("Retry-After"),
        data,
        text,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    })
    .catch((err) => ({ ok: false, error: err.message }));
}

export async function handleTestConnection({ client, url, username, password }) {
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

export async function handleSendTorrent({
  client,
  url,
  username,
  password,
  magnetUrl,
  category,
  tags,
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
      return sendQbt(baseUrl, username, password, magnetUrl, category, tags);
  }
}

export async function handleQbtFetchCategoriesAndTags({
  url,
  username,
  password,
}) {
  if (!(await hasTorrentClientHostAccess(url))) {
    return { ok: false, error: "permission_denied" };
  }
  const baseUrl = normalizeUrl(url);
  return fetchQbtCategoriesAndTags(baseUrl, username, password);
}

export function initMessageProxy() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "fetchUrl") {
      return handleFetchUrl(message);
    }

    if (message.type === "fetchJson") {
      return handleFetchJson(message);
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

    if (message.type === "qbtFetchCategoriesAndTags") {
      return handleQbtFetchCategoriesAndTags(message).catch((err) => ({
        ok: false,
        error: "connection_failed",
        message: err.message,
      }));
    }
  });
}
