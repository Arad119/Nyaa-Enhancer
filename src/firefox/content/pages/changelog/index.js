import { getPreferences, loadStoredPreferences, savePreferences } from "../../../shared/prefs.js";
import { delay } from "../../internal.js";

export async function showChangelog() {
  // Get current version from manifest
  const manifest = browser.runtime.getManifest();
  const currentVersion = manifest.version;

  // Get stored version and dismissed states
  const { lastVersion, changelogDismissed, tempDismissed } =
    await getPreferences([
      "lastVersion",
      "changelogDismissed",
      "tempDismissed",
    ]);

  // Reset tempDismissed if version is different
  if (currentVersion !== lastVersion) {
    await savePreferences({ tempDismissed: false });
  }

  // Show if:
  // 1. Version is different and not permanently dismissed OR
  // 2. Same version but not temporarily or permanently dismissed
  if (
    (currentVersion !== lastVersion && !changelogDismissed) ||
    (currentVersion === lastVersion && !tempDismissed && !changelogDismissed)
  ) {
    const container = document.createElement("div");
    container.className = "changelog-container";
    container.innerHTML = `
      <div class="changelog-header">
        <span class="changelog-title">What's New</span>
        <span class="changelog-version">v${currentVersion}</span>
      </div>
      <div class="changelog-content">
        • Added Similar Anime tab on torrent view pages: related, recommended, and same-vibe titles<br>
        • Added a minimum seeders filter in the Filters panel<br>
        • Added click-to-copy for the torrent title and info hash on view pages
        <div class="changelog-more">Plus more. <a href="/changelog">See the full changelog</a> for everything that's new.</div>
      </div>
      <div class="changelog-actions">
        <button class="changelog-button okay">Okay</button>
        <button class="changelog-button dont-show">Don't show again</button>
      </div>
      <div class="changelog-footer">
        <a href="/changelog" style="color: #337ab7; text-decoration: underline; font-size: 14px;">View changelog page</a>
      </div>
    `;

    document.body.appendChild(container);

    // Handle "Don't show again" button - permanent dismissal
    container
      .querySelector(".changelog-button.dont-show")
      .addEventListener("click", async () => {
        await savePreferences({
          lastVersion: currentVersion,
          changelogDismissed: true,
        });
        container.classList.add("hiding");
        setTimeout(() => container.remove(), 300);
      });

    // Handle "Okay" button - temporary dismissal until next version
    container
      .querySelector(".changelog-button.okay")
      .addEventListener("click", async () => {
        await savePreferences({
          lastVersion: currentVersion,
          tempDismissed: true,
        });
        container.classList.add("hiding");
        setTimeout(() => container.remove(), 300);
      });

    // Store new version
    await savePreferences({ lastVersion: currentVersion });
  }
}

export async function handleChangelogPage() {
  // Only run on the changelog page
  if (window.location.pathname !== "/changelog") return;

  // Get the main container element (where the 404 message is)
  const mainContainer = document.querySelector(".container h1")?.parentElement;
  if (!mainContainer) return;

  // Update page title
  document.title = "Changelog :: Nyaa";

  // Clear the 404 content
  mainContainer.innerHTML = "";

  // Add changelog content
  const changelogContent = document.createElement("div");
  changelogContent.className = "changelog-page";
  changelogContent.innerHTML = `
    <h1>Nyaa Enhancer Changelog</h1>
    <div class="changelog-repo">
      <p>This is an open source project. View the source code and contribute on 
        <a href="https://github.com/Arad119/Nyaa-Enhancer" target="_blank" class="repo-link">
          <i class="fa fa-github"></i> GitHub
        </a>
      </p>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.14.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.14.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Similar Anime tab on torrent view pages: related, recommended, and same-vibe titles</li>
        <li>Added a minimum seeders filter in the Filters panel</li>
        <li>Added click-to-copy for the torrent title and info hash on view pages</li>
        <li>Added a search box on the Settings page to jump to any option</li>
        <li>Added a header checkbox to select or deselect all visible torrents</li>
        <li>Show a toast if settings fail to save</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.13.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.13.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added custom keyword highlighting: color torrent-list rows from Settings → Highlights, with an option to keep SeaDex colors on top</li>
        <li>Fixed issue where Firefox version had missing permissions to access the TMDB API and TheXEM</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.13.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.13.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a dedicated Settings page on Nyaa (/settings, also in the navbar). Most toggles, monitoring, and qBittorrent category/tag management live there; the extension popup now only holds torrent client connection details and API keys (ameNZB, TMDB)</li>
        <li>Added an on-page Filters panel above the torrent table for dead torrents, keyword hiding, file size, and completed downloads</li>
        <li>Replaced the preset file-size dropdown with a min/max range slider (and matching units)</li>
        <li>Added a Show more button under torrent lists to load the next page in place, skipping pages that are fully hidden by filters</li>
        <li>Added Send Selected and Send All toolbar buttons to batch-send torrents to the configured client</li>
        <li>Redesigned the list toolbar into grouped Copy / Download / Send actions, with tighter layout on smaller screens</li>
        <li>Reworked Quick Search: cleaner UI, optional file-size range, TMDB title autocomplete with TheXEM aliases (requires a TMDB API key in the popup), and a “Remember selection” option</li>
        <li>API keys, credentials, keywords, and monitoring lists now persist in local storage so they are not synced to browser account for security reasons</li>
        <li>Fixed AnimeTosho screenshots still using the old domain when the new domain toggle was on, and placeholder styling for categories without AT links</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.12.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.12.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added qBittorrent category and tag support when sending torrents, configure defaults in settings or pick per torrent via the "Prompt on Send" popup</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.12.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.12.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where the "Filter completed downloads" option did not apply on user profile pages</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.12.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.12.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added tabbed panels on torrent view pages - Description plus optional ameNZB, nekoBT, Tsukihime, and AnimeTosho tabs</li>
        <li>Added "Improved File List" toggle to show total and per-folder file counts on view pages (Enabled by default)</li>
        <li>Added "Completed downloads" as a filter option</li>
        <li>Improved AnimeTosho list and view links - resolved by using info hash for English-translated, Non-English-translated, and Raw anime</li>
        <li>Added "Show Screenshots Section", "Show FileInfo Section", and "Show Attachments Section" toggles from AnimeTosho data</li>
        <li>Added "Display ameNZB Section" toggle for release details in the description tabs - requires an ameNZB API key (Disabled by default)</li>
        <li>Added "Display nekoBT Section" toggle for release metadata in the description tabs, plus "Full Language Names" for audio/subtitle labels (Disabled by default)</li>
        <li>Added a Tsukihime settings section with "Display Tsukihime Links" and "Display Tsukihime Section" toggles for view-page links and tabbed metadata, synopsis, genres, files, and per-file MediaInfo (Disabled by default)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.11.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.11.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a dedicated "Torrent Client" tab with support for qBittorrent, Transmission, and Deluge - required to use the "Send" button</li>
        <li>Added a "Send" button to torrent view pages and the main torrent list, sending the torrent directly to your configured client - needs a Torrent Client to be configured first in the extension settings</li>
        <li>Added a "Display Best Release (Seadex)" toggle in Additional Features to highlight best and alternate releases on torrent list and view pages according to SeaDex (Disabled by default)</li>
        <li>Added "Screenshot Preview" toggle to the Additional Features section - hovering over a torrent link for the set delay opens a floating image popup that cycles through screenshots from the torrent's description (Disabled by default)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.10.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.10.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a dedicated AnimeTosho settings section with a "New AnimeTosho Domain" toggle to switch links between animetosho.org and animetosho.xyz (Enabled by default due to old one being deprecated)</li>
        <li>Added "Show AnimeTosho Comments" toggle to display AnimeTosho comments on supported English-translated anime view pages</li>
        <li>Added a ameNZB settings section with API key management (API Key required for it to work)</li>
        <li>Added "Display ameNZB Links" toggle to show ameNZB release links on supported view pages</li>
        <li>Added a nekoBT settings section with a "Display nekoBT Links" toggle to show nekoBT links on supported view pages</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.9.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.9.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added "Last 30 Days" date filter to Quick Search to show only recent uploads</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.9.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.9.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a Keyword Monitoring system to track new uploads that has specific keywords</li>
        <li>Added a Show Monitor Buttons setting to control visibility of monitor buttons</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.8.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.8.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed sidebar layout to maintain consistent height during state changes</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.8.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.8.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added a User Monitoring system to track new uploads from your favorite contributors</li>
        <li>Monitor button on user pages lets you track when they upload new torrents</li>
        <li>Notification sidebar with updates appears on the left edge of the screen</li>
        <li>Enhanced Monitored Users tab in the extension popup for easy management</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.7.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.7.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where forward slash (/) in filenames would create unwanted subfolders in ZIP downloads</li>
        <li>Fixed potential download issues if some torrent names would have Windows-incompatible characters (like :, *, ?, ", etc.)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.7.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.7.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where the selection counter wasn't updating when using the "Invert Selection" button</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.7.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.7.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added clear explanation of what the keyword filter does</li>
        <li>Added a Keyword Select button to quickly select all torrents with a specific keyword</li>
        <li>Added changelog page to easily see what's new in each version</li>
        <li>Fixed bug where filter-related notifications did not respect the Show Notifications setting</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>
        Version 1.6.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.6.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Fixed bug where disabling "Show Button Controls" didn't properly remove checkbox columns</li>
        <li>Fixed bug where re-enabling "Show Button Controls" caused duplicate AT and Magnet columns</li>
      </ul>
    </div>
      <div class="version-entry">
      <h2>
        Version 1.6.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.6.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added organized categories in settings menu for easier navigation</li>
        <li>Added new filtering options:</li>
        <ul>
          <li>Hide dead torrents (0 Seeders & 0 Leechers)</li>
          <li>Filter torrents by keywords</li>
          <li>Filter torrents by file size</li>
        </ul>
        <li>Added new view page features:</li>
        <ul>
          <li>Copy Magnet button on torrent pages</li>
          <li>Option to hide comments</li>
        </ul>
        <li>Removed support for nyaa.eu domain due to compatibility issues</li>
        <li>Renamed Quick Filter to Quick Search</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.5.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.5.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Quick Filter feature to easily search for specific anime, encoders, quality, format, and source</li>
        <li>Added Invert Selection button</li>
        <li>Added ability to select everything in between two checkboxes (Shift+Click)</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.4.2
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.4.2" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Removed unnecessary downloads permission to improve security and privacy</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.4.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.4.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added rate limiting (500ms delay) between torrent downloads when using ZIP option to prevent HTTP 429 errors (Too Many Requests sent in a given amount of time)</li>
        <li>Fixed bug where torrent files would incorrectly use comment count as filename</li>
        <li>Fixed bug where not all torrent files would get downloaded when using ZIP option</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.4.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.4.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Animetosho links column for supported torrents (English-translated anime)</li>
        <li>Added Animetosho link to view page for supported torrents</li>
        <li>Added magnet copy buttons column with one-click copying</li>
        <li>Added toggles for all features in extension popup</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.3.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.3.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added badge indicator for supported sites</li>
        <li>Moved toggles to the extension popup</li>
        <li>Added changelog notification</li>
        <li>Added changelog toggle in popup settings</li>
        <li>Adjusted styling</li>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.2.1
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.2.1" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Added Torrent File Downloads:</li>
        <ul>
          <li>Download selected .torrent files directly</li>
          <li>Batch download all torrents on the page</li>
          <li>Combine multiple downloads into a single ZIP file</li>
          <li>Track download progress with visual notifications</li>
        </ul>
        <li>Added Customization Options:</li>
        <ul>
          <li>Choose between original or display names for downloaded torrent files</li>
          <li>Toggle between individual or ZIP downloads</li>
        </ul>
      </ul>
    </div>
    <div class="version-entry">
      <h2>Version 1.0.0
        <a href="https://github.com/Arad119/Nyaa-Enhancer/releases/tag/v1.0.0" target="_blank" class="version-link">
          <i class="fa fa-github"></i> View Release
        </a>
      </h2>
      <ul>
        <li>Adds checkboxes next to each torrent entry</li>
        <li>"Copy Selected" button to copy only checked magnet links.</li>
        <li>"Copy All" button to copy all magnet links on the page</li>
        <li>"Clear Selection" button to uncheck all boxes</li>
        <li>Selection counter showing number of selected items</li>
        <li>Toast notifications for user feedback</li>
        <li>Support for multiple Nyaa mirror domains</li>
      </ul>
    </div>
  `;

  mainContainer.appendChild(changelogContent);
}

export async function addChangelogNavItem() {
  const prefs = await loadStoredPreferences();
  if (!prefs.showChangelogNav) return;

  const navList = document.querySelector(".nav.navbar-nav");
  if (!navList) return;

  const existing = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "Changelog",
  );
  if (existing) return;

  const rssItem = Array.from(navList.querySelectorAll("li")).find(
    (li) => li.textContent.trim() === "RSS",
  );

  if (rssItem) {
    const changelogItem = document.createElement("li");
    const changelogLink = document.createElement("a");
    changelogLink.href = "/changelog";
    changelogLink.textContent = "Changelog";
    changelogItem.appendChild(changelogLink);

    rssItem.insertAdjacentElement("afterend", changelogItem);
  }
}
