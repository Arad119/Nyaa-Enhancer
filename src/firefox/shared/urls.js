let nyaaOriginFallback = "";

export function setNyaaOriginFallback(origin) {
  if (typeof origin !== "string") return;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      nyaaOriginFallback = parsed.origin;
    }
  } catch {
    /* ignore invalid origins */
  }
}

export function getNyaaOrigin() {
  try {
    if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) {
      return window.location.origin;
    }
  } catch {
    /* ignore */
  }
  return nyaaOriginFallback || "https://nyaa.si";
}

export function toCurrentNyaaUrl(urlOrPath) {
  try {
    const parsed = new URL(urlOrPath, getNyaaOrigin());
    return `${getNyaaOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return urlOrPath;
  }
}

export function getKeywordSearchUrl(keyword) {
  return `${getNyaaOrigin()}/?f=0&c=0_0&q=${encodeURIComponent(keyword)}`;
}

export function getAnimeSearchUrl(query) {
  return `${getNyaaOrigin()}/?f=0&c=1_0&q=${encodeURIComponent(query)}`;
}

export function getTorrentViewUrl(torrentId) {
  return `${getNyaaOrigin()}/view/${torrentId}`;
}
