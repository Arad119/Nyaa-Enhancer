import { isNyaaSite } from "../shared/domains.js";

export function updateBadge(url) {
  if (url && isNyaaSite(url)) {
    chrome.action.setBadgeText({ text: "On" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

export function updatePopupState() {
  chrome.action.enable();
  chrome.action.setPopup({ popup: "popup/popup.html" });
}

export function initBadgeListeners() {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      updateBadge(tab.url);
      updatePopupState();
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      updateBadge(changeInfo.url);
      updatePopupState();
    }
  });
}
