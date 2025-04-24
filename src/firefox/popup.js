// Handle tab switching
document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    // Remove active class from all buttons and content
    document
      .querySelectorAll(".nav-button")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    // Add active class to clicked button and corresponding content
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

// Function to update dependent toggles
function updateDependentToggles(buttonsEnabled) {
  const dependentToggles = [
    "displayNameToggle",
    "zipToggle",
    "showQuickFilterToggle",
  ];

  dependentToggles.forEach((toggleId) => {
    const toggle = document.querySelector(`[data-toggle="${toggleId}"]`);
    const toggleContainer = toggle.closest(".setting-item");

    if (buttonsEnabled) {
      toggleContainer.style.opacity = "1";
      toggleContainer.style.pointerEvents = "auto";
    } else {
      toggleContainer.style.opacity = "0.5";
      toggleContainer.style.pointerEvents = "none";
    }

    // Add transition for smooth animation
    toggleContainer.style.transition = "opacity 0.3s ease";
  });
}

// Initialize toggle states from storage
browser.storage.sync.get(
  {
    useDisplayName: true,
    useZip: true,
    showButtons: true,
    showATLinks: true,
    showMagnetButtons: true,
    showQuickFilter: true,
    changelogDismissed: false,
    hideDeadTorrents: false,
    keywords: [],
    keywordFilterEnabled: false,
    showFilterNotifications: true,
    hideComments: false,
    fileSizeFilterEnabled: false,
    fileSizeRange: "less_than_256mb",
    showChangelogNav: true,
  },
  (items) => {
    document
      .querySelector('[data-toggle="displayNameToggle"]')
      .setAttribute("aria-checked", items.useDisplayName);
    document
      .querySelector('[data-toggle="zipToggle"]')
      .setAttribute("aria-checked", items.useZip);
    document
      .querySelector('[data-toggle="showButtonsToggle"]')
      .setAttribute("aria-checked", items.showButtons);
    document
      .querySelector('[data-toggle="showATLinksToggle"]')
      .setAttribute("aria-checked", items.showATLinks);
    document
      .querySelector('[data-toggle="showMagnetButtonsToggle"]')
      .setAttribute("aria-checked", items.showMagnetButtons);
    document
      .querySelector('[data-toggle="showQuickFilterToggle"]')
      .setAttribute("aria-checked", items.showQuickFilter);
    document
      .querySelector('[data-toggle="changelogToggle"]')
      .setAttribute("aria-checked", !items.changelogDismissed);
    document
      .querySelector('[data-toggle="hideDeadTorrentsToggle"]')
      .setAttribute("aria-checked", items.hideDeadTorrents);
    document
      .querySelector('[data-toggle="keywordFilterToggle"]')
      .setAttribute("aria-checked", items.keywordFilterEnabled);
    document
      .querySelector('[data-toggle="showFilterNotificationsToggle"]')
      .setAttribute("aria-checked", items.showFilterNotifications);
    document
      .querySelector('[data-toggle="hideCommentsToggle"]')
      .setAttribute("aria-checked", items.hideComments);
    document
      .querySelector('[data-toggle="fileSizeFilterToggle"]')
      .setAttribute("aria-checked", items.fileSizeFilterEnabled);
    document
      .querySelector('[data-toggle="showChangelogNavToggle"]')
      .setAttribute("aria-checked", items.showChangelogNav);

    // Initialize dependent toggles state
    updateDependentToggles(items.showButtons);

    displayKeywords(items.keywords);

    const sizeSelect = document.getElementById("sizeRangeSelect");
    sizeSelect.value = items.fileSizeRange;
    sizeSelect.disabled = !items.fileSizeFilterEnabled;
  }
);

// Add click handlers for toggle buttons
document.querySelectorAll(".toggle-button").forEach((button) => {
  button.addEventListener("click", () => {
    const isChecked = button.getAttribute("aria-checked") === "true";
    const newState = !isChecked;
    button.setAttribute("aria-checked", newState);

    // Save the new state
    let setting;
    switch (button.dataset.toggle) {
      case "displayNameToggle":
        setting = "useDisplayName";
        break;
      case "zipToggle":
        setting = "useZip";
        break;
      case "showButtonsToggle":
        setting = "showButtons";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showButtons",
              value: newState,
            });
          }
        );
        updateDependentToggles(newState);
        break;
      case "showATLinksToggle":
        setting = "showATLinks";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showATLinks",
              value: newState,
            });
          }
        );
        break;
      case "showMagnetButtonsToggle":
        setting = "showMagnetButtons";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showMagnetButtons",
              value: newState,
            });
          }
        );
        break;
      case "changelogToggle":
        setting = "changelogDismissed";
        browser.storage.sync.set({
          changelogDismissed: !newState,
          tempDismissed: !newState,
        });
        return;
      case "showQuickFilterToggle":
        setting = "showQuickFilter";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showQuickFilter",
              value: newState,
            });
          }
        );
        break;
      case "hideDeadTorrentsToggle":
        setting = "hideDeadTorrents";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "hideDeadTorrents",
              value: newState,
            });
          }
        );
        break;
      case "keywordFilterToggle":
        setting = "keywordFilterEnabled";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "keywordFilterEnabled",
              value: newState,
            });
          }
        );
        break;
      case "showFilterNotificationsToggle":
        setting = "showFilterNotifications";
        browser.storage.sync.set({ [setting]: newState });
        break;
      case "hideCommentsToggle":
        setting = "hideComments";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "hideComments",
              value: newState,
            });
          }
        );
        break;
      case "fileSizeFilterToggle":
        setting = "fileSizeFilterEnabled";
        document.getElementById("sizeRangeSelect").disabled = !newState;
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "fileSizeFilterEnabled",
              value: newState,
            });
          }
        );
        break;
      case "showChangelogNavToggle":
        setting = "showChangelogNav";
        browser.storage.sync.set({ [setting]: newState });
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showChangelogNav",
              value: newState,
            });
          }
        );
        break;
    }
    browser.storage.sync.set({ [setting]: newState });
  });
});

// Get version from manifest.json and update the version number in popup
fetch(browser.runtime.getURL("manifest.json"))
  .then((response) => response.json())
  .then((manifest) => {
    document.querySelector(".version-number").textContent = manifest.version;
  });

function displayKeywords(keywords) {
  const keywordsList = document.getElementById("keywords-list");
  keywordsList.innerHTML = "";

  keywords.forEach((keyword) => {
    const item = document.createElement("div");
    item.className = "keyword-item";
    item.innerHTML = `
      <span>${keyword}</span>
      <button class="keyword-remove">Remove</button>
    `;

    item.querySelector(".keyword-remove").addEventListener("click", () => {
      removeKeyword(keyword);
    });

    keywordsList.appendChild(item);
  });
}

function addKeyword() {
  const input = document.getElementById("keyword-input");
  const keyword = input.value.trim();

  if (keyword) {
    browser.storage.sync.get({ keywords: [] }, (items) => {
      const keywords = items.keywords;
      if (!keywords.includes(keyword)) {
        keywords.push(keyword);
        browser.storage.sync.set({ keywords }, () => {
          displayKeywords(keywords);
          input.value = "";

          // Notify content script to update filters
          browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "keywordsUpdated",
              keywords,
            });
          });
        });
      }
    });
  }
}

function removeKeyword(keywordToRemove) {
  browser.storage.sync.get({ keywords: [] }, (items) => {
    const keywords = items.keywords.filter((k) => k !== keywordToRemove);
    browser.storage.sync.set({ keywords }, () => {
      displayKeywords(keywords);

      // Notify content script to update filters
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        browser.tabs.sendMessage(tabs[0].id, {
          type: "keywordsUpdated",
          keywords,
        });
      });
    });
  });
}

function removeAllKeywords() {
  browser.storage.sync.set({ keywords: [] }, () => {
    displayKeywords([]);

    // Notify content script to update filters
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "keywordsUpdated",
        keywords: [],
      });
    });
  });
}

// Add event listeners
document.getElementById("add-keyword").addEventListener("click", addKeyword);
document.getElementById("keyword-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addKeyword();
  }
});
document
  .getElementById("remove-all-keywords")
  .addEventListener("click", removeAllKeywords);

// Add size range change handler
document.getElementById("sizeRangeSelect").addEventListener("change", (e) => {
  const newValue = e.target.value;
  browser.storage.sync.set({ fileSizeRange: newValue });
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    browser.tabs.sendMessage(tabs[0].id, {
      type: "settingChanged",
      setting: "fileSizeRange",
      value: newValue,
    });
  });
});

// Monitored Users Functions
function displayMonitoredUsers(monitoredUsers) {
  const usersList = document.getElementById("monitored-users-list");
  usersList.innerHTML = "";

  if (!monitoredUsers || monitoredUsers.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-list-message";
    emptyMessage.textContent = "You are not monitoring any users yet.";
    emptyMessage.style.fontStyle = "italic";
    emptyMessage.style.color = "#888";
    emptyMessage.style.textAlign = "center";
    emptyMessage.style.margin = "20px 0";
    usersList.appendChild(emptyMessage);
    return;
  }

  monitoredUsers.forEach((user) => {
    const item = document.createElement("div");
    item.className = "monitored-user-item";
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 4px;
      background-color: #2a2a2a;
      transition: background-color 0.3s ease;
    `;

    // Calculate time since last check
    const lastChecked = new Date(user.lastChecked);
    const now = new Date();
    const diffMs = now - lastChecked;
    const diffMins = Math.round(diffMs / 60000);
    const timeAgo =
      diffMins < 60
        ? `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`
        : `${Math.round(diffMins / 60)} hour${
            Math.round(diffMins / 60) !== 1 ? "s" : ""
          } ago`;

    // Show if there are new torrents
    const hasNewTorrents = user.torrentCount > (user.lastDismissedCount || 0);
    const newTorrentsCount = hasNewTorrents
      ? user.torrentCount - (user.lastDismissedCount || 0)
      : 0;

    // Create user info section
    const userInfo = document.createElement("div");
    userInfo.className = "user-info";
    userInfo.style.cssText = `
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    `;

    // Create username with link
    const usernameLink = document.createElement("a");
    usernameLink.href = user.url;
    usernameLink.target = "_blank";
    usernameLink.textContent = user.username;
    usernameLink.style.cssText = `
      font-weight: 500;
      color: #337ab7;
      text-decoration: none;
      margin-bottom: 2px;
    `;
    usernameLink.addEventListener("mouseenter", () => {
      usernameLink.style.textDecoration = "underline";
    });
    usernameLink.addEventListener("mouseleave", () => {
      usernameLink.style.textDecoration = "none";
    });

    // Create stats container
    const statsContainer = document.createElement("div");
    statsContainer.style.cssText = `
      display: flex;
      font-size: 12px;
      color: #919191;
    `;

    // Total torrents count
    const totalTorrents = document.createElement("span");
    totalTorrents.textContent = `${user.torrentCount} torrents`;
    totalTorrents.style.marginRight = "10px";
    statsContainer.appendChild(totalTorrents);

    // New uploads indicator
    if (hasNewTorrents) {
      const newTorrents = document.createElement("span");
      newTorrents.textContent = `${newTorrentsCount} new`;
      newTorrents.style.cssText = `
        color: #4caf50;
        font-weight: bold;
        margin-right: 10px;
      `;
      statsContainer.appendChild(newTorrents);
    }

    // Last checked time
    const lastCheckedEl = document.createElement("span");
    lastCheckedEl.textContent = `Checked ${timeAgo}`;
    lastCheckedEl.style.fontStyle = "italic";
    statsContainer.appendChild(lastCheckedEl);

    // Assemble user info
    userInfo.appendChild(usernameLink);
    userInfo.appendChild(statsContainer);

    // Create button container
    const buttonContainer = document.createElement("div");

    // Create unmonitor button
    const unmonitorBtn = document.createElement("button");
    unmonitorBtn.className = "keyword-remove unmonitor-btn";
    unmonitorBtn.textContent = "Unmonitor";
    unmonitorBtn.addEventListener("click", () => {
      unmonitorUser(user.username);
    });

    // Add elements to item
    buttonContainer.appendChild(unmonitorBtn);
    item.appendChild(userInfo);
    item.appendChild(buttonContainer);
    usersList.appendChild(item);
  });
}

function unmonitorUser(username) {
  browser.storage.sync.get({ monitoredUsers: [] }, (items) => {
    const monitoredUsers = items.monitoredUsers.filter(
      (user) => user.username !== username
    );
    browser.storage.sync.set({ monitoredUsers }, () => {
      displayMonitoredUsers(monitoredUsers);

      // Notify content script to update the monitoring list
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        browser.tabs.sendMessage(tabs[0].id, {
          type: "monitoredUsersUpdated",
          monitoredUsers,
        });
      });
    });
  });
}

function unmonitorAllUsers() {
  browser.storage.sync.set({ monitoredUsers: [] }, () => {
    displayMonitoredUsers([]);

    // Notify content script to update the monitoring list
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "monitoredUsersUpdated",
        monitoredUsers: [],
      });
    });
  });
}

// Initialize the monitored users list
browser.storage.sync.get({ monitoredUsers: [] }, (items) => {
  displayMonitoredUsers(items.monitoredUsers);
});

// Add unmonitor all event listener
document
  .getElementById("unmonitor-all-users")
  .addEventListener("click", unmonitorAllUsers);
