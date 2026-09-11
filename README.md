<div id="top"></div>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Chrome][chrome-shield]][chrome-shield-url]
[![Firefox][firefox-shield]][firefox-shield-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/Arad119/Nyaa-Enhancer">
    <img src="images/Logo.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Nyaa Enhancer</h3>

  <p align="center">
    A comprehensive browser extension that enhances Nyaa torrent sites with batch copy/download/send, on-page filtering, monitoring, torrent-client integration, and metadata from external websites (AnimeTosho, ameNZB, nekoBT, Tsukihime, and SeaDex).
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#features">Features</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#usage">Usage</a></li>
      </ul>
    </li>
    <li><a href="#acknowledgements">Acknowledgements</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

![Nyaa-Enhancer Screenshot][product-screenshot]

Nyaa Enhancer is a browser extension that turns Nyaa into a faster torrent workflow. It adds batch magnet copy, torrent download, and send-to-client actions, an on-page Filters panel, Quick Search, user and keyword monitoring, and optional metadata from AnimeTosho, ameNZB, nekoBT, Tsukihime, and SeaDex. Most options live on a Settings page in the Nyaa navbar; the extension popup is reserved for torrent-client connection details and API keys.

<p align="right">(<a href="#top">back to top</a>)</p>

### Built With

- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/reference/api) - Core extension functionality
- [JSZip](https://cdnjs.com/libraries/jszip) - ZIP file creation for batch downloads

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- FEATURES -->

### Features

![Nyaa-Enhancer Preview][product-preview]

**Torrent list toolbar:**

- Checkboxes next to each torrent, with Shift+click range selection
- Grouped **Copy** / **Download** / **Send** actions (selected and all visible)
- Invert and Clear selection, plus a live selection counter
- Per-row magnet copy and Send-to-client buttons
- Quick Search, Keyword Select, and Keyword Monitor buttons
- **Show more** under the table to load the next page in place (skips pages fully hidden by filters)
- Toast notifications with progress tracking for batch operations

**Filters panel (above the torrent table):**

- Hide dead torrents (0 seeders / leechers)
- Keyword hiding with a custom block list
- File size filter with a min/max range slider and unit selectors
- Completed-downloads threshold (greater than, equal to, or less than)

**Quick Search:**

- Search by title, encoder, quality, format, source, and category
- Dual Audio, Season Pack, Last 30 Days, and optional file-size range
- TMDB title autocomplete with TheXEM aliases (requires a TMDB API key in the popup)
- Optional “Remember selection” to restore the last search form

**Torrent view pages:**

- Magnet copy and Send-to-client on the view page
- Tabbed panels: Description plus optional AnimeTosho, ameNZB, nekoBT, and Tsukihime tabs
- AnimeTosho screenshots, FileInfo, downloads/attachments, and comments
- Improved file list with total and per-folder counts
- Optional comment hiding
- SeaDex best/alternate release highlighting
- Hover screenshot preview from the torrent description

**Torrent client integration:**

- Send torrents to **qBittorrent**, **Transmission**, or **Deluge**
- qBittorrent categories and tags, with defaults or a prompt on each send
- Batch Send Selected / Send All from the list toolbar

**Highlights:**

- Color torrent-list rows when the name contains a custom keyword or phrase
- Per-keyword color picker in Settings
- Optional toggle to keep SeaDex colors on top when both apply

**Monitoring:**

- Monitor uploaders from their user page
- Monitor keywords from the list toolbar or Settings
- Sidebar notifications on the left edge when new matching torrents appear

**Settings and changelog:**

- Dedicated **Settings** page at `/settings` (also in the Nyaa navbar)
- Extension popup for torrent-client URL/credentials and API keys
- Changelog page at `/changelog` with a dismissible What’s New popup
- Toggles sync across devices; API keys, credentials, and monitoring lists stay in local storage

**Supported Domains:**

- Supports multiple Nyaa mirror domains for maximum accessibility

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To install the extension in your browser, follow these steps.

### Installation

**Chrome Web Store (pending update, currently at 1.12.2):**  
<a href="https://chromewebstore.google.com/detail/nyaa-enhancer/donibkpnifppkihgmnoocogmmbbocpdd" target="_blank">
<img src="https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png" alt="Chrome Web Store" height="50px" >
</a>

**Firefox Add-Ons Store (up-to-date at 1.13.1):**  
<a href="https://addons.mozilla.org/en-US/firefox/addon/nyaa-enhancer/" target="_blank">
<img src="https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png" alt="Firefox Add-Ons Store" height="50px" >
</a>

**Edge Add-Ons Store (pending update, currently at 1.12.2):**  
<a href="https://microsoftedge.microsoft.com/addons/detail/nyaa-enhancer/cpkcppifogblfgbggdeljjnibjfcdakf" target="_blank">
<img src="https://developer.microsoft.com/store/badges/images/English_get-it-from-MS.png" alt="Edge Add-Ons Store" height="50px" >
</a>

**Download extension files locally (always up-to-date):**

Chrome/Any chromium based browser (Edge, Brave etc.):

1. Download the zipped files of the repo or clone the repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `src/chrome` directory

Firefox:

1. Download the zipped files of the repo or clone the repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Navigate to the `src/firefox` directory and select any file

### Usage

**List toolbar:**

1. Visit any supported Nyaa torrent site
2. Use the checkboxes to select torrents (Shift+click for range selection)
3. Use **Copy** / **All** to copy selected or all visible magnet links
4. Use **Download** / **All** to download selected or all visible `.torrent` files
5. Use **Send** / **All** to send selected or all visible torrents to your configured client
6. Use **Keywords** and enter a keyword to check matching torrents on the current page
7. Use Invert / Clear and the selection counter as needed
8. Use per-row magnet and Send buttons for a single torrent
9. Use **Show more** under the table to append the next page of results

![Nyaa-Enhancer Filters][product-filters]

**Filters:**

- Open the **Filters** panel above the table
- Hide dead torrents (0 seeders / leechers)
- Block torrents with keywords from a custom list
- Set a file-size range with the min/max slider
- Filter by completed downloads (greater than, equal to, or less than)

![Nyaa-Enhancer QuickSearch][product-quicksearch]

**Quick Search:**

- Build a query from title, encoder, quality, format, source, category, Dual Audio, Season Pack, Last 30 Days, and optional file size
- With a TMDB API key (set in the popup), titles autocomplete and TheXEM aliases can be included
- Enable **Remember selection** to keep the last form state


**Send to torrent client:**

1. Open the extension popup → **Torrent Client**
2. Choose qBittorrent, Transmission, or Deluge, enter the WebUI URL, and optional credentials
3. For qBittorrent, disable CSRF protection in the WebUI (Options → Web UI)
4. Click **Test Connection**, then **Save**. The first test asks the browser for permission to that host only
5. Enable **Show Send to Client button** on the Settings page if the Send buttons are hidden
6. For qBittorrent, manage categories/tags and “Prompt on Send” on the Settings page

**Monitoring:**

- On a user page, click **Monitor** to track that uploader
- Use **Keyword Monitor** on the torrent list, or add keywords on the Settings page
- New matches appear in the sidebar on the left edge of the screen

**Highlights:**

- Open Settings → **Highlights**, add a keyword or phrase, and pick a color
- Matching torrent names in list tables are tinted with that color
- Enable **Prioritize SeaDex highlights** if SeaDex colors should win when both apply

**View pages:**

- Copy magnet or Send to client from the view page
- Optional tabs and links for AnimeTosho (screenshots, FileInfo, downloads, comments), ameNZB, nekoBT, and Tsukihime
- SeaDex highlighting and hover screenshot preview when enabled

![Nyaa-Enhancer Settings][product-settings]

**Settings page** (`/settings`, also in the Nyaa navbar):

_Download:_

- **Use display name as filename**: use the torrent title instead of the original filename
- **Combine downloads as ZIP**: bundle multiple torrents into one ZIP

_Interface:_

- **Show button controls**: master toggle for the toolbar, checkboxes, and actions
- **Show Quick Search button**
- **Show Magnet Copy buttons**
- **Show Send to Client button** (requires a client configured in the popup)
- **Show Monitor buttons**

_Filters:_

- **Show filter notifications**: toast when torrents are hidden. Active filters themselves are set in the on-page Filters panel

_Torrent view page:_

- **Hide comments**
- **Improved file list**: total and per-folder file counts

_Monitoring:_

- Manage monitored users and keywords

_AnimeTosho:_

- **Show AnimeTosho links**
- **Use new AnimeTosho domain** (animetosho.xyz vs animetosho.org)
- **Show AnimeTosho comments**, **Screenshots**, **FileInfo**, and **Downloads** sections

_ameNZB_ (API key in the popup):

- **Display ameNZB links** and **Display ameNZB section**

_nekoBT:_

- **Display nekoBT links** and **Display nekoBT section**
- **Full language names** for audio/subtitle labels

_Tsukihime:_

- **Display Tsukihime links** and **Display Tsukihime section**

_Additional features:_

- **Display Best Release (Seadex)**
- **Screenshot preview** with hover delay and image-change interval
- **Add Changelog link to navbar** and **Show changelog popup**

_Highlights:_

- Add keywords or phrases with a color picker; matching torrent names in list tables are tinted with that color
- **Prioritize SeaDex highlights**: when a torrent matches both SeaDex and a custom keyword, keep the SeaDex color

_qBittorrent (when that client is selected):_

- Default category and tags
- Manage/sync categories and tags
- **Prompt on Send** to pick category/tags each time

![Extension Popup Preview][popup-preview]

**Extension popup:**

- **Torrent Client**: client type, URL, credentials, Test Connection / Save
- **ameNZB API key** (from [amenzb.moe/profile](https://amenzb.moe/profile))
- **TMDB API key** for Quick Search autocomplete (from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))

**Supported Domains:**

- nyaa.si
- nya.iss.one
- nyaa.ink
- nyaa.land
- nyaa.digital
- ny.iss.one

Look for the green "On" badge in your browser toolbar to confirm the extension is active for the current site.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- ACKNOWLEDGEMENTS -->

## Acknowledgements

Parts of this extension were inspired by or adapted from other community projects:

- [**Nyaa AnimeTosho Extender (ION Fork)**](https://github.com/IONI0/Nyaa-AnimeTosho-Extender-ION-Fork) by [IONI0](https://github.com/IONI0/) - AnimeTosho Screenshots, FileInfo, and Attachments on view pages (episode-specific data, batch file-list selection). Further improved and reimplemented for the extension.
- [**NyaaBlue**](https://releases.moe/nyaablue.user.js) by [ThaUnknown](https://releases.moe/) - SeaDex / best-release highlighting via the [releases.moe](https://releases.moe/) API ([MIT](https://opensource.org/licenses/MIT)).

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the GPLv3 License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/Arad119/Nyaa-Enhancer.svg?style=for-the-badge
[contributors-url]: https://github.com/Arad119/Nyaa-Enhancer/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/Arad119/Nyaa-Enhancer.svg?style=for-the-badge
[forks-url]: https://github.com/Arad119/Nyaa-Enhancer/network/members
[stars-shield]: https://img.shields.io/github/stars/Arad119/Nyaa-Enhancer.svg?style=for-the-badge
[stars-url]: https://github.com/Arad119/Nyaa-Enhancer/stargazers
[issues-shield]: https://img.shields.io/github/issues/Arad119/Nyaa-Enhancer.svg?style=for-the-badge
[issues-url]: https://github.com/Arad119/Nyaa-Enhancer/issues
[chrome-shield]: https://img.shields.io/chrome-web-store/users/donibkpnifppkihgmnoocogmmbbocpdd.svg?style=for-the-badge
[chrome-shield-url]: https://chromewebstore.google.com/detail/nyaa-enhancer/donibkpnifppkihgmnoocogmmbbocpdd
[firefox-shield]: https://img.shields.io/amo/dw/nyaa-enhancer.svg?style=for-the-badge
[firefox-shield-url]: https://addons.mozilla.org/en-US/firefox/addon/nyaa-enhancer/
[license-shield]: https://img.shields.io/github/license/Arad119/Nyaa-Enhancer.svg?style=for-the-badge
[license-url]: https://github.com/Arad119/Nyaa-Enhancer/blob/main/LICENSE.txt
[product-screenshot]: images/Program.png
[product-preview]: images/Screenshot.png
[product-settings]: images/Settings.png
[product-quicksearch]: images/QuickSearch.png
[product-filters]: images/Filters.png
[popup-preview]: images/Popup.gif
