import { dispatchTableMutated } from "./registry.js";

export let neTableMutationObserver = null;

let tableObserverPauseDepth = 0;

const EXTENSION_UI_SELECTOR = [
  ".magnet-checkbox",
  ".magnet-checkbox-column",
  ".magnet-select-all",
  ".link-action-copy",
  ".link-action-send",
  ".link-action-at",
  ".torrent-link-actions",
  ".seadex-link",
  ".magnet-notification-container",
  ".magnet-notification",
  ".button-container",
  ".nyaa-enhancer-toolbar",
  ".ne-filters-panel",
  ".ne-show-more",
  ".ne-auto-load",
  ".changelog-container",
  ".changelog-page",
  ".ne-settings-page",
].join(", ");

function asElement(node) {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) return node;
  return node.parentElement;
}

export function isExtensionUiNode(node) {
  if (!node) return true;
  if (node.nodeType === Node.TEXT_NODE) {
    return /^\s*$/.test(node.textContent || "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return true;
  if (node.matches(EXTENSION_UI_SELECTOR) || node.closest(EXTENSION_UI_SELECTOR)) {
    return true;
  }
  return !!node.matches?.("td") && !!node.querySelector(":scope > .magnet-checkbox");
}

export function mutationTouchesTorrentTable(mutation) {
  const targetEl = asElement(mutation.target);
  if (targetEl?.closest?.("table.torrent-list")) return true;
  for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (
      node.matches?.("table.torrent-list") ||
      node.querySelector?.("table.torrent-list")
    ) {
      return true;
    }
  }
  return false;
}

export function mutationsAreExtensionUiOnly(mutations) {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") return false;
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (!nodes.length) return false;
    for (const node of nodes) {
      if (!isExtensionUiNode(node)) return false;
    }
  }
  return mutations.length > 0;
}

function discardQueuedTableMutations() {
  neTableMutationObserver?.takeRecords();
}

export async function withTorrentTableObserverPaused(asyncFn) {
  tableObserverPauseDepth += 1;
  if (tableObserverPauseDepth === 1) {
    discardQueuedTableMutations();
  }
  try {
    return await asyncFn();
  } finally {
    discardQueuedTableMutations();
    tableObserverPauseDepth = Math.max(0, tableObserverPauseDepth - 1);
  }
}

export function observeTableChanges() {
  const root = document.documentElement;
  if (!root || neTableMutationObserver) return;

  neTableMutationObserver = new MutationObserver((mutations) => {
    if (tableObserverPauseDepth > 0) return;
    const relevant = mutations.filter(mutationTouchesTorrentTable);
    if (!relevant.length) return;
    if (mutationsAreExtensionUiOnly(relevant)) return;
    dispatchTableMutated(relevant);
  });

  neTableMutationObserver.observe(root, {
    childList: true,
    subtree: true,
  });
}
