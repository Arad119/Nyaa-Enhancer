import { extractSeasonNumber, normalizeTitleForMatch } from "./title.js";

const SKIP_FORMATS = new Set(["MUSIC", "CM", "PV"]);

function significantTokens(value) {
  return String(value || "")
    .split(" ")
    .filter((token) => token.length > 2);
}

function stripSeasonTokens(normalized) {
  return String(normalized || "")
    .replace(/\b\d{1,2}(?:st|nd|rd|th) season\b/g, " ")
    .replace(/\bseason \d{1,2}\b/g, " ")
    .replace(/\bs\d{1,2}(?:e\d{1,4})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripEpisodeTokens(normalized) {
  return String(normalized || "")
    .replace(/\b(?:episode|ep)\.?\s*\d{1,4}(?:v\d+)?(?:\s*[-~]\s*\d{1,4})?\b/g, " ")
    .replace(/\be\d{2,4}(?:v\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coreTitle(value) {
  return stripEpisodeTokens(stripSeasonTokens(value));
}

function phraseMatchKind(titleCores, queryCore) {
  if (!queryCore) return null;
  if (titleCores.some((title) => title === queryCore)) return "exact";
  if (
    queryCore.length >= 4 &&
    titleCores.some(
      (title) => title.startsWith(`${queryCore} `) || title.startsWith(`${queryCore}:`),
    )
  ) {
    return "prefix";
  }
  if (
    queryCore.length >= 4 &&
    titleCores.some(
      (title) =>
        title.includes(` ${queryCore} `) ||
        title.endsWith(` ${queryCore}`),
    )
  ) {
    return "phrase";
  }
  if (queryCore.length >= 4 && titleCores.some((title) => title.includes(queryCore))) {
    return "contains";
  }
  return null;
}

function extraQueryTokens(queryCore, titleCores) {
  const queryTokens = significantTokens(queryCore);
  return queryTokens.filter(
    (token) => !titleCores.some((title) => title === token || title.includes(token)),
  );
}

function seasonDelta(query, titles, extra = {}) {
  const querySeason =
    extra.seasonHint > 1 ? extra.seasonHint : extractSeasonNumber(query);
  const titleSeason = titles.map(extractSeasonNumber).find((value) => value != null) || null;
  if (querySeason && querySeason > 1) {
    if (titleSeason === querySeason) return 24;
    if (titleSeason == null || titleSeason === 1) return -14;
    return -22;
  }
  if (!querySeason && titleSeason && titleSeason > 1) return -10;
  return 0;
}

export function scoreCandidate(entryTitles, query, extra = {}) {
  const normalizedQuery = normalizeTitleForMatch(query);
  if (!normalizedQuery) return 0;
  const normalizedTitles = entryTitles.map(normalizeTitleForMatch).filter(Boolean);
  if (!normalizedTitles.length) return 0;

  const queryCore = coreTitle(normalizedQuery);
  const titleCores = normalizedTitles.map(coreTitle).filter(Boolean);
  let score = 0;

  if (normalizedTitles.some((title) => title === normalizedQuery)) {
    score += 100;
  } else {
    const kind = phraseMatchKind(titleCores, queryCore);
    const containedTitle = normalizedTitles
      .concat(titleCores)
      .filter((title) => title.length >= 4 && normalizedQuery.includes(title))
      .sort((a, b) => b.length - a.length)[0];

    if (kind === "exact") score += 94;
    else if (kind === "prefix") score += 88;
    else if (kind === "phrase") score += 62;
    else if (containedTitle) {
      const extraTokens = extraQueryTokens(queryCore, [containedTitle, ...titleCores]);
      if (extraTokens.length) {
        score += Math.max(0, 10 - extraTokens.length * 8);
      } else {
        score += 70;
      }
    } else if (kind === "contains") score += 28;
    else {
      const overlap = significantTokens(queryCore).filter((token) =>
        titleCores.some((title) => title.includes(token)),
      ).length;
      const queryTokens = significantTokens(queryCore);
      if (queryTokens.length) {
        score += Math.round((overlap / queryTokens.length) * 24);
      }
    }
  }

  score += seasonDelta(query, normalizedTitles, extra);

  const format = String(extra.format || extra.type || "").toUpperCase();
  if (format === "TV") score += 10;
  else if (format === "MOVIE") score += 6;
  else if (format === "OVA" || format === "ONA" || format === "SPECIAL") score += 3;
  else if (SKIP_FORMATS.has(format) || format === "MUSIC") score -= 50;

  const status = String(extra.status || "").toLowerCase();
  if (status.includes("not yet aired") || status === "not_yet_released") score -= 18;

  const popularity = Number(extra.members || extra.popularity || 0);
  if (popularity > 0) score += Math.min(18, Math.log10(popularity + 1) * 4);
  return score;
}
