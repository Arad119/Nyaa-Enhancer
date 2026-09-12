import { isNyaaSite } from "../shared/domains.js";

export function updateBadge(url) {
  if (url && isNyaaSite(url)) {
    browser.action.setBadgeText({ text: "On" });
    browser.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  } else {
    browser.action.setBadgeText({ text: "" });
  }
}

export function updatePopupState() {
  browser.action.enable();
  browser.action.setPopup({ popup: "popup/popup.html" });
}

export function initBadgeListeners() {
  browser.tabs.onActivated.addListener((activeInfo) => {
    browser.tabs.get(activeInfo.tabId, (tab) => {
      updateBadge(tab.url);
      updatePopupState();
    });
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      updateBadge(changeInfo.url);
      updatePopupState();
    }
  });
}
