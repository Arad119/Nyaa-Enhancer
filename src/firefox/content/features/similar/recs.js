export const REC_VOTE_FLOOR = 5;
export const REC_MAX = 12;

export function uniqueCards(cards) {
  const seen = new Set();
  const result = [];
  for (const card of cards) {
    if (!card) continue;
    const key = card.malId || card.alId || card.tmdbId || card.searchTitle;
    if (!key || seen.has(String(key))) continue;
    seen.add(String(key));
    result.push(card);
  }
  return result;
}

function mergeSources(left, right) {
  const sources = [];
  for (const source of [...(left || []), ...(right || [])]) {
    if (source && !sources.includes(source)) sources.push(source);
  }
  return sources;
}

export function recommendedMeta(card) {
  if (card?.tmdbId) {
    return card.reason === "Similar" ? "TMDB similar" : "TMDB recommended";
  }
  const sources = card?.sources || [];
  const hasMal = sources.includes("mal");
  const hasAl = sources.includes("anilist");
  if (hasMal && hasAl) return "MAL + AniList";
  if (hasMal) return "MyAnimeList";
  if (hasAl) return "AniList";
  return "Community pick";
}

export function mergeRecommendedCards(cards) {
  const list = [];
  const byMal = new Map();
  const byAl = new Map();

  for (const card of cards || []) {
    if (!card) continue;
    const malKey = card.malId != null && card.malId !== "" ? Number(card.malId) : NaN;
    const alKey = card.alId != null && card.alId !== "" ? Number(card.alId) : NaN;
    let existing =
      (Number.isFinite(malKey) && byMal.get(malKey)) ||
      (Number.isFinite(alKey) && byAl.get(alKey));

    if (!existing) {
      existing = {
        ...card,
        votes: Number(card.votes) || 0,
        sources: [...(card.sources || [])],
      };
      list.push(existing);
    } else {
      existing.votes = (existing.votes || 0) + (Number(card.votes) || 0);
      existing.sources = mergeSources(existing.sources, card.sources);
      if (card.cover && (!existing.cover || card.alId)) {
        existing.cover = card.cover;
      }
      if (card.alId && card.title) {
        existing.title = card.title;
        existing.searchTitle = card.searchTitle || existing.searchTitle;
      } else if (!existing.searchTitle && card.searchTitle) {
        existing.searchTitle = card.searchTitle;
      }
      existing.malId = existing.malId ?? card.malId;
      existing.alId = existing.alId ?? card.alId;
    }

    if (existing.malId != null && existing.malId !== "") {
      byMal.set(Number(existing.malId), existing);
    }
    if (existing.alId != null && existing.alId !== "") {
      byAl.set(Number(existing.alId), existing);
    }
  }

  return list;
}

export function filterRecommended(cards) {
  const sorted = [...cards].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const strong = sorted.filter((card) => (card.votes || 0) >= REC_VOTE_FLOOR);
  return (strong.length >= 4
    ? strong
    : sorted.filter((card) => (card.votes || 0) >= 2)
  ).slice(0, REC_MAX);
}

export function mergeTmdbCards(recommended, similar) {
  const seen = new Set();
  const result = [];
  for (const card of [...(recommended || []), ...(similar || [])]) {
    if (!card?.tmdbId || seen.has(Number(card.tmdbId))) continue;
    seen.add(Number(card.tmdbId));
    result.push(card);
    if (result.length >= REC_MAX) break;
  }
  return result;
}
