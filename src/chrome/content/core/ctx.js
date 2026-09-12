import { loadStoredPreferences, savePreferences } from "../../shared/prefs.js";
import * as descriptionTabs from "./description-tabs.js";
import { fetchJsonViaBackground, fetchUrlViaBackground } from "./fetch.js";
import * as linkActions from "./link-actions.js";
import { showNotification } from "./notifications.js";
import { withTorrentTableObserverPaused } from "./observer.js";
import { getPageFlags } from "./page.js";
import * as rows from "./rows.js";

export function buildCtx(features) {
  return {
    features,
    loadPrefs: loadStoredPreferences,
    savePrefs: savePreferences,
    notify: showNotification,
    fetchText: fetchUrlViaBackground,
    fetchJson: fetchJsonViaBackground,
    rows,
    descriptionTabs,
    linkActions,
    observer: { pause: withTorrentTableObserverPaused },
    ...getPageFlags(),
  };
}
