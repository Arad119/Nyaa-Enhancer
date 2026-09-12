export function getInfoHashFromMagnet(href) {
  if (!href) return "";
  const hexMatch = href.match(/urn:btih:([a-f0-9]{40})/i);
  if (hexMatch) return hexMatch[1].toLowerCase();
  const match = href.match(/urn:btih:([^&]+)/i);
  return match ? match[1].toLowerCase() : "";
}

export function getTorrentInfoHashFromRow(row) {
  const magnetLink = row.querySelector('a[href^="magnet:"]');
  return magnetLink ? getInfoHashFromMagnet(magnetLink.href) : "";
}

export function getTitleFromRow(row) {
  const titleCell = row.querySelector('td[colspan="2"]');
  if (!titleCell) return null;

  // Get the view link (this will always be the title link, not comments)
  // We specifically look for the last link in the cell to avoid the comment link
  const links = titleCell.querySelectorAll('a[href^="/view/"]');

  const titleLink = links[links.length - 1]; // Get the last view link (the actual title)

  return titleLink?.title || titleLink?.textContent || null;
}

export function isNyaaTorrentListPage() {
  const path = window.location.pathname;
  return path === "/" || path === "" || path.startsWith("/user/");
}

export function isNyaaTorrentDataRow(row) {
  return !!row?.querySelector?.('a[href^="magnet:"], a[href$=".torrent"]');
}

export function isTorrentRowHidden(row) {
  return !row || row.style.display === "none";
}

export function getVisibleTorrentDataRows() {
  return Array.from(
    document.querySelectorAll("table.torrent-list tbody tr"),
  ).filter((row) => isNyaaTorrentDataRow(row) && !isTorrentRowHidden(row));
}

export function getSelectedVisibleTorrentRows() {
  return getVisibleTorrentDataRows().filter((row) => {
    const checkbox = row.querySelector(".magnet-checkbox");
    return checkbox && checkbox.checked;
  });
}

export function getMagnetUrlFromRow(row) {
  return row.querySelector('a[href^="magnet:"]')?.href || "";
}

export function getVisibleMagnetUrls() {
  return getVisibleTorrentDataRows()
    .map(getMagnetUrlFromRow)
    .filter(Boolean);
}

export function getSelectedVisibleMagnetUrls() {
  return getSelectedVisibleTorrentRows()
    .map(getMagnetUrlFromRow)
    .filter(Boolean);
}

export function getTorrentIdFromRow(row) {
  const links = row.querySelectorAll('a[href*="/view/"]');
  for (const link of links) {
    const match = (link.getAttribute("href") || "").match(/\/view\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}

export function getCompletedDownloadsFromRow(row) {
  const cell = row.querySelector("td:nth-of-type(8)");
  if (!cell) return 0;
  return parseInt(cell.textContent.trim(), 10) || 0;
}

export function matchesCompletedDownloadsFilter(count, operator, threshold) {
  switch (operator) {
    case "eq":
      return count === threshold;
    case "lt":
      return count < threshold;
    case "gt":
    default:
      return count > threshold;
  }
}

export function failsCompletedDownloadsFilter(prefs, count) {
  if (!isNyaaTorrentListPage() || !prefs.completedDownloadsFilterEnabled) {
    return false;
  }
  const threshold = Number(prefs.completedDownloadsFilterValue);
  if (!Number.isFinite(threshold)) return false;
  return !matchesCompletedDownloadsFilter(
    count,
    prefs.completedDownloadsFilterOperator,
    threshold,
  );
}
