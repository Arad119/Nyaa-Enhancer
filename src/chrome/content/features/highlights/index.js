import { loadStoredPreferences } from "../../../shared/prefs.js";
import { getTitleFromRow, isNyaaTorrentDataRow } from "../../internal.js";

// ── Custom keyword row highlighting ─────────────────────────────────────────

export const NE_KW_HIGHLIGHT_CLASS = "ne-kw-highlight";
export const NE_PRIORITIZE_SEADEX_CLASS = "ne-prioritize-seadex";
export const NE_DEFAULT_HIGHLIGHT_COLOR = "#8e44ad";

export function normalizeHighlightColor(color) {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function getHighlightRules(prefs) {
  const list = Array.isArray(prefs?.highlightKeywords)
    ? prefs.highlightKeywords
    : [];
  return list
    .map((item) => {
      const keyword =
        typeof item?.keyword === "string" ? item.keyword.trim() : "";
      const color = normalizeHighlightColor(item?.color);
      if (!keyword || !color) return null;
      return { keyword, color };
    })
    .filter(Boolean);
}

export function findMatchingHighlightRule(title, rules) {
  if (!title || !rules.length) return null;
  const lower = title.toLowerCase();
  let best = null;
  for (const rule of rules) {
    const kw = rule.keyword.toLowerCase();
    if (!kw || !lower.includes(kw)) continue;
    if (!best || kw.length > best.keyword.length) best = rule;
  }
  return best;
}

export function clearKeywordHighlightOnRow(row) {
  row.classList.remove(NE_KW_HIGHLIGHT_CLASS);
  row.style.removeProperty("--ne-kw-color");
  row.style.removeProperty("--ne-kw-bg");
  row.style.removeProperty("--ne-kw-bg-hover");
}

export function applyKeywordHighlightToRow(row, rules) {
  if (!isNyaaTorrentDataRow(row)) return;
  const match = findMatchingHighlightRule(getTitleFromRow(row), rules);
  if (!match) {
    clearKeywordHighlightOnRow(row);
    return;
  }
  row.classList.add(NE_KW_HIGHLIGHT_CLASS);
  row.style.setProperty("--ne-kw-color", match.color);
  row.style.setProperty("--ne-kw-bg", hexToRgba(match.color, 0.22));
  row.style.setProperty("--ne-kw-bg-hover", hexToRgba(match.color, 0.34));
}

export function setSeaDexPriorityOnTables(enabled) {
  document.querySelectorAll("table.torrent-list").forEach((table) => {
    table.classList.toggle(NE_PRIORITIZE_SEADEX_CLASS, !!enabled);
  });
}

export function applyKeywordHighlights(targetRows = null, prefs = null) {
  const run = (resolvedPrefs) => {
    setSeaDexPriorityOnTables(resolvedPrefs.prioritizeSeaDexHighlights);
    const rules = getHighlightRules(resolvedPrefs);
    const rows = targetRows
      ? Array.from(targetRows)
      : Array.from(document.querySelectorAll("table.torrent-list tbody tr"));
    rows.forEach((row) => applyKeywordHighlightToRow(row, rules));
  };

  if (prefs) {
    run(prefs);
    return Promise.resolve();
  }
  return loadStoredPreferences().then(run);
}

export async function initializeKeywordHighlights() {
  if (!document.querySelector("table.torrent-list")) return;
  await applyKeywordHighlights();
}
