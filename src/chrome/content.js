// Function to load user preferences from Chrome's storage
// This includes settings for filename format and ZIP packaging
function loadStoredPreferences() {
  return new Promise((resolve) => {
    // chrome.storage.sync.get allows saving settings across different devices
    // if the user is signed into Chrome
    chrome.storage.sync.get(
      {
        // Default values if no settings are found:
        // - useDisplayName: whether to use anime titles for filenames
        // - useZip: whether to combine downloads into a ZIP file
        // - showButtons: whether to show button controls
        // - showATLinks: whether to show Animetosho links
        // - showMagnetButtons: whether to show magnet copy buttons
        // - showQuickFilter: whether to show the Quick Filter button
        // - hideDeadTorrents: whether to hide dead torrents
        // - keywords: array of keywords for filtering
        // - keywordFilterEnabled: whether keyword filtering is enabled
        // - showFilterNotifications: whether to show filter notifications
        // - hideComments: whether to hide comments on view pages
        // - improvedFileList: whether to show file counts on view page file lists
        // - fileSizeFilterEnabled: whether to enable file size filtering
        // - fileSizeMinBytes: minimum file size for filtering (bytes)
        // - fileSizeMaxBytes: maximum file size for filtering (bytes)
        // - completedDownloadsFilterEnabled: torrent list completed downloads filter
        // - completedDownloadsFilterOperator: gt, eq, or lt
        // - completedDownloadsFilterValue: threshold for completed downloads filter
        // - useNewATDomain: whether to use animetosho.xyz instead of animetosho.org
        // - showATComments: whether to show AnimeTosho comments on view pages
        // - showATScreenshotsSection: whether to show AnimeTosho screenshots tab on view pages
        // - showATFileInfoSection: whether to show AnimeTosho FileInfo tab on view pages
        // - showATAttachmentsSection: whether to show AnimeTosho downloads tab on view pages
        // - ameNZBApiKey: the user's ameNZB API key
        // - tmdbApiKey: the user's TMDB API key for Quick Search autocomplete
        // - showAmeNZBLinks: whether to show ameNZB links on supported view pages
        useDisplayName: true,
        useZip: true,
        showButtons: true,
        showATLinks: true,
        useNewATDomain: true,
        showATComments: false,
        showATScreenshotsSection: true,
        showATFileInfoSection: true,
        showATAttachmentsSection: true,
        ameNZBApiKey: "",
        tmdbApiKey: "",
        showAmeNZBLinks: false,
        showAmeNZBSection: false,
        showNekoBTLinks: false,
        showNekoBTSection: false,
        showNekoBTFullLangNames: true,
        showTsukihimeLinks: false,
        showTsukihimeSection: false,
        showSeaDex: false,
        screenshotPreviewEnabled: false,
        screenshotPreviewHoverDelay: 3,
        screenshotPreviewSlideDelay: 3,
        showMagnetButtons: true,
        showSendButtons: true,
        showQuickFilter: true,
        showMonitorButtons: true,
        hideDeadTorrents: false,
        keywords: [],
        keywordFilterEnabled: false,
        showFilterNotifications: true,
        hideComments: false,
        improvedFileList: true,
        fileSizeFilterEnabled: false,
        fileSizeMinBytes: 500 * 1024 * 1024,
        fileSizeMaxBytes: 4 * 1024 * 1024 * 1024,
        fileSizeRange: "less_than_1gb",
        completedDownloadsFilterEnabled: false,
        completedDownloadsFilterOperator: "gt",
        completedDownloadsFilterValue: 0,
        showChangelogNav: true,
        monitoredUsers: [],
        monitoredKeywords: [],
        torrentClient: "qbittorrent",
        torrentClientUrl: "",
        qbtUsername: "",
        qbtPassword: "",
        transmissionUsername: "",
        transmissionPassword: "",
        delugePassword: "",
        qbtCategories: [],
        qbtTags: [],
        qbtDefaultCategory: "",
        qbtDefaultTags: [],
        qbtPromptOnSend: true,
        qbtLastCategory: null,
        qbtLastTags: null,
      },
      (items) => {
        resolve(items);
      },
    );
  });
}

// Function to save individual preferences to Chrome's storage
// key: the setting name (useDisplayName or useZip)
// value: the boolean value of the setting (true/false)
function savePreference(key, value) {
  chrome.storage.sync.set({
    [key]: value,
  });
}

// Main function that creates and adds all UI elements to the page
async function addCopyButton() {
  const prefs = await loadStoredPreferences();

  // If buttons are disabled, don't add the button container
  if (!prefs.showButtons) return;

  const container = document.querySelector(".table-responsive");
  if (!container) return;

  // Create a container for all our buttons and controls
  // This will be placed above the torrent table
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "button-container nyaa-enhancer-toolbar";

  const toolbarMain = document.createElement("div");
  toolbarMain.className = "nyaa-enhancer-toolbar__main";

  const copyGroup = document.createElement("div");
  copyGroup.className = "nyaa-enhancer-toolbar__group";
  copyGroup.dataset.group = "copy";

  const downloadGroup = document.createElement("div");
  downloadGroup.className = "nyaa-enhancer-toolbar__group";
  downloadGroup.dataset.group = "download";

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
  copyButton.innerHTML =
    '<i class="fa fa-copy" aria-hidden="true"></i><span class="ne-btn-label">Copy Selected</span>';
  copyButton.addEventListener("click", copySelectedMagnets);

  // Create the "Copy All" button
  // This copies all magnet links regardless of selection
  const copyAllButton = document.createElement("button");
  copyAllButton.className = "copy-magnets-button";
  copyAllButton.type = "button";
  copyAllButton.title = "Copy All";
  copyAllButton.innerHTML =
    '<i class="fa fa-files-o" aria-hidden="true"></i><span class="ne-btn-label">Copy All</span>';
  copyAllButton.addEventListener("click", copyAllMagnets);

  // Create the "Download Selected" button
  // This downloads .torrent files for checked items
  const downloadButton = document.createElement("button");
  downloadButton.className = "copy-magnets-button download-button";
  downloadButton.type = "button";
  downloadButton.title = "Download Selected";
  downloadButton.innerHTML =
    '<i class="fa fa-download" aria-hidden="true"></i><span class="ne-btn-label">Download Selected</span>';
  downloadButton.addEventListener("click", downloadSelectedTorrents);

  // Create the "Download All" button
  // This downloads all .torrent files on the page
  const downloadAllButton = document.createElement("button");
  downloadAllButton.className = "copy-magnets-button download-button";
  downloadAllButton.type = "button";
  downloadAllButton.title = "Download All";
  downloadAllButton.innerHTML =
    '<i class="fa fa-cloud-download" aria-hidden="true"></i><span class="ne-btn-label">Download All</span>';
  downloadAllButton.addEventListener("click", downloadAllTorrents);

  const invertButton = document.createElement("button");
  invertButton.className = "copy-magnets-button";
  invertButton.type = "button";
  invertButton.title = "Invert Selection";
  invertButton.innerHTML =
    '<i class="fa fa-exchange" aria-hidden="true"></i><span class="ne-btn-label">Invert Selection</span>';
  invertButton.addEventListener("click", invertSelection);

  // Create the "Clear Selection" button
  // This unchecks all checkboxes
  const clearButton = document.createElement("button");
  clearButton.className = "copy-magnets-button clear-button";
  clearButton.type = "button";
  clearButton.title = "Clear Selection";
  clearButton.innerHTML =
    '<i class="fa fa-times-circle" aria-hidden="true"></i><span class="ne-btn-label">Clear Selection</span>';
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
      const checkedBoxes = document.querySelectorAll(
        ".magnet-checkbox:checked",
      ).length;
      updateSelectionCounterDisplay(selectionCounter, checkedBoxes);
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
  keywordSelectButton.innerHTML =
    '<i class="fa fa-check-square" aria-hidden="true"></i><span class="ne-btn-label">Keyword Select</span>';
  keywordSelectButton.addEventListener("click", showKeywordSelectPopup);

  // Create Keyword Monitor button
  const keywordMonitorButton = document.createElement("button");
  keywordMonitorButton.className = "copy-magnets-button keyword-monitor-button";
  keywordMonitorButton.type = "button";
  keywordMonitorButton.title = "Keyword Monitor";
  if (!prefs.showMonitorButtons) {
    keywordMonitorButton.classList.add("nyaa-enhancer-toolbar__btn--hidden");
  }
  keywordMonitorButton.innerHTML =
    '<i class="fa fa-bell" aria-hidden="true"></i><span class="ne-btn-label">Keyword Monitor</span>';
  keywordMonitorButton.addEventListener("click", showKeywordMonitorPopup);

  copyGroup.append(copyButton, copyAllButton);
  downloadGroup.append(downloadButton, downloadAllButton);
  selectionGroup.append(
    invertButton,
    keywordSelectButton,
    keywordMonitorButton,
    clearButton,
  );
  toolbarMain.append(copyGroup, downloadGroup, selectionGroup);
  toolbarAside.append(selectionCounter, quickFilterButton);
  buttonContainer.append(toolbarMain, toolbarAside);
  container.parentNode.insertBefore(buttonContainer, container);
}

function updateSelectionCounterDisplay(counter, count) {
  if (!counter) return;
  counter.textContent = `${count} selected`;
  counter.classList.toggle("magnet-selection-counter--active", count > 0);
}

function getInfoHashFromMagnet(href) {
  if (!href) return "";
  const hexMatch = href.match(/urn:btih:([a-f0-9]{40})/i);
  if (hexMatch) return hexMatch[1].toLowerCase();
  const match = href.match(/urn:btih:([^&]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function getTorrentInfoHashFromRow(row) {
  const magnetLink = row.querySelector('a[href^="magnet:"]');
  return magnetLink ? getInfoHashFromMagnet(magnetLink.href) : "";
}

const ANIMETOSHO_LIST_CATEGORY_TITLES = new Set([
  "Anime - English-translated",
  "Anime - Non-English-translated",
  "Anime - Raw",
]);

function isAnimetoshoListCategoryRow(row) {
  const categoryLink = row.querySelector("td:first-child a");
  return ANIMETOSHO_LIST_CATEGORY_TITLES.has(
    categoryLink?.getAttribute("title") || "",
  );
}

const ANIMETOSHO_VIEW_SUBCATEGORY_LABELS = new Set([
  "English-translated",
  "Non-English-translated",
  "Raw",
]);

function isSupportedAnimeViewPageCategory() {
  const categoryLinks = document.querySelectorAll(".row .col-md-5 a");
  const isAnime = Array.from(categoryLinks).some(
    (link) => link.textContent.trim() === "Anime",
  );
  const hasSubcategory = Array.from(categoryLinks).some((link) =>
    ANIMETOSHO_VIEW_SUBCATEGORY_LABELS.has(link.textContent.trim()),
  );
  return isAnime && hasSubcategory;
}

function getTorrentLinkCell(row) {
  return row.querySelector('td:has(a[href^="magnet:"])');
}

function getNextLinkActionSibling(anchor) {
  let next = anchor.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && /^\s+$/.test(next.textContent)) {
    next = next.nextSibling;
  }
  return next;
}

function hasSpaceBefore(node) {
  const prev = node?.previousSibling;
  return prev?.nodeType === Node.TEXT_NODE && /^\s+$/.test(prev.textContent);
}

function areLinkActionsOrdered(linkCell) {
  const magnetLink = linkCell.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return true;

  const actions = [
    linkCell.querySelector(".link-action-copy"),
    linkCell.querySelector(".link-action-send"),
    linkCell.querySelector(".link-action-at"),
  ].filter(Boolean);

  if (!actions.length) return true;

  let anchor = magnetLink;
  for (const action of actions) {
    if (getNextLinkActionSibling(anchor) !== action || !hasSpaceBefore(action)) {
      return false;
    }
    anchor = action;
  }

  return true;
}

function insertLinkActionAfter(linkCell, element, afterElement) {
  if (!afterElement) {
    linkCell.appendChild(element);
    return;
  }

  if (
    element.parentNode === linkCell &&
    getNextLinkActionSibling(afterElement) === element &&
    hasSpaceBefore(element)
  ) {
    return;
  }

  if (element.parentNode) {
    element.remove();
  }

  let insertRef = afterElement.nextSibling;
  if (
    !(
      insertRef &&
      insertRef.nodeType === Node.TEXT_NODE &&
      /^\s+$/.test(insertRef.textContent)
    )
  ) {
    const space = document.createTextNode(" ");
    linkCell.insertBefore(space, insertRef);
    insertRef = space;
  }

  linkCell.insertBefore(element, insertRef.nextSibling);
}

function removeLinkAction(element) {
  if (!element?.parentNode) return;

  const prev = element.previousSibling;
  element.remove();

  if (prev?.nodeType === Node.TEXT_NODE && /^\s+$/.test(prev.textContent)) {
    const before = prev.previousSibling;
    if (
      before?.matches?.(
        'a[href^="magnet:"], a[href*="/download/"], .link-action-copy, .link-action-send, .link-action-at',
      )
    ) {
      prev.remove();
    }
  }
}

function reorderLinkActionsInCell(linkCell) {
  if (areLinkActionsOrdered(linkCell)) return;

  const magnetLink = linkCell.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  const actions = [
    linkCell.querySelector(".link-action-copy"),
    linkCell.querySelector(".link-action-send"),
    linkCell.querySelector(".link-action-at"),
  ].filter(Boolean);

  if (!actions.length) return;

  actions.forEach(removeLinkAction);

  let anchor = magnetLink;
  for (const action of actions) {
    insertLinkActionAfter(linkCell, action, anchor);
    anchor = action;
  }
}

function removeLegacyTorrentListActionColumns() {
  document
    .querySelectorAll(
      'th.text-center[title="AT"], th.text-center[title="Magnet"], th.text-center[title="Send"]',
    )
    .forEach((header) => header.remove());
  document
    .querySelectorAll(".at-column, .magnet-column, .send-column")
    .forEach((cell) => cell.remove());
  document.querySelectorAll(".torrent-link-actions").forEach((container) => {
    while (container.firstChild) {
      container.parentNode.insertBefore(container.firstChild, container);
    }
    container.remove();
  });
  document
    .querySelectorAll(".link-action-copy.magnet-button, .link-action-send.magnet-button")
    .forEach((el) => el.remove());
}

function createMagnetCopyLink(magnetLink) {
  const copyLink = document.createElement("a");
  copyLink.href = "#";
  copyLink.className = "link-action-copy";
  copyLink.title = "Copy magnet link to clipboard";
  copyLink.innerHTML = '<i class="fa fa-fw fa-clipboard"></i>';
  copyLink.addEventListener("click", (e) => {
    e.preventDefault();
    navigator.clipboard
      .writeText(magnetLink.href)
      .then(() => {
        showNotification("Magnet link copied to clipboard!", true);
      })
      .catch((err) => {
        console.error("Failed to copy magnet:", err);
        showNotification("Failed to copy magnet link", false);
      });
  });
  return copyLink;
}

function createMagnetCopyButton(magnetLink, { extraStyles = {} } = {}) {
  const magnetButton = document.createElement("button");
  magnetButton.className = "magnet-button";
  magnetButton.title = "Copy magnet link to clipboard";
  magnetButton.innerHTML = '<i class="fa fa-clipboard"></i> Copy';
  magnetButton.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
  magnetButton.style.fontWeight = "500";
  Object.assign(magnetButton.style, extraStyles);
  magnetButton.addEventListener("click", () => {
    navigator.clipboard
      .writeText(magnetLink.href)
      .then(() => {
        showNotification("Magnet link copied to clipboard!", true);
      })
      .catch((err) => {
        console.error("Failed to copy magnet:", err);
        showNotification("Failed to copy magnet link", false);
      });
  });
  return magnetButton;
}

function updateTorrentRowLinkActions(row, prefs) {
  const linkCell = getTorrentLinkCell(row);
  if (!linkCell) return;

  const magnetLink = linkCell.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  const showAtLink =
    prefs.showATLinks && isAnimetoshoListCategoryRow(row);
  const needsAtSlot = prefs.showATLinks;
  const needsAny =
    prefs.showMagnetButtons ||
    prefs.showSendButtons ||
    showAtLink ||
    needsAtSlot;

  linkCell.querySelector(".torrent-link-actions")?.remove();

  let atLink = linkCell.querySelector(".link-action-at");
  let copyLink = linkCell.querySelector(".link-action-copy");
  let sendLink = linkCell.querySelector(".link-action-send");
  let changed = false;

  if (!needsAny) {
    if (atLink) {
      removeLinkAction(atLink);
      changed = true;
    }
    if (copyLink) {
      removeLinkAction(copyLink);
      changed = true;
    }
    if (sendLink) {
      removeLinkAction(sendLink);
      changed = true;
    }
    return;
  }

  if (prefs.showMagnetButtons) {
    if (!copyLink) {
      copyLink = createMagnetCopyLink(magnetLink);
      linkCell.appendChild(copyLink);
      changed = true;
    }
  } else if (copyLink) {
    removeLinkAction(copyLink);
    changed = true;
  }

  if (prefs.showSendButtons) {
    if (!sendLink) {
      sendLink = createSendListLink(magnetLink.href);
      linkCell.appendChild(sendLink);
      changed = true;
    }
  } else if (sendLink) {
    removeLinkAction(sendLink);
    changed = true;
  }

  if (showAtLink) {
    const infoHash = getTorrentInfoHashFromRow(row);
    if (infoHash) {
      if (atLink?.classList.contains("link-action-at-placeholder")) {
        removeLinkAction(atLink);
        atLink = null;
      }
      if (!atLink) {
        atLink = createAnimetoshoListAnchor(infoHash, prefs.useNewATDomain);
        linkCell.appendChild(atLink);
        changed = true;
      }
    } else if (atLink) {
      removeLinkAction(atLink);
      changed = true;
    }
  } else if (needsAtSlot) {
    if (atLink && !atLink.classList.contains("link-action-at-placeholder")) {
      removeLinkAction(atLink);
      atLink = null;
    }
    if (!atLink) {
      atLink = createAnimetoshoListPlaceholder();
      linkCell.appendChild(atLink);
      changed = true;
    }
  } else if (atLink) {
    removeLinkAction(atLink);
    changed = true;
  }

  if (changed || !areLinkActionsOrdered(linkCell)) {
    reorderLinkActionsInCell(linkCell);
  }
}

async function updateAllTorrentListLinkActions(overrides = {}) {
  const prefs = { ...(await loadStoredPreferences()), ...overrides };
  removeLegacyTorrentListActionColumns();
  document.querySelectorAll("table.torrent-list tbody tr").forEach((row) => {
    updateTorrentRowLinkActions(row, prefs);
  });
}

// Function to add a checkbox column to the torrent table
// This allows users to select individual torrents for batch operations
async function addCheckboxColumn() {
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
    headerRow.appendChild(checkboxHeader);
  }

  // Keep track of last checked checkbox
  let lastChecked = null;

  // Add cells only if they don't exist
  const rows = document.querySelectorAll("table.torrent-list tbody tr");
  rows.forEach((row) => {
    // Add checkbox cell only if buttons are enabled and doesn't exist
    if (prefs.showButtons && !row.querySelector(".magnet-checkbox")) {
      const checkboxCell = document.createElement("td");
      checkboxCell.className = "text-center";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "magnet-checkbox";

      checkbox.addEventListener("click", function (e) {
        if (!lastChecked) {
          lastChecked = this;
          return;
        }

        if (e.shiftKey) {
          const checkboxes = Array.from(
            document.querySelectorAll(".magnet-checkbox"),
          );
          const start = checkboxes.indexOf(this);
          const end = checkboxes.indexOf(lastChecked);

          checkboxes
            .slice(Math.min(start, end), Math.max(start, end) + 1)
            .forEach((checkbox) => (checkbox.checked = this.checked));
        }

        lastChecked = this;
      });

      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell);
    }
  });
}

// Function to show temporary notifications to the user
// These notifications provide feedback about actions (success/failure)
// message: The text to show in the notification
// isSuccess: Controls the color (green for success, red for failure)
function showNotification(message, isSuccess = true) {
  // Create or find the container for notifications
  // This container is fixed to the bottom-right corner of the screen
  let container = document.querySelector(".magnet-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "magnet-notification-container";
    document.body.appendChild(container);
  }

  // Create the notification element
  const notification = document.createElement("div");
  notification.className = "magnet-notification";
  notification.textContent = message;
  // Set color based on success/failure
  notification.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";

  container.appendChild(notification);

  // Force chrome to process the element before animation
  notification.offsetHeight;

  // Show the notification with a slide-in animation
  notification.classList.add("show");

  // Remove the notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    // Wait for fade-out animation before removing
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Function to copy magnet links from selected torrents
// This only copies links for torrents that have their checkbox checked
function copySelectedMagnets() {
  const selectedMagnets = [];
  const rows = document.querySelectorAll("table.torrent-list tbody tr");

  // Loop through all rows and collect magnet links from checked rows
  rows.forEach((row) => {
    const checkbox = row.querySelector(".magnet-checkbox");
    if (checkbox && checkbox.checked) {
      const magnetLink = row.querySelector('a[href^="magnet:"]');
      if (magnetLink) {
        selectedMagnets.push(magnetLink.href);
      }
    }
  });

  // If we found any magnet links, copy them to clipboard
  if (selectedMagnets.length > 0) {
    const magnetText = selectedMagnets.join("\n"); // One link per line
    navigator.clipboard
      .writeText(magnetText)
      .then(() => {
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
    showNotification("No magnet links selected!", false);
  }
}

// Function to copy ALL magnet links from the page
// This ignores the checkbox selection state
function copyAllMagnets() {
  const allMagnets = [];
  const rows = document.querySelectorAll("table.torrent-list tbody tr");

  // Loop through all visible rows and collect magnet links
  rows.forEach((row) => {
    // Skip hidden rows (dead torrents)
    if (row.style.display === "none") return;

    const magnetLink = row.querySelector('a[href^="magnet:"]');
    if (magnetLink) {
      allMagnets.push(magnetLink.href);
    }
  });

  // If we found any magnet links, copy them to clipboard
  if (allMagnets.length > 0) {
    const magnetText = allMagnets.join("\n"); // One link per line
    navigator.clipboard
      .writeText(magnetText)
      .then(() => {
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
function updateSelectionCounter(selectionCounter) {
  const checkedBoxes = document.querySelectorAll(
    ".magnet-checkbox:checked",
  ).length;
  updateSelectionCounterDisplay(selectionCounter, checkedBoxes);
}

// Function to clear all selected checkboxes
// Shows a notification if there's nothing to clear
function clearSelection() {
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

// Function to get the correct title from a row
function getTitleFromRow(row) {
  const titleCell = row.querySelector('td[colspan="2"]');
  if (!titleCell) return null;

  // Get the view link (this will always be the title link, not comments)
  // We specifically look for the last link in the cell to avoid the comment link
  const links = titleCell.querySelectorAll('a[href^="/view/"]');

  const titleLink = links[links.length - 1]; // Get the last view link (the actual title)

  return titleLink?.title || titleLink?.textContent || null;
}

function isNyaaTorrentListPage() {
  const path = window.location.pathname;
  return path === "/" || path === "" || path.startsWith("/user/");
}

function getCompletedDownloadsFromRow(row) {
  const cell = row.querySelector("td:nth-of-type(8)");
  if (!cell) return 0;
  return parseInt(cell.textContent.trim(), 10) || 0;
}

function matchesCompletedDownloadsFilter(count, operator, threshold) {
  switch (operator) {
    case "eq":
      return count === threshold;
    case "lt":
      return count < threshold;
    case "gt":
    default:
      return count > threshold;
  }
}

function failsCompletedDownloadsFilter(prefs, count) {
  if (!isNyaaTorrentListPage() || !prefs.completedDownloadsFilterEnabled) {
    return false;
  }
  const threshold = Number(prefs.completedDownloadsFilterValue);
  if (!Number.isFinite(threshold)) return false;
  return !matchesCompletedDownloadsFilter(
    count,
    prefs.completedDownloadsFilterOperator,
    threshold,
  );
}

// Function to download selected torrent files
// Downloads are combined into a ZIP if the ZIP option is enabled
async function downloadSelectedTorrents() {
  const selectedTorrents = [];
  const rows = document.querySelectorAll("table.torrent-list tbody tr");

  // Collect information about selected torrents
  rows.forEach((row) => {
    const checkbox = row.querySelector(".magnet-checkbox");
    if (checkbox && checkbox.checked) {
      const torrentLink = row.querySelector('a[href$=".torrent"]');
      const title = getTitleFromRow(row);
      if (torrentLink && title) {
        selectedTorrents.push({
          url: torrentLink.href,
          filename: title,
        });
      }
    }
  });

  // Start download process if we found any torrents
  if (selectedTorrents.length > 0) {
    await downloadTorrents(selectedTorrents, "selected_torrents.zip");
  } else {
    showNotification("No torrents selected!", false);
  }
}

// Function to download all torrent files on the page
// Downloads are combined into a ZIP if the ZIP option is enabled
async function downloadAllTorrents() {
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

// Function to create and show a progress notification
// Returns the notification element for updating progress
function createProgressNotification() {
  // Find or create the container for notifications
  let container = document.querySelector(".magnet-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "magnet-notification-container";
    document.body.appendChild(container);
  }

  // Create the notification element
  const notification = document.createElement("div");
  notification.className = "magnet-notification show";
  notification.style.backgroundColor = "#4CAF50";
  container.appendChild(notification);

  return notification;
}

function sanitizeFilename(filename) {
  // Replace any of the invalid characters with an underscore
  return filename.replace(/[<>:"/\\|?*]/g, "_");
}

// Function to download torrents and package them into a ZIP file
// torrents: Array of torrent objects with url and filename
// zipName: Name of the output ZIP file
async function downloadTorrentsAsZip(torrents, zipName) {
  try {
    // Initialize ZIP creation and progress tracking
    const zip = new JSZip();
    let completedDownloads = 0;
    const progressNotification = createProgressNotification();
    const prefs = await loadStoredPreferences();

    // Update initial progress
    progressNotification.textContent = `Progress: 0/${torrents.length} files`;

    // Helper function to convert Blob to Base64
    const blobToBase64 = (blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    for (const torrent of torrents) {
      try {
        // Add delay between requests (500ms)
        if (completedDownloads > 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Download the torrent file with explicit response type
        const response = await fetch(torrent.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the blob with explicit type
        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);

        // Use appropriate filename based on stored preference and sanitize it
        const filename = prefs.useDisplayName
          ? sanitizeFilename(torrent.filename) + ".torrent"
          : torrent.url.split("/").pop();

        // Add file to ZIP using base64
        zip.file(filename, base64Data.split(",")[1], { base64: true });

        // Update progress notification
        completedDownloads++;
        progressNotification.textContent = `Progress: ${completedDownloads}/${torrents.length} files`;
      } catch (error) {
        console.error(`Failed to fetch torrent: ${torrent.filename}`, error);
      }
    }

    // Generate and download the ZIP file
    progressNotification.textContent = "Generating ZIP file...";

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
    });

    // Trigger ZIP download
    const zipUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(zipUrl);

    // Show completion notification
    progressNotification.textContent = "ZIP file download complete!";
    setTimeout(() => {
      progressNotification.classList.remove("show");
      setTimeout(() => progressNotification.remove(), 300);
    }, 3000);
  } catch (error) {
    console.error("Download failed:", error);
    showNotification("Failed to create ZIP file: " + error.message, false);
  }
}

// Function to download individual torrent files one at a time
// This is used when ZIP option is disabled or only one file is selected
// torrents: Array of torrent objects with url and filename
async function downloadIndividualTorrents(torrents) {
  const prefs = await loadStoredPreferences();
  const progressNotification = createProgressNotification();
  let completedDownloads = 0;

  // Show progress notification
  progressNotification.textContent = `Progress: 0/${torrents.length} files`;

  // Download files sequentially to avoid overwhelming the chrome
  for (const torrent of torrents) {
    try {
      // Fetch the torrent file
      const response = await fetch(torrent.url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();

      const filename = prefs.useDisplayName
        ? torrent.filename + ".torrent"
        : torrent.url.split("/").pop();

      // Create temporary link element to trigger download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object to prevent memory leaks
      URL.revokeObjectURL(link.href);

      // Update progress notification
      completedDownloads++;
      progressNotification.textContent = `Progress: ${completedDownloads}/${torrents.length} files`;
    } catch (error) {
      console.error(`Failed to download torrent: ${torrent.filename}`, error);
    }
  }

  // Show completion message and remove notification after delay
  progressNotification.textContent = "Download complete!";
  setTimeout(() => {
    progressNotification.classList.remove("show");
    setTimeout(() => progressNotification.remove(), 300);
  }, 3000);
}

// Main download function that handles both individual and ZIP downloads
// torrents: Array of torrent objects to download
// zipName: Name to use for ZIP file if ZIP option is enabled
async function downloadTorrents(torrents, zipName) {
  // Check user's ZIP preference
  const prefs = await loadStoredPreferences();

  // Use individual downloads if only one file or ZIP is disabled
  // Otherwise use ZIP download
  if (torrents.length === 1 || !prefs.useZip) {
    await downloadIndividualTorrents(torrents);
  } else {
    await downloadTorrentsAsZip(torrents, zipName);
  }
}

// Function to show changelog notification
async function showChangelog() {
  // Get current version from manifest
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;

  // Get stored version and dismissed states
  const { lastVersion, changelogDismissed, tempDismissed } =
    await chrome.storage.sync.get([
      "lastVersion",
      "changelogDismissed",
      "tempDismissed",
    ]);

  // Reset tempDismissed if version is different
  if (currentVersion !== lastVersion) {
    await chrome.storage.sync.set({ tempDismissed: false });
  }

  // Show if:
  // 1. Version is different and not permanently dismissed OR
  // 2. Same version but not temporarily or permanently dismissed
  if (
    (currentVersion !== lastVersion && !changelogDismissed) ||
    (currentVersion === lastVersion && !tempDismissed && !changelogDismissed)
  ) {
    const container = document.createElement("div");
    container.className = "changelog-container";
    container.innerHTML = `
      <div class="changelog-header">
        <span class="changelog-title">What's New</span>
        <span class="changelog-version">v${currentVersion}</span>
      </div>
      <div class="changelog-content">
        • Added qBittorrent category and tag support when sending torrents, configure defaults in settings or pick per torrent via the "Prompt on Send" popup
      </div>
      <div class="changelog-actions">
        <button class="changelog-button okay">Okay</button>
        <button class="changelog-button dont-show">Don't show again</button>
      </div>
      <div class="changelog-footer">
        <a href="/changelog" style="color: #337ab7; text-decoration: underline; font-size: 14px;">View changelog page</a>
      </div>
    `;

    document.body.appendChild(container);

    // Handle "Don't show again" button - permanent dismissal
    container
      .querySelector(".changelog-button.dont-show")
      .addEventListener("click", async () => {
        await chrome.storage.sync.set({
          lastVersion: currentVersion,
          changelogDismissed: true,
        });
        container.classList.add("hiding");
        setTimeout(() => container.remove(), 300);
      });

    // Handle "Okay" button - temporary dismissal until next version
    container
      .querySelector(".changelog-button.okay")
      .addEventListener("click", async () => {
        await chrome.storage.sync.set({
          lastVersion: currentVersion,
          tempDismissed: true,
        });
        container.classList.add("hiding");
        setTimeout(() => container.remove(), 300);
      });

    // Store new version
    await chrome.storage.sync.set({ lastVersion: currentVersion });
  }
}

// Add message listener for real-time updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "settingChanged") {
    handleSettingChange(message.setting, message.value);
  }
});

async function handleSettingChange(setting, value) {
  switch (setting) {
    case "showMonitorButtons":
      // Update keyword monitor button on homepage
      const keywordMonitorBtn = document.querySelector(
        ".keyword-monitor-button",
      );
      if (keywordMonitorBtn) {
        keywordMonitorBtn.classList.toggle(
          "nyaa-enhancer-toolbar__btn--hidden",
          !value,
        );
      }

      // Update monitor button on user pages
      if (window.location.pathname.startsWith("/user/")) {
        const monitorBtn = document.querySelector(".monitor-button");
        if (monitorBtn) {
          monitorBtn.style.display = value ? "inline-block" : "none";
        } else if (value) {
          // If the button doesn't exist but should be shown, add it
          addMonitorButton();
        }
      }
      break;
    case "showButtons":
      if (value) {
        initializeExtension(false);
      } else {
        // Remove button container if it exists
        document.querySelector(".button-container")?.remove();

        // Remove checkbox header and cells
        const checkboxHeader = document.querySelector(
          ".magnet-checkbox-column",
        );
        if (checkboxHeader) {
          checkboxHeader.remove();
        }

        // Remove all checkbox cells
        document.querySelectorAll(".magnet-checkbox").forEach((checkbox) => {
          const cell = checkbox.closest("td");
          if (cell) {
            cell.remove();
          }
        });
      }
      break;
    case "showMagnetButtons":
      if (window.location.pathname.startsWith("/view/")) {
        if (!value) {
          document
            .querySelector(".magnet-button:not(.send-torrent-button)")
            ?.remove();
        } else {
          document.querySelector(".send-torrent-button")?.remove();
          addMagnetButtonToViewPage();
          addSendButtonToViewPage();
        }
      } else {
        await updateAllTorrentListLinkActions({ showMagnetButtons: value });
      }
      break;
    case "showATLinks":
      if (!value) {
        // Remove Animetosho row from view page if it exists
        const animeRow = Array.from(document.querySelectorAll(".row")).find(
          (row) => row.textContent.includes("Animetosho:"),
        );
        if (animeRow) {
          const infoHashKbd = animeRow.querySelector("kbd");
          if (infoHashKbd) {
            // Create new row with just the info hash
            const newRow = document.createElement("div");
            newRow.className = "row";
            newRow.innerHTML = `
              <div class="col-md-offset-6 col-md-1">Info hash:</div>
              <div class="col-md-5"><kbd>${infoHashKbd.textContent}</kbd></div>
            `;
            animeRow.replaceWith(newRow);
          }
        }

        if (!window.location.pathname.startsWith("/view/")) {
          await updateAllTorrentListLinkActions({ showATLinks: false });
        }
      } else {
        if (!window.location.pathname.startsWith("/view/")) {
          await updateAllTorrentListLinkActions({ showATLinks: true });
        }
        addAnimetoshoToViewPage();
      }
      break;
    case "showQuickFilter":
      const quickFilterButton = document.querySelector(".quick-filter-button");
      if (quickFilterButton) {
        if (!value) {
          quickFilterButton.classList.add("hiding");
          setTimeout(() => {
            quickFilterButton.classList.add("nyaa-enhancer-toolbar__btn--hidden");
          }, 300);
        } else {
          quickFilterButton.classList.remove("nyaa-enhancer-toolbar__btn--hidden");
          // Force chrome to process the display change
          quickFilterButton.offsetHeight;
          quickFilterButton.classList.remove("hiding");
        }
      }

      // Close Quick Filter popup if it's open and setting is turned off
      if (!value) {
        const popup = document.querySelector(".quick-filter-popup");
        const overlay = document.querySelector(".quick-filter-overlay");
        if (popup && overlay) {
          popup.classList.add("hiding");
          overlay.classList.add("hiding");
          setTimeout(() => {
            popup.remove();
            overlay.remove();
          }, 300);
        }
      }
      break;
    case "hideDeadTorrents":
      await applyAllTorrentFilters({ notify: true });
      break;
    case "keywordFilterEnabled":
      await applyAllTorrentFilters({ notify: true });
      break;
    case "showFilterNotifications":
      // Implementation for showFilterNotifications setting
      break;
    case "hideComments":
      if (window.location.pathname.startsWith("/view/")) {
        const comments = document.getElementById("comments");
        if (comments) {
          comments.style.display = value ? "none" : "block";
        }
      }
      break;
    case "improvedFileList":
      if (window.location.pathname.startsWith("/view/")) {
        applyImprovedFileList(value);
      }
      break;
    case "fileSizeFilterEnabled":
      await applyAllTorrentFilters({ notify: true });
      break;
    case "fileSizeMinBytes":
      await applyAllTorrentFilters({ notify: false });
      break;
    case "fileSizeMaxBytes":
      await applyAllTorrentFilters({ notify: true });
      break;
    case "completedDownloadsFilterEnabled":
    case "completedDownloadsFilterOperator":
    case "completedDownloadsFilterValue":
      await applyAllTorrentFilters({ notify: true });
      break;
    case "showChangelogNav":
      if (!value) {
        // Find and remove the changelog nav item
        const navList = document.querySelector(".nav.navbar-nav");
        const changelogItem = Array.from(
          navList?.querySelectorAll("li") || [],
        ).find((li) => li.textContent.trim() === "Changelog");
        if (changelogItem) {
          changelogItem.remove();
        }
      } else {
        // Add the changelog nav item
        addChangelogNavItem();
      }
      break;
    case "useNewATDomain":
      animetoshoViewLinkCache.clear();
      animetoshoTorrentDataCache.clear();
      resetAnimetoshoEpisodeSelection();
      if (window.location.pathname.startsWith("/view/")) {
        refreshAnimetoshoViewPageLink();
        const toshoPanel = document.getElementById("tosho-comments");
        if (toshoPanel) {
          toshoPanel.remove();
          addAnimetoshoComments();
        }
        updateAnimetoshoEpisodeFeatures();
      } else {
        refreshAnimetoshoListLinks();
      }
      break;
    case "showATComments":
      if (value) {
        addAnimetoshoComments();
      } else {
        document.getElementById("tosho-comments")?.remove();
      }
      break;
    case "showATScreenshotsSection":
    case "showATFileInfoSection":
    case "showATAttachmentsSection":
      updateAnimetoshoEpisodeFeatures();
      break;
    case "showAmeNZBLinks":
      if (value) {
        addAmeNZBToViewPage();
      } else {
        removeAmeNZBRow();
      }
      break;
    case "showAmeNZBSection":
      updateAmeNZBDescriptionSection();
      break;
    case "ameNZBApiKey":
      clearAmeNZBSearchCache();
      removeAmeNZBRow();
      addAmeNZBToViewPage();
      updateAmeNZBDescriptionSection();
      break;
    case "tmdbApiKey":
      clearQuickSearchAnimeCaches();
      break;
    case "showNekoBTLinks":
      if (value) {
        addNekoBTToViewPage();
      } else {
        removeNekoBTRow();
      }
      break;
    case "showNekoBTSection":
    case "showNekoBTFullLangNames":
      updateNekoBTDescriptionSection();
      break;
    case "showTsukihimeLinks":
      if (value) {
        addTsukihimeToViewPage();
      } else {
        removeTsukihimeRow();
      }
      break;
    case "showTsukihimeSection":
      updateTsukihimeDescriptionSection();
      break;
    case "showSeaDex":
      if (value) {
        initializeSeaDex();
      } else {
        removeSeaDexHighlights();
      }
      break;
    case "screenshotPreviewEnabled":
      screenshotPreview.enabled = !!value;
      if (value) {
        ensureScreenshotPreviewDelegation();
        setupTitleSuppression();
      } else {
        cancelScreenshotPreview();
        teardownTitleSuppression();
      }
      break;
    case "screenshotPreviewHoverDelay":
      screenshotPreview.hoverDelayMs = Math.max(
        0,
        Math.round((parseFloat(value) || 0) * 1000),
      );
      break;
    case "screenshotPreviewSlideDelay":
      screenshotPreview.slideDelayMs = Math.max(
        100,
        Math.round((parseFloat(value) || 0) * 1000),
      );
      break;
    case "showSendButtons":
      if (window.location.pathname.startsWith("/view/")) {
        if (value) {
          addSendButtonToViewPage();
        } else {
          document.querySelector(".send-torrent-button")?.remove();
        }
      } else {
        await updateAllTorrentListLinkActions({ showSendButtons: value });
      }
      break;
  }

  const filterPanelSettings = [
    "hideDeadTorrents",
    "keywordFilterEnabled",
    "fileSizeFilterEnabled",
    "fileSizeMinBytes",
    "fileSizeMaxBytes",
    "completedDownloadsFilterEnabled",
    "completedDownloadsFilterOperator",
    "completedDownloadsFilterValue",
    "keywords",
  ];
  if (filterPanelSettings.includes(setting)) {
    await syncFiltersPanelUI(setting, value);
  }
}

const animetoshoViewLinkCache = new Map();

function getAnimetoshoDomain(useNewATDomain) {
  return useNewATDomain ? "animetosho.xyz" : "animetosho.org";
}

function getAnimetoshoStorageDomain(useNewATDomain) {
  return useNewATDomain ? "storage.animetosho.xyz" : "storage.animetosho.org";
}

function normalizeATScreenshotStorageUrl(url, useNewATDomain) {
  if (!url || !url.includes("/sframes/")) return url;
  const storageDomain = getAnimetoshoStorageDomain(useNewATDomain);
  return url
    .replace(/.*\/sframes\//, `https://${storageDomain}/sframes/`)
    .replace(/&amp;/g, "&");
}

function normalizeAnimetoshoViewUrl(url, atDomain) {
  if (!url) return null;
  return url.replace(/animetosho\.(org|xyz)/, atDomain);
}

function parseAnimetoshoOrgViewLink(json, atDomain) {
  if (!json || json.error) return null;

  let viewSuffix = null;
  if (json.nyaa_id) viewSuffix = `n${json.nyaa_id}`;
  else if (json.anidex_id) viewSuffix = `d${json.anidex_id}`;
  else if (json.tosho_id) viewSuffix = `${json.tosho_id}`;
  else if (json.nekobt_id) viewSuffix = `k${json.nekobt_id}`;

  if (!viewSuffix) return null;
  return `https://${atDomain}/view/${viewSuffix}`;
}

function parseAnimetoshoXyzViewLink(json, atDomain) {
  if (!json?.ok || !json.data?.length) return null;
  const viewUrl = json.data[0].urls?.view;
  if (!viewUrl) return null;
  return normalizeAnimetoshoViewUrl(viewUrl, atDomain);
}

async function resolveAnimetoshoViewLink(infoHash, useNewATDomain) {
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

function createAnimetoshoListAnchor(infoHash, useNewATDomain) {
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

function createAnimetoshoListPlaceholder() {
  const placeholder = document.createElement("span");
  placeholder.className = "link-action-at link-action-at-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.innerHTML = '<i class="fa fa-fw fa-external-link"></i>';
  return placeholder;
}

async function patchTorrentListLinkActionsForNewRows() {
  const prefs = await loadStoredPreferences();
  document.querySelectorAll("table.torrent-list tbody tr").forEach((row) => {
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

function isLinkActionMutationNode(node) {
  if (!node) return false;
  if (node.nodeType === Node.TEXT_NODE) {
    return /^\s+$/.test(node.textContent);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return node.matches?.(
    ".link-action-copy, .link-action-send, .link-action-at, .torrent-link-actions",
  );
}

function mutationsIncludeNonLinkActionChanges(mutations) {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") continue;
    for (const node of mutation.addedNodes) {
      if (!isLinkActionMutationNode(node)) return true;
    }
    for (const node of mutation.removedNodes) {
      if (!isLinkActionMutationNode(node)) return true;
    }
  }
  return false;
}

async function refreshAnimetoshoViewPageLink() {
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

async function refreshAnimetoshoListLinks() {
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
async function addAnimetoshoToViewPage() {
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
async function addAnimetoshoComments() {
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
      chrome.runtime.sendMessage({ type: "fetchUrl", url: toshoUrl }, resolve);
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

let atEpisodeFetchId = 0;
let atBatchViewHtml = null;
let atXyzViewPageHtml = null;

const animetoshoTorrentDataCache = new Map();

const AT_EPISODE_FILE_ICON = "fa fa-file";
// Nyaa uses Font Awesome 4.7; fa-file-circle-check is FA6-only and renders blank.
const AT_EPISODE_FILE_ICON_SELECTED = "fa fa-check-circle";

function queryTorrentFileListIcon(li) {
  return li.querySelector("i.fa-file, i.fa-check-circle");
}

function setTorrentFileListIcon(li, selected) {
  const icon = queryTorrentFileListIcon(li);
  if (icon) {
    icon.className = selected
      ? AT_EPISODE_FILE_ICON_SELECTED
      : AT_EPISODE_FILE_ICON;
  }
}

const atEpisodeSelection = {
  torrentKey: null,
  epId: null,
  epFilename: null,
  countVidFiles: 0,
};

function resetAnimetoshoEpisodeSelection() {
  atEpisodeSelection.torrentKey = null;
  atEpisodeSelection.epId = null;
  atEpisodeSelection.epFilename = null;
  atEpisodeSelection.countVidFiles = 0;
  atBatchViewHtml = null;
  atXyzViewPageHtml = null;
}

function isAnimetoshoSupportedViewPage() {
  return isSupportedAnimeViewPageCategory();
}

function removeLegacyAnimetoshoScreenshotsLayout() {
  document.getElementById("nyaa-enhancer-at-screenshots")?.remove();
  const row = document.querySelector(".nyaa-enhancer-description-row");
  if (!row) return;
  const descPanel = row.querySelector(".panel.panel-default");
  if (descPanel) {
    row.parentNode.insertBefore(descPanel, row);
  }
  row.remove();
}

function removeAnimetoshoEpisodeFeatures() {
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

function ensureDescriptionTab(panel, section, label, insertAfterSection) {
  let tab = panel.querySelector(`[data-section="${section}"]`);
  if (tab) return tab;

  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return null;

  tab = document.createElement("button");
  tab.type = "button";
  tab.className = "nyaa-enhancer-desc-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.section = section;
  tab.textContent = label;
  tab.addEventListener("click", () =>
    switchDescriptionPanelTab(panel, section),
  );

  const afterTab = panel.querySelector(
    `[data-section="${insertAfterSection}"]`,
  );
  if (afterTab?.nextSibling) {
    tabsHeader.insertBefore(tab, afterTab.nextSibling);
  } else {
    tabsHeader.appendChild(tab);
  }
  return tab;
}

const AT_EPISODE_TAB_BODIES = {
  atscreenshots: {
    bodyId: "at-screenshots-panel",
    bodyClass: "nyaa-enhancer-at-screenshots-body",
  },
  atfileinfo: {
    bodyId: "at-fileinfo-panel",
    bodyClass: "nyaa-enhancer-at-fileinfo-body",
  },
  atattachments: {
    bodyId: "at-attachments-panel",
    bodyClass: "nyaa-enhancer-at-attachments-body",
  },
};

function getOrCreateDescriptionPanelBody(panel, section) {
  const config = AT_EPISODE_TAB_BODIES[section];
  if (!config) return null;

  let body = panel.querySelector(`#${config.bodyId}`);
  if (body) return body;

  body = document.createElement("div");
  body.id = config.bodyId;
  body.className = `panel-body ${config.bodyClass}`;
  body.hidden = true;
  panel.appendChild(body);
  return body;
}

function pickAnimetoshoVideoFiles(files) {
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

function isAnimetoshoXyzFileEpisodeId(episodeId) {
  return String(episodeId || "").startsWith("/file/");
}

function pickAnimetoshoXyzVideoFilesFromDoc(doc) {
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

function parseAnimetoshoXyzViewPage(html) {
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

    return { videoFiles, singleFileInfoLink };
  } catch {
    return { videoFiles: [], singleFileInfoLink: null };
  }
}

function getAnimetoshoRecordVideoFiles(record) {
  if (record.useNewATDomain) {
    return record.xyzPageData?.videoFiles || [];
  }
  return record.videoFiles || [];
}

async function getAnimetoshoTorrentRecord(infoHash, useNewATDomain) {
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

function initAnimetoshoEpisodeSelection(record) {
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

async function fetchAnimetoshoEpisodeViewHtml(episodeId, useNewATDomain) {
  const url = useNewATDomain
    ? isAnimetoshoXyzFileEpisodeId(episodeId)
      ? `https://animetosho.xyz${episodeId}`
      : `https://animetosho.xyz/view/${episodeId}`
    : `https://animetosho.org/file/${episodeId}`;
  const result = await fetchUrlViaBackground(url);
  return result?.ok ? result.text : null;
}

async function fetchAnimetoshoEpisodeFileinfo(
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

function createEmptyATAttachmentGroups() {
  return { file: [], subtitles: [], audio: [], video: [] };
}

function resolveATAttachmentGroupUrls(groups, useNewATDomain) {
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

function hasATAttachmentGroups(groups) {
  return (
    groups.file.length > 0 ||
    groups.subtitles.length > 0 ||
    groups.audio.length > 0 ||
    groups.video.length > 0
  );
}

function collectATDownloadLinksFromCell(td, downloads, seen) {
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

function extractATDownloadLinksFromHtml(html) {
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

function findBatchViewListEntry(doc, epId, epFilename) {
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

function extractATDownloadLinksFromBatchEntry(batchHtml, epId, epFilename) {
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

function resolveATFileDownloadLinks(
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

function mergeAnimetoshoSubtitleAttachments(
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

function extractATFileinfoFromHtml(html) {
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

function openATFileinfoTab(fileInfo, filename) {
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

function renderATFileinfoBody(body, fileInfo, filename) {
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

function appendATAttachmentLinks(container, links, options = {}) {
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

function renderATAttachmentGroupRow(label, links, options = {}) {
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

function renderATAttachmentsBody(body, groups) {
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

let atFileListClickHandler = null;

function clearAnimetoshoFileListEpisodeHandlers() {
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

function setupAnimetoshoFileListEpisodeSelection(record) {
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

function setAnimetoshoTabStatus(body, message) {
  body.replaceChildren();
  const status = document.createElement("p");
  status.className = "nyaa-enhancer-at-episode-status";
  status.textContent = message;
  body.appendChild(status);
}

function collectATScreenshotsFromRoot(root, useNewATDomain) {
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

function extractATScreenshotsFromHtml(html, useNewATDomain) {
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

function normalizeATAttachmentLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushATAttachmentLink(attachments, href, text, seen) {
  const label = normalizeATAttachmentLabel(text);
  const link = href?.trim();
  if (!link || !label) return;
  const key = `${link}\0${label}`;
  if (seen.has(key)) return;
  seen.add(key);
  attachments.push({ text: label, link });
}

function collectATAttachmentLinksFromRoot(root, attachments, seen) {
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

function collectATAttachmentLinksFromHtml(html, attachments, seen) {
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

function collectATExtractionsFromCell(td, audio, video, seen) {
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

function extractATAttachmentsFromHtml(html) {
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

function getATScreenshotDisplayUrl(url) {
  if (!url) return url;
  if (url.includes("/sframes/") || url.includes("storage.animetosho.")) {
    return url.replace(/\.png$/i, ".jpg");
  }
  return url;
}

function getATScreenshotImageUrl(url, trackNum) {
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

async function fetchAnimetoshoScreenshotHtml(
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

function openATScreenshotModal(screenshots, initialIndex, trackNum) {
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

function renderATScreenshotsGrid(body, screenshots, subtitles, isXyz) {
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

function animetoshoEpisodeFeaturesEnabled(prefs) {
  return (
    prefs.showATScreenshotsSection ||
    prefs.showATFileInfoSection ||
    prefs.showATAttachmentsSection
  );
}

async function refreshAnimetoshoEpisodeFeatures(prefs, options = {}) {
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
      const viewResult = await fetchUrlViaBackground(record.viewUrl);
      if (fetchId !== atEpisodeFetchId) return;
      if (viewResult?.ok) {
        atXyzViewPageHtml = viewResult.text;
        atBatchViewHtml = viewResult.text;
        record.xyzPageData = parseAnimetoshoXyzViewPage(viewResult.text);
      }
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

async function updateAnimetoshoEpisodeFeatures() {
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

// Remove the ameNZB row, restoring the original info hash row if it was integrated
function removeAmeNZBRow() {
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
let ameNZBFetchInProgress = false;
let amenzbSectionFetchId = 0;

const ameNZBSearchCache = {
  infoHash: null,
  promise: null,
  item: null,
  fetched: false,
};

function clearAmeNZBSearchCache() {
  ameNZBSearchCache.infoHash = null;
  ameNZBSearchCache.promise = null;
  ameNZBSearchCache.item = null;
  ameNZBSearchCache.fetched = false;
}

function isAmeNZBSupportedViewPage() {
  return isSupportedAnimeViewPageCategory();
}

function getAmeNZBAttr(item, name) {
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

function cleanAmeNZBTitle(title) {
  return title
    .trim()
    .replace(/\s*\{[^}]*\}\s*$/g, "")
    .trim();
}

function formatAmeNZBPubDate(pubDate) {
  return pubDate
    .trim()
    .replace(/\s+[+-]\d{4}$/, "")
    .trim();
}

function parseAmeNZBSearchXml(xmlText) {
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

async function fetchAmeNZBSearch(infoHash, apiKey) {
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

function renderAmeNZBPanelContent(item) {
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

function buildExternalServiceLinkHtml(url, notFoundLabel) {
  if (url) {
    return `<a rel="noopener noreferrer nofollow" href="${url}" target="_blank">${url}</a>`;
  }
  return `<span style="color: #999;">${notFoundLabel}</span>`;
}

// Function to add ameNZB link to supported torrent view pages
async function addAmeNZBToViewPage() {
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
function incrementAmeNZBRequestCount() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { ameNZBRequestCount: 0, ameNZBRequestDate: "" },
      (items) => {
        const todayUTC = new Date().toISOString().slice(0, 10);
        const count =
          items.ameNZBRequestDate === todayUTC
            ? items.ameNZBRequestCount + 1
            : 1;
        chrome.storage.sync.set(
          { ameNZBRequestCount: count, ameNZBRequestDate: todayUTC },
          resolve,
        );
      },
    );
  });
}

// Lock to prevent concurrent nekoBT fetch calls
let nekoBTFetchInProgress = false;
let nekobtSectionFetchId = 0;
let nekobtLangCache = null;
let nekobtLangFetchPromise = null;

function fetchUrlViaBackground(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "fetchUrl", url }, resolve);
  });
}

async function fetchJsonViaBackground(url) {
  const result = await fetchUrlViaBackground(url);
  if (!result?.ok) {
    return { ok: false, error: result?.error || "Request failed" };
  }
  try {
    return { ok: true, data: JSON.parse(result.text) };
  } catch {
    return { ok: false, error: "Invalid JSON response" };
  }
}

function isNekoBTSupportedViewPage() {
  return isSupportedAnimeViewPageCategory();
}

async function resolveNekoBTTorrentIdFromInfoHash(infoHash) {
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

async function fetchNekoBTTorrentData(torrentId) {
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

function escapeNekoBTHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNekoBTBytes(size) {
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

function formatNekoBTTimestamp(ms) {
  const n = Number(ms);
  if (!isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleString();
}

async function loadNekoBTLangData() {
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

function resolveNekoBTLangCode(rawCode, langData) {
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

function getNekoBTLangDisplayName(rawCode, langData) {
  const code = resolveNekoBTLangCode(rawCode, langData);
  const entry = langData.langs[code];
  if (entry?.name) return entry.name;
  return rawCode.trim();
}

function formatNekoBTLangList(value, useFullNames, langData) {
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

function renderNekoBTSimpleMarkdown(md) {
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

function buildNekoBTMetaRow(label, valueHtml) {
  if (!valueHtml) return "";
  return `<div class="nyaa-enhancer-nekobt-meta-row"><dt>${escapeNekoBTHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
}

function renderNekoBTPanelContent(data, prefs, langData) {
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

function switchDescriptionPanelTab(panel, activeSection) {
  const sectionConfig = [
    {
      id: "description",
      getBody: () => document.getElementById("torrent-description"),
    },
    {
      id: "atscreenshots",
      getBody: () => panel.querySelector("#at-screenshots-panel"),
    },
    {
      id: "atfileinfo",
      getBody: () => panel.querySelector("#at-fileinfo-panel"),
    },
    {
      id: "atattachments",
      getBody: () => panel.querySelector("#at-attachments-panel"),
    },
    {
      id: "amenzb",
      getBody: () => panel.querySelector("#amenzb-torrent-panel"),
    },
    {
      id: "nekobt",
      getBody: () => panel.querySelector("#nekobt-torrent-panel"),
    },
    {
      id: "tsukihime",
      getBody: () => panel.querySelector("#tsukihime-torrent-panel"),
    },
  ];

  for (const { id, getBody } of sectionConfig) {
    const tab = panel.querySelector(`[data-section="${id}"]`);
    const body = getBody();
    const active = id === activeSection;
    if (tab) {
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (body) body.hidden = !active;
  }
}

function removeAmeNZBDescriptionSection(panel) {
  panel.querySelector('[data-section="amenzb"]')?.remove();
  panel.querySelector("#amenzb-torrent-panel")?.remove();
  switchDescriptionPanelTab(panel, "description");
}

function ensureAmeNZBDescriptionTab(panel) {
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

function getOrCreateAmeNZBPanelBody(panel) {
  let body = panel.querySelector("#amenzb-torrent-panel");
  if (body) return body;

  body = document.createElement("div");
  body.id = "amenzb-torrent-panel";
  body.className = "panel-body nyaa-enhancer-nekobt-panel";
  body.hidden = true;
  panel.appendChild(body);
  return body;
}

async function updateAmeNZBDescriptionSection() {
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

function removeNekoBTDescriptionSection(panel) {
  panel.querySelector('[data-section="nekobt"]')?.remove();
  panel.querySelector("#nekobt-torrent-panel")?.remove();
  switchDescriptionPanelTab(panel, "description");
}

function ensureNekoBTDescriptionTab(panel) {
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

function getOrCreateNekoBTPanelBody(panel) {
  let body = panel.querySelector("#nekobt-torrent-panel");
  if (body) return body;

  body = document.createElement("div");
  body.id = "nekobt-torrent-panel";
  body.className = "panel-body nyaa-enhancer-nekobt-panel";
  body.hidden = true;
  panel.appendChild(body);
  return body;
}

async function updateNekoBTDescriptionSection() {
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
function removeNekoBTRow() {
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
async function addNekoBTToViewPage() {
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

// ── Tsukihime (view page links + description section) ───────────────────────

let tsukihimeFetchInProgress = false;
let tsukihimeSectionFetchId = 0;

const tsukihimeSearchCache = {
  infoHash: null,
  promise: null,
  data: null,
  fetched: false,
};

const tsukihimeFileMediainfoCache = new Map();

function clearTsukihimeSearchCache() {
  tsukihimeSearchCache.infoHash = null;
  tsukihimeSearchCache.promise = null;
  tsukihimeSearchCache.data = null;
  tsukihimeSearchCache.fetched = false;
  tsukihimeFileMediainfoCache.clear();
}

function isTsukihimeSupportedViewPage() {
  return isNekoBTSupportedViewPage();
}

function getTsukihimeRowAnchor() {
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

function repositionTsukihimeRowAfterNekoBT() {
  const row = document.querySelector(".tsukihime-row");
  if (!row) return;
  const anchor = getTsukihimeRowAnchor();
  if (!anchor || anchor === row) return;
  if (row.previousElementSibling === anchor) return;
  anchor.insertAdjacentElement("afterend", row);
}

function formatTsukihimeTimestamp(sec) {
  const n = Number(sec);
  if (!isFinite(n) || n <= 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

function formatTsukihimeLangCodes(langs) {
  if (!Array.isArray(langs) || !langs.length) return "—";
  return langs.join(", ");
}

function aggregateTsukihimeTrackerStats(trackers) {
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

function stripTsukihimeHtml(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderTsukihimeLinkChips(links) {
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

function summarizeTsukihimeAttachments(attachments) {
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

function renderTsukihimeCollapsibleList(summaryText, items) {
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

async function fetchTsukihimeFileMediainfo(torrentId, fileId) {
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

function ensureTsukihimePanelClickHandler(body) {
  if (!body || body.dataset.clickBound === "true") return;
  body.dataset.clickBound = "true";
  body.addEventListener("click", onTsukihimePanelClick);
}

async function onTsukihimePanelClick(event) {
  const btn = event.target.closest(".nyaa-enhancer-tsukihime-mediainfo-btn");
  if (!btn) return;
  event.preventDefault();
  await toggleTsukihimeFileMediainfo(btn);
}

async function toggleTsukihimeFileMediainfo(btn) {
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

function renderTsukihimeFileCard(file, torrentId) {
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

function renderTsukihimePanelContent(data) {
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

function removeTsukihimeDescriptionSection(panel) {
  panel.querySelector('[data-section="tsukihime"]')?.remove();
  panel.querySelector("#tsukihime-torrent-panel")?.remove();
  switchDescriptionPanelTab(panel, "description");
}

function ensureTsukihimeDescriptionTab(panel) {
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

function getOrCreateTsukihimePanelBody(panel) {
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

async function fetchTsukihimeTorrent(infoHash) {
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

async function updateTsukihimeDescriptionSection() {
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

function removeTsukihimeRow() {
  document.querySelector(".tsukihime-row")?.remove();
}

async function addTsukihimeToViewPage() {
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

// ── SeaDex (Best Release Highlighting) ──────────────────────────────────────

let seaDexStylesInjected = false;
let seaDexViewFetchInProgress = false;

function injectSeaDexStyles() {
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

function removeSeaDexHighlights() {
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

async function seaDexFetch(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "fetchUrl", url }, resolve);
  });
}

async function applySeaDexToListPage() {
  const rows = document.querySelectorAll("table.torrent-list tbody tr");
  const infoHashList = [];

  rows.forEach((row) => {
    const magnetLink = row.querySelector('a[href^="magnet:"]');
    const infoHash = magnetLink ? getInfoHashFromMagnet(magnetLink.href) : "";
    infoHashList.push({ element: row, infoHash });
  });

  const validEntries = infoHashList.filter(({ infoHash }) => infoHash);
  if (!validEntries.length) return;

  // Clear previous highlights on visible rows before re-fetching
  infoHashList.forEach(({ element }) => {
    element.classList.remove("seadex-best", "seadex-best-alt");
  });

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

async function applySeaDexToViewPage() {
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

async function initializeSeaDex() {
  const prefs = await loadStoredPreferences();
  if (!prefs.showSeaDex) return;

  injectSeaDexStyles();

  if (window.location.pathname.startsWith("/view/")) {
    applySeaDexToViewPage();
  } else {
    applySeaDexToListPage();
  }
}

// ── Screenshot Preview (hover thumbnail carousel) ───────────────────────────

const screenshotPreview = {
  enabled: false,
  hoverDelayMs: 3000,
  slideDelayMs: 3000,
  hoverTimer: null,
  slideTimer: null,
  currentAnchor: null,
  popupEl: null,
  imgEl: null,
  loaderEl: null,
  counterEl: null,
  imageCache: new Map(), // viewUrl -> string[]  (result of page parse)
  preloadedImages: new Map(), // imageUrl -> HTMLImageElement (preloaded pixel data)
  inflightFetches: new Map(), // viewUrl -> Promise<string[]>
  mouseX: 0,
  mouseY: 0,
  images: [],
  imageIndex: 0,
  delegationInitialized: false,
  titleStore: new Map(), // anchor element -> original title string
  titleObserver: null, // MutationObserver watching for new table rows
  prefetchTimer: null, // fires at hoverDelayMs/2 to start background fetch
};

const SCREENSHOT_IMG_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i;

function ensureScreenshotPreviewDelegation() {
  if (screenshotPreview.delegationInitialized) return;
  screenshotPreview.delegationInitialized = true;
  document.addEventListener("mouseover", screenshotPreviewMouseOver, true);
  document.addEventListener("mouseout", screenshotPreviewMouseOut, true);
  document.addEventListener("mousemove", screenshotPreviewMouseMove, true);
  window.addEventListener(
    "scroll",
    () => {
      if (screenshotPreview.popupEl?.classList.contains("visible")) {
        updateScreenshotPreviewPosition();
      }
    },
    true,
  );
}

function getScreenshotTorrentLink(target) {
  if (!target || !target.closest) return null;
  return target.closest('table.torrent-list td a[href^="/view/"]');
}

function screenshotPreviewMouseOver(e) {
  if (!screenshotPreview.enabled) return;
  const anchor = getScreenshotTorrentLink(e.target);
  if (!anchor) return;
  if (anchor === screenshotPreview.currentAnchor) return;

  cancelScreenshotPreview();
  screenshotPreview.currentAnchor = anchor;

  // Schedule the background page-fetch to start at the halfway point of the
  // hover delay so fast mouse passes don't fire unnecessary requests to Nyaa.
  // When the delay is 0 we fetch immediately (user accepted the trade-off).
  const prefetchDelay = Math.floor(screenshotPreview.hoverDelayMs / 2);
  if (prefetchDelay === 0) {
    prefetchScreenshotAnchor(anchor.href);
  } else {
    screenshotPreview.prefetchTimer = setTimeout(() => {
      prefetchScreenshotAnchor(anchor.href);
    }, prefetchDelay);
  }

  screenshotPreview.hoverTimer = setTimeout(() => {
    startScreenshotPreview(anchor);
  }, screenshotPreview.hoverDelayMs);
}

// Begin fetching and preloading images for a torrent link.
// Safe to call multiple times — idempotent thanks to the cache/inflight guards.
function prefetchScreenshotAnchor(viewUrl) {
  if (screenshotPreview.imageCache.has(viewUrl)) return;
  if (screenshotPreview.inflightFetches.has(viewUrl)) return;

  const promise = fetchScreenshotImages(viewUrl)
    .then((images) => {
      const list = images || [];
      screenshotPreview.imageCache.set(viewUrl, list);
      if (list.length) preloadScreenshotImages(list);
      return list;
    })
    .finally(() => {
      screenshotPreview.inflightFetches.delete(viewUrl);
    });

  screenshotPreview.inflightFetches.set(viewUrl, promise);
}

// Eagerly create Image objects for each URL so browsers cache the pixel data
// before we need to display them.
function preloadScreenshotImages(urls) {
  urls.forEach((url) => {
    if (screenshotPreview.preloadedImages.has(url)) return;
    const img = new Image();
    img.src = url;
    screenshotPreview.preloadedImages.set(url, img);
  });
}

function screenshotPreviewMouseOut(e) {
  if (!screenshotPreview.enabled) return;
  const anchor = screenshotPreview.currentAnchor;
  if (!anchor) return;
  // Only react when the mouse actually left the anchor element (or a descendant of it).
  // This prevents stray mouseout events from unrelated elements (or synthetic events
  // triggered by DOM insertions) from incorrectly cancelling the preview.
  if (e.target !== anchor && !anchor.contains(e.target)) return;
  const related = e.relatedTarget;
  if (related && (related === anchor || anchor.contains(related))) return;
  cancelScreenshotPreview();
}

function screenshotPreviewMouseMove(e) {
  screenshotPreview.mouseX = e.clientX;
  screenshotPreview.mouseY = e.clientY;
  if (screenshotPreview.popupEl?.classList.contains("visible")) {
    updateScreenshotPreviewPosition();
  }
}

function cancelScreenshotPreview() {
  if (screenshotPreview.prefetchTimer) {
    clearTimeout(screenshotPreview.prefetchTimer);
    screenshotPreview.prefetchTimer = null;
  }
  if (screenshotPreview.hoverTimer) {
    clearTimeout(screenshotPreview.hoverTimer);
    screenshotPreview.hoverTimer = null;
  }
  if (screenshotPreview.slideTimer) {
    clearTimeout(screenshotPreview.slideTimer);
    screenshotPreview.slideTimer = null;
  }
  screenshotPreview.currentAnchor = null;
  screenshotPreview.images = [];
  screenshotPreview.imageIndex = 0;
  hideScreenshotPreview();
}

async function startScreenshotPreview(anchor) {
  // Confirm the mouse is actually still over the anchor at timer-fire time.
  const underCursor = document.elementFromPoint(
    screenshotPreview.mouseX,
    screenshotPreview.mouseY,
  );
  if (
    !underCursor ||
    (underCursor !== anchor && !anchor.contains(underCursor))
  ) {
    cancelScreenshotPreview();
    return;
  }

  const viewUrl = anchor.href;

  // Fast path: images already fetched and preloaded — show with no loading state.
  let images = screenshotPreview.imageCache.get(viewUrl);

  if (!images) {
    // Show the loader only while waiting for the in-flight prefetch
    // (prefetchScreenshotAnchor started it the moment the mouse entered).
    showScreenshotPreviewLoader();

    let inflight = screenshotPreview.inflightFetches.get(viewUrl);
    if (!inflight) {
      // Fallback: prefetch wasn't started (shouldn't normally happen), kick it off now.
      prefetchScreenshotAnchor(viewUrl);
      inflight = screenshotPreview.inflightFetches.get(viewUrl);
    }

    images = await inflight;
  }

  // Bail out if the user moved away while we were waiting
  if (anchor !== screenshotPreview.currentAnchor) return;

  if (!images || !images.length) {
    hideScreenshotPreview();
    return;
  }

  screenshotPreview.images = images;
  screenshotPreview.imageIndex = 0;
  await showScreenshotPreviewImage();

  // Start the slideshow only after the first image is fully painted.
  // Each tick waits until the next image is decoded before displaying it, then
  // schedules itself again — so the delay is always "time between visible frames".
  if (
    images.length > 1 &&
    screenshotPreview.slideDelayMs > 0 &&
    screenshotPreview.currentAnchor === anchor
  ) {
    const scheduleNextSlide = () => {
      screenshotPreview.slideTimer = setTimeout(async () => {
        if (
          !screenshotPreview.currentAnchor ||
          !screenshotPreview.images.length
        )
          return;
        screenshotPreview.imageIndex =
          (screenshotPreview.imageIndex + 1) % screenshotPreview.images.length;
        await showScreenshotPreviewImage();
        if (screenshotPreview.currentAnchor) scheduleNextSlide();
      }, screenshotPreview.slideDelayMs);
    };
    scheduleNextSlide();
  }
}

async function fetchScreenshotImages(viewUrl) {
  const result = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "fetchUrl", url: viewUrl }, resolve);
  });
  if (!result?.ok || !result.text) return [];

  let doc;
  try {
    doc = new DOMParser().parseFromString(result.text, "text/html");
  } catch {
    return [];
  }

  const description = doc.querySelector("#torrent-description");
  if (!description) return [];

  const seen = new Set();
  const collected = [];

  // Nyaa runs `window.markdown_proxy_images = true` which makes its client-side
  // JS rewrite <img src> attributes to route through the WordPress.com image CDN
  // (i0.wp.com) before the page is rendered.  Our background fetch gets the raw
  // server HTML *before* that JS runs, so image srcs may still be the original
  // host.  Some hosts (e.g. i.kek.sh) use hotlink protection and will refuse to
  // serve images directly from the extension context.  Applying the same proxy
  // Nyaa uses guarantees the images load regardless of the origin host.
  function toWpProxy(resolvedUrl) {
    if (/^https?:\/\/i\d*\.wp\.com\//i.test(resolvedUrl)) return resolvedUrl;
    const withoutScheme = resolvedUrl.replace(/^https?:\/\//i, "");
    return `https://i0.wp.com/${withoutScheme}?ssl=1`;
  }

  // Helper: resolve, deduplicate, proxy and push a candidate src URL
  function addSrc(rawSrc) {
    let resolved;
    try {
      resolved = new URL(rawSrc, viewUrl).toString();
    } catch {
      return;
    }
    if (!SCREENSHOT_IMG_REGEX.test(resolved)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    collected.push(toWpProxy(resolved));
  }

  // Primary: rendered <img> tags (Nyaa renders markdown server-side)
  description.querySelectorAll("img").forEach((img) => {
    let src = img.getAttribute("src");
    if (!src) return;

    // When a thumbnail is wrapped in an <a> pointing to the full image, prefer that
    const parentA = img.closest("a");
    if (parentA) {
      const parentHref = parentA.getAttribute("href");
      if (parentHref && SCREENSHOT_IMG_REGEX.test(parentHref)) {
        src = parentHref;
      }
    }
    addSrc(src);
  });

  // Fallback: if no <img> tags were found the description may be unrendered markdown.
  // Extract URLs from the standard markdown image syntax: ![alt](url)
  if (collected.length === 0) {
    const mdText = description.textContent || "";
    const mdImgRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
    let m;
    while ((m = mdImgRe.exec(mdText)) !== null) {
      addSrc(m[1]);
    }
  }

  return collected;
}

// Returns a promise that resolves once the preloaded Image for `url` is fully
// decoded (pixel data in memory).  We await this before assigning the src to
// the visible element so the browser paints from cache in one instant frame.
function waitForImageReady(url) {
  let img = screenshotPreview.preloadedImages.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    screenshotPreview.preloadedImages.set(url, img);
  }
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  // decode() resolves only after the image is fully decoded — never progressively.
  return img.decode().catch(() => {});
}

function ensureScreenshotPreviewPopup() {
  if (screenshotPreview.popupEl) return;

  const popup = document.createElement("div");
  popup.className = "nyaa-screenshot-preview";

  const loader = document.createElement("div");
  loader.className = "nyaa-screenshot-preview-loader";
  loader.textContent = "Loading…";

  const img = document.createElement("img");
  img.className = "nyaa-screenshot-preview-img";
  img.alt = "";
  img.addEventListener("load", () => {
    if (screenshotPreview.popupEl?.classList.contains("visible")) {
      updateScreenshotPreviewPosition();
    }
  });

  const counter = document.createElement("div");
  counter.className = "nyaa-screenshot-preview-counter";

  popup.appendChild(loader);
  popup.appendChild(img);
  popup.appendChild(counter);
  document.body.appendChild(popup);

  screenshotPreview.popupEl = popup;
  screenshotPreview.imgEl = img;
  screenshotPreview.loaderEl = loader;
  screenshotPreview.counterEl = counter;
}

function showScreenshotPreviewLoader() {
  ensureScreenshotPreviewPopup();
  screenshotPreview.popupEl.classList.add("visible");
  screenshotPreview.loaderEl.style.display = "block";
  screenshotPreview.loaderEl.textContent = "Loading…";
  screenshotPreview.imgEl.style.display = "none";
  screenshotPreview.imgEl.removeAttribute("src");
  screenshotPreview.counterEl.style.display = "none";
  updateScreenshotPreviewPosition();
}

async function showScreenshotPreviewImage() {
  ensureScreenshotPreviewPopup();

  const capturedIndex = screenshotPreview.imageIndex;
  const nextSrc = screenshotPreview.images[capturedIndex];

  // Check whether the image is already fully decoded in memory.
  const preloaded = screenshotPreview.preloadedImages.get(nextSrc);
  const isReady = preloaded && preloaded.complete && preloaded.naturalWidth > 0;

  if (!isReady) {
    // Image not in cache yet — show a clean loader so the popup never renders
    // a blank frame or stale counter from the previous hover session.
    screenshotPreview.loaderEl.style.display = "block";
    screenshotPreview.loaderEl.textContent = "Loading…";
    screenshotPreview.imgEl.style.display = "none";
    screenshotPreview.counterEl.style.display = "none";
    screenshotPreview.popupEl.classList.add("visible");
    updateScreenshotPreviewPosition();

    // Block until pixel data is fully in the browser's image cache.
    await waitForImageReady(nextSrc);

    // Bail out if the slide changed or the preview was closed while decoding.
    if (
      screenshotPreview.imageIndex !== capturedIndex ||
      !screenshotPreview.popupEl.classList.contains("visible")
    ) {
      return;
    }
  }

  // Image is decoded — paint it in one frame, no progressive scan.
  screenshotPreview.loaderEl.style.display = "none";
  screenshotPreview.imgEl.style.display = "block";
  screenshotPreview.popupEl.classList.add("visible");

  const img = screenshotPreview.imgEl;
  if (img.src !== nextSrc) img.src = nextSrc;

  const total = screenshotPreview.images.length;
  if (total > 1) {
    screenshotPreview.counterEl.style.display = "block";
    screenshotPreview.counterEl.textContent = `${capturedIndex + 1} / ${total}`;
  } else {
    screenshotPreview.counterEl.style.display = "none";
  }

  updateScreenshotPreviewPosition();
}

function hideScreenshotPreview() {
  if (!screenshotPreview.popupEl) return;
  screenshotPreview.popupEl.classList.remove("visible");
  screenshotPreview.imgEl.removeAttribute("src");
}

function updateScreenshotPreviewPosition() {
  const popup = screenshotPreview.popupEl;
  if (!popup) return;
  const padding = 16;
  const offset = 20;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = popup.getBoundingClientRect();

  let x = screenshotPreview.mouseX + offset;
  let y = screenshotPreview.mouseY + offset;

  if (x + rect.width + padding > vw) {
    x = screenshotPreview.mouseX - rect.width - offset;
  }
  if (y + rect.height + padding > vh) {
    y = vh - rect.height - padding;
  }
  if (x < padding) x = padding;
  if (y < padding) y = padding;

  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
}

// Remove the native browser tooltip from all torrent-view anchor elements in
// the listing table so the Screenshot Preview popup isn't obscured/competed
// with by the OS tooltip.  Original values are saved and can be restored.
function suppressTorrentLinkTitles() {
  document
    .querySelectorAll('table.torrent-list td a[href^="/view/"]')
    .forEach((a) => {
      if (!screenshotPreview.titleStore.has(a)) {
        screenshotPreview.titleStore.set(a, a.getAttribute("title") ?? "");
      }
      a.removeAttribute("title");
    });
}

function restoreTorrentLinkTitles() {
  screenshotPreview.titleStore.forEach((original, el) => {
    if (original) el.setAttribute("title", original);
  });
  screenshotPreview.titleStore.clear();
}

function setupTitleSuppression() {
  suppressTorrentLinkTitles();

  // Watch for new rows being added (e.g. pagination, dynamic updates) so they
  // also have their titles suppressed immediately.
  const tbody = document.querySelector("table.torrent-list tbody");
  if (!tbody || screenshotPreview.titleObserver) return;

  screenshotPreview.titleObserver = new MutationObserver(() => {
    suppressTorrentLinkTitles();
  });
  screenshotPreview.titleObserver.observe(tbody, {
    childList: true,
    subtree: false,
  });
}

function teardownTitleSuppression() {
  if (screenshotPreview.titleObserver) {
    screenshotPreview.titleObserver.disconnect();
    screenshotPreview.titleObserver = null;
  }
  restoreTorrentLinkTitles();
}

async function initializeScreenshotPreview() {
  const prefs = await loadStoredPreferences();
  screenshotPreview.enabled = !!prefs.screenshotPreviewEnabled;
  screenshotPreview.hoverDelayMs = Math.max(
    0,
    Math.round((parseFloat(prefs.screenshotPreviewHoverDelay) || 0) * 1000),
  );
  screenshotPreview.slideDelayMs = Math.max(
    100,
    Math.round((parseFloat(prefs.screenshotPreviewSlideDelay) || 0) * 1000),
  );

  if (screenshotPreview.enabled) {
    ensureScreenshotPreviewDelegation();
    setupTitleSuppression();
  }
}

function invertSelection() {
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

  // Update the selection counter
  const selectionCounter = document.querySelector(".magnet-selection-counter");
  if (selectionCounter) {
    const checkedBoxes = document.querySelectorAll(
      ".magnet-checkbox:checked",
    ).length;
    updateSelectionCounterDisplay(selectionCounter, checkedBoxes);
  }

  showNotification(
    `Selection inverted (${invertedCount} items selected)`,
    true,
  );
}

// Function to filter torrents by last 30 days
function filterByLast30Days() {
  const rows = document.querySelectorAll("table.torrent-list tbody tr");
  const now = Date.now() / 1000; // Current time in seconds (Unix timestamp)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60; // 30 days in seconds
  let hiddenCount = 0;
  let visibleCount = 0;

  rows.forEach((row) => {
    // Find the date cell with data-timestamp attribute
    const dateCell = row.querySelector("td[data-timestamp]");

    if (dateCell) {
      const timestamp = parseInt(dateCell.getAttribute("data-timestamp"), 10);

      // Hide rows older than 30 days
      if (timestamp < thirtyDaysAgo) {
        row.style.display = "none";
        hiddenCount++;
      } else {
        row.style.display = "";
        visibleCount++;
      }
    }
  });

  showNotification(
    `Showing ${visibleCount} torrents from the last 30 days (${hiddenCount} hidden)`,
    true,
  );
}

const QS_FILE_SIZE_SLIDER_MAX_MB = 51200;
const QS_FILE_SIZE_ABSOLUTE_MAX_BYTES = QS_FILE_SIZE_SLIDER_MAX_MB * 1024 * 1024;
const QS_FILE_SIZE_UNIT_MULTIPLIERS = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
  TiB: 1024 * 1024 * 1024 * 1024,
};

function formatQuickSearchFileSizeValue(value, unit) {
  if (unit === "B") {
    return String(Math.round(value));
  }
  if (value >= 100) {
    return String(Math.round(value));
  }
  if (value >= 10) {
    return String(Math.round(value * 10) / 10);
  }
  return String(Math.round(value * 100) / 100);
}

function bytesToQuickSearchDisplay(bytes, preferredUnit) {
  if (
    preferredUnit &&
    QS_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit] !== undefined
  ) {
    const value = bytes / QS_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit];
    return {
      value: formatQuickSearchFileSizeValue(value, preferredUnit),
      unit: preferredUnit,
    };
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const unit = units[unitIndex];
  return {
    value: formatQuickSearchFileSizeValue(value, unit),
    unit,
  };
}

function quickSearchDisplayToBytes(value, unit) {
  const num = parseFloat(value);
  const multiplier = QS_FILE_SIZE_UNIT_MULTIPLIERS[unit];
  if (!Number.isFinite(num) || num < 0 || multiplier === undefined) {
    return 0;
  }
  return Math.round(num * multiplier);
}

function clampQuickSearchFileSizeBounds(minBytes, maxBytes) {
  let min = Math.max(0, Math.min(minBytes, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES));
  let max = Math.max(0, Math.min(maxBytes, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES));
  if (min > max) {
    if (minBytes > maxBytes) {
      min = max;
    } else {
      max = min;
    }
  }
  return { min, max };
}

function formatQuickSearchFileSizeSummary(minBytes, maxBytes) {
  if (minBytes <= 0 && maxBytes >= QS_FILE_SIZE_ABSOLUTE_MAX_BYTES) {
    return "Any size";
  }
  return `${formatNekoBTBytes(minBytes)} – ${formatNekoBTBytes(maxBytes)}`;
}

function updateQuickSearchFileSizeFill() {
  const minSlider = document.getElementById("qs-file-size-min-slider");
  const maxSlider = document.getElementById("qs-file-size-max-slider");
  const fill = document.getElementById("qs-file-size-fill");
  if (!minSlider || !maxSlider || !fill) return;

  const minVal = parseInt(minSlider.value, 10);
  const maxVal = parseInt(maxSlider.value, 10);
  const minPercent = (minVal / QS_FILE_SIZE_SLIDER_MAX_MB) * 100;
  const maxPercent = (maxVal / QS_FILE_SIZE_SLIDER_MAX_MB) * 100;
  fill.style.left = `${minPercent}%`;
  fill.style.width = `${maxPercent - minPercent}%`;
}

function syncQuickSearchFileSizeControls(minBytes, maxBytes) {
  const bounds = clampQuickSearchFileSizeBounds(minBytes, maxBytes);
  const minUnitSelect = document.getElementById("qs-file-size-min-unit");
  const maxUnitSelect = document.getElementById("qs-file-size-max-unit");
  const minDisp = bytesToQuickSearchDisplay(bounds.min, minUnitSelect?.value);
  const maxDisp = bytesToQuickSearchDisplay(bounds.max, maxUnitSelect?.value);

  if (minUnitSelect) minUnitSelect.value = minDisp.unit;
  if (maxUnitSelect) maxUnitSelect.value = maxDisp.unit;

  document.getElementById("qs-file-size-min-input").value = String(
    minDisp.value,
  );
  document.getElementById("qs-file-size-max-input").value = String(
    maxDisp.value,
  );
  document.getElementById("qs-file-size-min-slider").value = String(
    Math.round(bounds.min / (1024 * 1024)),
  );
  document.getElementById("qs-file-size-max-slider").value = String(
    Math.round(bounds.max / (1024 * 1024)),
  );
  document.getElementById("qs-file-size-summary").textContent =
    formatQuickSearchFileSizeSummary(bounds.min, bounds.max);
  updateQuickSearchFileSizeFill();
  return bounds;
}

function readQuickSearchFileSizeBounds() {
  const minBytes = quickSearchDisplayToBytes(
    document.getElementById("qs-file-size-min-input").value,
    document.getElementById("qs-file-size-min-unit").value,
  );
  const maxBytes = quickSearchDisplayToBytes(
    document.getElementById("qs-file-size-max-input").value,
    document.getElementById("qs-file-size-max-unit").value,
  );
  return clampQuickSearchFileSizeBounds(minBytes, maxBytes);
}

function isQuickSearchFileSizeFilterActive(enabled, minBytes, maxBytes) {
  return (
    enabled &&
    (minBytes > 0 || maxBytes < QS_FILE_SIZE_ABSOLUTE_MAX_BYTES)
  );
}

function initQuickSearchFileSizeControls() {
  syncQuickSearchFileSizeControls(0, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES);

  const sizeSection = document.getElementById("qs-file-size-section");
  const sizeEnabledCheckbox = document.getElementById("qs-file-size-enabled");

  sizeEnabledCheckbox.addEventListener("change", () => {
    sizeSection.hidden = !sizeEnabledCheckbox.checked;
    if (sizeEnabledCheckbox.checked) {
      syncQuickSearchFileSizeControls(
        500 * 1024 * 1024,
        4 * 1024 * 1024 * 1024,
      );
    }
  });

  const handleSliderInput = (isMinSlider) => {
    const minSlider = document.getElementById("qs-file-size-min-slider");
    const maxSlider = document.getElementById("qs-file-size-max-slider");
    let minMb = parseInt(minSlider.value, 10);
    let maxMb = parseInt(maxSlider.value, 10);

    if (isMinSlider && minMb > maxMb) {
      maxMb = minMb;
      maxSlider.value = String(maxMb);
    } else if (!isMinSlider && maxMb < minMb) {
      minMb = maxMb;
      minSlider.value = String(minMb);
    }

    syncQuickSearchFileSizeControls(
      minMb * 1024 * 1024,
      maxMb * 1024 * 1024,
    );
  };

  document
    .getElementById("qs-file-size-min-slider")
    .addEventListener("input", () => handleSliderInput(true));
  document
    .getElementById("qs-file-size-max-slider")
    .addEventListener("input", () => handleSliderInput(false));

  ["qs-file-size-min-input", "qs-file-size-max-input"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const bounds = readQuickSearchFileSizeBounds();
      syncQuickSearchFileSizeControls(bounds.min, bounds.max);
    });
  });

  ["qs-file-size-min-unit", "qs-file-size-max-unit"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const bounds = readQuickSearchFileSizeBounds();
      syncQuickSearchFileSizeControls(bounds.min, bounds.max);
    });
  });
}

function applyQuickSearchClientFilters(options) {
  const rows = document.querySelectorAll("table.torrent-list tbody tr");
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  let hiddenCount = 0;
  let visibleCount = 0;
  const filterParts = [];

  rows.forEach((row) => {
    let visible = true;

    if (options.last30Days) {
      const dateCell = row.querySelector("td[data-timestamp]");
      if (dateCell) {
        const timestamp = parseInt(dateCell.getAttribute("data-timestamp"), 10);
        if (timestamp < thirtyDaysAgo) {
          visible = false;
        }
      }
    }

    if (visible && options.sizeEnabled) {
      const sizeCell = row.querySelector("td:nth-of-type(4)");
      if (sizeCell) {
        const sizeInBytes = convertToBytes(sizeCell.textContent);
        if (
          sizeInBytes < options.sizeMin ||
          sizeInBytes > options.sizeMax
        ) {
          visible = false;
        }
      }
    }

    row.style.display = visible ? "" : "none";
    if (visible) visibleCount++;
    else hiddenCount++;
  });

  if (options.last30Days) filterParts.push("last 30 days");
  if (options.sizeEnabled) {
    filterParts.push(
      `size ${formatNekoBTBytes(options.sizeMin)} – ${formatNekoBTBytes(options.sizeMax)}`,
    );
  }

  const filterLabel = filterParts.length
    ? ` filtered by ${filterParts.join(" and ")}`
    : "";

  showNotification(
    `Showing ${visibleCount} torrents (${hiddenCount} hidden)${filterLabel}`,
    true,
  );
}

const XEM_ALL_NAMES_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TMDB_SEARCH_DEBOUNCE_MS = 500;
const TMDB_SEARCH_MIN_INTERVAL_MS = 600;
let tmdbSearchThrottleChain = Promise.resolve();
let tmdbSearchNextAllowedAt = 0;
const quickSearchAnimeMemoryCache = {
  tmdbSearch: new Map(),
  tmdbExternalIds: new Map(),
  tmdbAltTitles: new Map(),
  xemShowNames: new Map(),
  xemAllNames: { tvdb: null, anidb: null },
  xemAllNamesPromises: { tvdb: null, anidb: null },
};

function clearQuickSearchAnimeCaches() {
  quickSearchAnimeMemoryCache.tmdbSearch.clear();
  quickSearchAnimeMemoryCache.tmdbExternalIds.clear();
  quickSearchAnimeMemoryCache.tmdbAltTitles.clear();
  quickSearchAnimeMemoryCache.xemShowNames.clear();
  quickSearchAnimeMemoryCache.xemAllNames.tvdb = null;
  quickSearchAnimeMemoryCache.xemAllNames.anidb = null;
  quickSearchAnimeMemoryCache.xemAllNamesPromises.tvdb = null;
  quickSearchAnimeMemoryCache.xemAllNamesPromises.anidb = null;
  tmdbSearchThrottleChain = Promise.resolve();
  tmdbSearchNextAllowedAt = 0;
}

function normalizeAnimeAliasName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function flattenXemNamesPayload(payload) {
  const names = new Set();
  if (!payload || typeof payload !== "object") return [];

  for (const value of Object.values(payload)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) names.add(trimmed);
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const trimmed = String(entry || "").trim();
        if (trimmed) names.add(trimmed);
      });
      continue;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach((entry) => {
        if (Array.isArray(entry)) {
          entry.forEach((name) => {
            const trimmed = String(name || "").trim();
            if (trimmed) names.add(trimmed);
          });
        }
      });
    }
  }

  return [...names];
}

function addAnimeAliasNames(targetSet, names) {
  names.forEach((name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    targetSet.add(trimmed);
  });
}

function dedupeAnimeAliasNames(names, preferredFirst = []) {
  const seen = new Set();
  const ordered = [];

  const pushName = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const key = normalizeAnimeAliasName(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(trimmed);
  };

  preferredFirst.forEach(pushName);
  names.forEach(pushName);
  return ordered;
}

async function getXemAllNames(origin) {
  if (quickSearchAnimeMemoryCache.xemAllNames[origin]) {
    return quickSearchAnimeMemoryCache.xemAllNames[origin];
  }

  const storageKey = `xemAllNames_${origin}`;
  const stored = await chrome.storage.local.get({ [storageKey]: null });
  const cached = stored[storageKey];
  if (
    cached?.data &&
    cached.fetchedAt &&
    Date.now() - cached.fetchedAt < XEM_ALL_NAMES_TTL_MS
  ) {
    quickSearchAnimeMemoryCache.xemAllNames[origin] = cached.data;
    return cached.data;
  }

  if (!quickSearchAnimeMemoryCache.xemAllNamesPromises[origin]) {
    quickSearchAnimeMemoryCache.xemAllNamesPromises[origin] = (async () => {
      const url = `https://thexem.info/map/allNames?origin=${encodeURIComponent(origin)}&defaultNames=1`;
      const result = await fetchJsonViaBackground(url);
      if (!result.ok || result.data?.result !== "success") {
        throw new Error(
          result.data?.message || result.error || "TheXEM request failed",
        );
      }
      quickSearchAnimeMemoryCache.xemAllNames[origin] = result.data.data || {};
      await chrome.storage.local.set({
        [storageKey]: {
          fetchedAt: Date.now(),
          data: result.data.data || {},
        },
      });
      return result.data.data || {};
    })().finally(() => {
      quickSearchAnimeMemoryCache.xemAllNamesPromises[origin] = null;
    });
  }

  return quickSearchAnimeMemoryCache.xemAllNamesPromises[origin];
}

async function fetchXemShowNames(origin, entityId) {
  const cacheKey = `${origin}:${entityId}`;
  if (quickSearchAnimeMemoryCache.xemShowNames.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.xemShowNames.get(cacheKey);
  }

  const url = `https://thexem.info/map/names?origin=${encodeURIComponent(origin)}&id=${encodeURIComponent(entityId)}&defaultNames=1`;
  const result = await fetchJsonViaBackground(url);
  if (!result.ok || result.data?.result !== "success") {
    quickSearchAnimeMemoryCache.xemShowNames.set(cacheKey, []);
    return [];
  }

  const names = flattenXemNamesPayload(result.data.data);
  quickSearchAnimeMemoryCache.xemShowNames.set(cacheKey, names);
  return names;
}

function getAllNamesEntryNames(allNamesData, entityId) {
  const entry = allNamesData?.[String(entityId)];
  if (!entry) return [];
  return Array.isArray(entry) ? entry.filter(Boolean) : [];
}

function findLinkedAnidbIds(names, anidbAllNames) {
  const normalizedNames = new Set(
    names.map((name) => normalizeAnimeAliasName(name)).filter(Boolean),
  );
  if (!normalizedNames.size || !anidbAllNames) return [];

  const linkedIds = new Set();
  for (const [anidbId, entries] of Object.entries(anidbAllNames)) {
    if (!Array.isArray(entries)) continue;
    const hasOverlap = entries.some((name) =>
      normalizedNames.has(normalizeAnimeAliasName(name)),
    );
    if (hasOverlap) linkedIds.add(String(anidbId));
  }
  return [...linkedIds];
}

async function fetchTmdbJson(url) {
  return new Promise((resolve, reject) => {
    tmdbSearchThrottleChain = tmdbSearchThrottleChain
      .then(async () => {
        const waitMs = Math.max(0, tmdbSearchNextAllowedAt - Date.now());
        if (waitMs > 0) {
          await new Promise((delayResolve) => setTimeout(delayResolve, waitMs));
        }

        const result = await fetchJsonViaBackground(url);
        tmdbSearchNextAllowedAt = Date.now() + TMDB_SEARCH_MIN_INTERVAL_MS;

        if (result.ok && result.data?.status_code === 429) {
          tmdbSearchNextAllowedAt = Date.now() + 2000;
          resolve({
            ok: false,
            error: "rate_limited",
            data: result.data,
          });
          return;
        }

        resolve(result);
      })
      .catch(reject);
  });
}

async function searchTmdbAnime(query, apiKey) {
  const cacheKey = `${apiKey}:${query.toLowerCase()}`;
  if (quickSearchAnimeMemoryCache.tmdbSearch.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.tmdbSearch.get(cacheKey);
  }

  const url = `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US`;
  const result = await fetchTmdbJson(url);
  if (!result.ok || !Array.isArray(result.data?.results)) {
    if (result.error === "rate_limited") {
      throw new Error("rate_limited");
    }
    quickSearchAnimeMemoryCache.tmdbSearch.set(cacheKey, []);
    return [];
  }

  const shows = result.data.results
    .filter((entry) => entry?.id && entry?.name)
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      originalName: entry.original_name || "",
      firstAirDate: entry.first_air_date || "",
      overview: entry.overview || "",
    }));

  quickSearchAnimeMemoryCache.tmdbSearch.set(cacheKey, shows);
  return shows;
}

async function getTmdbTvdbId(tmdbId, apiKey) {
  const cacheKey = `${apiKey}:${tmdbId}`;
  if (quickSearchAnimeMemoryCache.tmdbExternalIds.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.tmdbExternalIds.get(cacheKey);
  }

  const url = `https://api.themoviedb.org/3/tv/${encodeURIComponent(tmdbId)}/external_ids?api_key=${encodeURIComponent(apiKey)}`;
  const result = await fetchTmdbJson(url);
  const tvdbId = result.ok ? result.data?.tvdb_id || null : null;
  quickSearchAnimeMemoryCache.tmdbExternalIds.set(cacheKey, tvdbId);
  return tvdbId;
}

async function getTmdbAlternativeTitles(tmdbId, apiKey) {
  const cacheKey = `${apiKey}:${tmdbId}`;
  if (quickSearchAnimeMemoryCache.tmdbAltTitles.has(cacheKey)) {
    return quickSearchAnimeMemoryCache.tmdbAltTitles.get(cacheKey);
  }

  const url = `https://api.themoviedb.org/3/tv/${encodeURIComponent(tmdbId)}/alternative_titles?api_key=${encodeURIComponent(apiKey)}`;
  const result = await fetchTmdbJson(url);
  const titles = result.ok
    ? (result.data?.results || [])
        .map((entry) => entry?.title)
        .filter(Boolean)
    : [];
  quickSearchAnimeMemoryCache.tmdbAltTitles.set(cacheKey, titles);
  return titles;
}

async function resolveAnimeAliasesForSelection(selection, apiKey) {
  const aliasSet = new Set();
  addAnimeAliasNames(aliasSet, [selection.name, selection.originalName]);

  const [tvdbId, tmdbAltTitles] = await Promise.all([
    getTmdbTvdbId(selection.id, apiKey),
    getTmdbAlternativeTitles(selection.id, apiKey),
  ]);
  addAnimeAliasNames(aliasSet, tmdbAltTitles);

  let tvdbAllNames = null;
  let anidbAllNames = null;

  try {
    [tvdbAllNames, anidbAllNames] = await Promise.all([
      getXemAllNames("tvdb"),
      getXemAllNames("anidb"),
    ]);
  } catch {
    tvdbAllNames = null;
    anidbAllNames = null;
  }

  const tvdbNames = [];
  if (tvdbId) {
    const [xemTvdbNames, cachedTvdbNames] = await Promise.all([
      fetchXemShowNames("tvdb", tvdbId),
      Promise.resolve(getAllNamesEntryNames(tvdbAllNames, tvdbId)),
    ]);
    tvdbNames.push(...xemTvdbNames, ...cachedTvdbNames);
    addAnimeAliasNames(aliasSet, tvdbNames);
  }

  if (tvdbId && anidbAllNames) {
    const linkedAnidbIds = findLinkedAnidbIds([...aliasSet, ...tvdbNames], anidbAllNames);
    const anidbNameLists = await Promise.all(
      linkedAnidbIds.map(async (anidbId) => {
        const [xemAnidbNames, cachedAnidbNames] = await Promise.all([
          fetchXemShowNames("anidb", anidbId),
          Promise.resolve(getAllNamesEntryNames(anidbAllNames, anidbId)),
        ]);
        return [...xemAnidbNames, ...cachedAnidbNames];
      }),
    );
    anidbNameLists.forEach((names) => addAnimeAliasNames(aliasSet, names));
  }

  return dedupeAnimeAliasNames([...aliasSet], [selection.name]);
}

function initQuickSearchAnimeAutocomplete(popup) {
  const animeInput = popup.querySelector("#anime-name");
  const suggestionsEl = popup.querySelector("#anime-name-suggestions");
  const aliasesPanel = popup.querySelector("#anime-name-aliases");
  const aliasesListEl = popup.querySelector("#anime-aliases-list");
  const aliasesPreviewEl = popup.querySelector("#anime-aliases-preview");
  const aliasesApplyBtn = popup.querySelector("#anime-aliases-apply");
  const hintEl = popup.querySelector("#anime-name-hint");
  let searchTimer = null;
  let activeSearchToken = 0;
  let selectedAliases = [];

  const hideSuggestions = () => {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  };

  const hideAliasesPanel = () => {
    aliasesPanel.hidden = true;
    aliasesListEl.innerHTML = "";
    aliasesPreviewEl.textContent = "";
    selectedAliases = [];
  };

  const updateAliasPreview = () => {
    const checked = [
      ...aliasesListEl.querySelectorAll('input[type="checkbox"]:checked'),
    ].map((input) => input.value);
    aliasesPreviewEl.textContent = checked.length
      ? checked.join("|")
      : "Select at least one alias";
  };

  const renderAliasCheckboxes = (aliases) => {
    selectedAliases = aliases;
    aliasesListEl.innerHTML = "";
    aliases.forEach((alias) => {
      const label = document.createElement("label");
      label.className = "qf-anime-alias-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = alias;
      input.checked = true;
      input.addEventListener("change", updateAliasPreview);
      const text = document.createElement("span");
      text.textContent = alias;
      label.append(input, text);
      aliasesListEl.appendChild(label);
    });
    aliasesPanel.hidden = aliases.length === 0;
    updateAliasPreview();
  };

  const applySelectedAliases = () => {
    const checked = [
      ...aliasesListEl.querySelectorAll('input[type="checkbox"]:checked'),
    ].map((input) => input.value.trim());
    if (!checked.length) {
      showNotification("Select at least one alias to apply", false);
      return;
    }
    animeInput.value = checked.join("|");
    hideSuggestions();
    showNotification("Anime search aliases applied", true);
  };

  aliasesApplyBtn.addEventListener("click", applySelectedAliases);
  suggestionsEl.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  loadStoredPreferences().then((prefs) => {
    if (!prefs.tmdbApiKey) {
      hintEl.hidden = false;
      hintEl.textContent =
        "Add a TMDB API key in extension settings to search anime titles and load aliases.";
    }
  });

  animeInput.addEventListener("input", () => {
    hideAliasesPanel();
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
      const query = animeInput.value.trim();
      if (query.length < 2) {
        hideSuggestions();
        return;
      }

      const prefs = await loadStoredPreferences();
      if (!prefs.tmdbApiKey) {
        hideSuggestions();
        return;
      }

      const token = ++activeSearchToken;
      suggestionsEl.hidden = false;
      suggestionsEl.innerHTML =
        '<div class="qf-anime-suggestion qf-anime-suggestion--status">Searching…</div>';

      try {
        const results = await searchTmdbAnime(query, prefs.tmdbApiKey);
        if (token !== activeSearchToken) return;

        if (!results.length) {
          suggestionsEl.innerHTML =
            '<div class="qf-anime-suggestion qf-anime-suggestion--status">No matches found</div>';
          return;
        }

        suggestionsEl.innerHTML = "";
        results.forEach((result) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "qf-anime-suggestion";
          const title = document.createElement("span");
          title.className = "qf-anime-suggestion-title";
          title.textContent = result.name;
          button.appendChild(title);
          const meta = [result.originalName, result.firstAirDate]
            .filter(Boolean)
            .join(" · ");
          if (meta) {
            const metaEl = document.createElement("span");
            metaEl.className = "qf-anime-suggestion-meta";
            metaEl.textContent = meta;
            button.appendChild(metaEl);
          }
          button.addEventListener("click", async () => {
            hideSuggestions();
            animeInput.value = result.name;
            aliasesPanel.hidden = false;
            aliasesListEl.innerHTML =
              '<div class="qf-anime-suggestion qf-anime-suggestion--status">Loading aliases…</div>';
            aliasesPreviewEl.textContent = "";

            try {
              const aliases = await resolveAnimeAliasesForSelection(
                result,
                prefs.tmdbApiKey,
              );
              if (!aliases.length) {
                aliasesListEl.innerHTML =
                  '<div class="qf-anime-suggestion qf-anime-suggestion--status">No aliases found</div>';
                return;
              }
              renderAliasCheckboxes(aliases);
            } catch {
              aliasesListEl.innerHTML =
                '<div class="qf-anime-suggestion qf-anime-suggestion--status">Failed to load aliases</div>';
            }
          });
          suggestionsEl.appendChild(button);
        });
      } catch (error) {
        if (token !== activeSearchToken) return;
        suggestionsEl.innerHTML =
          error?.message === "rate_limited"
            ? '<div class="qf-anime-suggestion qf-anime-suggestion--status">TMDB rate limit reached — wait a moment</div>'
            : '<div class="qf-anime-suggestion qf-anime-suggestion--status">Search failed</div>';
      }
    }, TMDB_SEARCH_DEBOUNCE_MS);
  });

  animeInput.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 150);
  });

  animeInput.addEventListener("focus", () => {
    if (suggestionsEl.childElementCount > 0) {
      suggestionsEl.hidden = false;
    }
  });

  return () => {
    hideSuggestions();
    hideAliasesPanel();
  };
}

function getDefaultQuickSearchState() {
  return {
    animeName: "",
    encoder: "",
    quality: "",
    format: "",
    source: "",
    category: "0",
    dualAudio: false,
    seasonPack: false,
    last30Days: false,
    fileSizeEnabled: false,
    fileSizeMinBytes: 0,
    fileSizeMaxBytes: QS_FILE_SIZE_ABSOLUTE_MAX_BYTES,
    fileSizeMinUnit: "MiB",
    fileSizeMaxUnit: "GiB",
  };
}

function readQuickSearchFormState() {
  const sizeBounds = readQuickSearchFileSizeBounds();
  return {
    animeName: document.getElementById("anime-name")?.value || "",
    encoder: document.getElementById("encoder-name")?.value || "",
    quality: document.getElementById("quality")?.value || "",
    format: document.getElementById("format")?.value || "",
    source: document.getElementById("source")?.value || "",
    category: document.getElementById("category")?.value || "0",
    dualAudio: document.getElementById("dual-audio")?.checked || false,
    seasonPack: document.getElementById("season-pack")?.checked || false,
    last30Days: document.getElementById("last-30-days")?.checked || false,
    fileSizeEnabled:
      document.getElementById("qs-file-size-enabled")?.checked || false,
    fileSizeMinBytes: sizeBounds.min,
    fileSizeMaxBytes: sizeBounds.max,
    fileSizeMinUnit:
      document.getElementById("qs-file-size-min-unit")?.value || "MiB",
    fileSizeMaxUnit:
      document.getElementById("qs-file-size-max-unit")?.value || "GiB",
  };
}

function applyQuickSearchFormState(state) {
  const merged = { ...getDefaultQuickSearchState(), ...state };

  document.getElementById("anime-name").value = merged.animeName;
  document.getElementById("encoder-name").value = merged.encoder;
  document.getElementById("quality").value = merged.quality;
  document.getElementById("format").value = merged.format;
  document.getElementById("source").value = merged.source;
  document.getElementById("category").value = merged.category;
  document.getElementById("dual-audio").checked = merged.dualAudio;
  document.getElementById("season-pack").checked = merged.seasonPack;
  document.getElementById("last-30-days").checked = merged.last30Days;
  document.getElementById("qs-file-size-enabled").checked =
    merged.fileSizeEnabled;
  document.getElementById("qs-file-size-section").hidden =
    !merged.fileSizeEnabled;

  const minUnitSelect = document.getElementById("qs-file-size-min-unit");
  const maxUnitSelect = document.getElementById("qs-file-size-max-unit");
  if (minUnitSelect) minUnitSelect.value = merged.fileSizeMinUnit;
  if (maxUnitSelect) maxUnitSelect.value = merged.fileSizeMaxUnit;

  syncQuickSearchFileSizeControls(
    merged.fileSizeMinBytes,
    merged.fileSizeMaxBytes,
  );
}

function loadQuickSearchPreferences() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        quickSearchRememberSelection: true,
        quickSearchState: getDefaultQuickSearchState(),
      },
      (items) => {
        resolve({
          rememberSelection: items.quickSearchRememberSelection !== false,
          state: {
            ...getDefaultQuickSearchState(),
            ...(items.quickSearchState || {}),
          },
        });
      },
    );
  });
}

function loadQuickSearchState() {
  return loadQuickSearchPreferences().then((prefs) => prefs.state);
}

function saveQuickSearchState(state) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ quickSearchState: state }, resolve);
  });
}

function clearQuickSearchState() {
  return saveQuickSearchState(getDefaultQuickSearchState());
}

// Function to show Quick Filter popup
function showQuickFilterPopup() {
  const popup = document.createElement("div");
  popup.className = "quick-filter-popup";

  popup.innerHTML = `
    <h3 class="qf-title">Quick Search</h3>

    <div class="qf-body">
      <div class="qf-grid qf-grid--2 qf-grid--anime-row">
        <div class="qf-field qf-field--anime-name">
          <label class="qf-label" for="anime-name">Anime Name</label>
          <div class="qf-anime-search">
            <input type="text" id="anime-name" class="qf-input" placeholder="Search by title…" autocomplete="off">
            <div class="qf-anime-suggestions" id="anime-name-suggestions" hidden></div>
          </div>
        </div>
        <div class="qf-field">
          <label class="qf-label" for="encoder-name">Encoder</label>
          <input type="text" id="encoder-name" class="qf-input" placeholder="e.g. SubsPlease">
        </div>
        <p class="qf-anime-hint" id="anime-name-hint" hidden></p>
        <div class="qf-anime-aliases" id="anime-name-aliases" hidden>
          <div class="qf-anime-aliases-header">
            <span class="qf-anime-aliases-title">Select aliases for search</span>
            <button type="button" id="anime-aliases-apply" class="qf-btn qf-btn--secondary qf-btn--compact">Apply selected</button>
          </div>
          <div class="qf-anime-aliases-list" id="anime-aliases-list"></div>
          <div class="qf-anime-aliases-preview" id="anime-aliases-preview"></div>
        </div>
      </div>

      <div class="qf-grid qf-grid--3">
        <div class="qf-field">
          <label class="qf-label" for="quality">Quality</label>
          <select id="quality" class="qf-select">
            <option value="">Any quality</option>
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="2160p">2160p (4K)</option>
          </select>
        </div>
        <div class="qf-field">
          <label class="qf-label" for="format">Format</label>
          <select id="format" class="qf-select">
            <option value="">Any format</option>
            <option value="264">H264/AVC</option>
            <option value="x265">x265/HEVC</option>
            <option value="AV1">AV1</option>
            <option value="VP9">VP9</option>
          </select>
        </div>
        <div class="qf-field">
          <label class="qf-label" for="source">Source</label>
          <select id="source" class="qf-select">
            <option value="">Any source</option>
            <option value="BD">BD (Blu-ray)</option>
            <option value="Web">Web (Streaming Service)</option>
            <option value="DVD">DVD</option>
          </select>
        </div>
      </div>

      <div class="qf-field">
        <label class="qf-label" for="category">Category</label>
        <select id="category" class="qf-select">
          <option value="0">All categories</option>
          <option value="1">Anime Music Video</option>
          <option value="2">English-translated</option>
          <option value="3">Non-English-translated</option>
          <option value="4">Raw</option>
        </select>
      </div>

      <div class="qf-options">
        <label class="qf-checkbox">
          <input type="checkbox" id="dual-audio">
          <span>Dual Audio</span>
        </label>
        <label class="qf-checkbox">
          <input type="checkbox" id="season-pack">
          <span>Season Pack</span>
        </label>
        <label class="qf-checkbox">
          <input type="checkbox" id="last-30-days">
          <span>Last 30 Days</span>
        </label>
        <label class="qf-checkbox">
          <input type="checkbox" id="qs-file-size-enabled">
          <span>File Size</span>
        </label>
      </div>

      <div class="qf-size-filter" id="qs-file-size-section" hidden>
        <div class="qf-size-inputs">
          <div class="qf-size-field">
            <label for="qs-file-size-min-input">Minimum</label>
            <div class="qf-size-value-row">
              <input type="number" id="qs-file-size-min-input" min="0" step="any">
              <select id="qs-file-size-min-unit">
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB" selected>MiB</option>
                <option value="GiB">GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
          <div class="qf-size-field">
            <label for="qs-file-size-max-input">Maximum</label>
            <div class="qf-size-value-row">
              <input type="number" id="qs-file-size-max-input" min="0" step="any">
              <select id="qs-file-size-max-unit">
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB">MiB</option>
                <option value="GiB" selected>GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
        </div>
        <div class="qf-size-slider">
          <div class="qf-size-track">
            <div class="qf-size-fill" id="qs-file-size-fill"></div>
          </div>
          <input type="range" id="qs-file-size-min-slider" min="0" max="51200" step="1">
          <input type="range" id="qs-file-size-max-slider" min="0" max="51200" step="1">
        </div>
        <div class="qf-size-summary" id="qs-file-size-summary">Any size</div>
      </div>
    </div>

    <div class="qf-footer">
      <button id="reset-filter" type="button" class="qf-btn qf-btn--outline qf-btn--compact">Reset filters</button>
      <label class="qf-checkbox qf-remember-selection" for="qs-remember-selection">
        <input type="checkbox" id="qs-remember-selection" checked>
        <span>Remember selection</span>
      </label>
      <div class="qf-footer-spacer" aria-hidden="true"></div>
      <button id="cancel-filter" type="button" class="qf-btn qf-btn--secondary">Cancel</button>
      <button id="apply-filter" type="button" class="qf-btn qf-btn--primary">Search</button>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.className = "quick-filter-overlay";

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  document.body.style.overflow = "hidden";

  initQuickSearchFileSizeControls();

  let resetAnimeAutocomplete = initQuickSearchAnimeAutocomplete(popup);

  const rememberSelectionCheckbox = document.getElementById(
    "qs-remember-selection",
  );

  loadQuickSearchPreferences().then(({ rememberSelection, state }) => {
    rememberSelectionCheckbox.checked = rememberSelection;
    if (rememberSelection) {
      applyQuickSearchFormState(state);
    }
  });

  rememberSelectionCheckbox.addEventListener("change", () => {
    chrome.storage.sync.set({
      quickSearchRememberSelection: rememberSelectionCheckbox.checked,
    });
  });

  const textInputs = [
    document.getElementById("anime-name"),
    document.getElementById("encoder-name"),
  ];

  textInputs.forEach((input) => {
    input.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("apply-filter").click();
      }
    });
  });

  const resetQuickSearchFileSizeControls = () => {
    document.getElementById("qs-file-size-enabled").checked = false;
    document.getElementById("qs-file-size-section").hidden = true;
    syncQuickSearchFileSizeControls(0, QS_FILE_SIZE_ABSOLUTE_MAX_BYTES);
  };

  const hasActiveQuickSearchFilters = () => {
    const sizeBounds = readQuickSearchFileSizeBounds();
    const fileSizeEnabled = document.getElementById("qs-file-size-enabled")
      .checked;
    const fileSizeActive = isQuickSearchFileSizeFilterActive(
      fileSizeEnabled,
      sizeBounds.min,
      sizeBounds.max,
    );

    return (
      document.getElementById("anime-name").value.trim() ||
      document.getElementById("encoder-name").value.trim() ||
      document.getElementById("quality").value ||
      document.getElementById("format").value ||
      document.getElementById("source").value ||
      document.getElementById("category").value !== "0" ||
      document.getElementById("dual-audio").checked ||
      document.getElementById("season-pack").checked ||
      document.getElementById("last-30-days").checked ||
      fileSizeActive
    );
  };

  document.getElementById("reset-filter").addEventListener("click", async () => {
    if (hasActiveQuickSearchFilters()) {
      document.getElementById("anime-name").value = "";
      if (resetAnimeAutocomplete) resetAnimeAutocomplete();
      document.getElementById("encoder-name").value = "";
      document.getElementById("quality").value = "";
      document.getElementById("format").value = "";
      document.getElementById("source").value = "";
      document.getElementById("category").value = "0";
      document.getElementById("dual-audio").checked = false;
      document.getElementById("season-pack").checked = false;
      document.getElementById("last-30-days").checked = false;
      resetQuickSearchFileSizeControls();
      if (rememberSelectionCheckbox.checked) {
        await clearQuickSearchState();
      }
      showNotification("All filters have been reset", true);
    } else {
      showNotification("No active filters to reset", false);
    }
  });

  document.getElementById("apply-filter").addEventListener("click", async () => {
    const searchParams = [];
    const category = document.getElementById("category").value;

    const animeName = document.getElementById("anime-name").value.trim();
    const encoder = document.getElementById("encoder-name").value.trim();
    const quality = document.getElementById("quality").value;
    const format = document.getElementById("format").value;
    const source = document.getElementById("source").value;
    const dualAudio = document.getElementById("dual-audio").checked;
    const seasonPack = document.getElementById("season-pack").checked;
    const last30Days = document.getElementById("last-30-days").checked;
    const fileSizeEnabled = document.getElementById("qs-file-size-enabled")
      .checked;
    const sizeBounds = readQuickSearchFileSizeBounds();
    const fileSizeActive = isQuickSearchFileSizeFilterActive(
      fileSizeEnabled,
      sizeBounds.min,
      sizeBounds.max,
    );

    if (animeName) searchParams.push(animeName);
    if (encoder) searchParams.push(encoder);
    if (quality) searchParams.push(quality);
    if (format) searchParams.push(format);
    if (source) searchParams.push(source);
    if (dualAudio) searchParams.push("Dual");
    if (seasonPack) searchParams.push("Season");

    const hasSearchFilters =
      animeName ||
      encoder ||
      quality ||
      format ||
      source ||
      dualAudio ||
      seasonPack ||
      category !== "0";

    const hasClientFilters = last30Days || fileSizeActive;
    const hasAnyFilters = hasSearchFilters || hasClientFilters;

    if (!hasAnyFilters) {
      showNotification(
        "No filter options selected. Please select at least one option to search.",
        false,
      );
      return;
    }

    if (rememberSelectionCheckbox.checked) {
      await saveQuickSearchState(readQuickSearchFormState());
    }

    if (!hasSearchFilters && hasClientFilters) {
      closePopup();
      applyQuickSearchClientFilters({
        last30Days,
        sizeEnabled: fileSizeActive,
        sizeMin: sizeBounds.min,
        sizeMax: sizeBounds.max,
      });
      return;
    }

    const searchQuery = searchParams.join(" ");
    const categoryParam = category === "0" ? "0_0" : `1_${category}`;
    let targetUrl = `${
      window.location.origin
    }/?f=0&c=${categoryParam}&q=${encodeURIComponent(searchQuery)}`;

    if (last30Days) {
      targetUrl += "&dateFilter=30days";
    }
    if (fileSizeActive) {
      targetUrl += `&sizeMin=${sizeBounds.min}&sizeMax=${sizeBounds.max}`;
    }

    window.location.href = targetUrl;
  });

  const closePopup = () => {
    popup.classList.add("hiding");
    overlay.classList.add("hiding");
    document.body.style.overflow = "";

    popup.addEventListener(
      "animationend",
      () => {
        popup.remove();
      },
      { once: true },
    );

    overlay.addEventListener(
      "animationend",
      () => {
        overlay.remove();
      },
      { once: true },
    );
  };

  document
    .getElementById("cancel-filter")
    .addEventListener("click", closePopup);
  overlay.addEventListener("click", closePopup);
}

// Function to hide dead torrents
async function filterDeadTorrents(isInitialLoad = false) {
  await applyAllTorrentFilters({ notify: isInitialLoad });
}

// Add this after filterDeadTorrents function
function observeTableChanges() {
  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody) return;

  let isInitialLoad = true;
  const observer = new MutationObserver((mutations) => {
    if (isInitialLoad) {
      isInitialLoad = false;
      return;
    }
    filterDeadTorrents();
    if (mutationsIncludeNonLinkActionChanges(mutations)) {
      patchTorrentListLinkActionsForNewRows();
    }
  });

  observer.observe(tableBody, {
    childList: true,
    subtree: true,
  });
}

// Add new function for keyword filtering
async function filterByKeywords(isInitialLoad = false) {
  await applyAllTorrentFilters({ notify: isInitialLoad });
}

// Initialize the extension when the page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeExtension(true);
  });
} else {
  initializeExtension(true);
}

// Listen for extension messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "settingChanged") {
    handleSettingChange(message.setting, message.value);
  } else if (message.type === "keywordsUpdated") {
    chrome.storage.sync.set({ keywords: message.keywords }, () => {
      neDisplayFilterKeywords(message.keywords);
      applyAllTorrentFilters({ notify: true });
    });
  } else if (message.type === "monitoredUsersUpdated") {
    // Update the monitored users and refresh the sidebar if it exists
    chrome.storage.sync.set({ monitoredUsers: message.monitoredUsers }, () => {
      const sidebar = document.querySelector(".monitored-users-sidebar");
      if (sidebar) {
        checkMonitoredUsers();
      }
    });
  }
});

// Function to check URL for Quick Search client-side filter parameters
function checkAndApplyQuickSearchFilters() {
  const urlParams = new URLSearchParams(window.location.search);
  const last30Days = urlParams.get("dateFilter") === "30days";
  const sizeMinParam = urlParams.get("sizeMin");
  const sizeMaxParam = urlParams.get("sizeMax");
  const sizeEnabled = sizeMinParam !== null && sizeMaxParam !== null;

  if (!last30Days && !sizeEnabled) return;

  setTimeout(() => {
    applyQuickSearchClientFilters({
      last30Days,
      sizeEnabled,
      sizeMin: sizeEnabled ? parseInt(sizeMinParam, 10) : 0,
      sizeMax: sizeEnabled
        ? parseInt(sizeMaxParam, 10)
        : QS_FILE_SIZE_ABSOLUTE_MAX_BYTES,
    });
  }, 500);
}

async function initializeExtension(isInitialLoad = false) {
  await addFiltersPanel();
  addCopyButton();
  addCheckboxColumn();
  addAnimetoshoToViewPage();
  addAnimetoshoComments();
  addAmeNZBToViewPage();
  addNekoBTToViewPage();
  addTsukihimeToViewPage();
  initializeSeaDex();
  initializeScreenshotPreview();
  addMagnetButtonToViewPage();
  addSendButtonToViewPage();
  enhanceTorrentDescriptionPanel();
  showChangelog();
  observeTableChanges();
  await applyAllTorrentFilters({ notify: isInitialLoad });
  toggleComments();
  applyImprovedFileListFromPrefs();
  handleChangelogPage();
  addChangelogNavItem();
  addMonitorButton();
  checkMonitoredUsers();
  checkAndApplyQuickSearchFilters();
}

async function addMagnetButtonToViewPage() {
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

// Shared helper: wires up the click → torrent client flow
function wireSendTorrentAction(element, magnetUrl) {
  element.addEventListener("click", async (e) => {
    e.preventDefault();

    const currentPrefs = await loadStoredPreferences();

    if (!currentPrefs.torrentClientUrl) {
      showNotification(
        "No torrent client configured. Set it up in the extension popup.",
        false,
      );
      return;
    }

    let username = "",
      password = "";
    if (currentPrefs.torrentClient === "transmission") {
      username = currentPrefs.transmissionUsername;
      password = currentPrefs.transmissionPassword;
    } else if (currentPrefs.torrentClient === "deluge") {
      password = currentPrefs.delugePassword;
    } else {
      username = currentPrefs.qbtUsername;
      password = currentPrefs.qbtPassword;
    }

    const isQbt = currentPrefs.torrentClient === "qbittorrent";
    const needsPrompt =
      isQbt &&
      currentPrefs.qbtPromptOnSend &&
      (currentPrefs.qbtCategories.length > 0 ||
        currentPrefs.qbtTags.length > 0);

    const setBusy = (busy) => {
      if (element instanceof HTMLButtonElement) {
        element.disabled = busy;
      } else {
        element.style.pointerEvents = busy ? "none" : "";
        element.style.opacity = busy ? "0.5" : "";
      }
    };

    const doSend = async (category, tags) => {
      setBusy(true);

      const msg = {
        type: "sendTorrent",
        client: currentPrefs.torrentClient,
        url: currentPrefs.torrentClientUrl,
        username,
        password,
        magnetUrl,
      };
      if (isQbt) {
        msg.category = category || "";
        msg.tags = tags || [];
        chrome.storage.sync.set({
          qbtLastCategory: category || "",
          qbtLastTags: tags || [],
        });
      }

      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, resolve);
      });

      setBusy(false);

      if (!result || !result.ok) {
        const msgTxt =
          result?.error === "already_exists"
            ? "Torrent already exists in your client."
            : result?.error === "wrong_client"
              ? "Wrong torrent client selected for this URL. Fix it in the extension popup."
              : result?.error === "auth_failed"
                ? "Authentication failed — check your credentials."
                : result?.error === "auth_required"
                  ? "Torrent client requires authentication."
                  : "Failed to send torrent. Check the client connection.";
        showNotification(msgTxt, false);
        return;
      }

      showNotification("Torrent sent to client!", true);
    };

    if (!isQbt) {
      await doSend("", []);
      return;
    }

    if (!needsPrompt) {
      await doSend(
        currentPrefs.qbtDefaultCategory || "",
        currentPrefs.qbtDefaultTags || [],
      );
      return;
    }

    openQbtCategoryTagModal(currentPrefs, doSend);
  });
}

function createSendListLink(magnetUrl) {
  const sendLink = document.createElement("a");
  sendLink.href = "#";
  sendLink.className = "link-action-send";
  sendLink.title = "Send to torrent client";
  sendLink.innerHTML = '<i class="fa fa-fw fa-cloud-upload"></i>';
  wireSendTorrentAction(sendLink, magnetUrl);
  return sendLink;
}

// Shared helper: creates a send button and wires up the click → qBittorrent flow
function createSendButton(magnetUrl, extraStyles = {}) {
  const sendButton = document.createElement("button");
  sendButton.className = "magnet-button send-torrent-button";
  sendButton.title = "Send to torrent client";
  sendButton.innerHTML = '<i class="fa fa-cloud-upload"></i> Send';
  sendButton.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
  sendButton.style.fontWeight = "500";
  Object.assign(sendButton.style, extraStyles);
  wireSendTorrentAction(sendButton, magnetUrl);
  return sendButton;
}

// ── qBittorrent category/tag selection modal ─────────────────────────────────

function openQbtCategoryTagModal(prefs, onConfirm) {
  // Remove any existing modal first (skip fade-out so a fresh one can open)
  closeQbtCategoryTagModal(true);

  const categories = prefs.qbtCategories || [];
  const tags = prefs.qbtTags || [];
  // A "last selection" exists only if user has actually used the modal before (not null)
  const useLastSel =
    prefs.qbtLastCategory !== null || prefs.qbtLastTags !== null;

  const defaultCategory = useLastSel
    ? prefs.qbtLastCategory || ""
    : prefs.qbtDefaultCategory || "";
  const defaultTags =
    useLastSel && prefs.qbtLastTags
      ? prefs.qbtLastTags
      : prefs.qbtDefaultTags || [];

  const overlay = document.createElement("div");
  overlay.className = "qbt-modal-overlay";
  overlay.id = "qbtCategoryTagOverlay";

  const modal = document.createElement("div");
  modal.className = "qbt-modal";
  modal.id = "qbtCategoryTagModal";

  modal.innerHTML = `
    <div class="qbt-modal-header">
      <h3>Send to qBittorrent</h3>
      <button type="button" class="qbt-modal-close" id="qbtModalCloseBtn" aria-label="Close">&times;</button>
    </div>
    <div class="qbt-modal-body">
      <div class="qbt-modal-field">
        <label class="qbt-modal-label">Category</label>
        <select id="qbtModalCategorySelect" class="qbt-modal-select">
          <option value="">(none)</option>
          ${categories
            .map(
              (c) =>
                `<option value="${escapeHtml(c)}" ${
                  c === defaultCategory ? "selected" : ""
                }>${escapeHtml(c)}</option>`,
            )
            .join("")}
        </select>
      </div>
      <div class="qbt-modal-field">
        <label class="qbt-modal-label">Tags${
          tags.length ? ` (${tags.length})` : ""
        }</label>
        <div class="qbt-modal-tags" id="qbtModalTagsContainer">
          ${
            tags.length
              ? tags
                  .map(
                    (t) => `
                <label class="qbt-tag-item">
                  <input type="checkbox" value="${escapeHtml(t)}" ${
                    defaultTags.includes(t) ? "checked" : ""
                  } />
                  <span>${escapeHtml(t)}</span>
                </label>
              `,
                  )
                  .join("")
              : `<span class="qbt-modal-empty">No tags defined. Add some in extension settings.</span>`
          }
        </div>
      </div>
      <div class="qbt-modal-hint">
        Your last selection will be remembered next time.
      </div>
    </div>
    <div class="qbt-modal-footer">
      <button type="button" class="qbt-modal-btn qbt-modal-btn-cancel" id="qbtModalCancelBtn">Cancel</button>
      <button type="button" class="qbt-modal-btn qbt-modal-btn-confirm" id="qbtModalConfirmBtn">Send Torrent</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector("#qbtModalCloseBtn");
  const cancelBtn = modal.querySelector("#qbtModalCancelBtn");
  const confirmBtn = modal.querySelector("#qbtModalConfirmBtn");

  const close = () => closeQbtCategoryTagModal();

  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  confirmBtn.addEventListener("click", () => {
    const select = modal.querySelector("#qbtModalCategorySelect");
    const category = select.value;
    const tagInputs = modal.querySelectorAll(
      "#qbtModalTagsContainer input[type='checkbox']:checked",
    );
    const tags = Array.from(tagInputs).map((cb) => cb.value);
    close();
    onConfirm(category, tags);
  });

  document.addEventListener("keydown", qbtModalKeyHandler);
}

function closeQbtCategoryTagModal(immediate = false) {
  const overlay = document.getElementById("qbtCategoryTagOverlay");
  document.removeEventListener("keydown", qbtModalKeyHandler);
  if (!overlay) return;

  if (immediate) {
    overlay.remove();
    return;
  }

  // Already animating out — don't restart
  if (overlay.classList.contains("hiding")) return;

  const modal = overlay.querySelector(".qbt-modal");
  overlay.classList.add("hiding");
  if (modal) modal.classList.add("hiding");

  // Wait for fade-out animation before removing (same pattern as Quick Search)
  const onOverlayFadeOut = (e) => {
    if (e.target !== overlay) return;
    overlay.removeEventListener("animationend", onOverlayFadeOut);
    overlay.remove();
  };
  overlay.addEventListener("animationend", onOverlayFadeOut);
}

function qbtModalKeyHandler(e) {
  if (e.key === "Escape") closeQbtCategoryTagModal();
  if (e.key === "Enter") {
    const confirmBtn = document.getElementById("qbtModalConfirmBtn");
    if (confirmBtn) confirmBtn.click();
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── End qBittorrent category/tag selection modal ─────────────────────────────

async function addSendButtonToViewPage() {
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showSendButtons) return;

  // Avoid adding duplicate button
  if (document.querySelector(".send-torrent-button")) return;

  const magnetLink = document.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  const sendButton = createSendButton(magnetLink.href, { marginLeft: "10px" });

  // Insert after the magnet Copy button if present, otherwise after the magnet link
  const magnetCopyButton = magnetLink.parentNode.querySelector(
    ".magnet-button:not(.send-torrent-button)",
  );
  const insertAfter = magnetCopyButton || magnetLink;
  insertAfter.parentNode.insertBefore(sendButton, insertAfter.nextSibling);
}

function enhanceTorrentDescriptionPanel() {
  if (!window.location.pathname.startsWith("/view/")) return;

  const descriptionBody = document.getElementById("torrent-description");
  if (!descriptionBody) return;

  const panel = descriptionBody.closest(".panel.panel-default");
  if (!panel) return;

  if (!panel.classList.contains("nyaa-enhancer-description-panel")) {
    panel.classList.add("nyaa-enhancer-description-panel");

    const tabsHeader = document.createElement("div");
    tabsHeader.className = "nyaa-enhancer-description-tabs";
    tabsHeader.setAttribute("role", "tablist");

    const descTab = document.createElement("button");
    descTab.type = "button";
    descTab.className = "nyaa-enhancer-desc-tab active";
    descTab.setAttribute("role", "tab");
    descTab.setAttribute("aria-selected", "true");
    descTab.dataset.section = "description";
    descTab.textContent = "Description";
    descTab.addEventListener("click", () =>
      switchDescriptionPanelTab(panel, "description"),
    );

    tabsHeader.appendChild(descTab);
    panel.insertBefore(tabsHeader, descriptionBody);
  }

  updateAmeNZBDescriptionSection();
  updateNekoBTDescriptionSection();
  updateTsukihimeDescriptionSection();
  updateAnimetoshoEpisodeFeatures();
}

async function toggleComments() {
  // Only run on view pages
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  const comments = document.getElementById("comments");
  if (!comments) return;

  // Set initial display style based on preference
  comments.style.display = prefs.hideComments ? "none" : "block";
}

function isTorrentFileListItem(li) {
  return li.querySelector(":scope > i.fa-file") !== null;
}

function countTorrentFilesIn(container) {
  let count = 0;
  container.querySelectorAll("li").forEach((li) => {
    if (isTorrentFileListItem(li)) count++;
  });
  return count;
}

function getFolderLinkOriginalLabel(link) {
  if (!link.dataset.nyaaEnhancerFolderLabel) {
    const clone = link.cloneNode(true);
    clone.querySelectorAll("i").forEach((icon) => icon.remove());
    link.dataset.nyaaEnhancerFolderLabel = clone.textContent.trim();
  }
  return link.dataset.nyaaEnhancerFolderLabel;
}

function setFolderLinkLabel(link, label) {
  const icon = link.querySelector("i");
  link.textContent = "";
  if (icon) link.appendChild(icon);
  link.appendChild(document.createTextNode(label));
}

function restoreImprovedFileList() {
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

function applyImprovedFileList(enabled) {
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

async function applyImprovedFileListFromPrefs() {
  const prefs = await loadStoredPreferences();
  applyImprovedFileList(prefs.improvedFileList);
}

// Function to convert size string to bytes
function convertToBytes(sizeStr) {
  const [value, unit] = sizeStr.trim().split(" ");
  const numValue = parseFloat(value);

  switch (unit) {
    case "B":
    case "Bytes":
      return numValue;
    case "KiB":
      return numValue * 1024;
    case "MiB":
      return numValue * 1024 * 1024;
    case "GiB":
      return numValue * 1024 * 1024 * 1024;
    case "TiB":
      return numValue * 1024 * 1024 * 1024 * 1024;
    default:
      return 0;
  }
}

// Function to check if size is within selected range
const FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES = 51200 * 1024 * 1024;
const FILE_SIZE_FILTER_DEFAULT_MIN_BYTES = 500 * 1024 * 1024;
const FILE_SIZE_FILTER_DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024;

const LEGACY_FILE_SIZE_RANGE_MAP = {
  less_than_256mb: { min: 0, max: 256 * 1024 * 1024 },
  less_than_512mb: { min: 0, max: 512 * 1024 * 1024 },
  less_than_768mb: { min: 0, max: 768 * 1024 * 1024 },
  less_than_1gb: { min: 0, max: 1024 * 1024 * 1024 },
  greater_than_1gb: {
    min: 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
  greater_than_5gb: {
    min: 5 * 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
  greater_than_10gb: {
    min: 10 * 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
  greater_than_20gb: {
    min: 20 * 1024 * 1024 * 1024,
    max: FILE_SIZE_FILTER_ABSOLUTE_MAX_BYTES,
  },
};

function getFileSizeFilterBounds(prefs) {
  if (
    typeof prefs.fileSizeMinBytes === "number" &&
    typeof prefs.fileSizeMaxBytes === "number"
  ) {
    return {
      min: prefs.fileSizeMinBytes,
      max: prefs.fileSizeMaxBytes,
    };
  }

  const legacy = LEGACY_FILE_SIZE_RANGE_MAP[prefs.fileSizeRange];
  if (legacy) return legacy;

  return {
    min: FILE_SIZE_FILTER_DEFAULT_MIN_BYTES,
    max: FILE_SIZE_FILTER_DEFAULT_MAX_BYTES,
  };
}

function isInFileSizeFilterRange(sizeInBytes, prefs) {
  const { min, max } = getFileSizeFilterBounds(prefs);
  return sizeInBytes >= min && sizeInBytes <= max;
}

function getActiveFilterLabels(prefs) {
  const labels = [];
  if (prefs.hideDeadTorrents) labels.push("dead torrents");
  if (prefs.keywordFilterEnabled && prefs.keywords.length > 0) {
    labels.push("blocked keywords");
  }
  if (prefs.fileSizeFilterEnabled) labels.push("file size");
  if (prefs.completedDownloadsFilterEnabled) labels.push("completed downloads");
  return labels;
}

function formatFilterHiddenNotificationMessage(hiddenCount, activeFilterLabels) {
  const torrentWord = hiddenCount === 1 ? "torrent" : "torrents";
  if (activeFilterLabels.length === 1) {
    return `Hid ${hiddenCount} ${torrentWord} matching your ${activeFilterLabels[0]} filter`;
  }
  if (activeFilterLabels.length > 1) {
    return `Hid ${hiddenCount} ${torrentWord} matching your filters (${activeFilterLabels.join(", ")})`;
  }
  return `Hid ${hiddenCount} ${torrentWord} matching your active filters`;
}

function shouldHideRowByFilters(row, prefs) {
  const title = getTitleFromRow(row);
  const sizeCell = row.querySelector("td:nth-of-type(4)");
  const seedersCell = row.querySelector("td:nth-of-type(6)");
  const leechersCell = row.querySelector("td:nth-of-type(7)");

  const seeders = seedersCell ? parseInt(seedersCell.textContent, 10) || 0 : 0;
  const leechers = leechersCell ? parseInt(leechersCell.textContent, 10) || 0 : 0;
  const sizeInBytes = sizeCell ? convertToBytes(sizeCell.textContent) : 0;

  if (prefs.hideDeadTorrents && seeders === 0 && leechers === 0) {
    return true;
  }

  if (
    prefs.keywordFilterEnabled &&
    prefs.keywords.some((keyword) =>
      title?.toLowerCase().includes(keyword.toLowerCase()),
    )
  ) {
    return true;
  }

  if (
    prefs.fileSizeFilterEnabled &&
    !isInFileSizeFilterRange(sizeInBytes, prefs)
  ) {
    return true;
  }

  if (
    isNyaaTorrentListPage() &&
    failsCompletedDownloadsFilter(prefs, getCompletedDownloadsFromRow(row))
  ) {
    return true;
  }

  return false;
}

async function applyAllTorrentFilters({ notify = false } = {}) {
  const tableBody = document.querySelector("table.torrent-list tbody");
  if (!tableBody) return { newlyHidden: 0, totalHidden: 0 };

  const prefs = await loadStoredPreferences();
  const rows = tableBody.querySelectorAll("tr");
  let newlyHidden = 0;
  let totalHidden = 0;

  rows.forEach((row) => {
    const wasVisible = row.style.display !== "none";
    const shouldHide = shouldHideRowByFilters(row, prefs);

    row.style.display = shouldHide ? "none" : "";

    if (shouldHide) {
      totalHidden++;
      if (wasVisible) newlyHidden++;
    }
  });

  if (notify && prefs.showFilterNotifications && newlyHidden > 0) {
    showNotification(
      formatFilterHiddenNotificationMessage(
        newlyHidden,
        getActiveFilterLabels(prefs),
      ),
      true,
    );
  }

  return { newlyHidden, totalHidden };
}

async function filterByCompletedDownloads() {
  await applyAllTorrentFilters({ notify: true });
}

async function filterByFileSize() {
  await applyAllTorrentFilters({ notify: true });
}

function hasTorrentListTable() {
  return !!document.querySelector("table.torrent-list");
}

const NE_FILTER_FILE_SIZE_SLIDER_MAX_MB = 51200;
const NE_FILTER_FILE_SIZE_ABSOLUTE_MAX_BYTES =
  NE_FILTER_FILE_SIZE_SLIDER_MAX_MB * 1024 * 1024;
const NE_FILTER_FILE_SIZE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];
const NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
  TiB: 1024 * 1024 * 1024 * 1024,
};

let neFilterFileSizeInputDebounceTimer = null;

function neFormatFileSizeDisplayValue(value, unit) {
  if (unit === "B") return String(Math.round(value));
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 100) / 100);
}

function neBytesToDisplayValue(bytes, preferredUnit) {
  if (
    preferredUnit &&
    NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit] !== undefined
  ) {
    const value = bytes / NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS[preferredUnit];
    return {
      value: neFormatFileSizeDisplayValue(value, preferredUnit),
      unit: preferredUnit,
    };
  }

  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < NE_FILTER_FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const unit = NE_FILTER_FILE_SIZE_UNITS[unitIndex];
  return {
    value: neFormatFileSizeDisplayValue(value, unit),
    unit,
  };
}

function neDisplayValueToBytes(value, unit) {
  const num = parseFloat(value);
  const multiplier = NE_FILTER_FILE_SIZE_UNIT_MULTIPLIERS[unit];
  if (!Number.isFinite(num) || num < 0 || multiplier === undefined) return 0;
  return Math.round(num * multiplier);
}

function neClampFileSizeBounds(minBytes, maxBytes) {
  let min = Math.max(
    0,
    Math.min(minBytes, NE_FILTER_FILE_SIZE_ABSOLUTE_MAX_BYTES),
  );
  let max = Math.max(
    0,
    Math.min(maxBytes, NE_FILTER_FILE_SIZE_ABSOLUTE_MAX_BYTES),
  );
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

function neBytesToSliderMb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

function neSliderMbToBytes(mb) {
  return mb * 1024 * 1024;
}

function neFormatFileSizeRangeSummary(minBytes, maxBytes) {
  const minDisp = neBytesToDisplayValue(minBytes);
  const maxDisp = neBytesToDisplayValue(maxBytes);
  return `${minDisp.value} ${minDisp.unit} – ${maxDisp.value} ${maxDisp.unit}`;
}

function neUpdateFileSizeRangeFill() {
  const minSlider = document.getElementById("ne-fileSizeMinSlider");
  const maxSlider = document.getElementById("ne-fileSizeMaxSlider");
  const fill = document.getElementById("ne-fileSizeRangeFill");
  if (!minSlider || !maxSlider || !fill) return;

  const minVal = parseInt(minSlider.value, 10);
  const maxVal = parseInt(maxSlider.value, 10);
  const minPercent = (minVal / NE_FILTER_FILE_SIZE_SLIDER_MAX_MB) * 100;
  const maxPercent = (maxVal / NE_FILTER_FILE_SIZE_SLIDER_MAX_MB) * 100;
  fill.style.left = `${minPercent}%`;
  fill.style.width = `${maxPercent - minPercent}%`;
}

function neReadFileSizeBoundsFromControls() {
  const minInput = document.getElementById("ne-fileSizeMinInput");
  const maxInput = document.getElementById("ne-fileSizeMaxInput");
  const minUnit = document.getElementById("ne-fileSizeMinUnit").value;
  const maxUnit = document.getElementById("ne-fileSizeMaxUnit").value;
  const minBytes = neDisplayValueToBytes(minInput.value, minUnit);
  const maxBytes = neDisplayValueToBytes(maxInput.value, maxUnit);
  return neClampFileSizeBounds(minBytes, maxBytes);
}

function neSyncFileSizeControlsFromBounds(
  minBytes,
  maxBytes,
  { updateStorage = false } = {},
) {
  const bounds = neClampFileSizeBounds(minBytes, maxBytes);
  const minUnitSelect = document.getElementById("ne-fileSizeMinUnit");
  const maxUnitSelect = document.getElementById("ne-fileSizeMaxUnit");
  const minDisp = neBytesToDisplayValue(bounds.min, minUnitSelect.value);
  const maxDisp = neBytesToDisplayValue(bounds.max, maxUnitSelect.value);

  document.getElementById("ne-fileSizeMinInput").value = String(minDisp.value);
  minUnitSelect.value = minDisp.unit;
  document.getElementById("ne-fileSizeMaxInput").value = String(maxDisp.value);
  maxUnitSelect.value = maxDisp.unit;
  document.getElementById("ne-fileSizeMinSlider").value = String(
    neBytesToSliderMb(bounds.min),
  );
  document.getElementById("ne-fileSizeMaxSlider").value = String(
    neBytesToSliderMb(bounds.max),
  );
  document.getElementById("ne-fileSizeRangeSummary").textContent =
    neFormatFileSizeRangeSummary(bounds.min, bounds.max);
  neUpdateFileSizeRangeFill();

  if (updateStorage) {
    chrome.storage.sync.set({
      fileSizeMinBytes: bounds.min,
      fileSizeMaxBytes: bounds.max,
    });
    handleSettingChange("fileSizeMinBytes", bounds.min);
    handleSettingChange("fileSizeMaxBytes", bounds.max);
  }
}

function neSetFileSizeRangeControlsEnabled(enabled) {
  const container = document.getElementById("ne-fileSizeRangeContainer");
  if (!container) return;
  container.querySelectorAll("input, select").forEach((el) => {
    el.disabled = !enabled;
  });
  container.classList.toggle("disabled", !enabled);
}

function neSetCompletedDownloadsControlsEnabled(enabled) {
  const operatorSelect = document.getElementById(
    "ne-completedDownloadsOperator",
  );
  const valueInput = document.getElementById("ne-completedDownloadsValue");
  if (operatorSelect) operatorSelect.disabled = !enabled;
  if (valueInput) valueInput.disabled = !enabled;
}

function neSetFilterToggleState(toggleId, enabled) {
  const toggle = document.querySelector(
    `.ne-filters-panel [data-ne-toggle="${toggleId}"]`,
  );
  if (toggle) toggle.setAttribute("aria-checked", String(enabled));
}

function neCountActiveFilters(prefs) {
  let count = 0;
  if (prefs.hideDeadTorrents) count++;
  if (prefs.keywordFilterEnabled) count++;
  if (prefs.fileSizeFilterEnabled) count++;
  if (prefs.completedDownloadsFilterEnabled) count++;
  return count;
}

function neUpdateActiveFilterBadge(prefs) {
  const badge = document.querySelector(".ne-filters-panel__badge");
  if (!badge) return;
  const count = neCountActiveFilters(prefs);
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

async function neSaveFilterSetting(key, value) {
  await new Promise((resolve) =>
    chrome.storage.sync.set({ [key]: value }, resolve),
  );
  await handleSettingChange(key, value);
  const prefs = await loadStoredPreferences();
  neUpdateActiveFilterBadge(prefs);
}

function neDisplayFilterKeywords(keywords) {
  const keywordsList = document.getElementById("ne-keywords-list");
  if (!keywordsList) return;
  keywordsList.innerHTML = "";

  if (!keywords.length) {
    const empty = document.createElement("p");
    empty.className = "ne-filters-panel__empty-keywords";
    empty.textContent = "No keywords added yet.";
    keywordsList.appendChild(empty);
    return;
  }

  keywords.forEach((keyword) => {
    const item = document.createElement("div");
    item.className = "ne-filters-panel__keyword-item";
    item.innerHTML = `
      <span class="ne-filters-panel__keyword-text"></span>
      <button type="button" class="ne-filters-panel__keyword-remove" title="Remove keyword">×</button>
    `;
    item.querySelector(".ne-filters-panel__keyword-text").textContent = keyword;
    item
      .querySelector(".ne-filters-panel__keyword-remove")
      .addEventListener("click", () => neRemoveFilterKeyword(keyword));
    keywordsList.appendChild(item);
  });
}

async function neAddFilterKeyword() {
  const input = document.getElementById("ne-keyword-input");
  const keyword = input.value.trim();
  if (!keyword) return;

  const prefs = await loadStoredPreferences();
  if (prefs.keywords.includes(keyword)) {
    input.value = "";
    return;
  }

  const keywords = [...prefs.keywords, keyword];
  await new Promise((resolve) =>
    chrome.storage.sync.set({ keywords }, resolve),
  );
  input.value = "";
  neDisplayFilterKeywords(keywords);
  await applyAllTorrentFilters({ notify: true });
}

async function neRemoveFilterKeyword(keywordToRemove) {
  const prefs = await loadStoredPreferences();
  const keywords = prefs.keywords.filter((k) => k !== keywordToRemove);
  await new Promise((resolve) =>
    chrome.storage.sync.set({ keywords }, resolve),
  );
  neDisplayFilterKeywords(keywords);
  await applyAllTorrentFilters({ notify: true });
}

async function neRemoveAllFilterKeywords() {
  await new Promise((resolve) =>
    chrome.storage.sync.set({ keywords: [] }, resolve),
  );
  neDisplayFilterKeywords([]);
  await applyAllTorrentFilters({ notify: true });
}

function neInitFileSizeRangeControls(prefs) {
  const bounds = getFileSizeFilterBounds(prefs);
  if (
    typeof prefs.fileSizeMinBytes !== "number" ||
    typeof prefs.fileSizeMaxBytes !== "number"
  ) {
    chrome.storage.sync.set({
      fileSizeMinBytes: bounds.min,
      fileSizeMaxBytes: bounds.max,
    });
  }
  neSyncFileSizeControlsFromBounds(bounds.min, bounds.max);
  neSetFileSizeRangeControlsEnabled(prefs.fileSizeFilterEnabled);
}

function nePersistFileSizeBoundsFromControls() {
  const bounds = neReadFileSizeBoundsFromControls();
  neSyncFileSizeControlsFromBounds(bounds.min, bounds.max, {
    updateStorage: true,
  });
}

function neScheduleFileSizePersistFromControls() {
  clearTimeout(neFilterFileSizeInputDebounceTimer);
  neFilterFileSizeInputDebounceTimer = setTimeout(() => {
    nePersistFileSizeBoundsFromControls();
  }, 250);
}

function neHandleFileSizeSliderInput(isMinSlider) {
  const minSlider = document.getElementById("ne-fileSizeMinSlider");
  const maxSlider = document.getElementById("ne-fileSizeMaxSlider");
  let minMb = parseInt(minSlider.value, 10);
  let maxMb = parseInt(maxSlider.value, 10);

  if (isMinSlider && minMb > maxMb) {
    minMb = maxMb;
    minSlider.value = String(minMb);
  } else if (!isMinSlider && maxMb < minMb) {
    maxMb = minMb;
    maxSlider.value = String(maxMb);
  }

  neSyncFileSizeControlsFromBounds(
    neSliderMbToBytes(minMb),
    neSliderMbToBytes(maxMb),
  );
}

function neHandleFileSizeSliderCommit(isMinSlider) {
  const minSlider = document.getElementById("ne-fileSizeMinSlider");
  const maxSlider = document.getElementById("ne-fileSizeMaxSlider");
  let minMb = parseInt(minSlider.value, 10);
  let maxMb = parseInt(maxSlider.value, 10);

  if (isMinSlider && minMb > maxMb) {
    minMb = maxMb;
    minSlider.value = String(minMb);
  } else if (!isMinSlider && maxMb < minMb) {
    maxMb = minMb;
    maxSlider.value = String(maxMb);
  }

  neSyncFileSizeControlsFromBounds(
    neSliderMbToBytes(minMb),
    neSliderMbToBytes(maxMb),
    { updateStorage: true },
  );
}

function neWireFilterToggle(toggleId, settingKey, onChange) {
  const toggle = document.querySelector(
    `.ne-filters-panel [data-ne-toggle="${toggleId}"]`,
  );
  if (!toggle) return;

  toggle.addEventListener("click", async () => {
    const newState = toggle.getAttribute("aria-checked") !== "true";
    toggle.setAttribute("aria-checked", String(newState));
    if (onChange) onChange(newState);
    await neSaveFilterSetting(settingKey, newState);
  });
}

function neSetFiltersPanelExpanded(expanded) {
  const panel = document.querySelector(".ne-filters-panel");
  const body = document.querySelector(".ne-filters-panel__body");
  const header = document.querySelector(".ne-filters-panel__header");
  if (!panel || !body || !header) return;

  panel.classList.toggle("ne-filters-panel--expanded", expanded);
  header.setAttribute("aria-expanded", String(expanded));
  body.hidden = !expanded;
}

async function neSyncFiltersPanelFromPrefs(prefs) {
  neSetFilterToggleState("hideDeadTorrents", prefs.hideDeadTorrents);
  neSetFilterToggleState("keywordFilter", prefs.keywordFilterEnabled);
  neSetFilterToggleState("fileSizeFilter", prefs.fileSizeFilterEnabled);
  neSetFilterToggleState(
    "completedDownloadsFilter",
    prefs.completedDownloadsFilterEnabled,
  );

  neDisplayFilterKeywords(prefs.keywords);
  neInitFileSizeRangeControls(prefs);

  const operatorSelect = document.getElementById("ne-completedDownloadsOperator");
  const valueInput = document.getElementById("ne-completedDownloadsValue");
  if (operatorSelect) {
    operatorSelect.value = prefs.completedDownloadsFilterOperator || "gt";
  }
  if (valueInput) {
    valueInput.value = String(prefs.completedDownloadsFilterValue ?? 0);
  }
  neSetCompletedDownloadsControlsEnabled(
    prefs.completedDownloadsFilterEnabled,
  );
  neUpdateActiveFilterBadge(prefs);
}

async function addFiltersPanel() {
  if (!hasTorrentListTable()) return;
  if (document.querySelector(".ne-filters-panel")) return;

  const tableResponsive = document.querySelector(
    ".table-responsive:has(table.torrent-list)",
  );
  if (!tableResponsive) return;

  const prefs = await loadStoredPreferences();

  const panel = document.createElement("div");
  panel.className = "ne-filters-panel";
  panel.innerHTML = `
    <button type="button" class="ne-filters-panel__header" aria-expanded="false">
      <span class="ne-filters-panel__title"><i class="fa fa-filter" aria-hidden="true"></i> Filters</span>
      <span class="ne-filters-panel__badge" hidden>0</span>
      <span class="ne-filters-panel__chevron" aria-hidden="true"></span>
    </button>
    <div class="ne-filters-panel__body" hidden>
      <div class="ne-filters-panel__toggles">
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Hide dead torrents (0 S/L)</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="hideDeadTorrents" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Enable keyword filtering</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="keywordFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Filter by file size</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="fileSizeFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
        <div class="ne-filters-panel__toggle-item">
          <span class="ne-filters-panel__toggle-label">Filter completed downloads</span>
          <button type="button" class="ne-filters-panel__toggle" data-ne-toggle="completedDownloadsFilter" role="switch" aria-checked="false">
            <span class="ne-filters-panel__toggle-indicator"></span>
          </button>
        </div>
      </div>

      <div class="ne-filters-panel__section">
        <h4 class="ne-filters-panel__section-title">Blocked keywords</h4>
        <p class="ne-filters-panel__section-desc">Torrents with these words in their title will be hidden when keyword filtering is enabled.</p>
        <div class="ne-filters-panel__keyword-input-row">
          <input type="text" id="ne-keyword-input" class="ne-filters-panel__keyword-input" placeholder="Enter keyword to filter" />
          <button type="button" id="ne-add-keyword" class="ne-filters-panel__keyword-add">Add</button>
        </div>
        <div class="ne-filters-panel__keyword-actions">
          <button type="button" id="ne-remove-all-keywords" class="ne-filters-panel__keyword-remove-all">Remove all</button>
        </div>
        <div id="ne-keywords-list" class="ne-filters-panel__keywords-list"></div>
      </div>

      <div class="ne-filters-panel__section" id="ne-fileSizeRangeContainer">
        <h4 class="ne-filters-panel__section-title">File size range</h4>
        <div class="ne-filters-panel__file-size-inputs">
          <div class="ne-filters-panel__file-size-field">
            <label for="ne-fileSizeMinInput">Minimum</label>
            <div class="ne-filters-panel__file-size-value-row">
              <input type="number" id="ne-fileSizeMinInput" min="0" step="any" disabled />
              <select id="ne-fileSizeMinUnit" disabled>
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB" selected>MiB</option>
                <option value="GiB">GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
          <div class="ne-filters-panel__file-size-field">
            <label for="ne-fileSizeMaxInput">Maximum</label>
            <div class="ne-filters-panel__file-size-value-row">
              <input type="number" id="ne-fileSizeMaxInput" min="0" step="any" disabled />
              <select id="ne-fileSizeMaxUnit" disabled>
                <option value="B">B</option>
                <option value="KiB">KiB</option>
                <option value="MiB">MiB</option>
                <option value="GiB" selected>GiB</option>
                <option value="TiB">TiB</option>
              </select>
            </div>
          </div>
        </div>
        <div class="ne-filters-panel__file-size-slider">
          <div class="ne-filters-panel__file-size-track">
            <div class="ne-filters-panel__file-size-fill" id="ne-fileSizeRangeFill"></div>
          </div>
          <input type="range" id="ne-fileSizeMinSlider" min="0" max="${NE_FILTER_FILE_SIZE_SLIDER_MAX_MB}" step="1" disabled />
          <input type="range" id="ne-fileSizeMaxSlider" min="0" max="${NE_FILTER_FILE_SIZE_SLIDER_MAX_MB}" step="1" disabled />
        </div>
        <div class="ne-filters-panel__file-size-summary" id="ne-fileSizeRangeSummary"></div>
      </div>

      <div class="ne-filters-panel__section ne-filters-panel__completed-section">
        <h4 class="ne-filters-panel__section-title">Completed downloads threshold</h4>
        <div class="ne-filters-panel__completed-row">
          <select id="ne-completedDownloadsOperator" disabled>
            <option value="gt">Greater than</option>
            <option value="eq">Equal to</option>
            <option value="lt">Less than</option>
          </select>
          <input type="number" id="ne-completedDownloadsValue" min="0" step="1" placeholder="Count" disabled />
        </div>
      </div>
    </div>
  `;

  tableResponsive.parentNode.insertBefore(panel, tableResponsive);
  await neSyncFiltersPanelFromPrefs(prefs);

  panel.querySelector(".ne-filters-panel__header").addEventListener(
    "click",
    () => {
      const isExpanded = panel.classList.contains("ne-filters-panel--expanded");
      neSetFiltersPanelExpanded(!isExpanded);
    },
  );

  neWireFilterToggle("hideDeadTorrents", "hideDeadTorrents");
  neWireFilterToggle("keywordFilter", "keywordFilterEnabled");
  neWireFilterToggle("fileSizeFilter", "fileSizeFilterEnabled", (enabled) => {
    neSetFileSizeRangeControlsEnabled(enabled);
  });
  neWireFilterToggle(
    "completedDownloadsFilter",
    "completedDownloadsFilterEnabled",
    (enabled) => {
      neSetCompletedDownloadsControlsEnabled(enabled);
    },
  );

  document
    .getElementById("ne-add-keyword")
    .addEventListener("click", neAddFilterKeyword);
  document.getElementById("ne-keyword-input").addEventListener(
    "keypress",
    (e) => {
      if (e.key === "Enter") neAddFilterKeyword();
    },
  );
  document
    .getElementById("ne-remove-all-keywords")
    .addEventListener("click", neRemoveAllFilterKeywords);

  document
    .getElementById("ne-fileSizeMinSlider")
    .addEventListener("input", () => neHandleFileSizeSliderInput(true));
  document
    .getElementById("ne-fileSizeMinSlider")
    .addEventListener("change", () => neHandleFileSizeSliderCommit(true));
  document
    .getElementById("ne-fileSizeMaxSlider")
    .addEventListener("input", () => neHandleFileSizeSliderInput(false));
  document
    .getElementById("ne-fileSizeMaxSlider")
    .addEventListener("change", () => neHandleFileSizeSliderCommit(false));

  ["ne-fileSizeMinInput", "ne-fileSizeMaxInput"].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("input", neScheduleFileSizePersistFromControls);
    input.addEventListener("change", () => {
      clearTimeout(neFilterFileSizeInputDebounceTimer);
      nePersistFileSizeBoundsFromControls();
    });
  });

  ["ne-fileSizeMinUnit", "ne-fileSizeMaxUnit"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      nePersistFileSizeBoundsFromControls();
    });
  });

  document
    .getElementById("ne-completedDownloadsOperator")
    .addEventListener("change", async (e) => {
      const newValue = e.target.value;
      await neSaveFilterSetting("completedDownloadsFilterOperator", newValue);
    });

  document
    .getElementById("ne-completedDownloadsValue")
    .addEventListener("change", async (e) => {
      const parsed = parseInt(e.target.value, 10);
      const newValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      e.target.value = String(newValue);
      await neSaveFilterSetting("completedDownloadsFilterValue", newValue);
    });
}

async function syncFiltersPanelUI(setting, value) {
  const panel = document.querySelector(".ne-filters-panel");
  if (!panel) return;

  const prefs = await loadStoredPreferences();

  switch (setting) {
    case "hideDeadTorrents":
      neSetFilterToggleState("hideDeadTorrents", value);
      break;
    case "keywordFilterEnabled":
      neSetFilterToggleState("keywordFilter", value);
      break;
    case "fileSizeFilterEnabled":
      neSetFilterToggleState("fileSizeFilter", value);
      neSetFileSizeRangeControlsEnabled(value);
      break;
    case "completedDownloadsFilterEnabled":
      neSetFilterToggleState("completedDownloadsFilter", value);
      neSetCompletedDownloadsControlsEnabled(value);
      break;
    case "fileSizeMinBytes":
    case "fileSizeMaxBytes":
      neSyncFileSizeControlsFromBounds(
        prefs.fileSizeMinBytes,
        prefs.fileSizeMaxBytes,
      );
      break;
    case "completedDownloadsFilterOperator":
      const operatorSelect = document.getElementById(
        "ne-completedDownloadsOperator",
      );
      if (operatorSelect) operatorSelect.value = value;
      break;
    case "completedDownloadsFilterValue":
      const valueInput = document.getElementById("ne-completedDownloadsValue");
      if (valueInput) valueInput.value = String(value ?? 0);
      break;
    case "keywords":
      neDisplayFilterKeywords(value);
      break;
  }

  neUpdateActiveFilterBadge(prefs);
}

function showKeywordMonitorPopup() {
  const popup = document.createElement("div");
  popup.className = "quick-filter-popup"; // Reuse existing popup styles
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    min-width: 320px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const content = `
    <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Keyword Monitor</h3>
    
    <div class="filter-group" style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500;">Enter Keyword to Monitor:</label>
      <input type="text" id="keyword-monitor-input" class="filter-input" style="
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
      ">
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button id="cancel-monitor" class="copy-magnets-button" style="
        padding: 8px 16px;
        border: none;
        background: #337ab7;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      ">Cancel</button>
      <button id="apply-monitor" class="copy-magnets-button" style="
        padding: 8px 16px;
        border: none;
        background: #337ab7;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      ">Add Monitor</button>
    </div>
  `;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "quick-filter-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  `;

  popup.innerHTML = content;
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  document.body.style.overflow = "hidden";

  // Add hover effects and animations for inputs and buttons
  const style = document.createElement("style");
  style.textContent = `
    .quick-filter-popup {
      animation: popupFadeIn 0.3s ease;
    }

    .quick-filter-overlay {
      animation: overlayFadeIn 0.3s ease;
    }

    @keyframes popupFadeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .quick-filter-popup.hiding {
      animation: popupFadeOut 0.3s ease;
    }

    .quick-filter-overlay.hiding {
      animation: overlayFadeOut 0.3s ease;
    }

    @keyframes popupFadeOut {
      from {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      to {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.96);
      }
    }

    @keyframes overlayFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .quick-filter-popup input:focus {
      outline: none;
      border-color: #337ab7;
      box-shadow: 0 0 0 3px rgba(51, 122, 183, 0.1);
    }
    .quick-filter-popup input:hover {
      border-color: #337ab7;
    }
    #cancel-select:hover,
    #apply-select:hover {
      background-color: #286090;
    }
  `;
  document.head.appendChild(style);

  // Add dark mode styles if needed
  if (document.body.classList.contains("dark")) {
    popup.style.background = "#34353b";
    popup.style.color = "#ffffff";
    const input = popup.querySelector("input");
    input.style.background = "#232327";
    input.style.color = "#ffffff";
    input.style.border = "1px solid #666";
  }

  // Handle Enter key
  document
    .getElementById("keyword-monitor-input")
    .addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("apply-monitor").click();
      }
    });

  // Focus the input field
  setTimeout(() => {
    document.getElementById("keyword-monitor-input").focus();
  }, 100);

  // Handle selection
  document
    .getElementById("apply-monitor")
    .addEventListener("click", async () => {
      const keyword = document
        .getElementById("keyword-monitor-input")
        .value.trim();
      if (keyword) {
        // Get the latest torrent ID from the search page
        const latestTorrentId = await getLatestTorrentIdForKeyword(keyword);

        // Add the keyword to monitoring with the correct torrent ID
        await addKeywordMonitoring(keyword, latestTorrentId);

        // Close the popup
        closePopup();

        // Show confirmation
        showNotification(`Added "${keyword}" to keyword monitoring`);
      } else {
        showNotification("Please enter a keyword to monitor", false);
        return;
      }
    });

  // Handle cancel and close
  const closePopup = () => {
    popup.classList.add("hiding");
    overlay.classList.add("hiding");
    document.body.style.overflow = "";

    // Wait for animations to finish before removing elements
    popup.addEventListener(
      "animationend",
      () => {
        popup.remove();
      },
      { once: true },
    );

    overlay.addEventListener(
      "animationend",
      () => {
        overlay.remove();
      },
      { once: true },
    );
  };

  document
    .getElementById("cancel-monitor")
    .addEventListener("click", closePopup);
  overlay.addEventListener("click", closePopup);
}

function showKeywordSelectPopup() {
  const popup = document.createElement("div");
  popup.className = "quick-filter-popup"; // Reuse existing popup styles
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    min-width: 320px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const content = `
    <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Keyword Select</h3>
    
    <div class="filter-group" style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500;">Enter Keyword:</label>
      <input type="text" id="keyword-select-input" class="filter-input" style="
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
      ">
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button id="cancel-select" class="copy-magnets-button" style="
        padding: 8px 16px;
        border: none;
        background: #337ab7;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      ">Cancel</button>
      <button id="apply-select" class="copy-magnets-button" style="
        padding: 8px 16px;
        border: none;
        background: #337ab7;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      ">Select</button>
    </div>
  `;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "quick-filter-overlay"; // Changed from "popup-overlay"
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  `;

  popup.innerHTML = content;
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  document.body.style.overflow = "hidden";

  // Add hover effects and animations for inputs and buttons
  const style = document.createElement("style");
  style.textContent = `
    .quick-filter-popup {
      animation: popupFadeIn 0.3s ease;
    }

    .quick-filter-overlay {
      animation: overlayFadeIn 0.3s ease;
    }

    @keyframes popupFadeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .quick-filter-popup.hiding {
      animation: popupFadeOut 0.3s ease;
    }

    .quick-filter-overlay.hiding {
      animation: overlayFadeOut 0.3s ease;
    }

    @keyframes popupFadeOut {
      from {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      to {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.96);
      }
    }

    @keyframes overlayFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .quick-filter-popup input:focus {
      outline: none;
      border-color: #337ab7;
      box-shadow: 0 0 0 3px rgba(51, 122, 183, 0.1);
    }
    .quick-filter-popup input:hover {
      border-color: #337ab7;
    }
    #cancel-select:hover,
    #apply-select:hover {
      background-color: #286090;
    }
  `;
  document.head.appendChild(style);

  // Add dark mode styles if needed
  if (document.body.classList.contains("dark")) {
    popup.style.background = "#34353b";
    popup.style.color = "#ffffff";
    const input = popup.querySelector("input");
    input.style.background = "#232327";
    input.style.color = "#ffffff";
    input.style.border = "1px solid #666";
  }

  // Handle Enter key
  document
    .getElementById("keyword-select-input")
    .addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("apply-select").click();
      }
    });

  // Handle selection
  document.getElementById("apply-select").addEventListener("click", () => {
    const keyword = document
      .getElementById("keyword-select-input")
      .value.trim()
      .toLowerCase();
    if (!keyword) {
      showNotification("Please enter a keyword to select", false);
      return;
    }

    const rows = document.querySelectorAll("table.torrent-list tbody tr");
    let matchCount = 0;

    rows.forEach((row) => {
      const title = getTitleFromRow(row);
      const checkbox = row.querySelector(".magnet-checkbox");

      if (title && checkbox && title.toLowerCase().includes(keyword)) {
        checkbox.checked = true;
        matchCount++;
      }
    });

    if (matchCount > 0) {
      showNotification(
        `Selected ${matchCount} torrent${
          matchCount === 1 ? "" : "s"
        } matching "${keyword}"`,
        true,
      );
      // Update selection counter if it exists
      const counter = document.querySelector(".magnet-selection-counter");
      if (counter) {
        const totalChecked = document.querySelectorAll(
          ".magnet-checkbox:checked",
        ).length;
        updateSelectionCounterDisplay(counter, totalChecked);
      }
    } else {
      showNotification(`No torrents found matching "${keyword}"`, false);
    }

    closePopup();
  });

  // Handle cancel and close
  const closePopup = () => {
    popup.classList.add("hiding");
    overlay.classList.add("hiding");
    document.body.style.overflow = "";

    // Wait for animations to finish before removing elements
    popup.addEventListener(
      "animationend",
      () => {
        popup.remove();
      },
      { once: true },
    );

    overlay.addEventListener(
      "animationend",
      () => {
        overlay.remove();
      },
      { once: true },
    );
  };

  document
    .getElementById("cancel-select")
    .addEventListener("click", closePopup);
  overlay.addEventListener("click", closePopup);
}

async function handleChangelogPage() {
  // Only run on the changelog page
  if (window.location.pathname !== "/changelog") return;

  // Get the main container element (where the 404 message is)
  const mainContainer = document.querySelector(".container h1")?.parentElement;
  if (!mainContainer) return;

  // Update page title
  document.title = "Changelog :: Nyaa";

  // Clear the 404 content
  mainContainer.innerHTML = "";

  // Add changelog content
  const changelogContent = document.createElement("div");
  changelogContent.className = "changelog-page";
  changelogContent.innerHTML = `
    <h1>Nyaa Enhancer Changelog</h1>
    <div class="changelog-repo">
      <p>This is an open source project. View the source code and contribute on 
        <a href="https://github.com/Arad119/Nyaa-Enhancer" target="_blank" class="repo-link">
          <i class="fa fa-github"></i> GitHub
        </a>
      </p>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.12.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.12.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added qBittorrent category and tag support when sending torrents, configure defaults in settings or pick per torrent via the "Prompt on Send" popup</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.12.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.12.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where the "Filter completed downloads" option did not apply on user profile pages</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.12.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.12.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added tabbed panels on torrent view pages - Description plus optional ameNZB, nekoBT, Tsukihime, and AnimeTosho tabs</li>
        <li>Added "Improved File List" toggle to show total and per-folder file counts on view pages (Enabled by default)</li>
        <li>Added "Completed downloads" as a filter option</li>
        <li>Improved AnimeTosho list and view links - resolved by using info hash for English-translated, Non-English-translated, and Raw anime</li>
        <li>Added "Show Screenshots Section", "Show FileInfo Section", and "Show Attachments Section" toggles from AnimeTosho data</li>
        <li>Added "Display ameNZB Section" toggle for release details in the description tabs - requires an ameNZB API key (Disabled by default)</li>
        <li>Added "Display nekoBT Section" toggle for release metadata in the description tabs, plus "Full Language Names" for audio/subtitle labels (Disabled by default)</li>
        <li>Added a Tsukihime settings section with "Display Tsukihime Links" and "Display Tsukihime Section" toggles for view-page links and tabbed metadata, synopsis, genres, files, and per-file MediaInfo (Disabled by default)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.11.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.11.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a dedicated "Torrent Client" tab with support for qBittorrent, Transmission, and Deluge - required to use the "Send" button</li>
        <li>Added a "Send" button to torrent view pages and the main torrent list, sending the torrent directly to your configured client - needs a Torrent Client to be configured first in the extension settings</li>
        <li>Added a "Display Best Release (Seadex)" toggle in Additional Features to highlight best and alternate releases on torrent list and view pages according to SeaDex (Disabled by default)</li>
        <li>Added "Screenshot Preview" toggle to the Additional Features section - hovering over a torrent link for the set delay opens a floating image popup that cycles through screenshots from the torrent's description (Disabled by default)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.10.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.10.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a dedicated AnimeTosho settings section with a "New AnimeTosho Domain" toggle to switch links between animetosho.org and animetosho.xyz (Enabled by default due to old one being deprecated)</li>
        <li>Added "Show AnimeTosho Comments" toggle to display AnimeTosho comments on supported English-translated anime view pages</li>
        <li>Added a ameNZB settings section with API key management (API Key required for it to work)</li>
        <li>Added "Display ameNZB Links" toggle to show ameNZB release links on supported view pages</li>
        <li>Added a nekoBT settings section with a "Display nekoBT Links" toggle to show nekoBT links on supported view pages</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.9.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.9.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added "Last 30 Days" date filter to Quick Search to show only recent uploads</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.9.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.9.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a Keyword Monitoring system to track new uploads that has specific keywords</li>
        <li>Added a Show Monitor Buttons setting to control visibility of monitor buttons</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.8.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.8.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed sidebar layout to maintain consistent height during state changes</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.8.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.8.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a User Monitoring system to track new uploads from your favorite contributors</li>
        <li>Monitor button on user pages lets you track when they upload new torrents</li>
        <li>Notification sidebar with updates appears on the left edge of the screen</li>
        <li>Enhanced Monitored Users tab in the extension popup for easy management</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.7.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.7.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where forward slash (/) in filenames would create unwanted subfolders in ZIP downloads</li>
        <li>Fixed potential download issues if some torrent names would have Windows-incompatible characters (like :, *, ?, ", etc.)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.7.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.7.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where the selection counter wasn't updating when using the "Invert Selection" button</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.7.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.7.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added clear explanation of what the keyword filter does</li>
        <li>Added a Keyword Select button to quickly select all torrents with a specific keyword</li>
        <li>Added changelog page to easily see what's new in each version</li>
        <li>Fixed bug where filter-related notifications did not respect the Show Notifications setting</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.6.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.6.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where disabling "Show Button Controls" didn't properly remove checkbox columns</li>
        <li>Fixed bug where re-enabling "Show Button Controls" caused duplicate AT and Magnet columns</li>
      </ul>
    </div>
      <div class="version-entry">
      <h2>
        Version 1.6.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.6.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added organized categories in settings menu for easier navigation</li>
        <li>Added new filtering options:</li>
        <ul>
          <li>Hide dead torrents (0 Seeders & 0 Leechers)</li>
          <li>Filter torrents by keywords</li>
          <li>Filter torrents by file size</li>
        </ul>
        <li>Added new view page features:</li>
        <ul>
          <li>Copy Magnet button on torrent pages</li>
          <li>Option to hide comments</li>
        </ul>
        <li>Removed support for nyaa.eu domain due to compatibility issues</li>
        <li>Renamed Quick Filter to Quick Search</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.5.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.5.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Quick Filter feature to easily search for specific anime, encoders, quality, format, and source</li>
        <li>Added Invert Selection button</li>
        <li>Added ability to select everything in between two checkboxes (Shift+Click)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.4.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.4.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Removed unnecessary downloads permission to improve security and privacy</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.4.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.4.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added rate limiting (500ms delay) between torrent downloads when using ZIP option to prevent HTTP 429 errors (Too Many Requests sent in a given amount of time)</li>
        <li>Fixed bug where torrent files would incorrectly use comment count as filename</li>
        <li>Fixed bug where not all torrent files would get downloaded when using ZIP option</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.4.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.4.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Animetosho links column for supported torrents (English-translated anime)</li>
        <li>Added Animetosho link to view page for supported torrents</li>
        <li>Added magnet copy buttons column with one-click copying</li>
        <li>Added toggles for all features in extension popup</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.3.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.3.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added badge indicator for supported sites</li>
        <li>Moved toggles to the extension popup</li>
        <li>Added changelog notification</li>
        <li>Added changelog toggle in popup settings</li>
        <li>Adjusted styling</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.2.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.2.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Torrent File Downloads:</li>
        <ul>
          <li>Download selected .torrent files directly</li>
          <li>Batch download all torrents on the page</li>
          <li>Combine multiple downloads into a single ZIP file</li>
          <li>Track download progress with visual notifications</li>
        </ul>
        <li>Added Customization Options:</li>
        <ul>
          <li>Choose between original or display names for downloaded torrent files</li>
          <li>Toggle between individual or ZIP downloads</li>
        </ul>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.0.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.0.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Adds checkboxes next to each torrent entry</li>
        <li>"Copy Selected" button to copy only checked magnet links.</li>
        <li>"Copy All" button to copy all magnet links on the page</li>
        <li>"Clear Selection" button to uncheck all boxes</li>
        <li>Selection counter showing number of selected items</li>
        <li>Toast notifications for user feedback</li>
        <li>Support for multiple Nyaa mirror domains</li>
      </ul>
    </div>
  `;

  mainContainer.appendChild(changelogContent);
}

async function addChangelogNavItem() {
  const prefs = await loadStoredPreferences();
  if (!prefs.showChangelogNav) return;

  // Find the navigation list that contains "RSS"
  const navList = document.querySelector(".nav.navbar-nav");
  const rssItem = Array.from(navList?.querySelectorAll("li") || []).find(
    (li) => li.textContent.trim() === "RSS",
  );

  if (navList && rssItem) {
    // Create new changelog list item
    const changelogItem = document.createElement("li");
    const changelogLink = document.createElement("a");
    changelogLink.href = "/changelog";
    changelogLink.textContent = "Changelog";
    changelogItem.appendChild(changelogLink);

    // Insert after the RSS item
    rssItem.insertAdjacentElement("afterend", changelogItem);
  }
}

// Function to handle user monitoring
async function addMonitorButton() {
  // Check if we're on a user page
  if (!window.location.pathname.startsWith("/user/")) return;

  // Get the username from the URL
  const username = window.location.pathname.split("/").pop();
  if (!username) return;

  const prefs = await loadStoredPreferences();

  // If monitor buttons are disabled, don't add the button
  if (!prefs.showMonitorButtons) return;

  // Find the h3 heading with the user information
  const userHeading = document.querySelector("h3");
  if (!userHeading) return;

  // Check for existing Monitor button
  if (userHeading.querySelector(".monitor-button")) return;

  // Find the torrent count in the page heading
  let torrentCount = 0;
  const text = userHeading.textContent.trim();
  const match = text.match(/\((\d+)\)$/);
  if (match && match[1]) {
    torrentCount = parseInt(match[1]);
  }

  // Check if user is already monitored
  const isMonitored = prefs.monitoredUsers.some(
    (user) => user.username === username,
  );

  // Create the "Monitor" button
  const monitorButton = document.createElement("button");
  monitorButton.className = "copy-magnets-button monitor-button";
  monitorButton.style.cssText = `
    margin-right: 10px;
    font-size: 14px;
    padding: 5px 10px;
    line-height: normal;
    height: auto;
    vertical-align: middle;
    display: inline-block;
    font-family: "Segoe UI", Tahoma, sans-serif;
    font-weight: 500;
  `;

  if (isMonitored) {
    monitorButton.innerHTML = '<i class="fa fa-bell-slash"></i> Unmonitor';
    monitorButton.style.backgroundColor = "#f44336";
  } else {
    monitorButton.innerHTML = '<i class="fa fa-bell"></i> Monitor';
  }

  monitorButton.addEventListener("click", async () => {
    const currentPrefs = await loadStoredPreferences();
    const userIndex = currentPrefs.monitoredUsers.findIndex(
      (user) => user.username === username,
    );

    if (userIndex === -1) {
      // Add user to monitored list
      currentPrefs.monitoredUsers.push({
        username: username,
        url: window.location.pathname,
        torrentCount: torrentCount,
        lastChecked: Date.now(),
        lastDismissedCount: torrentCount, // Initialize lastDismissedCount to current count
      });

      monitorButton.innerHTML = '<i class="fa fa-bell-slash"></i> Unmonitor';
      monitorButton.style.backgroundColor = "#f44336";
      showNotification(`Now monitoring ${username} for new uploads`, true);
    } else {
      // Remove user from monitored list
      currentPrefs.monitoredUsers.splice(userIndex, 1);

      monitorButton.innerHTML = '<i class="fa fa-bell"></i> Monitor';
      monitorButton.style.backgroundColor = "";
      showNotification(`Stopped monitoring ${username}`, true);
    }

    // Save updated preferences
    chrome.storage.sync.set({ monitoredUsers: currentPrefs.monitoredUsers });
  });

  // Insert the Monitor button before the heading text
  userHeading.insertBefore(monitorButton, userHeading.firstChild);
}

// Function to add keyword monitoring
// Function to get the latest torrent ID for a keyword
async function getLatestTorrentIdForKeyword(keyword) {
  try {
    // Create search URL for this keyword
    const searchUrl = `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(
      keyword,
    )}`;

    // Fetch the search results page
    const response = await fetch(searchUrl);
    const html = await response.text();

    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Get the first torrent row (latest upload)
    const firstRow = doc.querySelector("table.torrent-list tbody tr");

    if (firstRow) {
      // Extract the torrent ID from the first row
      const torrentLink = firstRow.querySelector("td:nth-child(2) a");
      if (torrentLink && torrentLink.href) {
        const match = torrentLink.href.match(/view\/(\d+)/);
        if (match && match[1]) {
          return match[1]; // Return the torrent ID
        }
      }
    }

    // If no torrent found, return a placeholder value
    return "no_torrents_found";
  } catch (error) {
    console.error("Error fetching latest torrent ID:", error);
    return "fetch_error";
  }
}

async function addKeywordMonitoring(keyword, torrentId) {
  const prefs = await loadStoredPreferences();

  // Initialize monitoredKeywords if it doesn't exist
  if (!prefs.monitoredKeywords) {
    prefs.monitoredKeywords = [];
  }

  // Check if this keyword is already being monitored
  const existingIndex = prefs.monitoredKeywords.findIndex(
    (item) => item.keyword === keyword,
  );

  if (existingIndex !== -1) {
    // Update existing entry
    prefs.monitoredKeywords[existingIndex].lastTorrentId = torrentId;
    showNotification(`Updated monitoring for "${keyword}"`, true);
  } else {
    // Create search URL for this keyword
    const searchUrl = `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(
      keyword,
    )}`;

    // Add new entry
    prefs.monitoredKeywords.push({
      keyword: keyword,
      url: searchUrl,
      lastTorrentId: torrentId,
      lastDismissedTorrentId: torrentId, // Initialize with the current torrent ID
      lastChecked: Date.now(),
    });

    showNotification(`Now monitoring uploads with "${keyword}"`, true);
  }

  // Save updated preferences
  chrome.storage.sync.set({ monitoredKeywords: prefs.monitoredKeywords });
}

// Function to check for new uploads from monitored users when on the homepage
async function checkMonitoredUsers() {
  // Get user preferences
  const prefs = await loadStoredPreferences();

  // Check if we have anything to monitor
  const hasUsers = prefs.monitoredUsers && prefs.monitoredUsers.length > 0;
  const hasKeywords =
    prefs.monitoredKeywords && prefs.monitoredKeywords.length > 0;

  if (!hasUsers && !hasKeywords) return;

  // Create or update the sidebar
  const sidebar = createOrUpdateSidebar();

  // Show loading state
  showSidebarLoadingState(sidebar);

  // Initialize variables
  let updatesFound = false;
  let pendingUpdates = [];
  let updatedUsers = prefs.monitoredUsers || [];
  let keywordPendingUpdates = [];

  // Check for user updates if we have monitored users
  if (hasUsers) {
    const userResults = await checkForUpdates(prefs.monitoredUsers);
    updatesFound = userResults.updatesFound;
    pendingUpdates = userResults.pendingUpdates;
    updatedUsers = userResults.updatedUsers;

    // Save the updated user data
    chrome.storage.sync.set({ monitoredUsers: updatedUsers });
  }

  // Check for keyword updates if we have monitored keywords
  let updatedKeywords = prefs.monitoredKeywords || [];
  if (hasKeywords) {
    const keywordResults = await checkKeywordUpdates(prefs.monitoredKeywords);
    updatesFound = updatesFound || keywordResults.updatesFound;
    keywordPendingUpdates = keywordResults.pendingUpdates;
    updatedKeywords = keywordResults.updatedKeywords;

    // Save the updated keyword data
    if (keywordResults.updatesFound) {
      chrome.storage.sync.set({ monitoredKeywords: updatedKeywords });
    }
  }

  // Update the sidebar content
  updateSidebarContent(
    sidebar,
    updatesFound,
    pendingUpdates,
    updatedUsers,
    keywordPendingUpdates,
    updatedKeywords,
  );
}

// Creates the sidebar if it doesn't exist, or returns the existing one
function createOrUpdateSidebar() {
  let sidebar = document.querySelector(".monitored-users-sidebar");
  let isNewSidebar = false;

  if (!sidebar) {
    isNewSidebar = true;
    sidebar = document.createElement("div");
    sidebar.className = "monitored-users-sidebar";
    sidebar.style.cssText = `
      position: fixed;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 260px;
      min-height: 300px;
      max-height: 80vh;
      background-color: #303030;
      color: #ffffff;
      border-radius: 0 8px 8px 0;
      box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      transition: transform 0.3s ease;
      transform: translateX(-240px) translateY(-50%);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    document.body.appendChild(sidebar);

    // Add hover effect
    sidebar.addEventListener("mouseenter", () => {
      sidebar.style.transform = "translateX(0) translateY(-50%)";
    });

    sidebar.addEventListener("mouseleave", () => {
      sidebar.style.transform = "translateX(-240px) translateY(-50%)";
    });
  }

  // Clear existing content
  sidebar.innerHTML = "";

  // Create a tab indicator
  const tabIndicator = document.createElement("div");
  tabIndicator.className = "sidebar-tab";
  tabIndicator.style.cssText = `
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: 20px;
    background-color: #337ab7;
    border-radius: 0 8px 8px 0;
    display: flex;
    justify-content: center;
    align-items: center;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    cursor: pointer;
    font-weight: bold;
    font-size: 14px;
  `;
  tabIndicator.textContent = "Monitored Torrents";
  sidebar.appendChild(tabIndicator);

  // Add notification dot
  const notificationDot = document.createElement("div");
  notificationDot.className = "notification-dot";
  notificationDot.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    width: 10px;
    height: 10px;
    background-color: #ff5252; /* Red by default */
    border-radius: 50%;
    transition: background-color 0.3s ease;
  `;
  tabIndicator.appendChild(notificationDot);

  // Create content wrapper with fixed height
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "sidebar-content";
  contentWrapper.style.cssText = `
    flex: 1;
    padding: 15px 30px 15px 15px;
    position: relative;
    background-color: transparent;
    color: #ffffff;
    min-height: 300px;
    max-height: calc(80vh - 40px);
    overflow-y: auto;
    overflow-x: hidden;
  `;
  sidebar.appendChild(contentWrapper);

  return sidebar;
}

// Shows loading state in the sidebar
function showSidebarLoadingState(sidebar) {
  const contentWrapper = sidebar.querySelector(".sidebar-content");

  // Create placeholder layout with fixed dimensions
  const placeholderLayout = document.createElement("div");
  placeholderLayout.className = "sidebar-placeholder-layout";
  placeholderLayout.style.cssText = `
    display: flex;
    flex-direction: column;
    min-height: 300px;
  `;

  // Create the loading layout
  const loadingContainer = document.createElement("div");
  loadingContainer.className = "sidebar-loading-container";
  loadingContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 1;
  `;

  // Add loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.style.cssText = `
    text-align: center;
    padding: 20px 0;
    font-style: italic;
    color: #aaa;
    background-color: transparent;
  `;
  loadingIndicator.innerHTML =
    '<i class="fa fa-refresh fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>Checking for updates...';

  // Create placeholder for refresh button to maintain layout
  const buttonPlaceholder = document.createElement("div");
  buttonPlaceholder.style.cssText = `
    height: 38px;
    width: 100%;
    margin-top: 10px;
  `;

  loadingContainer.appendChild(loadingIndicator);
  placeholderLayout.appendChild(loadingContainer);
  placeholderLayout.appendChild(buttonPlaceholder);
  contentWrapper.appendChild(placeholderLayout);
}

// Checks for updates from monitored users
async function checkForUpdates(monitoredUsers) {
  let updatesFound = false;
  let updatedUsers = [...monitoredUsers];
  let pendingUpdates = [];

  // Check each monitored user for updates
  for (let i = 0; i < monitoredUsers.length; i++) {
    const user = monitoredUsers[i];
    try {
      const response = await fetch(user.url);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      // Find the torrent count in the parsed page
      const userHeading = doc.querySelector("h3");
      if (userHeading) {
        const headingText = userHeading.textContent.trim();
        const match = headingText.match(/\((\d+)\)$/);
        if (match && match[1]) {
          const newCount = parseInt(match[1]);

          // Initialize lastDismissedCount if it doesn't exist
          const lastDismissedCount =
            user.lastDismissedCount || user.torrentCount;

          // If there are new torrents since last dismissed
          if (newCount > lastDismissedCount) {
            const newTorrents = newCount - lastDismissedCount;

            // Store the update information
            pendingUpdates.push({
              username: user.username,
              url: user.url,
              newTorrents: newTorrents,
            });

            updatesFound = true;
          }

          // Always update the current count regardless of notification status
          updatedUsers[i] = {
            ...user,
            torrentCount: newCount,
            lastChecked: Date.now(),
            lastDismissedCount: user.lastDismissedCount || user.torrentCount,
          };
        }
      }
    } catch (error) {
      console.error(`Error checking updates for ${user.username}:`, error);
    }
  }

  return { updatesFound, pendingUpdates, updatedUsers };
}

// Checks for updates from monitored keywords
async function checkKeywordUpdates(monitoredKeywords) {
  let updatesFound = false;
  let updatedKeywords = [...monitoredKeywords];
  let pendingUpdates = [];

  // Check each monitored keyword for updates
  for (let i = 0; i < monitoredKeywords.length; i++) {
    const item = monitoredKeywords[i];
    try {
      const response = await fetch(item.url);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      // Find the first torrent in the results
      const firstTorrentRow = doc.querySelector("table.torrent-list tbody tr");
      if (firstTorrentRow) {
        // Find the torrent link in the second column (td) that contains the view link
        const torrentLinkCell =
          firstTorrentRow.querySelector("td:nth-child(2)") ||
          firstTorrentRow.querySelector("td[colspan='2']");

        if (torrentLinkCell) {
          const viewLink = torrentLinkCell.querySelector("a[href^='/view/']");

          if (viewLink && viewLink.href) {
            // Extract the torrent ID from the href attribute
            const href = viewLink.getAttribute("href");
            const torrentId = href.split("/").pop();

            // If there's a new torrent with a different ID than the last dismissed one
            if (torrentId && torrentId !== item.lastDismissedTorrentId) {
              // Store the update information
              pendingUpdates.push({
                keyword: item.keyword,
                url: item.url,
                torrentId: torrentId,
                torrentName: viewLink.textContent.trim(),
              });

              updatesFound = true;
            }

            // Always update the lastTorrentId but keep lastDismissedTorrentId unchanged
            updatedKeywords[i] = {
              ...item,
              lastTorrentId: torrentId,
              lastChecked: Date.now(),
            };
          }
        }
      }
    } catch (error) {
      console.error(
        `Error checking updates for keyword "${item.keyword}":`,
        error,
      );
    }
  }

  return { updatesFound, pendingUpdates, updatedKeywords };
}

// Updates the sidebar content based on the updates check
function updateSidebarContent(
  sidebar,
  updatesFound,
  pendingUpdates,
  updatedUsers,
  keywordUpdates = [],
  updatedKeywords = [],
) {
  const contentWrapper = sidebar.querySelector(".sidebar-content");
  const tabIndicator = sidebar.querySelector(".sidebar-tab");
  const notificationDot = tabIndicator.querySelector(".notification-dot");

  // Clear existing content
  contentWrapper.innerHTML = "";

  // Create content container
  const contentContainer = document.createElement("div");
  contentContainer.className = "sidebar-content-container";
  contentContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    min-height: 300px;
    width: 100%;
    overflow-x: hidden;
  `;

  // Create scrollable area for updates or empty state
  const scrollableArea = document.createElement("div");
  scrollableArea.className = "sidebar-scrollable-area";
  scrollableArea.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
  `;

  if (updatesFound || keywordUpdates.length > 0) {
    // Create list for notifications
    const notificationList = document.createElement("ul");
    notificationList.style.cssText = `
      margin: 10px 0 0 0;
      padding: 0 0 0 20px;
      font-size: 14px;
      min-height: 50px;
      word-break: break-word;
      background-color: transparent;
      color: #ffffff;
      list-style-position: outside;
    `;

    // Add the collected updates
    for (const update of pendingUpdates) {
      // Create notification list item
      const listItem = document.createElement("li");
      listItem.style.marginBottom = "10px";
      listItem.style.wordBreak = "break-word";
      listItem.style.backgroundColor = "transparent";
      listItem.style.color = "#ffffff";

      // Create the user link
      const userLink = document.createElement("a");
      userLink.href = update.url;
      userLink.textContent = update.username;
      userLink.style.cssText = `
        font-weight: bold;
        color: #5cb8ff;
        text-decoration: none;
      `;

      userLink.addEventListener("mouseenter", () => {
        userLink.style.textDecoration = "underline";
      });

      userLink.addEventListener("mouseleave", () => {
        userLink.style.textDecoration = "none";
      });

      listItem.appendChild(userLink);
      listItem.appendChild(
        document.createTextNode(
          ` has uploaded ${update.newTorrents} new torrent${
            update.newTorrents > 1 ? "s" : ""
          }`,
        ),
      );

      notificationList.appendChild(listItem);
    }

    // Add keyword updates to the list
    for (const update of keywordUpdates) {
      // Create notification list item
      const listItem = document.createElement("li");
      listItem.style.marginBottom = "10px";
      listItem.style.wordBreak = "break-word";
      listItem.style.backgroundColor = "transparent";
      listItem.style.color = "#ffffff";

      // Create the keyword link
      const keywordSpan = document.createElement("a");
      keywordSpan.textContent = update.keyword;
      keywordSpan.href = update.url;
      keywordSpan.style.cssText = `
        font-weight: bold;
        color: #5cb8ff;
        text-decoration: none;
      `;

      keywordSpan.addEventListener("mouseenter", () => {
        keywordSpan.style.textDecoration = "underline";
      });

      keywordSpan.addEventListener("mouseleave", () => {
        keywordSpan.style.textDecoration = "none";
      });

      keywordSpan.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = update.url;
      });

      // Create the torrent link
      const torrentLink = document.createElement("a");
      torrentLink.href = `https://nyaa.si/view/${update.torrentId}`;
      torrentLink.textContent = update.torrentName;
      torrentLink.style.cssText = `
        color: #5cb8ff;
        text-decoration: none;
      `;

      torrentLink.addEventListener("mouseenter", () => {
        torrentLink.style.textDecoration = "underline";
      });

      torrentLink.addEventListener("mouseleave", () => {
        torrentLink.style.textDecoration = "none";
      });

      torrentLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(`https://nyaa.si/view/${update.torrentId}`, "_blank");
      });

      listItem.appendChild(document.createTextNode("New torrent for keyword "));
      listItem.appendChild(keywordSpan);

      notificationList.appendChild(listItem);
    }

    scrollableArea.appendChild(notificationList);

    // Update visual indicators
    notificationDot.style.backgroundColor = "#4caf50"; // Green for updates

    // Make tab pulse to draw attention
    tabIndicator.style.animation = "pulse 2s infinite";
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0% { background-color: #337ab7; }
        50% { background-color: #ff5252; }
        100% { background-color: #337ab7; }
      }
    `;
    document.head.appendChild(style);
  } else {
    // No updates - show empty state
    const emptyStateContainer = document.createElement("div");
    emptyStateContainer.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 1;
      min-height: 200px;
    `;

    const noUpdatesMsg = document.createElement("p");
    noUpdatesMsg.style.cssText = `
      font-style: italic;
      color: #aaa;
      margin: 0;
      text-align: center;
      word-break: break-word;
      background-color: transparent;
    `;
    noUpdatesMsg.textContent = "No new updates from monitored torrents";

    emptyStateContainer.appendChild(noUpdatesMsg);
    scrollableArea.appendChild(emptyStateContainer);
  }

  contentContainer.appendChild(scrollableArea);

  // Add a button container for both buttons - always present
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = `
    padding: 0px 0;
    margin-top: auto;
    padding-right: 25px; /* Add padding to prevent overlap with the blue sidebar tab */
  `;

  if (updatesFound) {
    // Add a dismiss button first when updates are found
    const dismissButton = document.createElement("button");
    dismissButton.className = "copy-magnets-button dismiss-button";
    dismissButton.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      font-size: 12px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: none;
      margin-bottom: 10px;
    `;
    dismissButton.innerHTML = '<i class="fa fa-check"></i> Dismiss Updates';
    dismissButton.addEventListener("click", async () => {
      // Update lastDismissedCount to current torrentCount for all users
      const dismissedUsers = updatedUsers.map((user) => ({
        ...user,
        lastDismissedCount: user.torrentCount,
      }));

      // Update lastDismissedTorrentId to current lastTorrentId for all keywords
      const dismissedKeywords = updatedKeywords.map((keyword) => ({
        ...keyword,
        lastDismissedTorrentId: keyword.lastTorrentId,
      }));

      // Save the current torrent counts and dismissed state for both users and keywords
      chrome.storage.sync.set({
        monitoredUsers: dismissedUsers,
        monitoredKeywords: dismissedKeywords,
      });

      // Reset the notification dot to red
      notificationDot.style.backgroundColor = "#ff5252"; // Red

      // Stop the tab pulsing animation

      // Update the sidebar content to clear notifications
      updateSidebarContent(
        sidebar,
        false,
        [],
        dismissedUsers,
        [],
        dismissedKeywords,
      );
      tabIndicator.style.animation = "none";

      // Show notification that updates were dismissed
      showNotification("Updates dismissed", true);

      // Refresh the sidebar
      checkMonitoredUsers();
    });

    buttonContainer.appendChild(dismissButton);
  }

  // Add the refresh button
  const refreshButton = document.createElement("button");
  refreshButton.className = "copy-magnets-button";
  refreshButton.style.cssText = `
    width: 100%;
    padding: 8px 10px;
    font-size: 12px;
    background-color: #337ab7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    box-shadow: none;
  `;
  refreshButton.innerHTML = '<i class="fa fa-refresh"></i> Refresh';
  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    refreshButton.innerHTML =
      '<i class="fa fa-refresh fa-spin"></i> Refreshing...';

    // Save updated counts first
    chrome.storage.sync.set({ monitoredUsers: updatedUsers });

    // Then check again
    await checkMonitoredUsers();
  });

  buttonContainer.appendChild(refreshButton);
  contentContainer.appendChild(buttonContainer);

  // Add the content container to the wrapper
  contentWrapper.appendChild(contentContainer);
}
