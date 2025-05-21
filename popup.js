// Enhanced popup functionality
document.addEventListener('DOMContentLoaded', function() {
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const statusDiv = document.getElementById('status');
  
  // Add click handler for single download button
  downloadBtn.addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) {
        showStatus('No active tab found.', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if we're on a compatible site
      const url = new URL(activeTab.url);
      const compatibleDomains = ['openai.com', 'oaistatic.com', 'chatgpt.com', 'sora.com'];
      const isCompatible = compatibleDomains.some(domain => url.hostname.includes(domain));
      
      if (!isCompatible) {
        showStatus('This doesn\'t appear to be a Sora site. Try navigating to a page with Sora videos.', 'error');
        return;
      }
      
      // Send message to content script to find and download video
      chrome.tabs.sendMessage(activeTab.id, {
        action: "findAndDownloadVideo"
      }, function(response) {
        if (chrome.runtime.lastError) {
          showStatus('Error: Could not connect to the page. Try refreshing.', 'error');
          return;
        }
        
        if (response && response.success) {
          showStatus('Download started!', 'success');
        } else {
          showStatus('No video found on this page.', 'error');
        }
      });
    });
  });
  
  // Add click handler for download all button
  downloadAllBtn.addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) {
        showStatus('No active tab found.', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      // Execute the content script to find all videos
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        function: findAllVideosOnPage
      }).then(results => {
        if (results && results[0] && results[0].result && results[0].result.videos) {
          const videos = results[0].result.videos;
          
          if (videos.length === 0) {
            showStatus('No videos found on this page.', 'error');
            return;
          }
          
          showStatus(`Found ${videos.length} video(s). Starting download...`, 'success');
          
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
          showStatus('No videos found on this page.', 'error');
        }
      }).catch(error => {
        showStatus('Error: Could not find videos on this page.', 'error');
        console.error("Error executing script:", error);
      });
    });
  });
  
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
  
  // Listen for keyboard shortcut
  document.addEventListener('keydown', function(event) {
    if (event.altKey && event.key === 'd') {
      downloadBtn.click();
    }
    if (event.altKey && event.key === 'a') {
      downloadAllBtn.click();
    }
  });
  
  // Function to show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 3000);
    }
  }
});
