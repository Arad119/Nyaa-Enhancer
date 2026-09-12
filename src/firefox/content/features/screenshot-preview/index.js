import { loadStoredPreferences } from "../../../shared/prefs.js";

// ── Screenshot Preview (hover thumbnail carousel) ───────────────────────────

export const screenshotPreview = {
  enabled: false,
  hoverDelayMs: 3000,
  slideDelayMs: 3000,
  hoverTimer: null,
  slideTimer: null,
  currentAnchor: null,
  popupEl: null,
  imgEl: null,
  loaderEl: null,
  counterEl: null,
  imageCache: new Map(), // viewUrl -> string[]  (result of page parse)
  preloadedImages: new Map(), // imageUrl -> HTMLImageElement (preloaded pixel data)
  inflightFetches: new Map(), // viewUrl -> Promise<string[]>
  mouseX: 0,
  mouseY: 0,
  images: [],
  imageIndex: 0,
  delegationInitialized: false,
  titleStore: new Map(), // anchor element -> original title string
  titleObserver: null, // MutationObserver watching for new table rows
  prefetchTimer: null, // fires at hoverDelayMs/2 to start background fetch
};

export const SCREENSHOT_IMG_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i;

export function ensureScreenshotPreviewDelegation() {
  if (screenshotPreview.delegationInitialized) return;
  screenshotPreview.delegationInitialized = true;
  document.addEventListener("mouseover", screenshotPreviewMouseOver, true);
  document.addEventListener("mouseout", screenshotPreviewMouseOut, true);
  document.addEventListener("mousemove", screenshotPreviewMouseMove, true);
  window.addEventListener(
    "scroll",
    () => {
      if (screenshotPreview.popupEl?.classList.contains("visible")) {
        updateScreenshotPreviewPosition();
      }
    },
    true,
  );
}

export function getScreenshotTorrentLink(target) {
  if (!target || !target.closest) return null;
  return target.closest('table.torrent-list td a[href^="/view/"]');
}

export function screenshotPreviewMouseOver(e) {
  if (!screenshotPreview.enabled) return;
  const anchor = getScreenshotTorrentLink(e.target);
  if (!anchor) return;
  if (anchor === screenshotPreview.currentAnchor) return;

  cancelScreenshotPreview();
  screenshotPreview.currentAnchor = anchor;

  // Schedule the background page-fetch to start at the halfway point of the
  // hover delay so fast mouse passes don't fire unnecessary requests to Nyaa.
  // When the delay is 0 we fetch immediately (user accepted the trade-off).
  const prefetchDelay = Math.floor(screenshotPreview.hoverDelayMs / 2);
  if (prefetchDelay === 0) {
    prefetchScreenshotAnchor(anchor.href);
  } else {
    screenshotPreview.prefetchTimer = setTimeout(() => {
      prefetchScreenshotAnchor(anchor.href);
    }, prefetchDelay);
  }

  screenshotPreview.hoverTimer = setTimeout(() => {
    startScreenshotPreview(anchor);
  }, screenshotPreview.hoverDelayMs);
}

// Begin fetching and preloading images for a torrent link.
// Safe to call multiple times — idempotent thanks to the cache/inflight guards.
export function prefetchScreenshotAnchor(viewUrl) {
  if (screenshotPreview.imageCache.has(viewUrl)) return;
  if (screenshotPreview.inflightFetches.has(viewUrl)) return;

  const promise = fetchScreenshotImages(viewUrl)
    .then((images) => {
      const list = images || [];
      screenshotPreview.imageCache.set(viewUrl, list);
      if (list.length) preloadScreenshotImages(list);
      return list;
    })
    .finally(() => {
      screenshotPreview.inflightFetches.delete(viewUrl);
    });

  screenshotPreview.inflightFetches.set(viewUrl, promise);
}

// Eagerly create Image objects for each URL so browsers cache the pixel data
// before we need to display them.
export function preloadScreenshotImages(urls) {
  urls.forEach((url) => {
    if (screenshotPreview.preloadedImages.has(url)) return;
    const img = new Image();
    img.src = url;
    screenshotPreview.preloadedImages.set(url, img);
  });
}

export function screenshotPreviewMouseOut(e) {
  if (!screenshotPreview.enabled) return;
  const anchor = screenshotPreview.currentAnchor;
  if (!anchor) return;
  // Only react when the mouse actually left the anchor element (or a descendant of it).
  // This prevents stray mouseout events from unrelated elements (or synthetic events
  // triggered by DOM insertions) from incorrectly cancelling the preview.
  if (e.target !== anchor && !anchor.contains(e.target)) return;
  const related = e.relatedTarget;
  if (related && (related === anchor || anchor.contains(related))) return;
  cancelScreenshotPreview();
}

export function screenshotPreviewMouseMove(e) {
  screenshotPreview.mouseX = e.clientX;
  screenshotPreview.mouseY = e.clientY;
  if (screenshotPreview.popupEl?.classList.contains("visible")) {
    updateScreenshotPreviewPosition();
  }
}

export function cancelScreenshotPreview() {
  if (screenshotPreview.prefetchTimer) {
    clearTimeout(screenshotPreview.prefetchTimer);
    screenshotPreview.prefetchTimer = null;
  }
  if (screenshotPreview.hoverTimer) {
    clearTimeout(screenshotPreview.hoverTimer);
    screenshotPreview.hoverTimer = null;
  }
  if (screenshotPreview.slideTimer) {
    clearTimeout(screenshotPreview.slideTimer);
    screenshotPreview.slideTimer = null;
  }
  screenshotPreview.currentAnchor = null;
  screenshotPreview.images = [];
  screenshotPreview.imageIndex = 0;
  hideScreenshotPreview();
}

export async function startScreenshotPreview(anchor) {
  // Confirm the mouse is actually still over the anchor at timer-fire time.
  const underCursor = document.elementFromPoint(
    screenshotPreview.mouseX,
    screenshotPreview.mouseY,
  );
  if (
    !underCursor ||
    (underCursor !== anchor && !anchor.contains(underCursor))
  ) {
    cancelScreenshotPreview();
    return;
  }

  const viewUrl = anchor.href;

  // Fast path: images already fetched and preloaded — show with no loading state.
  let images = screenshotPreview.imageCache.get(viewUrl);

  if (!images) {
    // Show the loader only while waiting for the in-flight prefetch
    // (prefetchScreenshotAnchor started it the moment the mouse entered).
    showScreenshotPreviewLoader();

    let inflight = screenshotPreview.inflightFetches.get(viewUrl);
    if (!inflight) {
      // Fallback: prefetch wasn't started (shouldn't normally happen), kick it off now.
      prefetchScreenshotAnchor(viewUrl);
      inflight = screenshotPreview.inflightFetches.get(viewUrl);
    }

    images = await inflight;
  }

  // Bail out if the user moved away while we were waiting
  if (anchor !== screenshotPreview.currentAnchor) return;

  if (!images || !images.length) {
    hideScreenshotPreview();
    return;
  }

  screenshotPreview.images = images;
  screenshotPreview.imageIndex = 0;
  await showScreenshotPreviewImage();

  // Start the slideshow only after the first image is fully painted.
  // Each tick waits until the next image is decoded before displaying it, then
  // schedules itself again — so the delay is always "time between visible frames".
  if (
    images.length > 1 &&
    screenshotPreview.slideDelayMs > 0 &&
    screenshotPreview.currentAnchor === anchor
  ) {
    const scheduleNextSlide = () => {
      screenshotPreview.slideTimer = setTimeout(async () => {
        if (
          !screenshotPreview.currentAnchor ||
          !screenshotPreview.images.length
        )
          return;
        screenshotPreview.imageIndex =
          (screenshotPreview.imageIndex + 1) % screenshotPreview.images.length;
        await showScreenshotPreviewImage();
        if (screenshotPreview.currentAnchor) scheduleNextSlide();
      }, screenshotPreview.slideDelayMs);
    };
    scheduleNextSlide();
  }
}

export async function fetchScreenshotImages(viewUrl) {
  const result = await new Promise((resolve) => {
    browser.runtime.sendMessage({ type: "fetchUrl", url: viewUrl }, resolve);
  });
  if (!result?.ok || !result.text) return [];

  let doc;
  try {
    doc = new DOMParser().parseFromString(result.text, "text/html");
  } catch {
    return [];
  }

  const description = doc.querySelector("#torrent-description");
  if (!description) return [];

  const seen = new Set();
  const collected = [];

  // Nyaa runs `window.markdown_proxy_images = true` which makes its client-side
  // JS rewrite <img src> attributes to route through the WordPress.com image CDN
  // (i0.wp.com) before the page is rendered.  Our background fetch gets the raw
  // server HTML *before* that JS runs, so image srcs may still be the original
  // host.  Some hosts (e.g. i.kek.sh) use hotlink protection and will refuse to
  // serve images directly from the extension context.  Applying the same proxy
  // Nyaa uses guarantees the images load regardless of the origin host.
  function toWpProxy(resolvedUrl) {
    if (/^https?:\/\/i\d*\.wp\.com\//i.test(resolvedUrl)) return resolvedUrl;
    const withoutScheme = resolvedUrl.replace(/^https?:\/\//i, "");
    return `https://i0.wp.com/${withoutScheme}?ssl=1`;
  }

  // Helper: resolve, deduplicate, proxy and push a candidate src URL
  function addSrc(rawSrc) {
    let resolved;
    try {
      resolved = new URL(rawSrc, viewUrl).toString();
    } catch {
      return;
    }
    if (!SCREENSHOT_IMG_REGEX.test(resolved)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    collected.push(toWpProxy(resolved));
  }

  // Primary: rendered <img> tags (Nyaa renders markdown server-side)
  description.querySelectorAll("img").forEach((img) => {
    let src = img.getAttribute("src");
    if (!src) return;

    // When a thumbnail is wrapped in an <a> pointing to the full image, prefer that
    const parentA = img.closest("a");
    if (parentA) {
      const parentHref = parentA.getAttribute("href");
      if (parentHref && SCREENSHOT_IMG_REGEX.test(parentHref)) {
        src = parentHref;
      }
    }
    addSrc(src);
  });

  // Fallback: if no <img> tags were found the description may be unrendered markdown.
  // Extract URLs from the standard markdown image syntax: ![alt](url)
  if (collected.length === 0) {
    const mdText = description.textContent || "";
    const mdImgRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
    let m;
    while ((m = mdImgRe.exec(mdText)) !== null) {
      addSrc(m[1]);
    }
  }

  return collected;
}

// Returns a promise that resolves once the preloaded Image for `url` is fully
// decoded (pixel data in memory).  We await this before assigning the src to
// the visible element so the browser paints from cache in one instant frame.
export function waitForImageReady(url) {
  let img = screenshotPreview.preloadedImages.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    screenshotPreview.preloadedImages.set(url, img);
  }
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  // decode() resolves only after the image is fully decoded — never progressively.
  return img.decode().catch(() => {});
}

export function ensureScreenshotPreviewPopup() {
  if (screenshotPreview.popupEl) return;

  const popup = document.createElement("div");
  popup.className = "nyaa-screenshot-preview";

  const loader = document.createElement("div");
  loader.className = "nyaa-screenshot-preview-loader";
  loader.textContent = "Loading…";

  const img = document.createElement("img");
  img.className = "nyaa-screenshot-preview-img";
  img.alt = "";
  img.addEventListener("load", () => {
    if (screenshotPreview.popupEl?.classList.contains("visible")) {
      updateScreenshotPreviewPosition();
    }
  });

  const counter = document.createElement("div");
  counter.className = "nyaa-screenshot-preview-counter";

  popup.appendChild(loader);
  popup.appendChild(img);
  popup.appendChild(counter);
  document.body.appendChild(popup);

  screenshotPreview.popupEl = popup;
  screenshotPreview.imgEl = img;
  screenshotPreview.loaderEl = loader;
  screenshotPreview.counterEl = counter;
}

export function showScreenshotPreviewLoader() {
  ensureScreenshotPreviewPopup();
  screenshotPreview.popupEl.classList.add("visible");
  screenshotPreview.loaderEl.style.display = "block";
  screenshotPreview.loaderEl.textContent = "Loading…";
  screenshotPreview.imgEl.style.display = "none";
  screenshotPreview.imgEl.removeAttribute("src");
  screenshotPreview.counterEl.style.display = "none";
  updateScreenshotPreviewPosition();
}

export async function showScreenshotPreviewImage() {
  ensureScreenshotPreviewPopup();

  const capturedIndex = screenshotPreview.imageIndex;
  const nextSrc = screenshotPreview.images[capturedIndex];

  // Check whether the image is already fully decoded in memory.
  const preloaded = screenshotPreview.preloadedImages.get(nextSrc);
  const isReady = preloaded && preloaded.complete && preloaded.naturalWidth > 0;

  if (!isReady) {
    // Image not in cache yet — show a clean loader so the popup never renders
    // a blank frame or stale counter from the previous hover session.
    screenshotPreview.loaderEl.style.display = "block";
    screenshotPreview.loaderEl.textContent = "Loading…";
    screenshotPreview.imgEl.style.display = "none";
    screenshotPreview.counterEl.style.display = "none";
    screenshotPreview.popupEl.classList.add("visible");
    updateScreenshotPreviewPosition();

    // Block until pixel data is fully in the browser's image cache.
    await waitForImageReady(nextSrc);

    // Bail out if the slide changed or the preview was closed while decoding.
    if (
      screenshotPreview.imageIndex !== capturedIndex ||
      !screenshotPreview.popupEl.classList.contains("visible")
    ) {
      return;
    }
  }

  // Image is decoded — paint it in one frame, no progressive scan.
  screenshotPreview.loaderEl.style.display = "none";
  screenshotPreview.imgEl.style.display = "block";
  screenshotPreview.popupEl.classList.add("visible");

  const img = screenshotPreview.imgEl;
  if (img.src !== nextSrc) img.src = nextSrc;

  const total = screenshotPreview.images.length;
  if (total > 1) {
    screenshotPreview.counterEl.style.display = "block";
    screenshotPreview.counterEl.textContent = `${capturedIndex + 1} / ${total}`;
  } else {
    screenshotPreview.counterEl.style.display = "none";
  }

  updateScreenshotPreviewPosition();
}

export function hideScreenshotPreview() {
  if (!screenshotPreview.popupEl) return;
  screenshotPreview.popupEl.classList.remove("visible");
  screenshotPreview.imgEl.removeAttribute("src");
}

export function updateScreenshotPreviewPosition() {
  const popup = screenshotPreview.popupEl;
  if (!popup) return;
  const padding = 16;
  const offset = 20;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = popup.getBoundingClientRect();

  let x = screenshotPreview.mouseX + offset;
  let y = screenshotPreview.mouseY + offset;

  if (x + rect.width + padding > vw) {
    x = screenshotPreview.mouseX - rect.width - offset;
  }
  if (y + rect.height + padding > vh) {
    y = vh - rect.height - padding;
  }
  if (x < padding) x = padding;
  if (y < padding) y = padding;

  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
}

// Remove the native browser tooltip from all torrent-view anchor elements in
// the listing table so the Screenshot Preview popup isn't obscured/competed
// with by the OS tooltip.  Original values are saved and can be restored.
export function suppressTorrentLinkTitles() {
  document
    .querySelectorAll('table.torrent-list td a[href^="/view/"]')
    .forEach((a) => {
      if (!screenshotPreview.titleStore.has(a)) {
        screenshotPreview.titleStore.set(a, a.getAttribute("title") ?? "");
      }
      a.removeAttribute("title");
    });
}

export function restoreTorrentLinkTitles() {
  screenshotPreview.titleStore.forEach((original, el) => {
    if (original) el.setAttribute("title", original);
  });
  screenshotPreview.titleStore.clear();
}

export function setupTitleSuppression() {
  suppressTorrentLinkTitles();

  // Watch for new rows being added (e.g. pagination, dynamic updates) so they
  // also have their titles suppressed immediately.
  const tbody = document.querySelector("table.torrent-list tbody");
  if (!tbody || screenshotPreview.titleObserver) return;

  screenshotPreview.titleObserver = new MutationObserver(() => {
    suppressTorrentLinkTitles();
  });
  screenshotPreview.titleObserver.observe(tbody, {
    childList: true,
    subtree: false,
  });
}

export function teardownTitleSuppression() {
  if (screenshotPreview.titleObserver) {
    screenshotPreview.titleObserver.disconnect();
    screenshotPreview.titleObserver = null;
  }
  restoreTorrentLinkTitles();
}

export async function initializeScreenshotPreview() {
  const prefs = await loadStoredPreferences();
  screenshotPreview.enabled = !!prefs.screenshotPreviewEnabled;
  screenshotPreview.hoverDelayMs = Math.max(
    0,
    Math.round((parseFloat(prefs.screenshotPreviewHoverDelay) || 0) * 1000),
  );
  screenshotPreview.slideDelayMs = Math.max(
    100,
    Math.round((parseFloat(prefs.screenshotPreviewSlideDelay) || 0) * 1000),
  );

  if (screenshotPreview.enabled) {
    ensureScreenshotPreviewDelegation();
    setupTitleSuppression();
  }
}
