import {
  getInfoHashFromMagnet,
  getTitleFromRow,
  getTorrentIdFromRow,
  getTorrentInfoHashFromRow,
} from "../../core/rows.js";
import { recordHistory } from "./store.js";

export function getViewPageTorrentId() {
  const match = window.location.pathname.match(/^\/view\/(\d+)/);
  return match ? match[1] : null;
}

export function getViewPageTorrentTitle() {
  const heading = document.querySelector(
    ".container .panel .panel-heading .panel-title",
  );
  if (heading) {
    const clone = heading.cloneNode(true);
    clone.querySelectorAll("a, .comments").forEach((el) => el.remove());
    const text = clone.textContent.replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return document.title.replace(/\s*::\s*Nyaa\s*$/i, "").trim();
}

export function getViewPageMagnetHref() {
  return (
    document.querySelector(
      ".panel-footer a[href^='magnet:'], .panel a[href^='magnet:'], a[href^='magnet:']",
    )?.href || ""
  );
}

export function getViewPageInfoHash() {
  return getInfoHashFromMagnet(getViewPageMagnetHref());
}

export function getViewPageHistoryItem() {
  const id = getViewPageTorrentId();
  if (!id) return null;
  return {
    id,
    title: getViewPageTorrentTitle(),
    hash: getViewPageInfoHash(),
  };
}

export function historyItemFromRow(row) {
  if (!row) return null;
  const id = getTorrentIdFromRow(row);
  if (!id) return null;
  return {
    id,
    title: getTitleFromRow(row) || "",
    hash: getTorrentInfoHashFromRow(row),
  };
}

export function historyItemsFromRows(rows) {
  return Array.from(rows || [])
    .map(historyItemFromRow)
    .filter(Boolean);
}

export function historyItemFromElement(el) {
  const row = el?.closest?.("tr");
  return historyItemFromRow(row) || getViewPageHistoryItem();
}

export function parseTorrentIdFromHref(href) {
  if (!href) return null;
  const viewMatch = String(href).match(/\/view\/(\d+)/);
  if (viewMatch) return viewMatch[1];
  const downloadMatch = String(href).match(/\/download\/(\d+)/);
  return downloadMatch ? downloadMatch[1] : null;
}

export function historyItemFromDownload(torrent) {
  const id =
    torrent?.id || parseTorrentIdFromHref(torrent?.url || torrent?.href || "");
  if (!id) return null;
  const hash =
    torrent?.hash ||
    getInfoHashFromMagnet(torrent?.magnet || torrent?.magnetUrl || "") ||
    (parseTorrentIdFromHref(window.location.pathname) === String(id)
      ? getViewPageInfoHash()
      : "");
  return {
    id,
    title: torrent?.title || torrent?.filename || "",
    hash,
  };
}

export function recordHistoryAction(action, items) {
  return recordHistory(action, items);
}

export function initHistoryLogging() {
  const path = window.location.pathname;
  if (path === "/history" || path === "/settings" || path === "/changelog") {
    return;
  }

  if (path.startsWith("/view/") && document.querySelector('a[href^="magnet:"]')) {
    const item = getViewPageHistoryItem();
    if (item) recordHistory("visit", item);
  }

  if (document.documentElement.dataset.neHistoryClicks === "1") return;
  document.documentElement.dataset.neHistoryClicks = "1";

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest?.('a[href*="/download/"]');
      if (!link || link.classList.contains("ne-history-ignore")) return;

      let url;
      try {
        url = new URL(link.href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!/\/download\/\d+(?:\.torrent)?$/i.test(url.pathname)) return;

      const item =
        historyItemFromElement(link) ||
        historyItemFromDownload({
          href: url.href,
          title: getViewPageTorrentTitle(),
          hash: getViewPageInfoHash(),
        });
      if (item) recordHistory("download", item);
    },
    true,
  );
}
