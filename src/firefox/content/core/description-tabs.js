import { updateAmeNZBDescriptionSection, updateAnimetoshoEpisodeFeatures, updateNekoBTDescriptionSection, updateTsukihimeDescriptionSection } from "../internal.js";

const extraDescriptionSectionUpdaters = [];

export function registerDescriptionSectionUpdater(fn) {
  extraDescriptionSectionUpdaters.push(fn);
}

export function ensureDescriptionTab(panel, section, label, insertAfterSection) {
  let tab = panel.querySelector(`[data-section="${section}"]`);
  if (tab) return tab;

  const tabsHeader = panel.querySelector(".nyaa-enhancer-description-tabs");
  if (!tabsHeader) return null;

  tab = document.createElement("button");
  tab.type = "button";
  tab.className = "nyaa-enhancer-desc-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.section = section;
  tab.textContent = label;
  tab.addEventListener("click", () =>
    switchDescriptionPanelTab(panel, section),
  );

  const afterTab = panel.querySelector(
    `[data-section="${insertAfterSection}"]`,
  );
  if (afterTab?.nextSibling) {
    tabsHeader.insertBefore(tab, afterTab.nextSibling);
  } else {
    tabsHeader.appendChild(tab);
  }
  return tab;
}

export const AT_EPISODE_TAB_BODIES = {
  atscreenshots: {
    bodyId: "at-screenshots-panel",
    bodyClass: "nyaa-enhancer-at-screenshots-body",
  },
  atfileinfo: {
    bodyId: "at-fileinfo-panel",
    bodyClass: "nyaa-enhancer-at-fileinfo-body",
  },
  atattachments: {
    bodyId: "at-attachments-panel",
    bodyClass: "nyaa-enhancer-at-attachments-body",
  },
};

export function getOrCreateDescriptionPanelBody(panel, section) {
  const config = AT_EPISODE_TAB_BODIES[section];
  if (!config) return null;

  let body = panel.querySelector(`#${config.bodyId}`);
  if (body) return body;

  body = document.createElement("div");
  body.id = config.bodyId;
  body.className = `panel-body ${config.bodyClass}`;
  body.hidden = true;
  panel.appendChild(body);
  return body;
}

export function switchDescriptionPanelTab(panel, activeSection) {
  const sectionConfig = [
    {
      id: "description",
      getBody: () => document.getElementById("torrent-description"),
    },
    {
      id: "atscreenshots",
      getBody: () => panel.querySelector("#at-screenshots-panel"),
    },
    {
      id: "atfileinfo",
      getBody: () => panel.querySelector("#at-fileinfo-panel"),
    },
    {
      id: "atattachments",
      getBody: () => panel.querySelector("#at-attachments-panel"),
    },
    {
      id: "similar",
      getBody: () => panel.querySelector("#similar-torrent-panel"),
    },
    {
      id: "amenzb",
      getBody: () => panel.querySelector("#amenzb-torrent-panel"),
    },
    {
      id: "nekobt",
      getBody: () => panel.querySelector("#nekobt-torrent-panel"),
    },
    {
      id: "tsukihime",
      getBody: () => panel.querySelector("#tsukihime-torrent-panel"),
    },
  ];

  for (const { id, getBody } of sectionConfig) {
    const tab = panel.querySelector(`[data-section="${id}"]`);
    const body = getBody();
    const active = id === activeSection;
    if (tab) {
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (body) body.hidden = !active;
  }
}

export function enhanceTorrentDescriptionPanel() {
  if (!window.location.pathname.startsWith("/view/")) return;

  const descriptionBody = document.getElementById("torrent-description");
  if (!descriptionBody) return;

  const panel = descriptionBody.closest(".panel.panel-default");
  if (!panel) return;

  if (!panel.classList.contains("nyaa-enhancer-description-panel")) {
    panel.classList.add("nyaa-enhancer-description-panel");

    const tabsHeader = document.createElement("div");
    tabsHeader.className = "nyaa-enhancer-description-tabs";
    tabsHeader.setAttribute("role", "tablist");

    const descTab = document.createElement("button");
    descTab.type = "button";
    descTab.className = "nyaa-enhancer-desc-tab active";
    descTab.setAttribute("role", "tab");
    descTab.setAttribute("aria-selected", "true");
    descTab.dataset.section = "description";
    descTab.textContent = "Description";
    descTab.addEventListener("click", () =>
      switchDescriptionPanelTab(panel, "description"),
    );

    tabsHeader.appendChild(descTab);
    panel.insertBefore(tabsHeader, descriptionBody);
  }

  updateAmeNZBDescriptionSection();
  updateNekoBTDescriptionSection();
  updateTsukihimeDescriptionSection();
  updateAnimetoshoEpisodeFeatures();
  extraDescriptionSectionUpdaters.forEach((fn) => fn());
}
