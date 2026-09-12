export function positiveAnimeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function imdbIdFromMapping(value) {
  const id = String(value || "").trim();
  return /^tt\d+$/i.test(id) ? id : null;
}

export function slugFromMapping(value) {
  const slug = String(value || "").trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) ? slug : null;
}

export function tmdbTypeFromMapping(value) {
  return String(value || "").toLowerCase() === "movie" ? "movie" : "tv";
}

export function traktTypeFromMapping(value) {
  const type = String(value || "").toLowerCase();
  return type === "movie" || type === "movies" ? "movies" : "shows";
}

export function mappingFromAnimeApi(data) {
  if (!data || typeof data !== "object") return null;
  return {
    fetchedAt: Date.now(),
    tmdbId: positiveAnimeId(data.themoviedb),
    tmdbType: tmdbTypeFromMapping(data.themoviedb_type),
    malId: positiveAnimeId(data.myanimelist),
    alId: positiveAnimeId(data.anilist),
    anidbId: positiveAnimeId(data.anidb),
    imdbId: imdbIdFromMapping(data.imdb),
    tvdbId: positiveAnimeId(data.thetvdb),
    traktId: positiveAnimeId(data.trakt),
    traktSlug: slugFromMapping(data.trakt_slug),
    traktType: traktTypeFromMapping(data.trakt_type),
  };
}

export function applyExternalIdsToMatch(match, mapping) {
  if (!match || !mapping) return match;
  if (mapping.malId && !match.malId) match.malId = mapping.malId;
  if (mapping.alId && !match.alId) match.alId = mapping.alId;
  if (mapping.anidbId) match.anidbId = mapping.anidbId;
  if (mapping.imdbId) match.imdbId = mapping.imdbId;
  if (mapping.tmdbId) {
    match.tmdbId = mapping.tmdbId;
    match.tmdbType = mapping.tmdbType || "tv";
  }
  if (mapping.tvdbId) match.tvdbId = mapping.tvdbId;
  if (mapping.traktId) match.traktId = mapping.traktId;
  if (mapping.traktSlug) match.traktSlug = mapping.traktSlug;
  if (mapping.traktType) match.traktType = mapping.traktType;
  return match;
}

function traktHref(match) {
  const type = traktTypeFromMapping(match?.traktType);
  const slug = slugFromMapping(match?.traktSlug);
  if (slug) return `https://trakt.tv/${type}/${encodeURIComponent(slug)}`;
  const id = positiveAnimeId(match?.traktId);
  if (id) return `https://trakt.tv/${type}/${id}`;
  return null;
}

export function matchExternalLinks(match) {
  const links = [];
  const alId = positiveAnimeId(match?.alId);
  const malId = positiveAnimeId(match?.malId);
  const anidbId = positiveAnimeId(match?.anidbId);
  const imdbId = imdbIdFromMapping(match?.imdbId);
  const tmdbId = positiveAnimeId(match?.tmdbId);
  const tvdbId = positiveAnimeId(match?.tvdbId);
  const traktUrl = traktHref(match);

  if (alId) {
    links.push({
      label: "AniList",
      href: `https://anilist.co/anime/${alId}`,
    });
  }
  if (malId) {
    links.push({
      label: "MAL",
      href: `https://myanimelist.net/anime/${malId}`,
    });
  }
  if (anidbId) {
    links.push({
      label: "AniDB",
      href: `https://anidb.net/anime/${anidbId}`,
    });
  }
  if (imdbId) {
    links.push({
      label: "IMDb",
      href: `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`,
    });
  }
  if (tmdbId) {
    const type = tmdbTypeFromMapping(match?.tmdbType);
    links.push({
      label: "TMDB",
      href: `https://www.themoviedb.org/${type}/${tmdbId}`,
    });
  }
  if (tvdbId) {
    const kind = tmdbTypeFromMapping(match?.tmdbType) === "movie" ? "movie" : "series";
    links.push({
      label: "TVDB",
      href: `https://thetvdb.com/dereferrer/${kind}/${tvdbId}`,
    });
  }
  if (traktUrl) {
    links.push({ label: "Trakt", href: traktUrl });
  }
  return links;
}
