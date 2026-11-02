// Category filter: show only torrents in the selected categories.
// Nyaa and Sukebei reuse the same codes (1_2 is "Anime - English" on one and
// "Art - Doujinshi" on the other), so each site keeps its own selection.

const CATEGORY_ID_PATTERN = /^\d+_\d+$/;

// Used only when the page has no category dropdown to read from.
const FALLBACK_CATEGORIES = {
  nyaa: [
    ["1_0", "Anime"],
    ["1_1", "Anime Music Video"],
    ["1_2", "English-translated"],
    ["1_3", "Non-English-translated"],
    ["1_4", "Raw"],
    ["2_0", "Audio"],
    ["2_1", "Lossless"],
    ["2_2", "Lossy"],
    ["3_0", "Literature"],
    ["3_1", "English-translated"],
    ["3_2", "Non-English-translated"],
    ["3_3", "Raw"],
    ["4_0", "Live Action"],
    ["4_1", "English-translated"],
    ["4_2", "Idol/Promotional Video"],
    ["4_3", "Non-English-translated"],
    ["4_4", "Raw"],
    ["5_0", "Pictures"],
    ["5_1", "Graphics"],
    ["5_2", "Photos"],
    ["6_0", "Software"],
    ["6_1", "Applications"],
    ["6_2", "Games"],
  ],
  sukebei: [
    ["1_0", "Art"],
    ["1_1", "Anime"],
    ["1_2", "Doujinshi"],
    ["1_3", "Games"],
    ["1_4", "Manga"],
    ["1_5", "Pictures"],
    ["2_0", "Real Life"],
    ["2_1", "Photobooks and Pictures"],
    ["2_2", "Videos"],
  ],
};

export function getCategorySite() {
  return /^sukebei\./i.test(window.location.hostname) ? "sukebei" : "nyaa";
}

export function categoryFilterPrefKey(site = getCategorySite()) {
  return site === "sukebei" ? "categoryFilterSukebei" : "categoryFilterNyaa";
}

// Nyaa's own category badge (only subcategories have one).
export function categoryIconUrl(id, site = getCategorySite()) {
  return `/static/img/icons/${site}/${id}.png`;
}

export function isCategoryId(value) {
  return typeof value === "string" && CATEGORY_ID_PATTERN.test(value);
}

export function parentCategoryId(id) {
  return `${String(id).split("_")[0]}_0`;
}

function isParentCategoryId(id) {
  return String(id).endsWith("_0");
}

function groupsFromPairs(pairs) {
  const groups = [];
  for (const [id, label] of pairs) {
    if (!isCategoryId(id) || id === "0_0") continue;
    if (isParentCategoryId(id)) {
      groups.push({ id, label, subs: [] });
      continue;
    }
    const group = groups.find((item) => item.id === parentCategoryId(id));
    if (group) group.subs.push({ id, label });
  }
  return groups.filter((group) => group.subs.length);
}

// Reads the categories from Nyaa's own search dropdown, so the list always
// matches the site the user is on.
export function getSiteCategories() {
  const select = document.querySelector('select[name="c"]');
  const pairs = select
    ? [...select.options].map((option) => [
        option.value,
        option.textContent.replace(/^\s*-\s*/, "").trim(),
      ])
    : [];
  const groups = groupsFromPairs(pairs);
  return groups.length
    ? groups
    : groupsFromPairs(FALLBACK_CATEGORIES[getCategorySite()]);
}

export function findCategoryLabel(groups, id) {
  for (const group of groups) {
    if (group.id === id) return group.label;
    const sub = group.subs.find((item) => item.id === id);
    if (sub) return `${group.label} – ${sub.label}`;
  }
  return id;
}

export function getRowCategory(row) {
  const href = row.querySelector("td:first-child a[href*='c=']")?.getAttribute("href") || "";
  const match = href.match(/[?&]c=(\d+_\d+)/);
  return match ? match[1] : "";
}

export function getPageCategory() {
  const value = new URLSearchParams(window.location.search).get("c");
  return isCategoryId(value) ? value : "0_0";
}

export function getCategorySelection(prefs, site = getCategorySite()) {
  const list = prefs?.[categoryFilterPrefKey(site)];
  return Array.isArray(list) ? [...new Set(list.filter(isCategoryId))] : [];
}

// Ticking a main category stores just that category (it covers all of its
// subcategories); ticking every subcategory collapses to the main category.
export function toggleCategorySelection(selection, id, groups) {
  const next = new Set(selection);
  if (isParentCategoryId(id)) {
    const group = groups.find((item) => item.id === id);
    const fullySelected = next.has(id);
    group?.subs.forEach((sub) => next.delete(sub.id));
    if (fullySelected) next.delete(id);
    else next.add(id);
    return [...next];
  }

  const parentId = parentCategoryId(id);
  const group = groups.find((item) => item.id === parentId);
  if (next.has(parentId)) {
    next.delete(parentId);
    group?.subs.forEach((sub) => {
      if (sub.id !== id) next.add(sub.id);
    });
  } else if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
    if (group && group.subs.every((sub) => next.has(sub.id))) {
      group.subs.forEach((sub) => next.delete(sub.id));
      next.add(parentId);
    }
  }
  return [...next];
}

export function categoryIsSelected(selectionSet, id) {
  return selectionSet.has(id) || selectionSet.has(parentCategoryId(id));
}

// How the filter applies to the current page:
// - All categories: rows outside the selection are hidden.
// - A main category (e.g. Anime): only the selection inside it counts; with
//   nothing selected there, the filter is paused.
// - A subcategory: Nyaa already shows only that one, so the filter is paused.
const categoryStateCache = new WeakMap();

export function getCategoryFilterState(prefs) {
  if (prefs && categoryStateCache.has(prefs)) return categoryStateCache.get(prefs);

  const selection = getCategorySelection(prefs);
  const pageCategory = getPageCategory();
  let relevant = selection;
  let paused = null;

  if (pageCategory !== "0_0") {
    if (!isParentCategoryId(pageCategory)) {
      paused = "subcategory";
    } else {
      relevant = selection.filter(
        (id) => parentCategoryId(id) === pageCategory,
      );
      if (!relevant.length && selection.length) paused = "outside-parent";
    }
  }

  const state = {
    enabled: !!prefs?.categoryFilterEnabled,
    selection,
    selected: new Set(relevant),
    pageCategory,
    paused,
  };
  state.active = state.enabled && !paused && state.selected.size > 0;
  if (prefs) categoryStateCache.set(prefs, state);
  return state;
}

export function failsCategoryFilter(prefs, row) {
  const state = getCategoryFilterState(prefs);
  if (!state.active) return false;
  const category = getRowCategory(row);
  if (!category) return false;
  return !categoryIsSelected(state.selected, category);
}
