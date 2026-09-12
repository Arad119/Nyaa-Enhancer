import { uniqueCards } from "./recs.js";

export const VIBE_MAX = 16;
export const SKIP_SEED_GENRES = new Set(["Award Winning", "Adult Cast"]);
export const SKIP_SEED_GENRE_IDS = new Set([46]);
export const VIBE_ANILIST_MIN = 12;

const MAL_GENRE_IDS_BY_NAME = {
  action: 1,
  adventure: 2,
  comedy: 4,
  drama: 8,
  ecchi: 9,
  fantasy: 10,
  horror: 14,
  mecha: 18,
  music: 19,
  mystery: 7,
  romance: 22,
  "sci-fi": 24,
  "slice of life": 36,
  sports: 30,
  supernatural: 37,
  thriller: 41,
  suspense: 41,
  gourmet: 47,
  "boys love": 28,
  "girls love": 26,
  "avant garde": 5,
  "mahou shoujo": 66,
  "magical girl": 66,
  psychological: 40,
};

function clampPct(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getVibeWeights(prefs = {}) {
  return {
    genre: clampPct(prefs.similarVibeGenreWeight, 34),
    tags: clampPct(prefs.similarVibeTagWeight, 33),
    studio: clampPct(prefs.similarVibeStudioWeight, 33),
  };
}

export function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueNames(list) {
  const seen = new Set();
  const result = [];
  for (const value of list || []) {
    const name = String(value || "").trim();
    const key = normalizeName(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function uniqueIds(list) {
  const seen = new Set();
  const result = [];
  for (const value of list || []) {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function namesFromMalEntities(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => (typeof item === "string" ? item : item?.name)).filter(Boolean);
}

export function anilistTagNames(media) {
  return (media?.tags || [])
    .filter((tag) => tag?.name && !tag.isMediaSpoiler && (tag.rank || 0) >= 50)
    .slice(0, 10)
    .map((tag) => tag.name);
}

export function genreIdsFromNames(names) {
  return uniqueIds(
    (names || [])
      .map((name) => MAL_GENRE_IDS_BY_NAME[normalizeName(name)])
      .filter(Boolean),
  ).filter((id) => !SKIP_SEED_GENRE_IDS.has(id));
}

function emptySourceVibe() {
  return {
    genres: [],
    tags: [],
    studios: [],
    genreIds: [],
    themeIds: [],
    studioIds: [],
  };
}

export function sourceVibeFromAnilist(media) {
  if (!media) return null;
  const genres = uniqueNames(media.genres || []);
  return {
    genres,
    tags: uniqueNames(anilistTagNames(media)),
    studios: uniqueNames((media.studios?.nodes || []).map((node) => node.name)),
    genreIds: genreIdsFromNames(genres),
    themeIds: [],
    studioIds: [],
  };
}

export function sourceVibeFromTenrai(full) {
  if (!full) return null;
  const genres = uniqueNames(namesFromMalEntities(full.genres));
  const tags = uniqueNames([
    ...namesFromMalEntities(full.themes),
    ...namesFromMalEntities(full.demographics),
  ]);
  return {
    genres,
    tags,
    studios: uniqueNames(namesFromMalEntities(full.studios)),
    genreIds: uniqueIds((full.genres || []).map((item) => item.mal_id)).filter(
      (id) => !SKIP_SEED_GENRE_IDS.has(id),
    ),
    themeIds: uniqueIds((full.themes || []).map((item) => item.mal_id)),
    studioIds: uniqueIds((full.studios || []).map((item) => item.mal_id)),
  };
}

export function mergeSourceVibe(left, right) {
  if (!left && !right) return null;
  const a = left || emptySourceVibe();
  const b = right || emptySourceVibe();
  const genres = uniqueNames([...(a.genres || []), ...(b.genres || [])]);
  return {
    genres,
    tags: uniqueNames([...(a.tags || []), ...(b.tags || [])]),
    studios: uniqueNames([...(a.studios || []), ...(b.studios || [])]),
    genreIds: uniqueIds([
      ...(a.genreIds || []),
      ...(b.genreIds || []),
      ...genreIdsFromNames(genres),
    ]).filter((id) => !SKIP_SEED_GENRE_IDS.has(id)),
    themeIds: uniqueIds([...(a.themeIds || []), ...(b.themeIds || [])]),
    studioIds: uniqueIds([...(a.studioIds || []), ...(b.studioIds || [])]),
  };
}

export function pickProducerId(rows, studioName) {
  const want = normalizeName(studioName);
  if (!want || !rows?.length) return null;
  const named = (rows || []).map((row) => ({
    id: Number(row?.mal_id),
    names: [row?.name, ...(row?.titles || []).map((title) => title?.title)]
      .map(normalizeName)
      .filter(Boolean),
    count: Number(row?.count) || 0,
  })).filter((row) => Number.isFinite(row.id) && row.id > 0 && row.names.length);

  const exact = named.filter((row) => row.names.includes(want));
  const partial = named.filter((row) =>
    row.names.some((name) => name.includes(want) || want.includes(name)),
  );
  const pool = (exact.length ? exact : partial).sort((a, b) => b.count - a.count || a.id - b.id);
  return pool[0]?.id || null;
}

export function seedGenre(source) {
  return (
    (source?.genres || []).find((genre) => !SKIP_SEED_GENRES.has(genre)) ||
    source?.genres?.[0] ||
    ""
  );
}

function tenraiSearchPath(param, id) {
  return `/anime?${param}=${id}&limit=25&sfw&order_by=members&sort=desc`;
}

export function tenraiVibeSearchPaths(source, weights, maxQueries = 3) {
  if (!source || maxQueries <= 0) return [];
  const dimensions = [
    {
      weight: Number(weights?.genre) || 0,
      ids: uniqueIds(source.genreIds).filter((id) => !SKIP_SEED_GENRE_IDS.has(id)),
      param: "genres",
    },
    {
      weight: Number(weights?.tags) || 0,
      ids: uniqueIds(source.themeIds),
      param: "genres",
    },
    {
      weight: Number(weights?.studio) || 0,
      ids: uniqueIds(source.studioIds),
      param: "producers",
    },
  ]
    .filter((dim) => dim.weight > 0 && dim.ids.length)
    .sort((a, b) => b.weight - a.weight || b.ids.length - a.ids.length);

  const paths = [];
  const seen = new Set();
  let round = 0;
  while (paths.length < maxQueries && round < 6) {
    let added = false;
    for (const dim of dimensions) {
      if (paths.length >= maxQueries) break;
      const id = dim.ids[round];
      if (!id) continue;
      const path = tenraiSearchPath(dim.param, id);
      if (seen.has(path)) continue;
      seen.add(path);
      paths.push(path);
      added = true;
    }
    if (!added) break;
    round += 1;
  }
  return paths;
}

function overlapRatio(sourceList, candidateList) {
  const source = [...new Set((sourceList || []).map(normalizeName).filter(Boolean))];
  if (!source.length) return 0;
  const candidate = new Set((candidateList || []).map(normalizeName));
  const hits = source.filter((name) => candidate.has(name));
  return hits.length / source.length;
}

function sharedLabels(sourceList, candidateList, limit = 3) {
  const candidate = new Set((candidateList || []).map(normalizeName));
  return (sourceList || [])
    .filter((name) => candidate.has(normalizeName(name)))
    .slice(0, limit);
}

export function scoreVibeCards(pool, source, weights, excludeIds = new Set()) {
  const sum = (weights?.genre || 0) + (weights?.tags || 0) + (weights?.studio || 0);
  if (!sum || !source || !pool?.length) return [];

  const scored = [];
  for (const card of pool) {
    const idKey = String(card.malId || card.alId || "");
    if (idKey && excludeIds.has(idKey)) continue;
    const genreScore = overlapRatio(source.genres, card.genres);
    const tagScore = overlapRatio(source.tags, card.tags);
    const studioScore = overlapRatio(source.studios, card.studios) > 0 ? 1 : 0;
    const vibe =
      (weights.genre * genreScore +
        weights.tags * tagScore +
        weights.studio * studioScore) /
      sum;
    if (vibe < 0.12) continue;
    const bits = [
      ...(weights.genre > 0 ? sharedLabels(source.genres, card.genres, 2) : []),
      ...(weights.tags > 0 ? sharedLabels(source.tags, card.tags, 1) : []),
      ...(weights.studio > 0 ? sharedLabels(source.studios, card.studios, 1) : []),
    ];
    scored.push({
      ...card,
      reason: bits.length ? bits.join(" · ") : "Same vibe",
      vibeScore: vibe,
    });
  }

  scored.sort((a, b) => {
    const vibeDelta = (b.vibeScore || 0) - (a.vibeScore || 0);
    if (Math.abs(vibeDelta) > 0.02) return vibeDelta;
    return (b.popularity || 0) - (a.popularity || 0);
  });
  return uniqueCards(scored).slice(0, VIBE_MAX);
}
