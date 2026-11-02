// Tenrai's public tier allows 4 requests/second and 120 requests/minute per IP.
// Every tab and feature sends Tenrai requests through this one background
// queue, which stays below both limits with some headroom.
const TENRAI_HOST = "api.tenrai.org";
const MAX_PER_SECOND = 3;
const MAX_PER_MINUTE = 100;
const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const DEFAULT_RETRY_AFTER_MS = 5000;
const SESSION_KEY = "__neTenraiRequestLog";

let sentAt = null;
let blockedUntil = 0;
let queue = Promise.resolve();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTenraiUrl(url) {
  try {
    return new URL(url).hostname === TENRAI_HOST;
  } catch {
    return false;
  }
}

// The service worker can be stopped between requests, so the log is kept in
// session storage and restored on the next request.
async function loadLog() {
  if (sentAt) return;
  sentAt = [];
  try {
    const stored = await chrome.storage.session?.get({ [SESSION_KEY]: null });
    const log = stored?.[SESSION_KEY];
    if (Array.isArray(log?.sentAt)) {
      sentAt = log.sentAt.filter(Number.isFinite).sort((a, b) => a - b);
    }
    if (Number.isFinite(log?.blockedUntil)) blockedUntil = log.blockedUntil;
  } catch {
    /* session storage is unavailable; keep the in-memory log. */
  }
}

function saveLog() {
  try {
    chrome.storage.session
      ?.set({ [SESSION_KEY]: { sentAt, blockedUntil } })
      ?.catch?.(() => {});
  } catch {
    /* ignore */
  }
}

function waitForNextSlot(now) {
  sentAt = sentAt.filter((ts) => now - ts < MINUTE_MS);
  let wait = Math.max(0, blockedUntil - now);
  const lastSecond = sentAt.filter((ts) => now - ts < SECOND_MS);
  if (lastSecond.length >= MAX_PER_SECOND) {
    const oldest = lastSecond[lastSecond.length - MAX_PER_SECOND];
    wait = Math.max(wait, oldest + SECOND_MS - now);
  }
  if (sentAt.length >= MAX_PER_MINUTE) {
    const oldest = sentAt[sentAt.length - MAX_PER_MINUTE];
    wait = Math.max(wait, oldest + MINUTE_MS - now);
  }
  return wait;
}

// Resolves to 0 once a request may be sent, or to the remaining wait in ms
// when that wait would be longer than maxWaitMs (the request is then skipped).
export function reserveTenraiSlot(maxWaitMs = Infinity) {
  const task = queue.then(async () => {
    await loadLog();
    const deadline = Date.now() + Math.max(0, Number(maxWaitMs) || 0);
    for (;;) {
      const now = Date.now();
      const wait = waitForNextSlot(now);
      if (!wait) break;
      if (now + wait > deadline) return wait;
      await delay(wait);
    }
    sentAt.push(Date.now());
    saveLog();
    return 0;
  });
  queue = task.catch(() => {});
  return task;
}

export function noteTenraiResponse(result) {
  if (result?.status !== 429 && result?.status !== 503) return;
  const seconds = Number(result.retryAfter);
  const retryMs =
    Number.isFinite(seconds) && seconds > 0
      ? Math.min(seconds * 1000, MINUTE_MS)
      : DEFAULT_RETRY_AFTER_MS;
  blockedUntil = Math.max(blockedUntil, Date.now() + retryMs);
  saveLog();
}
