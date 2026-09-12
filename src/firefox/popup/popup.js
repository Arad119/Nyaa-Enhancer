import { resolveNyaaSettingsTarget } from "../shared/domains.js";
import { getPreferences, savePreferences } from "../shared/prefs.js";

async function applySettingsPageLinks() {
  const links = document.querySelectorAll(".ne-settings-page-link");
  if (!links.length) return;

  const target = await resolveNyaaSettingsTarget();
  links.forEach((link) => {
    link.href = target.url;
  });
}

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

async function openNyaaSettingsPage(event) {
  if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
    return;
  }

  event.preventDefault();
  const target = await resolveNyaaSettingsTarget();
  if (target.sameTab && target.tabId) {
    await browser.tabs.update(target.tabId, { url: target.url });
  } else {
    await browser.tabs.create({ url: target.url });
  }
  window.close();
}

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

function wireSettingsPageLinks() {
  document.querySelectorAll(".ne-settings-page-link").forEach((link) => {
    link.addEventListener("click", openNyaaSettingsPage);
  });
  applySettingsPageLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSettingsPageLinks);
} else {
  wireSettingsPageLinks();
}

// Initialize popup state from storage
getPreferences(
  {
    ameNZBApiKey: "",
    tmdbApiKey: "",
    torrentClient: "qbittorrent",
    torrentClientUrl: "",
    qbtUsername: "",
    qbtPassword: "",
    transmissionUsername: "",
    transmissionPassword: "",
    delugePassword: "",
  },
  (items) => {
    const tc = items.torrentClient || "qbittorrent";
    document.getElementById("tcClientSelect").value = tc;
    document.getElementById("tcIp").value = items.torrentClientUrl || "";
    loadClientAuth(tc, items);
    applyClientUI(tc);

    const ameNZBApiKeyInput = document.getElementById("ameNZBApiKey");
    ameNZBApiKeyInput.value = items.ameNZBApiKey || "";

    const tmdbApiKeyInput = document.getElementById("tmdbApiKey");
    if (tmdbApiKeyInput) {
      tmdbApiKeyInput.value = items.tmdbApiKey || "";
    }
  },
);

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
        getPreferences(
          { ameNZBRequestCount: 0, ameNZBRequestDate: "" },
          (items) => {
            const count =
              items.ameNZBRequestDate === todayUTC
                ? items.ameNZBRequestCount + 1
                : 1;
            savePreferences({
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

  savePreferences({
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

// TMDB API key visibility toggle
document.getElementById("tmdbApiKeyToggle").addEventListener("click", () => {
  const input = document.getElementById("tmdbApiKey");
  const btn = document.getElementById("tmdbApiKeyToggle");
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = EYE_SLASH_SVG;
  } else {
    input.type = "password";
    btn.innerHTML = EYE_SVG;
  }
});

// TMDB Test button — validate the API key
document.getElementById("tmdbApiKeyTest").addEventListener("click", async () => {
  const key = document.getElementById("tmdbApiKey").value.trim();
  const statusEl = document.getElementById("tmdbTestStatus");
  const testBtn = document.getElementById("tmdbApiKeyTest");

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
        url: `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
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
    const json = JSON.parse(result.text);
    if (json.success === false || json.status_code) {
      statusEl.textContent = `✗ ${json.status_message || "Invalid API key."}`;
      statusEl.style.color = "#ff4444";
      return;
    }
    if (json.images || json.change_keys) {
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

// TMDB Clear button
document.getElementById("tmdbApiKeyClear").addEventListener("click", () => {
  const input = document.getElementById("tmdbApiKey");
  input.value = "";
  input.type = "password";
  document.getElementById("tmdbApiKeyToggle").innerHTML = EYE_SVG;
  document.getElementById("tmdbTestStatus").textContent = "";

  savePreferences({ tmdbApiKey: "" });
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "tmdbApiKey",
        value: "",
      });
    }
  });
});

// TMDB API key input — persist key
document.getElementById("tmdbApiKey").addEventListener("input", (e) => {
  const key = e.target.value.trim();
  savePreferences({ tmdbApiKey: key });
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "tmdbApiKey",
        value: key,
      });
    }
  });
});

// ameNZB API key input — persist key and reset toggles when cleared
document.getElementById("ameNZBApiKey").addEventListener("input", (e) => {
  const key = e.target.value.trim();
  if (!key) {
    savePreferences({
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
    savePreferences({ ameNZBApiKey: key });
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        type: "settingChanged",
        setting: "ameNZBApiKey",
        value: key,
      });
    });
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
    csrfDisclaimer.style.display = client === "qbittorrent" ? "block" : "none";
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
  savePreferences(settings);
}

// Client dropdown change — reload auth fields and adjust UI
document.getElementById("tcClientSelect").addEventListener("change", (e) => {
  const client = e.target.value;
  applyClientUI(client);
  document.getElementById("tcStatus").textContent = "";
  getPreferences(
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

function runTorrentConnectionTest(
  client,
  url,
  username,
  password,
  statusEl,
  testBtn,
) {
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
    runTorrentConnectionTest(
      client,
      url,
      username,
      password,
      statusEl,
      testBtn,
    );
  });
});

// ── End Torrent Client Tab ───────────────────────────────────────────────────

// Get version from manifest.json and update the version number in popup
fetch(browser.runtime.getURL("manifest.json"))
  .then((response) => response.json())
  .then((manifest) => {
    document.querySelector(".version-number").textContent = manifest.version;
  });

