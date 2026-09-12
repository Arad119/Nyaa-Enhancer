// Register features here. To add a feature:
// 1. Create content/features/<id>/index.js (and optional CSS under content/styles/)
// 2. Export init / afterObserver / onSettingChanged / onTableMutated as needed
// 3. Append an object to `features` below (order is boot order)
// 4. List new CSS in manifest.json content_scripts[0].css
import {
  addAnimetoshoComments,
  addAnimetoshoToViewPage,
  patchTorrentListLinkActionsForNewRows,
  refreshAnimetoshoListLinks,
  refreshAnimetoshoViewPageLink,
  resetAnimetoshoEpisodeSelection,
  updateAnimetoshoEpisodeFeatures,
  animetoshoTorrentDataCache,
  animetoshoViewLinkCache,
} from "./animetosho/index.js";
import {
  addAmeNZBToViewPage,
  clearAmeNZBSearchCache,
  removeAmeNZBRow,
  updateAmeNZBDescriptionSection,
} from "./amenzb/index.js";
import { addChangelogNavItem, handleChangelogPage, showChangelog } from "../pages/changelog/index.js";
import {
  applyAllTorrentFilters,
  addFiltersPanel,
  filterDeadTorrents,
  syncFiltersPanelUI,
} from "./filters/index.js";
import { applyKeywordHighlights, initializeKeywordHighlights } from "./highlights/index.js";
import {
  addMonitorButton,
  checkMonitoredUsers,
} from "./monitoring/index.js";
import {
  addNekoBTToViewPage,
  removeNekoBTRow,
  updateNekoBTDescriptionSection,
} from "./nekobt/index.js";
import {
  checkAndApplyQuickSearchFilters,
  clearQuickSearchAnimeCaches,
} from "./quick-search/index.js";
import { initializeSeaDex, removeSeaDexHighlights } from "./seadex/index.js";
import { addSendButtonToViewPage } from "./send-to-client/index.js";
import {
  mutationsIncludeNonLinkActionChanges,
  updateAllTorrentListLinkActions,
} from "../core/link-actions.js";
import {
  cancelScreenshotPreview,
  ensureScreenshotPreviewDelegation,
  initializeScreenshotPreview,
  screenshotPreview,
  setupTitleSuppression,
  teardownTitleSuppression,
} from "./screenshot-preview/index.js";
import { addSettingsNavItem, handleSettingsPage } from "../pages/settings/index.js";
import { initShowMorePagination } from "./show-more/index.js";
import { loadStoredPreferences } from "../../shared/prefs.js";
import { addCopyButton, addCheckboxColumn } from "./toolbar/index.js";
import {
  addTsukihimeToViewPage,
  removeTsukihimeRow,
  updateTsukihimeDescriptionSection,
} from "./tsukihime/index.js";
import {
  initSimilarCacheInvalidation,
  invalidateSimilarPanel,
  refreshSimilarVibeFromPrefs,
  updateSimilarDescriptionSection,
} from "./similar/index.js";
import {
  addMagnetButtonToViewPage,
  applyCopyTorrentInfoHash,
  applyCopyTorrentTitle,
  applyCopyableViewPageFieldsFromPrefs,
  applyImprovedFileList,
  applyImprovedFileListFromPrefs,
  toggleComments,
} from "./view-page/index.js";

const FILTER_PANEL_SETTINGS = [
  "hideDeadTorrents",
  "minSeedersFilterEnabled",
  "minSeedersFilterValue",
  "keywordFilterEnabled",
  "fileSizeFilterEnabled",
  "fileSizeMinBytes",
  "fileSizeMaxBytes",
  "completedDownloadsFilterEnabled",
  "completedDownloadsFilterOperator",
  "completedDownloadsFilterValue",
  "keywords",
];

export const features = [
  {
    id: "filters",
    async init() {
      await addFiltersPanel();
    },
    async afterObserver(ctx) {
      await applyAllTorrentFilters({ notify: ctx.isInitialLoad });
    },
    onTableMutated() {
      filterDeadTorrents();
    },
    async onSettingChanged(setting, value) {
      if (
        setting === "hideDeadTorrents" ||
        setting === "minSeedersFilterEnabled" ||
        setting === "minSeedersFilterValue" ||
        setting === "keywordFilterEnabled" ||
        setting === "fileSizeFilterEnabled" ||
        setting === "fileSizeMinBytes" ||
        setting === "fileSizeMaxBytes" ||
        setting === "completedDownloadsFilterEnabled" ||
        setting === "completedDownloadsFilterOperator" ||
        setting === "completedDownloadsFilterValue"
      ) {
        await applyAllTorrentFilters({
          notify: setting !== "fileSizeMinBytes",
        });
      }
      if (FILTER_PANEL_SETTINGS.includes(setting)) {
        await syncFiltersPanelUI(setting, value);
      }
    },
  },
  {
    id: "toolbar",
    async init() {
      await addCopyButton();
      await addCheckboxColumn();
    },
    async onSettingChanged(setting, value) {
      if (setting === "showButtons") {
        if (value) {
          addCopyButton();
          addCheckboxColumn();
        } else {
          document.querySelector(".button-container")?.remove();
          document.querySelector(".magnet-checkbox-column")?.remove();
          document.querySelectorAll(".magnet-checkbox").forEach((checkbox) => {
            const cell = checkbox.closest("td");
            if (cell) cell.remove();
          });
        }
      }
    },
  },
  {
    id: "animetosho",
    init() {
      addAnimetoshoToViewPage();
      addAnimetoshoComments();
    },
    onTableMutated(mutations) {
      if (mutationsIncludeNonLinkActionChanges(mutations)) {
        patchTorrentListLinkActionsForNewRows();
      }
    },
    async onSettingChanged(setting, value) {
      if (setting === "showATLinks") {
        if (!value) {
          const animeRow = Array.from(document.querySelectorAll(".row")).find(
            (row) => row.textContent.includes("Animetosho:"),
          );
          if (animeRow) {
            const infoHashKbd = animeRow.querySelector("kbd");
            if (infoHashKbd) {
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
      } else if (setting === "useNewATDomain") {
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
      } else if (setting === "showATComments") {
        if (value) addAnimetoshoComments();
        else document.getElementById("tosho-comments")?.remove();
      } else if (
        setting === "showATScreenshotsSection" ||
        setting === "showATFileInfoSection" ||
        setting === "showATAttachmentsSection"
      ) {
        updateAnimetoshoEpisodeFeatures();
      }
    },
  },
  {
    id: "amenzb",
    init() {
      addAmeNZBToViewPage();
    },
    onSettingChanged(setting, value) {
      if (setting === "showAmeNZBLinks") {
        if (value) addAmeNZBToViewPage();
        else removeAmeNZBRow();
      } else if (setting === "showAmeNZBSection") {
        updateAmeNZBDescriptionSection();
      } else if (setting === "ameNZBApiKey") {
        clearAmeNZBSearchCache();
        removeAmeNZBRow();
        addAmeNZBToViewPage();
        updateAmeNZBDescriptionSection();
      }
    },
  },
  {
    id: "nekobt",
    init() {
      addNekoBTToViewPage();
    },
    onSettingChanged(setting, value) {
      if (setting === "showNekoBTLinks") {
        if (value) addNekoBTToViewPage();
        else removeNekoBTRow();
      } else if (
        setting === "showNekoBTSection" ||
        setting === "showNekoBTFullLangNames"
      ) {
        updateNekoBTDescriptionSection();
      }
    },
  },
  {
    id: "tsukihime",
    init() {
      addTsukihimeToViewPage();
    },
    onSettingChanged(setting, value) {
      if (setting === "showTsukihimeLinks") {
        if (value) addTsukihimeToViewPage();
        else removeTsukihimeRow();
      } else if (setting === "showTsukihimeSection") {
        updateTsukihimeDescriptionSection();
      }
    },
  },
  {
    id: "similar",
    init() {
      initSimilarCacheInvalidation();
    },
    async onSettingChanged(setting) {
      if (setting === "showSimilarSection") {
        updateSimilarDescriptionSection();
      } else if (setting === "similarUseTmdbRecs") {
        invalidateSimilarPanel();
      } else if (setting === "tmdbApiKey") {
        const prefs = await loadStoredPreferences();
        if (prefs.similarUseTmdbRecs) invalidateSimilarPanel();
      } else if (
        setting === "similarVibeGenreWeight" ||
        setting === "similarVibeTagWeight" ||
        setting === "similarVibeStudioWeight" ||
        setting === "similarOpenAccordions" ||
        setting === "similarCardDetailsEnabled" ||
        setting === "similarOpenQuickSearch"
      ) {
        refreshSimilarVibeFromPrefs();
      }
    },
  },
  {
    id: "seadex",
    init() {
      initializeSeaDex();
    },
    onSettingChanged(setting, value) {
      if (setting === "showSeaDex") {
        if (value) initializeSeaDex();
        else removeSeaDexHighlights();
      }
    },
  },
  {
    id: "highlights",
    init() {
      initializeKeywordHighlights();
    },
    onSettingChanged(setting) {
      if (
        setting === "highlightKeywords" ||
        setting === "prioritizeSeaDexHighlights"
      ) {
        applyKeywordHighlights();
      }
    },
  },
  {
    id: "screenshotPreview",
    init() {
      initializeScreenshotPreview();
    },
    onSettingChanged(setting, value) {
      if (setting === "screenshotPreviewEnabled") {
        screenshotPreview.enabled = !!value;
        if (value) {
          ensureScreenshotPreviewDelegation();
          setupTitleSuppression();
        } else {
          cancelScreenshotPreview();
          teardownTitleSuppression();
        }
      } else if (setting === "screenshotPreviewHoverDelay") {
        screenshotPreview.hoverDelayMs = Math.max(
          0,
          Math.round((parseFloat(value) || 0) * 1000),
        );
      } else if (setting === "screenshotPreviewSlideDelay") {
        screenshotPreview.slideDelayMs = Math.max(
          100,
          Math.round((parseFloat(value) || 0) * 1000),
        );
      }
    },
  },
  {
    id: "viewPage",
    async init() {
      await addMagnetButtonToViewPage();
      await applyCopyableViewPageFieldsFromPrefs();
    },
    afterObserver() {
      toggleComments();
      applyImprovedFileListFromPrefs();
    },
    async onSettingChanged(setting, value) {
      if (setting === "showMagnetButtons") {
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
      } else if (setting === "hideComments") {
        if (window.location.pathname.startsWith("/view/")) {
          const comments = document.getElementById("comments");
          if (comments) comments.style.display = value ? "none" : "block";
        }
      } else if (setting === "improvedFileList") {
        if (window.location.pathname.startsWith("/view/")) {
          applyImprovedFileList(value);
        }
      } else if (setting === "copyTorrentTitle") {
        if (window.location.pathname.startsWith("/view/")) {
          applyCopyTorrentTitle(value);
        }
      } else if (setting === "copyTorrentInfoHash") {
        if (window.location.pathname.startsWith("/view/")) {
          applyCopyTorrentInfoHash(value);
        }
      }
    },
  },
  {
    id: "sendToClient",
    init() {
      addSendButtonToViewPage();
    },
    async onSettingChanged(setting, value) {
      if (setting === "showSendButtons") {
        document
          .querySelector('.nyaa-enhancer-toolbar__group[data-group="send"]')
          ?.classList.toggle("nyaa-enhancer-toolbar__btn--hidden", !value);
        if (window.location.pathname.startsWith("/view/")) {
          if (value) addSendButtonToViewPage();
          else document.querySelector(".send-torrent-button")?.remove();
        } else {
          await updateAllTorrentListLinkActions({ showSendButtons: value });
        }
      }
    },
  },
  {
    id: "changelog",
    init() {
      showChangelog();
    },
    afterObserver() {
      handleChangelogPage();
      addChangelogNavItem();
    },
    onSettingChanged(setting, value) {
      if (setting === "showChangelogNav") {
        if (!value) {
          const navList = document.querySelector(".nav.navbar-nav");
          const changelogItem = Array.from(
            navList?.querySelectorAll("li") || [],
          ).find((li) => li.textContent.trim() === "Changelog");
          if (changelogItem) changelogItem.remove();
        } else {
          addChangelogNavItem();
        }
      }
    },
  },
  {
    id: "showMore",
    afterObserver() {
      initShowMorePagination();
    },
  },
  {
    id: "settings",
    afterObserver() {
      handleSettingsPage();
      addSettingsNavItem();
    },
    onSettingChanged(setting, value) {
      if (setting === "torrentClient") {
        if (window.location.pathname === "/settings") {
          const qbtSection = document.getElementById("ne-settings-qbt");
          if (qbtSection) qbtSection.hidden = value !== "qbittorrent";
        }
      }
    },
  },
  {
    id: "monitoring",
    afterObserver() {
      addMonitorButton();
      checkMonitoredUsers();
    },
    onSettingChanged(setting, value) {
      if (setting === "showMonitorButtons") {
        const keywordMonitorBtn = document.querySelector(
          ".keyword-monitor-button",
        );
        if (keywordMonitorBtn) {
          keywordMonitorBtn.classList.toggle(
            "nyaa-enhancer-toolbar__btn--hidden",
            !value,
          );
        }
        if (window.location.pathname.startsWith("/user/")) {
          const monitorBtn = document.querySelector(".monitor-button");
          if (monitorBtn) {
            monitorBtn.style.display = value ? "inline-block" : "none";
          } else if (value) {
            addMonitorButton();
          }
        }
      }
    },
  },
  {
    id: "quickSearch",
    afterObserver() {
      checkAndApplyQuickSearchFilters();
    },
    async onSettingChanged(setting, value) {
      if (setting === "showQuickFilter") {
        const quickFilterButton = document.querySelector(".quick-filter-button");
        if (quickFilterButton) {
          if (!value) {
            quickFilterButton.classList.add("hiding");
            setTimeout(() => {
              quickFilterButton.classList.add(
                "nyaa-enhancer-toolbar__btn--hidden",
              );
            }, 300);
          } else {
            quickFilterButton.classList.remove(
              "nyaa-enhancer-toolbar__btn--hidden",
            );
            quickFilterButton.offsetHeight;
            quickFilterButton.classList.remove("hiding");
          }
        }
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
      } else if (setting === "tmdbApiKey") {
        clearQuickSearchAnimeCaches();
      }
    },
  },
];
