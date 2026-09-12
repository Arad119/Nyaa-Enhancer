import { getPreferences, loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { buildNekoBTMetaRow, escapeNekoBTHtml, fetchUrlViaBackground, formatNekoBTBytes, isSupportedAnimeViewPageCategory, repositionTsukihimeRowAfterNekoBT, setAnimetoshoTabStatus, switchDescriptionPanelTab } from "../../internal.js";

// Remove the ameNZB row, restoring the original info hash row if it was integrated
export function removeAmeNZBRow() {
  const ameNZBRow = document.querySelector(".amenzb-row");
  if (!ameNZBRow) return;

  if (ameNZBRow.dataset.integrated === "true") {
    const kbd = ameNZBRow.querySelector("kbd");
    if (!kbd) return;
    const infoHash = kbd.textContent;

    // If a standalone nekoBT row exists, re-integrate it into the info hash slot
    const nekoBTRow = document.querySelector(
      ".nekobt-row:not([data-integrated])",
    );
    if (nekoBTRow) {
      const nekoBTHref = nekoBTRow.querySelector("a")?.href || "";
      nekoBTRow.remove();
      const newRow = document.createElement("div");
      newRow.className = "row nekobt-row";
      newRow.dataset.integrated = "true";
      newRow.innerHTML = `
        <div class="col-md-1">nekoBT:</div>
        <div class="col-md-5">
          <a rel="noopener noreferrer nofollow" href="${nekoBTHref}" target="_blank">
            ${nekoBTHref}
          </a>
        </div>
        <div class="col-md-1">Info hash:</div>
        <div class="col-md-5"><kbd>${infoHash}</kbd></div>
      `;
      ameNZBRow.replaceWith(newRow);
    } else {
      const restoredRow = document.createElement("div");
      restoredRow.className = "row";
      restoredRow.innerHTML = `
        <div class="col-md-offset-6 col-md-1">Info hash:</div>
        <div class="col-md-5"><kbd>${infoHash}</kbd></div>
      `;
      ameNZBRow.replaceWith(restoredRow);
    }
    repositionTsukihimeRowAfterNekoBT();
  } else {
    ameNZBRow.remove();
    repositionTsukihimeRowAfterNekoBT();
  }
}

// Lock to prevent concurrent ameNZB row DOM updates
export let ameNZBFetchInProgress = false;
export let amenzbSectionFetchId = 0;

export const ameNZBSearchCache = {
  infoHash: null,
  promise: null,
  item: null,
  fetched: false,
};

export function clearAmeNZBSearchCache() {
  ameNZBSearchCache.infoHash = null;
  ameNZBSearchCache.promise = null;
  ameNZBSearchCache.item = null;
  ameNZBSearchCache.fetched = false;
}

export function isAmeNZBSupportedViewPage() {
  return isSupportedAnimeViewPageCategory();
}

export function getAmeNZBAttr(item, name) {
  for (const el of item.querySelectorAll("attr")) {
    if (el.getAttribute("name") === name) return el.getAttribute("value");
  }
  for (const el of item.getElementsByTagName("*")) {
    if (el.localName === "attr" && el.getAttribute("name") === name) {
      return el.getAttribute("value");
    }
  }
  return null;
}

export function cleanAmeNZBTitle(title) {
  return title
    .trim()
    .replace(/\s*\{[^}]*\}\s*$/g, "")
    .trim();
}

export function formatAmeNZBPubDate(pubDate) {
  return pubDate
    .trim()
    .replace(/\s+[+-]\d{4}$/, "")
    .trim();
}

export function parseAmeNZBSearchXml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const item = xmlDoc.querySelector("item");
  if (!item) return null;

  const title = item.querySelector("title")?.textContent?.trim() || "";
  const comments = item.querySelector("comments")?.textContent?.trim() || "";
  const pubDate = item.querySelector("pubDate")?.textContent?.trim() || "";

  return {
    title,
    cleanTitle: cleanAmeNZBTitle(title),
    comments,
    pubDate,
    size: getAmeNZBAttr(item, "size"),
    grabs: getAmeNZBAttr(item, "grabs"),
    files: getAmeNZBAttr(item, "files"),
    resolution: getAmeNZBAttr(item, "resolution"),
    source: getAmeNZBAttr(item, "source"),
    language: getAmeNZBAttr(item, "language"),
    subs: getAmeNZBAttr(item, "subs"),
    season: getAmeNZBAttr(item, "season"),
    episode: getAmeNZBAttr(item, "episode"),
  };
}

export async function fetchAmeNZBSearch(infoHash, apiKey) {
  if (!apiKey || !infoHash) {
    return { item: null, link: null };
  }

  if (
    ameNZBSearchCache.infoHash === infoHash &&
    ameNZBSearchCache.fetched &&
    !ameNZBSearchCache.promise
  ) {
    return {
      item: ameNZBSearchCache.item,
      link: ameNZBSearchCache.item?.comments || null,
    };
  }

  if (ameNZBSearchCache.infoHash === infoHash && ameNZBSearchCache.promise) {
    await ameNZBSearchCache.promise;
    return {
      item: ameNZBSearchCache.item,
      link: ameNZBSearchCache.item?.comments || null,
    };
  }

  ameNZBSearchCache.infoHash = infoHash;
  ameNZBSearchCache.item = null;
  ameNZBSearchCache.fetched = false;

  ameNZBSearchCache.promise = (async () => {
    try {
      const apiUrl = `https://amenzb.moe/api?t=search&apikey=${encodeURIComponent(apiKey)}&info_hash=${encodeURIComponent(infoHash)}`;
      const result = await fetchUrlViaBackground(apiUrl);
      if (result) await incrementAmeNZBRequestCount();
      if (result?.ok) {
        ameNZBSearchCache.item = parseAmeNZBSearchXml(result.text);
      }
      ameNZBSearchCache.fetched = true;
    } finally {
      ameNZBSearchCache.promise = null;
    }
  })();

  await ameNZBSearchCache.promise;
  return {
    item: ameNZBSearchCache.item,
    link: ameNZBSearchCache.item?.comments || null,
  };
}

export function renderAmeNZBPanelContent(item) {
  let meta = "";
  meta += buildNekoBTMetaRow("Title", escapeNekoBTHtml(item.cleanTitle));
  meta += buildNekoBTMetaRow("Full title", escapeNekoBTHtml(item.title));
  if (item.comments) {
    meta += buildNekoBTMetaRow(
      "Release page",
      `<a href="${escapeNekoBTHtml(item.comments)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(item.comments)}</a>`,
    );
  }
  if (item.pubDate) {
    meta += buildNekoBTMetaRow(
      "Published",
      escapeNekoBTHtml(formatAmeNZBPubDate(item.pubDate)),
    );
  }
  if (item.size) {
    meta += buildNekoBTMetaRow(
      "Size",
      escapeNekoBTHtml(formatNekoBTBytes(item.size)),
    );
  }
  if (item.grabs != null && item.grabs !== "") {
    meta += buildNekoBTMetaRow("Grabs", escapeNekoBTHtml(item.grabs));
  }
  if (item.files != null && item.files !== "") {
    meta += buildNekoBTMetaRow("Files", escapeNekoBTHtml(item.files));
  }
  if (item.resolution) {
    meta += buildNekoBTMetaRow("Resolution", escapeNekoBTHtml(item.resolution));
  }
  if (item.source) {
    meta += buildNekoBTMetaRow("Source", escapeNekoBTHtml(item.source));
  }
  if (item.language) {
    meta += buildNekoBTMetaRow("Language", escapeNekoBTHtml(item.language));
  }
  if (item.subs) {
    meta += buildNekoBTMetaRow("Subtitles", escapeNekoBTHtml(item.subs));
  }
  if (item.season != null && item.season !== "") {
    meta += buildNekoBTMetaRow("Season", escapeNekoBTHtml(item.season));
  }
  if (item.episode != null && item.episode !== "") {
    meta += buildNekoBTMetaRow("Episode", escapeNekoBTHtml(item.episode));
  }

  return `<div class="nyaa-enhancer-nekobt-content"><dl class="nyaa-enhancer-nekobt-meta">${meta}</dl></div>`;
}

export function buildExternalServiceLinkHtml(url, notFoundLabel) {
  if (url) {
    return `<a rel="noopener noreferrer nofollow" href="${url}" target="_blank">${url}</a>`;
  }
  return `<span style="color: #999;">${notFoundLabel}</span>`;
}

// Function to add ameNZB link to supported torrent view pages
export async function addAmeNZBToViewPage() {
  if (!window.location.pathname.startsWith("/view/")) return;
  if (ameNZBFetchInProgress) return;
  if (document.querySelector(".amenzb-row")) return;

  ameNZBFetchInProgress = true;
  try {
    const prefs = await loadStoredPreferences();
    if (!prefs.showAmeNZBLinks || !prefs.ameNZBApiKey) return;

    if (!isAmeNZBSupportedViewPage()) return;

    // Guard again after async prefs load in case something raced past the lock
    if (document.querySelector(".amenzb-row")) return;

    const infoHashKbd = document.querySelector("kbd");
    if (!infoHashKbd) return;
    const infoHash = infoHashKbd.textContent.trim();

    const { link: ameNZBLink } = await fetchAmeNZBSearch(
      infoHash,
      prefs.ameNZBApiKey,
    );
    const ameNZBContent = buildExternalServiceLinkHtml(
      ameNZBLink,
      "Not found on ameNZB",
    );

    // If AnimeTosho already claimed the info hash row, append after it.
    // Otherwise (Raw or AT disabled) integrate ameNZB into the info hash row
    // so the layout mirrors what the AT row does on English-translated pages.
    const atRow = Array.from(document.querySelectorAll(".row")).find((row) =>
      row.textContent.includes("Animetosho:"),
    );

    if (atRow) {
      const newRow = document.createElement("div");
      newRow.className = "row amenzb-row";
      newRow.innerHTML = `
        <div class="col-md-1">ameNZB:</div>
        <div class="col-md-5">
          ${ameNZBContent}
        </div>
      `;
      atRow.insertAdjacentElement("afterend", newRow);
    } else {
      // Replace the offset info hash row with ameNZB on the left + info hash on the right.
      // If nekoBT is already integrated there, evict it to a standalone row first.
      const integratedNekoBT = document.querySelector(
        ".nekobt-row[data-integrated]",
      );
      if (integratedNekoBT) {
        const nekoBTHref = integratedNekoBT.querySelector("a")?.href || "";
        const newAmeNZBRow = document.createElement("div");
        newAmeNZBRow.className = "row amenzb-row";
        newAmeNZBRow.dataset.integrated = "true";
        newAmeNZBRow.innerHTML = `
          <div class="col-md-1">ameNZB:</div>
          <div class="col-md-5">
            ${ameNZBContent}
          </div>
          <div class="col-md-1">Info hash:</div>
          <div class="col-md-5"><kbd>${infoHash}</kbd></div>
        `;
        integratedNekoBT.replaceWith(newAmeNZBRow);
        if (nekoBTHref) {
          const nekoBTRow = document.createElement("div");
          nekoBTRow.className = "row nekobt-row";
          nekoBTRow.innerHTML = `
            <div class="col-md-1">nekoBT:</div>
            <div class="col-md-5">
              <a rel="noopener noreferrer nofollow" href="${nekoBTHref}" target="_blank">
                ${nekoBTHref}
              </a>
            </div>
          `;
          newAmeNZBRow.insertAdjacentElement("afterend", nekoBTRow);
          repositionTsukihimeRowAfterNekoBT();
        }
      } else {
        const infoHashRow = Array.from(document.querySelectorAll(".row")).find(
          (row) => row.textContent.includes("Info hash:"),
        );
        if (!infoHashRow) return;

        const newRow = document.createElement("div");
        newRow.className = "row amenzb-row";
        newRow.dataset.integrated = "true";
        newRow.innerHTML = `
          <div class="col-md-1">ameNZB:</div>
          <div class="col-md-5">
            ${ameNZBContent}
          </div>
          <div class="col-md-1">Info hash:</div>
          <div class="col-md-5"><kbd>${infoHash}</kbd></div>
        `;
        infoHashRow.replaceWith(newRow);
      }
    }
    repositionTsukihimeRowAfterNekoBT();
  } finally {
    ameNZBFetchInProgress = false;
  }
}

// Increment the ameNZB daily request counter, resetting at midnight UTC
export function incrementAmeNZBRequestCount() {
  return new Promise((resolve) => {
    getPreferences(
      { ameNZBRequestCount: 0, ameNZBRequestDate: "" },
      (items) => {
        const todayUTC = new Date().toISOString().slice(0, 10);
        const count =
          items.ameNZBRequestDate === todayUTC
            ? items.ameNZBRequestCount + 1
            : 1;
        savePreferences(
          { ameNZBRequestCount: count, ameNZBRequestDate: todayUTC },
          resolve,
        );
      },
    );
  });
}

export function removeAmeNZBDescriptionSection(panel) {
  panel.querySelector('[data-section="amenzb"]')?.remove();
  panel.querySelector("#amenzb-torrent-panel")?.remove();
  switchDescriptionPanelTab(panel, "description");
}

export function ensureAmeNZBDescriptionTab(panel) {
  let amenzbTab = panel.querySelector('[data-section="amenzb"]');
  if (amenzbTab) return amenzbTab;

  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return null;

  amenzbTab = document.createElement("button");
  amenzbTab.type = "button";
  amenzbTab.className = "nyaa-enhancer-desc-tab";
  amenzbTab.setAttribute("role", "tab");
  amenzbTab.setAttribute("aria-selected", "false");
  amenzbTab.dataset.section = "amenzb";
  amenzbTab.textContent = "ameNZB";
  amenzbTab.addEventListener("click", () =>
    switchDescriptionPanelTab(panel, "amenzb"),
  );

  const nekobtTab = panel.querySelector('[data-section="nekobt"]');
  if (nekobtTab) tabsHeader.insertBefore(amenzbTab, nekobtTab);
  else tabsHeader.appendChild(amenzbTab);
  return amenzbTab;
}

export function getOrCreateAmeNZBPanelBody(panel) {
  let body = panel.querySelector("#amenzb-torrent-panel");
  if (body) return body;

  body = document.createElement("div");
  body.id = "amenzb-torrent-panel";
  body.className = "panel-body nyaa-enhancer-nekobt-panel";
  body.hidden = true;
  panel.appendChild(body);
  return body;
}

export async function updateAmeNZBDescriptionSection() {
  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  if (!panel) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showAmeNZBSection || !prefs.ameNZBApiKey) {
    removeAmeNZBDescriptionSection(panel);
    return;
  }

  if (!isAmeNZBSupportedViewPage()) {
    removeAmeNZBDescriptionSection(panel);
    return;
  }

  const fetchId = ++amenzbSectionFetchId;
  ensureAmeNZBDescriptionTab(panel);
  const amenzbBody = getOrCreateAmeNZBPanelBody(panel);
  setAnimetoshoTabStatus(amenzbBody, "Loading ameNZB data…");

  const infoHash = document.querySelector("kbd")?.textContent?.trim();
  if (!infoHash) {
    if (fetchId !== amenzbSectionFetchId) return;
    setAnimetoshoTabStatus(amenzbBody, "Could not read info hash.");
    return;
  }

  const { item } = await fetchAmeNZBSearch(infoHash, prefs.ameNZBApiKey);
  if (fetchId !== amenzbSectionFetchId) return;

  if (!item) {
    setAnimetoshoTabStatus(amenzbBody, "Not found on ameNZB.");
    return;
  }

  amenzbBody.innerHTML = renderAmeNZBPanelContent(item);
}
