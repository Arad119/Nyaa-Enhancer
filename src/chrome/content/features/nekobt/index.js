import { loadStoredPreferences } from "../../../shared/prefs.js";
import { buildExternalServiceLinkHtml, fetchUrlViaBackground, isSupportedAnimeViewPageCategory, repositionTsukihimeRowAfterNekoBT, setAnimetoshoTabStatus, switchDescriptionPanelTab } from "../../internal.js";

// Lock to prevent concurrent nekoBT fetch calls
export let nekoBTFetchInProgress = false;
export let nekobtSectionFetchId = 0;
export let nekobtLangCache = null;
export let nekobtLangFetchPromise = null;

export function isNekoBTSupportedViewPage() {
  return isSupportedAnimeViewPageCategory();
}

export async function resolveNekoBTTorrentIdFromInfoHash(infoHash) {
  const apiUrl = `https://nekobt.to/api/v1/torrents/search?query=${encodeURIComponent(infoHash)}`;
  const result = await fetchUrlViaBackground(apiUrl);
  if (!result?.ok) return null;
  try {
    const json = JSON.parse(result.text);
    if (json.error || !json.data?.infohash_match) return null;
    return String(json.data.infohash_match);
  } catch {
    return null;
  }
}

export async function fetchNekoBTTorrentData(torrentId) {
  const apiUrl = `https://nekobt.to/api/v1/torrents/${encodeURIComponent(torrentId)}`;
  const result = await fetchUrlViaBackground(apiUrl);
  if (!result?.ok) return null;
  try {
    const json = JSON.parse(result.text);
    if (json.error || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

export function escapeNekoBTHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatNekoBTBytes(size) {
  const n = Number(size);
  if (!isFinite(n) || n < 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const decimals = i === 0 ? 0 : v >= 100 ? 0 : 1;
  return `${v.toFixed(decimals)} ${units[i]}`;
}

export function formatNekoBTTimestamp(ms) {
  const n = Number(ms);
  if (!isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleString();
}

export async function loadNekoBTLangData() {
  if (nekobtLangCache) return nekobtLangCache;
  if (!nekobtLangFetchPromise) {
    nekobtLangFetchPromise = (async () => {
      const result = await fetchUrlViaBackground(
        "https://nekobt.to/api/v1/langs",
      );
      if (!result?.ok) return null;
      try {
        const json = JSON.parse(result.text);
        if (json.error || !json.data?.langs) return null;
        nekobtLangCache = {
          langs: json.data.langs,
          convert: json.data.convert || {},
        };
        return nekobtLangCache;
      } catch {
        return null;
      } finally {
        nekobtLangFetchPromise = null;
      }
    })();
  }
  return nekobtLangFetchPromise;
}

export function resolveNekoBTLangCode(rawCode, langData) {
  const trimmed = rawCode.trim();
  if (!trimmed) return trimmed;
  let code = trimmed.toLowerCase();
  if (langData.convert[code]) code = langData.convert[code];
  if (langData.langs[code]) return code;
  if (langData.langs[trimmed]) return trimmed;
  if (langData.convert[trimmed]) {
    const converted = langData.convert[trimmed];
    if (langData.langs[converted]) return converted;
  }
  return trimmed;
}

export function getNekoBTLangDisplayName(rawCode, langData) {
  const code = resolveNekoBTLangCode(rawCode, langData);
  const entry = langData.langs[code];
  if (entry?.name) return entry.name;
  return rawCode.trim();
}

export function formatNekoBTLangList(value, useFullNames, langData) {
  if (!value || typeof value !== "string") return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const codes = trimmed
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!codes.length) return "—";
  if (!useFullNames || !langData) return codes.join(", ");
  return codes.map((c) => getNekoBTLangDisplayName(c, langData)).join(", ");
}

export function renderNekoBTSimpleMarkdown(md) {
  let html = escapeNekoBTHtml(md);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const safeUrl = url.trim();
    if (!/^https?:\/\//i.test(safeUrl)) return text;
    return `<a href="${escapeNekoBTHtml(safeUrl)}" rel="noopener noreferrer nofollow" target="_blank">${text}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

export function buildNekoBTMetaRow(label, valueHtml) {
  if (!valueHtml) return "";
  return `<div class="nyaa-enhancer-nekobt-meta-row"><dt>${escapeNekoBTHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
}

export function renderNekoBTPanelContent(data, prefs, langData) {
  const useFullLangNames = !!prefs.showNekoBTFullLangNames;
  const torrentUrl = `https://nekobt.to/torrents/${encodeURIComponent(data.id)}`;
  const titleHtml = `<a href="${escapeNekoBTHtml(torrentUrl)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(data.title || "View on nekoBT")}</a>`;

  const uploader = data.uploader;
  const uploaderHtml = uploader
    ? `<a href="https://nekobt.to/users/${encodeURIComponent(uploader.id)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(uploader.display_name || uploader.username)}</a>`
    : "Anonymous";

  const group = data.groups?.[0];
  const groupHtml = group
    ? `<a href="https://nekobt.to/groups/${encodeURIComponent(group.id)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(group.display_name || group.name)}</a>${group.tagline ? ` <span class="nyaa-enhancer-nekobt-muted">— ${escapeNekoBTHtml(group.tagline)}</span>` : ""}`
    : null;

  const flags = [];
  if (data.batch) flags.push("Batch");
  if (data.hardsub) flags.push("Hardsub");
  if (data.mtl) flags.push("MTL");
  if (data.otl) flags.push("OTL");
  const flagsHtml = flags.length ? escapeNekoBTHtml(flags.join(", ")) : null;

  let meta = "";
  meta += buildNekoBTMetaRow("Title", titleHtml);
  meta += buildNekoBTMetaRow("Uploader", uploaderHtml);
  if (groupHtml) meta += buildNekoBTMetaRow("Group", groupHtml);
  meta += buildNekoBTMetaRow(
    "Swarm",
    `${escapeNekoBTHtml(data.seeders ?? "?")} seeders · ${escapeNekoBTHtml(data.leechers ?? "?")} leechers · ${escapeNekoBTHtml(data.completed ?? "?")} completed`,
  );
  meta += buildNekoBTMetaRow(
    "Health",
    data.torrent_health != null
      ? `${escapeNekoBTHtml(data.torrent_health)}%`
      : "—",
  );
  meta += buildNekoBTMetaRow(
    "Size",
    escapeNekoBTHtml(formatNekoBTBytes(data.filesize)),
  );
  meta += buildNekoBTMetaRow(
    "Uploaded",
    escapeNekoBTHtml(formatNekoBTTimestamp(data.uploaded_at)),
  );
  meta += buildNekoBTMetaRow(
    "Info hash",
    `<code>${escapeNekoBTHtml(data.infohash || "")}</code>`,
  );
  meta += buildNekoBTMetaRow(
    "Audio",
    escapeNekoBTHtml(
      formatNekoBTLangList(data.audio_lang, useFullLangNames, langData),
    ),
  );
  meta += buildNekoBTMetaRow(
    "Subtitles",
    escapeNekoBTHtml(
      formatNekoBTLangList(data.sub_lang, useFullLangNames, langData),
    ),
  );
  if (data.fsub_lang) {
    meta += buildNekoBTMetaRow(
      "Forced subs",
      escapeNekoBTHtml(
        formatNekoBTLangList(data.fsub_lang, useFullLangNames, langData),
      ),
    );
  }
  if (flagsHtml) meta += buildNekoBTMetaRow("Tags", flagsHtml);

  const files = Array.isArray(data.files) ? data.files : [];
  const filesHtml = files.length
    ? `<ul class="nyaa-enhancer-nekobt-file-list">${files
        .map(
          (f) =>
            `<li><i class="fa fa-file"></i> ${escapeNekoBTHtml(f.name || f.path)} <span class="file-size">(${escapeNekoBTHtml(formatNekoBTBytes(f.length))})</span></li>`,
        )
        .join("")}</ul>`
    : "";

  const screenshots = Array.isArray(data.screenshots) ? data.screenshots : [];
  const screenshotsHtml = screenshots.length
    ? `<div class="nyaa-enhancer-nekobt-screenshots">${screenshots
        .map(
          (url) =>
            `<a href="${escapeNekoBTHtml(url)}" target="_blank" rel="noopener noreferrer nofollow"><img src="${escapeNekoBTHtml(url)}" alt="Screenshot" loading="lazy"></a>`,
        )
        .join("")}</div>`
    : "";

  const description = data.description?.trim();
  const descriptionHtml = description
    ? `<div class="nyaa-enhancer-nekobt-block"><h4>Description</h4><div class="nyaa-enhancer-nekobt-markdown">${renderNekoBTSimpleMarkdown(description)}</div></div>`
    : "";

  const mediainfo = data.mediainfo?.trim();
  const mediainfoHtml = mediainfo
    ? `<div class="nyaa-enhancer-nekobt-block"><h4>MediaInfo</h4><pre class="nyaa-enhancer-nekobt-mediainfo">${escapeNekoBTHtml(mediainfo)}</pre></div>`
    : "";

  return `
    <div class="nyaa-enhancer-nekobt-content">
      <dl class="nyaa-enhancer-nekobt-meta">${meta}</dl>
      ${filesHtml ? `<div class="nyaa-enhancer-nekobt-block"><h4>Files</h4>${filesHtml}</div>` : ""}
      ${descriptionHtml}
      ${mediainfoHtml}
      ${screenshotsHtml ? `<div class="nyaa-enhancer-nekobt-block"><h4>Screenshots</h4>${screenshotsHtml}</div>` : ""}
    </div>
  `;
}

export function removeNekoBTDescriptionSection(panel) {
  panel.querySelector('[data-section="nekobt"]')?.remove();
  panel.querySelector("#nekobt-torrent-panel")?.remove();
  switchDescriptionPanelTab(panel, "description");
}

export function ensureNekoBTDescriptionTab(panel) {
  let nekobtTab = panel.querySelector('[data-section="nekobt"]');
  if (nekobtTab) return nekobtTab;

  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return null;

  nekobtTab = document.createElement("button");
  nekobtTab.type = "button";
  nekobtTab.className = "nyaa-enhancer-desc-tab";
  nekobtTab.setAttribute("role", "tab");
  nekobtTab.setAttribute("aria-selected", "false");
  nekobtTab.dataset.section = "nekobt";
  nekobtTab.textContent = "NekoBT";
  nekobtTab.addEventListener("click", () =>
    switchDescriptionPanelTab(panel, "nekobt"),
  );
  tabsHeader.appendChild(nekobtTab);
  return nekobtTab;
}

export function getOrCreateNekoBTPanelBody(panel) {
  let body = panel.querySelector("#nekobt-torrent-panel");
  if (body) return body;

  body = document.createElement("div");
  body.id = "nekobt-torrent-panel";
  body.className = "panel-body nyaa-enhancer-nekobt-panel";
  body.hidden = true;
  panel.appendChild(body);
  return body;
}

export async function updateNekoBTDescriptionSection() {
  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  if (!panel) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showNekoBTSection) {
    removeNekoBTDescriptionSection(panel);
    return;
  }

  if (!isNekoBTSupportedViewPage()) {
    removeNekoBTDescriptionSection(panel);
    return;
  }

  const fetchId = ++nekobtSectionFetchId;
  ensureNekoBTDescriptionTab(panel);
  const nekobtBody = getOrCreateNekoBTPanelBody(panel);
  setAnimetoshoTabStatus(nekobtBody, "Loading nekoBT data…");

  const infoHash = document.querySelector("kbd")?.textContent?.trim();
  if (!infoHash) {
    if (fetchId !== nekobtSectionFetchId) return;
    setAnimetoshoTabStatus(nekobtBody, "Could not read info hash.");
    return;
  }

  const torrentId = await resolveNekoBTTorrentIdFromInfoHash(infoHash);
  if (fetchId !== nekobtSectionFetchId) return;

  if (!torrentId) {
    setAnimetoshoTabStatus(nekobtBody, "Not found on nekoBT.");
    return;
  }

  const data = await fetchNekoBTTorrentData(torrentId);
  if (fetchId !== nekobtSectionFetchId) return;

  if (!data) {
    setAnimetoshoTabStatus(
      nekobtBody,
      "Failed to load nekoBT torrent details.",
    );
    return;
  }

  let langData = null;
  if (prefs.showNekoBTFullLangNames) {
    langData = await loadNekoBTLangData();
  }
  if (fetchId !== nekobtSectionFetchId) return;

  nekobtBody.innerHTML = renderNekoBTPanelContent(data, prefs, langData);
}

// Remove the nekoBT row, restoring the original info hash row if it was integrated
export function removeNekoBTRow() {
  const nekoBTRow = document.querySelector(".nekobt-row");
  if (!nekoBTRow) return;
  if (nekoBTRow.dataset.integrated === "true") {
    const kbd = nekoBTRow.querySelector("kbd");
    if (kbd) {
      const restoredRow = document.createElement("div");
      restoredRow.className = "row";
      restoredRow.innerHTML = `
        <div class="col-md-offset-6 col-md-1">Info hash:</div>
        <div class="col-md-5"><kbd>${kbd.textContent}</kbd></div>
      `;
      nekoBTRow.replaceWith(restoredRow);
    }
    repositionTsukihimeRowAfterNekoBT();
  } else {
    nekoBTRow.remove();
    repositionTsukihimeRowAfterNekoBT();
  }
}

// Function to add nekoBT link to supported torrent view pages
export async function addNekoBTToViewPage() {
  if (!window.location.pathname.startsWith("/view/")) return;
  if (nekoBTFetchInProgress) return;
  if (document.querySelector(".nekobt-row")) return;

  nekoBTFetchInProgress = true;
  try {
    const prefs = await loadStoredPreferences();
    if (!prefs.showNekoBTLinks) return;
    if (!isNekoBTSupportedViewPage()) return;

    if (document.querySelector(".nekobt-row")) return;

    const infoHashKbd = document.querySelector("kbd");
    if (!infoHashKbd) return;
    const infoHash = infoHashKbd.textContent.trim();

    const torrentId = await resolveNekoBTTorrentIdFromInfoHash(infoHash);
    const nekoBTLink = torrentId
      ? `https://nekobt.to/torrents/${torrentId}`
      : null;
    const nekoBTContent = buildExternalServiceLinkHtml(
      nekoBTLink,
      "Not found on nekoBT",
    );

    // If another row already claimed the info hash slot, append after the last of them.
    // Otherwise (Raw page with no AT and no ameNZB) integrate into the info hash row.
    const anchorRow =
      document.querySelector(".amenzb-row") ||
      Array.from(document.querySelectorAll(".row")).find((row) =>
        row.textContent.includes("Animetosho:"),
      );

    if (anchorRow) {
      const newRow = document.createElement("div");
      newRow.className = "row nekobt-row";
      newRow.innerHTML = `
        <div class="col-md-1">nekoBT:</div>
        <div class="col-md-5">
          ${nekoBTContent}
        </div>
      `;
      anchorRow.insertAdjacentElement("afterend", newRow);
    } else {
      // Replace the offset info hash row with nekoBT on the left + info hash on the right
      const infoHashRow = Array.from(document.querySelectorAll(".row")).find(
        (row) => row.textContent.includes("Info hash:"),
      );
      if (!infoHashRow) return;

      const newRow = document.createElement("div");
      newRow.className = "row nekobt-row";
      newRow.dataset.integrated = "true";
      newRow.innerHTML = `
        <div class="col-md-1">nekoBT:</div>
        <div class="col-md-5">
          ${nekoBTContent}
        </div>
        <div class="col-md-1">Info hash:</div>
        <div class="col-md-5"><kbd>${infoHash}</kbd></div>
      `;
      infoHashRow.replaceWith(newRow);
    }
    repositionTsukihimeRowAfterNekoBT();
  } finally {
    nekoBTFetchInProgress = false;
  }
}
