import { loadStoredPreferences } from "../../../shared/prefs.js";
import { areLinkActionsOrdered, ensureDescriptionTab, fetchUrlViaBackground, getOrCreateDescriptionPanelBody, getTorrentInfoHashFromRow, getTorrentLinkCell, isNyaaTorrentDataRow, showNotification, switchDescriptionPanelTab, updateTorrentRowLinkActions } from "../../internal.js";
import {
  mergeAnimetoshoSeries,
  seriesFromAnimetoshoHtml,
  seriesFromAnimetoshoJson,
  seriesFromAnimetoshoOrgJson,
} from "./series.js";

export const ANIMETOSHO_LIST_CATEGORY_TITLES = new Set([
  "Anime - English-translated",
  "Anime - Non-English-translated",
  "Anime - Raw",
]);

export function isAnimetoshoListCategoryRow(row) {
  const categoryLink = row.querySelector("td:first-child a");
  return ANIMETOSHO_LIST_CATEGORY_TITLES.has(
    categoryLink?.getAttribute("title") || "",
  );
}

export const ANIMETOSHO_VIEW_SUBCATEGORY_LABELS = new Set([
  "English-translated",
  "Non-English-translated",
  "Raw",
]);

export function isSupportedAnimeViewPageCategory() {
  const categoryLinks = document.querySelectorAll(".row .col-md-5 a");
  const isAnime = Array.from(categoryLinks).some(
    (link) => link.textContent.trim() === "Anime",
  );
  const hasSubcategory = Array.from(categoryLinks).some((link) =>
    ANIMETOSHO_VIEW_SUBCATEGORY_LABELS.has(link.textContent.trim()),
  );
  return isAnime && hasSubcategory;
}

export const animetoshoViewLinkCache = new Map();

export function getAnimetoshoDomain(useNewATDomain) {
  return useNewATDomain ? "animetosho.xyz" : "animetosho.org";
}

export function getAnimetoshoStorageDomain(useNewATDomain) {
  return useNewATDomain ? "storage.animetosho.xyz" : "storage.animetosho.org";
}

export function normalizeATScreenshotStorageUrl(url, useNewATDomain) {
  if (!url || !url.includes("/sframes/")) return url;
  const storageDomain = getAnimetoshoStorageDomain(useNewATDomain);
  return url
    .replace(/.*\/sframes\//, `https://${storageDomain}/sframes/`)
    .replace(/&amp;/g, "&");
}

export function normalizeAnimetoshoViewUrl(url, atDomain) {
  if (!url) return null;
  return url.replace(/animetosho\.(org|xyz)/, atDomain);
}

export function parseAnimetoshoOrgViewLink(json, atDomain) {
  if (!json || json.error) return null;

  let viewSuffix = null;
  if (json.nyaa_id) viewSuffix = `n${json.nyaa_id}`;
  else if (json.anidex_id) viewSuffix = `d${json.anidex_id}`;
  else if (json.tosho_id) viewSuffix = `${json.tosho_id}`;
  else if (json.nekobt_id) viewSuffix = `k${json.nekobt_id}`;

  if (!viewSuffix) return null;
  return `https://${atDomain}/view/${viewSuffix}`;
}

export function parseAnimetoshoXyzViewLink(json, atDomain) {
  if (!json?.ok || !json.data?.length) return null;
  const viewUrl = json.data[0].urls?.view;
  if (!viewUrl) return null;
  return normalizeAnimetoshoViewUrl(viewUrl, atDomain);
}

export async function resolveAnimetoshoViewLink(infoHash, useNewATDomain) {
  const hash = infoHash?.trim().toLowerCase();
  if (!hash) return null;

  const cacheKey = `${useNewATDomain ? "xyz" : "org"}:${hash}`;
  let entry = animetoshoViewLinkCache.get(cacheKey);
  if (entry?.resolved) return entry.link;
  if (entry?.promise) {
    await entry.promise;
    return animetoshoViewLinkCache.get(cacheKey)?.link ?? null;
  }

  const atDomain = getAnimetoshoDomain(useNewATDomain);
  entry = { link: null, resolved: false, promise: null };
  animetoshoViewLinkCache.set(cacheKey, entry);

  entry.promise = (async () => {
    try {
      const apiUrl = useNewATDomain
        ? `https://feed.animetosho.xyz/json/v1/search?q=${encodeURIComponent(hash)}&limit=1`
        : `https://feed.animetosho.org/json?show=torrent&btih=${encodeURIComponent(hash)}`;
      const result = await fetchUrlViaBackground(apiUrl);
      if (result?.ok) {
        try {
          const json = JSON.parse(result.text);
          entry.link = useNewATDomain
            ? parseAnimetoshoXyzViewLink(json, atDomain)
            : parseAnimetoshoOrgViewLink(json, atDomain);
        } catch {
          /* ignore parse errors */
        }
      }
    } finally {
      entry.resolved = true;
      entry.promise = null;
    }
  })();

  await entry.promise;
  return entry.link;
}

export function createAnimetoshoListAnchor(infoHash, useNewATDomain) {
  const atLink = document.createElement("a");
  atLink.className = "link-action-at";
  atLink.target = "_blank";
  atLink.title = "Open on Animetosho";
  atLink.innerHTML = '<i class="fa fa-fw fa-external-link"></i>';
  atLink.style.visibility = "hidden";
  resolveAnimetoshoViewLink(infoHash, useNewATDomain).then((viewUrl) => {
    if (viewUrl) {
      atLink.href = viewUrl;
      atLink.style.visibility = "";
    }
  });
  return atLink;
}

export function createAnimetoshoListPlaceholder() {
  const placeholder = document.createElement("span");
  placeholder.className = "link-action-at link-action-at-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.innerHTML = '<i class="fa fa-fw fa-external-link"></i>';
  return placeholder;
}

export async function patchTorrentListLinkActionsForNewRows() {
  const prefs = await loadStoredPreferences();
  document.querySelectorAll("table.torrent-list tbody tr").forEach((row) => {
    if (!isNyaaTorrentDataRow(row)) return;
    const linkCell = getTorrentLinkCell(row);
    if (!linkCell) return;

    const showAtLink =
      prefs.showATLinks && isAnimetoshoListCategoryRow(row);
    const needsCopy =
      prefs.showMagnetButtons && !linkCell.querySelector(".link-action-copy");
    const needsSend =
      prefs.showSendButtons && !linkCell.querySelector(".link-action-send");
    const needsAt =
      prefs.showATLinks &&
      !linkCell.querySelector(".link-action-at") &&
      (showAtLink ? !!getTorrentInfoHashFromRow(row) : true);

    if (needsCopy || needsSend || needsAt || !areLinkActionsOrdered(linkCell)) {
      updateTorrentRowLinkActions(row, prefs);
    }
  });
}

export async function refreshAnimetoshoViewPageLink() {
  const atRow = Array.from(document.querySelectorAll(".row")).find((row) =>
    row.textContent.includes("Animetosho:"),
  );
  if (!atRow) return;

  const atAnchor = atRow.querySelector("a");
  if (!atAnchor) return;

  const infoHash = document.querySelector("kbd")?.textContent?.trim();
  if (!infoHash) return;

  const prefs = await loadStoredPreferences();
  const viewUrl = await resolveAnimetoshoViewLink(
    infoHash,
    prefs.useNewATDomain,
  );
  if (viewUrl) {
    atAnchor.href = viewUrl;
    atAnchor.textContent = viewUrl;
    atAnchor.style.color = "";
    atAnchor.style.pointerEvents = "";
  } else {
    atAnchor.removeAttribute("href");
    atAnchor.textContent = "Not found on AnimeTosho";
    atAnchor.style.color = "#999";
    atAnchor.style.pointerEvents = "none";
  }
}

export async function refreshAnimetoshoListLinks() {
  const prefs = await loadStoredPreferences();
  document
    .querySelectorAll(".link-action-at:not(.link-action-at-placeholder)")
    .forEach((link) => {
      const row = link.closest("tr");
      const infoHash = row ? getTorrentInfoHashFromRow(row) : "";
      if (!infoHash) return;
      link.style.visibility = "hidden";
      resolveAnimetoshoViewLink(infoHash, prefs.useNewATDomain).then(
        (viewUrl) => {
          if (viewUrl) {
            link.href = viewUrl;
            link.style.visibility = "";
          }
        },
      );
    });
}

// Function to add Animetosho link to torrent view pages
export async function addAnimetoshoToViewPage() {
  // Check if we're on a view page and AT links are enabled
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showATLinks) return;

  if (!isSupportedAnimeViewPageCategory()) return;

  // Find the info hash row
  const infoHashRow = Array.from(document.querySelectorAll(".row")).find(
    (row) => row.textContent.includes("Info hash:"),
  );

  if (!infoHashRow) return;

  const infoHash = infoHashRow.querySelector("kbd")?.textContent?.trim();
  if (!infoHash) return;

  // Get the info hash content, removing the offset class
  const infoHashContent = infoHashRow.innerHTML.replace(
    "col-md-offset-6 col-md-1",
    "col-md-1",
  );

  // Create the new row structure
  const newRow = document.createElement("div");
  newRow.className = "row";
  newRow.innerHTML = `
    <div class="col-md-1">Animetosho:</div>
    <div class="col-md-5">
      <a rel="noopener noreferrer nofollow">Loading…</a>
    </div>
    ${infoHashContent}
  `;

  // Replace the old row with the new one
  infoHashRow.replaceWith(newRow);

  const atAnchor = newRow.querySelector("a");
  const viewUrl = await resolveAnimetoshoViewLink(
    infoHash,
    prefs.useNewATDomain,
  );
  if (viewUrl) {
    atAnchor.href = viewUrl;
    atAnchor.textContent = viewUrl;
  } else {
    atAnchor.textContent = "Not found on AnimeTosho";
    atAnchor.style.color = "#999";
    atAnchor.style.pointerEvents = "none";
  }
}

// Function to add AnimeTosho comments to supported view pages
export async function addAnimetoshoComments() {
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showATComments) return;

  if (!isSupportedAnimeViewPageCategory()) return;

  if (document.getElementById("tosho-comments")) return;

  const infoHash = document.querySelector("kbd")?.textContent?.trim();
  const toshoUrl = infoHash
    ? await resolveAnimetoshoViewLink(infoHash, prefs.useNewATDomain)
    : null;
  if (!toshoUrl) return;

  const containers = document.getElementsByClassName("container");
  const nyaaContainer = containers[containers.length - 1];

  const toshoPanel = document.createElement("div");
  toshoPanel.id = "tosho-comments";
  toshoPanel.className = "panel panel-default";
  toshoPanel.innerHTML =
    '<div class="panel-heading">' +
    '<a data-toggle="collapse" href="#collapse-tosho-comments">' +
    '<h3 class="panel-title">AnimeTosho Comments</h3>' +
    "</a>" +
    "</div>";
  nyaaContainer.insertAdjacentElement("beforeend", toshoPanel);

  const toshoCommentsContainer = document.createElement("div");
  toshoCommentsContainer.id = "collapse-tosho-comments";
  toshoCommentsContainer.className = "collapse in";
  toshoPanel.insertAdjacentElement("beforeend", toshoCommentsContainer);

  const loadingMsg = document.createElement("p");
  loadingMsg.className = "comment-panel";
  loadingMsg.style.padding = "10px";
  loadingMsg.textContent = "Loading AnimeTosho comments...";
  toshoCommentsContainer.appendChild(loadingMsg);

  try {
    const result = await new Promise((resolve) => {
      browser.runtime.sendMessage({ type: "fetchUrl", url: toshoUrl }, resolve);
    });
    if (!result?.ok) throw new Error(result?.error || "Unknown error");
    const html = result.text;

    const parser = new DOMParser();
    const toshoDocument = parser.parseFromString(html, "text/html");

    loadingMsg.remove();

    const toshoAvatarsStyle = toshoDocument.getElementsByTagName("style")[0];
    if (toshoAvatarsStyle) {
      toshoCommentsContainer.insertAdjacentElement(
        "beforebegin",
        toshoAvatarsStyle.cloneNode(true),
      );
    }

    const toshoComments = toshoDocument.getElementById("view_comments");
    if (!toshoComments) {
      const noComments = document.createElement("p");
      noComments.className = "comment-panel";
      noComments.style.padding = "10px";
      noComments.textContent = "No comments found on AnimeTosho.";
      toshoCommentsContainer.appendChild(noComments);
    } else {
      function filterComments(node) {
        const result = [];
        for (const child of node.childNodes) {
          if (child.className === "comment" || child.className === "comment2") {
            result.push(child);
          }
          if (child.id && child.id.startsWith("comment_body_")) {
            result.push(...filterComments(child));
          }
        }
        return result;
      }

      function findAvatar(comment) {
        for (const child of comment.childNodes) {
          if (
            child.className &&
            child.className.startsWith("comment_user_avatar")
          ) {
            return child;
          }
        }
        return null;
      }

      function makeCommentElement(toshoComment) {
        const userEl = toshoComment.getElementsByClassName("comment_user")[0];
        const commentInfo = userEl?.children[0]?.innerHTML?.split(" — ") || [];
        const time = commentInfo[0] || "";
        const user = commentInfo[1] || "Unknown";
        const commentBody =
          toshoComment.getElementsByClassName("comment_message")[0];

        const commentEl = document.createElement("div");
        commentEl.className = "panel panel-default comment-panel";

        let comHtml = '<div class="panel-body">';

        let avatar = null;
        if (toshoAvatarsStyle) {
          avatar = findAvatar(toshoComment);
          if (avatar) {
            comHtml += '<div style="float: left;">';
            comHtml += avatar.outerHTML;
            comHtml += "</div>";
            comHtml += '<div class="col-md-10">';
          }
        }

        comHtml +=
          '<div class="comment-details">' +
          user +
          " <small>" +
          time +
          "</small></div>";
        comHtml +=
          '<div class="comment-body">' +
          (commentBody ? commentBody.innerHTML : "") +
          "</div>";
        comHtml += "</div>";

        if (toshoAvatarsStyle && avatar) {
          comHtml += "</div>";
        }

        commentEl.innerHTML = comHtml;

        for (const nested of filterComments(toshoComment)) {
          commentEl.appendChild(makeCommentElement(nested));
        }

        return commentEl;
      }

      for (const comment of filterComments(toshoComments)) {
        toshoCommentsContainer.appendChild(makeCommentElement(comment));
      }
    }

    const toshoLink = document.createElement("p");
    toshoLink.className = "comment-panel";
    toshoLink.style.padding = "10px";
    toshoLink.innerHTML = `<a href="${toshoUrl}" target="_blank" rel="noopener noreferrer">Please visit AnimeTosho to participate</a>`;
    toshoCommentsContainer.appendChild(toshoLink);
  } catch (err) {
    loadingMsg.textContent = `Failed to load AnimeTosho comments: ${err.message}`;
  }
}

// ── AnimeTosho episode features (screenshots, FileInfo, attachments) ────────

export let atEpisodeFetchId = 0;
export let atBatchViewHtml = null;
export let atXyzViewPageHtml = null;

export const animetoshoTorrentDataCache = new Map();

export const AT_EPISODE_FILE_ICON = "fa fa-file";
// Nyaa uses Font Awesome 4.7; fa-file-circle-check is FA6-only and renders blank.
export const AT_EPISODE_FILE_ICON_SELECTED = "fa fa-check-circle";

export function queryTorrentFileListIcon(li) {
  return li.querySelector("i.fa-file, i.fa-check-circle");
}

export function setTorrentFileListIcon(li, selected) {
  const icon = queryTorrentFileListIcon(li);
  if (icon) {
    icon.className = selected
      ? AT_EPISODE_FILE_ICON_SELECTED
      : AT_EPISODE_FILE_ICON;
  }
}

export const atEpisodeSelection = {
  torrentKey: null,
  epId: null,
  epFilename: null,
  countVidFiles: 0,
};

export function resetAnimetoshoEpisodeSelection() {
  atEpisodeSelection.torrentKey = null;
  atEpisodeSelection.epId = null;
  atEpisodeSelection.epFilename = null;
  atEpisodeSelection.countVidFiles = 0;
  atBatchViewHtml = null;
  atXyzViewPageHtml = null;
}

export function isAnimetoshoSupportedViewPage() {
  return isSupportedAnimeViewPageCategory();
}

export function removeLegacyAnimetoshoScreenshotsLayout() {
  document.getElementById("nyaa-enhancer-at-screenshots")?.remove();
  const row = document.querySelector(".nyaa-enhancer-description-row");
  if (!row) return;
  const descPanel = row.querySelector(".panel.panel-default");
  if (descPanel) {
    row.parentNode.insertBefore(descPanel, row);
  }
  row.remove();
}

export function removeAnimetoshoEpisodeFeatures() {
  atEpisodeFetchId++;
  removeLegacyAnimetoshoScreenshotsLayout();
  resetAnimetoshoEpisodeSelection();
  clearAnimetoshoFileListEpisodeHandlers();

  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  if (!panel) return;

  for (const section of ["atscreenshots", "atfileinfo", "atattachments"]) {
    panel.querySelector(`[data-section="${section}"]`)?.remove();
  }
  panel
    .querySelectorAll(
      "#at-screenshots-panel, #at-fileinfo-panel, #at-attachments-panel",
    )
    .forEach((el) => el.remove());
  switchDescriptionPanelTab(panel, "description");
}

export function pickAnimetoshoVideoFiles(files) {
  const videoFiles = [];
  if (!Array.isArray(files)) return videoFiles;

  const sorted = [...files].sort((a, b) =>
    String(a.filename).localeCompare(String(b.filename)),
  );

  for (const file of sorted) {
    const filename = String(file.filename || "").toLowerCase();
    if (
      !filename.endsWith(".mkv") &&
      !filename.endsWith(".mp4") &&
      !filename.endsWith(".ts")
    ) {
      continue;
    }
    if (
      (filename.startsWith("extra") ||
        filename.startsWith("bonus") ||
        filename.startsWith("special") ||
        filename.startsWith("creditless")) &&
      filename.includes("/")
    ) {
      continue;
    }
    videoFiles.push({
      id: String(file.id),
      filename: String(file.filename).split("/").pop(),
    });
  }
  return videoFiles;
}

export function isAnimetoshoXyzFileEpisodeId(episodeId) {
  return String(episodeId || "").startsWith("/file/");
}

export function pickAnimetoshoXyzVideoFilesFromDoc(doc) {
  const entries = [];
  doc
    .querySelectorAll(".view_list_entry .link a[href^='/file/']")
    .forEach((a) => {
      const href = a.getAttribute("href");
      const fullName = a.textContent.trim();
      if (!href || !fullName) return;

      const filename = fullName.split("/").pop();
      const lower = filename.toLowerCase();
      if (
        !lower.endsWith(".mkv") &&
        !lower.endsWith(".mp4") &&
        !lower.endsWith(".ts")
      ) {
        return;
      }

      const lowerPath = fullName.toLowerCase();
      if (
        (lowerPath.startsWith("extra") ||
          lowerPath.startsWith("bonus") ||
          lowerPath.startsWith("special") ||
          lowerPath.startsWith("creditless")) &&
        fullName.includes("/")
      ) {
        return;
      }

      entries.push({ href, filename });
    });

  entries.sort((a, b) => a.filename.localeCompare(b.filename));
  return entries.map(({ href, filename }) => ({
    id: href,
    filename,
  }));
}

export function parseAnimetoshoXyzViewPage(html) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const videoFiles = pickAnimetoshoXyzVideoFilesFromDoc(doc);
    const singleFileLink = doc.querySelector('a[href*="file_info="]');
    let singleFileInfoLink = null;

    if (singleFileLink) {
      const href = singleFileLink.getAttribute("href");
      const fullName = singleFileLink.textContent.trim();
      if (href && fullName) {
        singleFileInfoLink = {
          href,
          filename: fullName.split("/").pop(),
        };
      }
    }

    return {
      videoFiles,
      singleFileInfoLink,
      series: seriesFromAnimetoshoHtml(html),
    };
  } catch {
    return { videoFiles: [], singleFileInfoLink: null, series: null };
  }
}

export function getAnimetoshoRecordVideoFiles(record) {
  if (record.useNewATDomain) {
    return record.xyzPageData?.videoFiles || [];
  }
  return record.videoFiles || [];
}

export async function getAnimetoshoTorrentRecord(infoHash, useNewATDomain) {
  const hash = infoHash?.trim().toLowerCase();
  if (!hash) return null;

  const cacheKey = `${useNewATDomain ? "xyz" : "org"}:${hash}`;
  let entry = animetoshoTorrentDataCache.get(cacheKey);
  if (entry?.resolved) return entry.data;
  if (entry?.promise) {
    await entry.promise;
    return animetoshoTorrentDataCache.get(cacheKey)?.data ?? null;
  }

  const atDomain = getAnimetoshoDomain(useNewATDomain);
  entry = { data: null, resolved: false, promise: null };
  animetoshoTorrentDataCache.set(cacheKey, entry);

  entry.promise = (async () => {
    try {
      const apiUrl = useNewATDomain
        ? `https://feed.animetosho.xyz/json/v1/search?q=${encodeURIComponent(hash)}&limit=1`
        : `https://feed.animetosho.org/json?show=torrent&btih=${encodeURIComponent(hash)}`;
      const result = await fetchUrlViaBackground(apiUrl);
      if (!result?.ok) return;

      const json = JSON.parse(result.text);
      if (useNewATDomain) {
        const item = json?.data?.[0];
        if (!item) return;
        let viewId = item.id != null ? String(item.id) : null;
        let viewUrl = item.urls?.view || "";
        if (!viewId && viewUrl) {
          const match = viewUrl.match(/\/view\/(\d+)/);
          viewId = match ? match[1] : null;
        }
        if (!viewUrl && viewId) {
          viewUrl = `https://${atDomain}/view/${viewId}`;
        }
        viewUrl = normalizeAnimetoshoViewUrl(viewUrl, atDomain);
        if (!viewUrl || !viewId) return;

        entry.data = {
          infoHash: hash,
          useNewATDomain: true,
          viewUrl,
          xyzViewId: viewId,
          videoFiles: [],
          series: seriesFromAnimetoshoJson(item.series),
        };
      } else if (!json?.error) {
        const viewUrl = parseAnimetoshoOrgViewLink(json, atDomain);
        if (!viewUrl) return;
        entry.data = {
          infoHash: hash,
          useNewATDomain: false,
          viewUrl,
          xyzViewId: null,
          videoFiles: pickAnimetoshoVideoFiles(json.files),
          torrentJson: json,
          series: seriesFromAnimetoshoOrgJson(json),
        };
      }
    } catch {
      /* ignore */
    } finally {
      entry.resolved = true;
      entry.promise = null;
    }
  })();

  await entry.promise;
  return entry.data;
}

export async function ensureAnimetoshoViewPageData(record) {
  if (!record?.viewUrl) return record;

  if (record.useNewATDomain) {
    if (!record.xyzPageData) {
      const viewResult = await fetchUrlViaBackground(record.viewUrl);
      if (viewResult?.ok) {
        atXyzViewPageHtml = viewResult.text;
        atBatchViewHtml = viewResult.text;
        record.xyzPageData = parseAnimetoshoXyzViewPage(viewResult.text);
      }
    }
    record.series = mergeAnimetoshoSeries(
      record.series,
      record.xyzPageData?.series,
    );
    return record;
  }

  if (!record.series?.fullTitle) {
    const viewResult = await fetchUrlViaBackground(record.viewUrl);
    if (viewResult?.ok) {
      record.series = mergeAnimetoshoSeries(
        record.series,
        seriesFromAnimetoshoHtml(viewResult.text),
      );
    }
  }
  return record;
}

export async function getAnimetoshoSeriesForHash(infoHash, useNewATDomain) {
  const record = await getAnimetoshoTorrentRecord(infoHash, useNewATDomain);
  if (!record) return null;
  await ensureAnimetoshoViewPageData(record);
  return record.series || null;
}

export function initAnimetoshoEpisodeSelection(record) {
  const torrentKey = `${record.infoHash}:${record.useNewATDomain ? "xyz" : "org"}`;
  if (atEpisodeSelection.torrentKey === torrentKey) return;

  resetAnimetoshoEpisodeSelection();
  atEpisodeSelection.torrentKey = torrentKey;

  if (record.useNewATDomain) {
    const { videoFiles, singleFileInfoLink } = record.xyzPageData || {
      videoFiles: [],
      singleFileInfoLink: null,
    };

    if (videoFiles.length > 1) {
      atEpisodeSelection.countVidFiles = videoFiles.length;
      atEpisodeSelection.epId = videoFiles[0].id;
      atEpisodeSelection.epFilename = videoFiles[0].filename;
      return;
    }

    if (videoFiles.length === 1) {
      atEpisodeSelection.countVidFiles = 1;
      atEpisodeSelection.epId = videoFiles[0].id;
      atEpisodeSelection.epFilename = videoFiles[0].filename;
      return;
    }

    atEpisodeSelection.epId = record.xyzViewId;
    atEpisodeSelection.countVidFiles = 1;
    atEpisodeSelection.epFilename = singleFileInfoLink?.filename || null;
    return;
  }

  atEpisodeSelection.countVidFiles = record.videoFiles.length;
  if (record.videoFiles.length > 0) {
    atEpisodeSelection.epId = record.videoFiles[0].id;
    atEpisodeSelection.epFilename = record.videoFiles[0].filename;
  }
}

export async function fetchAnimetoshoEpisodeViewHtml(episodeId, useNewATDomain) {
  const url = useNewATDomain
    ? isAnimetoshoXyzFileEpisodeId(episodeId)
      ? `https://animetosho.xyz${episodeId}`
      : `https://animetosho.xyz/view/${episodeId}`
    : `https://animetosho.org/file/${episodeId}`;
  const result = await fetchUrlViaBackground(url);
  return result?.ok ? result.text : null;
}

export async function fetchAnimetoshoEpisodeFileinfo(
  episodeId,
  useNewATDomain,
  episodeViewHtml,
) {
  if (!episodeViewHtml) return { fileInfo: null, filename: null };

  if (!useNewATDomain) {
    return {
      fileInfo: extractATFileinfoFromHtml(episodeViewHtml),
      filename: atEpisodeSelection.epFilename,
    };
  }

  if (isAnimetoshoXyzFileEpisodeId(episodeId)) {
    return {
      fileInfo: extractATFileinfoFromHtml(episodeViewHtml),
      filename: atEpisodeSelection.epFilename,
    };
  }

  const doc = new DOMParser().parseFromString(episodeViewHtml, "text/html");
  const fileInfoLink = doc.querySelector('a[href*="file_info="]');
  const filename =
    fileInfoLink?.textContent?.trim().split("/").pop() ||
    atEpisodeSelection.epFilename;
  const fileInfoHref = fileInfoLink?.getAttribute("href");
  if (!fileInfoHref) {
    return { fileInfo: null, filename };
  }

  const fileInfoUrl = fileInfoHref.startsWith("http")
    ? fileInfoHref
    : `https://animetosho.xyz${fileInfoHref}`;
  const result = await fetchUrlViaBackground(fileInfoUrl);
  if (!result?.ok) {
    return { fileInfo: null, filename };
  }

  return {
    fileInfo: extractATFileinfoFromHtml(result.text),
    filename,
  };
}

export function createEmptyATAttachmentGroups() {
  return { file: [], subtitles: [], audio: [], video: [] };
}

export function resolveATAttachmentGroupUrls(groups, useNewATDomain) {
  if (!useNewATDomain) return groups;
  const resolveList = (items) =>
    items.map((item) => ({
      ...item,
      link: item.link.startsWith("http")
        ? item.link
        : `https://animetosho.xyz${item.link}`,
    }));
  return {
    file: resolveList(groups.file),
    subtitles: resolveList(groups.subtitles),
    audio: resolveList(groups.audio),
    video: resolveList(groups.video),
  };
}

export function hasATAttachmentGroups(groups) {
  return (
    groups.file.length > 0 ||
    groups.subtitles.length > 0 ||
    groups.audio.length > 0 ||
    groups.video.length > 0
  );
}

export function collectATDownloadLinksFromCell(td, downloads, seen) {
  let currentHost = null;

  const visit = (node) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const hostMatch = text.match(/([^:,]+):\s*$/);
      if (hostMatch) {
        currentHost = hostMatch[1].trim();
        return;
      }
      const inlineHostMatch = text.match(/^\s*([^:,]+):\s+/);
      if (inlineHostMatch) {
        currentHost = inlineHostMatch[1].trim();
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.nodeName === "BR") {
      return;
    }

    if (node.nodeName === "A") {
      const part = normalizeATAttachmentLabel(node.textContent);
      const label =
        currentHost && part && !/^part\d+$/i.test(part)
          ? part
          : currentHost
            ? `${currentHost} · ${part}`
            : part;
      pushATAttachmentLink(downloads, node.getAttribute("href"), label, seen);
      return;
    }

    if (node.classList?.contains("dlxlink")) {
      const anchor = node.querySelector("a[href]");
      if (anchor) {
        const part = normalizeATAttachmentLabel(anchor.textContent);
        const label = currentHost ? `${currentHost} · ${part}` : part;
        pushATAttachmentLink(
          downloads,
          anchor.getAttribute("href"),
          label,
          seen,
        );
      }
      return;
    }

    node.childNodes.forEach(visit);
  };

  td.childNodes.forEach(visit);
}

export function extractATDownloadLinksFromHtml(html) {
  if (!html) return [];

  try {
    const downloads = [];
    const seen = new Set();
    const doc = new DOMParser().parseFromString(html, "text/html");

    for (const row of doc.querySelectorAll("tr")) {
      const th = row.querySelector("th");
      const td = row.querySelector("td");
      if (!th || !td) continue;

      const header = normalizeATAttachmentLabel(th.textContent);
      if (!/^Download$/i.test(header)) continue;

      collectATDownloadLinksFromCell(td, downloads, seen);
      break;
    }

    return downloads;
  } catch (error) {
    console.error("Error parsing AnimeTosho download links:", error);
    return [];
  }
}

export function findBatchViewListEntry(doc, epId, epFilename) {
  const normalizedEpId = String(epId || "");
  const normalizedFilename = String(epFilename || "");

  for (const entry of doc.querySelectorAll(".view_list_entry")) {
    const fileLink = entry.querySelector(".link a[href]");
    if (!fileLink) continue;

    const href = fileLink.getAttribute("href") || "";
    const filename = fileLink.textContent.trim().split("/").pop();

    if (
      normalizedEpId &&
      (href === normalizedEpId || href.endsWith(normalizedEpId))
    ) {
      return entry;
    }
    if (
      normalizedEpId &&
      !isAnimetoshoXyzFileEpisodeId(normalizedEpId) &&
      (href.includes(`/file/${normalizedEpId}`) ||
        href.endsWith(`.${normalizedEpId}`))
    ) {
      return entry;
    }
    if (normalizedFilename && filename === normalizedFilename) {
      return entry;
    }
  }

  return null;
}

export function extractATDownloadLinksFromBatchEntry(batchHtml, epId, epFilename) {
  if (!batchHtml) return [];

  try {
    const doc = new DOMParser().parseFromString(batchHtml, "text/html");
    const entry = findBatchViewListEntry(doc, epId, epFilename);
    if (!entry) return [];

    const linksCell = entry.querySelector(".links");
    if (!linksCell) return [];

    const downloads = [];
    const seen = new Set();
    collectATDownloadLinksFromCell(linksCell, downloads, seen);
    return downloads;
  } catch (error) {
    console.error("Error parsing AnimeTosho batch file downloads:", error);
    return [];
  }
}

export function resolveATFileDownloadLinks(
  episodeViewHtml,
  batchViewHtml,
  epId,
  epFilename,
) {
  let file = extractATDownloadLinksFromHtml(episodeViewHtml);
  if (file.length) return file;

  if (batchViewHtml) {
    file = extractATDownloadLinksFromBatchEntry(
      batchViewHtml,
      epId,
      epFilename,
    );
    if (file.length) return file;

    file = extractATDownloadLinksFromHtml(batchViewHtml);
  }

  return file;
}

export function mergeAnimetoshoSubtitleAttachments(
  batchViewHtml,
  episodeViewHtml,
  countVidFiles,
  useNewATDomain,
  epId,
  epFilename,
) {
  const groups = extractATAttachmentsFromHtml(episodeViewHtml);
  groups.file = resolveATFileDownloadLinks(
    episodeViewHtml,
    batchViewHtml,
    epId,
    epFilename,
  );

  if (countVidFiles > 1 && batchViewHtml) {
    const batchGroups = extractATAttachmentsFromHtml(batchViewHtml);
    if (
      batchGroups.subtitles.length === 1 &&
      batchGroups.subtitles[0].text === "All Attachments"
    ) {
      batchGroups.subtitles[0].text = "All Attachments (Batch)";
    }
    groups.subtitles = [...batchGroups.subtitles, ...groups.subtitles.slice(1)];
  }

  return resolveATAttachmentGroupUrls(groups, useNewATDomain);
}

export function extractATFileinfoFromHtml(html) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let el = doc.getElementById("file_addinfo");
    if (!el) {
      el = doc.getElementById("additional_info_text");
    }
    if (!el) return null;

    let raw = el.innerHTML.replace(/<br\s*\/?>/gi, "\n");
    const txt = document.createElement("textarea");
    txt.innerHTML = raw;
    raw = txt.value;
    return raw.trim() || null;
  } catch (error) {
    console.error("Error parsing AnimeTosho FileInfo:", error);
    return null;
  }
}

export function openATFileinfoTab(fileInfo, filename) {
  const fileTitle = (filename || "FileInfo").replace(/</g, "&lt;");
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${fileTitle}</title>
<style>
body { background-color: #121212; color: #ffffff; font-family: Arial, sans-serif; padding: 0; margin: 0; }
pre { white-space: pre-wrap; word-wrap: break-word; padding: 20px; margin: 0; font-size: 13px; border: 0; }
</style>
</head>
<body><pre>${fileInfo.replace(/</g, "&lt;")}</pre></body>
</html>`;
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function renderATFileinfoBody(body, fileInfo, filename) {
  body.replaceChildren();

  const toolbar = document.createElement("div");
  toolbar.className = "nyaa-enhancer-at-fileinfo-toolbar";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "nyaa-enhancer-at-fileinfo-btn";
  openBtn.textContent = "Open in New Tab";
  openBtn.addEventListener("click", () =>
    openATFileinfoTab(fileInfo, filename),
  );
  toolbar.appendChild(openBtn);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "nyaa-enhancer-at-fileinfo-btn";
  copyBtn.textContent = "Copy to Clipboard";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(fileInfo)
      .then(() => showNotification("FileInfo copied to clipboard!", true))
      .catch(() => showNotification("Failed to copy FileInfo", false));
  });
  toolbar.appendChild(copyBtn);

  body.appendChild(toolbar);

  const pre = document.createElement("pre");
  pre.className = "nyaa-enhancer-at-fileinfo-pre";
  pre.textContent = fileInfo;
  body.appendChild(pre);
}

export function appendATAttachmentLinks(container, links, options = {}) {
  const separator =
    options.separator ??
    (links.some((item) => item.text.includes(" · ")) ? ", " : " | ");

  links.forEach((item, index) => {
    const anchor = document.createElement("a");
    anchor.href = item.link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = item.text;
    container.appendChild(anchor);

    if (index < links.length - 1) {
      container.appendChild(
        document.createTextNode(
          item.text.includes("All Attachments") ? " | " : separator,
        ),
      );
    }
  });
}

export function renderATAttachmentGroupRow(label, links, options = {}) {
  const row = document.createElement("div");
  row.className = "nyaa-enhancer-at-attachment-row";

  const rowLabel = document.createElement("div");
  rowLabel.className = "nyaa-enhancer-at-attachment-row-label";
  rowLabel.textContent = label;

  const linkList = document.createElement("div");
  linkList.className = "nyaa-enhancer-at-attachment-links";
  appendATAttachmentLinks(linkList, links, options);

  row.append(rowLabel, linkList);
  return row;
}

export function renderATAttachmentsBody(body, groups) {
  body.replaceChildren();

  const container = document.createElement("div");
  container.className = "nyaa-enhancer-at-attachments-list";

  if (groups.file.length) {
    container.appendChild(
      renderATAttachmentGroupRow("Video File", groups.file, {
        separator: groups.file.some((item) => item.text.includes(" · "))
          ? ", "
          : " | ",
      }),
    );
  }
  if (groups.subtitles.length) {
    container.appendChild(
      renderATAttachmentGroupRow("Subtitles", groups.subtitles),
    );
  }
  if (groups.audio.length) {
    container.appendChild(renderATAttachmentGroupRow("Audio", groups.audio));
  }
  if (groups.video.length) {
    container.appendChild(renderATAttachmentGroupRow("Video", groups.video));
  }

  body.appendChild(container);
}

export let atFileListClickHandler = null;

export function clearAnimetoshoFileListEpisodeHandlers() {
  if (!atFileListClickHandler) return;
  const fileList = document.querySelector(".torrent-file-list");
  fileList?.removeEventListener("click", atFileListClickHandler);
  atFileListClickHandler = null;

  document.querySelectorAll(".nyaa-enhancer-at-episode-file").forEach((li) => {
    li.classList.remove("nyaa-enhancer-at-episode-file");
    li.style.cursor = "";
    li.removeAttribute("data-at-episode-id");
    li.removeAttribute("data-at-episode-filename");
    setTorrentFileListIcon(li, false);
    li.style.backgroundColor = "";
  });
}

export function setupAnimetoshoFileListEpisodeSelection(record) {
  clearAnimetoshoFileListEpisodeHandlers();

  const videoFiles = getAnimetoshoRecordVideoFiles(record);
  if (videoFiles.length <= 1) return;

  const fileList = document.querySelector(".torrent-file-list");
  if (!fileList) return;

  const filenameToItem = new Map();
  fileList.querySelectorAll("li").forEach((item) => {
    const icon = queryTorrentFileListIcon(item);
    if (!icon) return;
    const fileSizeSpan = item.querySelector("span.file-size");
    let extracted = item.textContent.trim();
    if (fileSizeSpan) {
      extracted = extracted.replace(fileSizeSpan.textContent, "").trim();
    }
    filenameToItem.set(extracted, item);
  });

  for (const file of videoFiles) {
    const item = filenameToItem.get(file.filename);
    if (!item) continue;

    item.classList.add("nyaa-enhancer-at-episode-file");
    item.style.cursor = "pointer";
    item.dataset.atEpisodeId = file.id;
    item.dataset.atEpisodeFilename = file.filename;

    if (file.id === atEpisodeSelection.epId) {
      setTorrentFileListIcon(item, true);
    }
  }

  atFileListClickHandler = (e) => {
    const item = e.target.closest("li.nyaa-enhancer-at-episode-file");
    if (!item || !fileList.contains(item)) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const restoreScroll = () => window.scrollTo(scrollX, scrollY);

    e.preventDefault();
    e.stopPropagation();

    const fileId = item.dataset.atEpisodeId;
    const filename = item.dataset.atEpisodeFilename;
    if (!fileId) return;

    atEpisodeSelection.epId = fileId;
    atEpisodeSelection.epFilename = filename;

    fileList
      .querySelectorAll("li.nyaa-enhancer-at-episode-file")
      .forEach((li) => {
        setTorrentFileListIcon(li, false);
        li.style.backgroundColor = "";
      });

    setTorrentFileListIcon(item, true);
    restoreScroll();
    requestAnimationFrame(restoreScroll);

    loadStoredPreferences().then((prefs) =>
      refreshAnimetoshoEpisodeFeatures(prefs, {
        fromEpisodePick: true,
        scrollX,
        scrollY,
      }),
    );
  };

  fileList.addEventListener("click", atFileListClickHandler);
}

export function setAnimetoshoTabStatus(body, message) {
  body.replaceChildren();
  const status = document.createElement("p");
  status.className = "nyaa-enhancer-at-episode-status";
  status.textContent = message;
  body.appendChild(status);
}

export function collectATScreenshotsFromRoot(root, useNewATDomain) {
  const screenshots = [];

  root.querySelectorAll("a.screenthumb").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const img = a.querySelector("img");
    const src = img?.getAttribute("src") || href;

    const storageUrl = normalizeATScreenshotStorageUrl(href, useNewATDomain);
    const thumbnailUrl = normalizeATScreenshotStorageUrl(src, useNewATDomain);

    screenshots.push({
      url: storageUrl,
      thumbnail: thumbnailUrl,
      title: a.getAttribute("title") || img?.getAttribute("alt") || "",
    });
  });

  return screenshots;
}

export function extractATScreenshotsFromHtml(html, useNewATDomain) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    for (const row of doc.querySelectorAll("tr")) {
      const th = row.querySelector("th");
      if (
        th &&
        /^Screenshots$/i.test(normalizeATAttachmentLabel(th.textContent))
      ) {
        const td = row.querySelector("td");
        return td ? collectATScreenshotsFromRoot(td, useNewATDomain) : [];
      }
    }

    return collectATScreenshotsFromRoot(doc, useNewATDomain);
  } catch (error) {
    console.error("Error parsing AnimeTosho screenshots:", error);
    return [];
  }
}

export function normalizeATAttachmentLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pushATAttachmentLink(attachments, href, text, seen) {
  const label = normalizeATAttachmentLabel(text);
  const link = href?.trim();
  if (!link || !label) return;
  const key = `${link}\0${label}`;
  if (seen.has(key)) return;
  seen.add(key);
  attachments.push({ text: label, link });
}

export function collectATAttachmentLinksFromRoot(root, attachments, seen) {
  if (!root) return;
  root.querySelectorAll("a[href]").forEach((anchor) => {
    pushATAttachmentLink(
      attachments,
      anchor.getAttribute("href"),
      anchor.textContent,
      seen,
    );
  });
}

export function collectATAttachmentLinksFromHtml(html, attachments, seen) {
  const doc = new DOMParser().parseFromString(
    `<div id="nyaa-enhancer-at-parse">${html}</div>`,
    "text/html",
  );
  collectATAttachmentLinksFromRoot(
    doc.getElementById("nyaa-enhancer-at-parse"),
    attachments,
    seen,
  );
}

export function collectATExtractionsFromCell(td, audio, video, seen) {
  let section = null;

  const visit = (node) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (/\bAudio:\s*/i.test(text)) section = "audio";
      if (/\bVideo:\s*/i.test(text)) section = "video";
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === "A") {
        const target =
          section === "video" ? video : section === "audio" ? audio : audio;
        pushATAttachmentLink(
          target,
          node.getAttribute("href"),
          node.textContent,
          seen,
        );
        return;
      }
      node.childNodes.forEach(visit);
    }
  };

  td.childNodes.forEach(visit);
}

export function extractATAttachmentsFromHtml(html) {
  try {
    const groups = createEmptyATAttachmentGroups();
    const seen = new Set();
    const doc = new DOMParser().parseFromString(html, "text/html");
    let foundSubtitlesRow = false;

    for (const row of doc.querySelectorAll("tr")) {
      const th = row.querySelector("th");
      const td = row.querySelector("td");
      if (!th || !td) continue;

      const header = normalizeATAttachmentLabel(th.textContent);
      if (!header) continue;

      if (/^Subtitles$/i.test(header)) {
        foundSubtitlesRow = true;
        collectATAttachmentLinksFromRoot(td, groups.subtitles, seen);
        continue;
      }

      if (/^Extractions$/i.test(header)) {
        const cellHtml = td.innerHTML;
        const subtitlesIdx = cellHtml.search(/Subtitles:\s*/i);

        if (subtitlesIdx >= 0 && !foundSubtitlesRow) {
          collectATAttachmentLinksFromHtml(
            cellHtml.slice(subtitlesIdx),
            groups.subtitles,
            seen,
          );
        }

        const extractionsPart =
          subtitlesIdx >= 0 ? cellHtml.slice(0, subtitlesIdx) : cellHtml;
        const extractionsDoc = new DOMParser().parseFromString(
          `<div id="nyaa-enhancer-at-parse">${extractionsPart}</div>`,
          "text/html",
        );
        const extractionsRoot = extractionsDoc.getElementById(
          "nyaa-enhancer-at-parse",
        );
        if (extractionsRoot) {
          collectATExtractionsFromCell(
            extractionsRoot,
            groups.audio,
            groups.video,
            seen,
          );
        }
      }
    }

    return groups;
  } catch (error) {
    console.error("Error parsing AnimeTosho attachments:", error);
    return createEmptyATAttachmentGroups();
  }
}

export function getATScreenshotDisplayUrl(url) {
  if (!url) return url;
  if (url.includes("/sframes/") || url.includes("storage.animetosho.")) {
    return url.replace(/\.png$/i, ".jpg");
  }
  return url;
}

export function getATScreenshotImageUrl(url, trackNum) {
  try {
    const imgUrlObj = new URL(url);
    if (trackNum) {
      imgUrlObj.searchParams.set("s", trackNum);
    } else {
      imgUrlObj.searchParams.delete("s");
    }
    return imgUrlObj.toString();
  } catch {
    return url;
  }
}

export async function fetchAnimetoshoScreenshotHtml(
  record,
  epId,
  useNewATDomain,
  episodeViewHtml,
) {
  if (
    useNewATDomain &&
    atEpisodeSelection.countVidFiles > 1 &&
    isAnimetoshoXyzFileEpisodeId(epId)
  ) {
    if (episodeViewHtml && String(epId) !== String(record.xyzViewId)) {
      return episodeViewHtml;
    }
    return fetchAnimetoshoEpisodeViewHtml(epId, useNewATDomain);
  }
  return episodeViewHtml;
}

export function openATScreenshotModal(screenshots, initialIndex, trackNum) {
  document.getElementById("nyaa-enhancer-screenshot-modal")?.remove();

  let currentIndex = initialIndex;
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "nyaa-enhancer-screenshot-modal";
  modalOverlay.className = "nyaa-enhancer-screenshot-modal";
  modalOverlay.setAttribute("role", "dialog");
  modalOverlay.setAttribute("aria-modal", "true");
  modalOverlay.setAttribute("aria-label", "Screenshot viewer");

  const originalScrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${originalScrollY}px`;
  document.body.style.width = "100%";

  const shell = document.createElement("div");
  shell.className = "nyaa-enhancer-screenshot-viewer";

  const header = document.createElement("header");
  header.className = "nyaa-enhancer-screenshot-viewer-header";

  const titleBadge = document.createElement("div");
  titleBadge.className = "nyaa-enhancer-screenshot-viewer-title";

  const headerEnd = document.createElement("div");
  headerEnd.className = "nyaa-enhancer-screenshot-viewer-header-end";

  const counter = document.createElement("span");
  counter.className = "nyaa-enhancer-screenshot-viewer-counter";

  const actions = document.createElement("div");
  actions.className = "nyaa-enhancer-screenshot-viewer-actions";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "nyaa-enhancer-screenshot-viewer-btn";
  openButton.innerHTML =
    '<i class="fa fa-external-link" aria-hidden="true"></i><span>Open</span>';
  openButton.title = "Open in New Tab";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className =
    "nyaa-enhancer-screenshot-viewer-btn nyaa-enhancer-screenshot-viewer-btn-icon";
  closeButton.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';
  closeButton.title = "Close";
  closeButton.setAttribute("aria-label", "Close");

  const stage = document.createElement("div");
  stage.className = "nyaa-enhancer-screenshot-viewer-stage";

  const loader = document.createElement("div");
  loader.className = "nyaa-enhancer-screenshot-viewer-loader";
  loader.setAttribute("aria-hidden", "true");

  const modalImage = document.createElement("img");
  modalImage.className = "nyaa-enhancer-screenshot-viewer-img";

  let prevButton;
  let nextButton;
  const thumbButtons = [];

  if (screenshots.length > 1) {
    prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className =
      "nyaa-enhancer-screenshot-viewer-nav nyaa-enhancer-screenshot-viewer-nav-prev";
    prevButton.innerHTML =
      '<i class="fa fa-chevron-left" aria-hidden="true"></i>';
    prevButton.setAttribute("aria-label", "Previous screenshot");

    nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className =
      "nyaa-enhancer-screenshot-viewer-nav nyaa-enhancer-screenshot-viewer-nav-next";
    nextButton.innerHTML =
      '<i class="fa fa-chevron-right" aria-hidden="true"></i>';
    nextButton.setAttribute("aria-label", "Next screenshot");
  }

  function closeModal() {
    document.removeEventListener("keydown", onKeyDown);
    modalOverlay.remove();
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, originalScrollY);
  }

  function goToIndex(index) {
    currentIndex = index;
    updateModal();
  }

  function goRelative(delta) {
    goToIndex((currentIndex + delta + screenshots.length) % screenshots.length);
  }

  function updateModal() {
    const screenshot = screenshots[currentIndex];
    const fullUrl = getATScreenshotImageUrl(
      getATScreenshotDisplayUrl(screenshot.url),
      trackNum,
    );
    const labelText = screenshot.title || `Screenshot ${currentIndex + 1}`;

    titleBadge.textContent = labelText;
    counter.textContent = `${currentIndex + 1} / ${screenshots.length}`;
    counter.hidden = screenshots.length <= 1;
    modalImage.alt = labelText;

    loader.hidden = false;
    modalImage.classList.remove("is-loaded");
    modalImage.onload = () => {
      loader.hidden = true;
      modalImage.classList.add("is-loaded");
    };
    modalImage.onerror = () => {
      loader.hidden = true;
    };
    modalImage.src = fullUrl;
    openButton.onclick = () =>
      window.open(fullUrl, "_blank", "noopener,noreferrer");

    thumbButtons.forEach((btn, i) => {
      const active = i === currentIndex;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-current", active ? "true" : "false");
      if (active) {
        btn.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    });
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowLeft" && screenshots.length > 1) {
      e.preventDefault();
      goRelative(-1);
    } else if (e.key === "ArrowRight" && screenshots.length > 1) {
      e.preventDefault();
      goRelative(1);
    }
  }

  closeButton.addEventListener("click", (e) => {
    e.stopPropagation();
    closeModal();
  });
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  shell.addEventListener("click", (e) => e.stopPropagation());

  if (prevButton) {
    prevButton.addEventListener("click", (e) => {
      e.stopPropagation();
      goRelative(-1);
    });
  }
  if (nextButton) {
    nextButton.addEventListener("click", (e) => {
      e.stopPropagation();
      goRelative(1);
    });
  }

  actions.append(openButton, closeButton);
  headerEnd.append(counter, actions);
  header.append(titleBadge, headerEnd);

  stage.append(loader, modalImage);
  if (prevButton) stage.appendChild(prevButton);
  if (nextButton) stage.appendChild(nextButton);

  shell.append(header, stage);

  if (screenshots.length > 1) {
    const filmstrip = document.createElement("div");
    filmstrip.className = "nyaa-enhancer-screenshot-viewer-filmstrip";
    const filmstripInner = document.createElement("div");
    filmstripInner.className =
      "nyaa-enhancer-screenshot-viewer-filmstrip-inner";

    screenshots.forEach((shot, i) => {
      const thumbBtn = document.createElement("button");
      thumbBtn.type = "button";
      thumbBtn.className = "nyaa-enhancer-screenshot-viewer-thumb";
      thumbBtn.setAttribute("aria-label", shot.title || `Screenshot ${i + 1}`);

      const thumbImg = document.createElement("img");
      thumbImg.loading = "lazy";
      thumbImg.alt = "";
      thumbImg.src = getATScreenshotImageUrl(
        getATScreenshotDisplayUrl(shot.url),
        trackNum,
      );
      thumbBtn.appendChild(thumbImg);
      thumbBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        goToIndex(i);
      });
      thumbButtons.push(thumbBtn);
      filmstripInner.appendChild(thumbBtn);
    });

    filmstrip.appendChild(filmstripInner);
    shell.appendChild(filmstrip);
  }

  document.addEventListener("keydown", onKeyDown);
  modalOverlay.appendChild(shell);
  document.body.appendChild(modalOverlay);
  updateModal();
}

export function renderATScreenshotsGrid(body, screenshots, subtitles, isXyz) {
  body.replaceChildren();

  const toolbar = document.createElement("div");
  toolbar.className = "nyaa-enhancer-at-screenshots-toolbar";

  const trackSelect = document.createElement("select");
  trackSelect.className = "nyaa-enhancer-at-track-select";
  const noTrackOption = document.createElement("option");
  noTrackOption.value = "";
  noTrackOption.textContent = "No Subtitle Track";
  trackSelect.appendChild(noTrackOption);

  if (!isXyz) {
    subtitles.forEach(({ text, link }) => {
      const trackMatch = link.match(/_track(\d+)/);
      if (trackMatch && !text.includes("All Attachments")) {
        const option = document.createElement("option");
        option.value = trackMatch[1];
        option.textContent = `Track ${trackMatch[1]} - ${text}`;
        trackSelect.appendChild(option);
      }
    });
  }

  const grid = document.createElement("div");
  grid.className = "nyaa-enhancer-at-screenshot-grid";

  function updateGrid(trackNum) {
    grid.replaceChildren();
    screenshots.forEach((shot) => {
      const thumb = document.createElement("div");
      thumb.className = "nyaa-enhancer-at-screenshot-thumb";
      thumb.style.paddingBottom = "56.25%";

      const overlay = document.createElement("div");
      overlay.className = "nyaa-enhancer-at-screenshot-overlay";
      overlay.textContent = shot.title;

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = shot.title;
      img.src = getATScreenshotImageUrl(
        getATScreenshotDisplayUrl(shot.url),
        trackNum,
      );
      img.onload = () => {
        if (img.naturalWidth > 0) {
          thumb.style.paddingBottom = `${(img.naturalHeight / img.naturalWidth) * 100}%`;
        }
      };

      thumb.append(img, overlay);
      thumb.addEventListener("click", () => {
        const index = screenshots.findIndex((s) => s.url === shot.url);
        openATScreenshotModal(screenshots, index >= 0 ? index : 0, trackNum);
      });
      grid.appendChild(thumb);
    });
  }

  trackSelect.addEventListener("change", () => updateGrid(trackSelect.value));
  if (!isXyz && trackSelect.options.length > 1) {
    trackSelect.selectedIndex = 1;
  }
  updateGrid(trackSelect.value);

  if (!isXyz && trackSelect.options.length > 1) {
    toolbar.appendChild(trackSelect);
    body.appendChild(toolbar);
  }
  body.appendChild(grid);
}

export function animetoshoEpisodeFeaturesEnabled(prefs) {
  return (
    prefs.showATScreenshotsSection ||
    prefs.showATFileInfoSection ||
    prefs.showATAttachmentsSection
  );
}

export async function refreshAnimetoshoEpisodeFeatures(prefs, options = {}) {
  const { fromEpisodePick = false } = options;
  const scrollX = options.scrollX ?? window.scrollX;
  const scrollY = options.scrollY ?? window.scrollY;
  const restoreScroll = () => window.scrollTo(scrollX, scrollY);

  const fetchId = ++atEpisodeFetchId;
  const panel = document.querySelector(".nyaa-enhancer-description-panel");
  if (!panel) return;

  try {
    const wantScreenshots = !!prefs.showATScreenshotsSection;
    const wantFileinfo = !!prefs.showATFileInfoSection;
    const wantAttachments = !!prefs.showATAttachmentsSection;

    if (!wantScreenshots) {
      panel.querySelector('[data-section="atscreenshots"]')?.remove();
      panel.querySelector("#at-screenshots-panel")?.remove();
    }
    if (!wantFileinfo) {
      panel.querySelector('[data-section="atfileinfo"]')?.remove();
      panel.querySelector("#at-fileinfo-panel")?.remove();
    }
    if (!wantAttachments) {
      panel.querySelector('[data-section="atattachments"]')?.remove();
      panel.querySelector("#at-attachments-panel")?.remove();
    }

    const insertAfterForFileinfo = wantScreenshots
      ? "atscreenshots"
      : "description";
    let insertAfterForAttachments = "description";
    if (wantFileinfo) insertAfterForAttachments = "atfileinfo";
    else if (wantScreenshots) insertAfterForAttachments = "atscreenshots";

    const screenshotBody = wantScreenshots
      ? (ensureDescriptionTab(
          panel,
          "atscreenshots",
          "Screenshots",
          "description",
        ),
        getOrCreateDescriptionPanelBody(panel, "atscreenshots"))
      : null;
    const fileinfoBody = wantFileinfo
      ? (ensureDescriptionTab(
          panel,
          "atfileinfo",
          "FileInfo",
          insertAfterForFileinfo,
        ),
        getOrCreateDescriptionPanelBody(panel, "atfileinfo"))
      : null;
    const attachmentsBody = wantAttachments
      ? (ensureDescriptionTab(
          panel,
          "atattachments",
          "Downloads",
          insertAfterForAttachments,
        ),
        getOrCreateDescriptionPanelBody(panel, "atattachments"))
      : null;

    const loadingMessage = "Loading from AnimeTosho…";
    if (!fromEpisodePick) {
      if (screenshotBody)
        setAnimetoshoTabStatus(screenshotBody, loadingMessage);
      if (fileinfoBody) setAnimetoshoTabStatus(fileinfoBody, loadingMessage);
      if (attachmentsBody)
        setAnimetoshoTabStatus(attachmentsBody, loadingMessage);
    }

    if (!isAnimetoshoSupportedViewPage()) {
      const msg =
        "AnimeTosho episode data is only available for anime (English-translated, Non-English-translated, or Raw).";
      if (screenshotBody) setAnimetoshoTabStatus(screenshotBody, msg);
      if (fileinfoBody) setAnimetoshoTabStatus(fileinfoBody, msg);
      if (attachmentsBody) setAnimetoshoTabStatus(attachmentsBody, msg);
      return;
    }

    const infoHash = document.querySelector("kbd")?.textContent?.trim();
    if (!infoHash) {
      const msg = "Info hash not found.";
      if (screenshotBody) setAnimetoshoTabStatus(screenshotBody, msg);
      if (fileinfoBody) setAnimetoshoTabStatus(fileinfoBody, msg);
      if (attachmentsBody) setAnimetoshoTabStatus(attachmentsBody, msg);
      return;
    }

    const record = await getAnimetoshoTorrentRecord(
      infoHash,
      prefs.useNewATDomain,
    );
    if (fetchId !== atEpisodeFetchId) return;

    if (!record?.viewUrl) {
      const msg = "Not found on AnimeTosho.";
      if (screenshotBody) setAnimetoshoTabStatus(screenshotBody, msg);
      if (fileinfoBody) setAnimetoshoTabStatus(fileinfoBody, msg);
      if (attachmentsBody) setAnimetoshoTabStatus(attachmentsBody, msg);
      return;
    }

    if (record.useNewATDomain && !record.xyzPageData) {
      await ensureAnimetoshoViewPageData(record);
      if (fetchId !== atEpisodeFetchId) return;
    }

    initAnimetoshoEpisodeSelection(record);
    if (fetchId !== atEpisodeFetchId) return;

    if (!atEpisodeSelection.epId) {
      const msg = "No episode file found on AnimeTosho.";
      if (screenshotBody) setAnimetoshoTabStatus(screenshotBody, msg);
      if (fileinfoBody) setAnimetoshoTabStatus(fileinfoBody, msg);
      if (attachmentsBody) setAnimetoshoTabStatus(attachmentsBody, msg);
      return;
    }

    if (atEpisodeSelection.countVidFiles > 1 && !atBatchViewHtml) {
      const batchResult = await fetchUrlViaBackground(record.viewUrl);
      if (fetchId !== atEpisodeFetchId) return;
      atBatchViewHtml = batchResult?.ok ? batchResult.text : null;
      if (record.useNewATDomain && batchResult?.ok) {
        atXyzViewPageHtml = batchResult.text;
        if (!record.xyzPageData) {
          record.xyzPageData = parseAnimetoshoXyzViewPage(batchResult.text);
        }
      }
    }

    let episodeViewHtml;
    if (
      record.useNewATDomain &&
      String(atEpisodeSelection.epId) === String(record.xyzViewId) &&
      atXyzViewPageHtml
    ) {
      episodeViewHtml = atXyzViewPageHtml;
    } else {
      episodeViewHtml = await fetchAnimetoshoEpisodeViewHtml(
        atEpisodeSelection.epId,
        record.useNewATDomain,
      );
    }
    if (fetchId !== atEpisodeFetchId) return;

    if (!episodeViewHtml) {
      const msg = "Failed to load episode data from AnimeTosho.";
      if (screenshotBody) setAnimetoshoTabStatus(screenshotBody, msg);
      if (fileinfoBody) setAnimetoshoTabStatus(fileinfoBody, msg);
      if (attachmentsBody) setAnimetoshoTabStatus(attachmentsBody, msg);
      return;
    }

    const latestPrefs = await loadStoredPreferences();
    if (
      fetchId !== atEpisodeFetchId ||
      !animetoshoEpisodeFeaturesEnabled(latestPrefs)
    ) {
      return;
    }

    if (wantFileinfo && fileinfoBody) {
      const { fileInfo, filename } = await fetchAnimetoshoEpisodeFileinfo(
        atEpisodeSelection.epId,
        record.useNewATDomain,
        episodeViewHtml,
      );
      if (fetchId !== atEpisodeFetchId) return;

      if (fileInfo) {
        renderATFileinfoBody(
          fileinfoBody,
          fileInfo,
          filename || atEpisodeSelection.epFilename,
        );
      } else {
        setAnimetoshoTabStatus(
          fileinfoBody,
          "No FileInfo on AnimeTosho for this episode.",
        );
      }
    }

    const attachmentGroups = mergeAnimetoshoSubtitleAttachments(
      atBatchViewHtml,
      episodeViewHtml,
      atEpisodeSelection.countVidFiles,
      record.useNewATDomain,
      atEpisodeSelection.epId,
      atEpisodeSelection.epFilename,
    );

    if (wantAttachments && attachmentsBody) {
      if (hasATAttachmentGroups(attachmentGroups)) {
        renderATAttachmentsBody(attachmentsBody, attachmentGroups);
      } else {
        setAnimetoshoTabStatus(
          attachmentsBody,
          "No downloads on AnimeTosho for this episode.",
        );
      }
    }

    if (wantScreenshots && screenshotBody) {
      const screenshotHtml = await fetchAnimetoshoScreenshotHtml(
        record,
        atEpisodeSelection.epId,
        record.useNewATDomain,
        episodeViewHtml,
      );
      if (fetchId !== atEpisodeFetchId) return;

      const screenshots = extractATScreenshotsFromHtml(
        screenshotHtml,
        record.useNewATDomain,
      );
      if (!screenshots.length) {
        setAnimetoshoTabStatus(
          screenshotBody,
          "No screenshots on AnimeTosho for this episode.",
        );
      } else {
        const screenshotSubtitles = record.useNewATDomain
          ? []
          : attachmentGroups.subtitles;
        renderATScreenshotsGrid(
          screenshotBody,
          screenshots,
          screenshotSubtitles,
          record.useNewATDomain,
        );
      }
    }

    setupAnimetoshoFileListEpisodeSelection(record);
  } finally {
    if (fromEpisodePick) {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    }
  }
}

export async function updateAnimetoshoEpisodeFeatures() {
  if (!window.location.pathname.startsWith("/view/")) {
    removeAnimetoshoEpisodeFeatures();
    return;
  }

  const prefs = await loadStoredPreferences();
  if (!animetoshoEpisodeFeaturesEnabled(prefs)) {
    removeAnimetoshoEpisodeFeatures();
    return;
  }

  if (!document.querySelector(".nyaa-enhancer-description-panel")) {
    return;
  }

  await refreshAnimetoshoEpisodeFeatures(prefs);
}
