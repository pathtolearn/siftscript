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
  
  // Listen for URL changes (YouTube is a SPA)
  const observer = new MutationObserver(async () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      // Wait a bit for the page to update
      setTimeout(async () => {
        const context = await waitForVideoMetadata();
        callback(context);
      }, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen to popstate events
  window.addEventListener('popstate', async () => {
    const context = await waitForVideoMetadata();
    callback(context);
  });
}
