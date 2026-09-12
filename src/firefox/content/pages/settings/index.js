import { getPreferences, loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import {
  isExtensionPage,
  sendMessageToNyaaTabs,
} from "../../../shared/domains.js";
import { getKeywordSearchUrl, setNyaaOriginFallback } from "../../../shared/urls.js";
import { NE_DEFAULT_HIGHLIGHT_COLOR, checkMonitoredUsers, getHighlightRules, handleSettingChange, normalizeHighlightColor } from "../../internal.js";
import { clearSimilarCaches, formatSimilarCacheBytes, getSimilarCacheUsage, isSimilarCacheKey } from "../../features/similar/cache.js";

// ── Settings Page ───────────────────────────────────────────────────────────

export const NE_SETTINGS_NAV_SECTIONS = [
  { id: "ne-settings-download", label: "Download" },
  { id: "ne-settings-interface", label: "Interface" },
  { id: "ne-settings-filters", label: "Filters" },
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

export async function neSettingsSave(settingKey, value) {
  if (settingKey === "changelogDismissed") {
    await new Promise((resolve) =>
      savePreferences({ changelogDismissed: !value, tempDismissed: !value }, resolve),
    );
  } else {
    await new Promise((resolve) =>
      savePreferences({ [settingKey]: value }, resolve),
    );
  }
  if (!isExtensionPage()) {
    await handleSettingChange(settingKey, value);
  }
  const excludeTabId = isExtensionPage()
    ? undefined
    : (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  await sendMessageToNyaaTabs(
    { type: "settingChanged", setting: settingKey, value },
    { excludeTabId },
  );
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
  document.querySelectorAll(".ne-settings-page .ne-settings-toggle").forEach((toggle) => {
    toggle.addEventListener("click", async () => {
      if (toggle.disabled) return;
      const settingKey = toggle.dataset.setting;
      const newState = toggle.getAttribute("aria-checked") !== "true";
      neSettingsSyncToggleVisual(toggle, newState);

      if (settingKey === "changelogDismissed") {
        await neSettingsSave(settingKey, newState);
        return;
      }

      await neSettingsSave(settingKey, newState);

      if (settingKey === "showButtons") {
        neSettingsUpdateDependentRows(newState);
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

export function neSettingsWireNav() {
  const navLinks = document.querySelectorAll(".ne-settings-nav__link");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      const section = document.getElementById(targetId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        navLinks.forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
      }
    });
  });

  const sections = NE_SETTINGS_NAV_SECTIONS.map((s) =>
    document.getElementById(s.id),
  ).filter(Boolean);

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((l) => {
        l.classList.toggle("is-active", l.dataset.target === visible.target.id);
      });
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] },
  );

  sections.forEach((section) => observer.observe(section));
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
    showFilterNotifications: prefs.showFilterNotifications,
    hideComments: prefs.hideComments,
    improvedFileList: prefs.improvedFileList,
    copyTorrentTitle: prefs.copyTorrentTitle,
    copyTorrentInfoHash: prefs.copyTorrentInfoHash,
    showATLinks: prefs.showATLinks,
    useNewATDomain: prefs.useNewATDomain,
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
    qbtPromptOnSend: prefs.qbtPromptOnSend !== false,
  };

  Object.entries(boolSettings).forEach(([key, value]) => {
    neSettingsSetToggleState(key, value);
  });

  neSettingsSetToggleState("changelogDismissed", !prefs.changelogDismissed);

  neSettingsUpdateDependentRows(prefs.showButtons);
  neSettingsUpdateScreenshotInputs(prefs.screenshotPreviewEnabled);
  neSettingsUpdateAmeNZBState(!!prefs.ameNZBApiKey);
  neSettingsUpdateAmeNZBQuota(prefs);

  const hoverInput = document.getElementById("ne-sp-hover-delay");
  const slideInput = document.getElementById("ne-sp-slide-delay");
  if (hoverInput) hoverInput.value = prefs.screenshotPreviewHoverDelay;
  if (slideInput) slideInput.value = prefs.screenshotPreviewSlideDelay;
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
    return;
  }
  sendMessageToNyaaTabs({ type: "refreshMonitoring" });
}
  getPreferences({ monitoredUsers: [] }, (items) => {
    const monitoredUsers = items.monitoredUsers.filter(
      (user) => user.username !== username,
    );
    savePreferences({ monitoredUsers }, () => {
      neSettingsDisplayMonitoredUsers(monitoredUsers);
      neSettingsNotifyMonitoringChanged();
    });
  });

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
  await neSettingsSave("highlightKeywords", highlightKeywords);
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
  await neSettingsSave("highlightKeywords", highlightKeywords);
  neSettingsDisplayHighlightKeywords(highlightKeywords);
}

export async function neSettingsRemoveHighlightKeyword(keywordToRemove) {
  const prefs = await loadStoredPreferences();
  const highlightKeywords = (prefs.highlightKeywords || []).filter(
    (item) => item.keyword !== keywordToRemove,
  );
  await neSettingsSave("highlightKeywords", highlightKeywords);
  neSettingsDisplayHighlightKeywords(highlightKeywords);
}

export async function neSettingsRemoveAllHighlightKeywords() {
  await neSettingsSave("highlightKeywords", []);
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
  vibeMixSaved = { ...mix };
  await new Promise((resolve) =>
    savePreferences(
      {
        similarVibeGenreWeight: mix.genre,
        similarVibeTagWeight: mix.tags,
        similarVibeStudioWeight: mix.studio,
      },
      resolve,
    ),
  );
  await handleSettingChange("similarVibeGenreWeight", mix.genre);
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
      let value = parseFloat(input.value);
      if (!isFinite(value) || value < minValue) {
        value = defaultValue;
        input.value = value;
      }
      await neSettingsSave(settingKey, value);
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  };
  attach("ne-sp-hover-delay", "screenshotPreviewHoverDelay", 2, 0);
  attach("ne-sp-slide-delay", "screenshotPreviewSlideDelay", 2, 0.1);
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
      <h1>Nyaa Enhancer Settings</h1>
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
        <section id="ne-settings-filters" class="ne-settings-section">
          <h2 class="ne-settings-section__title"><i class="fa fa-filter" aria-hidden="true"></i> Filters</h2>
          <p class="ne-settings-section__desc">Filter options for the torrent list. Active filters (dead torrents, minimum seeders, keywords, file size, and completed downloads) are configured in the Filters panel above the torrent table.</p>
          <div class="ne-settings-rows" id="ne-settings-filters-rows"></div>
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
                Clear Similar cache
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
  );

  page.querySelector("#ne-settings-filters-rows").append(
    neSettingsCreateToggleRow("showFilterNotifications", "Show filter notifications", "Display a toast when torrents are hidden by active filters."),
  );

  page.querySelector("#ne-settings-view-rows").append(
    neSettingsCreateToggleRow("hideComments", "Hide comments", "Hide the comments section on torrent view pages."),
    neSettingsCreateToggleRow("improvedFileList", "Improved file list", "Show total and per-folder file counts on view pages."),
    neSettingsCreateToggleRow("copyTorrentTitle", "Copy title on click", "Click the torrent title on view pages to copy it to the clipboard."),
    neSettingsCreateToggleRow("copyTorrentInfoHash", "Copy info hash on click", "Click the info hash on view pages to copy it to the clipboard."),
  );

  page.querySelector("#ne-settings-animetosho-rows").append(
    neSettingsCreateToggleRow("showATLinks", "Show AnimeTosho links"),
    neSettingsCreateToggleRow("useNewATDomain", "Use new AnimeTosho domain", "Switch links between animetosho.org (legacy) and animetosho.xyz (new)."),
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
  await neSettingsLoadValues();
  neSettingsWireVibeWeights();
  neSettingsWireSimilarCache();

  browser.storage.onChanged.addListener((changes, area) => {
    if ((area !== "sync" && area !== "local") || window.location.pathname !== "/settings") return;
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
