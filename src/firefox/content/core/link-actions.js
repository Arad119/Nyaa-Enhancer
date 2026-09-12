import { loadStoredPreferences } from "../../shared/prefs.js";
import { createAnimetoshoListAnchor, createAnimetoshoListPlaceholder, createSendListLink, getTorrentInfoHashFromRow, isAnimetoshoListCategoryRow, isNyaaTorrentDataRow, showNotification } from "../internal.js";

export function getTorrentLinkCell(row) {
  return row.querySelector('td:has(a[href^="magnet:"])');
}

export function getNextLinkActionSibling(anchor) {
  let next = anchor.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && /^\s+$/.test(next.textContent)) {
    next = next.nextSibling;
  }
  return next;
}

export function hasSpaceBefore(node) {
  const prev = node?.previousSibling;
  return prev?.nodeType === Node.TEXT_NODE && /^\s+$/.test(prev.textContent);
}

export function areLinkActionsOrdered(linkCell) {
  const magnetLink = linkCell.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return true;

  const actions = [
    linkCell.querySelector(".link-action-copy"),
    linkCell.querySelector(".link-action-send"),
    linkCell.querySelector(".link-action-at"),
  ].filter(Boolean);

  if (!actions.length) return true;

  let anchor = magnetLink;
  for (const action of actions) {
    if (getNextLinkActionSibling(anchor) !== action || !hasSpaceBefore(action)) {
      return false;
    }
    anchor = action;
  }

  return true;
}

export function insertLinkActionAfter(linkCell, element, afterElement) {
  if (!afterElement) {
    linkCell.appendChild(element);
    return;
  }

  if (
    element.parentNode === linkCell &&
    getNextLinkActionSibling(afterElement) === element &&
    hasSpaceBefore(element)
  ) {
    return;
  }

  if (element.parentNode) {
    element.remove();
  }

  let insertRef = afterElement.nextSibling;
  if (
    !(
      insertRef &&
      insertRef.nodeType === Node.TEXT_NODE &&
      /^\s+$/.test(insertRef.textContent)
    )
  ) {
    const space = document.createTextNode(" ");
    linkCell.insertBefore(space, insertRef);
    insertRef = space;
  }

  linkCell.insertBefore(element, insertRef.nextSibling);
}

export function removeLinkAction(element) {
  if (!element?.parentNode) return;

  const prev = element.previousSibling;
  element.remove();

  if (prev?.nodeType === Node.TEXT_NODE && /^\s+$/.test(prev.textContent)) {
    const before = prev.previousSibling;
    if (
      before?.matches?.(
        'a[href^="magnet:"], a[href*="/download/"], .link-action-copy, .link-action-send, .link-action-at',
      )
    ) {
      prev.remove();
    }
  }
}

export function reorderLinkActionsInCell(linkCell) {
  if (areLinkActionsOrdered(linkCell)) return;

  const magnetLink = linkCell.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  const actions = [
    linkCell.querySelector(".link-action-copy"),
    linkCell.querySelector(".link-action-send"),
    linkCell.querySelector(".link-action-at"),
  ].filter(Boolean);

  if (!actions.length) return;

  actions.forEach(removeLinkAction);

  let anchor = magnetLink;
  for (const action of actions) {
    insertLinkActionAfter(linkCell, action, anchor);
    anchor = action;
  }
}

export function removeLegacyTorrentListActionColumns() {
  document
    .querySelectorAll(
      'th.text-center[title="AT"], th.text-center[title="Magnet"], th.text-center[title="Send"]',
    )
    .forEach((header) => header.remove());
  document
    .querySelectorAll(".at-column, .magnet-column, .send-column")
    .forEach((cell) => cell.remove());
  document.querySelectorAll(".torrent-link-actions").forEach((container) => {
    while (container.firstChild) {
      container.parentNode.insertBefore(container.firstChild, container);
    }
    container.remove();
  });
  document
    .querySelectorAll(".link-action-copy.magnet-button, .link-action-send.magnet-button")
    .forEach((el) => el.remove());
}

export function createMagnetCopyLink(magnetLink) {
  const copyLink = document.createElement("a");
  copyLink.href = "#";
  copyLink.className = "link-action-copy";
  copyLink.title = "Copy magnet link to clipboard";
  copyLink.innerHTML = '<i class="fa fa-fw fa-clipboard"></i>';
  copyLink.addEventListener("click", (e) => {
    e.preventDefault();
    navigator.clipboard
      .writeText(magnetLink.href)
      .then(() => {
        showNotification("Magnet link copied to clipboard!", true);
      })
      .catch((err) => {
        console.error("Failed to copy magnet:", err);
        showNotification("Failed to copy magnet link", false);
      });
  });
  return copyLink;
}

export function createMagnetCopyButton(magnetLink, { extraStyles = {} } = {}) {
  const magnetButton = document.createElement("button");
  magnetButton.className = "magnet-button";
  magnetButton.title = "Copy magnet link to clipboard";
  magnetButton.innerHTML = '<i class="fa fa-clipboard"></i> Copy';
  magnetButton.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
  magnetButton.style.fontWeight = "500";
  Object.assign(magnetButton.style, extraStyles);
  magnetButton.addEventListener("click", () => {
    navigator.clipboard
      .writeText(magnetLink.href)
      .then(() => {
        showNotification("Magnet link copied to clipboard!", true);
      })
      .catch((err) => {
        console.error("Failed to copy magnet:", err);
        showNotification("Failed to copy magnet link", false);
      });
  });
  return magnetButton;
}

export function updateTorrentRowLinkActions(row, prefs, { deferAnimetosho = false } = {}) {
  const linkCell = getTorrentLinkCell(row);
  if (!linkCell) return;

  const magnetLink = linkCell.querySelector('a[href^="magnet:"]');
  if (!magnetLink) return;

  const showAtLink =
    prefs.showATLinks && isAnimetoshoListCategoryRow(row);
  const needsAtSlot = prefs.showATLinks;
  const resolveAtNow = showAtLink && !deferAnimetosho;
  const needsAny =
    prefs.showMagnetButtons ||
    prefs.showSendButtons ||
    showAtLink ||
    needsAtSlot;

  linkCell.querySelector(".torrent-link-actions")?.remove();

  let atLink = linkCell.querySelector(".link-action-at");
  let copyLink = linkCell.querySelector(".link-action-copy");
  let sendLink = linkCell.querySelector(".link-action-send");
  let changed = false;

  if (!needsAny) {
    if (atLink) {
      removeLinkAction(atLink);
      changed = true;
    }
    if (copyLink) {
      removeLinkAction(copyLink);
      changed = true;
    }
    if (sendLink) {
      removeLinkAction(sendLink);
      changed = true;
    }
    return;
  }

  if (prefs.showMagnetButtons) {
    if (!copyLink) {
      copyLink = createMagnetCopyLink(magnetLink);
      linkCell.appendChild(copyLink);
      changed = true;
    }
  } else if (copyLink) {
    removeLinkAction(copyLink);
    changed = true;
  }

  if (prefs.showSendButtons) {
    if (!sendLink) {
      sendLink = createSendListLink(magnetLink.href);
      linkCell.appendChild(sendLink);
      changed = true;
    }
  } else if (sendLink) {
    removeLinkAction(sendLink);
    changed = true;
  }

  if (resolveAtNow) {
    const infoHash = getTorrentInfoHashFromRow(row);
    if (infoHash) {
      if (atLink?.classList.contains("link-action-at-placeholder")) {
        removeLinkAction(atLink);
        atLink = null;
      }
      if (!atLink) {
        atLink = createAnimetoshoListAnchor(infoHash, prefs.useNewATDomain);
        linkCell.appendChild(atLink);
        changed = true;
      }
    } else if (atLink) {
      removeLinkAction(atLink);
      changed = true;
    }
  } else if (needsAtSlot || (showAtLink && deferAnimetosho)) {
    if (atLink && !atLink.classList.contains("link-action-at-placeholder")) {
      removeLinkAction(atLink);
      atLink = null;
    }
    if (!atLink) {
      atLink = createAnimetoshoListPlaceholder();
      linkCell.appendChild(atLink);
      changed = true;
    }
  } else if (atLink) {
    removeLinkAction(atLink);
    changed = true;
  }

  if (changed || !areLinkActionsOrdered(linkCell)) {
    reorderLinkActionsInCell(linkCell);
  }
}

export async function updateAllTorrentListLinkActions(overrides = {}) {
  const prefs = { ...(await loadStoredPreferences()), ...overrides };
  removeLegacyTorrentListActionColumns();
  document.querySelectorAll("table.torrent-list tbody tr").forEach((row) => {
    if (!isNyaaTorrentDataRow(row)) return;
    updateTorrentRowLinkActions(row, prefs);
  });
}

export function isLinkActionMutationNode(node) {
  if (!node) return false;
  if (node.nodeType === Node.TEXT_NODE) {
    return /^\s+$/.test(node.textContent);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return node.matches?.(
    ".link-action-copy, .link-action-send, .link-action-at, .torrent-link-actions",
  );
}

export function mutationsIncludeNonLinkActionChanges(mutations) {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") continue;
    for (const node of mutation.addedNodes) {
      if (!isLinkActionMutationNode(node)) return true;
    }
    for (const node of mutation.removedNodes) {
      if (!isLinkActionMutationNode(node)) return true;
    }
  }
  return false;
}
