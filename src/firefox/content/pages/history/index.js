import { escapeHtml } from "../../core/html.js";
import { showNotification } from "../../core/notifications.js";
import { getTorrentViewUrl } from "../../../shared/urls.js";
import { loadStoredPreferences } from "../../../shared/prefs.js";
import {
  HISTORY_ACTION_IDS,
  HISTORY_ACTION_META,
  HISTORY_DATE_PRESETS,
  clearHistory,
  eventInHistoryDateRange,
  expandHistoryEvents,
  historyMatchesQuery,
  loadHistoryState,
  localDateInputValue,
  removeHistoryEvent,
} from "../../features/history/store.js";

const HISTORY_DEFAULT_PRESET = "day";

export function removeHistoryNavItem() {
  const navList = document.querySelector(".nav.navbar-nav");
  const existing = Array.from(navList?.querySelectorAll("li") || []).find(
    (li) => li.textContent.trim() === "History",
  );
  existing?.remove();
}

export async function addHistoryNavItem() {
  const navList = document.querySelector(".nav.navbar-nav");
  if (!navList) return;

  const prefs = await loadStoredPreferences();
  if (!prefs.historyEnabled) {
    removeHistoryNavItem();
    return;
  }

  const existing = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "History",
  );
  if (existing) return;

  const historyItem = document.createElement("li");
  const historyLink = document.createElement("a");
  historyLink.href = "/history";
  historyLink.textContent = "History";
  historyItem.appendChild(historyLink);
  if (window.location.pathname === "/history") {
    historyItem.classList.add("active");
  }

  const settingsItem = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "Settings",
  );
  const changelogItem = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "Changelog",
  );
  const rssItem = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "RSS",
  );

  if (settingsItem) {
    settingsItem.insertAdjacentElement("afterend", historyItem);
  } else if (changelogItem) {
    changelogItem.insertAdjacentElement("afterend", historyItem);
  } else if (rssItem) {
    rssItem.insertAdjacentElement("afterend", historyItem);
  } else {
    navList.appendChild(historyItem);
  }
}

export function formatHistoryClock(ts) {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatHistoryRelative(ts) {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) {
    const mins = Math.round(diffSec / 60);
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.round(diffSec / 3600);
    return `${hours}h ago`;
  }
  if (diffSec < 86400 * 7) {
    const days = Math.round(diffSec / 86400);
    return `${days}d ago`;
  }
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatHistoryDayLabel(ts) {
  const date = new Date(ts * 1000);
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const dayDiff = Math.round((startToday - startThat) / 86400000);

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function historyDayKey(ts) {
  const date = new Date(ts * 1000);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getHistoryUiState() {
  const page = document.querySelector(".ne-history-page");
  if (!page) return null;

  const actions = new Set(
    Array.from(
      page.querySelectorAll(".ne-history-chip[data-history-action]"),
    )
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => chip.dataset.historyAction),
  );

  const presetBtn = page.querySelector(
    ".ne-history-preset[aria-pressed='true']",
  );
  return {
    query: document.getElementById("ne-history-search")?.value || "",
    actions,
    preset: presetBtn?.dataset.historyPreset || HISTORY_DEFAULT_PRESET,
    from: document.getElementById("ne-history-from")?.value || "",
    to: document.getElementById("ne-history-to")?.value || "",
  };
}

function filterHistoryEvents(events, ui) {
  return events.filter((event) => {
    if (!ui.actions.has(event.action)) return false;
    if (!historyMatchesQuery(event, ui.query)) return false;
    return eventInHistoryDateRange(event, {
      preset: ui.preset,
      from: ui.from,
      to: ui.to,
    });
  });
}

function groupHistoryEvents(events) {
  const groups = [];
  const byKey = new Map();
  const newestFirst = [...events].sort((a, b) => b.ts - a.ts || b.id - a.id);

  for (const event of newestFirst) {
    const key = historyDayKey(event.ts);
    if (!byKey.has(key)) {
      const group = { key, label: formatHistoryDayLabel(event.ts), events: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).events.push(event);
  }
  return groups;
}

function renderHistoryEmpty(reason) {
  const copy =
    reason === "none"
      ? {
          title: "No activity yet",
          body: "Enable History in Settings, then visit a torrent, copy its magnet, download the file, or send it to your client.",
        }
      : {
          title: "Nothing matches",
          body: "Try another name, turn an action back on, or widen the date range.",
        };
  return `
    <div class="ne-history-empty">
      <p class="ne-history-empty__title">${copy.title}</p>
      <p class="ne-history-empty__body">${copy.body}</p>
    </div>
  `;
}

function renderHistoryItem(event) {
  const meta = HISTORY_ACTION_META[event.action] || HISTORY_ACTION_META.visit;
  const href = getTorrentViewUrl(event.id);
  const when = formatHistoryRelative(event.ts);
  const clock = formatHistoryClock(event.ts);
  const title = escapeHtml(event.title);
  return `
    <li class="ne-history-item" data-action="${event.action}" data-id="${event.id}" data-code="${event.actionCode}" data-ts="${event.ts}" data-hash="${escapeHtml(event.hash || "")}" data-title="${title}">
      <span class="ne-history-item__mark" aria-hidden="true">
        <i class="fa ${meta.icon}"></i>
      </span>
      <div class="ne-history-item__body">
        <a class="ne-history-item__title" href="${href}">${title}</a>
        <p class="ne-history-item__meta">
          <span class="ne-history-item__action">${escapeHtml(meta.verb)}</span>
          <span class="ne-history-item__dot" aria-hidden="true"></span>
          <time datetime="${new Date(event.ts * 1000).toISOString()}" title="${new Date(event.ts * 1000).toLocaleString()}">${escapeHtml(clock)} · ${escapeHtml(when)}</time>
        </p>
      </div>
      <div class="ne-history-item__actions">
        <button type="button" class="ne-history-item__action-btn" data-history-do="copy" title="Copy magnet" aria-label="Copy magnet for ${title}">
          <i class="fa fa-clipboard" aria-hidden="true"></i>
        </button>
        <button type="button" class="ne-history-item__action-btn" data-history-do="download" title="Download torrent" aria-label="Download ${title}">
          <i class="fa fa-download" aria-hidden="true"></i>
        </button>
        <button type="button" class="ne-history-item__action-btn" data-history-do="send" title="Send to client" aria-label="Send ${title} to client">
          <i class="fa fa-cloud-upload" aria-hidden="true"></i>
        </button>
      </div>
      <button type="button" class="ne-history-item__remove" title="Remove from history" aria-label="Remove ${title} from history">
        <i class="fa fa-times" aria-hidden="true"></i>
      </button>
    </li>
  `;
}

export async function neHistoryRender() {
  const list = document.getElementById("ne-history-list");
  const countEl = document.getElementById("ne-history-count");
  const notice = document.getElementById("ne-history-disabled");
  if (!list) return;

  const ui = getHistoryUiState();
  if (!ui) return;

  const prefs = await loadStoredPreferences();
  if (notice) notice.hidden = !!prefs.historyEnabled;

  const all = expandHistoryEvents(await loadHistoryState());
  const filtered = filterHistoryEvents(all, ui);

  if (countEl) {
    countEl.textContent = all.length
      ? `${filtered.length} of ${all.length}`
      : "Empty";
  }

  if (!all.length) {
    list.innerHTML = renderHistoryEmpty("none");
    return;
  }
  if (!filtered.length) {
    list.innerHTML = renderHistoryEmpty("filtered");
    return;
  }

  list.innerHTML = groupHistoryEvents(filtered)
    .map(
      (group) => `
      <section class="ne-history-day">
        <h2 class="ne-history-day__label">${escapeHtml(group.label)}</h2>
        <ol class="ne-history-day__list">
          ${group.events.map(renderHistoryItem).join("")}
        </ol>
      </section>
    `,
    )
    .join("");
}

function setHistoryPreset(preset) {
  document.querySelectorAll(".ne-history-preset").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.historyPreset === preset));
  });
  const custom = document.getElementById("ne-history-custom");
  if (custom) custom.hidden = preset !== "custom";
}

function setClearConfirm(open) {
  const idle = document.getElementById("ne-history-clear-idle");
  const confirm = document.getElementById("ne-history-clear-confirm");
  if (idle) idle.hidden = open;
  if (confirm) confirm.hidden = !open;
}

export function neHistoryWirePage() {
  const page = document.querySelector(".ne-history-page");
  if (!page || page.dataset.wired === "1") return;
  page.dataset.wired = "1";

  const search = document.getElementById("ne-history-search");
  const searchClear = document.getElementById("ne-history-search-clear");
  let searchTimer = null;

  const scheduleRender = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      neHistoryRender();
    }, 80);
  };

  search?.addEventListener("input", () => {
    if (searchClear) searchClear.hidden = !search.value;
    scheduleRender();
  });
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && search.value) {
      search.value = "";
      if (searchClear) searchClear.hidden = true;
      neHistoryRender();
    }
  });
  searchClear?.addEventListener("click", () => {
    if (!search) return;
    search.value = "";
    searchClear.hidden = true;
    search.focus();
    neHistoryRender();
  });

  page.querySelectorAll(".ne-history-chip[data-history-action]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!pressed));
      neHistoryRender();
    });
  });

  page.querySelectorAll(".ne-history-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      setHistoryPreset(btn.dataset.historyPreset);
      neHistoryRender();
    });
  });

  ["ne-history-from", "ne-history-to"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      const from = document.getElementById("ne-history-from");
      const to = document.getElementById("ne-history-to");
      if (from && to && from.value && to.value && from.value > to.value) {
        const swap = from.value;
        from.value = to.value;
        to.value = swap;
      }
      neHistoryRender();
    });
  });

  document.getElementById("ne-history-clear")?.addEventListener("click", () => {
    setClearConfirm(true);
  });
  document
    .getElementById("ne-history-clear-cancel")
    ?.addEventListener("click", () => setClearConfirm(false));
  document
    .getElementById("ne-history-clear-yes")
    ?.addEventListener("click", async () => {
      await clearHistory();
      setClearConfirm(false);
      await neHistoryRender();
      showNotification("History cleared", true);
    });

  page.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("[data-history-do]");
    if (actionBtn) {
      const item = actionBtn.closest(".ne-history-item");
      if (!item) return;
      const historyEvent = {
        id: Number(item.dataset.id),
        title: item.dataset.title || "",
        hash: item.dataset.hash || "",
      };
      actionBtn.disabled = true;
      try {
        const {
          copyHistoryMagnet,
          downloadHistoryTorrent,
          sendHistoryTorrent,
        } = await import("../../features/history/actions.js");
        if (actionBtn.dataset.historyDo === "copy") {
          await copyHistoryMagnet(historyEvent);
        } else if (actionBtn.dataset.historyDo === "download") {
          await downloadHistoryTorrent(historyEvent);
        } else if (actionBtn.dataset.historyDo === "send") {
          await sendHistoryTorrent(historyEvent);
        }
      } finally {
        actionBtn.disabled = false;
      }
      return;
    }

    const remove = event.target.closest(".ne-history-item__remove");
    if (!remove) return;
    const item = remove.closest(".ne-history-item");
    if (!item) return;
    await removeHistoryEvent(
      Number(item.dataset.id),
      Number(item.dataset.code),
      Number(item.dataset.ts),
    );
    await neHistoryRender();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (window.location.pathname !== "/history") return;
    if (area === "local" && changes.neHistory) {
      neHistoryRender();
      return;
    }
    if ((area === "sync" || area === "local") && changes.historyEnabled) {
      neHistoryRender();
    }
  });
}

export function neHistoryBuildPageHTML(prefs = {}) {
  const today = localDateInputValue();
  const weekAgo = localDateInputValue(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );

  const actionChips = HISTORY_ACTION_IDS.map((id) => {
    const meta = HISTORY_ACTION_META[id];
    return `
      <button type="button" class="ne-history-chip" data-history-action="${id}" aria-pressed="true">
        <i class="fa ${meta.icon}" aria-hidden="true"></i>
        <span>${meta.label}</span>
      </button>
    `;
  }).join("");

  const presets = HISTORY_DATE_PRESETS.map(
    (preset) => `
      <button type="button" class="ne-history-preset" data-history-preset="${preset.id}" aria-pressed="${preset.id === HISTORY_DEFAULT_PRESET}" title="${preset.desc}">
        ${preset.label}
      </button>
    `,
  ).join("");

  const page = document.createElement("div");
  page.className = "ne-history-page";
  page.innerHTML = `
    <header class="ne-history-page__header">
      <h1>History</h1>
      <p class="ne-history-page__subtitle">
        A local log of torrent pages you open, magnets you save, files you download, and torrents you send.
        Nothing is synced. Enable logging in <a href="/settings">Settings → History</a>.
      </p>
    </header>

    <div class="ne-history-notice" id="ne-history-disabled" ${prefs.historyEnabled ? "hidden" : ""}>
      Logging is off. Enable History in Settings to record new visits, copies, downloads, and sends.
    </div>

    <div class="ne-history-toolbar">
      <span class="ne-history-count" id="ne-history-count">Empty</span>
      <div class="ne-history-clear" id="ne-history-clear-idle">
        <button type="button" class="ne-settings-btn ne-settings-btn--secondary ne-settings-btn--small" id="ne-history-clear">Clear history</button>
      </div>
      <div class="ne-history-clear ne-history-clear--confirm" id="ne-history-clear-confirm" hidden>
        <span>Clear all activity?</span>
        <button type="button" class="ne-settings-btn ne-settings-btn--outline ne-settings-btn--small" id="ne-history-clear-cancel">Keep</button>
        <button type="button" class="ne-settings-btn ne-settings-btn--danger ne-settings-btn--small" id="ne-history-clear-yes">Clear</button>
      </div>
    </div>

    <div class="ne-history-controls">
      <div class="ne-settings-search">
        <div class="ne-settings-search__field">
          <span class="ne-settings-search__icon" aria-hidden="true"><i class="fa fa-search"></i></span>
          <input
            type="search"
            id="ne-history-search"
            placeholder="Search by name, torrent ID, or info hash"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search history"
          />
          <button type="button" class="ne-settings-search__clear" id="ne-history-search-clear" hidden aria-label="Clear search">
            <i class="fa fa-times" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="ne-history-chips" role="group" aria-label="Filter by action">
        ${actionChips}
      </div>

      <div class="ne-history-dates" role="radiogroup" aria-label="Date range">
        ${presets}
        <button type="button" class="ne-history-preset" data-history-preset="custom" aria-pressed="false">Custom</button>
      </div>

      <div class="ne-history-custom" id="ne-history-custom" hidden>
        <label>
          From
          <input type="date" id="ne-history-from" max="${today}" value="${weekAgo}" />
        </label>
        <span class="ne-history-custom__rule" aria-hidden="true"></span>
        <label>
          To
          <input type="date" id="ne-history-to" max="${today}" value="${today}" />
        </label>
      </div>
    </div>

    <div id="ne-history-list" class="ne-history-list"></div>
  `;
  return page;
}

export async function handleHistoryPage() {
  if (window.location.pathname !== "/history") return;
  if (document.querySelector(".ne-history-page")) return;

  const mainContainer = document.querySelector(".container > h1")?.parentElement;
  if (!mainContainer) return;

  document.title = "History :: Nyaa";
  mainContainer.innerHTML = "";
  const prefs = await loadStoredPreferences();
  mainContainer.appendChild(neHistoryBuildPageHTML(prefs));
  neHistoryWirePage();
  await neHistoryRender();
}
