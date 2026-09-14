import { loadStoredPreferences } from "../../../shared/prefs.js";

export const NAVBAR_HIDDEN_CLASS = "ne-navbar-hidden";

export const NAVBAR_VISIBILITY_TOGGLES = [
  { key: "showNavbarUpload", label: "Show Upload" },
  {
    key: "showNavbarInfo",
    label: "Show Info",
    hint: "Rules and Help dropdown.",
  },
  { key: "showNavbarRss", label: "Show RSS" },
  { key: "showNavbarTwitter", label: "Show Twitter" },
  {
    key: "showNavbarFap",
    label: "Show Fap",
  },
  {
    key: "showNavbarFilter",
    label: "Show filter dropdown",
    hint: "No filter / No remakes / Trusted only.",
  },
  { key: "showNavbarCategory", label: "Show category dropdown" },
  {
    key: "showNavbarAccount",
    label: "Show account menu",
    hint: "Login and Register, or your user menu.",
  },
];

export const NAVBAR_VISIBILITY_PREF_KEYS = NAVBAR_VISIBILITY_TOGGLES.map(
  (item) => item.key,
);

const NAVBAR_VISIBILITY_PREF_SET = new Set(NAVBAR_VISIBILITY_PREF_KEYS);

export function isNavbarVisibilityPref(setting) {
  return NAVBAR_VISIBILITY_PREF_SET.has(setting);
}

function leftNav() {
  return document.querySelector(".nav.navbar-nav:not(.navbar-right)");
}

function leftNavItem(test) {
  const nav = leftNav();
  if (!nav) return null;
  for (const li of nav.children) {
    if (li.tagName !== "LI") continue;
    const link = li.querySelector(":scope > a");
    if (link && test(link, li)) return li;
  }
  return null;
}

function hrefOf(link) {
  return link.getAttribute("href") || "";
}

function linkText(link) {
  return (link.textContent || "").replace(/\s+/g, " ").trim();
}

function findUpload() {
  return leftNavItem(
    (link) => hrefOf(link) === "/upload" || hrefOf(link).endsWith("/upload"),
  );
}

function findInfo() {
  return leftNavItem(
    (link, li) =>
      li.classList.contains("dropdown") && /^Info\b/.test(linkText(link)),
  );
}

function findRss() {
  return leftNavItem(
    (link) =>
      hrefOf(link).includes("page=rss") || linkText(link) === "RSS",
  );
}

function findTwitter() {
  return leftNavItem(
    (link) =>
      /twitter\.com|x\.com\/nyaa/i.test(hrefOf(link)) ||
      linkText(link) === "Twitter",
  );
}

function findFap() {
  return leftNavItem(
    (link) => /sukebei/i.test(hrefOf(link)) || linkText(link) === "Fap",
  );
}

function findAccount() {
  return document.querySelector(".navbar-nav.navbar-right > li.dropdown");
}

function mobileSearchSelects(name) {
  return Array.from(
    document.querySelectorAll(
      `.search-container.visible-xs select[name="${name}"]`,
    ),
  );
}

function wrapMobileSelect(select) {
  return select.closest(".bootstrap-select") || select;
}

function findFilterControls() {
  const nodes = [];
  const desktop = document.getElementById("navFilter-criteria");
  if (desktop) nodes.push(desktop);
  for (const select of mobileSearchSelects("f")) {
    const wrap = wrapMobileSelect(select);
    if (desktop?.contains(wrap)) continue;
    nodes.push(wrap);
  }
  return nodes;
}

function findCategoryControls() {
  const nodes = [];
  const desktop = document.getElementById("navFilter-category");
  if (desktop) nodes.push(desktop);
  for (const select of mobileSearchSelects("c")) {
    const wrap = wrapMobileSelect(select);
    if (desktop?.contains(wrap)) continue;
    nodes.push(wrap);
  }
  return nodes;
}

const NAVBAR_ITEM_FINDERS = {
  showNavbarUpload: findUpload,
  showNavbarInfo: findInfo,
  showNavbarRss: findRss,
  showNavbarTwitter: findTwitter,
  showNavbarFap: findFap,
  showNavbarFilter: findFilterControls,
  showNavbarCategory: findCategoryControls,
  showNavbarAccount: findAccount,
};

function followingBreak(el) {
  const next = el.nextElementSibling;
  return next?.tagName === "BR" ? next : null;
}

function collectNodes(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function setNodesHidden(nodes, hidden) {
  // Hide in place. Removing/reinserting would shuffle order when items
  // are toggled off and back on.
  for (const el of collectNodes(nodes)) {
    el.classList.toggle(NAVBAR_HIDDEN_CLASS, hidden);
    const br = followingBreak(el);
    if (br) br.classList.toggle(NAVBAR_HIDDEN_CLASS, hidden);
  }
}

function updateNavbarSearchChrome() {
  const filter = document.getElementById("navFilter-criteria");
  const category = document.getElementById("navFilter-category");
  const noFilter = !!filter?.classList.contains(NAVBAR_HIDDEN_CLASS);
  const noCategory = !!category?.classList.contains(NAVBAR_HIDDEN_CLASS);
  document.querySelectorAll(".search-container").forEach((container) => {
    container.classList.toggle("ne-navbar-search--no-filter", noFilter);
    container.classList.toggle("ne-navbar-search--no-category", noCategory);
  });
}

export function setNavbarVisibilityPref(setting, value) {
  const finder = NAVBAR_ITEM_FINDERS[setting];
  if (!finder) return;
  setNodesHidden(finder(), value === false);
  if (setting === "showNavbarFilter" || setting === "showNavbarCategory") {
    updateNavbarSearchChrome();
  }
}

export async function applyNavbarVisibility(prefs) {
  const resolved = prefs || (await loadStoredPreferences());
  for (const key of NAVBAR_VISIBILITY_PREF_KEYS) {
    setNodesHidden(NAVBAR_ITEM_FINDERS[key](), resolved[key] === false);
  }
  updateNavbarSearchChrome();
}
