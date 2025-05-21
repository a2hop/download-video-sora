/**
 * This script handles overlay issues when trying to click on videos
 */

(function() {
  // Store references to videos we find on the page
  const videoRegistry = new Map();
  let videoCounter = 0;
  
  // Function to register a video element
  function registerVideo(videoElement) {
    if (!videoElement || !videoElement.src) return null;
    
    const videoId = `sora_video_${videoCounter++}`;
    videoRegistry.set(videoId, videoElement);
    videoElement.dataset.soraVideoId = videoId;
    
    return videoId;
  }
  
  // Improved video selector that only shows actual videos with valid sources
  function showVideoSelector(videos) {
    // Filter out invalid videos first
    const validVideos = Array.from(videos).filter(video => 
      video instanceof HTMLVideoElement && 
      video.src && 
      video.src.trim() !== '' &&
      (video.src.startsWith('http://') || video.src.startsWith('https://'))
    );
    
    if (validVideos.length === 0) {
      alert('No valid videos found on this page.');
      return;
    }
    
    // If only one valid video, download it directly
    if (validVideos.length === 1) {
      downloadVideo(validVideos[0]);
      return;
    }
    
    // Remove existing selector if any
    const existingSelector = document.getElementById('sora-video-selector');
    if (existingSelector) existingSelector.remove();
    
    // Create selector container
    const selector = document.createElement('div');
    selector.id = 'sora-video-selector';
    selector.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(33, 33, 33, 0.95);
      color: white;
      border-radius: 8px;
      padding: 16px;
      z-index: 2147483647;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      max-width: 80%;
      max-height: 80%;
      overflow-y: auto;
      font-family: Arial, sans-serif;
    `;
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Select a video to download';
    title.style.marginTop = '0';
    selector.appendChild(title);
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => selector.remove());
    selector.appendChild(closeBtn);
    
    // Add video options
    const videoList = document.createElement('div');
    videoList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    `;
    
    Array.from(validVideos).forEach((video, index) => {
      if (!video.src) return;
      
      const videoId = registerVideo(video);
      if (!videoId) return;
      
      const videoItem = document.createElement('div');
      videoItem.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px;
        border-radius: 4px;
        background-color: rgba(255,255,255,0.1);
        cursor: pointer;
      `;
      
      // Video thumbnail or placeholder
      const thumbnail = document.createElement('div');
      thumbnail.style.cssText = `
        width: 120px;
        height: 68px;
        background-color: #444;
        margin-right: 12px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #aaa;
      `;
      thumbnail.textContent = `Video ${index + 1}`;
      videoItem.appendChild(thumbnail);
      
      // Try to create a real thumbnail
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 68;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnail.innerHTML = '';
        thumbnail.appendChild(canvas);
      } catch (e) {
        // Fallback to text
      }
      
      // Video info
      const info = document.createElement('div');
      info.style.flexGrow = '1';
      
      const size = document.createElement('div');
      size.textContent = `Size: ${video.videoWidth}×${video.videoHeight}`;
      size.style.fontSize = '14px';
      info.appendChild(size);
      
      const source = document.createElement('div');
      source.textContent = video.src.substring(0, 50) + '...';
      source.style.fontSize = '12px';
      source.style.color = '#aaa';
      source.style.marginTop = '4px';
      source.style.wordBreak = 'break-all';
      info.appendChild(source);
      
      videoItem.appendChild(info);
      
      // Download button
      const dlButton = document.createElement('button');
      dlButton.textContent = 'Download';
      dlButton.style.cssText = `
        background-color: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        margin-left: 12px;
      `;
      
      dlButton.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadVideo(video);
        selector.remove();
      });
      
      videoItem.appendChild(dlButton);
      
      // Make the whole item clickable
      videoItem.addEventListener('click', () => {
        downloadVideo(video);
        selector.remove();
      });
      
      videoList.appendChild(videoItem);
    });
    
    selector.appendChild(videoList);
    document.body.appendChild(selector);
  }
  
  // Improved function to download a video with better validation
  function downloadVideo(video) {
    if (!video || !video.src) {
      alert('Invalid video source');
      return;
    }
    
    // Verify this is actually a video element with a valid source
    if (!(video instanceof HTMLVideoElement)) {
      alert('Not a valid video element');
      return;
    }
    
    try {
      const videoURL = new URL(video.src);
      if (!videoURL.protocol.startsWith('http')) {
        alert('Invalid video source URL');
        return;
      }
    } catch (e) {
      alert('Invalid video source URL');
      return;
    }
    
    // Create a download link
    const link = document.createElement('a');
    link.href = video.src;
    
    // Generate filename
    let filename = 'sora-video.mp4';
    const filenameMatch = video.src.match(/task_([^\/]+)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = `sora-video-${filenameMatch[1].substring(0, 8)}.mp4`;
    } else {
      filename = `sora-video-${Date.now()}.mp4`;
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success message
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      background-color: rgba(76, 175, 80, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    message.textContent = 'Download started!';
    document.body.appendChild(message);
    
    setTimeout(() => {
      message.style.opacity = '0';
      message.style.transition = 'opacity 0.5s ease';
      setTimeout(() => document.body.removeChild(message), 500);
    }, 3000);
  }
})();
