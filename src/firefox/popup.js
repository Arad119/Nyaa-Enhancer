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

// Enable/disable the screenshot preview delay inputs based on the toggle state
function setScreenshotPreviewInputsEnabled(enabled) {
  const hoverInput = document.getElementById("screenshotPreviewHoverDelay");
  const slideInput = document.getElementById("screenshotPreviewSlideDelay");
  if (hoverInput) hoverInput.disabled = !enabled;
  if (slideInput) slideInput.disabled = !enabled;
  updateScreenshotPreviewDisclaimer(enabled);
}

function updateScreenshotPreviewDisclaimer(featureEnabled) {
  const disclaimer = document.getElementById("screenshotPreviewDisclaimer");
  if (!disclaimer) return;
  disclaimer.classList.toggle("visible", !!featureEnabled);
}

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
    showATScreenshotsSection: true,
    showATFileInfoSection: true,
    showATAttachmentsSection: true,
    ameNZBApiKey: "",
    showAmeNZBLinks: false,
    showAmeNZBSection: false,
    ameNZBRequestCount: 0,
    ameNZBRequestDate: "",
    showNekoBTLinks: false,
    showNekoBTSection: false,
    showNekoBTFullLangNames: true,
    showTsukihimeLinks: false,
    showTsukihimeSection: false,
    showMagnetButtons: true,
    showSendButtons: true,
    showQuickFilter: true,
    changelogDismissed: false,
    hideDeadTorrents: false,
    keywords: [],
    keywordFilterEnabled: false,
    showFilterNotifications: true,
    hideComments: false,
    improvedFileList: true,
    fileSizeFilterEnabled: false,
    fileSizeRange: "less_than_256mb",
    completedDownloadsFilterEnabled: false,
    completedDownloadsFilterOperator: "gt",
    completedDownloadsFilterValue: 0,
    showChangelogNav: true,
    showMonitorButtons: true,
    monitoredKeywords: [],
    showSeaDex: false,
    screenshotPreviewEnabled: false,
    screenshotPreviewHoverDelay: 2,
    screenshotPreviewSlideDelay: 2,
    torrentClient: "qbittorrent",
    torrentClientUrl: "",
    qbtUsername: "",
    qbtPassword: "",
    transmissionUsername: "",
    transmissionPassword: "",
    delugePassword: "",
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
      .querySelector('[data-toggle="showATScreenshotsSectionToggle"]')
      .setAttribute("aria-checked", items.showATScreenshotsSection);
    document
      .querySelector('[data-toggle="showATFileInfoSectionToggle"]')
      .setAttribute("aria-checked", items.showATFileInfoSection);
    document
      .querySelector('[data-toggle="showATAttachmentsSectionToggle"]')
      .setAttribute("aria-checked", items.showATAttachmentsSection);
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
      .querySelector('[data-toggle="improvedFileListToggle"]')
      .setAttribute("aria-checked", items.improvedFileList);
    document
      .querySelector('[data-toggle="fileSizeFilterToggle"]')
      .setAttribute("aria-checked", items.fileSizeFilterEnabled);
    document
      .querySelector('[data-toggle="showChangelogNavToggle"]')
      .setAttribute("aria-checked", items.showChangelogNav);
    document
      .querySelector('[data-toggle="showMonitorButtonsToggle"]')
      .setAttribute("aria-checked", items.showMonitorButtons);
    document
      .querySelector('[data-toggle="showSendButtonsToggle"]')
      .setAttribute("aria-checked", items.showSendButtons);

    // Load torrent client settings
    const tc = items.torrentClient || "qbittorrent";
    document.getElementById("tcClientSelect").value = tc;
    document.getElementById("tcIp").value = items.torrentClientUrl || "";
    loadClientAuth(tc, items);
    applyClientUI(tc);

    const ameNZBApiKeyInput = document.getElementById("ameNZBApiKey");
    ameNZBApiKeyInput.value = items.ameNZBApiKey || "";
    const ameNZBToggle = document.querySelector(
      '[data-toggle="showAmeNZBLinksToggle"]',
    );
    ameNZBToggle.setAttribute("aria-checked", items.showAmeNZBLinks);
    ameNZBToggle.disabled = !items.ameNZBApiKey;

    const ameNZBSectionToggle = document.querySelector(
      '[data-toggle="showAmeNZBSectionToggle"]',
    );
    ameNZBSectionToggle.setAttribute("aria-checked", items.showAmeNZBSection);
    ameNZBSectionToggle.disabled = !items.ameNZBApiKey;

    const todayUTC = new Date().toISOString().slice(0, 10);
    const todayCount =
      items.ameNZBRequestDate === todayUTC ? items.ameNZBRequestCount : 0;
    document.getElementById("ameNZBRequestCount").textContent =
      `${todayCount.toLocaleString()} / 10,000`;

    document
      .querySelector('[data-toggle="showNekoBTLinksToggle"]')
      .setAttribute("aria-checked", items.showNekoBTLinks);
    document
      .querySelector('[data-toggle="showNekoBTSectionToggle"]')
      .setAttribute("aria-checked", items.showNekoBTSection);
    document
      .querySelector('[data-toggle="showNekoBTFullLangNamesToggle"]')
      .setAttribute("aria-checked", items.showNekoBTFullLangNames);
    document
      .querySelector('[data-toggle="showTsukihimeLinksToggle"]')
      .setAttribute("aria-checked", items.showTsukihimeLinks);
    document
      .querySelector('[data-toggle="showTsukihimeSectionToggle"]')
      .setAttribute("aria-checked", items.showTsukihimeSection);
    document
      .querySelector('[data-toggle="showSeaDexToggle"]')
      .setAttribute("aria-checked", items.showSeaDex);

    document
      .querySelector('[data-toggle="screenshotPreviewToggle"]')
      .setAttribute("aria-checked", items.screenshotPreviewEnabled);

    const screenshotHoverInput = document.getElementById(
      "screenshotPreviewHoverDelay",
    );
    const screenshotSlideInput = document.getElementById(
      "screenshotPreviewSlideDelay",
    );
    screenshotHoverInput.value = items.screenshotPreviewHoverDelay;
    screenshotSlideInput.value = items.screenshotPreviewSlideDelay;
    setScreenshotPreviewInputsEnabled(items.screenshotPreviewEnabled);

    // Initialize dependent toggles state
    updateDependentToggles(items.showButtons);

    displayKeywords(items.keywords);
    displayMonitoredKeywords(items.monitoredKeywords || []);

    const sizeSelect = document.getElementById("sizeRangeSelect");
    sizeSelect.value = items.fileSizeRange;
    sizeSelect.disabled = !items.fileSizeFilterEnabled;

    document
      .querySelector('[data-toggle="completedDownloadsFilterToggle"]')
      .setAttribute("aria-checked", items.completedDownloadsFilterEnabled);
    const completedDownloadsOperatorSelect = document.getElementById(
      "completedDownloadsOperatorSelect",
    );
    const completedDownloadsValueInput = document.getElementById(
      "completedDownloadsValueInput",
    );
    completedDownloadsOperatorSelect.value =
      items.completedDownloadsFilterOperator || "gt";
    completedDownloadsValueInput.value = String(
      items.completedDownloadsFilterValue ?? 0,
    );
    setCompletedDownloadsFilterControlsEnabled(
      items.completedDownloadsFilterEnabled,
    );
  },
);

function setCompletedDownloadsFilterControlsEnabled(enabled) {
  const operatorSelect = document.getElementById(
    "completedDownloadsOperatorSelect",
  );
  const valueInput = document.getElementById("completedDownloadsValueInput");
  if (operatorSelect) operatorSelect.disabled = !enabled;
  if (valueInput) valueInput.disabled = !enabled;
}

function notifyContentScriptSetting(setting, value) {
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0]?.id) return;
    browser.tabs.sendMessage(tabs[0].id, {
      type: "settingChanged",
      setting,
      value,
    });
  });
}

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
document
  .getElementById("ameNZBApiKeyTest")
  .addEventListener("click", async () => {
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
        {
          type: "fetchUrl",
          url: `https://amenzb.moe/api?t=search&apikey=${encodeURIComponent(key)}`,
        },
        resolve,
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
        browser.storage.sync.get(
          { ameNZBRequestCount: 0, ameNZBRequestDate: "" },
          (items) => {
            const count =
              items.ameNZBRequestDate === todayUTC
                ? items.ameNZBRequestCount + 1
                : 1;
            browser.storage.sync.set({
              ameNZBRequestCount: count,
              ameNZBRequestDate: todayUTC,
            });
          },
        );
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

  const ameNZBToggle = document.querySelector(
    '[data-toggle="showAmeNZBLinksToggle"]',
  );
  ameNZBToggle.disabled = true;
  ameNZBToggle.setAttribute("aria-checked", false);

  const ameNZBSectionToggle = document.querySelector(
    '[data-toggle="showAmeNZBSectionToggle"]',
  );
  ameNZBSectionToggle.disabled = true;
  ameNZBSectionToggle.setAttribute("aria-checked", false);

  browser.storage.sync.set({
    ameNZBApiKey: "",
    showAmeNZBLinks: false,
    showAmeNZBSection: false,
  });
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    browser.tabs.sendMessage(tabs[0].id, {
      type: "settingChanged",
      setting: "showAmeNZBLinks",
      value: false,
    });
    browser.tabs.sendMessage(tabs[0].id, {
      type: "settingChanged",
      setting: "showAmeNZBSection",
      value: false,
    });
  });
});

// ameNZB API key input — enable/disable toggle and persist key
document.getElementById("ameNZBApiKey").addEventListener("input", (e) => {
  const key = e.target.value.trim();
  const ameNZBToggle = document.querySelector(
    '[data-toggle="showAmeNZBLinksToggle"]',
  );
  const ameNZBSectionToggle = document.querySelector(
    '[data-toggle="showAmeNZBSectionToggle"]',
  );
  ameNZBToggle.disabled = !key;
  ameNZBSectionToggle.disabled = !key;
  if (!key) {
    ameNZBToggle.setAttribute("aria-checked", false);
    ameNZBSectionToggle.setAttribute("aria-checked", false);
    browser.storage.sync.set({
      ameNZBApiKey: "",
      showAmeNZBLinks: false,
      showAmeNZBSection: false,
    });
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "showAmeNZBLinks",
        value: false,
      });
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "showAmeNZBSection",
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
      },
    );
  }
});

// ── Torrent Client Tab ──────────────────────────────────────────────────────

const CLIENT_LABELS = {
  qbittorrent: "qBittorrent",
  transmission: "Transmission",
  deluge: "Deluge",
};

// Show/hide the username row and adjust password margin depending on client
function applyClientUI(client) {
  const usernameWrapper = document.getElementById("tcUsernameWrapper");
  const csrfDisclaimer = document.getElementById("tcQbtCsrfDisclaimer");
  if (csrfDisclaimer) {
    csrfDisclaimer.style.display =
      client === "qbittorrent" ? "block" : "none";
  }
  if (client === "deluge") {
    usernameWrapper.style.display = "none";
    // Remove top margin gap since username is gone
    usernameWrapper.nextElementSibling.style.marginTop = "0";
  } else {
    usernameWrapper.style.display = "";
    usernameWrapper.nextElementSibling.style.marginTop = "6px";
  }
}

// Populate auth fields from a storage items object for the given client
function loadClientAuth(client, items) {
  const usernameEl = document.getElementById("tcUsername");
  const passwordEl = document.getElementById("tcPassword");
  if (client === "transmission") {
    usernameEl.value = items.transmissionUsername || "";
    passwordEl.value = items.transmissionPassword || "";
  } else if (client === "deluge") {
    usernameEl.value = "";
    passwordEl.value = items.delugePassword || "";
  } else {
    usernameEl.value = items.qbtUsername || "";
    passwordEl.value = items.qbtPassword || "";
  }
}

// Persist settings for the currently selected client
function saveTorrentClientSettings() {
  const client = document.getElementById("tcClientSelect").value;
  const url = document.getElementById("tcIp").value.trim();
  const username = document.getElementById("tcUsername").value.trim();
  const password = document.getElementById("tcPassword").value;

  const settings = { torrentClient: client, torrentClientUrl: url };
  if (client === "transmission") {
    settings.transmissionUsername = username;
    settings.transmissionPassword = password;
  } else if (client === "deluge") {
    settings.delugePassword = password;
  } else {
    settings.qbtUsername = username;
    settings.qbtPassword = password;
  }
  browser.storage.sync.set(settings);
}

// Client dropdown change — reload auth fields and adjust UI
document.getElementById("tcClientSelect").addEventListener("change", (e) => {
  const client = e.target.value;
  applyClientUI(client);
  document.getElementById("tcStatus").textContent = "";
  browser.storage.sync.get(
    {
      qbtUsername: "",
      qbtPassword: "",
      transmissionUsername: "",
      transmissionPassword: "",
      delugePassword: "",
    },
    (items) => loadClientAuth(client, items),
  );
});

// Password show/hide toggle
document.getElementById("tcPasswordToggle").addEventListener("click", () => {
  const input = document.getElementById("tcPassword");
  const btn = document.getElementById("tcPasswordToggle");
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = EYE_SLASH_SVG;
  } else {
    input.type = "password";
    btn.innerHTML = EYE_SVG;
  }
});

// Save button
document.getElementById("tcSaveBtn").addEventListener("click", () => {
  saveTorrentClientSettings();
  const statusEl = document.getElementById("tcStatus");
  statusEl.textContent = "✓ Saved";
  statusEl.style.color = "#4caf50";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
});

// Firefox cannot include a port in match patterns (unlike Chrome's `${origin}/*`).
// Hostname-only patterns still cover every port on that host (e.g. :8114).
function torrentOriginsForUrl(url) {
  const u = new URL(url.trim());
  return [`${u.protocol}//${u.hostname}/*`];
}

function showTorrentTestResult(result, client, statusEl) {
  if (!result) {
    statusEl.textContent = "✗ No response from background";
    statusEl.style.color = "#ff4444";
    return;
  }
  if (result.ok) {
    const label = CLIENT_LABELS[client] || client;
    statusEl.textContent = result.version
      ? `✓ Connected! (${label} ${result.version})`
      : `✓ Connected! (${label})`;
    statusEl.style.color = "#4caf50";
    saveTorrentClientSettings();
    return;
  }
  switch (result.error) {
    case "auth_failed":
      statusEl.textContent = "✗ Authentication failed - wrong credentials";
      break;
    case "auth_required":
      statusEl.textContent = "✗ Server requires authentication";
      break;
    case "permission_denied":
      statusEl.textContent =
        "✗ Missing network permission. Click Test Connection and allow access.";
      break;
    case "wrong_client": {
      const detected =
        CLIENT_LABELS[result.detectedClient] || result.detectedClient;
      const selected = CLIENT_LABELS[client] || client;
      statusEl.textContent = `✗ This URL is ${detected}, not ${selected}. Change the client dropdown.`;
      break;
    }
    default:
      statusEl.textContent = result.message
        ? `✗ Connection failed: ${result.message}`
        : "✗ Connection failed. Check the URL";
  }
  statusEl.style.color = "#ff4444";
}

function runTorrentConnectionTest(client, url, username, password, statusEl, testBtn) {
  testBtn.disabled = true;
  statusEl.textContent = "Testing...";
  statusEl.style.color = "#999";
  browser.runtime
    .sendMessage({ type: "testConnection", client, url, username, password })
    .then((result) => {
      testBtn.disabled = false;
      showTorrentTestResult(result, client, statusEl);
    });
}

// Test Connection button — permissions.request must run in the same click turn as the
// user gesture (no await before it), or Firefox will not show the prompt.
document.getElementById("tcTestBtn").addEventListener("click", () => {
  const client = document.getElementById("tcClientSelect").value;
  const url = document.getElementById("tcIp").value.trim();
  const username = document.getElementById("tcUsername").value.trim();
  const password = document.getElementById("tcPassword").value;
  const statusEl = document.getElementById("tcStatus");
  const testBtn = document.getElementById("tcTestBtn");

  if (!url) {
    statusEl.textContent = "Enter a Torrent Client URL first.";
    statusEl.style.color = "#999";
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    statusEl.textContent = "✗ URL must start with http:// or https://";
    statusEl.style.color = "#ff4444";
    return;
  }

  try {
    new URL(url);
  } catch {
    statusEl.textContent = "✗ Invalid URL";
    statusEl.style.color = "#ff4444";
    return;
  }

  // Save settings before requesting permissions — Firefox closes the popup during
  // the permission prompt, so values must be persisted to survive the round-trip.
  saveTorrentClientSettings();

  const origins = torrentOriginsForUrl(url);
  statusEl.textContent = `Requesting access for ${new URL(url).origin}... Close the popup (if it doesnt automatically close) and accept the permission request.`;
  statusEl.style.color = "#999";

  browser.permissions.request({ origins }).then((granted) => {
    if (!granted) {
      statusEl.textContent = "✗ Host permission denied";
      statusEl.style.color = "#ff4444";
      return;
    }
    runTorrentConnectionTest(client, url, username, password, statusEl, testBtn);
  });
});

// ── End Torrent Client Tab ───────────────────────────────────────────────────

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
          },
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
          },
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
          },
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
          },
        );
        break;
      case "showATScreenshotsSectionToggle":
        setting = "showATScreenshotsSection";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showATScreenshotsSection",
              value: newState,
            });
          },
        );
        break;
      case "showATFileInfoSectionToggle":
        setting = "showATFileInfoSection";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showATFileInfoSection",
              value: newState,
            });
          },
        );
        break;
      case "showATAttachmentsSectionToggle":
        setting = "showATAttachmentsSection";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showATAttachmentsSection",
              value: newState,
            });
          },
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
          },
        );
        break;
      case "showAmeNZBSectionToggle":
        setting = "showAmeNZBSection";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showAmeNZBSection",
              value: newState,
            });
          },
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
          },
        );
        break;
      case "showNekoBTSectionToggle":
        setting = "showNekoBTSection";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showNekoBTSection",
              value: newState,
            });
          },
        );
        break;
      case "showNekoBTFullLangNamesToggle":
        setting = "showNekoBTFullLangNames";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showNekoBTFullLangNames",
              value: newState,
            });
          },
        );
        break;
      case "showTsukihimeLinksToggle":
        setting = "showTsukihimeLinks";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showTsukihimeLinks",
              value: newState,
            });
          },
        );
        break;
      case "showTsukihimeSectionToggle":
        setting = "showTsukihimeSection";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showTsukihimeSection",
              value: newState,
            });
          },
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
          },
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
          },
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
          },
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
          },
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
          },
        );
        break;
      case "improvedFileListToggle":
        setting = "improvedFileList";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "improvedFileList",
              value: newState,
            });
          },
        );
        break;
      case "fileSizeFilterToggle":
        setting = "fileSizeFilterEnabled";
        document.getElementById("sizeRangeSelect").disabled = !newState;
        notifyContentScriptSetting("fileSizeFilterEnabled", newState);
        break;
      case "completedDownloadsFilterToggle":
        setting = "completedDownloadsFilterEnabled";
        setCompletedDownloadsFilterControlsEnabled(newState);
        notifyContentScriptSetting("completedDownloadsFilterEnabled", newState);
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
          },
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
          },
        );
        break;
      case "showSendButtonsToggle":
        setting = "showSendButtons";
        browser.storage.sync.set({ [setting]: newState });
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showSendButtons",
              value: newState,
            });
          },
        );
        break;
      case "showSeaDexToggle":
        setting = "showSeaDex";
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "showSeaDex",
              value: newState,
            });
          },
        );
        break;
      case "screenshotPreviewToggle":
        setting = "screenshotPreviewEnabled";
        setScreenshotPreviewInputsEnabled(newState);
        browser.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            browser.tabs.sendMessage(tabs[0].id, {
              type: "settingChanged",
              setting: "screenshotPreviewEnabled",
              value: newState,
            });
          },
        );
        break;
    }
    browser.storage.sync.set({ [setting]: newState });
  });
});

// Screenshot Preview delay inputs — persist values and notify content script
function attachScreenshotPreviewInputHandler(
  inputId,
  settingKey,
  defaultValue,
  minValue,
) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const commitValue = () => {
    let value = parseFloat(input.value);
    if (!isFinite(value) || value < minValue) {
      value = defaultValue;
      input.value = value;
    }
    browser.storage.sync.set({ [settingKey]: value });
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: settingKey,
        value,
      });
    });
  };

  input.addEventListener("change", commitValue);
  input.addEventListener("blur", commitValue);
}

attachScreenshotPreviewInputHandler(
  "screenshotPreviewHoverDelay",
  "screenshotPreviewHoverDelay",
  2,
  0,
);
attachScreenshotPreviewInputHandler(
  "screenshotPreviewSlideDelay",
  "screenshotPreviewSlideDelay",
  2,
  0.1,
);

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
      (k) => k.keyword !== keywordToRemove,
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
  notifyContentScriptSetting("fileSizeRange", newValue);
});

document
  .getElementById("completedDownloadsOperatorSelect")
  .addEventListener("change", (e) => {
    const newValue = e.target.value;
    browser.storage.sync.set({ completedDownloadsFilterOperator: newValue });
    notifyContentScriptSetting("completedDownloadsFilterOperator", newValue);
  });

document
  .getElementById("completedDownloadsValueInput")
  .addEventListener("change", (e) => {
    const parsed = parseInt(e.target.value, 10);
    const newValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    e.target.value = String(newValue);
    browser.storage.sync.set({ completedDownloadsFilterValue: newValue });
    notifyContentScriptSetting("completedDownloadsFilterValue", newValue);
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
      (user) => user.username !== username,
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
