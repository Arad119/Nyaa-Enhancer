import { loadStoredPreferences } from "../../../shared/prefs.js";
import { showNotification } from "../../core/notifications.js";
import { createMagnetCopyButton } from "../../internal.js";

export async function addMagnetButtonToViewPage() {
  // Check if we're on a view page
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showMagnetButtons) return;

  // Find the magnet link
  const magnetLink = document.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  if (magnetLink.parentNode.querySelector(".magnet-button:not(.send-torrent-button)")) {
    return;
  }

  // Create the magnet button
  const magnetButton = createMagnetCopyButton(magnetLink, {
    extraStyles: { marginLeft: "10px" },
  });

  // Insert the button after the magnet link
  magnetLink.parentNode.insertBefore(magnetButton, magnetLink.nextSibling);
}

export async function toggleComments() {
  // Only run on view pages
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  const comments = document.getElementById("comments");
  if (!comments) return;

  // Set initial display style based on preference
  comments.style.display = prefs.hideComments ? "none" : "block";
}

export function isTorrentFileListItem(li) {
  return li.querySelector(":scope > i.fa-file") !== null;
}

export function countTorrentFilesIn(container) {
  let count = 0;
  container.querySelectorAll("li").forEach((li) => {
    if (isTorrentFileListItem(li)) count++;
  });
  return count;
}

export function getFolderLinkOriginalLabel(link) {
  if (!link.dataset.nyaaEnhancerFolderLabel) {
    const clone = link.cloneNode(true);
    clone.querySelectorAll("i").forEach((icon) => icon.remove());
    link.dataset.nyaaEnhancerFolderLabel = clone.textContent.trim();
  }
  return link.dataset.nyaaEnhancerFolderLabel;
}

export function setFolderLinkLabel(link, label) {
  const icon = link.querySelector("i");
  link.textContent = "";
  if (icon) link.appendChild(icon);
  link.appendChild(document.createTextNode(label));
}

export function restoreImprovedFileList() {
  const fileList = document.querySelector(".torrent-file-list");
  if (!fileList) return;

  const panel = fileList.closest(".panel");
  const titleEl = panel?.querySelector(".panel-heading .panel-title");
  if (titleEl?.dataset.nyaaEnhancerFileListTitle) {
    titleEl.textContent = titleEl.dataset.nyaaEnhancerFileListTitle;
    delete titleEl.dataset.nyaaEnhancerFileListTitle;
  }

  fileList.querySelectorAll("a.folder").forEach((link) => {
    if (link.dataset.nyaaEnhancerFolderLabel) {
      setFolderLinkLabel(link, link.dataset.nyaaEnhancerFolderLabel);
      delete link.dataset.nyaaEnhancerFolderLabel;
    }
  });
}

export function applyImprovedFileList(enabled) {
  if (!window.location.pathname.startsWith("/view/")) return;

  if (!enabled) {
    restoreImprovedFileList();
    return;
  }

  const fileList = document.querySelector(".torrent-file-list");
  if (!fileList) return;

  const rootUl = fileList.querySelector(":scope > ul");
  const topLevelFolderLis = rootUl
    ? [...rootUl.children].filter((li) => li.querySelector("a.folder"))
    : [];

  const totalFiles = countTorrentFilesIn(fileList);
  const panel = fileList.closest(".panel");
  const titleEl = panel?.querySelector(".panel-heading .panel-title");
  if (titleEl) {
    if (!titleEl.dataset.nyaaEnhancerFileListTitle) {
      titleEl.dataset.nyaaEnhancerFileListTitle = titleEl.textContent.trim();
    }
    titleEl.textContent = `${titleEl.dataset.nyaaEnhancerFileListTitle} - ${totalFiles}`;
  }

  fileList.querySelectorAll("a.folder").forEach((link) => {
    const folderLi = link.closest("li");
    if (!folderLi || topLevelFolderLis.includes(folderLi)) return;

    const folderFileCount = countTorrentFilesIn(folderLi);
    const originalLabel = getFolderLinkOriginalLabel(link);
    setFolderLinkLabel(link, `${originalLabel} - ${folderFileCount}`);
  });
}

export async function applyImprovedFileListFromPrefs() {
  const prefs = await loadStoredPreferences();
  applyImprovedFileList(prefs.improvedFileList);
}

function getTorrentInfoPanel() {
  if (!window.location.pathname.startsWith("/view/")) return null;

  const magnetLink = document.querySelector('.panel-footer a[href^="magnet:"]');
  if (magnetLink) return magnetLink.closest(".panel");

  const infoHashRow = Array.from(
    document.querySelectorAll(".panel-body .row"),
  ).find((row) => row.textContent.includes("Info hash:"));
  return infoHashRow?.closest(".panel") || null;
}

function hasNonCollapsedSelectionIn(el) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return false;
  }
  return el.contains(selection.anchorNode) || el.contains(selection.focusNode);
}

function copyToClipboard(text, successMessage, failureMessage) {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => showNotification(successMessage, true))
    .catch((err) => {
      console.error(failureMessage, err);
      showNotification(failureMessage, false);
    });
}

let titleCopyAbort = null;
let infoHashCopyAbort = null;

function teardownCopyTorrentTitle() {
  titleCopyAbort?.abort();
  titleCopyAbort = null;
  document.querySelectorAll(".nyaa-enhancer-copy-title").forEach((heading) => {
    heading.classList.remove("nyaa-enhancer-copy-title");
    const titleEl = heading.querySelector(".panel-title");
    if (titleEl?.dataset.nyaaEnhancerCopyTitleTip) {
      titleEl.removeAttribute("title");
      delete titleEl.dataset.nyaaEnhancerCopyTitleTip;
    }
  });
}

export function applyCopyTorrentTitle(enabled) {
  teardownCopyTorrentTitle();
  if (!enabled) return;

  const heading = getTorrentInfoPanel()?.querySelector(".panel-heading");
  const titleEl = heading?.querySelector(".panel-title");
  if (!heading || !titleEl) return;

  heading.classList.add("nyaa-enhancer-copy-title");
  titleEl.title = "Click to copy title";
  titleEl.dataset.nyaaEnhancerCopyTitleTip = "1";

  titleCopyAbort = new AbortController();
  heading.addEventListener(
    "click",
    (e) => {
      if (!titleEl.contains(e.target)) return;
      if (hasNonCollapsedSelectionIn(titleEl)) return;
      copyToClipboard(
        titleEl.textContent.trim(),
        "Title copied to clipboard!",
        "Failed to copy title",
      );
    },
    { signal: titleCopyAbort.signal },
  );
}

function findInfoHashKbd(panelBody) {
  const row = Array.from(panelBody.querySelectorAll(".row")).find((row) =>
    row.textContent.includes("Info hash:"),
  );
  return row?.querySelector("kbd") || null;
}

function getInfoHashKbdFromEvent(panelBody, target) {
  const kbd = target?.closest?.("kbd");
  if (!kbd || !panelBody.contains(kbd)) return null;
  const row = kbd.closest(".row");
  if (!row?.textContent.includes("Info hash:")) return null;
  return kbd;
}

function teardownCopyTorrentInfoHash() {
  infoHashCopyAbort?.abort();
  infoHashCopyAbort = null;
  document.querySelectorAll(".nyaa-enhancer-copy-infohash").forEach((body) => {
    body.classList.remove("nyaa-enhancer-copy-infohash");
    body
      .querySelectorAll("kbd[data-nyaa-enhancer-copy-hash-tip]")
      .forEach((kbd) => {
        kbd.removeAttribute("title");
        delete kbd.dataset.nyaaEnhancerCopyHashTip;
      });
  });
}

export function applyCopyTorrentInfoHash(enabled) {
  teardownCopyTorrentInfoHash();
  if (!enabled) return;

  const panelBody = getTorrentInfoPanel()?.querySelector(".panel-body");
  if (!panelBody) return;

  panelBody.classList.add("nyaa-enhancer-copy-infohash");
  infoHashCopyAbort = new AbortController();

  const markKbd = (kbd) => {
    if (!kbd || kbd.dataset.nyaaEnhancerCopyHashTip) return;
    kbd.title = "Click to copy info hash";
    kbd.dataset.nyaaEnhancerCopyHashTip = "1";
  };

  markKbd(findInfoHashKbd(panelBody));

  panelBody.addEventListener(
    "mouseover",
    (e) => markKbd(getInfoHashKbdFromEvent(panelBody, e.target)),
    { signal: infoHashCopyAbort.signal },
  );

  panelBody.addEventListener(
    "click",
    (e) => {
      const kbd = getInfoHashKbdFromEvent(panelBody, e.target);
      if (!kbd) return;
      if (hasNonCollapsedSelectionIn(kbd)) return;
      copyToClipboard(
        kbd.textContent.trim(),
        "Info hash copied to clipboard!",
        "Failed to copy info hash",
      );
    },
    { signal: infoHashCopyAbort.signal },
  );
}

export async function applyCopyableViewPageFieldsFromPrefs() {
  if (!window.location.pathname.startsWith("/view/")) return;
  const prefs = await loadStoredPreferences();
  applyCopyTorrentTitle(prefs.copyTorrentTitle);
  applyCopyTorrentInfoHash(prefs.copyTorrentInfoHash);
}
