export function extractSeasonNumber(value) {
  const text = String(value || "").toLowerCase();
  const nth = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i);
  if (nth) return Number(nth[1]);
  const season = text.match(/\bseason\s*(\d{1,2})\b/i);
  if (season) return Number(season[1]);
  const sxx = text.match(/\bs(\d{1,2})(?:e\d{1,4})?\b/i);
  if (sxx) return Number(sxx[1]);
  return null;
}

export function seasonOrdinal(n) {
  const value = Number(n);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function normalizeTitleForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchQueriesFromAnimetoshoSeries(series) {
  if (!series) return [];
  const queries = [];
  const add = (value) => {
    const next = String(value || "").replace(/\s+/g, " ").trim();
    if (next.length >= 2 && !queries.includes(next)) queries.push(next);
  };

  add(series.fullTitle);
  add(series.title);

  const season = Number(series.season);
  if (season > 1) {
    const base = String(series.title || series.fullTitle || "")
      .replace(new RegExp(`\\s+${season}$`), "")
      .trim();
    if (base.length >= 2) add(`${base} ${seasonOrdinal(season)} Season`);
  }

  return queries.slice(0, 3);
}
