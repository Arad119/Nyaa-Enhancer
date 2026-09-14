import { loadStoredPreferences } from "../../../shared/prefs.js";
import { createCancellableProgressNotification, getSelectedVisibleTorrentRows, getTitleFromRow, getTorrentIdFromRow, getTorrentInfoHashFromRow, getVisibleTorrentDataRows, isNyaaTorrentDataRow, isTorrentRowHidden, removeLegacyTorrentListActionColumns, sanitizeFilename, sendAllVisibleTorrents, sendSelectedTorrents, showKeywordMonitorPopup, showKeywordSelectPopup, showNotification, showQuickFilterPopup, updateAllTorrentListLinkActions } from "../../internal.js";
import { historyItemFromDownload, historyItemsFromRows, recordHistoryAction } from "../history/index.js";

export async function addCopyButton() {
  const prefs = await loadStoredPreferences();

  // If buttons are disabled, don't add the button container
  if (!prefs.showButtons) return;
  if (document.querySelector(".button-container.nyaa-enhancer-toolbar")) return;

  const container = document.querySelector(".table-responsive");
  if (!container) return;

  // Create a container for all our buttons and controls
  // This will be placed above the torrent table
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "button-container nyaa-enhancer-toolbar";

  const toolbarMain = document.createElement("div");
  toolbarMain.className = "nyaa-enhancer-toolbar__main";

  const copyGroup = document.createElement("div");
  copyGroup.className =
    "nyaa-enhancer-toolbar__group nyaa-enhancer-toolbar__group--split";
  copyGroup.dataset.group = "copy";

  const downloadGroup = document.createElement("div");
  downloadGroup.className =
    "nyaa-enhancer-toolbar__group nyaa-enhancer-toolbar__group--split";
  downloadGroup.dataset.group = "download";

  const sendGroup = document.createElement("div");
  sendGroup.className =
    "nyaa-enhancer-toolbar__group nyaa-enhancer-toolbar__group--split";
  sendGroup.dataset.group = "send";

  const sendSelectedButton = document.createElement("button");
  sendSelectedButton.className = "copy-magnets-button send-batch-button";
  sendSelectedButton.type = "button";
  sendSelectedButton.title = "Send Selected";
  sendSelectedButton.setAttribute("aria-label", "Send Selected");
  sendSelectedButton.innerHTML =
    '<i class="fa fa-cloud-upload" aria-hidden="true"></i><span class="ne-btn-label">Send</span>';
  sendSelectedButton.addEventListener("click", sendSelectedTorrents);

  const sendAllButton = document.createElement("button");
  sendAllButton.className = "copy-magnets-button send-batch-button";
  sendAllButton.type = "button";
  sendAllButton.title = "Send All";
  sendAllButton.setAttribute("aria-label", "Send All");
  sendAllButton.innerHTML =
    '<i class="fa fa-paper-plane ne-btn-icon-compact" aria-hidden="true"></i><span class="ne-btn-label">All</span>';
  sendAllButton.addEventListener("click", sendAllVisibleTorrents);
  if (!prefs.showSendButtons) {
    sendGroup.classList.add("nyaa-enhancer-toolbar__btn--hidden");
  }

  const selectionGroup = document.createElement("div");
  selectionGroup.className = "nyaa-enhancer-toolbar__group";
  selectionGroup.dataset.group = "selection";

  const toolbarAside = document.createElement("div");
  toolbarAside.className = "nyaa-enhancer-toolbar__aside";

  // Create the "Copy Selected" button
  // This copies magnet links of checked items
  const copyButton = document.createElement("button");
  copyButton.className = "copy-magnets-button";
  copyButton.type = "button";
  copyButton.title = "Copy Selected";
  copyButton.setAttribute("aria-label", "Copy Selected");
  copyButton.innerHTML =
    '<i class="fa fa-copy" aria-hidden="true"></i><span class="ne-btn-label">Copy</span>';
  copyButton.addEventListener("click", copySelectedMagnets);

  // Create the "Copy All" button
  // This copies all magnet links regardless of selection
  const copyAllButton = document.createElement("button");
  copyAllButton.className = "copy-magnets-button";
  copyAllButton.type = "button";
  copyAllButton.title = "Copy All";
  copyAllButton.setAttribute("aria-label", "Copy All");
  copyAllButton.innerHTML =
    '<i class="fa fa-files-o ne-btn-icon-compact" aria-hidden="true"></i><span class="ne-btn-label">All</span>';
  copyAllButton.addEventListener("click", copyAllMagnets);

  // Create the "Download Selected" button
  // This downloads .torrent files for checked items
  const downloadButton = document.createElement("button");
  downloadButton.className = "copy-magnets-button download-button";
  downloadButton.type = "button";
  downloadButton.title = "Download Selected";
  downloadButton.setAttribute("aria-label", "Download Selected");
  downloadButton.innerHTML =
    '<i class="fa fa-download" aria-hidden="true"></i><span class="ne-btn-label">Download</span>';
  downloadButton.addEventListener("click", downloadSelectedTorrents);

  // Create the "Download All" button
  // This downloads all .torrent files on the page
  const downloadAllButton = document.createElement("button");
  downloadAllButton.className = "copy-magnets-button download-button";
  downloadAllButton.type = "button";
  downloadAllButton.title = "Download All";
  downloadAllButton.setAttribute("aria-label", "Download All");
  downloadAllButton.innerHTML =
    '<i class="fa fa-cloud-download ne-btn-icon-compact" aria-hidden="true"></i><span class="ne-btn-label">All</span>';
  downloadAllButton.addEventListener("click", downloadAllTorrents);

  const invertButton = document.createElement("button");
  invertButton.className = "copy-magnets-button";
  invertButton.type = "button";
  invertButton.title = "Invert Selection";
  invertButton.setAttribute("aria-label", "Invert Selection");
  invertButton.innerHTML =
    '<i class="fa fa-exchange" aria-hidden="true"></i><span class="ne-btn-label">Invert</span>';
  invertButton.addEventListener("click", invertSelection);

  // Create the "Clear Selection" button
  // This unchecks all checkboxes
  const clearButton = document.createElement("button");
  clearButton.className = "copy-magnets-button clear-button";
  clearButton.type = "button";
  clearButton.title = "Clear Selection";
  clearButton.setAttribute("aria-label", "Clear Selection");
  clearButton.innerHTML =
    '<i class="fa fa-times-circle" aria-hidden="true"></i><span class="ne-btn-label">Clear</span>';
  clearButton.addEventListener("click", clearSelection);

  // Create a counter to show how many items are selected
  const selectionCounter = document.createElement("span");
  selectionCounter.className = "magnet-selection-counter";
  selectionCounter.setAttribute("role", "status");
  selectionCounter.setAttribute("aria-live", "polite");
  updateSelectionCounterDisplay(selectionCounter, 0);

  // Add a listener to update the counter whenever checkboxes change
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("magnet-checkbox")) {
      updateSelectionCounterDisplay(
        selectionCounter,
        countVisibleCheckedTorrents(),
      );
    }
  });

  // Create Quick Filter button
  const quickFilterButton = document.createElement("button");
  quickFilterButton.className = "copy-magnets-button quick-filter-button";
  quickFilterButton.type = "button";
  quickFilterButton.title = "Quick Search";
  if (!prefs.showQuickFilter) {
    quickFilterButton.classList.add("nyaa-enhancer-toolbar__btn--hidden");
  }
  quickFilterButton.innerHTML =
    '<i class="fa fa-bolt" aria-hidden="true"></i><span class="ne-btn-label">Quick Search</span>';
  quickFilterButton.addEventListener("click", showQuickFilterPopup);

  // Create Keyword Select button
  const keywordSelectButton = document.createElement("button");
  keywordSelectButton.className = "copy-magnets-button keyword-select-button";
  keywordSelectButton.type = "button";
  keywordSelectButton.title = "Keyword Select";
  keywordSelectButton.setAttribute("aria-label", "Keyword Select");
  keywordSelectButton.innerHTML =
    '<i class="fa fa-check-square" aria-hidden="true"></i><span class="ne-btn-label">Keywords</span>';
  keywordSelectButton.addEventListener("click", showKeywordSelectPopup);

  // Create Keyword Monitor button
  const keywordMonitorButton = document.createElement("button");
  keywordMonitorButton.className = "copy-magnets-button keyword-monitor-button";
  keywordMonitorButton.type = "button";
  keywordMonitorButton.title = "Keyword Monitor";
  keywordMonitorButton.setAttribute("aria-label", "Keyword Monitor");
  if (!prefs.showMonitorButtons) {
    keywordMonitorButton.classList.add("nyaa-enhancer-toolbar__btn--hidden");
  }
  keywordMonitorButton.innerHTML =
    '<i class="fa fa-bell" aria-hidden="true"></i><span class="ne-btn-label">Monitor</span>';
  keywordMonitorButton.addEventListener("click", showKeywordMonitorPopup);

  copyGroup.append(copyButton, copyAllButton);
  downloadGroup.append(downloadButton, downloadAllButton);
  sendGroup.append(sendSelectedButton, sendAllButton);
  selectionGroup.append(
    invertButton,
    keywordSelectButton,
    keywordMonitorButton,
    clearButton,
  );
  toolbarMain.append(copyGroup, downloadGroup, sendGroup, selectionGroup);
  toolbarAside.append(selectionCounter, quickFilterButton);
  buttonContainer.append(toolbarMain, toolbarAside);
  container.parentNode.insertBefore(buttonContainer, container);
}

export function updateSelectionCounterDisplay(counter, count) {
  if (counter) {
    counter.textContent = `${count} selected`;
    counter.classList.toggle("magnet-selection-counter--active", count > 0);
  }
  syncSelectAllCheckbox();
}

export function getVisibleRowCheckboxes() {
  return getVisibleTorrentDataRows()
    .map((row) => row.querySelector(".magnet-checkbox"))
    .filter(Boolean);
}

export function countVisibleCheckedTorrents() {
  return getVisibleRowCheckboxes().filter((box) => box.checked).length;
}

export function syncSelectionToVisibleRows() {
  document.querySelectorAll("table.torrent-list tbody tr").forEach((row) => {
    if (!isTorrentRowHidden(row)) return;
    const checkbox = row.querySelector(".magnet-checkbox");
    if (checkbox?.checked) checkbox.checked = false;
  });
  const counter = document.querySelector(".magnet-selection-counter");
  updateSelectionCounterDisplay(counter, countVisibleCheckedTorrents());
}

export function syncSelectAllCheckbox() {
  const header = document.querySelector(".magnet-select-all");
  if (!header) return;
  const boxes = getVisibleRowCheckboxes();
  const checked = boxes.filter((box) => box.checked).length;
  header.checked = boxes.length > 0 && checked === boxes.length;
  header.indeterminate = checked > 0 && checked < boxes.length;
  header.disabled = boxes.length === 0;
  header.setAttribute(
    "aria-label",
    header.checked ? "Deselect all visible torrents" : "Select all visible torrents",
  );
}

export function setVisibleTorrentSelection(checked) {
  getVisibleRowCheckboxes().forEach((box) => {
    box.checked = !!checked;
  });
  const selectionCounter = document.querySelector(".magnet-selection-counter");
  updateSelectionCounterDisplay(selectionCounter, countVisibleCheckedTorrents());
}

export let neTorrentCheckboxLastChecked = null;

export function addCheckboxToTorrentRow(row, prefs) {
  if (!prefs.showButtons || !isNyaaTorrentDataRow(row)) return;
  if (row.querySelector(".magnet-checkbox")) return;

  const checkboxCell = document.createElement("td");
  checkboxCell.className = "text-center";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "magnet-checkbox";

  checkbox.addEventListener("click", function (e) {
    if (!neTorrentCheckboxLastChecked) {
      neTorrentCheckboxLastChecked = this;
      return;
    }

    if (e.shiftKey) {
      const checkboxes = Array.from(
        document.querySelectorAll(".magnet-checkbox"),
      ).filter((box) => !isTorrentRowHidden(box.closest("tr")));
      const start = checkboxes.indexOf(this);
      const end = checkboxes.indexOf(neTorrentCheckboxLastChecked);
      if (start !== -1 && end !== -1) {
        checkboxes
          .slice(Math.min(start, end), Math.max(start, end) + 1)
          .forEach((box) => (box.checked = this.checked));
      }
    }

    neTorrentCheckboxLastChecked = this;
  });

  checkboxCell.appendChild(checkbox);
  row.appendChild(checkboxCell);
}

// Function to add a checkbox column to the torrent table
// This allows users to select individual torrents for batch operations
export async function addCheckboxColumn() {
  const prefs = await loadStoredPreferences();

  removeLegacyTorrentListActionColumns();
  await updateAllTorrentListLinkActions(prefs);

  // Add checkbox column header only if buttons are enabled and doesn't exist
  const headerRow = document.querySelector("table.torrent-list thead tr");
  if (
    headerRow &&
    prefs.showButtons &&
    !headerRow.querySelector(".magnet-checkbox-column")
  ) {
    const checkboxHeader = document.createElement("th");
    checkboxHeader.className = "magnet-checkbox-column text-center";
    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.className = "magnet-select-all";
    selectAll.title = "Select all visible";
    selectAll.setAttribute("aria-label", "Select all visible torrents");
    selectAll.addEventListener("click", (event) => {
      event.stopPropagation();
      setVisibleTorrentSelection(selectAll.checked);
    });
    checkboxHeader.appendChild(selectAll);
    headerRow.appendChild(checkboxHeader);
  }

  document.querySelectorAll("table.torrent-list tbody tr").forEach((row) => {
    addCheckboxToTorrentRow(row, prefs);
  });
  syncSelectAllCheckbox();
}

export function copySelectedMagnets() {
  const selectedRows = getSelectedVisibleTorrentRows();
  const selectedMagnets = selectedRows
    .map((row) => row.querySelector('a[href^="magnet:"]')?.href)
    .filter(Boolean);

  if (selectedMagnets.length > 0) {
    const magnetText = selectedMagnets.join("\n");
    navigator.clipboard
      .writeText(magnetText)
      .then(() => {
        recordHistoryAction("save", historyItemsFromRows(selectedRows));
        showNotification(
          `${selectedMagnets.length} Magnet links copied to clipboard!`,
          true,
        );
      })
      .catch((err) => {
        console.error("Failed to copy magnets:", err);
        showNotification("Failed to copy magnet links", false);
      });
  } else {
    showNotification("No visible torrents selected!", false);
  }
}

// Function to copy ALL magnet links from the page
// This ignores the checkbox selection state
export function copyAllMagnets() {
  const allMagnets = [];
  const items = [];
  const rows = document.querySelectorAll("table.torrent-list tbody tr");

  rows.forEach((row) => {
    if (row.style.display === "none") return;

    const magnetLink = row.querySelector('a[href^="magnet:"]');
    if (magnetLink) {
      allMagnets.push(magnetLink.href);
      items.push({
        id: getTorrentIdFromRow(row),
        title: getTitleFromRow(row),
        hash: getTorrentInfoHashFromRow(row),
      });
    }
  });

  if (allMagnets.length > 0) {
    const magnetText = allMagnets.join("\n");
    navigator.clipboard
      .writeText(magnetText)
      .then(() => {
        recordHistoryAction("save", items);
        showNotification(
          `Copied ${allMagnets.length} magnet links to clipboard!`,
          true,
        );
      })
      .catch((err) => {
        console.error("Failed to copy magnets:", err);
        showNotification("Failed to copy magnet links", false);
      });
  } else {
    showNotification("No magnet links found!", false);
  }
}

// Function to update the selection counter display
// Shows how many torrents are currently selected
export function updateSelectionCounter(selectionCounter) {
  updateSelectionCounterDisplay(
    selectionCounter,
    countVisibleCheckedTorrents(),
  );
}

// Function to clear all selected checkboxes
// Shows a notification if there's nothing to clear
export function clearSelection() {
  const checkboxes = document.querySelectorAll(".magnet-checkbox:checked");
  if (checkboxes.length === 0) {
    showNotification("No checkboxes are selected to clear!", false);
    return;
  }

  const selectionCounter = document.querySelector(".magnet-selection-counter");
  if (!selectionCounter) return;

  // Uncheck all selected checkboxes
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  // Reset the selection counter
  updateSelectionCounterDisplay(selectionCounter, 0);
  showNotification("Selection cleared", true);
}

export async function downloadSelectedTorrents() {
  const selectedTorrents = [];
  getSelectedVisibleTorrentRows().forEach((row) => {
    const torrentLink = row.querySelector('a[href$=".torrent"]');
    const title = getTitleFromRow(row);
    if (torrentLink && title) {
      selectedTorrents.push({
        url: torrentLink.href,
        filename: title,
        id: getTorrentIdFromRow(row),
        hash: getTorrentInfoHashFromRow(row),
      });
    }
  });

  // Start download process if we found any torrents
  if (selectedTorrents.length > 0) {
    await downloadTorrents(selectedTorrents, "selected_torrents.zip");
  } else {
    showNotification("No visible torrents selected!", false);
  }
}

// Function to download all torrent files on the page
// Downloads are combined into a ZIP if the ZIP option is enabled
export async function downloadAllTorrents() {
  const allTorrents = [];
  const rows = document.querySelectorAll("table.torrent-list tbody tr");

  // Collect information about all visible torrents
  rows.forEach((row) => {
    // Skip hidden rows (dead torrents)
    if (row.style.display === "none") return;

    const torrentLink = row.querySelector('a[href$=".torrent"]');
    const title = getTitleFromRow(row);
    if (torrentLink && title) {
      allTorrents.push({
        url: torrentLink.href,
        filename: title,
        id: getTorrentIdFromRow(row),
        hash: getTorrentInfoHashFromRow(row),
      });
    }
  });

  // Start download process if we found any torrents
  if (allTorrents.length > 0) {
    await downloadTorrents(allTorrents, "all_torrents.zip");
  } else {
    showNotification("No torrents found!", false);
  }
}

const DOWNLOAD_FETCH_TIMEOUT_MS = 20000;
const DOWNLOAD_FILE_GAP_MS = 500;

let torrentBatchDownloadBusy = false;

function isAbortError(error) {
  return error?.name === "AbortError";
}

function delayWithSignal(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchTorrentBlob(url, userSignal) {
  const timeoutController = new AbortController();
  const timer = window.setTimeout(
    () => timeoutController.abort(),
    DOWNLOAD_FETCH_TIMEOUT_MS,
  );
  const onUserAbort = () => timeoutController.abort();
  if (userSignal) {
    if (userSignal.aborted) timeoutController.abort();
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }

  try {
    const response = await fetch(url, { signal: timeoutController.signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    if (userSignal?.aborted) {
      throw isAbortError(error)
        ? error
        : new DOMException("Aborted", "AbortError");
    }
    if (timeoutController.signal.aborted) {
      throw new Error("Timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    userSignal?.removeEventListener("abort", onUserAbort);
  }
}

function torrentDownloadFilename(torrent, prefs) {
  return prefs.useDisplayName
    ? sanitizeFilename(torrent.filename) + ".torrent"
    : torrent.url.split("/").pop();
}

function finishCancelledDownload(progress, completedDownloads, total, { keptFiles = false } = {}) {
  progress.setStatus("warning");
  progress.setCancelVisible(false);
  progress.setText(
    keptFiles && completedDownloads
      ? `Cancelled (${completedDownloads}/${total} downloaded).`
      : "Download cancelled.",
  );
  progress.dismiss();
}

export async function downloadTorrentsAsZip(torrents, zipName) {
  const controller = new AbortController();
  const abortSignal = controller.signal;
  const progress = createCancellableProgressNotification({
    onCancel: () => controller.abort(),
  });

  try {
    const zip = new globalThis.JSZip();
    let completedDownloads = 0;
    const failedNames = [];
    const savedItems = [];
    const prefs = await loadStoredPreferences();

    progress.setText(`Progress: 0/${torrents.length} files`);

    for (const torrent of torrents) {
      if (abortSignal.aborted) break;
      try {
        if (completedDownloads > 0) {
          await delayWithSignal(DOWNLOAD_FILE_GAP_MS, abortSignal);
        }

        const blob = await fetchTorrentBlob(torrent.url, abortSignal);
        const base64Data = await blobToBase64(blob);
        zip.file(
          torrentDownloadFilename(torrent, prefs),
          base64Data.split(",")[1],
          { base64: true },
        );

        const saved = historyItemFromDownload(torrent);
        if (saved) savedItems.push(saved);

        completedDownloads++;
        progress.setText(
          `Progress: ${completedDownloads}/${torrents.length} files`,
        );
      } catch (error) {
        if (isAbortError(error) || abortSignal.aborted) break;
        failedNames.push(torrent.filename);
        console.error(`Failed to fetch torrent: ${torrent.filename}`, error);
      }
    }

    if (abortSignal.aborted) {
      finishCancelledDownload(progress, completedDownloads, torrents.length);
      return;
    }

    if (completedDownloads === 0) {
      progress.setStatus("error");
      progress.setCancelVisible(false);
      progress.setText(
        "ZIP failed: none of the torrent files could be downloaded.",
      );
      progress.dismiss();
      return;
    }

    progress.setText("Generating ZIP file...");
    progress.setCancelEnabled(true);

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
    });

    if (abortSignal.aborted) {
      finishCancelledDownload(progress, completedDownloads, torrents.length);
      return;
    }

    const zipUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(zipUrl);
    if (savedItems.length) recordHistoryAction("download", savedItems);

    progress.setCancelVisible(false);
    if (failedNames.length) {
      progress.setStatus("warning");
      progress.setText(
        `ZIP downloaded with ${failedNames.length} failed file${failedNames.length === 1 ? "" : "s"} (${completedDownloads}/${torrents.length} ok).`,
      );
    } else {
      progress.setText("ZIP file download complete!");
    }
    progress.dismiss();
  } catch (error) {
    if (isAbortError(error) || abortSignal.aborted) {
      finishCancelledDownload(progress, 0, torrents.length);
      return;
    }
    console.error("Download failed:", error);
    progress.setStatus("error");
    progress.setCancelVisible(false);
    progress.setText("Failed to create ZIP file: " + error.message);
    progress.dismiss();
  }
}

export async function downloadIndividualTorrents(torrents) {
  const controller = new AbortController();
  const abortSignal = controller.signal;
  const progress = createCancellableProgressNotification({
    onCancel: () => controller.abort(),
  });
  const prefs = await loadStoredPreferences();
  let completedDownloads = 0;
  const failedNames = [];
  const savedItems = [];

  progress.setText(`Progress: 0/${torrents.length} files`);

  for (const torrent of torrents) {
    if (abortSignal.aborted) break;
    try {
      const blob = await fetchTorrentBlob(torrent.url, abortSignal);
      const filename = torrentDownloadFilename(torrent, prefs);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      const saved = historyItemFromDownload(torrent);
      if (saved) savedItems.push(saved);

      completedDownloads++;
      progress.setText(
        `Progress: ${completedDownloads}/${torrents.length} files`,
      );
    } catch (error) {
      if (isAbortError(error) || abortSignal.aborted) break;
      failedNames.push(torrent.filename);
      console.error(`Failed to download torrent: ${torrent.filename}`, error);
    }
  }

  if (abortSignal.aborted) {
    if (savedItems.length) recordHistoryAction("download", savedItems);
    finishCancelledDownload(progress, completedDownloads, torrents.length, {
      keptFiles: true,
    });
    return;
  }

  progress.setCancelVisible(false);
  if (completedDownloads === 0) {
    progress.setStatus("error");
    progress.setText(
      "Download failed: none of the torrent files could be downloaded.",
    );
  } else if (failedNames.length) {
    progress.setStatus("warning");
    progress.setText(
      `Downloaded ${completedDownloads}/${torrents.length} files (${failedNames.length} failed).`,
    );
  } else {
    progress.setText("Download complete!");
  }
  if (savedItems.length) recordHistoryAction("download", savedItems);
  progress.dismiss();
}

export async function downloadTorrents(torrents, zipName) {
  if (torrentBatchDownloadBusy) {
    showNotification("A download is already in progress.", false);
    return;
  }

  torrentBatchDownloadBusy = true;
  try {
    const prefs = await loadStoredPreferences();
    if (torrents.length === 1 || !prefs.useZip) {
      await downloadIndividualTorrents(torrents);
    } else {
      await downloadTorrentsAsZip(torrents, zipName);
    }
  } finally {
    torrentBatchDownloadBusy = false;
  }
}

export function invertSelection() {
  const checkboxes = document.querySelectorAll(".magnet-checkbox");
  let invertedCount = 0;

  checkboxes.forEach((checkbox) => {
    // Only invert selection for visible rows
    const row = checkbox.closest("tr");
    if (row && row.style.display !== "none") {
      checkbox.checked = !checkbox.checked;
      if (checkbox.checked) invertedCount++;
    }
  });

  const selectionCounter = document.querySelector(".magnet-selection-counter");
  updateSelectionCounterDisplay(
    selectionCounter,
    countVisibleCheckedTorrents(),
  );

  showNotification(
    `Selection inverted (${invertedCount} items selected)`,
    true,
  );
}
