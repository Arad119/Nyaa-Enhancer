function decodeHtmlText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripAnimetoshoSeriesYear(title) {
  return decodeHtmlText(title).replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function seriesFromAnimetoshoJson(series) {
  if (!series || typeof series !== "object") return null;
  const title = decodeHtmlText(series.title);
  const anidbAid = positiveInt(series.anidb_aid);
  if (!title && !anidbAid) return null;
  return {
    title,
    fullTitle: "",
    displayTitle: title,
    anidbAid,
    season: positiveInt(series.tvdb_season),
  };
}

export function seriesFromAnimetoshoOrgJson(json) {
  if (!json || typeof json !== "object" || json.error) return null;
  const title = decodeHtmlText(json.anidb_title || json.anime || "");
  const anidbAid = positiveInt(json.aid || json.anidb_id);
  if (!title && !anidbAid) return null;
  return {
    title,
    fullTitle: title,
    displayTitle: title,
    anidbAid,
    season: null,
  };
}

export function seriesFromAnimetoshoHtml(html) {
  const text = String(html || "");
  const seriesLink = text.match(
    /<a[^>]+href=["'][^"']*\/series\/(\d+)[^"']*["'][^>]*>([^<]+)<\/a>/i,
  );
  const anidbLink =
    seriesLink ||
    text.match(
      /<a[^>]+href=["'][^"']*anidb\.net\/(?:anime\/|a)(\d+)[^"']*["'][^>]*>([^<]+)<\/a>/i,
    );
  if (!anidbLink) return null;
  const displayTitle = decodeHtmlText(anidbLink[2]);
  const fullTitle = stripAnimetoshoSeriesYear(displayTitle);
  if (!displayTitle && !anidbLink[1]) return null;
  return {
    title: "",
    fullTitle,
    displayTitle,
    anidbAid: positiveInt(anidbLink[1]),
    season: null,
  };
}

export function mergeAnimetoshoSeries(...parts) {
  const merged = {
    title: "",
    fullTitle: "",
    displayTitle: "",
    anidbAid: null,
    season: null,
  };
  for (const part of parts) {
    if (!part) continue;
    if (part.title) merged.title = part.title;
    if (part.fullTitle) merged.fullTitle = part.fullTitle;
    if (part.displayTitle) merged.displayTitle = part.displayTitle;
    if (part.anidbAid) merged.anidbAid = part.anidbAid;
    if (part.season) merged.season = part.season;
  }
  if (!merged.displayTitle) {
    merged.displayTitle = merged.fullTitle || merged.title;
  }
  if (!merged.fullTitle) {
    merged.fullTitle = stripAnimetoshoSeriesYear(merged.displayTitle);
  }
  if (!merged.title) merged.title = merged.fullTitle;
  if (!merged.title && !merged.anidbAid) return null;
  return merged;
}
