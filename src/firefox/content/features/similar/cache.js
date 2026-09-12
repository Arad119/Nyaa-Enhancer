export const IDENTIFY_CACHE_KEY = "__neSimilarIdentify";
export const RECS_CACHE_KEY = "__neSimilarRecs";
export const ANIMEAPI_CACHE_KEY = "__neSimilarAnimeApiMap";
export const DETAILS_CACHE_KEY = "__neSimilarDetails";

const SIMILAR_CACHE_PREFIX = "__neSimilar";
const KNOWN_SIMILAR_CACHE_KEYS = [
  IDENTIFY_CACHE_KEY,
  RECS_CACHE_KEY,
  ANIMEAPI_CACHE_KEY,
  DETAILS_CACHE_KEY,
];

export const SIMILAR_CACHE_USAGE_KEYS = {
  identify: IDENTIFY_CACHE_KEY,
  recs: RECS_CACHE_KEY,
  animeapi: ANIMEAPI_CACHE_KEY,
  details: DETAILS_CACHE_KEY,
};

export function isSimilarCacheKey(key) {
  return String(key || "").startsWith(SIMILAR_CACHE_PREFIX);
}

export function formatSimilarCacheBytes(bytes) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const decimals = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${Number(v.toFixed(decimals))} ${units[i]}`;
}

function getBytesInUse(key) {
  return new Promise((resolve) => {
    if (typeof browser.storage?.local?.getBytesInUse !== "function") {
      resolve(0);
      return;
    }
    browser.storage.local.getBytesInUse(key, (bytes) => {
      resolve(Number(bytes) || 0);
    });
  });
}

export async function getSimilarCacheUsage() {
  const entries = await Promise.all(
    Object.entries(SIMILAR_CACHE_USAGE_KEYS).map(async ([name, key]) => {
      const bytes = await getBytesInUse(key);
      return [name, bytes];
    }),
  );
  const usage = Object.fromEntries(entries);
  usage.total = Object.values(usage).reduce((sum, bytes) => sum + bytes, 0);
  return usage;
}

export async function clearSimilarCaches() {
  const keys = new Set(KNOWN_SIMILAR_CACHE_KEYS);
  try {
    const stored = await browser.storage.local.get([...keys]);
    Object.keys(stored || {}).forEach((key) => {
      if (isSimilarCacheKey(key)) keys.add(key);
    });
  } catch {
    /* get(null) is avoided on purpose; listing known keys can still fail. */
  }
  await browser.storage.local.remove([...keys]);
}

export function similarCachesWereCleared(changes) {
  return Object.entries(changes || {}).some(([key, change]) => {
    if (!isSimilarCacheKey(key)) return false;
    const next = change?.newValue;
    return (
      next == null ||
      (typeof next === "object" &&
        !Array.isArray(next) &&
        Object.keys(next).length === 0)
    );
  });
}
