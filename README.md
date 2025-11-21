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
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/Arad119/Nyaa-Enhancer">
    <img src="images/Logo.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Nyaa Enhancer</h3>

  <p align="center">
    A comprehensive browser extension that enhances Nyaa torrent sites with advanced batch operations, intelligent filtering, user monitoring, and seamless integration features for power users.
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
    <li><a href="#license">License</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

![Nyaa-Enhancer Screenshot][product-screenshot]

Nyaa Enhancer is a powerful browser extension that transforms your Nyaa torrent browsing experience. Beyond basic batch operations, it offers intelligent filtering, user monitoring, seamless Animetosho integration, and comprehensive customization options. Whether you're a casual user looking to copy a few magnet links or a power user managing large collections, Nyaa Enhancer provides the tools you need for efficient torrent management.

<p align="right">(<a href="#top">back to top</a>)</p>

### Built With

- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/reference/api) - Core extension functionality
- [JSZip](https://cdnjs.com/libraries/jszip) - ZIP file creation for batch downloads

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- FEATURES -->

### Features

![Nyaa-Enhancer Preview][product-preview]

**Core Functionality:**

- Adds checkboxes next to each torrent entry for easy selection
- "Copy Selected" button to copy checked magnet links
- "Copy All" button to copy all magnet links on the page
- "Download Selected" button to download checked torrent files
- "Download All" button to download all torrent files on the page
- "Invert Selection" button to toggle all checkbox states
- "Clear Selection" button to uncheck all boxes
- Selection counter showing number of selected items
- Shift+click support for range selection of torrents
- Individual magnet copy buttons for each torrent
- Toast notifications with progress tracking

**Enhanced Navigation:**

- Animetosho (AT) links for anime torrents with direct integration
- Quick Search functionality for fast torrent filtering
- Keyword-based torrent selection and filtering
- File size filtering with customizable ranges
- Dead torrent hiding capability
- Comment hiding on torrent view pages

**Advanced Features:**

- User monitoring system to track favorite uploaders
- Keyword filtering with custom word lists
- File size range filtering (256MB, 512MB, 1GB, 2GB, 4GB options)
- Customizable file options:
  - Use anime titles as torrent filenames
  - Combine downloads into ZIP files
- Settings sync across browser sessions and devices
- Comprehensive notification system with toggle options
- Changelog navigation with dismissible updates

**Supported Domains:**

- Supports multiple Nyaa mirror domains for maximum accessibility

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To install the extension in your browser, follow these steps.

### Installation

**Chrome Web Store (up-to-date at 1.9.0):**  
<a href="https://chromewebstore.google.com/detail/nyaa-enhancer/donibkpnifppkihgmnoocogmmbbocpdd" target="_blank">
<img src="https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png" alt="Chrome Web Store" height="50px" >
</a>

**Firefox Add-Ons Store (up-to-date at 1.9.0):**  
<a href="https://addons.mozilla.org/en-US/firefox/addon/nyaa-enhancer/" target="_blank">
<img src="https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png" alt="Firefox Add-Ons Store" height="50px" >
</a>

**Edge Add-Ons Store (up-to-date at 1.9.0):**  
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

**Basic Operations:**

1. Visit any supported Nyaa torrent site
2. Use the checkboxes to select desired torrents (Shift+click for range selection)
3. Click "Copy Selected" to copy selected magnet links
4. Click "Copy All" to copy all magnet links on the page
5. Click "Download Selected" to download selected torrent files
6. Click "Download All" to download all torrent files on the page
7. Use "Invert Selection" to toggle all checkbox states
8. Use "Clear Selection" to uncheck all boxes
9. Use individual magnet buttons for quick single-torrent copying

**Advanced Features:**

- **Quick Search**: Use the Quick Search button for fast torrent filtering
- **Keyword Select**: Automatically select torrents based on predefined keywords
- **AT Links**: Click Animetosho links for anime torrents to access additional resources
- **User Monitoring**: Track favorite uploaders and get notifications for new uploads
- **File Size Filtering**: Filter torrents by size ranges (256MB to 4GB+)

![Extension Popup Preview][popup-preview]

**Extension Settings (accessible via popup menu):**

_General Settings:_

- **Show Buttons**: Toggle main extension functionality on/off
- **Show AT Links**: Display Animetosho integration links for anime
- **Show Magnet Buttons**: Display individual magnet copy buttons
- **Show Quick Filter**: Enable/disable Quick Search functionality
- **Show Changelog Navigation**: Toggle update notification visibility

_Download Options:_

- **Use Display Name as Filename**: Uses anime titles instead of torrent IDs
- **Combine Downloads as ZIP**: Packages multiple torrents into a single ZIP file

_Filtering Options:_

- **Hide Dead Torrents**: Automatically hide torrents with 0 seeders
- **Keyword Filtering**: Enable automatic filtering based on custom keywords
- **File Size Filtering**: Filter torrents by customizable size ranges
- **Show Filter Notifications**: Toggle filtering notification messages
- **Hide Comments**: Hide comment sections on torrent view pages

_Monitoring:_

- **Monitor Users**: Track specific uploaders for new content
- **Keyword Management**: Add/remove keywords for automatic selection

**Supported Domains:**

- nyaa.si
- nya.iss.one
- nyaa.ink
- nyaa.land
- nyaa.digital
- ny.iss.one

Look for the green "On" badge in your browser toolbar to confirm the extension is active for the current site.

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
[license-shield]: https://img.shields.io/github/license/Arad119/Nyaa-Enhancer.svg?style=for-the-badge
[license-url]: https://github.com/Arad119/Nyaa-Enhancer/blob/master/LICENSE.txt
[product-screenshot]: images/Program.png
[product-preview]: images/Screenshot.png
[popup-preview]: images/Popup.gif
