// More robust video detection utility functions

/**
 * Find all video elements on the page, including those in iframes when possible
 * @returns {Array} Array of video elements
 */
function findAllVideos() {
  let videos = Array.from(document.querySelectorAll('video'));
  
  // Try to also get videos from accessible iframes
  try {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.contentDocument) {
          const iframeVideos = Array.from(iframe.contentDocument.querySelectorAll('video'));
          videos = videos.concat(iframeVideos);
        }
      } catch (e) {
        console.log("Cannot access iframe content due to same-origin policy");
      }
    }
  } catch (e) {
    console.error("Error accessing iframes:", e);
  }
  
  return videos;
}

/**
 * Get source information from a video element
 * @param {HTMLVideoElement} videoElement - The video element to analyze
 * @returns {Object} Object containing video sources and other metadata
 */
function getVideoSources(videoElement) {
  if (!videoElement) return null;
  
  const sources = {
    src: videoElement.src || null,
    currentSrc: videoElement.currentSrc || null,
    sourceElements: []
  };
  
  // Get sources from source elements
  const sourceElements = videoElement.querySelectorAll('source');
  for (const source of sourceElements) {
    sources.sourceElements.push({
      src: source.src,
      type: source.type
    });
  }
  
  return sources;
}

// Export functions for use in other scripts
window.SoraVideoDownloader = {
  findAllVideos,
  getVideoSources
};
