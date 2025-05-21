# Sora Video Downloader Extension

This Chrome extension helps you download videos from pages, presumably targeting sites like Sora.

## Features

### Context Menu Options

When you right-click on a webpage, the extension provides the following options:

1.  **Download Sora Video (on video elements):**
    *   Appears when you right-click directly on a `<video>` element.
    *   Attempts to download the video using its `srcUrl`.
    *   If `srcUrl` is not directly available, it executes a script to find the active/visible video element and get its source.
    *   Prompts for `Save As` dialog.

2.  **Download Sora Video (on other elements):**
    *   Appears when you right-click on any part of the page *except* directly on a video element (to avoid duplicate menu items).
    *   Sends a message to the content script to find a video at or near the right-clicked position.
    *   The content script is responsible for identifying the video and initiating the download.
    *   Prompts for `Save As` dialog.

3.  **Find and Download All Videos:**
    *   Appears when you right-click anywhere on the page.
    *   Executes a script to find all `<video>` elements on the page with a valid `src`.
    *   Notifies you of the number of videos found.
    *   Downloads the first video immediately. If it's the only video, it prompts for `Save As`.
    *   If multiple videos are found, subsequent videos are downloaded automatically (without `Save As`) with a 1-second delay between each to prevent overwhelming the browser or server.

### Keyboard Shortcuts

The extension supports the following keyboard shortcuts (configurable in `chrome://extensions/shortcuts`):

1.  **Download Video (Default: Not set, user needs to configure)**:
    *   Sends a message to the content script (`findAndDownloadVideo`) to identify and download the most relevant video on the active tab. This typically targets the video currently in view or actively playing.

2.  **Force Detect Videos (Default: Not set, user needs to configure)**:
    *   Injects a script into the active tab to detect all visible video elements.
    *   It prioritizes playing videos, then the largest visible video.
    *   Downloads the "best" detected video, prompting with `Save As`.

### Filename Generation

Downloaded videos are named using the following patterns:

*   If the video URL contains a `task_` identifier (e.g., `.../task_abcdef12345/...`), the filename will be `sora-video-abcdef12.mp4` (using the first 8 characters of the ID).
*   Otherwise, the filename will be `sora-video-[TIMESTAMP].mp4` or `sora-video-[TIMESTAMP]-[INDEX].mp4` for multiple downloads.

### Notifications

The extension uses browser notifications to inform the user about:
*   The number of videos found when using "Find and Download All Videos".
*   Download initiation.
*   Errors (e.g., no video found, script execution errors).

## How it Works

*   **Background Script (`background.js`):** Manages context menu creation, handles click events on context menus, listens for keyboard shortcut commands, and processes download requests. It injects scripts into web pages to find video URLs.
*   **Content Scripts (Implicitly used via `chrome.scripting.executeScript` and `chrome.tabs.sendMessage`):** These scripts run in the context of the web page to access and manipulate the DOM, find video elements, and communicate video URLs back to the background script. The extension also expects a content script to be listening for messages like `getSpecificVideoAndDownloadAtPosition` and `findAndDownloadVideo`.

## Installation

1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" using the toggle switch.
4.  Click on "Load unpacked".
5.  Select the directory where you downloaded/cloned the extension.
