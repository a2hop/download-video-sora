// This script will be injected into the page when needed
console.log("Sora Video Downloader content script loaded");

// Create a notification element
function createNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotification = document.getElementById('sora-downloader-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'sora-downloader-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${type === 'error' ? '#f44336' : '#4CAF50'};
    color: white;
    padding: 16px;
    border-radius: 4px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    max-width: 350px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  
  // Add message
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  notification.appendChild(messageSpan);
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    margin-left: 10px;
  `;
  closeBtn.addEventListener('click', () => notification.remove());
  notification.appendChild(closeBtn);
  
  // Add to body
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// Track which video is currently being interacted with
let lastHoveredVideo = null;
let lastFocusedVideoContainer = null;
let lastRightClickPosition = { x: 0, y: 0 }; // Store last right-click position

// Helper function to check if video has a valid source
function videoIsValid(video) {
  return video && video.src && video.src.trim() !== '';
}

// Helper function to check if video is visible
function videoIsVisible(video) {
  if (!videoIsValid(video)) return false;
  
  const rect = video.getBoundingClientRect();
  return (
    rect.width > 50 && 
    rect.height > 50 &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Helper function to calculate how centered a video is in the viewport
function getDistanceFromCenter(video) {
  const rect = video.getBoundingClientRect();
  const videoCenterX = rect.left + rect.width / 2;
  const videoCenterY = rect.top + rect.height / 2;
  
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  
  const dx = videoCenterX - viewportCenterX;
  const dy = videoCenterY - viewportCenterY;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to find the best video to download
function findBestVideoToDownload() {
  // Find all videos on the page
  const videoElements = document.querySelectorAll('video');
  if (!videoElements.length) {
    createNotification('No videos found on this page.', 'error');
    return null;
  }
  
  // First priority: Use the video that was last hovered or its container was last focused
  if (lastHoveredVideo && videoIsValid(lastHoveredVideo)) {
    return lastHoveredVideo;
  }
  
  if (lastFocusedVideoContainer) {
    const containerVideos = lastFocusedVideoContainer.querySelectorAll('video');
    if (containerVideos.length > 0 && videoIsValid(containerVideos[0])) {
      return containerVideos[0];
    }
  }
  
  // Second priority: Find videos that are playing
  const playingVideos = Array.from(videoElements).filter(video => 
    !video.paused && !video.ended && video.currentTime > 0 && videoIsValid(video)
  );
  
  if (playingVideos.length > 0) {
    return playingVideos[0];
  }
  
  // Third priority: Find videos in the center of the viewport
  const visibleVideos = Array.from(videoElements).filter(video => videoIsVisible(video));
  
  if (visibleVideos.length > 0) {
    // Sort by how centered they are in the viewport
    visibleVideos.sort((a, b) => {
      const aCenter = getDistanceFromCenter(a);
      const bCenter = getDistanceFromCenter(b);
      return aCenter - bCenter;
    });
    
    return visibleVideos[0];
  }
  
  // Last resort: Just use the first video that has a source
  for (const video of videoElements) {
    if (videoIsValid(video)) {
      return video;
    }
  }
  
  return null;
}

// Function to find and download video
function findAndDownloadVideo() {
  const targetVideo = findBestVideoToDownload();
  
  if (!targetVideo) {
    createNotification('No suitable video found to download.', 'error');
    return false;
  }
  
  const videoUrl = targetVideo.src;
  
  if (!videoUrl) {
    createNotification('Video source not found.', 'error');
    return false;
  }
  
  // Generate filename
  let filename = 'sora-video.mp4';
  const filenameMatch = videoUrl.match(/task_([^\/]+)/);
  if (filenameMatch && filenameMatch[1]) {
    filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
  } else {
    filename = `sora-video-${Date.now()}.mp4`;
  }
  
  // Send message to background script to download
  chrome.runtime.sendMessage({
    action: "downloadVideo",
    url: videoUrl,
    filename: filename
  });
  
  createNotification('Video download started!');
  return true;
}

// Add hover tracking to help identify which video the user wants
document.addEventListener('mouseover', function(e) {
  let target = e.target;
  
  // Check if target is a video or has a video child
  if (target.tagName === 'VIDEO') {
    lastHoveredVideo = target;
    return;
  }
  
  // Check if target contains a video
  const containedVideo = target.querySelector('video');
  if (containedVideo) {
    lastHoveredVideo = containedVideo;
    lastFocusedVideoContainer = target;
    return;
  }
  
  // Check if target is a parent of a video (up to 3 levels)
  let current = target;
  for (let i = 0; i < 3; i++) {
    if (!current.parentElement) break;
    current = current.parentElement;
    const video = current.querySelector('video');
    if (video) {
      lastHoveredVideo = video;
      lastFocusedVideoContainer = current;
      return;
    }
  }
}, true);

// Listen for clicks on elements near videos
document.addEventListener('click', function(e) {
  if (e.target.closest('.group') || e.target.closest('[data-index]')) {
    // For Sora's specific UI structure
    const container = e.target.closest('.group') || e.target.closest('[data-index]');
    if (container) {
      const video = container.querySelector('video');
      if (video) {
        lastHoveredVideo = video;
        lastFocusedVideoContainer = container;
      }
    }
  }
}, true);

// Capture last right-click position
document.addEventListener('contextmenu', function(e) {
  lastRightClickPosition = { x: e.clientX, y: e.clientY };
  // The rest of the contextmenu listener for lastHoveredVideo etc. can remain
  // Try to find a video element or container near where the user right-clicked
  let element = e.target;
  
  // Check if element is a video
  if (element.tagName === 'VIDEO') {
    lastHoveredVideo = element;
    return;
  }
  
  // Check if element contains a video directly
  const containedVideo = element.querySelector('video');
  if (containedVideo) {
    lastHoveredVideo = containedVideo;
    lastFocusedVideoContainer = element;
    return;
  }
  
  // Check if element is inside a common container that might hold a video
  // Sora-specific selectors
  const containers = ['.group', '[data-index]', '.video-container', '.relative'];
  
  for (const selector of containers) {
    const container = element.closest(selector);
    if (container) {
      const video = container.querySelector('video');
      if (video) {
        lastHoveredVideo = video;
        lastFocusedVideoContainer = container;
        return;
      }
    }
  }
  
  // Walk up the tree a bit to find video containers
  let current = element;
  for (let i = 0; i < 5; i++) {
    if (!current || !current.parentElement) break;
    current = current.parentElement;
    const video = current.querySelector('video');
    if (video) {
      lastHoveredVideo = video;
      lastFocusedVideoContainer = current;
      return;
    }
  }
}, true);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVideoInfo") {
    const videoElement = findBestVideoToDownload();
    if (videoElement) {
      sendResponse({
        url: videoElement.src,
        success: true
      });
    } else {
      sendResponse({
        success: false,
        error: "No video element found"
      });
    }
    return true;
  }
  
  if (request.action === "showNotification") {
    createNotification(request.message, request.type || 'info');
    sendResponse({success: true});
    return true;
  }
  
  if (request.action === "findAndDownloadVideo") { // Used by popup and Alt+D
    const success = findAndDownloadVideo();
    sendResponse({ success: success });
    return true;
  }

  if (request.action === "getSpecificVideoAndDownloadAtPosition") {
    // Use the stored lastRightClickPosition
    const { x, y } = lastRightClickPosition;
    if (typeof x !== 'number' || typeof y !== 'number') {
      // This case should ideally not happen if contextmenu listener works
      createNotification('Error: Click position not recorded.', 'error');
      sendResponse({ success: false, message: "Click position not recorded" });
      return true;
    }

    const elementsAtPoint = document.elementsFromPoint(x, y);
    let targetVideo = null;

    for (const element of elementsAtPoint) {
      if (element.tagName === 'VIDEO' && videoIsValid(element)) {
        targetVideo = element;
        break;
      }
      // Check if the element itself contains a video (e.g., a div wrapping a video)
      if (!targetVideo && element.querySelector) {
         const directChildVideo = element.querySelector('video');
         if (directChildVideo && videoIsValid(directChildVideo)) {
            // Check if this container is small enough to be considered "specific"
            const elementRect = element.getBoundingClientRect();
            const videoRect = directChildVideo.getBoundingClientRect();
            // Heuristic: if the container isn't much larger than the video, consider it specific
            if (elementRect.width < videoRect.width * 2 && elementRect.height < videoRect.height * 2) {
                targetVideo = directChildVideo;
                break;
            }
         }
      }
    }
    
    if (targetVideo) {
      try {
        const videoURL = new URL(targetVideo.src); // Validate URL
        if (!videoURL.protocol.startsWith('http')) throw new Error("Invalid protocol");

        let filename = 'sora-video.mp4';
        const filenameMatch = targetVideo.src.match(/task_([^\/]+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
        } else {
          filename = `sora-video-${Date.now()}.mp4`;
        }
        
        chrome.runtime.sendMessage({
          action: "downloadVideo",
          url: targetVideo.src,
          filename: filename
        });
        
        createNotification('Video download started!');
        sendResponse({ success: true, url: targetVideo.src });
      } catch (e) {
        createNotification('Invalid video source URL.', 'error');
        sendResponse({ success: false, message: "Invalid video source URL" });
      }
    } else {
      createNotification('No video associated with this element.', 'error');
      sendResponse({ success: false, message: "No specific video found at click position" });
    }
    return true; 
  }
  
  if (request.action === "checkForVideoAtPosition") {
    // This handler might still be useful if called from other places,
    // but for the context menu, we'll rely on getSpecificVideoAndDownloadAtPosition
    // and the stored lastRightClickPosition.
    // If it's exclusively for the old context menu logic, it can be removed.
    // For now, let's assume it might be used, but it will use its passed position.
    if (!request.position) {
      sendResponse({hasVideo: false});
      return true;
    }
    
    // Get elements at the specified position
    const elementsAtPoint = document.elementsFromPoint(request.position.x, request.position.y);
    
    // Check if any of the elements is a video
    let hasVideo = false;
    
    // First check if we clicked directly on a video
    for (const element of elementsAtPoint) {
      if (element.tagName === 'VIDEO' && element.src) {
        hasVideo = true;
        break;
      }
    }
    
    // If not, check if any element contains a video
    if (!hasVideo) {
      for (const element of elementsAtPoint) {
        // Skip non-elements or text nodes
        if (!element.querySelector) continue;
        
        // Check if this element contains a video
        const video = element.querySelector('video');
        if (video && video.src) {
          hasVideo = true;
          break;
        }
        
        // Check if we clicked on a common container type
        if (element.classList.contains('group') || 
            element.hasAttribute('data-index') ||
            element.classList.contains('video-container') ||
            element.classList.contains('relative')) {
          
          const containerVideo = element.querySelector('video');
          if (containerVideo && containerVideo.src) {
            hasVideo = true;
            break;
          }
        }
      }
    }
    
    sendResponse({hasVideo: hasVideo});
    return true;
  }
  
  return true;
});

// Add a keyboard shortcut (Alt+D) to quickly download the visible video
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.key === 'd') {
    findAndDownloadVideo();
  }
});

// Add debug mode with Shift+Alt+V to show all videos with their sources
document.addEventListener('keydown', (event) => {
  if (event.shiftKey && event.altKey && event.key === 'v') {
    debugShowAllVideos();
  }
});

// Debug function to show all videos with their sources
function debugShowAllVideos() {
  const videos = document.querySelectorAll('video');
  let message = `Found ${videos.length} videos:\n\n`;
  
  videos.forEach((video, index) => {
    const rect = video.getBoundingClientRect();
    const isVisible = videoIsVisible(video);
    const src = video.src || '(no source)';
    
    message += `Video ${index+1}: ${isVisible ? 'Visible' : 'Not visible'}\n`;
    message += `Size: ${rect.width}x${rect.height}\n`;
    message += `Position: (${rect.left.toFixed(0)},${rect.top.toFixed(0)})\n`;
    message += `Source: ${src.substring(0, 50)}...\n\n`;
  });
  
  createNotification(message, 'info');
  console.log('Videos found:', videos);
}

// Add visual indicators to all visible videos when hovering over them
function addVideoIndicators() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.src || video.src.trim() === '') return;
    
    // Find parent with position relative/absolute or create a wrapper
    let container = video;
    let parent = video.parentElement;
    let wrapperCreated = false;
    
    while (parent) {
      const position = window.getComputedStyle(parent).getPropertyValue('position');
      if (position === 'relative' || position === 'absolute') {
        container = parent;
        break;
      }
      parent = parent.parentElement;
      
      // Don't go too far up the DOM tree
      if (parent && parent.tagName === 'BODY') break;
    }
    
    // If no suitable container was found, create a wrapper
    if (container === video) {
      const wrapper = document.createElement('div');
      wrapper.className = 'sora-video-container';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      
      // Replace the video with our wrapper and put the video inside
      if (video.parentElement) {
        video.parentElement.insertBefore(wrapper, video);
        wrapper.appendChild(video);
        container = wrapper;
        wrapperCreated = true;
      }
    } else {
      // Add our class to the existing container
      container.classList.add('sora-video-container');
    }
    
    // Create download button if it doesn't exist
    if (!container.querySelector('.sora-download-button')) {
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'sora-download-button';
      downloadBtn.textContent = 'Download Video';
      downloadBtn.style.pointerEvents = 'auto';
      
      // Set click handler to download the video
      downloadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Generate filename
        const videoUrl = video.src;
        let filename = 'sora-video.mp4';
        const filenameMatch = videoUrl.match(/task_([^\/]+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
        } else {
          filename = `sora-video-${Date.now()}.mp4`;
        }
        
        // Send message to background script to download
        chrome.runtime.sendMessage({
          action: "downloadVideo",
          url: videoUrl,
          filename: filename
        });
        
        createNotification('Video download started!');
        return false;
      });
      
      // Append to container
      container.appendChild(downloadBtn);
      
      // Set video as target when hovering
      container.addEventListener('mouseover', () => {
        lastHoveredVideo = video;
        lastFocusedVideoContainer = container;
      });
      
      // Flag this video as processed
      video.dataset.soraProcessed = 'true';
    }
    
    // If the old indicator exists, remove it
    const oldIndicator = container.querySelector('.sora-video-indicator');
    if (oldIndicator) {
      oldIndicator.remove();
    }
  });
}

// Also add an observer specifically for video elements to catch dynamic video loading
function setupVideoObserver() {
  // Check for videos that might be added or modified
  const videoObserver = new MutationObserver(() => {
    const videos = document.querySelectorAll('video:not([data-sora-processed="true"])');
    if (videos.length) {
      addVideoIndicators();
    }
  });

  // Start observing the document with the configured parameters
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
}

// Run the indicator setup more frequently
setInterval(addVideoIndicators, 1000);

// Initialize by identifying videos on page load
setTimeout(() => {
  addVideoIndicators();
  setupVideoObserver();
}, 500);

// Run it again after a delay to catch dynamically loaded content
setTimeout(addVideoIndicators, 2000);
setTimeout(addVideoIndicators, 5000);

// Add a keyboard shortcut to force refresh video indicators
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.key === 'r') {
    addVideoIndicators();
    createNotification('Refreshed video download buttons');
  }
});

// Add this function to create actual download buttons on all videos
function addDownloadButtonsToAllVideos() {
  // This function now does nothing - removing floating download buttons
}

// Improve the contextmenu event to better track which video the user is trying to download
document.addEventListener('contextmenu', function(e) {
  // Try to find a video element or container near where the user right-clicked
  let element = e.target;
  
  // Check if element is a video
  if (element.tagName === 'VIDEO') {
    lastHoveredVideo = element;
    return;
  }
  
  // Check if element contains a video directly
  const containedVideo = element.querySelector('video');
  if (containedVideo) {
    lastHoveredVideo = containedVideo;
    lastFocusedVideoContainer = element;
    return;
  }
  
  // Check if element is inside a common container that might hold a video
  // Sora-specific selectors
  const containers = ['.group', '[data-index]', '.video-container', '.relative'];
  
  for (const selector of containers) {
    const container = element.closest(selector);
    if (container) {
      const video = container.querySelector('video');
      if (video) {
        lastHoveredVideo = video;
        lastFocusedVideoContainer = container;
        return;
      }
    }
  }
  
  // Walk up the tree a bit to find video containers
  let current = element;
  for (let i = 0; i < 5; i++) {
    if (!current || !current.parentElement) break;
    current = current.parentElement;
    const video = current.querySelector('video');
    if (video) {
      lastHoveredVideo = video;
      lastFocusedVideoContainer = current;
      return;
    }
  }
}, true);

// Initialize by identifying videos on page load
setTimeout(addVideoIndicators, 1000);

// Add a function to help find videos near a specific position
function findVideoNearPosition(x, y) {
  // Get all visible videos
  const videos = Array.from(document.querySelectorAll('video')).filter(video => {
    if (!video.src) return false;
    const rect = video.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0);
  });
  
  if (!videos.length) return null;
  
  // Sort videos by distance to the click position
  videos.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    
    const aCenter = {
      x: aRect.left + aRect.width / 2,
      y: aRect.top + aRect.height / 2
    };
    
    const bCenter = {
      x: bRect.left + bRect.width / 2,
      y: bRect.top + bRect.height / 2
    };
    
    const aDist = Math.sqrt(Math.pow(aCenter.x - x, 2) + Math.pow(aCenter.y - y, 2));
    const bDist = Math.sqrt(Math.pow(bCenter.x - x, 2) + Math.pow(bCenter.y - y, 2));
    
    return aDist - bDist;
  });
  
  return videos[0];
}
