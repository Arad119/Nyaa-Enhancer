import { setPrefsSaveErrorHandler } from "../shared/prefs.js";
import { buildCtx } from "./core/ctx.js";
import { enhanceTorrentDescriptionPanel } from "./core/description-tabs.js";
import { initMessaging } from "./core/messaging.js";
import { showNotification } from "./core/notifications.js";
import { observeTableChanges } from "./core/observer.js";
import { setFeatures } from "./core/registry.js";
import { features } from "./features/index.js";

setPrefsSaveErrorHandler((message) => {
  showNotification(`Failed to save settings: ${message}`, false);
});

setFeatures(features);
const ctx = buildCtx(features);

async function initializeExtension(isInitialLoad = false) {
  ctx.isInitialLoad = isInitialLoad;
  for (const feature of features) {
    await feature.init?.(ctx);
  }
  enhanceTorrentDescriptionPanel();
  observeTableChanges();
  for (const feature of features) {
    await feature.afterObserver?.(ctx);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeExtension(true);
  });
} else {
  initializeExtension(true);
}

initMessaging();
