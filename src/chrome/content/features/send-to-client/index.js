import { loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { createProgressNotification, dismissProgressNotification, escapeHtml, getSelectedVisibleMagnetUrls, getVisibleMagnetUrls, setProgressNotificationStatus, showNotification } from "../../internal.js";

// Shared helper: wires up the click → torrent client flow
export const SEND_TORRENT_CONCURRENCY = 3;
export const SEND_FATAL_ERRORS = new Set([
  "auth_failed",
  "auth_required",
  "permission_denied",
  "wrong_client",
]);

export function getTorrentClientAuth(prefs) {
  if (prefs.torrentClient === "transmission") {
    return {
      username: prefs.transmissionUsername || "",
      password: prefs.transmissionPassword || "",
    };
  }
  if (prefs.torrentClient === "deluge") {
    return { username: "", password: prefs.delugePassword || "" };
  }
  return {
    username: prefs.qbtUsername || "",
    password: prefs.qbtPassword || "",
  };
}

export function getSendTorrentErrorMessage(result) {
  switch (result?.error) {
    case "already_exists":
      return "Torrent already exists in your client.";
    case "wrong_client":
      return "Wrong torrent client selected for this URL. Fix it in the extension popup.";
    case "auth_failed":
      return "Authentication failed — check your credentials.";
    case "auth_required":
      return "Torrent client requires authentication.";
    case "permission_denied":
      return "Missing network permission. Use Test Connection in the extension popup.";
    default:
      return "Failed to send torrent. Check the client connection.";
  }
}

export function qbtNeedsSendPrompt(prefs) {
  return (
    prefs.torrentClient === "qbittorrent" &&
    prefs.qbtPromptOnSend &&
    ((prefs.qbtCategories || []).length > 0 || (prefs.qbtTags || []).length > 0)
  );
}

export async function sendMagnetToClient(magnetUrl, prefs, { category, tags } = {}) {
  const { username, password } = getTorrentClientAuth(prefs);
  const isQbt = prefs.torrentClient === "qbittorrent";
  const msg = {
    type: "sendTorrent",
    client: prefs.torrentClient,
    url: prefs.torrentClientUrl,
    username,
    password,
    magnetUrl,
  };
  if (isQbt) {
    msg.category = category || "";
    msg.tags = tags || [];
  }
  return chrome.runtime.sendMessage(msg);
}

export function setBatchSendButtonsBusy(busy) {
  document.querySelectorAll(".send-batch-button").forEach((btn) => {
    btn.disabled = busy;
  });
}

export async function sendMagnetsToClient(magnetUrls, prefs, category, tags) {
  const progressNotification = createProgressNotification();
  const total = magnetUrls.length;
  let sent = 0;
  let alreadyExists = 0;
  let failed = 0;
  let processed = 0;
  let abortError = null;
  let nextIndex = 0;

  progressNotification.textContent = `Sending: 0/${total}`;
  setBatchSendButtonsBusy(true);

  const worker = async () => {
    while (nextIndex < total) {
      if (abortError) return;
      const magnetUrl = magnetUrls[nextIndex++];
      let result;
      try {
        result = await sendMagnetToClient(magnetUrl, prefs, { category, tags });
      } catch (err) {
        result = { ok: false, error: "request_failed", message: err.message };
      }

      processed++;
      if (result?.ok) sent++;
      else if (result?.error === "already_exists") alreadyExists++;
      else {
        failed++;
        if (SEND_FATAL_ERRORS.has(result?.error)) abortError = result;
      }
      progressNotification.textContent = `Sending: ${processed}/${total}`;
    }
  };

  try {
    const workerCount = Math.min(SEND_TORRENT_CONCURRENCY, total);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } finally {
    setBatchSendButtonsBusy(false);
  }

  if (abortError) {
    setProgressNotificationStatus(progressNotification, "error");
    const skipped = total - processed;
    const extra =
      sent || alreadyExists
        ? ` (${sent} sent, ${alreadyExists} already in client${skipped ? `, ${skipped} skipped` : ""}).`
        : "";
    progressNotification.textContent =
      getSendTorrentErrorMessage(abortError) + extra;
    dismissProgressNotification(progressNotification, 5000);
    return;
  }

  if (sent === 0 && alreadyExists === 0) {
    setProgressNotificationStatus(progressNotification, "error");
    progressNotification.textContent = `Failed to send ${failed} torrent${failed === 1 ? "" : "s"}.`;
  } else if (failed) {
    setProgressNotificationStatus(progressNotification, "warning");
    progressNotification.textContent = `Sent ${sent} torrent${sent === 1 ? "" : "s"} (${alreadyExists} already in client, ${failed} failed).`;
  } else if (sent === 0 && alreadyExists) {
    setProgressNotificationStatus(progressNotification, "warning");
    progressNotification.textContent = `All ${alreadyExists} torrent${alreadyExists === 1 ? " is" : "s are"} already in your client.`;
  } else if (alreadyExists) {
    progressNotification.textContent = `Sent ${sent} torrent${sent === 1 ? "" : "s"} (${alreadyExists} already in client).`;
  } else {
    progressNotification.textContent = `Sent ${sent} torrent${sent === 1 ? "" : "s"} to client!`;
  }
  dismissProgressNotification(progressNotification, 4000);
}

export function resolveQbtSendOptions(prefs) {
  if (prefs.torrentClient !== "qbittorrent") {
    return Promise.resolve({ category: "", tags: [], cancelled: false });
  }
  if (!qbtNeedsSendPrompt(prefs)) {
    return Promise.resolve({
      category: prefs.qbtDefaultCategory || "",
      tags: prefs.qbtDefaultTags || [],
      cancelled: false,
    });
  }
  return new Promise((resolve) => {
    let settled = false;
    openQbtCategoryTagModal(
      prefs,
      (category, tags) => {
        if (settled) return;
        settled = true;
        savePreferences({
          qbtLastCategory: category || "",
          qbtLastTags: tags || [],
        });
        resolve({ category, tags, cancelled: false });
      },
      () => {
        if (settled) return;
        settled = true;
        resolve({ cancelled: true });
      },
    );
  });
}

export async function sendVisibleTorrentsToClient(magnetUrls, emptyMessage) {
  if (!magnetUrls.length) {
    showNotification(emptyMessage, false);
    return;
  }

  const prefs = await loadStoredPreferences();
  if (!prefs.torrentClientUrl) {
    showNotification(
      "No torrent client configured. Set it up in the extension popup.",
      false,
    );
    return;
  }

  const options = await resolveQbtSendOptions(prefs);
  if (options.cancelled) return;
  await sendMagnetsToClient(
    magnetUrls,
    prefs,
    options.category,
    options.tags,
  );
}

export function sendSelectedTorrents() {
  return sendVisibleTorrentsToClient(
    getSelectedVisibleMagnetUrls(),
    "No visible torrents selected!",
  );
}

export function sendAllVisibleTorrents() {
  return sendVisibleTorrentsToClient(
    getVisibleMagnetUrls(),
    "No torrents found!",
  );
}

export function wireSendTorrentAction(element, magnetUrl) {
  element.addEventListener("click", async (e) => {
    e.preventDefault();

    const currentPrefs = await loadStoredPreferences();

    if (!currentPrefs.torrentClientUrl) {
      showNotification(
        "No torrent client configured. Set it up in the extension popup.",
        false,
      );
      return;
    }

    const isQbt = currentPrefs.torrentClient === "qbittorrent";

    const setBusy = (busy) => {
      if (element instanceof HTMLButtonElement) {
        element.disabled = busy;
      } else {
        element.style.pointerEvents = busy ? "none" : "";
        element.style.opacity = busy ? "0.5" : "";
      }
    };

    const doSend = async (category, tags) => {
      setBusy(true);
      if (isQbt) {
        savePreferences({
          qbtLastCategory: category || "",
          qbtLastTags: tags || [],
        });
      }

      let result;
      try {
        result = await sendMagnetToClient(magnetUrl, currentPrefs, {
          category,
          tags,
        });
      } catch (err) {
        result = { ok: false, error: "request_failed", message: err.message };
      }

      setBusy(false);

      if (!result || !result.ok) {
        showNotification(getSendTorrentErrorMessage(result), false);
        return;
      }

      showNotification("Torrent sent to client!", true);
    };

    if (!isQbt) {
      await doSend("", []);
      return;
    }

    if (!qbtNeedsSendPrompt(currentPrefs)) {
      await doSend(
        currentPrefs.qbtDefaultCategory || "",
        currentPrefs.qbtDefaultTags || [],
      );
      return;
    }

    openQbtCategoryTagModal(currentPrefs, doSend);
  });
}

export function createSendListLink(magnetUrl) {
  const sendLink = document.createElement("a");
  sendLink.href = "#";
  sendLink.className = "link-action-send";
  sendLink.title = "Send to torrent client";
  sendLink.innerHTML = '<i class="fa fa-fw fa-cloud-upload"></i>';
  wireSendTorrentAction(sendLink, magnetUrl);
  return sendLink;
}

// Shared helper: creates a send button and wires up the click → qBittorrent flow
export function createSendButton(magnetUrl, extraStyles = {}) {
  const sendButton = document.createElement("button");
  sendButton.className = "magnet-button send-torrent-button";
  sendButton.title = "Send to torrent client";
  sendButton.innerHTML = '<i class="fa fa-cloud-upload"></i> Send';
  sendButton.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
  sendButton.style.fontWeight = "500";
  Object.assign(sendButton.style, extraStyles);
  wireSendTorrentAction(sendButton, magnetUrl);
  return sendButton;
}

// ── qBittorrent category/tag selection modal ─────────────────────────────────

export let qbtModalOnCancel = null;

export function invokeQbtModalCancel() {
  const cancelCb = qbtModalOnCancel;
  qbtModalOnCancel = null;
  if (typeof cancelCb === "function") cancelCb();
}

export function openQbtCategoryTagModal(prefs, onConfirm, onCancel) {
  // Remove any existing modal first (skip fade-out so a fresh one can open)
  invokeQbtModalCancel();
  closeQbtCategoryTagModal(true);
  qbtModalOnCancel = typeof onCancel === "function" ? onCancel : null;

  const categories = prefs.qbtCategories || [];
  const tags = prefs.qbtTags || [];
  // A "last selection" exists only if user has actually used the modal before (not null)
  const useLastSel =
    prefs.qbtLastCategory !== null || prefs.qbtLastTags !== null;

  const defaultCategory = useLastSel
    ? prefs.qbtLastCategory || ""
    : prefs.qbtDefaultCategory || "";
  const defaultTags =
    useLastSel && prefs.qbtLastTags
      ? prefs.qbtLastTags
      : prefs.qbtDefaultTags || [];

  const overlay = document.createElement("div");
  overlay.className = "qbt-modal-overlay";
  overlay.id = "qbtCategoryTagOverlay";

  const modal = document.createElement("div");
  modal.className = "qbt-modal";
  modal.id = "qbtCategoryTagModal";

  modal.innerHTML = `
    <div class="qbt-modal-header">
      <h3>Send to qBittorrent</h3>
      <button type="button" class="qbt-modal-close" id="qbtModalCloseBtn" aria-label="Close">&times;</button>
    </div>
    <div class="qbt-modal-body">
      <div class="qbt-modal-field">
        <label class="qbt-modal-label">Category</label>
        <select id="qbtModalCategorySelect" class="qbt-modal-select">
          <option value="">(none)</option>
          ${categories
            .map(
              (c) =>
                `<option value="${escapeHtml(c)}" ${
                  c === defaultCategory ? "selected" : ""
                }>${escapeHtml(c)}</option>`,
            )
            .join("")}
        </select>
      </div>
      <div class="qbt-modal-field">
        <label class="qbt-modal-label">Tags${
          tags.length ? ` (${tags.length})` : ""
        }</label>
        <div class="qbt-modal-tags" id="qbtModalTagsContainer">
          ${
            tags.length
              ? tags
                  .map(
                    (t) => `
                <label class="qbt-tag-item">
                  <input type="checkbox" value="${escapeHtml(t)}" ${
                    defaultTags.includes(t) ? "checked" : ""
                  } />
                  <span>${escapeHtml(t)}</span>
                </label>
              `,
                  )
                  .join("")
              : `<span class="qbt-modal-empty">No tags defined. Add some on the <a href="/settings">Settings page</a>.</span>`
          }
        </div>
      </div>
      <div class="qbt-modal-hint">
        Your last selection will be remembered next time.
      </div>
    </div>
    <div class="qbt-modal-footer">
      <button type="button" class="qbt-modal-btn qbt-modal-btn-cancel" id="qbtModalCancelBtn">Cancel</button>
      <button type="button" class="qbt-modal-btn qbt-modal-btn-confirm" id="qbtModalConfirmBtn">Send Torrent</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector("#qbtModalCloseBtn");
  const cancelBtn = modal.querySelector("#qbtModalCancelBtn");
  const confirmBtn = modal.querySelector("#qbtModalConfirmBtn");

  const close = (cancelled = true) => {
    if (cancelled) invokeQbtModalCancel();
    else qbtModalOnCancel = null;
    closeQbtCategoryTagModal();
  };

  closeBtn.addEventListener("click", () => close(true));
  cancelBtn.addEventListener("click", () => close(true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(true);
  });

  confirmBtn.addEventListener("click", () => {
    const select = modal.querySelector("#qbtModalCategorySelect");
    const category = select.value;
    const tagInputs = modal.querySelectorAll(
      "#qbtModalTagsContainer input[type='checkbox']:checked",
    );
    const tags = Array.from(tagInputs).map((cb) => cb.value);
    close(false);
    onConfirm(category, tags);
  });

  document.addEventListener("keydown", qbtModalKeyHandler);
}

export function closeQbtCategoryTagModal(immediate = false) {
  const overlay = document.getElementById("qbtCategoryTagOverlay");
  document.removeEventListener("keydown", qbtModalKeyHandler);
  if (!overlay) return;

  if (immediate) {
    overlay.remove();
    return;
  }

  // Already animating out — don't restart
  if (overlay.classList.contains("hiding")) return;

  const modal = overlay.querySelector(".qbt-modal");
  overlay.classList.add("hiding");
  if (modal) modal.classList.add("hiding");

  // Wait for fade-out animation before removing (same pattern as Quick Search)
  const onOverlayFadeOut = (e) => {
    if (e.target !== overlay) return;
    overlay.removeEventListener("animationend", onOverlayFadeOut);
    overlay.remove();
  };
  overlay.addEventListener("animationend", onOverlayFadeOut);
}

export function qbtModalKeyHandler(e) {
  if (e.key === "Escape") {
    invokeQbtModalCancel();
    closeQbtCategoryTagModal();
  }
  if (e.key === "Enter") {
    const confirmBtn = document.getElementById("qbtModalConfirmBtn");
    if (confirmBtn) confirmBtn.click();
  }
}

export async function addSendButtonToViewPage() {
  if (!window.location.pathname.startsWith("/view/")) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.showSendButtons) return;

  // Avoid adding duplicate button
  if (document.querySelector(".send-torrent-button")) return;

  const magnetLink = document.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  const sendButton = createSendButton(magnetLink.href, { marginLeft: "10px" });

  // Insert after the magnet Copy button if present, otherwise after the magnet link
  const magnetCopyButton = magnetLink.parentNode.querySelector(
    ".magnet-button:not(.send-torrent-button)",
  );
  const insertAfter = magnetCopyButton || magnetLink;
  insertAfter.parentNode.insertBefore(sendButton, insertAfter.nextSibling);
}
