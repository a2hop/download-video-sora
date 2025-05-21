// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  // Create menu item ONLY for video elements 
  chrome.contextMenus.create({
    id: "downloadSoraVideo",
    title: "Download Sora Video",
    contexts: ["video"]
  });
  
  // Add a more general context menu item that works on any element EXCEPT videos
  // This prevents showing both menu items when right-clicking on a video
  chrome.contextMenus.create({
    id: "downloadSoraVideoFromElement",
    title: "Download Sora Video",
    contexts: ["page", "frame", "selection", "link", "editable", "image", "audio"]
  });
  
  // Add a context menu item for downloading all videos on the page
  chrome.contextMenus.create({
    id: "downloadAllSoraVideos",
    title: "Find and Download All Videos",
    contexts: ["page"]
  });
});

// Remove the problematic listener that was causing the error
// The built-in contexts functionality will handle showing/hiding menu items

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadSoraVideo") {
    // Direct video right-click
    if (info.srcUrl) {
      // Prefer info.srcUrl if available (most direct)
      let filename = 'sora-video.mp4';
      const filenameMatch = info.srcUrl.match(/task_([^\/]+)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
      } else {
        filename = `sora-video-${Date.now()}.mp4`;
      }
      chrome.downloads.download({
        url: info.srcUrl,
        filename: filename,
        saveAs: true
      });
    } else {
      // Fallback if info.srcUrl is not available
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: function() {
          // This will be executed in the page context
          const activeVideos = document.querySelectorAll('video');
          let targetVideo = null;
          for (const video of activeVideos) { // Try to find a playing or visible video
            if (!video.paused && video.currentTime > 0) { targetVideo = video; break; }
          }
          if (!targetVideo) {
            for (const video of activeVideos) {
              if (video.getBoundingClientRect().width > 0 && video.getBoundingClientRect().height > 0) {
                targetVideo = video; break;
              }
            }
          }
          if (!targetVideo || !targetVideo.src) return null;
          const videoUrl = targetVideo.src;
          let filename = 'sora-video.mp4';
          const filenameMatch = videoUrl.match(/task_([^\/]+)/);
          if (filenameMatch && filenameMatch[1]) {
            filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
          } else {
            filename = `sora-video-${Date.now()}.mp4`;
          }
          return { url: videoUrl, filename: filename };
        }
      }).then(results => {
        processDownloadResults(results, tab);
      }).catch(error => {
        console.error("Error executing script for direct video download:", error);
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: "Could not get video source.",
          type: "error"
        });
      });
    }
  } 
  else if (info.menuItemId === "downloadSoraVideoFromElement") {
    // Element right-click - delegate to content script for specific video check
    // The content script will use its last recorded right-click position
    chrome.tabs.sendMessage(tab.id, {
      action: "getSpecificVideoAndDownloadAtPosition"
      // No position is sent from here; content script uses its stored one.
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn("Error sending message to content script or no active listener for getSpecificVideoAndDownloadAtPosition:", chrome.runtime.lastError.message);
         chrome.tabs.sendMessage(tab.id, {
            action: "showNotification",
            message: "Cannot interact with this page. Try refreshing.",
            type: "error"
          }).catch(() => {}); // Ignore error if tab can't be messaged
      }
      // Response handling (notifications, download initiation) is primarily in content script.
      // Background script might receive a response like {success: true/false} if needed for logging.
    });
  }
  else if (info.menuItemId === "downloadAllSoraVideos") {
    // Find all videos on the page
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: findAllVideosOnPage
    }).then(results => {
      if (results && results[0] && results[0].result && results[0].result.videos) {
        const videos = results[0].result.videos;
        
        if (videos.length === 0) {
          chrome.tabs.sendMessage(tab.id, {
            action: "showNotification",
            message: "No videos found on this page.",
            type: "error"
          });
          return;
        }
        
        // Show notification with number of videos found
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: `Found ${videos.length} videos. Starting download...`,
          type: "info"
        });
        
        // Download the first video immediately
        if (videos[0]) {
          chrome.downloads.download({
            url: videos[0].url,
            filename: videos[0].filename,
            saveAs: videos.length === 1 // Only show save dialog if there's just one video
          });
        }
        
        // If there are more videos, download them with a delay
        if (videos.length > 1) {
          for (let i = 1; i < videos.length; i++) {
            setTimeout(() => {
              chrome.downloads.download({
                url: videos[i].url,
                filename: videos[i].filename,
                saveAs: false
              });
            }, i * 1000); // Delay each download by 1 second
          }
        }
      } else {
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: "No videos found on this page.",
          type: "error"
        });
      }
    }).catch(error => {
      console.error("Error executing script:", error);
    });
  }
});

// Helper function to process download results
function processDownloadResults(results, tab) {
  if (results && results[0] && results[0].result) {
    const videoUrl = results[0].result.url;
    const suggestedName = results[0].result.filename || "sora-video.mp4";
    
    // Download the video
    chrome.downloads.download({
      url: videoUrl,
      filename: suggestedName,
      saveAs: true
    });
  } else {
    // Notify the content script to show an error message
    chrome.tabs.sendMessage(tab.id, {
      action: "showNotification",
      message: "No video found on this page or under this element.",
      type: "error"
    });
  }
}

// Function to find all videos on the page
function findAllVideosOnPage() {
  const videoElements = document.querySelectorAll('video');
  const videos = [];
  
  for (const video of videoElements) {
    if (video.src && video.src.trim() !== '') {
      const videoUrl = video.src;
      
      // Generate filename from URL
      let filename = 'sora-video.mp4';
      const filenameMatch = videoUrl.match(/task_([^\/]+)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
      } else {
        filename = `sora-video-${Date.now()}-${videos.length}.mp4`;
      }
      
      videos.push({
        url: videoUrl,
        filename: filename
      });
    }
  }
  
  return { videos };
}

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  if (command === "download-video") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "findAndDownloadVideo"
        });
      }
    });
  }
  
  if (command === "force-detect-videos") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0]) {
        detectAndDownloadVideos(tabs[0]);
      }
    });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadVideo" && request.url) {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename || "sora-video.mp4",
      saveAs: true // Always prompt for saveAs for user confirmation
    });
    sendResponse({success: true, message: "Download initiated by background."});
    return true;
  }
  // Keep sendResponse asynchronous if other handlers might use it.
});

// Function to help detect videos by injecting a temporary content script
function detectAndDownloadVideos(tab) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: function() {
      // This runs in the context of the page
      const videos = document.querySelectorAll('video');
      const results = [];
      
      for (const video of videos) {
        if (video.src) {
          const rect = video.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            results.push({
              src: video.src,
              width: rect.width,
              height: rect.height,
              isPlaying: !video.paused && video.currentTime > 0
            });
          }
        }
      }
      
      return {
        count: results.length,
        videos: results
      };
    }
  }).then(results => {
    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      if (data.count > 0) {
        // Find the best video (playing or largest)
        let bestVideo = data.videos[0];
        
        // Prefer playing videos
        const playingVideos = data.videos.filter(v => v.isPlaying);
        if (playingVideos.length > 0) {
          bestVideo = playingVideos[0];
        } else {
          // Prefer larger videos
          data.videos.forEach(v => {
            if (v.width * v.height > bestVideo.width * bestVideo.height) {
              bestVideo = v;
            }
          });
        }
        
        // Generate filename
        let filename = 'sora-video.mp4';
        const filenameMatch = bestVideo.src.match(/task_([^\/]+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
        } else {
          filename = `sora-video-${Date.now()}.mp4`;
        }
        
        // Download the video
        chrome.downloads.download({
          url: bestVideo.src,
          filename: filename,
          saveAs: true
        });
        
        // Notify success
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: `Downloading video...`,
          type: "info"
        });
      } else {
        // No videos found
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: "No videos found on this page.",
          type: "error"
        });
      }
    }
  }).catch(error => {
    console.error("Error detecting videos:", error);
  });
}
