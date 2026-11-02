import {
  PREFS_EXPORT_FORMAT,
  PREFS_EXPORT_VERSION,
  exportPreferences,
  getPreferences,
  importPreferences,
  loadStoredPreferences,
  resetPreferences,
  savePreferences,
} from "../../../shared/prefs.js";
import {
  isExtensionPage,
  sendMessageToNyaaTabs,
} from "../../../shared/domains.js";
import { getKeywordSearchUrl, setNyaaOriginFallback } from "../../../shared/urls.js";
import { NE_DEFAULT_HIGHLIGHT_COLOR, checkMonitoredUsers, getHighlightRules, handleSettingChange, normalizeHighlightColor } from "../../internal.js";
import { NAVBAR_VISIBILITY_TOGGLES } from "../../features/navbar/index.js";
import { clearSimilarCaches, formatSimilarCacheBytes, getBytesInUse, getSimilarCacheUsage, isSimilarCacheKey } from "../../features/similar/cache.js";
import { XEM_ALL_NAMES_STORAGE_KEYS, clearXemNameCache } from "../../features/quick-search/index.js";
import {
  CLOUD_SYNC_CHECK_OPTIONS,
  CLOUD_SYNC_STATE_KEY,
  cloudSyncErrorMessage,
  normalizeCloudSyncCheckMinutes,
  validateWebdavUrl,
} from "../../../shared/webdav.js";
import {
  HISTORY_MAX_EVENTS_MAX,
  HISTORY_MAX_EVENTS_MIN,
  clearHistory,
  importHistoryState,
  loadHistoryState,
  neNormalizeHistoryMaxEvents,
} from "../../features/history/store.js";

// ── Settings Page ───────────────────────────────────────────────────────────

export const NE_SETTINGS_NAV_SECTIONS = [
  { id: "ne-settings-download", label: "Download" },
  { id: "ne-settings-interface", label: "Interface" },
  { id: "ne-settings-navbar", label: "Navbar" },
  { id: "ne-settings-filters", label: "Filters" },
  { id: "ne-settings-quicksearch", label: "Quick Search" },
  { id: "ne-settings-autoload", label: "Auto-load" },
  { id: "ne-settings-history", label: "History" },
  { id: "ne-settings-view", label: "View Page" },
  { id: "ne-settings-monitoring", label: "Monitoring" },
  { id: "ne-settings-animetosho", label: "AnimeTosho" },
  { id: "ne-settings-amenzb", label: "ameNZB" },
  { id: "ne-settings-nekobt", label: "nekoBT" },
  { id: "ne-settings-tsukihime", label: "Tsukihime" },
  { id: "ne-settings-similar", label: "Similar Anime" },
  { id: "ne-settings-features", label: "Additional Features" },
  { id: "ne-settings-highlights", label: "Highlights" },
  { id: "ne-settings-qbt", label: "qBittorrent" },
  { id: "ne-settings-cloud", label: "Cloud Sync" },
  { id: "ne-settings-cache", label: "Cache" },
  { id: "ne-settings-backup", label: "Backup & Reset" },
];

export function neSettingsCreateToggleRow(settingKey, label, hint = "", dependsOn = null) {
  const row = document.createElement("div");
  row.className = "ne-settings-row";
  if (dependsOn) row.dataset.dependsOn = dependsOn;
  row.innerHTML = `
    <div class="ne-settings-row__info">
      <span class="ne-settings-row__label">${label}</span>
      ${hint ? `<span class="ne-settings-row__hint">${hint}</span>` : ""}
    </div>
    <button type="button" class="ne-settings-toggle is-off" data-setting="${settingKey}" role="switch" aria-checked="false">
      <span class="ne-settings-toggle__thumb"></span>
    </button>
  `;
  return row;
}

export function neSettingsNormalizeShowMoreUntilVisible(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 150;
  return Math.min(1000, parsed);
}

export const NE_SETTINGS_AUTOLOAD_DELAY_DEFAULT_SEC = 2.5;
export const NE_SETTINGS_AUTOLOAD_DELAY_MIN_SEC = 0.1;
export const NE_SETTINGS_AUTOLOAD_DELAY_MAX_SEC = 60;

export function neSettingsNormalizeShowMoreAutoDelaySeconds(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return NE_SETTINGS_AUTOLOAD_DELAY_DEFAULT_SEC;
  const clamped = Math.min(
    NE_SETTINGS_AUTOLOAD_DELAY_MAX_SEC,
    Math.max(NE_SETTINGS_AUTOLOAD_DELAY_MIN_SEC, parsed),
  );
  return Math.round(clamped * 10) / 10;
}

export function neSettingsShowMoreAutoDelaySecondsToMs(seconds) {
  return Math.round(neSettingsNormalizeShowMoreAutoDelaySeconds(seconds) * 1000);
}

export function neSettingsShowMoreAutoDelayMsToSeconds(ms) {
  const parsed = Number(ms);
  if (!Number.isFinite(parsed)) return NE_SETTINGS_AUTOLOAD_DELAY_DEFAULT_SEC;
  return neSettingsNormalizeShowMoreAutoDelaySeconds(parsed / 1000);
}

export async function neSettingsSave(settingKey, value) {
  try {
    if (settingKey === "changelogDismissed") {
      await savePreferences({
        changelogDismissed: !value,
        tempDismissed: !value,
      });
    } else {
      await savePreferences({ [settingKey]: value });
    }
  } catch {
    return false;
  }
  try {
    if (!isExtensionPage()) {
      await handleSettingChange(settingKey, value);
    }
    await sendMessageToNyaaTabs({
      type: "settingChanged",
      setting: settingKey,
      value,
    });
  } catch (error) {
    console.error("[Nyaa Enhancer] Failed to broadcast setting change.", error);
  }
  return true;
}

export function neSettingsSyncToggleVisual(toggle, checked) {
  if (!toggle) return;
  const isOn = !!checked;
  toggle.setAttribute("aria-checked", String(isOn));
  toggle.classList.toggle("is-on", isOn);
  toggle.classList.toggle("is-off", !isOn);
}

export function neSettingsSetToggleState(settingKey, checked) {
  const toggle = document.querySelector(
    `.ne-settings-page [data-setting="${settingKey}"]`,
  );
  neSettingsSyncToggleVisual(toggle, checked);
}

export function neSettingsUpdateDependentRows(buttonsEnabled) {
  document
    .querySelectorAll(".ne-settings-page [data-depends-on='showButtons']")
    .forEach((row) => {
      row.classList.toggle("is-disabled", !buttonsEnabled);
    });
}

export function neSettingsUpdateAutoLoadSection(enabled) {
  const on = enabled !== false;
  document
    .querySelectorAll(".ne-settings-page [data-depends-on='showAutoLoad']")
    .forEach((el) => {
      el.classList.toggle("is-disabled", !on);
      el.querySelectorAll("button, input").forEach((control) => {
        if (control.classList.contains("ne-settings-toggle") && control.dataset.setting === "showAutoLoad") {
          return;
        }
        control.disabled = !on;
      });
    });
}

export function neSettingsUpdateScreenshotInputs(enabled) {
  const hover = document.getElementById("ne-sp-hover-delay");
  const slide = document.getElementById("ne-sp-slide-delay");
  const disclaimer = document.getElementById("ne-sp-disclaimer");
  if (hover) hover.disabled = !enabled;
  if (slide) slide.disabled = !enabled;
  if (disclaimer) disclaimer.classList.toggle("is-visible", !!enabled);
}

export function neSettingsUpdateAmeNZBState(hasApiKey) {
  document
    .querySelectorAll(".ne-settings-page [data-depends-on='ameNZBApiKey']")
    .forEach((row) => {
      row.classList.toggle("is-disabled", !hasApiKey);
      const toggle = row.querySelector(".ne-settings-toggle");
      if (toggle) toggle.disabled = !hasApiKey;
    });
}

export function neSettingsUpdateAmeNZBQuota(prefs) {
  const el = document.getElementById("ne-amenzb-request-count");
  if (!el) return;
  const todayUTC = new Date().toISOString().slice(0, 10);
  const todayCount =
    prefs.ameNZBRequestDate === todayUTC ? prefs.ameNZBRequestCount : 0;
  el.textContent = `${todayCount.toLocaleString()} / 10,000`;
}

export function neSettingsWireToggles() {
  document.querySelectorAll(".ne-settings-page .ne-settings-toggle[data-setting]").forEach((toggle) => {
    toggle.addEventListener("click", async () => {
      if (toggle.disabled) return;
      const settingKey = toggle.dataset.setting;
      const newState = toggle.getAttribute("aria-checked") !== "true";
      toggle.disabled = true;
      const saved = await neSettingsSave(settingKey, newState);
      toggle.disabled = false;
      if (!saved) return;

      neSettingsSyncToggleVisual(toggle, newState);

      if (settingKey === "showButtons") {
        neSettingsUpdateDependentRows(newState);
      }
      if (settingKey === "showAutoLoad") {
        neSettingsUpdateAutoLoadSection(newState);
      }
      if (settingKey === "screenshotPreviewEnabled") {
        neSettingsUpdateScreenshotInputs(newState);
      }
      if (settingKey === "showSimilarSection") {
        neSettingsUpdateSimilarVibeInputs(newState);
      }
      if (settingKey === "similarUseTmdbRecs") {
        neSettingsUpdateSimilarTmdbDisclaimer(newState);
      }
      if (settingKey === "qbtPromptOnSend") {
        neSettingsSaveQbtDefaults();
      }
    });
  });
}

function neSettingsNormalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NE_SETTINGS_SEARCH_SELECTORS = [
  ".ne-settings-section__title",
  ".ne-settings-row__label",
  ".ne-settings-subsection__title",
  ".ne-settings-field > label",
  ".ne-settings-monitor-tab",
].join(", ");

function neSettingsSearchableText(section) {
  const parts = [];
  const navLabel =
    NE_SETTINGS_NAV_SECTIONS.find((item) => item.id === section.id)?.label || "";
  if (navLabel) parts.push(navLabel);
  section.querySelectorAll(NE_SETTINGS_SEARCH_SELECTORS).forEach((el) => {
    const text = el.textContent || "";
    if (text) parts.push(text);
  });
  return parts.join(" ");
}

export function neSettingsApplySearch(rawQuery) {
  const page = document.querySelector(".ne-settings-page");
  if (!page) return;

  const query = neSettingsNormalizeSearch(rawQuery);
  const clearBtn = document.getElementById("ne-settings-search-clear");
  const status = document.getElementById("ne-settings-search-status");
  const empty = document.getElementById("ne-settings-search-empty");
  if (clearBtn) clearBtn.hidden = !query;

  const sections = [...page.querySelectorAll(".ne-settings-section")];
  let visibleCount = 0;

  sections.forEach((section) => {
    section.classList.remove("ne-settings-search-hidden");
    if (section.hidden) return;
    if (!query) {
      visibleCount += 1;
      return;
    }

    const matches = neSettingsNormalizeSearch(
      neSettingsSearchableText(section),
    ).includes(query);
    section.classList.toggle("ne-settings-search-hidden", !matches);
    if (matches) visibleCount += 1;
  });

  page.querySelectorAll(".ne-settings-nav__link").forEach((link) => {
    const section = document.getElementById(link.dataset.target);
    const hide =
      !!query &&
      (!section ||
        section.hidden ||
        section.classList.contains("ne-settings-search-hidden"));
    link.classList.toggle("ne-settings-search-hidden", hide);
  });

  page.classList.toggle(
    "ne-settings-search-no-results",
    !!query && visibleCount === 0,
  );

  if (empty) {
    empty.hidden = !query || visibleCount > 0;
    if (!empty.hidden) {
      empty.textContent = `No settings match “${String(rawQuery || "").trim()}”.`;
    }
  }

  if (status) {
    if (!query || visibleCount === 0) {
      status.textContent = "";
      return;
    }
    status.textContent = `${visibleCount} section${visibleCount === 1 ? "" : "s"}`;
  }
}

export function neSettingsWireSearch() {
  const input = document.getElementById("ne-settings-search");
  const clearBtn = document.getElementById("ne-settings-search-clear");
  if (!input) return;

  const apply = () => neSettingsApplySearch(input.value);
  input.addEventListener("input", apply);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (input.value) {
      event.preventDefault();
      input.value = "";
      apply();
      return;
    }
    input.blur();
  });
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    apply();
  });
}

// The highlighted nav link follows the section under a reading line near the
// top of the window. After a nav click it stays on the clicked section until
// the user scrolls themselves (sections near the bottom can't always reach
// the top, and the smooth scroll passes other sections on the way).
const NE_SETTINGS_NAV_READING_LINE = 0.25;
const NE_SETTINGS_NAV_SCROLL_SETTLE_MS = 150;

export function neSettingsWireNav() {
  const navLinks = [...document.querySelectorAll(".ne-settings-nav__link")];
  if (!navLinks.length) return;

  let clickedTarget = "";
  let autoScrolling = false;
  let settleTimer = 0;
  let frame = 0;

  const setActive = (id) => {
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.target === id);
    });
  };

  const visibleSections = () =>
    NE_SETTINGS_NAV_SECTIONS.map((item) => document.getElementById(item.id)).filter(
      (section) =>
        section &&
        !section.hidden &&
        !section.classList.contains("ne-settings-search-hidden") &&
        section.getClientRects().length > 0,
    );

  const updateFromScroll = () => {
    frame = 0;
    if (clickedTarget) return;
    const sections = visibleSections();
    if (!sections.length) return;
    const line = window.innerHeight * NE_SETTINGS_NAV_READING_LINE;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top > line) break;
      current = section;
    }
    setActive(current.id);
  };

  // Ends the "clicked" state once the click's own smooth scroll has stopped
  // and the user scrolls again.
  const onScroll = () => {
    if (autoScrolling) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        autoScrolling = false;
      }, NE_SETTINGS_NAV_SCROLL_SETTLE_MS);
      return;
    }
    clickedTarget = "";
    if (!frame) frame = requestAnimationFrame(updateFromScroll);
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const section = document.getElementById(link.dataset.target);
      if (!section) return;
      clickedTarget = link.dataset.target;
      autoScrolling = true;
      setActive(clickedTarget);
      // If the page doesn't need to move, no scroll events arrive at all.
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        autoScrolling = false;
      }, NE_SETTINGS_NAV_SCROLL_SETTLE_MS * 3);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Scrolling by hand during the click's smooth scroll takes over at once.
  const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const userTookOver = () => {
    autoScrolling = false;
    clearTimeout(settleTimer);
  };
  window.addEventListener("wheel", userTookOver, { passive: true });
  window.addEventListener("touchmove", userTookOver, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (SCROLL_KEYS.has(event.key) && !event.target.closest?.("input, textarea, select")) {
      userTookOver();
    }
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    if (!frame) frame = requestAnimationFrame(updateFromScroll);
  });
  updateFromScroll();
}

export async function neSettingsLoadValues() {
  const prefs = await loadStoredPreferences();

  const boolSettings = {
    useDisplayName: prefs.useDisplayName,
    useZip: prefs.useZip,
    showButtons: prefs.showButtons,
    showQuickFilter: prefs.showQuickFilter,
    showMagnetButtons: prefs.showMagnetButtons,
    showSendButtons: prefs.showSendButtons,
    showMonitorButtons: prefs.showMonitorButtons,
    showScrollToTop: prefs.showScrollToTop !== false,
    showFilterNotifications: prefs.showFilterNotifications,
    showFiltersPanel: prefs.showFiltersPanel !== false,
    showAutoLoad: prefs.showAutoLoad !== false,
    showMoreAutoEnabled: !!prefs.showMoreAutoEnabled,
    hideComments: prefs.hideComments,
    improvedFileList: prefs.improvedFileList,
    copyTorrentTitle: prefs.copyTorrentTitle,
    copyTorrentInfoHash: prefs.copyTorrentInfoHash,
    showATLinks: prefs.showATLinks,
    showATComments: prefs.showATComments,
    showATScreenshotsSection: prefs.showATScreenshotsSection,
    showATFileInfoSection: prefs.showATFileInfoSection,
    showATAttachmentsSection: prefs.showATAttachmentsSection,
    showNekoBTLinks: prefs.showNekoBTLinks,
    showNekoBTSection: prefs.showNekoBTSection,
    showNekoBTFullLangNames: prefs.showNekoBTFullLangNames,
    showTsukihimeLinks: prefs.showTsukihimeLinks,
    showTsukihimeSection: prefs.showTsukihimeSection,
    showSimilarSection: prefs.showSimilarSection !== false,
    similarUseTmdbRecs: !!prefs.similarUseTmdbRecs,
    similarOpenAccordions: !!prefs.similarOpenAccordions,
    similarCardDetailsEnabled: prefs.similarCardDetailsEnabled !== false,
    similarOpenQuickSearch: !!prefs.similarOpenQuickSearch,
    showAmeNZBLinks: prefs.showAmeNZBLinks,
    showAmeNZBSection: prefs.showAmeNZBSection,
    screenshotPreviewEnabled: prefs.screenshotPreviewEnabled,
    showSeaDex: prefs.showSeaDex,
    prioritizeSeaDexHighlights: prefs.prioritizeSeaDexHighlights !== false,
    showChangelogNav: prefs.showChangelogNav,
    showNavbarUpload: prefs.showNavbarUpload !== false,
    showNavbarInfo: prefs.showNavbarInfo !== false,
    showNavbarRss: prefs.showNavbarRss !== false,
    showNavbarTwitter: prefs.showNavbarTwitter !== false,
    showNavbarFap: prefs.showNavbarFap !== false,
    showNavbarFilter: prefs.showNavbarFilter !== false,
    showNavbarCategory: prefs.showNavbarCategory !== false,
    showNavbarAccount: prefs.showNavbarAccount !== false,
    historyEnabled: !!prefs.historyEnabled,
    qbtPromptOnSend: prefs.qbtPromptOnSend !== false,
    cloudSyncEnabled: !!prefs.cloudSyncEnabled,
    cloudSyncIncludeCredentials: !!prefs.cloudSyncIncludeCredentials,
    cloudSyncIncludeHistory: !!prefs.cloudSyncIncludeHistory,
  };

  Object.entries(boolSettings).forEach(([key, value]) => {
    neSettingsSetToggleState(key, value);
  });

  neSettingsSetToggleState("changelogDismissed", !prefs.changelogDismissed);

  neSettingsUpdateDependentRows(prefs.showButtons);
  neSettingsUpdateAutoLoadSection(prefs.showAutoLoad !== false);
  neSettingsUpdateScreenshotInputs(prefs.screenshotPreviewEnabled);
  neSettingsUpdateAmeNZBState(!!prefs.ameNZBApiKey);
  neSettingsUpdateAmeNZBQuota(prefs);

  const hoverInput = document.getElementById("ne-sp-hover-delay");
  const slideInput = document.getElementById("ne-sp-slide-delay");
  if (hoverInput) hoverInput.value = prefs.screenshotPreviewHoverDelay;
  if (slideInput) slideInput.value = prefs.screenshotPreviewSlideDelay;
  const historyMaxInput = document.getElementById("ne-history-max-events");
  if (historyMaxInput) {
    historyMaxInput.value = String(
      neNormalizeHistoryMaxEvents(prefs.historyMaxEvents),
    );
  }
  const animeProvider = document.getElementById("ne-quicksearch-provider");
  if (animeProvider) {
    animeProvider.value =
      prefs.quickSearchAnimeProvider === "tmdb" ? "tmdb" : "tenrai";
  }
  const showMoreUntil = document.getElementById("ne-show-more-until-visible");
  if (showMoreUntil) {
    showMoreUntil.value = String(
      neSettingsNormalizeShowMoreUntilVisible(prefs.showMoreUntilVisible),
    );
  }
  const showMoreDelay = document.getElementById("ne-show-more-auto-delay");
  if (showMoreDelay) {
    showMoreDelay.value = String(
      neSettingsShowMoreAutoDelayMsToSeconds(prefs.showMoreAutoDelayMs),
    );
  }
  neSettingsSetVibeMix(
    prefs.similarVibeGenreWeight,
    prefs.similarVibeTagWeight,
    prefs.similarVibeStudioWeight,
  );
  neSettingsUpdateSimilarVibeInputs(prefs.showSimilarSection !== false);
  neSettingsUpdateSimilarTmdbDisclaimer(!!prefs.similarUseTmdbRecs);

  const qbtSection = document.getElementById("ne-settings-qbt");
  if (qbtSection) {
    qbtSection.hidden = prefs.torrentClient !== "qbittorrent";
  }

  if (prefs.torrentClient === "qbittorrent") {
    neSettingsLoadQbtCategoryTagSettings(prefs);
  }

  neSettingsDisplayHighlightKeywords(prefs.highlightKeywords || []);
  await neSettingsLoadMonitoringLists();

  const searchInput = document.getElementById("ne-settings-search");
  if (searchInput?.value) neSettingsApplySearch(searchInput.value);
}

export function neSettingsFormatTimeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  }
  const hours = Math.round(diffMins / 60);
  return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
}

export function neSettingsDisplayMonitoredUsers(monitoredUsers) {
  const listEl = document.getElementById("ne-monitored-users-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (!monitoredUsers?.length) {
    listEl.innerHTML =
      '<p class="ne-settings-monitor-empty">You are not monitoring any users yet. Visit a user page and click the Monitor button to start tracking.</p>';
    return;
  }

  monitoredUsers.forEach((user) => {
    const hasNewTorrents = user.torrentCount > (user.lastDismissedCount || 0);
    const newTorrentsCount = hasNewTorrents
      ? user.torrentCount - (user.lastDismissedCount || 0)
      : 0;
    const lastChecked = user.lastChecked ? new Date(user.lastChecked) : new Date();

    const item = document.createElement("div");
    item.className = "ne-settings-monitor-item";
    item.innerHTML = `
      <div class="ne-settings-monitor-item__info">
        <a class="ne-settings-monitor-item__title" href="${user.url}" target="_blank" rel="noopener"></a>
        <div class="ne-settings-monitor-item__meta">
          <span>${user.torrentCount} torrents</span>
          ${hasNewTorrents ? `<span class="ne-settings-monitor-item__new">${newTorrentsCount} new</span>` : ""}
          <span>Checked ${neSettingsFormatTimeAgo(lastChecked)}</span>
        </div>
      </div>
    `;
    item.querySelector(".ne-settings-monitor-item__title").textContent =
      user.username;

    const unmonitorBtn = document.createElement("button");
    unmonitorBtn.type = "button";
    unmonitorBtn.className = "ne-settings-btn ne-settings-btn--ghost ne-settings-btn--small";
    unmonitorBtn.textContent = "Unmonitor";
    unmonitorBtn.addEventListener("click", () =>
      neSettingsUnmonitorUser(user.username),
    );
    item.appendChild(unmonitorBtn);
    listEl.appendChild(item);
  });
}

export function neSettingsDisplayMonitoredKeywords(monitoredKeywords) {
  const listEl = document.getElementById("ne-monitored-keywords-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (!monitoredKeywords?.length) {
    listEl.innerHTML =
      '<p class="ne-settings-monitor-empty">You are not monitoring any keywords yet. Add one above or use the Keyword Monitor button on the torrent list.</p>';
    return;
  }

  monitoredKeywords.forEach((keywordObj) => {
    const lastChecked = keywordObj.lastCheckedAt
      ? new Date(keywordObj.lastCheckedAt)
      : new Date();

    const item = document.createElement("div");
    item.className = "ne-settings-monitor-item";
    item.innerHTML = `
      <div class="ne-settings-monitor-item__info">
        <a class="ne-settings-monitor-item__title" href="${getKeywordSearchUrl(keywordObj.keyword)}" target="_blank" rel="noopener"></a>
        <div class="ne-settings-monitor-item__meta">
          <span>Checked ${neSettingsFormatTimeAgo(lastChecked)}</span>
        </div>
      </div>
    `;
    item.querySelector(".ne-settings-monitor-item__title").textContent =
      keywordObj.keyword;

    const unmonitorBtn = document.createElement("button");
    unmonitorBtn.type = "button";
    unmonitorBtn.className = "ne-settings-btn ne-settings-btn--ghost ne-settings-btn--small";
    unmonitorBtn.textContent = "Unmonitor";
    unmonitorBtn.addEventListener("click", () =>
      neSettingsRemoveMonitoredKeyword(keywordObj.keyword),
    );
    item.appendChild(unmonitorBtn);
    listEl.appendChild(item);
  });
}

export async function neSettingsLoadMonitoringLists() {
  const prefs = await loadStoredPreferences();
  neSettingsDisplayMonitoredUsers(prefs.monitoredUsers || []);
  neSettingsDisplayMonitoredKeywords(prefs.monitoredKeywords || []);
}

export function neSettingsNotifyMonitoringChanged() {
  if (!isExtensionPage()) {
    checkMonitoredUsers();
  }
  sendMessageToNyaaTabs({ type: "refreshMonitoring" });
}

export function neSettingsUnmonitorUser(username) {
  getPreferences({ monitoredUsers: [] }, (items) => {
    const monitoredUsers = items.monitoredUsers.filter(
      (user) => user.username !== username,
    );
    savePreferences({ monitoredUsers }, () => {
      neSettingsDisplayMonitoredUsers(monitoredUsers);
      neSettingsNotifyMonitoringChanged();
    });
  });
}

export function neSettingsUnmonitorAllUsers() {
  savePreferences({ monitoredUsers: [] }, () => {
    neSettingsDisplayMonitoredUsers([]);
    neSettingsNotifyMonitoringChanged();
  });
}

export function neSettingsAddMonitoredKeyword() {
  const input = document.getElementById("ne-monitor-keyword-input");
  const keyword = input?.value.trim();
  if (!keyword) return;

  getPreferences({ monitoredKeywords: [] }, (items) => {
    const monitoredKeywords = items.monitoredKeywords || [];
    if (monitoredKeywords.some((k) => k.keyword === keyword)) {
      input.value = "";
      return;
    }
    monitoredKeywords.push({
      keyword,
      url: getKeywordSearchUrl(keyword),
      lastTorrentId: 0,
      lastDismissedTorrentId: 0,
    });
    savePreferences({ monitoredKeywords }, () => {
      neSettingsDisplayMonitoredKeywords(monitoredKeywords);
      input.value = "";
      neSettingsNotifyMonitoringChanged();
    });
  });
}

export function neSettingsRemoveMonitoredKeyword(keywordToRemove) {
  getPreferences({ monitoredKeywords: [] }, (items) => {
    const monitoredKeywords = items.monitoredKeywords.filter(
      (k) => k.keyword !== keywordToRemove,
    );
    savePreferences({ monitoredKeywords }, () => {
      neSettingsDisplayMonitoredKeywords(monitoredKeywords);
      checkMonitoredUsers();
    });
  });
}

export function neSettingsRemoveAllMonitoredKeywords() {
  savePreferences({ monitoredKeywords: [] }, () => {
    neSettingsDisplayMonitoredKeywords([]);
    checkMonitoredUsers();
  });
}

export function neSettingsWireMonitoringSection() {
  document.querySelectorAll(".ne-settings-monitor-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const panelId = tab.dataset.monitorTab;
      document.querySelectorAll(".ne-settings-monitor-tab").forEach((t) => {
        t.classList.toggle("is-active", t === tab);
      });
      document.getElementById("ne-monitor-users-panel").hidden =
        panelId !== "users";
      document.getElementById("ne-monitor-keywords-panel").hidden =
        panelId !== "keywords";
    });
  });

  document
    .getElementById("ne-unmonitor-all-users")
    ?.addEventListener("click", neSettingsUnmonitorAllUsers);
  document
    .getElementById("ne-unmonitor-all-keywords")
    ?.addEventListener("click", neSettingsRemoveAllMonitoredKeywords);
  document
    .getElementById("ne-add-monitor-keyword")
    ?.addEventListener("click", neSettingsAddMonitoredKeyword);
  document
    .getElementById("ne-monitor-keyword-input")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") neSettingsAddMonitoredKeyword();
    });
}

export function neSettingsDisplayHighlightKeywords(highlightKeywords) {
  const listEl = document.getElementById("ne-hl-keywords-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  const rules = getHighlightRules({ highlightKeywords });
  if (!rules.length) {
    const empty = document.createElement("p");
    empty.className = "ne-settings-monitor-empty";
    empty.textContent =
      "No highlight keywords yet. Add a phrase and color above to tint matching torrent rows.";
    listEl.appendChild(empty);
    return;
  }

  rules.forEach((rule) => {
    const item = document.createElement("div");
    item.className = "ne-settings-hl-item";
    item.style.setProperty("--ne-hl-swatch", rule.color);

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "ne-settings-hl-color";
    colorInput.value = rule.color;
    colorInput.title = "Change highlight color";
    colorInput.setAttribute("aria-label", `Color for ${rule.keyword}`);
    colorInput.addEventListener("change", () => {
      neSettingsUpdateHighlightColor(rule.keyword, colorInput.value);
    });

    const info = document.createElement("div");
    info.className = "ne-settings-hl-item__info";
    const title = document.createElement("span");
    title.className = "ne-settings-hl-item__keyword";
    title.textContent = rule.keyword;
    const hex = document.createElement("span");
    hex.className = "ne-settings-hl-item__hex";
    hex.textContent = rule.color;
    info.append(title, hex);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "ne-settings-btn ne-settings-btn--ghost ne-settings-btn--small";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () =>
      neSettingsRemoveHighlightKeyword(rule.keyword),
    );

    item.append(colorInput, info, removeBtn);
    listEl.appendChild(item);
  });
}

export async function neSettingsAddHighlightKeyword() {
  const input = document.getElementById("ne-hl-keyword-input");
  const colorInput = document.getElementById("ne-hl-keyword-color");
  const keyword = input?.value.trim();
  if (!keyword) return;

  const color =
    normalizeHighlightColor(colorInput?.value) || NE_DEFAULT_HIGHLIGHT_COLOR;
  const prefs = await loadStoredPreferences();
  const highlightKeywords = [...(prefs.highlightKeywords || [])];
  if (
    highlightKeywords.some(
      (item) => item.keyword?.toLowerCase() === keyword.toLowerCase(),
    )
  ) {
    input.value = "";
    return;
  }

  highlightKeywords.push({ keyword, color });
  const saved = await neSettingsSave("highlightKeywords", highlightKeywords);
  if (!saved) return;
  neSettingsDisplayHighlightKeywords(highlightKeywords);
  input.value = "";
}

export async function neSettingsUpdateHighlightColor(keywordToUpdate, colorValue) {
  const color = normalizeHighlightColor(colorValue);
  if (!color) return;

  const prefs = await loadStoredPreferences();
  const highlightKeywords = (prefs.highlightKeywords || []).map((item) =>
    item.keyword === keywordToUpdate ? { ...item, color } : item,
  );
  const saved = await neSettingsSave("highlightKeywords", highlightKeywords);
  if (!saved) {
    const prefsAfter = await loadStoredPreferences();
    neSettingsDisplayHighlightKeywords(prefsAfter.highlightKeywords || []);
    return;
  }
  neSettingsDisplayHighlightKeywords(highlightKeywords);
}

export async function neSettingsRemoveHighlightKeyword(keywordToRemove) {
  const prefs = await loadStoredPreferences();
  const highlightKeywords = (prefs.highlightKeywords || []).filter(
    (item) => item.keyword !== keywordToRemove,
  );
  const saved = await neSettingsSave("highlightKeywords", highlightKeywords);
  if (!saved) return;
  neSettingsDisplayHighlightKeywords(highlightKeywords);
}

export async function neSettingsRemoveAllHighlightKeywords() {
  const saved = await neSettingsSave("highlightKeywords", []);
  if (!saved) return;
  neSettingsDisplayHighlightKeywords([]);
}

export function neSettingsWireHighlightsSection() {
  document
    .getElementById("ne-add-hl-keyword")
    ?.addEventListener("click", neSettingsAddHighlightKeyword);
  document
    .getElementById("ne-hl-keyword-input")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") neSettingsAddHighlightKeyword();
    });
  document
    .getElementById("ne-remove-all-hl-keywords")
    ?.addEventListener("click", neSettingsRemoveAllHighlightKeywords);
}

export function neSettingsLoadQbtCategoryTagSettings(items) {
  const categories = items.qbtCategories || [];
  const tags = items.qbtTags || [];
  const defaultCategory = items.qbtDefaultCategory || "";
  const defaultTags = items.qbtDefaultTags || [];

  neSettingsSetToggleState("qbtPromptOnSend", items.qbtPromptOnSend !== false);
  neSettingsDisplayQbtCategories(categories, defaultCategory);
  neSettingsDisplayQbtTags(tags);
  neSettingsDisplayDefaultTags(tags, defaultTags);
}

export function neSettingsDisplayQbtCategories(categories, selectedDefault) {
  const listEl = document.getElementById("ne-qbt-categories-list");
  const selectEl = document.getElementById("ne-qbt-default-category");
  if (!listEl || !selectEl) return;

  listEl.innerHTML = "";
  if (!categories.length) {
    listEl.innerHTML = '<span class="ne-settings-empty">No categories defined.</span>';
  } else {
    categories.forEach((cat) => {
      const item = document.createElement("div");
      item.className = "ne-settings-qbt-item";
      item.innerHTML = `<span>${cat}</span>`;
      const rmBtn = document.createElement("button");
      rmBtn.type = "button";
      rmBtn.className = "ne-settings-qbt-remove";
      rmBtn.textContent = "Remove";
      rmBtn.addEventListener("click", () => neSettingsRemoveQbtCategory(cat));
      item.appendChild(rmBtn);
      listEl.appendChild(item);
    });
  }

  selectEl.innerHTML = '<option value="">(none)</option>';
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selectedDefault) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

export function neSettingsDisplayQbtTags(tags) {
  const listEl = document.getElementById("ne-qbt-tags-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (!tags.length) {
    listEl.innerHTML = '<span class="ne-settings-empty">No tags defined.</span>';
    return;
  }
  tags.forEach((tag) => {
    const item = document.createElement("div");
    item.className = "ne-settings-qbt-item";
    item.innerHTML = `<span>${tag}</span>`;
    const rmBtn = document.createElement("button");
    rmBtn.type = "button";
    rmBtn.className = "ne-settings-qbt-remove";
    rmBtn.textContent = "Remove";
    rmBtn.addEventListener("click", () => neSettingsRemoveQbtTag(tag));
    item.appendChild(rmBtn);
    listEl.appendChild(item);
  });
}

export function neSettingsDisplayDefaultTags(tags, defaultTags) {
  const container = document.getElementById("ne-qbt-default-tags");
  if (!container) return;

  container.innerHTML = "";
  if (!tags.length) {
    container.innerHTML =
      '<span class="ne-settings-empty">No tags defined yet.</span>';
    return;
  }
  tags.forEach((tag) => {
    const label = document.createElement("label");
    label.className = "ne-settings-qbt-tag-label";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = tag;
    if (defaultTags.includes(tag)) cb.checked = true;
    cb.addEventListener("change", () => neSettingsSaveQbtDefaults());
    label.appendChild(cb);
    label.appendChild(document.createTextNode(tag));
    container.appendChild(label);
  });
}

export function neSettingsSaveQbtDefaults() {
  const defaultCatSelect = document.getElementById("ne-qbt-default-category");
  const defaultTags = [];
  document
    .querySelectorAll("#ne-qbt-default-tags input[type='checkbox']:checked")
    .forEach((cb) => defaultTags.push(cb.value));

  const promptToggle = document.querySelector(
    '.ne-settings-page [data-setting="qbtPromptOnSend"]',
  );

  savePreferences({
    qbtDefaultCategory: defaultCatSelect ? defaultCatSelect.value : "",
    qbtDefaultTags: defaultTags,
    qbtPromptOnSend: promptToggle
      ? promptToggle.getAttribute("aria-checked") === "true"
      : true,
  });
}

export function neSettingsAddQbtCategory() {
  const input = document.getElementById("ne-qbt-new-category");
  const name = input?.value.trim();
  if (!name) return;
  getPreferences({ qbtCategories: [] }, (items) => {
    const list = items.qbtCategories || [];
    if (list.includes(name)) {
      input.value = "";
      return;
    }
    list.push(name);
    savePreferences({ qbtCategories: list }, () => {
      input.value = "";
      getPreferences({ qbtDefaultCategory: "" }, (items2) =>
        neSettingsDisplayQbtCategories(list, items2.qbtDefaultCategory),
      );
    });
  });
}

export function neSettingsRemoveQbtCategory(cat) {
  getPreferences(
    { qbtCategories: [], qbtDefaultCategory: "", qbtLastCategory: null },
    (items) => {
      const list = (items.qbtCategories || []).filter((c) => c !== cat);
      const defaultCat =
        items.qbtDefaultCategory === cat ? "" : items.qbtDefaultCategory;
      let lastCat = items.qbtLastCategory;
      if (lastCat !== null && lastCat === cat) lastCat = "";
      savePreferences(
        {
          qbtCategories: list,
          qbtDefaultCategory: defaultCat,
          qbtLastCategory: lastCat,
        },
        () => neSettingsDisplayQbtCategories(list, defaultCat),
      );
    },
  );
}

export function neSettingsAddQbtTag() {
  const input = document.getElementById("ne-qbt-new-tag");
  const name = input?.value.trim();
  if (!name) return;
  getPreferences({ qbtTags: [], qbtDefaultTags: [] }, (items) => {
    const list = items.qbtTags || [];
    if (list.includes(name)) {
      input.value = "";
      return;
    }
    list.push(name);
    const defaultTags = items.qbtDefaultTags || [];
    savePreferences({ qbtTags: list }, () => {
      input.value = "";
      neSettingsDisplayQbtTags(list);
      neSettingsDisplayDefaultTags(list, defaultTags);
    });
  });
}

export function neSettingsRemoveQbtTag(tag) {
  getPreferences(
    { qbtTags: [], qbtDefaultTags: [], qbtLastTags: null },
    (items) => {
      const list = (items.qbtTags || []).filter((t) => t !== tag);
      const defaultTags = (items.qbtDefaultTags || []).filter((t) => t !== tag);
      let lastTags = items.qbtLastTags;
      if (lastTags !== null && Array.isArray(lastTags)) {
        lastTags = lastTags.filter((t) => t !== tag);
      }
      savePreferences(
        { qbtTags: list, qbtDefaultTags: defaultTags, qbtLastTags: lastTags },
        () => {
          neSettingsDisplayQbtTags(list);
          neSettingsDisplayDefaultTags(list, defaultTags);
        },
      );
    },
  );
}

export function neSettingsSetQbtSyncStatus(color, text) {
  const statusEl = document.getElementById("ne-qbt-sync-status");
  if (!statusEl) return;
  statusEl.textContent = text || "";
  statusEl.style.color = color || (text?.startsWith("✓") ? "#4caf50" : "#888");
}

export async function neSettingsSyncQbtCategoriesAndTags() {
  const syncBtn = document.getElementById("ne-qbt-sync-btn");
  const syncIcon = document.getElementById("ne-qbt-sync-icon");
  const prefs = await loadStoredPreferences();

  if (prefs.torrentClient !== "qbittorrent") {
    neSettingsSetQbtSyncStatus(null, "⚠ qBittorrent is not the selected client.");
    return;
  }

  const url = prefs.torrentClientUrl?.trim();
  if (!url) {
    neSettingsSetQbtSyncStatus(null, "⚠ Configure your torrent client in the extension popup first.");
    return;
  }

  const username = prefs.qbtUsername || "";
  const password = prefs.qbtPassword || "";

  syncBtn.disabled = true;
  if (syncIcon) syncIcon.classList.add("is-spinning");
  neSettingsSetQbtSyncStatus(null, "Syncing...");

  try {
    const result = await browser.runtime.sendMessage({
      type: "qbtFetchCategoriesAndTags",
      url,
      username,
      password,
    });

    if (!result?.ok) {
      let msg = "✗ Sync failed";
      switch (result?.error) {
        case "auth_failed":
          msg = "✗ Authentication failed — check credentials in extension popup";
          break;
        case "auth_required":
          msg = "✗ Server requires authentication";
          break;
        case "permission_denied":
          msg = "✗ Missing permission — use Test Connection in extension popup";
          break;
        case "wrong_client":
          msg = "✗ This URL is not a qBittorrent server";
          break;
        default:
          msg = result?.message ? `✗ ${result.message}` : msg;
      }
      neSettingsSetQbtSyncStatus("#e53935", msg);
      return;
    }

    const remoteCats = result.categories || [];
    const remoteTags = result.tags || [];

    getPreferences(
      {
        qbtCategories: [],
        qbtTags: [],
        qbtDefaultCategory: "",
        qbtDefaultTags: [],
      },
      (items) => {
        const mergedCats = new Set([...(items.qbtCategories || []), ...remoteCats]);
        const mergedTags = new Set([...(items.qbtTags || []), ...remoteTags]);
        const catList = [...mergedCats].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" }),
        );
        const tagList = [...mergedTags].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" }),
        );
        const defaultCategory =
          items.qbtDefaultCategory && mergedCats.has(items.qbtDefaultCategory)
            ? items.qbtDefaultCategory
            : "";
        const defaultTags = (items.qbtDefaultTags || []).filter((t) =>
          mergedTags.has(t),
        );

        savePreferences(
          {
            qbtCategories: catList,
            qbtTags: tagList,
            qbtDefaultCategory: defaultCategory,
            qbtDefaultTags: defaultTags,
          },
          () => {
            neSettingsDisplayQbtCategories(catList, defaultCategory);
            neSettingsDisplayQbtTags(tagList);
            neSettingsDisplayDefaultTags(tagList, defaultTags);
            neSettingsSetQbtSyncStatus("#4caf50", "✓ Synced successfully.");
          },
        );
      },
    );
  } catch (err) {
    neSettingsSetQbtSyncStatus("#e53935", `✗ Sync error: ${err.message}`);
  } finally {
    syncBtn.disabled = false;
    if (syncIcon) syncIcon.classList.remove("is-spinning");
  }
}

export function neSettingsWireQbtSection() {
  document
    .getElementById("ne-qbt-add-category")
    ?.addEventListener("click", neSettingsAddQbtCategory);
  document
    .getElementById("ne-qbt-add-tag")
    ?.addEventListener("click", neSettingsAddQbtTag);
  document
    .getElementById("ne-qbt-new-category")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") neSettingsAddQbtCategory();
    });
  document.getElementById("ne-qbt-new-tag")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") neSettingsAddQbtTag();
  });
  document
    .getElementById("ne-qbt-default-category")
    ?.addEventListener("change", neSettingsSaveQbtDefaults);
  document
    .getElementById("ne-qbt-sync-btn")
    ?.addEventListener("click", neSettingsSyncQbtCategoriesAndTags);
}

const VIBE_MIX_DEFAULTS = { genre: 34, tags: 33, studio: 33 };
const vibeMixState = { ...VIBE_MIX_DEFAULTS, dragging: false };

function clampVibePct(value, fallback = 0) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeVibeMix(genre, tags, studio) {
  let g = clampVibePct(genre, VIBE_MIX_DEFAULTS.genre);
  let t = clampVibePct(tags, VIBE_MIX_DEFAULTS.tags);
  let s = clampVibePct(studio, VIBE_MIX_DEFAULTS.studio);
  const sum = g + t + s;
  if (sum <= 0) return { ...VIBE_MIX_DEFAULTS };
  if (sum === 100) return { genre: g, tags: t, studio: s };
  g = Math.round((g * 100) / sum);
  t = Math.round((t * 100) / sum);
  s = 100 - g - t;
  if (s < 0) {
    t = Math.max(0, t + s);
    s = 100 - g - t;
  }
  return { genre: g, tags: t, studio: s };
}

function vibeKnobPositions(mix = vibeMixState) {
  return { a: mix.genre, b: mix.genre + mix.tags };
}

function vibeMixFromKnobs(a, b) {
  const left = clampVibePct(Math.min(a, b));
  const right = clampVibePct(Math.max(a, b));
  return {
    genre: left,
    tags: right - left,
    studio: 100 - right,
  };
}

function vibeMixFromWeight(which, value) {
  const next = clampVibePct(value);
  const rest = 100 - next;
  const keys = ["genre", "tags", "studio"].filter((key) => key !== which);
  const restSum = keys.reduce((sum, key) => sum + vibeMixState[key], 0);
  const mix = { genre: 0, tags: 0, studio: 0, [which]: next };
  if (restSum <= 0) {
    mix[keys[0]] = rest;
    mix[keys[1]] = 0;
    return mix;
  }
  mix[keys[0]] = Math.round((vibeMixState[keys[0]] * rest) / restSum);
  mix[keys[1]] = rest - mix[keys[0]];
  return mix;
}

function renderVibeMix() {
  const root = document.getElementById("ne-vibe-mix");
  if (!root) return;
  const { genre, tags, studio } = vibeMixState;
  const { a, b } = vibeKnobPositions();
  root.style.setProperty("--vibe-a", `${a}%`);
  root.style.setProperty("--vibe-b", `${b}%`);

  const genreNum = document.getElementById("ne-similar-vibe-genre-num");
  const tagsNum = document.getElementById("ne-similar-vibe-tags-num");
  const studioNum = document.getElementById("ne-similar-vibe-studio-num");
  if (genreNum) genreNum.value = genre;
  if (tagsNum) tagsNum.value = tags;
  if (studioNum) studioNum.value = studio;

  const knobA = root.querySelector('[data-knob="a"]');
  const knobB = root.querySelector('[data-knob="b"]');
  if (knobA) {
    knobA.setAttribute("aria-valuenow", String(a));
    knobA.setAttribute("aria-valuetext", `Genres ${genre} percent, tags ${tags} percent`);
    knobA.style.left = `${a}%`;
    knobA.style.zIndex = a === b && a > 50 ? "4" : "3";
  }
  if (knobB) {
    knobB.setAttribute("aria-valuenow", String(b));
    knobB.setAttribute("aria-valuetext", `Tags ${tags} percent, studio ${studio} percent`);
    knobB.style.left = `${b}%`;
    knobB.style.zIndex = a === b && a <= 50 ? "4" : "2";
  }
}

let vibeMixSaveTimer = 0;
let vibeMixSaved = { ...VIBE_MIX_DEFAULTS };

async function commitVibeMix() {
  const mix = {
    genre: vibeMixState.genre,
    tags: vibeMixState.tags,
    studio: vibeMixState.studio,
  };
  if (
    mix.genre === vibeMixSaved.genre &&
    mix.tags === vibeMixSaved.tags &&
    mix.studio === vibeMixSaved.studio
  ) {
    return;
  }
  const previous = { ...vibeMixSaved };
  vibeMixSaved = { ...mix };
  try {
    await savePreferences({
      similarVibeGenreWeight: mix.genre,
      similarVibeTagWeight: mix.tags,
      similarVibeStudioWeight: mix.studio,
    });
    await handleSettingChange("similarVibeGenreWeight", mix.genre);
  } catch {
    vibeMixSaved = previous;
    applyVibeMix(previous, { save: false });
  }
}

function scheduleVibeMixSave() {
  clearTimeout(vibeMixSaveTimer);
  vibeMixSaveTimer = setTimeout(() => commitVibeMix(), 160);
}

function applyVibeMix(mix, { save = false, immediate = false } = {}) {
  const next = normalizeVibeMix(mix.genre, mix.tags, mix.studio);
  vibeMixState.genre = next.genre;
  vibeMixState.tags = next.tags;
  vibeMixState.studio = next.studio;
  renderVibeMix();
  if (!save) return;
  if (immediate) {
    clearTimeout(vibeMixSaveTimer);
    commitVibeMix();
    return;
  }
  scheduleVibeMixSave();
}

function vibePctFromPointer(clientX) {
  const slider = document.getElementById("ne-vibe-mix-slider");
  if (!slider) return 0;
  const rect = slider.getBoundingClientRect();
  if (!rect.width) return 0;
  return clampVibePct(((clientX - rect.left) / rect.width) * 100);
}

function moveVibeKnob(which, pct) {
  let { a, b } = vibeKnobPositions();
  if (which === "a") {
    a = pct;
    if (a > b) b = a;
  } else {
    b = pct;
    if (b < a) a = b;
  }
  applyVibeMix(vibeMixFromKnobs(a, b), { save: true });
}

function nearestVibeKnob(pct) {
  const { a, b } = vibeKnobPositions();
  return Math.abs(pct - a) <= Math.abs(pct - b) ? "a" : "b";
}

function setVibeMixActiveKnob(which) {
  const root = document.getElementById("ne-vibe-mix");
  if (!root) return;
  root.querySelectorAll(".ne-vibe-mix__knob").forEach((knob) => {
    knob.classList.toggle("is-active", knob.dataset.knob === which);
  });
  root.querySelectorAll(".ne-vibe-mix__item").forEach((item) => {
    const key = item.dataset.vibe;
    const on =
      which === "a" ? key === "genre" || key === "tags" : key === "tags" || key === "studio";
    item.classList.toggle("is-active", !!which && on);
  });
}

export function neSettingsSetVibeMix(genre, tags, studio) {
  if (vibeMixState.dragging) return;
  const mix = normalizeVibeMix(genre, tags, studio);
  vibeMixState.genre = mix.genre;
  vibeMixState.tags = mix.tags;
  vibeMixState.studio = mix.studio;
  vibeMixSaved = { ...mix };
  renderVibeMix();
}

export function neSettingsUpdateSimilarVibeInputs(enabled) {
  const box = document.getElementById("ne-similar-vibe-weights");
  if (box) {
    box.classList.toggle("is-disabled", !enabled);
    box.querySelectorAll("input, button").forEach((el) => {
      el.disabled = !enabled;
    });
  }
  document
    .querySelectorAll(".ne-settings-page [data-depends-on='showSimilarSection']")
    .forEach((row) => {
      row.classList.toggle("is-disabled", !enabled);
      const toggle = row.querySelector(".ne-settings-toggle");
      if (toggle) toggle.disabled = !enabled;
    });
  const cache = document.getElementById("ne-similar-cache");
  if (cache) {
    cache.classList.toggle("is-disabled", !enabled);
    cache.querySelectorAll("button").forEach((el) => {
      el.disabled = !enabled;
    });
  }
}

export function neSettingsUpdateSimilarTmdbDisclaimer(enabled) {
  const el = document.getElementById("ne-similar-tmdb-disclaimer");
  if (el) el.classList.toggle("is-visible", !!enabled);
}

export function neSettingsWireVibeWeights() {
  const root = document.getElementById("ne-vibe-mix");
  const slider = document.getElementById("ne-vibe-mix-slider");
  if (!root || !slider) return;

  renderVibeMix();

  const startDrag = (which, event) => {
    if (root.closest(".is-disabled")) return;
    vibeMixState.dragging = true;
    setVibeMixActiveKnob(which);
    slider.setPointerCapture?.(event.pointerId);
    moveVibeKnob(which, vibePctFromPointer(event.clientX));
  };

  const stopDrag = () => {
    if (!vibeMixState.dragging) return;
    vibeMixState.dragging = false;
    setVibeMixActiveKnob(null);
    clearTimeout(vibeMixSaveTimer);
    commitVibeMix();
  };

  slider.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    const which = event.target.closest(".ne-vibe-mix__knob")?.dataset.knob
      || nearestVibeKnob(vibePctFromPointer(event.clientX));
    startDrag(which, event);
  });

  slider.addEventListener("pointermove", (event) => {
    if (!vibeMixState.dragging) return;
    const which = root.querySelector(".ne-vibe-mix__knob.is-active")?.dataset.knob;
    if (!which) return;
    moveVibeKnob(which, vibePctFromPointer(event.clientX));
  });

  slider.addEventListener("pointerup", stopDrag);
  slider.addEventListener("pointercancel", stopDrag);
  slider.addEventListener("lostpointercapture", stopDrag);

  root.querySelectorAll(".ne-vibe-mix__knob").forEach((knob) => {
    knob.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 5 : 1;
      let delta = 0;
      if (event.key === "ArrowLeft" || event.key === "Down") delta = -step;
      else if (event.key === "ArrowRight" || event.key === "Up") delta = step;
      else if (event.key === "Home") {
        event.preventDefault();
        moveVibeKnob(knob.dataset.knob, knob.dataset.knob === "a" ? 0 : vibeKnobPositions().a);
        commitVibeMix();
        return;
      } else if (event.key === "End") {
        event.preventDefault();
        moveVibeKnob(knob.dataset.knob, knob.dataset.knob === "b" ? 100 : vibeKnobPositions().b);
        commitVibeMix();
        return;
      } else return;
      event.preventDefault();
      const { a, b } = vibeKnobPositions();
      moveVibeKnob(knob.dataset.knob, (knob.dataset.knob === "a" ? a : b) + delta);
      commitVibeMix();
    });
  });

  [
    ["genre", "ne-similar-vibe-genre-num"],
    ["tags", "ne-similar-vibe-tags-num"],
    ["studio", "ne-similar-vibe-studio-num"],
  ].forEach(([which, id]) => {
    const input = document.getElementById(id);
    if (!input) return;
    const commit = () => {
      applyVibeMix(vibeMixFromWeight(which, input.value), { save: true, immediate: true });
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  });

  document.getElementById("ne-similar-reset-mix")?.addEventListener("click", () => {
    applyVibeMix(VIBE_MIX_DEFAULTS, { save: true, immediate: true });
  });
}

export function neSettingsWireSimilarCache() {
  const button = document.getElementById("ne-similar-clear-cache");
  const status = document.getElementById("ne-similar-clear-cache-status");
  const usageEl = document.getElementById("ne-similar-cache-usage");
  if (!button) return;

  const renderUsage = async () => {
    if (!usageEl) return;
    try {
      const usage = await getSimilarCacheUsage();
      const total = usageEl.querySelector("[data-cache-total]");
      const parts = usageEl.querySelector("[data-cache-parts]");
      if (total) total.textContent = formatSimilarCacheBytes(usage.total);
      if (parts) {
        parts.textContent = [
          `Identify ${formatSimilarCacheBytes(usage.identify)}`,
          `Recs ${formatSimilarCacheBytes(usage.recs)}`,
          `AnimeAPI ${formatSimilarCacheBytes(usage.animeapi)}`,
          `Details ${formatSimilarCacheBytes(usage.details)}`,
        ].join(" · ");
      }
      usageEl.hidden = false;
    } catch {
      usageEl.hidden = true;
    }
  };

  renderUsage();
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!Object.keys(changes || {}).some(isSimilarCacheKey)) return;
    if (!document.getElementById("ne-similar-cache-usage")) return;
    renderUsage();
  });

  button.addEventListener("click", async () => {
    button.disabled = true;
    if (status) status.textContent = "Clearing…";
    try {
      await clearSimilarCaches();
      await renderUsage();
      if (status) {
        status.textContent =
          "Cleared Similar caches. Open Similar again to fetch fresh results.";
      }
    } catch {
      if (status) status.textContent = "Couldn't clear the cache.";
    } finally {
      button.disabled = false;
    }
  });
}

export function neSettingsWireScreenshotInputs() {
  const attach = (inputId, settingKey, defaultValue, minValue) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const commit = async () => {
      const previous = input.value;
      let value = parseFloat(input.value);
      if (!isFinite(value) || value < minValue) {
        value = defaultValue;
        input.value = value;
      }
      const saved = await neSettingsSave(settingKey, value);
      if (!saved) input.value = previous;
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  };
  attach("ne-sp-hover-delay", "screenshotPreviewHoverDelay", 2, 0);
  attach("ne-sp-slide-delay", "screenshotPreviewSlideDelay", 2, 0.1);
}

export function neSettingsWireShowMoreSection() {
  const untilInput = document.getElementById("ne-show-more-until-visible");
  const commitUntil = async () => {
    if (!untilInput) return;
    const previous = untilInput.value;
    const value = neSettingsNormalizeShowMoreUntilVisible(untilInput.value);
    untilInput.value = String(value);
    const saved = await neSettingsSave("showMoreUntilVisible", value);
    if (!saved) untilInput.value = previous;
  };
  untilInput?.addEventListener("change", commitUntil);
  untilInput?.addEventListener("blur", commitUntil);

  const delayInput = document.getElementById("ne-show-more-auto-delay");
  const commitDelay = async () => {
    if (!delayInput) return;
    const previous = delayInput.value;
    const seconds = neSettingsNormalizeShowMoreAutoDelaySeconds(delayInput.value);
    delayInput.value = String(seconds);
    const saved = await neSettingsSave(
      "showMoreAutoDelayMs",
      neSettingsShowMoreAutoDelaySecondsToMs(seconds),
    );
    if (!saved) delayInput.value = previous;
  };
  delayInput?.addEventListener("change", commitDelay);
  delayInput?.addEventListener("blur", commitDelay);

  document
    .getElementById("ne-show-more-auto-delay-reset")
    ?.addEventListener("click", async () => {
      if (!delayInput || delayInput.disabled) return;
      const previous = delayInput.value;
      delayInput.value = String(NE_SETTINGS_AUTOLOAD_DELAY_DEFAULT_SEC);
      const saved = await neSettingsSave(
        "showMoreAutoDelayMs",
        neSettingsShowMoreAutoDelaySecondsToMs(
          NE_SETTINGS_AUTOLOAD_DELAY_DEFAULT_SEC,
        ),
      );
      if (!saved) delayInput.value = previous;
    });
}

export function neSettingsWireQuickSearchSection() {
  const select = document.getElementById("ne-quicksearch-provider");
  select?.addEventListener("change", async () => {
    const value = select.value === "tmdb" ? "tmdb" : "tenrai";
    const saved = await neSettingsSave("quickSearchAnimeProvider", value);
    if (!saved) {
      const prefs = await loadStoredPreferences();
      select.value = prefs.quickSearchAnimeProvider === "tmdb" ? "tmdb" : "tenrai";
    }
  });
}

export function neSettingsWireHistorySection() {
  const input = document.getElementById("ne-history-max-events");
  const commitCap = async () => {
    if (!input) return;
    const previous = input.value;
    const value = neNormalizeHistoryMaxEvents(input.value);
    input.value = String(value);
    const saved = await neSettingsSave("historyMaxEvents", value);
    if (!saved) input.value = previous;
  };
  input?.addEventListener("change", commitCap);
  input?.addEventListener("blur", commitCap);

  const button = document.getElementById("ne-history-clear-settings");
  const status = document.getElementById("ne-history-clear-settings-status");
  button?.addEventListener("click", async () => {
    button.disabled = true;
    if (status) status.textContent = "Clearing…";
    try {
      await clearHistory();
      if (status) status.textContent = "History cleared.";
    } catch {
      if (status) status.textContent = "Couldn't clear history.";
    } finally {
      button.disabled = false;
    }
  });
}

// ── Cloud Sync ──────────────────────────────────────────────────────────────

const NE_CLOUD_WATCHED_KEYS = new Set([
  CLOUD_SYNC_STATE_KEY,
  "cloudSyncEnabled",
  "cloudSyncUrl",
  "cloudSyncIncludeCredentials",
  "cloudSyncIncludeHistory",
  "webdavUsername",
  "webdavPassword",
  "cloudSyncCheckMinutes",
]);

function neCloudTimeAgo(ms) {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  if (diff < 45_000) return "Just now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleString();
}

function neCloudSetCheck(el, kind, text) {
  if (!el) return;
  el.className = `ne-cloud-check ne-cloud-check--${kind}`;
  el.textContent = text || "";
  el.hidden = !text;
}

function neCloudRenderUrlCheck(value) {
  const el = document.getElementById("ne-cloud-url-check");
  const result = validateWebdavUrl(value);
  if (result.empty) neCloudSetCheck(el, "info", "");
  else if (!result.ok) neCloudSetCheck(el, "error", result.message);
  else if (result.warnings.length) neCloudSetCheck(el, "warn", result.warnings.join(" "));
  else neCloudSetCheck(el, "ok", "The address looks valid. Press Test connection to check it with your login.");
  return result;
}

async function neCloudSend(message) {
  try {
    const result = await browser.runtime.sendMessage(message);
    if (result) return result;
  } catch {
    /* handled below */
  }
  return {
    ok: false,
    code: "unknown",
    message: "The extension didn't answer. Reload this page and try again.",
  };
}

function neCloudStatusRow(list, label, value, kind = "") {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value;
  if (kind) detail.className = `ne-cloud-status__value--${kind}`;
  list.append(term, detail);
}

async function neCloudRenderStatus(given) {
  const status = given || (await neCloudSend({ type: "cloudSyncStatus" }));
  const account = document.getElementById("ne-cloud-account");
  const list = document.getElementById("ne-cloud-status");
  if (!account || !list || status.ok === false) return;

  if (!status.hasCredentials) {
    neCloudSetCheck(
      account,
      "warn",
      "No WebDAV login in this browser yet. Add it in the extension popup → Settings → Cloud Sync (WebDAV).",
    );
  } else if (status.url && !status.hasPermission) {
    neCloudSetCheck(
      account,
      "warn",
      `Logged in as ${status.username}, but your browser hasn't allowed access to this server yet. Press Connect in the extension popup.`,
    );
  } else {
    neCloudSetCheck(account, "info", `Login: ${status.username} (change it in the extension popup).`);
  }

  list.replaceChildren();
  let state = "Off";
  let kind = "muted";
  if (status.enabled) {
    if (status.lastError?.code === "auth_failed") {
      state = "Paused: the server rejected the login";
      kind = "error";
    } else if (status.pausedUntil > Date.now()) {
      const until = new Date(status.pausedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      state = `Paused until about ${until} (server refusing requests)`;
      kind = "error";
    } else if (status.lastError) {
      state = "On, but the last sync failed";
      kind = "error";
    } else if (status.pending) {
      state = `On, ${status.pending} change${status.pending === 1 ? "" : "s"} waiting to upload`;
      kind = "warn";
    } else if (status.lastSyncAt) {
      state = "On, up to date";
      kind = "ok";
    } else {
      state = "On, waiting for the first sync";
      kind = "warn";
    }
  }
  neCloudStatusRow(list, "Sync", state, kind);
  if (status.enabled) {
    const option = CLOUD_SYNC_CHECK_OPTIONS.find((item) => item.value === status.checkMinutes);
    neCloudStatusRow(
      list,
      "Checks",
      option ? option.label.replace(" (default)", "") : "Every 5 minutes",
    );
  }
  if (status.lastError) {
    neCloudStatusRow(
      list,
      "Problem",
      `${status.lastError.message} (${neCloudTimeAgo(status.lastError.at).toLowerCase()})`,
      "error",
    );
  }
  neCloudStatusRow(list, "Last synced", neCloudTimeAgo(status.lastSyncAt));
  neCloudStatusRow(
    list,
    "Cloud copy",
    status.lastRemoteUpdatedAt
      ? `Updated ${neCloudTimeAgo(status.lastRemoteUpdatedAt).toLowerCase()}${status.lastRemoteDevice ? ` by ${status.lastRemoteDevice}` : ""}`
      : "Not found yet",
  );
  neCloudStatusRow(list, "This browser", status.deviceName || "Unknown");

  ["ne-cloud-sync-now", "ne-cloud-upload", "ne-cloud-download"].forEach((id) => {
    const button = document.getElementById(id);
    if (button && !button.dataset.busy) button.disabled = !status.enabled;
  });
}

function neCloudDescribeTest(result) {
  if (!result.ok) return ["error", result.message || cloudSyncErrorMessage(result.code)];
  if (!result.remote) {
    return ["ok", "Connected. There's no cloud copy yet, so this browser's settings will be uploaded when you turn sync on."];
  }
  if (!result.remote.valid) {
    return ["warn", "Connected, but the settings.json in the nyaa-enhancer folder isn't a valid Nyaa Enhancer file."];
  }
  const from = result.remote.device ? ` by ${result.remote.device}` : "";
  return [
    "ok",
    `Connected. Found a cloud copy updated ${neCloudTimeAgo(result.remote.updatedAt).toLowerCase()}${from}. Turning sync on in this browser will use it.`,
  ];
}

async function neCloudRunAction(button, message, busyText, doneText) {
  const status = document.getElementById("ne-cloud-action-status");
  button.disabled = true;
  button.dataset.busy = "1";
  if (status) status.textContent = busyText;
  const result = await neCloudSend(message);
  delete button.dataset.busy;
  button.disabled = false;
  if (result.ok) neSettingsShowFadingStatus(status, doneText);
  else if (status) status.textContent = result.message || cloudSyncErrorMessage(result.code);
  await neCloudRenderStatus();
}

export function neSettingsWireCloudSyncSection() {
  const input = document.getElementById("ne-cloud-url");
  if (!input) return;

  const interval = document.getElementById("ne-cloud-check-interval");
  loadStoredPreferences().then((prefs) => {
    if (document.activeElement !== input) input.value = prefs.cloudSyncUrl || "";
    neCloudRenderUrlCheck(input.value);
    if (interval) {
      interval.value = String(normalizeCloudSyncCheckMinutes(prefs.cloudSyncCheckMinutes));
    }
  });
  interval?.addEventListener("change", () => {
    neSettingsSave("cloudSyncCheckMinutes", normalizeCloudSyncCheckMinutes(interval.value));
  });

  input.addEventListener("input", () => {
    neCloudRenderUrlCheck(input.value);
    neCloudSetCheck(document.getElementById("ne-cloud-test-result"), "info", "");
  });
  input.addEventListener("change", async () => {
    const result = neCloudRenderUrlCheck(input.value);
    if (!result.ok && !result.empty) return;
    const value = result.ok ? result.url : "";
    input.value = value;
    await neSettingsSave("cloudSyncUrl", value);
  });

  const testButton = document.getElementById("ne-cloud-test");
  testButton?.addEventListener("click", async () => {
    const resultEl = document.getElementById("ne-cloud-test-result");
    const address = neCloudRenderUrlCheck(input.value);
    if (!address.ok) {
      neCloudSetCheck(resultEl, "error", address.empty ? "Enter your WebDAV folder address first." : address.message);
      return;
    }
    testButton.disabled = true;
    neCloudSetCheck(resultEl, "info", "Checking the connection…");
    if (input.value !== address.url) input.value = address.url;
    const prefs = await loadStoredPreferences();
    if (prefs.cloudSyncUrl !== address.url) await neSettingsSave("cloudSyncUrl", address.url);
    const result = await neCloudSend({ type: "cloudSyncTest", url: address.url });
    testButton.disabled = false;
    const [kind, text] = neCloudDescribeTest(result);
    neCloudSetCheck(resultEl, kind, text);
    await neCloudRenderStatus();
  });

  const syncNow = document.getElementById("ne-cloud-sync-now");
  syncNow?.addEventListener("click", () =>
    neCloudRunAction(syncNow, { type: "cloudSyncNow" }, "Syncing…", "Synced."),
  );

  const upload = document.getElementById("ne-cloud-upload");
  upload?.addEventListener("click", async () => {
    const confirmed = await neSettingsConfirmModal({
      title: "Replace the cloud copy?",
      paragraphs: ["The cloud copy is overwritten with this browser's settings. Your other browsers take them on their next sync."],
      notes: ["Use this if the cloud copy is broken or you want this browser to be the one everything follows."],
      confirmLabel: "Replace cloud copy",
      danger: true,
    });
    if (confirmed) {
      neCloudRunAction(upload, { type: "cloudSyncUpload" }, "Uploading…", "Cloud copy replaced.");
    }
  });

  const download = document.getElementById("ne-cloud-download");
  download?.addEventListener("click", async () => {
    const confirmed = await neSettingsConfirmModal({
      title: "Replace this browser's settings?",
      paragraphs: ["This browser's settings are overwritten with the cloud copy, including changes that haven't been uploaded yet."],
      notes: ["This can't be undone. Export your settings first if you want a backup."],
      confirmLabel: "Replace this browser",
      danger: true,
    });
    if (confirmed) {
      neCloudRunAction(download, { type: "cloudSyncDownload" }, "Downloading…", "Settings replaced with the cloud copy.");
    }
  });

  let renderTimer = 0;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" && area !== "sync") return;
    if (!document.getElementById("ne-cloud-status")) return;
    if (changes.cloudSyncCheckMinutes && interval) {
      interval.value = String(normalizeCloudSyncCheckMinutes(changes.cloudSyncCheckMinutes.newValue));
    }
    if (changes.cloudSyncUrl && document.activeElement !== input) {
      input.value = changes.cloudSyncUrl.newValue || "";
      neCloudRenderUrlCheck(input.value);
    }
    if (!Object.keys(changes).some((key) => NE_CLOUD_WATCHED_KEYS.has(key))) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => neCloudRenderStatus(), 150);
  });

  // Keep the "x minutes ago" times fresh while the page is open.
  setInterval(() => {
    if (document.getElementById("ne-cloud-status") && !document.hidden) neCloudRenderStatus();
  }, 30_000);

  // Opening Settings also checks the cloud for changes from other browsers.
  neCloudSend({ type: "cloudSyncWake" }).then((status) => neCloudRenderStatus(status));
}

function neSettingsIsCacheKey(key) {
  return isSimilarCacheKey(key) || XEM_ALL_NAMES_STORAGE_KEYS.includes(key);
}

export function neSettingsWireCacheSection() {
  const button = document.getElementById("ne-cache-clear-all");
  const status = document.getElementById("ne-cache-clear-all-status");
  if (!button) return;

  const canMeasure = typeof browser.storage?.local?.getBytesInUse === "function";
  const renderUsage = async () => {
    if (!canMeasure) return;
    const [similar, xem] = await Promise.all([
      getSimilarCacheUsage().then((usage) => usage.total),
      getBytesInUse(XEM_ALL_NAMES_STORAGE_KEYS),
    ]);
    const sizes = { similar, xem, total: similar + xem };
    document
      .querySelectorAll("#ne-settings-cache [data-cache-size]")
      .forEach((el) => {
        const bytes = formatSimilarCacheBytes(sizes[el.dataset.cacheSize]);
        el.textContent = el.dataset.cacheSize === "total" ? `${bytes} in total` : bytes;
        el.hidden = false;
      });
  };

  renderUsage().catch(() => {});
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!Object.keys(changes || {}).some(neSettingsIsCacheKey)) return;
    if (!document.getElementById("ne-settings-cache")) return;
    renderUsage().catch(() => {});
  });

  button.addEventListener("click", async () => {
    button.disabled = true;
    if (status) status.textContent = "Clearing…";
    try {
      await Promise.all([clearSimilarCaches(), clearXemNameCache()]);
      await renderUsage().catch(() => {});
      if (status) status.textContent = "All cache cleared.";
    } catch (error) {
      console.error("[Nyaa Enhancer] Failed to clear cache.", error);
      if (status) status.textContent = "Couldn't clear the cache.";
    } finally {
      button.disabled = false;
    }
  });
}

const NE_BACKUP_MAX_FILE_BYTES = 20 * 1024 * 1024;

function neSettingsBackupReloadSoon() {
  setTimeout(() => window.location.reload(), 1200);
}

async function neSettingsExportBackup() {
  const includeCredentials = document.getElementById("ne-backup-export-credentials")?.getAttribute("aria-checked") === "true";
  const includeHistory = document.getElementById("ne-backup-export-history")?.getAttribute("aria-checked") === "true";
  const backup = {
    format: PREFS_EXPORT_FORMAT,
    version: PREFS_EXPORT_VERSION,
    extensionVersion: browser.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    includesCredentials: includeCredentials,
    settings: await exportPreferences({ includeCredentials, includeCloudSetup: true }),
  };
  if (includeHistory) backup.history = await loadHistoryState();

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `nyaa-enhancer-settings-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return backup;
}

function neSettingsParseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("The file isn't valid JSON.");
  }
  if (backup?.format !== PREFS_EXPORT_FORMAT || !backup.settings) {
    throw new Error("This isn't a Nyaa Enhancer settings file.");
  }
  if (!Number.isInteger(backup.version) || backup.version > PREFS_EXPORT_VERSION) {
    throw new Error("This file was made by a newer version of Nyaa Enhancer. Update the extension and try again.");
  }
  return backup;
}

function neSettingsBackupToggleOn(id) {
  return document.getElementById(id)?.getAttribute("aria-checked") === "true";
}

// What importing the picked file will do with the current import toggles.
function neSettingsDescribeBackupImport(backup) {
  const includeCredentials = neSettingsBackupToggleOn("ne-backup-import-credentials");
  const includeHistory = neSettingsBackupToggleOn("ne-backup-import-history");
  const exported = Date.parse(backup.exportedAt);
  const lines = [
    `Exported ${Number.isFinite(exported) ? new Date(exported).toLocaleString() : "at an unknown time"}${backup.extensionVersion ? ` from version ${backup.extensionVersion}` : ""}.`,
    "Settings in the file replace your current ones.",
  ];
  if (backup.includesCredentials) {
    lines.push(
      includeCredentials
        ? "Passwords and API keys in the file replace your current ones."
        : "Passwords and API keys in the file are skipped (Import credentials is off).",
    );
  }
  if (backup.history) {
    const count = Array.isArray(backup.history.e) ? backup.history.e.length : 0;
    lines.push(
      includeHistory
        ? `Your History log is replaced with ${count.toLocaleString()} entries from the file.`
        : "History in the file is skipped (Import history is off).",
    );
  }
  return lines;
}

async function neSettingsReadBackupFile(file) {
  if (file.size > NE_BACKUP_MAX_FILE_BYTES) {
    throw new Error("The file is too large to be a settings export.");
  }
  return neSettingsParseBackup(await file.text());
}

async function neSettingsApplyBackup(backup, status) {
  const includeCredentials = neSettingsBackupToggleOn("ne-backup-import-credentials");
  const includeHistory = neSettingsBackupToggleOn("ne-backup-import-history");

  if (status) status.textContent = "Importing…";
  const { applied, skipped } = await importPreferences(backup.settings, {
    includeCredentials,
    includeCloudSetup: true,
  });
  if (skipped.length) {
    console.warn("[Nyaa Enhancer] Skipped unknown or invalid settings during import:", skipped);
  }

  let historyNote = "";
  if (backup.history && includeHistory) {
    const prefs = await loadStoredPreferences();
    const kept = await importHistoryState(backup.history, prefs.historyMaxEvents);
    historyNote = ` and ${kept.toLocaleString()} history entries`;
  }

  if (status) {
    status.textContent = `Imported ${applied} settings${historyNote}${skipped.length ? ` (skipped ${skipped.length})` : ""}. Reloading…`;
  }
  neSettingsBackupReloadSoon();
}

// Nyaa's Bootstrap styles show input[type="file"] even when it is [hidden],
// so the picker only exists while a file is being chosen.
function neSettingsPickJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.setProperty("display", "none", "important");
    const finish = (file) => {
      input.remove();
      resolve(file || null);
    };
    input.addEventListener("change", () => finish(input.files?.[0]), { once: true });
    input.addEventListener("cancel", () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

const NE_STATUS_FADE_MS = 600;
const neSettingsStatusFadeTimers = new WeakMap();

// Shows a status message that fades out after delayMs, unless something else
// has replaced it by then.
function neSettingsShowFadingStatus(el, text, delayMs = 5_000) {
  if (!el) return;
  clearTimeout(neSettingsStatusFadeTimers.get(el));
  el.classList.remove("is-fading");
  el.textContent = text;
  neSettingsStatusFadeTimers.set(
    el,
    setTimeout(() => {
      if (el.textContent !== text) return;
      el.classList.add("is-fading");
      neSettingsStatusFadeTimers.set(
        el,
        setTimeout(() => {
          if (el.textContent === text) el.textContent = "";
          el.classList.remove("is-fading");
        }, NE_STATUS_FADE_MS),
      );
    }, delayMs),
  );
}

function neSettingsSetButtonContent(button, iconClass, label) {
  const icon = document.createElement("i");
  icon.className = `fa ${iconClass}`;
  icon.setAttribute("aria-hidden", "true");
  button.replaceChildren(icon, ` ${label}`);
}

function neSettingsCloseConfirmModal(overlay) {
  if (!overlay || overlay.classList.contains("hiding")) return;
  overlay.classList.add("hiding");
  overlay.querySelector(".qbt-modal")?.classList.add("hiding");
  overlay.addEventListener("animationend", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  // Fallback for when animations are disabled and animationend never fires.
  setTimeout(() => overlay.remove(), 500);
}

// Themed replacement for window.confirm, built on the extension's dialog
// styles. Resolves true only when the confirm button is pressed.
export function neSettingsConfirmModal({
  title,
  paragraphs = [],
  items = [],
  notes = [],
  confirmLabel = "Confirm",
  danger = false,
}) {
  document.getElementById("neSettingsConfirmOverlay")?.remove();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "qbt-modal-overlay";
    overlay.id = "neSettingsConfirmOverlay";

    const modal = document.createElement("div");
    modal.className = "qbt-modal ne-settings-modal";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "neSettingsConfirmTitle");

    const header = document.createElement("div");
    header.className = "qbt-modal-header";
    const heading = document.createElement("h3");
    heading.id = "neSettingsConfirmTitle";
    heading.textContent = title;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "qbt-modal-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    header.append(heading, closeBtn);

    const body = document.createElement("div");
    body.className = "qbt-modal-body";
    paragraphs.forEach((text) => {
      const p = document.createElement("p");
      p.className = "ne-settings-modal__text";
      p.textContent = text;
      body.appendChild(p);
    });
    if (items.length) {
      const list = document.createElement("ul");
      list.className = "ne-settings-modal__list";
      items.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
      body.appendChild(list);
    }
    notes.forEach((text) => {
      const p = document.createElement("p");
      p.className = "ne-settings-modal__note";
      p.textContent = text;
      body.appendChild(p);
    });

    const footer = document.createElement("div");
    footer.className = "qbt-modal-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "qbt-modal-btn qbt-modal-btn-cancel";
    cancelBtn.textContent = "Cancel";
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = `qbt-modal-btn qbt-modal-btn-confirm${danger ? " ne-settings-modal__btn--danger" : ""}`;
    confirmBtn.textContent = confirmLabel;
    footer.append(cancelBtn, confirmBtn);

    modal.append(header, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    const finish = (confirmed) => {
      document.removeEventListener("keydown", onKey, true);
      neSettingsCloseConfirmModal(overlay);
      resolve(confirmed);
    };
    closeBtn.addEventListener("click", () => finish(false));
    cancelBtn.addEventListener("click", () => finish(false));
    confirmBtn.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKey, true);
    cancelBtn.focus();
  });
}

export function neSettingsWireBackupSection() {
  const importBtn = document.getElementById("ne-backup-import");
  const importCancelBtn = document.getElementById("ne-backup-import-cancel");
  const importStatus = document.getElementById("ne-backup-import-status");
  const pendingEl = document.getElementById("ne-backup-import-pending");
  let pending = null;

  const renderPending = () => {
    if (!importBtn) return;
    if (!pending) {
      if (pendingEl) pendingEl.hidden = true;
      if (importCancelBtn) importCancelBtn.hidden = true;
      importBtn.classList.replace("ne-settings-btn--primary", "ne-settings-btn--secondary");
      neSettingsSetButtonContent(importBtn, "fa-upload", "Import settings…");
      return;
    }
    const name = pending.file.name.length > 40
      ? `${pending.file.name.slice(0, 37)}…`
      : pending.file.name;
    if (pendingEl) {
      const title = pendingEl.querySelector("[data-pending-file]");
      const list = pendingEl.querySelector("[data-pending-lines]");
      if (title) title.textContent = pending.file.name;
      list?.replaceChildren(
        ...neSettingsDescribeBackupImport(pending.backup).map((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          return li;
        }),
      );
      pendingEl.hidden = false;
    }
    if (importCancelBtn) importCancelBtn.hidden = false;
    importBtn.classList.replace("ne-settings-btn--secondary", "ne-settings-btn--primary");
    neSettingsSetButtonContent(importBtn, "fa-check", `Import “${name}”`);
  };

  // Per-action options, not saved preferences.
  document
    .querySelectorAll("#ne-settings-backup .ne-settings-toggle")
    .forEach((toggle) => {
      toggle.addEventListener("click", () => {
        neSettingsSyncToggleVisual(
          toggle,
          toggle.getAttribute("aria-checked") !== "true",
        );
        if (pending && toggle.id.startsWith("ne-backup-import-")) renderPending();
      });
    });

  const exportBtn = document.getElementById("ne-backup-export");
  const exportStatus = document.getElementById("ne-backup-export-status");
  exportBtn?.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      const backup = await neSettingsExportBackup();
      if (exportStatus) {
        exportStatus.textContent = backup.includesCredentials
          ? "Exported, including credentials. Keep this file private."
          : "Exported.";
      }
    } catch (error) {
      console.error("[Nyaa Enhancer] Settings export failed.", error);
      if (exportStatus) exportStatus.textContent = "Couldn't export settings.";
    } finally {
      exportBtn.disabled = false;
    }
  });

  // The first press picks a file and shows what it contains; the next press
  // imports it straight away.
  importBtn?.addEventListener("click", async () => {
    if (importBtn.disabled) return;
    importBtn.disabled = true;
    try {
      if (!pending) {
        const file = await neSettingsPickJsonFile();
        if (!file) return;
        if (importStatus) importStatus.textContent = "";
        pending = { file, backup: await neSettingsReadBackupFile(file) };
        renderPending();
        return;
      }
      if (importCancelBtn) importCancelBtn.disabled = true;
      await neSettingsApplyBackup(pending.backup, importStatus);
    } catch (error) {
      console.error("[Nyaa Enhancer] Settings import failed.", error);
      if (importStatus) importStatus.textContent = error?.message || "Couldn't import settings.";
      if (importCancelBtn) importCancelBtn.disabled = false;
    } finally {
      importBtn.disabled = false;
    }
  });

  importCancelBtn?.addEventListener("click", () => {
    pending = null;
    renderPending();
    neSettingsShowFadingStatus(importStatus, "Import cancelled.");
  });

  const resetBtn = document.getElementById("ne-backup-reset");
  const resetStatus = document.getElementById("ne-backup-reset-status");
  resetBtn?.addEventListener("click", async () => {
    const clearCredentials = neSettingsBackupToggleOn("ne-backup-reset-credentials");
    const { cloudSyncEnabled } = await loadStoredPreferences();
    const confirmed = await neSettingsConfirmModal({
      title: "Reset all settings?",
      paragraphs: [
        "Every Nyaa Enhancer setting goes back to its default, and this is cleared:",
      ],
      items: [
        "Filters and filter presets",
        "Highlights",
        "Monitored users and keywords",
        "qBittorrent categories and tags",
        ...(clearCredentials
          ? ["Torrent client connection, passwords, API keys, and the Cloud Sync (WebDAV) login"]
          : []),
      ],
      notes: [
        clearCredentials
          ? "History and caches are kept."
          : "Your torrent client connection, passwords, API keys, history, and caches are kept.",
        ...(cloudSyncEnabled
          ? ["Cloud sync is on, so your other synced browsers are reset too. Your Cloud Sync setup itself is kept."]
          : []),
        "This can't be undone. Export your settings first if you want a backup.",
      ],
      confirmLabel: "Reset settings",
      danger: true,
    });
    if (!confirmed) {
      neSettingsShowFadingStatus(resetStatus, "Reset cancelled.");
      return;
    }
    resetBtn.disabled = true;
    if (resetStatus) resetStatus.textContent = "Resetting…";
    try {
      await resetPreferences({ clearCredentials });
      if (resetStatus) resetStatus.textContent = "Settings reset. Reloading…";
      neSettingsBackupReloadSoon();
    } catch (error) {
      console.error("[Nyaa Enhancer] Settings reset failed.", error);
      if (resetStatus) resetStatus.textContent = "Couldn't reset settings.";
      resetBtn.disabled = false;
    }
  });
}

export function neSettingsBuildPageHTML() {
  const navLinks = NE_SETTINGS_NAV_SECTIONS
    .map(
      (s) =>
        `<button type="button" class="ne-settings-nav__link" data-target="${s.id}">${s.label}</button>`,
    )
    .join("");

  const page = document.createElement("div");
  page.className = "ne-settings-page";
  page.innerHTML = `
    <header class="ne-settings-page__header">
      <h1>Settings</h1>
      <p class="ne-settings-page__subtitle">
        Configure how Nyaa Enhancer behaves on this site.
        Torrent client connection and API keys (ameNZB, TMDB) are managed in the
        <strong>extension popup</strong> (click the extension icon in your browser toolbar).
      </p>
      <div class="ne-settings-search">
        <div class="ne-settings-search__field">
          <span class="ne-settings-search__icon" aria-hidden="true"><i class="fa fa-search"></i></span>
          <input
            type="search"
            id="ne-settings-search"
            placeholder="Search settings"
            autocomplete="off"
            spellcheck="false"
            enterkeyhint="search"
            aria-label="Search settings"
            aria-describedby="ne-settings-search-status"
          />
          <button type="button" class="ne-settings-search__clear" id="ne-settings-search-clear" hidden aria-label="Clear search">
            <i class="fa fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <p class="ne-settings-search__status" id="ne-settings-search-status" role="status"></p>
      </div>
    </header>
    <div class="ne-settings-layout">
      <nav class="ne-settings-nav" aria-label="Settings categories">${navLinks}</nav>
      <div class="ne-settings-main">
        <p class="ne-settings-search-empty" id="ne-settings-search-empty" hidden>No settings match your search.</p>
        <section id="ne-settings-download" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-download" aria-hidden="true"></i> Download</h2>
          <p class="ne-settings-section__desc">Options for batch torrent file downloads from the torrent list.</p>
          <div class="ne-settings-rows" id="ne-settings-download-rows"></div>
        </section>
        <section id="ne-settings-interface" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-sliders" aria-hidden="true"></i> Interface</h2>
          <p class="ne-settings-section__desc">Control which buttons and controls appear on Nyaa pages.</p>
          <div class="ne-settings-rows" id="ne-settings-interface-rows"></div>
        </section>
        <section id="ne-settings-navbar" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-bars" aria-hidden="true"></i> Navbar</h2>
          <p class="ne-settings-section__desc">Show or hide built-in Nyaa header links and search controls.</p>
          <div class="ne-settings-rows" id="ne-settings-navbar-rows"></div>
        </section>
        <section id="ne-settings-filters" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-filter" aria-hidden="true"></i> Filters</h2>
          <p class="ne-settings-section__desc">Filter options for the torrent list. Active filters (dead torrents, minimum seeders, blocked/required keywords, file size, completed downloads, upload date, and history) and saved presets are configured in the Filters panel above the torrent table.</p>
          <div class="ne-settings-rows" id="ne-settings-filters-rows"></div>
        </section>
        <section id="ne-settings-quicksearch" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-search" aria-hidden="true"></i> Quick Search</h2>
          <p class="ne-settings-section__desc">Options for the Quick Search popup on the torrent list.</p>
          <div class="ne-settings-field">
            <label for="ne-quicksearch-provider">Anime title provider</label>
            <select id="ne-quicksearch-provider">
              <option value="tenrai">Tenrai (no API key needed)</option>
              <option value="tmdb">TMDB (needs an API key)</option>
            </select>
          </div>
          <p class="ne-settings-row__hint">Suggests titles and loads aliases as you type in the Anime Name field. If the chosen provider fails or finds nothing, the other one is tried. TMDB is only used when a TMDB API key is set in the extension popup.</p>
          <p class="ne-settings-notice">Tenrai allows 120 requests per minute and 4 per second. All Tenrai requests from Quick Search and Similar Anime share one queue across every tab and stay below that limit.</p>
        </section>
        <section id="ne-settings-autoload" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-bolt" aria-hidden="true"></i> Auto-load</h2>
          <p class="ne-settings-section__desc">Load extra torrent pages in place until a visible-count target is reached. The Auto-load bar sits above the torrent table.</p>
          <div class="ne-settings-rows" id="ne-settings-autoload-rows"></div>
          <div class="ne-settings-subsection" id="ne-autoload-options" data-depends-on="showAutoLoad">
            <div class="ne-settings-input-grid">
              <div class="ne-settings-field">
                <label for="ne-show-more-until-visible">Show more until N visible</label>
                <input type="number" id="ne-show-more-until-visible" min="0" max="1000" step="1" />
              </div>
              <div class="ne-settings-field">
                <label for="ne-show-more-auto-delay">Delay between pages (seconds)</label>
                <div class="ne-settings-field__with-action">
                  <input type="number" id="ne-show-more-auto-delay" min="${NE_SETTINGS_AUTOLOAD_DELAY_MIN_SEC}" max="${NE_SETTINGS_AUTOLOAD_DELAY_MAX_SEC}" step="0.1" inputmode="decimal" />
                  <button type="button" class="ne-settings-btn ne-settings-btn--outline ne-settings-btn--small" id="ne-show-more-auto-delay-reset">Reset</button>
                </div>
              </div>
            </div>
            <p class="ne-settings-row__hint">Used when Auto-load is on above the torrent table. Keeps loading pages one at a time until this many torrents remain visible (max 1000). 0 loads one extra page at a time. Default delay is ${NE_SETTINGS_AUTOLOAD_DELAY_DEFAULT_SEC} seconds.</p>
            <p class="ne-settings-disclaimer is-visible" id="ne-autoload-delay-disclaimer">
              Short delays send page requests to Nyaa much more often. Values near ${NE_SETTINGS_AUTOLOAD_DELAY_MIN_SEC} seconds can get you rate limited or temporarily blocked. You are responsible for the delay you choose; use a low number at your own risk.
            </p>
          </div>
        </section>
        <section id="ne-settings-history" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-history" aria-hidden="true"></i> History</h2>
          <p class="ne-settings-section__desc">Local log of torrent pages you visit, magnets you copy, files you download, and torrents you send. Off by default.</p>
          <div class="ne-settings-rows" id="ne-settings-history-rows"></div>
          <div class="ne-settings-subsection" id="ne-history-options">
            <div class="ne-settings-input-grid">
              <div class="ne-settings-field">
                <label for="ne-history-max-events">Event cap</label>
                <input type="number" id="ne-history-max-events" min="${HISTORY_MAX_EVENTS_MIN}" max="${HISTORY_MAX_EVENTS_MAX}" step="50" />
              </div>
            </div>
            <p class="ne-settings-row__hint">Oldest entries are dropped when the cap is reached. Set 0 to keep nothing. Open the <a href="/history">History page</a> to browse the log.</p>
            <div class="ne-similar-cache-actions">
              <button type="button" id="ne-history-clear-settings" class="ne-settings-btn ne-settings-btn--secondary">
                <i class="fa fa-trash" aria-hidden="true"></i>
                Clear history
              </button>
              <span id="ne-history-clear-settings-status" class="ne-settings-status" role="status"></span>
            </div>
          </div>
          <p class="ne-settings-notice">When History is off, nothing is logged. When it is on, entries are kept in this browser's local storage. History only leaves this browser if you turn on Include history under Cloud Sync, and then only to your own WebDAV server.</p>
        </section>
        <section id="ne-settings-view" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-file-text-o" aria-hidden="true"></i> Torrent View Page</h2>
          <p class="ne-settings-section__desc">Customize individual torrent view pages.</p>
          <div class="ne-settings-rows" id="ne-settings-view-rows"></div>
        </section>
        <section id="ne-settings-monitoring" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-bell" aria-hidden="true"></i> Monitoring</h2>
          <p class="ne-settings-section__desc">Track new uploads from favorite uploaders or torrents matching specific keywords. Notifications appear in the sidebar on the left edge of the screen.</p>
          <div class="ne-settings-monitor-tabs" role="tablist">
            <button type="button" class="ne-settings-monitor-tab is-active" data-monitor-tab="users" role="tab" aria-selected="true">User Monitoring</button>
            <button type="button" class="ne-settings-monitor-tab" data-monitor-tab="keywords" role="tab" aria-selected="false">Keyword Monitoring</button>
          </div>
          <div id="ne-monitor-users-panel" role="tabpanel">
            <details class="ne-settings-howto">
              <summary>How to monitor a user</summary>
              <ol>
                <li>Visit any user's page on Nyaa (e.g. <code>/user/username</code>)</li>
                <li>Click the <strong>Monitor</strong> button next to their name</li>
                <li>You'll receive notifications in the sidebar when they upload new torrents</li>
              </ol>
            </details>
            <div class="ne-settings-monitor-header">
              <h3>Currently Monitored Users</h3>
              <button type="button" id="ne-unmonitor-all-users" class="ne-settings-btn ne-settings-btn--ghost ne-settings-btn--small">Unmonitor All</button>
            </div>
            <div id="ne-monitored-users-list" class="ne-settings-monitor-list"></div>
          </div>
          <div id="ne-monitor-keywords-panel" role="tabpanel" hidden>
            <details class="ne-settings-howto">
              <summary>How to monitor keywords</summary>
              <ol>
                <li>Visit the Nyaa homepage or any page with the torrent list</li>
                <li>Click the <strong>Keyword Monitor</strong> button in the toolbar, or add keywords below</li>
                <li>You'll receive sidebar notifications when new torrents match your keywords</li>
              </ol>
            </details>
            <div class="ne-settings-keyword-add">
              <input type="text" id="ne-monitor-keyword-input" placeholder="Enter keyword to monitor" />
              <button type="button" id="ne-add-monitor-keyword" class="ne-settings-btn ne-settings-btn--primary ne-settings-btn--small">Add Monitor</button>
            </div>
            <div class="ne-settings-monitor-header">
              <h3>Currently Monitored Keywords</h3>
              <button type="button" id="ne-unmonitor-all-keywords" class="ne-settings-btn ne-settings-btn--ghost ne-settings-btn--small">Unmonitor All</button>
            </div>
            <div id="ne-monitored-keywords-list" class="ne-settings-monitor-list"></div>
          </div>
        </section>
        <section id="ne-settings-animetosho" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-external-link" aria-hidden="true"></i> AnimeTosho</h2>
          <p class="ne-settings-section__desc">AnimeTosho links and metadata on supported anime torrents.</p>
          <div class="ne-settings-rows" id="ne-settings-animetosho-rows"></div>
        </section>
        <section id="ne-settings-amenzb" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-external-link" aria-hidden="true"></i> ameNZB</h2>
          <p class="ne-settings-section__desc">ameNZB release links and metadata on supported torrents. Requires an API key configured in the extension popup.</p>
          <div class="ne-settings-rows" id="ne-settings-amenzb-rows"></div>
          <div class="ne-settings-row ne-settings-row--quota">
            <div class="ne-settings-row__info">
              <span class="ne-settings-row__label">API Requests Today</span>
            </div>
            <span id="ne-amenzb-request-count" class="ne-settings-quota">0 / 10,000</span>
          </div>
          <p class="ne-settings-notice ne-settings-notice--warning">
            ⚠ API calls must come from your pinned IP address (set on ameNZB in Account Settings → IP Security). Requests from other IPs are rejected.
          </p>
        </section>
        <section id="ne-settings-nekobt" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-external-link" aria-hidden="true"></i> nekoBT</h2>
          <p class="ne-settings-section__desc">nekoBT release links and metadata sections.</p>
          <div class="ne-settings-rows" id="ne-settings-nekobt-rows"></div>
          <p class="ne-settings-notice">Rate limits are enforced but not publicly disclosed. If exceeded, requests will silently fail until the limit resets.</p>
        </section>
        <section id="ne-settings-tsukihime" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-external-link" aria-hidden="true"></i> Tsukihime</h2>
          <p class="ne-settings-section__desc">Tsukihime release links and metadata sections.</p>
          <div class="ne-settings-rows" id="ne-settings-tsukihime-rows"></div>
          <p class="ne-settings-notice">Tsukihime API rate limits are currently unknown. Excessive use may trigger rate limiting.</p>
        </section>
        <section id="ne-settings-similar" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-random" aria-hidden="true"></i> Similar Anime</h2>
          <p class="ne-settings-section__desc">Show related, recommended, and same-vibe anime in a Similar tab on torrent view pages.</p>
          <div class="ne-settings-rows" id="ne-settings-similar-rows"></div>
          <p class="ne-settings-disclaimer" id="ne-similar-tmdb-disclaimer">
            TMDB similar and recommended titles need a TMDB API key. Add a free key in the extension popup under TMDB.
            Without a key this option does nothing.
            Create one at
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">themoviedb.org/settings/api</a>.
          </p>
          <div class="ne-settings-subsection" id="ne-similar-vibe-weights">
            <p class="ne-settings-subsection__title">Same vibe mix</p>
            <p class="ne-settings-row__hint">Two knobs split 100% across genres, tags, and studio. Drag a knob or type a percent.</p>
            <div class="ne-vibe-mix" id="ne-vibe-mix">
              <div class="ne-vibe-mix__slider" id="ne-vibe-mix-slider">
                <div class="ne-vibe-mix__track" aria-hidden="true"></div>
                <button type="button" class="ne-vibe-mix__knob" data-knob="a" role="slider" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-label="Genres and tags split"></button>
                <button type="button" class="ne-vibe-mix__knob" data-knob="b" role="slider" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-label="Tags and studio split"></button>
              </div>
              <div class="ne-vibe-mix__legend">
                <label class="ne-vibe-mix__item" data-vibe="genre" for="ne-similar-vibe-genre-num">
                  <span class="ne-vibe-mix__swatch" aria-hidden="true"></span>
                  <span class="ne-vibe-mix__name">Genres</span>
                  <input type="number" id="ne-similar-vibe-genre-num" min="0" max="100" step="1" aria-label="Shared genres percent" />
                  <span class="ne-vibe-mix__suffix">%</span>
                </label>
                <label class="ne-vibe-mix__item" data-vibe="tags" for="ne-similar-vibe-tags-num">
                  <span class="ne-vibe-mix__swatch" aria-hidden="true"></span>
                  <span class="ne-vibe-mix__name">Tags</span>
                  <input type="number" id="ne-similar-vibe-tags-num" min="0" max="100" step="1" aria-label="Shared tags percent" />
                  <span class="ne-vibe-mix__suffix">%</span>
                </label>
                <label class="ne-vibe-mix__item" data-vibe="studio" for="ne-similar-vibe-studio-num">
                  <span class="ne-vibe-mix__swatch" aria-hidden="true"></span>
                  <span class="ne-vibe-mix__name">Studio</span>
                  <input type="number" id="ne-similar-vibe-studio-num" min="0" max="100" step="1" aria-label="Shared studio percent" />
                  <span class="ne-vibe-mix__suffix">%</span>
                </label>
              </div>
              <div class="ne-vibe-mix__actions">
                <button type="button" id="ne-similar-reset-mix" class="ne-settings-btn ne-settings-btn--outline ne-settings-btn--small">Reset mix</button>
              </div>
            </div>
          </div>
          <div class="ne-settings-subsection" id="ne-similar-cache">
            <p class="ne-settings-subsection__title">Cached results</p>
            <p class="ne-settings-row__hint">Matches, recommendations, ID mappings, and card details are stored so reopening a tab or details modal doesn’t hit the APIs again. ID mappings last up to 30 days; recs and details last 24 hours. You normally don’t need to clear this.</p>
            <div class="ne-similar-cache-actions">
              <button type="button" id="ne-similar-clear-cache" class="ne-settings-btn ne-settings-btn--secondary">
                <i class="fa fa-trash" aria-hidden="true"></i>
                Clear Similar Cache
              </button>
              <div class="ne-similar-cache-usage" id="ne-similar-cache-usage" aria-live="polite">
                <span class="ne-similar-cache-usage__total" data-cache-total>0 B</span>
                <span class="ne-similar-cache-usage__parts" data-cache-parts>Identify 0 B · Recs 0 B · AnimeAPI 0 B · Details 0 B</span>
              </div>
              <span id="ne-similar-clear-cache-status" class="ne-settings-status" role="status"></span>
            </div>
          </div>
          <p class="ne-settings-notice">
            Requests run only when you open the Similar tab. Recommended merges MyAnimeList and AniList votes by default.
            Identification uses SeaDex when the info hash is listed, then AnimeTosho series, Tenrai, and AniList.
            Changing the mix re-scores cached titles without extra API calls.
          </p>
        </section>
        <section id="ne-settings-features" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-star" aria-hidden="true"></i> Additional Features</h2>
          <p class="ne-settings-section__desc">Extra enhancements for browsing and discovering torrents.</p>
          <div class="ne-settings-rows" id="ne-settings-features-rows"></div>
          <div class="ne-settings-subsection" id="ne-sp-options">
            <div class="ne-settings-rows" id="ne-settings-screenshot-rows"></div>
            <p class="ne-settings-disclaimer" id="ne-sp-disclaimer">
              Each hovered link sends a request to Nyaa to fetch its images.
              Setting the hover delay to 0 sends a request for every link your mouse passes over.
              Excessive requests may result in rate limiting. Use at your own risk.
            </p>
            <div class="ne-settings-input-grid">
              <div class="ne-settings-field">
                <label for="ne-sp-hover-delay">Hover delay (seconds)</label>
                <input type="number" id="ne-sp-hover-delay" min="0" step="0.5" disabled />
              </div>
              <div class="ne-settings-field">
                <label for="ne-sp-slide-delay">Image change interval (seconds)</label>
                <input type="number" id="ne-sp-slide-delay" min="0.1" step="0.5" disabled />
              </div>
            </div>
          </div>
        </section>
        <section id="ne-settings-highlights" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-paint-brush" aria-hidden="true"></i> Highlights</h2>
          <p class="ne-settings-section__desc">Color torrent list rows when the name contains a keyword you choose. Phrases like <code>SubsPlease</code> are matched as-is, ignoring case. If several keywords match the same torrent, the longest one is used.</p>
          <div class="ne-settings-rows" id="ne-settings-highlights-rows"></div>
          <div class="ne-settings-hl-add">
            <input type="text" id="ne-hl-keyword-input" placeholder="Keyword or phrase (e.g. SubsPlease)" />
            <input type="color" id="ne-hl-keyword-color" value="#8e44ad" title="Highlight color" aria-label="Highlight color" />
            <button type="button" id="ne-add-hl-keyword" class="ne-settings-btn ne-settings-btn--primary ne-settings-btn--small">Add</button>
          </div>
          <div class="ne-settings-monitor-header">
            <h3>Keyword colors</h3>
            <button type="button" id="ne-remove-all-hl-keywords" class="ne-settings-btn ne-settings-btn--ghost ne-settings-btn--small">Remove All</button>
          </div>
          <div id="ne-hl-keywords-list" class="ne-settings-hl-list"></div>
        </section>
        <section id="ne-settings-qbt" class="ne-settings-section" hidden>
          <h2 class="ne-settings-section__title"><i class="fa fa-folder-open" aria-hidden="true"></i> qBittorrent Categories &amp; Tags</h2>
          <p class="ne-settings-section__desc">Define categories and tags to apply when sending torrents. Set global defaults or choose per-torrent via the Send dialog.</p>
          <div class="ne-settings-rows" id="ne-settings-qbt-rows"></div>
          <div class="ne-settings-subsection">
            <p class="ne-settings-subsection__title">Default Category</p>
            <div class="ne-settings-field">
              <select id="ne-qbt-default-category"><option value="">(none)</option></select>
            </div>
          </div>
          <div class="ne-settings-subsection">
            <p class="ne-settings-subsection__title">Default Tags</p>
            <div class="ne-settings-qbt-tags" id="ne-qbt-default-tags">
              <span class="ne-settings-empty">No tags defined yet.</span>
            </div>
          </div>
          <div class="ne-settings-qbt-grid">
            <div class="ne-settings-qbt-manage">
              <p class="ne-settings-subsection__title">Categories</p>
              <div class="ne-settings-qbt-add-row">
                <input type="text" id="ne-qbt-new-category" placeholder="New category name" />
                <button type="button" id="ne-qbt-add-category" class="ne-settings-btn ne-settings-btn--primary ne-settings-btn--small">Add</button>
              </div>
              <div class="ne-settings-qbt-list" id="ne-qbt-categories-list">
                <span class="ne-settings-empty">No categories defined.</span>
              </div>
            </div>
            <div class="ne-settings-qbt-manage">
              <p class="ne-settings-subsection__title">Tags</p>
              <div class="ne-settings-qbt-add-row">
                <input type="text" id="ne-qbt-new-tag" placeholder="New tag name" />
                <button type="button" id="ne-qbt-add-tag" class="ne-settings-btn ne-settings-btn--primary ne-settings-btn--small">Add</button>
              </div>
              <div class="ne-settings-qbt-list" id="ne-qbt-tags-list">
                <span class="ne-settings-empty">No tags defined.</span>
              </div>
            </div>
          </div>
          <div class="ne-settings-qbt-actions">
            <button type="button" id="ne-qbt-sync-btn" class="ne-settings-btn ne-settings-btn--primary">
              <span id="ne-qbt-sync-icon" class="ne-settings-sync-icon">↻</span> Sync from qBittorrent
            </button>
            <span id="ne-qbt-sync-status" class="ne-settings-status"></span>
          </div>
        </section>
        <section id="ne-settings-cloud" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-cloud" aria-hidden="true"></i> Cloud Sync</h2>
          <p class="ne-settings-section__desc">Keep your settings in your own WebDAV storage (Nextcloud, a Synology NAS, Koofr and others), so every browser you turn this on in stays in sync. Changes are uploaded a few seconds after you make them, and your other browsers pick them up while you use Nyaa there (you choose how often below), and right away when you open this Settings page.</p>
          <details class="ne-settings-howto" id="ne-cloud-guide">
            <summary>How to set it up</summary>
            <ol>
              <li><strong>Find your WebDAV folder address.</strong> Every service shows it somewhere different (see the examples below). It's the full address of a folder, not just the website.</li>
              <li><strong>Create an app password</strong> if your service has them (Nextcloud: Personal settings → Security → Devices &amp; sessions → Create new app password). It's safer than your real password and works when two-factor login is on.</li>
              <li><strong>Paste the address below</strong> and click away from the field. The check under it tells you if the address looks right.</li>
              <li><strong>Open the extension popup</strong> (the Nyaa Enhancer icon in your toolbar) → Settings tab → <strong>Cloud Sync (WebDAV)</strong>. Enter your username and the app password, then press <strong>Connect</strong> and allow access when your browser asks.</li>
              <li><strong>Come back here, press Test connection</strong>, and once it says it's connected, <strong>turn on Enable cloud sync</strong>.</li>
              <li>Repeat steps 3–5 in each other browser. When you turn sync on in a browser, it takes the settings already in the cloud. If the cloud is still empty, that browser's settings are uploaded instead.</li>
            </ol>
            <p class="ne-cloud-guide__title">Where to find the address</p>
            <ul class="ne-cloud-guide__list">
              <li><strong>Nextcloud:</strong> open Files → <em>Files settings</em> (bottom left) and copy the WebDAV address. It looks like <code>https://cloud.example.com/remote.php/dav/files/USERNAME</code>.</li>
              <li><strong>Synology NAS:</strong> install and turn on <em>WebDAV Server</em> in Package Center, then use <code>https://YOUR-NAS:5006/home</code> (or another shared folder).</li>
              <li><strong>Koofr:</strong> <code>https://app.koofr.net/dav/Koofr</code>. Koofr has no usernames: use your Koofr account email as the username, and an app password (Preferences → Password) as the WebDAV password.</li>
              <li><strong>Other services:</strong> look for "WebDAV" in your account or app settings. Any folder address that accepts WebDAV works.</li>
            </ul>
            <p class="ne-cloud-guide__note">Nyaa Enhancer creates a <code>nyaa-enhancer</code> folder there with one file, <code>settings.json</code>. It's the same format as Export below, so you can also import it by hand.</p>
          </details>
          <div class="ne-settings-rows" id="ne-settings-cloud-rows"></div>
          <div class="ne-settings-subsection">
            <div class="ne-settings-field">
              <label for="ne-cloud-url">WebDAV folder address</label>
              <div class="ne-settings-field__with-action">
                <input type="url" id="ne-cloud-url" placeholder="https://cloud.example.com/remote.php/dav/files/USERNAME" autocomplete="off" spellcheck="false" />
                <button type="button" class="ne-settings-btn ne-settings-btn--outline ne-settings-btn--small" id="ne-cloud-test">Test connection</button>
              </div>
            </div>
            <p class="ne-cloud-check" id="ne-cloud-url-check" hidden></p>
            <p class="ne-cloud-check" id="ne-cloud-test-result" role="status" hidden></p>
            <div class="ne-cloud-account" id="ne-cloud-account"></div>
          </div>
          <div class="ne-settings-rows" id="ne-settings-cloud-options"></div>
          <div class="ne-settings-subsection">
            <div class="ne-settings-field">
              <label for="ne-cloud-check-interval">Check for changes from other browsers</label>
              <select id="ne-cloud-check-interval">
                ${CLOUD_SYNC_CHECK_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
              </select>
            </div>
            <p class="ne-settings-row__hint ne-cloud-interval-hint">Checks only happen while you're using Nyaa in this browser, and a check that finds nothing new is a tiny request. Your own changes are always uploaded a few seconds after you make them. This choice is just for this browser.</p>
          </div>
          <div class="ne-settings-subsection">
            <p class="ne-settings-subsection__title">Status</p>
            <dl class="ne-cloud-status" id="ne-cloud-status"></dl>
            <div class="ne-similar-cache-actions">
              <button type="button" id="ne-cloud-sync-now" class="ne-settings-btn ne-settings-btn--primary">
                <i class="fa fa-refresh" aria-hidden="true"></i>
                Sync now
              </button>
              <button type="button" id="ne-cloud-upload" class="ne-settings-btn ne-settings-btn--outline ne-settings-btn--small">Replace cloud copy with this browser</button>
              <button type="button" id="ne-cloud-download" class="ne-settings-btn ne-settings-btn--outline ne-settings-btn--small">Replace this browser with cloud copy</button>
              <span id="ne-cloud-action-status" class="ne-settings-status" role="status"></span>
            </div>
          </div>
          <p class="ne-settings-notice">Your data only goes to the server you enter here. These Cloud Sync settings stay in this browser. The WebDAV login is only uploaded with Include credentials on, and it never replaces another browser's own login. Use https:// addresses so your password and settings are encrypted on the way.</p>
        </section>
        <section id="ne-settings-cache" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-hdd-o" aria-hidden="true"></i> Cache</h2>
          <p class="ne-settings-section__desc">Results stored on this device so the extension doesn't ask the same APIs again. Clearing is safe: anything removed is fetched again the next time it's needed.</p>
          <div class="ne-settings-rows">
            <div class="ne-settings-row">
              <div class="ne-settings-row__info">
                <span class="ne-settings-row__label">Similar Anime</span>
                <span class="ne-settings-row__hint">Matches, recommendations, ID mappings, and card details.</span>
              </div>
              <span class="ne-settings-quota" data-cache-size="similar" hidden></span>
            </div>
            <div class="ne-settings-row">
              <div class="ne-settings-row__info">
                <span class="ne-settings-row__label">Quick Search alternative titles</span>
                <span class="ne-settings-row__hint">TheXEM name lists used to find other titles for a show. Refreshed weekly.</span>
              </div>
              <span class="ne-settings-quota" data-cache-size="xem" hidden></span>
            </div>
          </div>
          <div class="ne-similar-cache-actions">
            <button type="button" id="ne-cache-clear-all" class="ne-settings-btn ne-settings-btn--secondary">
              <i class="fa fa-trash" aria-hidden="true"></i>
              Clear All Cache
            </button>
            <span class="ne-settings-status" data-cache-size="total" hidden></span>
            <span id="ne-cache-clear-all-status" class="ne-settings-status" role="status"></span>
          </div>
          <p class="ne-settings-notice">Settings, history, and credentials are not touched. Pages that are already open keep their in-memory results until you reload them.</p>
        </section>
        <section id="ne-settings-backup" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-database" aria-hidden="true"></i> Backup &amp; Reset</h2>
          <p class="ne-settings-section__desc">Move your settings to another browser or device with a JSON file, or go back to the defaults.</p>
          <div class="ne-settings-subsection">
            <p class="ne-settings-subsection__title">Export settings</p>
            <p class="ne-settings-row__hint">Saves all your settings, filters and presets, highlights, monitored users and keywords, Quick Search and Send dialog choices, torrent client address and username, qBittorrent categories and tags, and your Cloud Sync address and options. Caches are not included.</p>
            <div class="ne-settings-rows">
              <div class="ne-settings-row">
                <div class="ne-settings-row__info">
                  <span class="ne-settings-row__label">Include credentials</span>
                  <span class="ne-settings-row__hint">qBittorrent, Transmission, and Deluge passwords, the ameNZB and TMDB API keys, and your Cloud Sync (WebDAV) login. They are saved in plain text, so keep the file private.</span>
                </div>
                <button type="button" class="ne-settings-toggle is-off" id="ne-backup-export-credentials" role="switch" aria-checked="false" aria-label="Include credentials">
                  <span class="ne-settings-toggle__thumb"></span>
                </button>
              </div>
              <div class="ne-settings-row">
                <div class="ne-settings-row__info">
                  <span class="ne-settings-row__label">Include history</span>
                  <span class="ne-settings-row__hint">Adds your local History log to the file.</span>
                </div>
                <button type="button" class="ne-settings-toggle is-off" id="ne-backup-export-history" role="switch" aria-checked="false" aria-label="Include history">
                  <span class="ne-settings-toggle__thumb"></span>
                </button>
              </div>
            </div>
            <div class="ne-similar-cache-actions">
              <button type="button" id="ne-backup-export" class="ne-settings-btn ne-settings-btn--primary">
                <i class="fa fa-download" aria-hidden="true"></i>
                Export settings
              </button>
              <span id="ne-backup-export-status" class="ne-settings-status" role="status"></span>
            </div>
          </div>
          <div class="ne-settings-subsection">
            <p class="ne-settings-subsection__title">Import settings</p>
            <p class="ne-settings-row__hint">Settings in the file replace your current ones. Anything the file doesn't contain stays as it is. Choose a file first to see what it contains, then press Import again to apply it.</p>
            <div class="ne-settings-rows">
              <div class="ne-settings-row">
                <div class="ne-settings-row__info">
                  <span class="ne-settings-row__label">Import credentials</span>
                  <span class="ne-settings-row__hint">Use passwords and API keys from the file if it has them. When off, your current credentials are kept.</span>
                </div>
                <button type="button" class="ne-settings-toggle is-off" id="ne-backup-import-credentials" role="switch" aria-checked="false" aria-label="Import credentials">
                  <span class="ne-settings-toggle__thumb"></span>
                </button>
              </div>
              <div class="ne-settings-row">
                <div class="ne-settings-row__info">
                  <span class="ne-settings-row__label">Import history</span>
                  <span class="ne-settings-row__hint">Replace your current History log with the one in the file, if it has one.</span>
                </div>
                <button type="button" class="ne-settings-toggle is-off" id="ne-backup-import-history" role="switch" aria-checked="false" aria-label="Import history">
                  <span class="ne-settings-toggle__thumb"></span>
                </button>
              </div>
            </div>
            <div class="ne-settings-backup-pending" id="ne-backup-import-pending" hidden>
              <p class="ne-settings-backup-pending__file"><i class="fa fa-file-text-o" aria-hidden="true"></i> <span data-pending-file></span></p>
              <ul class="ne-settings-backup-pending__lines" data-pending-lines></ul>
              <p class="ne-settings-backup-pending__warning"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> Pressing Import applies this file right away. You won't be asked to confirm again.</p>
            </div>
            <div class="ne-similar-cache-actions">
              <button type="button" id="ne-backup-import" class="ne-settings-btn ne-settings-btn--secondary">
                <i class="fa fa-upload" aria-hidden="true"></i>
                Import settings…
              </button>
              <button type="button" id="ne-backup-import-cancel" class="ne-settings-btn ne-settings-btn--ghost" hidden>Cancel</button>
              <span id="ne-backup-import-status" class="ne-settings-status" role="status"></span>
            </div>
          </div>
          <div class="ne-settings-subsection">
            <p class="ne-settings-subsection__title">Reset settings</p>
            <p class="ne-settings-row__hint">Restores every setting to its default and clears filters and presets, highlights, monitored users and keywords, and qBittorrent categories and tags. History and caches are kept.</p>
            <div class="ne-settings-rows">
              <div class="ne-settings-row">
                <div class="ne-settings-row__info">
                  <span class="ne-settings-row__label">Also clear torrent client and API keys</span>
                  <span class="ne-settings-row__hint">Removes the torrent client connection, usernames, passwords, the ameNZB and TMDB API keys, and the Cloud Sync (WebDAV) login.</span>
                </div>
                <button type="button" class="ne-settings-toggle is-off" id="ne-backup-reset-credentials" role="switch" aria-checked="false" aria-label="Also clear torrent client and API keys">
                  <span class="ne-settings-toggle__thumb"></span>
                </button>
              </div>
            </div>
            <div class="ne-similar-cache-actions">
              <button type="button" id="ne-backup-reset" class="ne-settings-btn ne-settings-btn--danger">
                <i class="fa fa-undo" aria-hidden="true"></i>
                Reset settings
              </button>
              <span id="ne-backup-reset-status" class="ne-settings-status" role="status"></span>
            </div>
          </div>
          <p class="ne-settings-notice">Export files are plain JSON and never leave your device unless you share them. Other open Nyaa tabs pick up imported or reset settings after a reload.</p>
        </section>
      </div>
    </div>
  `;

  const downloadRows = page.querySelector("#ne-settings-download-rows");
  downloadRows.append(
    neSettingsCreateToggleRow("useDisplayName", "Use display name as filename", "Use the torrent display name instead of the original filename when downloading.", "showButtons"),
    neSettingsCreateToggleRow("useZip", "Combine downloads as ZIP", "Bundle multiple selected torrents into a single ZIP file.", "showButtons"),
  );

  const interfaceRows = page.querySelector("#ne-settings-interface-rows");
  interfaceRows.append(
    neSettingsCreateToggleRow("showButtons", "Show button controls", "Master toggle for the enhancer toolbar, checkboxes, and action buttons."),
    neSettingsCreateToggleRow("showQuickFilter", "Show Quick Search button", "", "showButtons"),
    neSettingsCreateToggleRow("showMagnetButtons", "Show Magnet Copy buttons", "", "showButtons"),
    neSettingsCreateToggleRow("showSendButtons", "Show Send to Client button", "Requires a torrent client configured in the extension popup.", "showButtons"),
    neSettingsCreateToggleRow("showMonitorButtons", "Show Monitor buttons", "", "showButtons"),
    neSettingsCreateToggleRow("showScrollToTop", "Show Back to Top button", "A round button in the bottom-right corner on the torrent list, user pages, and this page. Its ring fills as you scroll down; scrolling by hand stops it."),
  );

  page.querySelector("#ne-settings-navbar-rows").append(
    ...NAVBAR_VISIBILITY_TOGGLES.map((item) =>
      neSettingsCreateToggleRow(item.key, item.label, item.hint || ""),
    ),
  );

  page.querySelector("#ne-settings-filters-rows").append(
    neSettingsCreateToggleRow(
      "showFiltersPanel",
      "Show Filters panel",
      "Show the Filters panel above the torrent table.",
    ),
    neSettingsCreateToggleRow("showFilterNotifications", "Show filter notifications", "Display a toast when torrents are hidden by active filters."),
  );

  page.querySelector("#ne-settings-autoload-rows").append(
    neSettingsCreateToggleRow(
      "showAutoLoad",
      "Show Auto-load",
      "Show the Auto-load bar above the torrent table.",
    ),
    neSettingsCreateToggleRow(
      "showMoreAutoEnabled",
      "Auto-load more results",
      "Turn on Auto-load when you open a torrent list. You can also switch it from the bar on the page.",
      "showAutoLoad",
    ),
  );

  page.querySelector("#ne-settings-history-rows").append(
    neSettingsCreateToggleRow(
      "historyEnabled",
      "Enable history",
      "Log torrent visits, magnet copies, downloads, and sends. Adds a History link to the navbar and records info hashes for the hide-from-history filter.",
    ),
  );

  page.querySelector("#ne-settings-view-rows").append(
    neSettingsCreateToggleRow("hideComments", "Hide comments", "Hide the comments section on torrent view pages."),
    neSettingsCreateToggleRow("improvedFileList", "Improved file list", "Show total and per-folder file counts on view pages."),
    neSettingsCreateToggleRow("copyTorrentTitle", "Copy title on click", "Click the torrent title on view pages to copy it to the clipboard."),
    neSettingsCreateToggleRow("copyTorrentInfoHash", "Copy info hash on click", "Click the info hash on view pages to copy it to the clipboard."),
  );

  page.querySelector("#ne-settings-animetosho-rows").append(
    neSettingsCreateToggleRow("showATLinks", "Show AnimeTosho links"),
    neSettingsCreateToggleRow("showATComments", "Show AnimeTosho comments"),
    neSettingsCreateToggleRow("showATScreenshotsSection", "Show Screenshots section"),
    neSettingsCreateToggleRow("showATFileInfoSection", "Show FileInfo section"),
    neSettingsCreateToggleRow("showATAttachmentsSection", "Show Downloads section"),
  );

  page.querySelector("#ne-settings-amenzb-rows").append(
    neSettingsCreateToggleRow(
      "showAmeNZBLinks",
      "Display ameNZB links",
      "Show ameNZB release links on supported view pages.",
      "ameNZBApiKey",
    ),
    neSettingsCreateToggleRow(
      "showAmeNZBSection",
      "Display ameNZB section",
      "Show release details in the description tabs on supported view pages.",
      "ameNZBApiKey",
    ),
  );

  page.querySelector("#ne-settings-nekobt-rows").append(
    neSettingsCreateToggleRow("showNekoBTLinks", "Display nekoBT links"),
    neSettingsCreateToggleRow("showNekoBTSection", "Display nekoBT section"),
    neSettingsCreateToggleRow("showNekoBTFullLangNames", "Full language names", "Show full language names instead of abbreviations."),
  );

  page.querySelector("#ne-settings-tsukihime-rows").append(
    neSettingsCreateToggleRow("showTsukihimeLinks", "Display Tsukihime links"),
    neSettingsCreateToggleRow("showTsukihimeSection", "Display Tsukihime section"),
  );

  page.querySelector("#ne-settings-similar-rows").append(
    neSettingsCreateToggleRow(
      "showSimilarSection",
      "Show Similar tab",
      "Adds a Similar tab on anime torrent view pages. Nothing is fetched until you open it.",
    ),
    neSettingsCreateToggleRow(
      "similarUseTmdbRecs",
      "Use TMDB similar and recommendations",
      "Replace MAL/AniList user recommendations with TMDB's similar and recommended titles. Related and same vibe stay as they are.",
      "showSimilarSection",
    ),
    neSettingsCreateToggleRow(
      "similarOpenAccordions",
      "Auto-open extra results",
      "Expand the “more” lists under Related, Recommended, and Same vibe instead of keeping them collapsed.",
      "showSimilarSection",
    ),
    neSettingsCreateToggleRow(
      "similarCardDetailsEnabled",
      "Show details on card click",
      "Open a details modal with synopsis, score, and links when you click a Similar card. The matched show at the top always opens details. Ctrl/Cmd-click still searches Nyaa.",
      "showSimilarSection",
    ),
    neSettingsCreateToggleRow(
      "similarOpenQuickSearch",
      "Open Quick Search from Similar",
      "Search from Similar cards or the details modal opens Quick Search with the title filled in, instead of a Nyaa search.",
      "showSimilarSection",
    ),
  );

  const featuresRows = page.querySelector("#ne-settings-features-rows");
  featuresRows.append(
    neSettingsCreateToggleRow("showSeaDex", "Display Best Release (Seadex)", "Highlight best and alternate releases according to SeaDex."),
    neSettingsCreateToggleRow("showChangelogNav", "Add Changelog link to navbar"),
    neSettingsCreateToggleRow("changelogDismissed", "Show changelog popup", "Display the What's New popup when a new version is released."),
  );

  page.querySelector("#ne-settings-highlights-rows").append(
    neSettingsCreateToggleRow(
      "prioritizeSeaDexHighlights",
      "Prioritize SeaDex highlights",
      "When a torrent matches both SeaDex and a custom keyword, keep the SeaDex color instead of the keyword color.",
    ),
  );

  page.querySelector("#ne-settings-screenshot-rows").append(
    neSettingsCreateToggleRow(
      "screenshotPreviewEnabled",
      "Screenshot preview",
      "Hover over a torrent link to preview screenshot images.",
    ),
  );

  page.querySelector("#ne-settings-cloud-rows").append(
    neSettingsCreateToggleRow(
      "cloudSyncEnabled",
      "Enable cloud sync",
      "Uploads your settings after every change and keeps this browser up to date with your other devices.",
    ),
  );

  page.querySelector("#ne-settings-cloud-options").append(
    neSettingsCreateToggleRow(
      "cloudSyncIncludeCredentials",
      "Include credentials",
      "Also sync the qBittorrent, Transmission and Deluge passwords, the ameNZB and TMDB API keys, and the WebDAV login. They are stored in plain text in the cloud file. Each browser keeps using its own WebDAV login. This choice applies to all your synced browsers.",
    ),
    neSettingsCreateToggleRow(
      "cloudSyncIncludeHistory",
      "Include history",
      "Also sync your History log. Entries from all browsers are merged, and clearing history in one clears it everywhere. This choice applies to all your synced browsers.",
    ),
  );

  page.querySelector("#ne-settings-qbt-rows").append(
    neSettingsCreateToggleRow("qbtPromptOnSend", "Prompt on Send", "Show a dialog to pick category and tags each time you Send a torrent."),
  );

  return page;
}

export async function handleSettingsPage() {
  if (window.location.pathname !== "/settings") return;
  if (document.querySelector(".ne-settings-page")) return;

  const mainContainer = document.querySelector(".container > h1")?.parentElement;
  if (!mainContainer) return;

  document.title = "Settings :: Nyaa";
  mainContainer.innerHTML = "";

  const settingsPage = neSettingsBuildPageHTML();
  mainContainer.appendChild(settingsPage);

  neSettingsWireToggles();
  neSettingsWireNav();
  neSettingsWireSearch();
  neSettingsWireMonitoringSection();
  neSettingsWireHighlightsSection();
  neSettingsWireQbtSection();
  neSettingsWireScreenshotInputs();
  neSettingsWireHistorySection();
  neSettingsWireShowMoreSection();
  neSettingsWireQuickSearchSection();
  neSettingsWireCloudSyncSection();
  neSettingsWireCacheSection();
  neSettingsWireBackupSection();
  await neSettingsLoadValues();
  neSettingsWireVibeWeights();
  neSettingsWireSimilarCache();

  // Links such as /settings#ne-settings-quicksearch open a specific section.
  const linkedSection = window.location.hash
    ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    : null;
  if (linkedSection?.classList.contains("ne-settings-section")) {
    linkedSection.scrollIntoView({ block: "start" });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if ((area !== "sync" && area !== "local") || window.location.pathname !== "/settings") return;
    // Sync bookkeeping changes often; only the Cloud Sync status needs it.
    if (Object.keys(changes).every((key) => key === CLOUD_SYNC_STATE_KEY)) return;
    if (
      changes.ameNZBRequestCount ||
      changes.ameNZBRequestDate ||
      changes.ameNZBApiKey
    ) {
      loadStoredPreferences().then((prefs) => {
        neSettingsUpdateAmeNZBQuota(prefs);
        if (changes.ameNZBApiKey) {
          neSettingsUpdateAmeNZBState(!!prefs.ameNZBApiKey);
        }
      });
    }
    neSettingsLoadValues();
    if (changes.monitoredUsers || changes.monitoredKeywords) {
      neSettingsLoadMonitoringLists();
    }
  });
}

export function addSettingsNavItem() {
  const navList = document.querySelector(".nav.navbar-nav");
  if (!navList) return;

  const existing = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "Settings",
  );
  if (existing) return;

  const settingsItem = document.createElement("li");
  const settingsLink = document.createElement("a");
  settingsLink.href = "/settings";
  settingsLink.textContent = "Settings";
  settingsItem.appendChild(settingsLink);

  const changelogItem = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "Changelog",
  );

  if (changelogItem) {
    changelogItem.insertAdjacentElement("afterend", settingsItem);
  } else {
    const rssItem = Array.from(navList.querySelectorAll("li")).find(
      (li) => li.textContent.trim() === "RSS",
    );
    if (rssItem) {
      rssItem.insertAdjacentElement("afterend", settingsItem);
    } else {
      navList.appendChild(settingsItem);
    }
  }
}
