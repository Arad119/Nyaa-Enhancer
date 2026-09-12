import { neShowMoreState } from "../internal.js";
import { dispatchTableMutated } from "./registry.js";

export let neTableMutationObserver = null;

export async function withTorrentTableObserverPaused(asyncFn) {
  const tableBody = document.querySelector("table.torrent-list tbody");
  if (neTableMutationObserver) {
    neTableMutationObserver.disconnect();
  }
  try {
    return await asyncFn();
  } finally {
    if (neTableMutationObserver && tableBody?.isConnected) {
      neTableMutationObserver.observe(tableBody, {
        childList: true,
        subtree: true,
      });
    }
  }
}

export function observeTableChanges() {
  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody || neTableMutationObserver) return;

  let isInitialLoad = true;
  neTableMutationObserver = new MutationObserver((mutations) => {
    if (isInitialLoad) {
      isInitialLoad = false;
      return;
    }
    if (neShowMoreState.loading) return;
    dispatchTableMutated(mutations);
  });

  neTableMutationObserver.observe(tableBody, {
    childList: true,
    subtree: true,
  });
}
