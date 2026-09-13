import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import {
  buildNyaaMagnetUrl,
  getTorrentDownloadUrl,
  getTorrentViewUrl,
} from "../../../shared/urls.js";
import { showNotification } from "../../core/notifications.js";
import {
  getSendTorrentErrorMessage,
  openQbtCategoryTagModal,
  qbtNeedsSendPrompt,
  sendMagnetToClient,
} from "../send-to-client/index.js";
import { recordHistoryAction } from "./index.js";

export async function resolveHistoryMagnetUrl(event) {
  const fromHash = buildNyaaMagnetUrl(event.hash, event.title);
  if (fromHash) return fromHash;

  try {
    const response = await fetch(getTorrentViewUrl(event.id), {
      credentials: "include",
    });
    if (!response.ok) return "";
    const html = await response.text();
    const match = html.match(/href="(magnet:[^"]+)"/i);
    return match ? match[1].replace(/&amp;/g, "&") : "";
  } catch (error) {
    console.error("Nyaa Enhancer: failed to resolve magnet from history", error);
    return "";
  }
}

export async function copyHistoryMagnet(event) {
  const magnetUrl = await resolveHistoryMagnetUrl(event);
  if (!magnetUrl) {
    showNotification("Couldn't find a magnet link for this torrent.", false);
    return;
  }
  try {
    await navigator.clipboard.writeText(magnetUrl);
    recordHistoryAction("save", event);
    showNotification("Magnet link copied to clipboard!", true);
  } catch (error) {
    console.error("Failed to copy magnet:", error);
    showNotification("Failed to copy magnet link", false);
  }
}

export async function downloadHistoryTorrent(event) {
  const url = getTorrentDownloadUrl(event.id);
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const filename = `${String(event.title || event.id)
      .replace(/[<>:"/\\|?*]+/g, " ")
      .trim()
      .slice(0, 80) || event.id}.torrent`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    recordHistoryAction("download", event);
    showNotification("Torrent file downloaded.", true);
  } catch (error) {
    console.error("Failed to download torrent from history:", error);
    showNotification("Failed to download torrent file.", false);
  }
}

export async function sendHistoryTorrent(event) {
  const prefs = await loadStoredPreferences();
  if (!prefs.torrentClientUrl) {
    showNotification(
      "No torrent client configured. Set it up in the extension popup.",
      false,
    );
    return;
  }

  const magnetUrl = await resolveHistoryMagnetUrl(event);
  if (!magnetUrl) {
    showNotification("Couldn't find a magnet link for this torrent.", false);
    return;
  }

  const doSend = async (category, tags) => {
    if (prefs.torrentClient === "qbittorrent") {
      savePreferences({
        qbtLastCategory: category || "",
        qbtLastTags: tags || [],
      });
    }
    let result;
    try {
      result = await sendMagnetToClient(magnetUrl, prefs, { category, tags });
    } catch (error) {
      result = { ok: false, error: "request_failed", message: error.message };
    }
    if (!result?.ok) {
      showNotification(getSendTorrentErrorMessage(result), false);
      return;
    }
    recordHistoryAction("send", event);
    showNotification("Torrent sent to client!", true);
  };

  if (prefs.torrentClient !== "qbittorrent" || !qbtNeedsSendPrompt(prefs)) {
    await doSend(
      prefs.qbtDefaultCategory || "",
      prefs.qbtDefaultTags || [],
    );
    return;
  }

  openQbtCategoryTagModal(prefs, doSend);
}
