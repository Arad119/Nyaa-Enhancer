import { loadStoredPreferences } from "../../../shared/prefs.js";
import { buildExternalServiceLinkHtml, buildNekoBTMetaRow, escapeNekoBTHtml, fetchUrlViaBackground, formatNekoBTBytes, isNekoBTSupportedViewPage, setAnimetoshoTabStatus, switchDescriptionPanelTab } from "../../internal.js";

// ── Tsukihime (view page links + description section) ───────────────────────

export let tsukihimeFetchInProgress = false;
export let tsukihimeSectionFetchId = 0;

export const tsukihimeSearchCache = {
  infoHash: null,
  promise: null,
  data: null,
  fetched: false,
};

export const tsukihimeFileMediainfoCache = new Map();

export function clearTsukihimeSearchCache() {
  tsukihimeSearchCache.infoHash = null;
  tsukihimeSearchCache.promise = null;
  tsukihimeSearchCache.data = null;
  tsukihimeSearchCache.fetched = false;
  tsukihimeFileMediainfoCache.clear();
}

export function isTsukihimeSupportedViewPage() {
  return isNekoBTSupportedViewPage();
}

export function getTsukihimeRowAnchor() {
  return (
    document.querySelector(".nekobt-row") ||
    document.querySelector(".amenzb-row") ||
    Array.from(document.querySelectorAll(".row")).find((row) =>
      row.textContent.includes("Animetosho:"),
    ) ||
    Array.from(document.querySelectorAll(".row")).find((row) =>
      row.textContent.includes("Info hash:"),
    )
  );
}

export function repositionTsukihimeRowAfterNekoBT() {
  const row = document.querySelector(".tsukihime-row");
  if (!row) return;
  const anchor = getTsukihimeRowAnchor();
  if (!anchor || anchor === row) return;
  if (row.previousElementSibling === anchor) return;
  anchor.insertAdjacentElement("afterend", row);
}

export function formatTsukihimeTimestamp(sec) {
  const n = Number(sec);
  if (!isFinite(n) || n <= 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

export function formatTsukihimeLangCodes(langs) {
  if (!Array.isArray(langs) || !langs.length) return "—";
  return langs.join(", ");
}

export function aggregateTsukihimeTrackerStats(trackers) {
  if (!Array.isArray(trackers) || !trackers.length) return null;
  let seeders = 0;
  let leechers = 0;
  let complete = 0;
  for (const tracker of trackers) {
    seeders = Math.max(seeders, Number(tracker.seeders) || 0);
    leechers = Math.max(leechers, Number(tracker.leechers) || 0);
    complete = Math.max(complete, Number(tracker.complete) || 0);
  }
  return { seeders, leechers, complete };
}

export function stripTsukihimeHtml(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function renderTsukihimeLinkChips(links) {
  if (!links || typeof links !== "object") return "";
  const entries = Object.entries(links).filter(([, url]) => url);
  if (!entries.length) return "";
  return `<div class="nyaa-enhancer-tsukihime-link-chips">${entries
    .map(
      ([label, url]) =>
        `<a class="nyaa-enhancer-tsukihime-chip" href="${escapeNekoBTHtml(url)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(label)}</a>`,
    )
    .join("")}</div>`;
}

export function summarizeTsukihimeAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return { subtitles: [], fonts: [], other: [] };
  }
  const subtitles = [];
  const fonts = [];
  const other = [];
  for (const att of attachments) {
    if (att.type === 1) {
      const info = att.info || {};
      const label = [
        info.lang,
        info.codec,
        info.name,
        info.forced ? "forced" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      subtitles.push(label || "Subtitle");
    } else if (att.type === 0) {
      fonts.push(att.info?.name || "Font file");
    } else if (att.type !== 2 && att.type !== 3) {
      other.push(`Attachment (type ${att.type})`);
    }
  }
  return { subtitles, fonts, other };
}

export function renderTsukihimeCollapsibleList(summaryText, items) {
  if (!items.length) return "";
  const chevron = `<span class="nyaa-enhancer-tsukihime-files-chevron" aria-hidden="true"><i class="fa fa-chevron-right"></i><i class="fa fa-chevron-down"></i></span>`;
  const listHtml = `<ul class="nyaa-enhancer-tsukihime-sub-list">${items
    .map((item) => `<li>${escapeNekoBTHtml(item)}</li>`)
    .join("")}</ul>`;
  return `<details class="nyaa-enhancer-tsukihime-files-collapsible nyaa-enhancer-tsukihime-attachment-collapsible">
    <summary class="nyaa-enhancer-tsukihime-attachment-summary">${chevron}${escapeNekoBTHtml(summaryText)}</summary>
    ${listHtml}
  </details>`;
}

export async function fetchTsukihimeFileMediainfo(torrentId, fileId) {
  const key = `${torrentId}:${fileId}`;
  if (tsukihimeFileMediainfoCache.has(key)) {
    return tsukihimeFileMediainfoCache.get(key);
  }

  const apiUrl = `https://api.tsukihime.org/v1/torrents/${encodeURIComponent(torrentId)}/file/${encodeURIComponent(fileId)}`;
  const result = await fetchUrlViaBackground(apiUrl);
  if (!result?.ok) {
    tsukihimeFileMediainfoCache.set(key, null);
    return null;
  }

  try {
    const json = JSON.parse(result.text);
    const mediainfo = json.mediainfo?.trim() || null;
    tsukihimeFileMediainfoCache.set(key, mediainfo);
    return mediainfo;
  } catch {
    tsukihimeFileMediainfoCache.set(key, null);
    return null;
  }
}

export function ensureTsukihimePanelClickHandler(body) {
  if (!body || body.dataset.clickBound === "true") return;
  body.dataset.clickBound = "true";
  body.addEventListener("click", onTsukihimePanelClick);
}

export async function onTsukihimePanelClick(event) {
  const btn = event.target.closest(".nyaa-enhancer-tsukihime-mediainfo-btn");
  if (!btn) return;
  event.preventDefault();
  await toggleTsukihimeFileMediainfo(btn);
}

export async function toggleTsukihimeFileMediainfo(btn) {
  const card = btn.closest(".nyaa-enhancer-tsukihime-file-card");
  if (!card) return;

  const panel = card.querySelector(".nyaa-enhancer-tsukihime-mediainfo-panel");
  const torrentId = btn.dataset.torrentId;
  const fileId = btn.dataset.fileId;
  if (!panel || !torrentId || !fileId) return;

  if (!panel.hidden && panel.dataset.loaded === "true") {
    panel.hidden = true;
    btn.textContent = "Show MediaInfo";
    return;
  }

  panel.hidden = false;
  if (panel.dataset.loaded === "true") {
    btn.textContent = "Hide MediaInfo";
    return;
  }

  panel.innerHTML =
    '<p class="nyaa-enhancer-nekobt-status">Loading MediaInfo…</p>';
  btn.disabled = true;

  const mediainfo = await fetchTsukihimeFileMediainfo(torrentId, fileId);
  btn.disabled = false;

  if (!mediainfo) {
    panel.innerHTML =
      '<p class="nyaa-enhancer-nekobt-status">MediaInfo not available.</p>';
    panel.dataset.loaded = "true";
    btn.textContent = "Show MediaInfo";
    return;
  }

  panel.innerHTML = `<pre class="nyaa-enhancer-nekobt-mediainfo">${escapeNekoBTHtml(mediainfo)}</pre>`;
  panel.dataset.loaded = "true";
  btn.textContent = "Hide MediaInfo";
}

export function renderTsukihimeFileCard(file, torrentId) {
  const displayName =
    file.filename?.split("/").pop() || file.filename || "Unknown file";
  const linksHtml = renderTsukihimeLinkChips(file.links);
  const audioLinksHtml = file.links_audio
    ? `<div class="nyaa-enhancer-tsukihime-link-group">
        <span class="nyaa-enhancer-tsukihime-link-label">Audio downloads</span>
        ${renderTsukihimeLinkChips(file.links_audio)}
      </div>`
    : "";
  const { subtitles, fonts, other } = summarizeTsukihimeAttachments(
    file.attachments,
  );

  let attachmentsHtml = "";
  if (subtitles.length) {
    attachmentsHtml += renderTsukihimeCollapsibleList(
      `${subtitles.length} subtitle${subtitles.length === 1 ? "" : "s"}`,
      subtitles,
    );
  }
  if (fonts.length) {
    attachmentsHtml += renderTsukihimeCollapsibleList(
      `${fonts.length} font file${fonts.length === 1 ? "" : "s"}`,
      fonts,
    );
  }
  if (other.length) {
    attachmentsHtml += renderTsukihimeCollapsibleList(
      `${other.length} other attachment${other.length === 1 ? "" : "s"}`,
      other,
    );
  }

  const mediainfoBtnHtml =
    torrentId != null && file.id != null
      ? `<button type="button" class="nyaa-enhancer-tsukihime-mediainfo-btn" data-torrent-id="${escapeNekoBTHtml(String(torrentId))}" data-file-id="${escapeNekoBTHtml(String(file.id))}">Show MediaInfo</button>`
      : "";

  return `
    <article class="nyaa-enhancer-tsukihime-file-card">
      <div class="nyaa-enhancer-tsukihime-file-header">
        <span class="nyaa-enhancer-tsukihime-file-name">${escapeNekoBTHtml(displayName)}</span>
        <span class="nyaa-enhancer-tsukihime-file-size">${escapeNekoBTHtml(formatNekoBTBytes(file.size))}</span>
      </div>
      ${mediainfoBtnHtml}
      <div class="nyaa-enhancer-tsukihime-mediainfo-panel" hidden></div>
      ${
        linksHtml
          ? `<div class="nyaa-enhancer-tsukihime-link-group">
              <span class="nyaa-enhancer-tsukihime-link-label">Video downloads</span>
              ${linksHtml}
            </div>`
          : ""
      }
      ${audioLinksHtml}
      ${
        attachmentsHtml
          ? `<div class="nyaa-enhancer-tsukihime-link-group">
              <span class="nyaa-enhancer-tsukihime-link-label">Attachments</span>
              ${attachmentsHtml}
            </div>`
          : ""
      }
    </article>
  `;
}

export function renderTsukihimePanelContent(data) {
  const viewUrl = `https://tsukihime.org/view/${encodeURIComponent(data.id)}`;
  const titleHtml = `<a href="${escapeNekoBTHtml(viewUrl)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(data.name || "View on Tsukihime")}</a>`;

  const anime = data.anime;
  let animeHtml = null;
  if (anime) {
    const animeUrl = `https://tsukihime.org/anime/${encodeURIComponent(anime.id)}`;
    const animeTitle = anime.english_title
      ? `${anime.title} (${anime.english_title})`
      : anime.title;
    animeHtml = `<a href="${escapeNekoBTHtml(animeUrl)}" rel="noopener noreferrer nofollow" target="_blank">${escapeNekoBTHtml(animeTitle)}</a>`;
    if (anime.release_year) {
      animeHtml += ` <span class="nyaa-enhancer-tsukihime-muted">(${escapeNekoBTHtml(anime.release_year)})</span>`;
    }
  }

  const group = data.group;
  const groupHtml = group ? escapeNekoBTHtml(group.name || group.id) : null;

  const stats = aggregateTsukihimeTrackerStats(data.trackers);

  let meta = "";
  meta += buildNekoBTMetaRow("Title", titleHtml);
  if (animeHtml) meta += buildNekoBTMetaRow("Anime", animeHtml);
  if (groupHtml) meta += buildNekoBTMetaRow("Group", groupHtml);
  if (stats) {
    meta += buildNekoBTMetaRow(
      "Swarm",
      `${escapeNekoBTHtml(stats.seeders)} seeders · ${escapeNekoBTHtml(stats.leechers)} leechers · ${escapeNekoBTHtml(stats.complete)} completed`,
    );
  }
  meta += buildNekoBTMetaRow(
    "Total size",
    escapeNekoBTHtml(formatNekoBTBytes(data.totalsize)),
  );
  if (data.filecount != null) {
    meta += buildNekoBTMetaRow("Files", escapeNekoBTHtml(data.filecount));
  }
  if (data.episode_no != null && data.episode_no !== "") {
    meta += buildNekoBTMetaRow("Episode", escapeNekoBTHtml(data.episode_no));
  }
  meta += buildNekoBTMetaRow(
    "Audio",
    escapeNekoBTHtml(formatTsukihimeLangCodes(data.audiolangs)),
  );
  meta += buildNekoBTMetaRow(
    "Subtitles",
    escapeNekoBTHtml(formatTsukihimeLangCodes(data.sublangs)),
  );
  if (data.source_date) {
    meta += buildNekoBTMetaRow(
      "Source date",
      escapeNekoBTHtml(formatTsukihimeTimestamp(data.source_date)),
    );
  }
  if (data.added_date) {
    meta += buildNekoBTMetaRow(
      "Added",
      escapeNekoBTHtml(formatTsukihimeTimestamp(data.added_date)),
    );
  }
  if (data.state) {
    meta += buildNekoBTMetaRow("State", escapeNekoBTHtml(data.state));
  }
  if (data.has_nzb != null) {
    meta += buildNekoBTMetaRow("NZB available", data.has_nzb ? "Yes" : "No");
  }
  meta += buildNekoBTMetaRow(
    "Info hash",
    `<code>${escapeNekoBTHtml(data.btih || "")}</code>`,
  );

  const files = Array.isArray(data.files) ? data.files : [];
  const fileCards = files
    .map((f) => renderTsukihimeFileCard(f, data.id))
    .join("");
  let filesHtml = "";
  if (files.length === 1) {
    filesHtml = `<div class="nyaa-enhancer-tsukihime-files">
        <h4 class="nyaa-enhancer-tsukihime-files-title">Files <span class="nyaa-enhancer-tsukihime-muted">(1)</span></h4>
        <div class="nyaa-enhancer-tsukihime-file-list">${fileCards}</div>
      </div>`;
  } else if (files.length > 1) {
    filesHtml = `<details class="nyaa-enhancer-tsukihime-files nyaa-enhancer-tsukihime-files-collapsible">
        <summary class="nyaa-enhancer-tsukihime-files-title"><span class="nyaa-enhancer-tsukihime-files-chevron" aria-hidden="true"><i class="fa fa-chevron-right"></i><i class="fa fa-chevron-down"></i></span>Files <span class="nyaa-enhancer-tsukihime-muted">(${files.length})</span></summary>
        <div class="nyaa-enhancer-tsukihime-file-list">${fileCards}</div>
      </details>`;
  }

  let synopsisHtml = "";
  if (anime?.synopsis) {
    const synopsis = stripTsukihimeHtml(anime.synopsis);
    if (synopsis) {
      synopsisHtml = `<div class="nyaa-enhancer-nekobt-block"><h4>Synopsis</h4><p class="nyaa-enhancer-tsukihime-synopsis">${escapeNekoBTHtml(synopsis)}</p></div>`;
    }
  }

  let genresHtml = "";
  if (anime?.genres?.length) {
    genresHtml = `<div class="nyaa-enhancer-tsukihime-tags">${anime.genres
      .map(
        (g) =>
          `<span class="nyaa-enhancer-tsukihime-tag">${escapeNekoBTHtml(g)}</span>`,
      )
      .join("")}</div>`;
  }

  return `
    <div class="nyaa-enhancer-tsukihime-content">
      <dl class="nyaa-enhancer-nekobt-meta">${meta}</dl>
      ${genresHtml}
      ${synopsisHtml}
      ${filesHtml}
    </div>
  `;
}

export function removeTsukihimeDescriptionSection(panel) {
  panel.querySelector('[data-section="tsukihime"]')?.remove();
  panel.querySelector("#tsukihime-torrent-panel")?.remove();
  switchDescriptionPanelTab(panel, "description");
}

export function ensureTsukihimeDescriptionTab(panel) {
  let tab = panel.querySelector('[data-section="tsukihime"]');
  if (tab) return tab;

  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return null;

  tab = document.createElement("button");
  tab.type = "button";
  tab.className = "nyaa-enhancer-desc-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.section = "tsukihime";
  tab.textContent = "Tsukihime";
  tab.addEventListener("click", () =>
    switchDescriptionPanelTab(panel, "tsukihime"),
  );
  tabsHeader.appendChild(tab);
  return tab;
}

export function getOrCreateTsukihimePanelBody(panel) {
  let body = panel.querySelector("#tsukihime-torrent-panel");
  if (body) return body;

  body = document.createElement("div");
  body.id = "tsukihime-torrent-panel";
  body.className =
    "panel-body nyaa-enhancer-nekobt-panel nyaa-enhancer-tsukihime-panel";
  body.hidden = true;
  ensureTsukihimePanelClickHandler(body);
  panel.appendChild(body);
  return body;
}

export async function fetchTsukihimeTorrent(infoHash) {
  if (!infoHash) {
    return { data: null, link: null, torrentId: null };
  }

  if (
    tsukihimeSearchCache.infoHash === infoHash &&
    tsukihimeSearchCache.fetched &&
    !tsukihimeSearchCache.promise
  ) {
    const data = tsukihimeSearchCache.data;
    return {
      data,
      link: data ? `https://tsukihime.org/view/${data.id}` : null,
      torrentId: data ? String(data.id) : null,
    };
  }

  if (
    tsukihimeSearchCache.infoHash === infoHash &&
    tsukihimeSearchCache.promise
  ) {
    await tsukihimeSearchCache.promise;
    const data = tsukihimeSearchCache.data;
    return {
      data,
      link: data ? `https://tsukihime.org/view/${data.id}` : null,
      torrentId: data ? String(data.id) : null,
    };
  }

  tsukihimeSearchCache.infoHash = infoHash;
  tsukihimeSearchCache.data = null;
  tsukihimeSearchCache.fetched = false;

  tsukihimeSearchCache.promise = (async () => {
    try {
      const apiUrl = `https://api.tsukihime.org/v1/torrents/btih/${encodeURIComponent(infoHash)}`;
      const result = await fetchUrlViaBackground(apiUrl);
      if (result?.ok) {
        try {
          const json = JSON.parse(result.text);
          if (json.id != null) {
            tsukihimeSearchCache.data = json;
          }
        } catch {
          /* ignore parse errors */
        }
      }
      tsukihimeSearchCache.fetched = true;
    } finally {
      tsukihimeSearchCache.promise = null;
    }
  })();

  await tsukihimeSearchCache.promise;
  const data = tsukihimeSearchCache.data;
  return {
    data,
    link: data ? `https://tsukihime.org/view/${data.id}` : null,
    torrentId: data ? String(data.id) : null,
  };
}

export async function updateTsukihimeDescriptionSection() {
  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  if (!panel) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showTsukihimeSection) {
    removeTsukihimeDescriptionSection(panel);
    return;
  }

  if (!isTsukihimeSupportedViewPage()) {
    removeTsukihimeDescriptionSection(panel);
    return;
  }

  const fetchId = ++tsukihimeSectionFetchId;
  ensureTsukihimeDescriptionTab(panel);
  const body = getOrCreateTsukihimePanelBody(panel);
  ensureTsukihimePanelClickHandler(body);
  setAnimetoshoTabStatus(body, "Loading Tsukihime data…");

  const infoHash = document.querySelector("kbd")?.textContent?.trim();
  if (!infoHash) {
    if (fetchId !== tsukihimeSectionFetchId) return;
    setAnimetoshoTabStatus(body, "Could not read info hash.");
    return;
  }

  const { data } = await fetchTsukihimeTorrent(infoHash);
  if (fetchId !== tsukihimeSectionFetchId) return;

  if (!data) {
    setAnimetoshoTabStatus(body, "Not found on Tsukihime.");
    return;
  }

  body.innerHTML = renderTsukihimePanelContent(data);
}

export function removeTsukihimeRow() {
  document.querySelector(".tsukihime-row")?.remove();
}

export async function addTsukihimeToViewPage() {
  if (!window.location.pathname.startsWith("/view/")) return;
  if (tsukihimeFetchInProgress) return;
  if (document.querySelector(".tsukihime-row")) return;

  tsukihimeFetchInProgress = true;
  try {
    const prefs = await loadStoredPreferences();
    if (!prefs.showTsukihimeLinks) return;
    if (!isTsukihimeSupportedViewPage()) return;
    if (document.querySelector(".tsukihime-row")) return;

    const infoHash = document.querySelector("kbd")?.textContent?.trim();
    if (!infoHash) return;

    const { link: tsukihimeLink } = await fetchTsukihimeTorrent(infoHash);
    const tsukihimeContent = buildExternalServiceLinkHtml(
      tsukihimeLink,
      "Not found on Tsukihime",
    );

    const anchor = getTsukihimeRowAnchor();
    if (!anchor) return;

    const newRow = document.createElement("div");
    newRow.className = "row tsukihime-row";
    newRow.innerHTML = `
      <div class="col-md-1">Tsukihime:</div>
      <div class="col-md-5">
        ${tsukihimeContent}
      </div>
    `;
    anchor.insertAdjacentElement("afterend", newRow);
    repositionTsukihimeRowAfterNekoBT();
  } finally {
    tsukihimeFetchInProgress = false;
  }
}
