document.addEventListener("DOMContentLoaded", function () {
  // Handle main tab switching
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

  // Handle monitoring tab switching
  document.querySelectorAll(".monitoring-nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all monitoring buttons and content
      document
        .querySelectorAll(".monitoring-nav-button")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".monitoring-tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked button and corresponding content
      button.classList.add("active");
      document
        .getElementById(button.dataset.monitoringTab)
        .classList.add("active");
    });
  });

  // Accordion functionality
  const accordionHeaders = document.querySelectorAll(".accordion-header");

  accordionHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector(".accordion-icon");

      // Toggle accordion state
      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        icon.textContent = "+";
      } else {
        content.style.maxHeight = content.scrollHeight + "px";
        icon.textContent = "-";
      }
    });
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
    useNewATDomain: true,
    showATComments: false,
    ameNZBApiKey: "",
    showAmeNZBLinks: false,
    ameNZBRequestCount: 0,
    ameNZBRequestDate: "",
    showNekoBTLinks: false,
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
    showMonitorButtons: true,
    monitoredKeywords: [],
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
      .querySelector('[data-toggle="useNewATDomainToggle"]')
      .setAttribute("aria-checked", items.useNewATDomain);
    document
      .querySelector('[data-toggle="showATCommentsToggle"]')
      .setAttribute("aria-checked", items.showATComments);
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
    document
      .querySelector('[data-toggle="showMonitorButtonsToggle"]')
      .setAttribute("aria-checked", items.showMonitorButtons);

    const ameNZBApiKeyInput = document.getElementById("ameNZBApiKey");
    ameNZBApiKeyInput.value = items.ameNZBApiKey || "";
    const ameNZBToggle = document.querySelector(
      '[data-toggle="showAmeNZBLinksToggle"]'
    );
    ameNZBToggle.setAttribute("aria-checked", items.showAmeNZBLinks);
    ameNZBToggle.disabled = !items.ameNZBApiKey;

    const todayUTC = new Date().toISOString().slice(0, 10);
    const todayCount =
      items.ameNZBRequestDate === todayUTC ? items.ameNZBRequestCount : 0;
    document.getElementById("ameNZBRequestCount").textContent =
      `${todayCount.toLocaleString()} / 10,000`;

    document
      .querySelector('[data-toggle="showNekoBTLinksToggle"]')
      .setAttribute("aria-checked", items.showNekoBTLinks);

    // Initialize dependent toggles state
    updateDependentToggles(items.showButtons);

    displayKeywords(items.keywords);
    displayMonitoredKeywords(items.monitoredKeywords || []);

    const sizeSelect = document.getElementById("sizeRangeSelect");
    sizeSelect.value = items.fileSizeRange;
    sizeSelect.disabled = !items.fileSizeFilterEnabled;
  }
);

const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// ameNZB eye button — toggle password visibility
document.getElementById("ameNZBApiKeyToggle").addEventListener("click", () => {
  const input = document.getElementById("ameNZBApiKey");
  const btn = document.getElementById("ameNZBApiKeyToggle");
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = EYE_SLASH_SVG;
  } else {
    input.type = "password";
    btn.innerHTML = EYE_SVG;
  }
});

// ameNZB Test button — validate the API key
document.getElementById("ameNZBApiKeyTest").addEventListener("click", async () => {
  const key = document.getElementById("ameNZBApiKey").value.trim();
  const statusEl = document.getElementById("ameNZBTestStatus");
  const testBtn = document.getElementById("ameNZBApiKeyTest");

  if (!key) {
    statusEl.textContent = "Enter an API key first.";
    statusEl.style.color = "#999";
    return;
  }

  testBtn.disabled = true;
  statusEl.textContent = "Testing…";
  statusEl.style.color = "#999";

  const result = await new Promise((resolve) => {
    browser.runtime.sendMessage(
      { type: "fetchUrl", url: `https://amenzb.moe/api?t=search&apikey=${encodeURIComponent(key)}` },
      resolve
    );
  });

  testBtn.disabled = false;

  if (!result?.ok) {
    statusEl.textContent = "✗ Request failed.";
    statusEl.style.color = "#ff4444";
    return;
  }

  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(result.text, "text/xml");
    // Check for Newznab error element
    const errorEl = xml.querySelector("error");
    if (errorEl) {
      const code = errorEl.getAttribute("code");
      const desc = errorEl.getAttribute("description") || "Unknown error";
      statusEl.textContent = `✗ ${desc}`;
      statusEl.style.color = "#ff4444";
      return;
    }
    // A valid response has a <channel> with Newznab response element
    const channel = xml.querySelector("channel");
    if (channel) {
      // Only count against the quota when the key was accepted
      const todayUTC = new Date().toISOString().slice(0, 10);
      browser.storage.sync.get({ ameNZBRequestCount: 0, ameNZBRequestDate: "" }, (items) => {
        const count = items.ameNZBRequestDate === todayUTC ? items.ameNZBRequestCount + 1 : 1;
        browser.storage.sync.set({ ameNZBRequestCount: count, ameNZBRequestDate: todayUTC });
      });
      statusEl.textContent = "✓ API key is valid.";
      statusEl.style.color = "#4caf50";
    } else {
      statusEl.textContent = "✗ Unexpected response.";
      statusEl.style.color = "#ff4444";
    }
  } catch {
    statusEl.textContent = "✗ Could not parse response.";
    statusEl.style.color = "#ff4444";
  }
});

// ameNZB Clear button — wipe the API key from input and storage
document.getElementById("ameNZBApiKeyClear").addEventListener("click", () => {
  const input = document.getElementById("ameNZBApiKey");
  input.value = "";
  input.type = "password";
  document.getElementById("ameNZBApiKeyToggle").innerHTML = EYE_SVG;
  document.getElementById("ameNZBTestStatus").textContent = "";

  const ameNZBToggle = document.querySelector('[data-toggle="showAmeNZBLinksToggle"]');
  ameNZBToggle.disabled = true;
  ameNZBToggle.setAttribute("aria-checked", false);

  browser.storage.sync.set({ ameNZBApiKey: "", showAmeNZBLinks: false });
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    browser.tabs.sendMessage(tabs[0].id, {
      type: "settingChanged",
      setting: "showAmeNZBLinks",
      value: false,
    });
  });
});

// ameNZB API key input — enable/disable toggle and persist key
document.getElementById("ameNZBApiKey").addEventListener("input", (e) => {
  const key = e.target.value.trim();
  const ameNZBToggle = document.querySelector(
    '[data-toggle="showAmeNZBLinksToggle"]'
  );
  ameNZBToggle.disabled = !key;
  if (!key) {
    ameNZBToggle.setAttribute("aria-checked", false);
    browser.storage.sync.set({ ameNZBApiKey: "", showAmeNZBLinks: false });
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "showAmeNZBLinks",
        value: false,
      });
    });
  } else {
    browser.storage.sync.set({ ameNZBApiKey: key });
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "ameNZBApiKey",
        value: key,
      });
    });
  }
});

// Keep ameNZB request counter live while popup is open
browser.storage.onChanged.addListener((changes) => {
  if (changes.ameNZBRequestCount || changes.ameNZBRequestDate) {
    browser.storage.sync.get(
      { ameNZBRequestCount: 0, ameNZBRequestDate: "" },
      (items) => {
        const todayUTC = new Date().toISOString().slice(0, 10);
        const todayCount =
          items.ameNZBRequestDate === todayUTC ? items.ameNZBRequestCount : 0;
        const el = document.getElementById("ameNZBRequestCount");
        if (el) el.textContent = `${todayCount.toLocaleString()} / 10,000`;
      }
    );
  }
});

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
      case "useNewATDomainToggle":
        setting = "useNewATDomain";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "useNewATDomain",
              value: newState,
            });
          }
        );
        break;
      case "showATCommentsToggle":
        setting = "showATComments";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showATComments",
              value: newState,
            });
          }
        );
        break;
      case "showAmeNZBLinksToggle":
        setting = "showAmeNZBLinks";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showAmeNZBLinks",
              value: newState,
            });
          }
        );
        break;
      case "showNekoBTLinksToggle":
        setting = "showNekoBTLinks";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showNekoBTLinks",
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
      case "showMonitorButtonsToggle":
        setting = "showMonitorButtons";
        browser.storage.sync.set({ [setting]: newState });
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showMonitorButtons",
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

// Function to display monitored keywords
function displayMonitoredKeywords(monitoredKeywords) {
  const keywordsList = document.getElementById("monitored-keywords-list");
  keywordsList.innerHTML = "";

  if (!monitoredKeywords || monitoredKeywords.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-list-message";
    emptyMessage.textContent = "You are not monitoring any keywords yet.";
    emptyMessage.style.fontStyle = "italic";
    emptyMessage.style.color = "#888";
    emptyMessage.style.textAlign = "center";
    emptyMessage.style.margin = "20px 0";
    keywordsList.appendChild(emptyMessage);
    return;
  }

  monitoredKeywords.forEach((keywordObj) => {
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

    // Create left section with keyword info
    const keywordInfo = document.createElement("div");
    keywordInfo.className = "user-info";
    keywordInfo.style.cssText = `
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    `;

    const keywordLink = document.createElement("a");
    keywordLink.textContent = keywordObj.keyword;
    keywordLink.href =
      keywordObj.url ||
      `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(keywordObj.keyword)}`;
    keywordLink.style.cssText = `
      font-weight: 500;
      color: #337ab7;
      text-decoration: none;
      margin-bottom: 2px;
    `;

    keywordLink.addEventListener("mouseenter", () => {
      keywordLink.style.textDecoration = "underline";
    });
    keywordLink.addEventListener("mouseleave", () => {
      keywordLink.style.textDecoration = "none";
    });
    keywordLink.target = "_blank";

    const statsContainer = document.createElement("div");
    statsContainer.style.cssText = `
      display: flex;
      font-size: 12px;
      color: #919191;
    `;

    const timestamp = document.createElement("span");
    const lastChecked = keywordObj.lastCheckedAt
      ? new Date(keywordObj.lastCheckedAt)
      : new Date();
    const now = new Date();
    const diffMs = now - lastChecked;
    const diffMins = Math.round(diffMs / 60000);
    timestamp.textContent = `Checked ${diffMins} mins ago`;
    timestamp.style.fontStyle = "italic";

    statsContainer.appendChild(timestamp);
    keywordInfo.appendChild(keywordLink);
    keywordInfo.appendChild(statsContainer);

    // Create right section with unmonitor button
    const buttonContainer = document.createElement("div");
    const unmonitorButton = document.createElement("button");
    unmonitorButton.textContent = "Unmonitor";
    unmonitorButton.className = "keyword-remove unmonitor-btn";
    unmonitorButton.addEventListener("click", () => {
      removeMonitoredKeyword(keywordObj.keyword);
    });

    buttonContainer.appendChild(unmonitorButton);

    item.appendChild(keywordInfo);
    item.appendChild(buttonContainer);
    keywordsList.appendChild(item);
  });
}

// Function to add a monitored keyword
function addMonitoredKeyword() {
  const input = document.getElementById("monitored-keyword-input");
  const keyword = input.value.trim();

  if (keyword) {
    browser.storage.sync.get({ monitoredKeywords: [] }, (items) => {
      const monitoredKeywords = items.monitoredKeywords;
      const exists = monitoredKeywords.some((k) => k.keyword === keyword);

      if (!exists) {
        monitoredKeywords.push({
          keyword: keyword,
          url: `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(keyword)}`,
          lastTorrentId: 0,
          lastDismissedTorrentId: 0,
        });

        browser.storage.sync.set({ monitoredKeywords }, () => {
          displayMonitoredKeywords(monitoredKeywords);
          input.value = "";
        });
      } else {
        input.value = "";
      }
    });
  }
}

// Function to remove a monitored keyword
function removeMonitoredKeyword(keywordToRemove) {
  browser.storage.sync.get({ monitoredKeywords: [] }, (items) => {
    const monitoredKeywords = items.monitoredKeywords.filter(
      (k) => k.keyword !== keywordToRemove
    );

    browser.storage.sync.set({ monitoredKeywords }, () => {
      displayMonitoredKeywords(monitoredKeywords);
    });
  });
}

// Function to remove all monitored keywords
function removeAllMonitoredKeywords() {
  browser.storage.sync.set({ monitoredKeywords: [] }, () => {
    displayMonitoredKeywords([]);
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

// Monitored Keywords functionality
document
  .getElementById("unmonitor-all-keywords")
  .addEventListener("click", removeAllMonitoredKeywords);

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
