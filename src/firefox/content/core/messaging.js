import { savePreferences } from "../../shared/prefs.js";
import { applyAllTorrentFilters, checkMonitoredUsers, neDisplayFilterKeywords } from "../internal.js";
import { handleSettingChange } from "./registry.js";

export function initMessaging() {
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "settingChanged") {
      handleSettingChange(message.setting, message.value);
    } else if (message.type === "keywordsUpdated") {
      savePreferences({ keywords: message.keywords }, () => {
        neDisplayFilterKeywords(message.keywords);
        applyAllTorrentFilters({ notify: true });
      });
    } else if (message.type === "monitoredUsersUpdated") {
      savePreferences({ monitoredUsers: message.monitoredUsers }, () => {
        const sidebar = document.querySelector(".monitored-users-sidebar");
        if (sidebar) {
          checkMonitoredUsers();
        }
      });
    } else if (message.type === "refreshMonitoring") {
      checkMonitoredUsers();
    }
  });
}
