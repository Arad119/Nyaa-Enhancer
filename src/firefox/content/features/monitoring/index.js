import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { getKeywordSearchUrl, getTorrentViewUrl, toCurrentNyaaUrl } from "../../../shared/urls.js";
import { countVisibleCheckedTorrents, getTitleFromRow, showNotification, updateSelectionCounterDisplay } from "../../internal.js";

export function showKeywordMonitorPopup() {
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

export function showKeywordSelectPopup() {
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
        updateSelectionCounterDisplay(counter, countVisibleCheckedTorrents());
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

// Function to handle user monitoring
export async function addMonitorButton() {
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
    savePreferences({ monitoredUsers: currentPrefs.monitoredUsers });
  });

  // Insert the Monitor button before the heading text
  userHeading.insertBefore(monitorButton, userHeading.firstChild);
}

// Function to add keyword monitoring
// Function to get the latest torrent ID for a keyword
export async function getLatestTorrentIdForKeyword(keyword) {
  try {
    // Create search URL for this keyword
    const searchUrl = getKeywordSearchUrl(keyword);

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

export async function addKeywordMonitoring(keyword, torrentId) {
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
    const searchUrl = getKeywordSearchUrl(keyword);

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
  savePreferences({ monitoredKeywords: prefs.monitoredKeywords });
}

// Function to check for new uploads from monitored users when on the homepage
export async function checkMonitoredUsers() {
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
    savePreferences({ monitoredUsers: updatedUsers });
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
      savePreferences({ monitoredKeywords: updatedKeywords });
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
export function createOrUpdateSidebar() {
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
export function showSidebarLoadingState(sidebar) {
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
export async function checkForUpdates(monitoredUsers) {
  let updatesFound = false;
  let updatedUsers = [...monitoredUsers];
  let pendingUpdates = [];

  // Check each monitored user for updates
  for (let i = 0; i < monitoredUsers.length; i++) {
    const user = monitoredUsers[i];
    try {
      const response = await fetch(toCurrentNyaaUrl(user.url));
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
export async function checkKeywordUpdates(monitoredKeywords) {
  let updatesFound = false;
  let updatedKeywords = [...monitoredKeywords];
  let pendingUpdates = [];

  // Check each monitored keyword for updates
  for (let i = 0; i < monitoredKeywords.length; i++) {
    const item = monitoredKeywords[i];
    try {
      const searchUrl = getKeywordSearchUrl(item.keyword);
      const response = await fetch(searchUrl);
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
                url: searchUrl,
                torrentId: torrentId,
                torrentName: viewLink.textContent.trim(),
              });

              updatesFound = true;
            }

            // Always update the lastTorrentId but keep lastDismissedTorrentId unchanged
            updatedKeywords[i] = {
              ...item,
              url: searchUrl,
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
export function updateSidebarContent(
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
      userLink.href = toCurrentNyaaUrl(update.url);
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
      keywordSpan.href = toCurrentNyaaUrl(update.url || getKeywordSearchUrl(update.keyword));
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
        window.location.href = toCurrentNyaaUrl(
          update.url || getKeywordSearchUrl(update.keyword),
        );
      });

      // Create the torrent link
      const torrentLink = document.createElement("a");
      torrentLink.href = getTorrentViewUrl(update.torrentId);
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
        window.open(getTorrentViewUrl(update.torrentId), "_blank");
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
      savePreferences({
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
    savePreferences({ monitoredUsers: updatedUsers });

    // Then check again
    await checkMonitoredUsers();
  });

  buttonContainer.appendChild(refreshButton);
  contentContainer.appendChild(buttonContainer);

  // Add the content container to the wrapper
  contentWrapper.appendChild(contentContainer);
}
