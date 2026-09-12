import { loadStoredPreferences } from "../../../shared/prefs.js";
import { getInfoHashFromMagnet, isNyaaTorrentDataRow } from "../../internal.js";

// ── SeaDex (Best Release Highlighting) ──────────────────────────────────────

export let seaDexStylesInjected = false;
export let seaDexViewFetchInProgress = false;

export function injectSeaDexStyles() {
  if (seaDexStylesInjected) return;
  seaDexStylesInjected = true;
  const style = document.createElement("style");
  style.id = "seadex-styles";
  style.textContent = `
    .seadex-best { background-color: rgba(0, 172, 255, 0.12) !important; }
    .seadex-best:hover { background-color: rgba(0, 172, 255, 0.18) !important; }
    .seadex-best-alt { background-color: rgba(255, 172, 0, 0.12) !important; }
    .seadex-best-alt:hover { background-color: rgba(255, 172, 0, 0.18) !important; }
  `;
  document.head.appendChild(style);
}

export function removeSeaDexHighlights() {
  document.querySelectorAll(".seadex-best, .seadex-best-alt").forEach((el) => {
    el.classList.remove("seadex-best", "seadex-best-alt");
  });
  document.querySelectorAll(".seadex-link").forEach((el) => el.remove());
  const styleEl = document.getElementById("seadex-styles");
  if (styleEl) {
    styleEl.remove();
    seaDexStylesInjected = false;
  }
  seaDexViewFetchInProgress = false;
}

export async function seaDexFetch(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "fetchUrl", url }, resolve);
  });
}

export async function applySeaDexToListPage(targetRows = null) {
  const rows = targetRows
    ? Array.from(targetRows)
    : Array.from(document.querySelectorAll("table.torrent-list tbody tr"));
  const infoHashList = [];

  rows.forEach((row) => {
    if (!isNyaaTorrentDataRow(row)) return;
    const magnetLink = row.querySelector('a[href^="magnet:"]');
    const infoHash = magnetLink ? getInfoHashFromMagnet(magnetLink.href) : "";
    infoHashList.push({ element: row, infoHash });
  });

  const validEntries = infoHashList.filter(({ infoHash }) => infoHash);
  if (!validEntries.length) return;

  // Clear previous highlights on the rows we're updating before re-fetching
  if (!targetRows) {
    infoHashList.forEach(({ element }) => {
      element.classList.remove("seadex-best", "seadex-best-alt");
    });
  }

  const filterParam = validEntries
    .map(({ infoHash }) => `infoHash="${infoHash}"`)
    .join("||");

  const apiUrl =
    `https://releases.moe/api/collections/torrents/records` +
    `?filter=${encodeURIComponent(filterParam)}&skipTotal=true&perPage=75`;

  const result = await seaDexFetch(apiUrl);
  if (!result?.ok) return;

  let json;
  try {
    json = JSON.parse(result.text);
  } catch {
    return;
  }

  if (!json.items?.length) return;

  const bestHashes = new Set(
    json.items.filter((t) => t.isBest).map((t) => t.infoHash.toLowerCase()),
  );
  const altHashes = new Set(
    json.items.filter((t) => !t.isBest).map((t) => t.infoHash.toLowerCase()),
  );

  for (const { element, infoHash } of validEntries) {
    if (bestHashes.has(infoHash)) element.classList.add("seadex-best");
    else if (altHashes.has(infoHash)) element.classList.add("seadex-best-alt");
  }
}

export async function applySeaDexToViewPage() {
  if (!window.location.pathname.startsWith("/view/")) return;
  if (document.querySelector(".seadex-link")) return;
  if (seaDexViewFetchInProgress) return;

  seaDexViewFetchInProgress = true;
  try {
    const infoHashKbd = document.querySelector("kbd");
    if (!infoHashKbd) return;
    const infoHash = infoHashKbd.textContent.trim().toLowerCase();
    if (!infoHash) return;

    const apiUrl =
      `https://releases.moe/api/collections/entries/records` +
      `?filter=${encodeURIComponent(`trs.infoHash?="${infoHash}"`)}&expand=trs&skipTotal=true`;

    const result = await seaDexFetch(apiUrl);
    if (!result?.ok) return;

    let json;
    try {
      json = JSON.parse(result.text);
    } catch {
      return;
    }

    if (!json.items?.length) return;

    // Determine best/alt from the expanded trs array
    const matchingTr = json.items[0].expand?.trs?.find(
      (t) => t.infoHash?.toLowerCase() === infoHash,
    );
    const isBest = matchingTr?.isBest ?? false;

    // Apply highlight class to the main panel
    const panel = document.querySelector(".panel");
    if (panel) {
      panel.classList.add(isBest ? "seadex-best" : "seadex-best-alt");
    }

    // Add "Go to SeaDex" button(s) near the magnet link
    const magnetLink = document.querySelector('a[href^="magnet:"]');
    if (magnetLink) {
      for (const entry of json.items) {
        const seaDexBtn = document.createElement("button");
        seaDexBtn.className = "magnet-button seadex-link";
        seaDexBtn.textContent = "Go to SeaDex";
        seaDexBtn.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
        seaDexBtn.style.fontWeight = "500";
        seaDexBtn.style.marginLeft = "10px";
        seaDexBtn.addEventListener("click", () => {
          window.open(
            `https://releases.moe/${entry.alID}`,
            "_blank",
            "noopener,noreferrer",
          );
        });
        magnetLink.parentNode.insertBefore(seaDexBtn, magnetLink.nextSibling);
      }
    }
  } finally {
    seaDexViewFetchInProgress = false;
  }
}

export async function initializeSeaDex() {
  const prefs = await loadStoredPreferences();
  if (!prefs.showSeaDex) return;

  injectSeaDexStyles();

  if (window.location.pathname.startsWith("/view/")) {
    applySeaDexToViewPage();
  } else {
    applySeaDexToListPage();
  }
}
