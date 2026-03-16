import type { VideoContext } from '../../types';

export function isYouTubeWatchPage(): boolean {
  return window.location.hostname === 'www.youtube.com' && 
         window.location.pathname === '/watch' &&
         new URLSearchParams(window.location.search).has('v');
}

export function getVideoIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

export function extractVideoContext(): VideoContext | null {
  if (!isYouTubeWatchPage()) {
    return null;
  }

  const videoId = getVideoIdFromUrl();
  if (!videoId) {
    return null;
  }

  // Extract video title
  const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
  const title = titleElement?.textContent?.trim() || 'Unknown Title';

  // Extract channel info
  const channelLink = document.querySelector('ytd-channel-name a');
  const channelTitle = channelLink?.textContent?.trim() || 'Unknown Channel';
  const channelHref = channelLink?.getAttribute('href') || '';
  const channelId = channelHref.startsWith('/@') 
    ? channelHref.slice(2) 
    : channelHref.split('/').pop() || 'unknown';

  // Extract thumbnail
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  // Extract publish date (if available)
  const dateElement = document.querySelector('#info-strings yt-formatted-string');
  const publishedAt = dateElement?.textContent?.trim() || null;

  // Extract duration (if available)
  const durationElement = document.querySelector('.ytp-time-duration');
  const durationText = durationElement?.textContent?.trim() || '';

  return {
    videoId,
    url: window.location.href,
    title,
    channelId,
    channelTitle,
    thumbnailUrl,
    publishedAt,
    durationText,
    isWatchPage: true
  };
}

export function waitForVideoMetadata(): Promise<VideoContext | null> {
  return new Promise((resolve) => {
    // Try immediately first
    const context = extractVideoContext();
    if (context && context.title !== 'Unknown Title') {
      resolve(context);
      return;
    }

    // If not ready, wait for the page to load
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      const context = extractVideoContext();
      if (context && context.title !== 'Unknown Title') {
        clearInterval(interval);
        resolve(context);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        resolve(context); // Return what we have, even if incomplete
      }
    }, 500);
  });
}

export function setupPageChangeListener(callback: (context: VideoContext | null) => void): void {
  let lastUrl = window.location.href;
  let lastVideoId = getVideoIdFromUrl();
  let debounceTimer: number | null = null;
  let isProcessing = false;
  
  function debounce(fn: () => void, delay: number) {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      fn();
      debounceTimer = null;
    }, delay);
  }
  
  async function handleVideoChange() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      const currentUrl = window.location.href;
      const currentVideoId = getVideoIdFromUrl();
      
      // Only process if we're on a watch page and video ID changed
      if (!isYouTubeWatchPage()) {
        if (lastVideoId !== null) {
          lastUrl = currentUrl;
          lastVideoId = null;
          callback(null);
        }
        return;
      }
      
      // Check if video actually changed
      if (currentVideoId !== lastVideoId) {
        console.log('Video changed detected:', { from: lastVideoId, to: currentVideoId });
        lastUrl = currentUrl;
        lastVideoId = currentVideoId;
        
        // Wait for page to stabilize after navigation
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Verify video ID hasn't changed again (rapid navigation)
        if (getVideoIdFromUrl() !== currentVideoId) {
          console.log('Video changed again during processing, aborting');
          return;
        }
        
        const context = await waitForVideoMetadata();
        
        // Final verification before callback
        if (getVideoIdFromUrl() === currentVideoId) {
          callback(context);
        }
      }
    } finally {
      isProcessing = false;
    }
  }
  
  // Listen for URL changes via MutationObserver (SPA navigation)
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      debounce(handleVideoChange, 500);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Listen for YouTube's custom navigation events
  document.addEventListener('yt-navigate-start', () => {
    debounce(handleVideoChange, 600);
  });
  
  document.addEventListener('yt-navigate-finish', () => {
    debounce(handleVideoChange, 800);
  });
  
  // Listen for popstate events (back/forward buttons)
  window.addEventListener('popstate', () => {
    debounce(handleVideoChange, 500);
  });
  
  // Listen for video element changes (player-level detection)
  const videoObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        const target = mutation.target as HTMLVideoElement;
        if (target.tagName === 'VIDEO' && target.src) {
          debounce(handleVideoChange, 500);
        }
      }
    }
  });
  
  // Observe video elements when they appear
  const observeVideoElements = () => {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      videoObserver.observe(video, { attributes: true, attributeFilter: ['src'] });
    });
  };
  
  // Initial observation and periodic check for new video elements
  observeVideoElements();
  setInterval(observeVideoElements, 2000);
  
  // Also observe for new video elements being added to DOM
  const videoContainerObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'VIDEO' || node.querySelector('video')) {
              debounce(handleVideoChange, 500);
              observeVideoElements();
            }
          }
        });
      }
    }
  });
  
  const playerContainer = document.querySelector('#movie_player, #player-container, .html5-video-player');
  if (playerContainer) {
    videoContainerObserver.observe(playerContainer, { childList: true, subtree: true });
  }
}
