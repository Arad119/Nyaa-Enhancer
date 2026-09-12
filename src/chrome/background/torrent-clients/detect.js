export function normalizeUrl(url) {
  return url ? url.trim() : "";
}

export function extractInfohash(magnetUrl) {
  const m = magnetUrl.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export function looksLikeHtml(text) {
  return /<!doctype\s+html|<html[\s>]/i.test(text);
}

export function detectClientFromHtml(html) {
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

export function detectClientFromJson(data) {
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

export function detectClientFromResponse(body, contentType) {
  if (contentType?.includes("text/html") || looksLikeHtml(body)) {
    return detectClientFromHtml(body);
  }
  return null;
}

export function detectClientFromBody(body, contentType) {
  const fromHtml = detectClientFromResponse(body, contentType);
  if (fromHtml) return fromHtml;
  try {
    return detectClientFromJson(JSON.parse(body));
  } catch {
    return null;
  }
}

export function isDelugeRpcResponse(data) {
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

export function isValidQbtVersion(text) {
  if (!text || text.length > 64 || looksLikeHtml(text)) return false;
  return /^v?\d+(\.\d+){0,3}([-.][\w]+)?$/i.test(text);
}

export function wrongClientResult(detectedClient) {
  return { ok: false, error: "wrong_client", detectedClient };
}

let probeImpl = async () => null;

export function bindProbeAlternateClients(fn) {
  probeImpl = fn;
}

export async function probeAlternateClients(baseUrl, except) {
  return probeImpl(baseUrl, except);
}

// Firefox cannot include a port in match patterns (unlike Chrome's `${origin}/*`).
// Hostname-only patterns still cover every port on that host (e.g. :8114).
export function torrentOriginsForUrl(url) {
  const u = new URL(normalizeUrl(url));
  return [`${u.protocol}//${u.hostname}/*`];
}

export async function hasTorrentClientHostAccess(url) {
  return chrome.permissions.contains({ origins: torrentOriginsForUrl(url) });
}
