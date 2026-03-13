import type { TranscriptInfo, TranscriptSegment, FetchState } from '../../types';

interface YouTubeCaptionTrack {
  baseUrl: string;
  name?: { simpleText: string };
  vssId?: string;
  languageCode: string;
  kind?: string;
  isTranslatable: boolean;
}

interface YouTubePlayerCaptions {
  playerCaptionsTracklistRenderer?: {
    captionTracks?: YouTubeCaptionTrack[];
  };
}

export interface FetchTranscriptResult {
  state: FetchState;
  segments?: TranscriptSegment[];
  languageCode?: string;
  languageLabel?: string;
  sourceType?: 'manual' | 'auto-generated' | 'unknown';
  error?: string;
}

// Track last fetch time to prevent rate limiting
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 1000;
let cachedWatchPageHtml: string | null = null;
let cachedWatchPageVideoId: string | null = null;

export async function checkTranscriptAvailability(): Promise<TranscriptInfo> {
  try {
    // Check if transcript button exists in the UI
    const transcriptBtn = await findTranscriptButton();
    if (transcriptBtn) {
      return {
        available: true,
        languageCode: null,
        languageLabel: null,
        sourceType: 'unknown'
      };
    }

    // Check for transcript panel already open
    const panel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    if (panel) {
      return {
        available: true,
        languageCode: null,
        languageLabel: null,
        sourceType: 'unknown'
      };
    }

    return {
      available: false,
      languageCode: null,
      languageLabel: null,
      sourceType: 'unknown'
    };
  } catch (error) {
    console.error('Error checking transcript availability:', error);
    return {
      available: false,
      languageCode: null,
      languageLabel: null,
      sourceType: 'unknown'
    };
  }
}

export async function fetchTranscript(
  videoId: string,
  preferredLanguage?: string
): Promise<FetchTranscriptResult> {
  console.log('fetchTranscript called with videoId:', videoId);
  
  // Rate limiting
  const now = Date.now();
  if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_FETCH_INTERVAL - (now - lastFetchTime)));
  }
  lastFetchTime = Date.now();

  const errors: string[] = [];

  // Method 1: Extract from transcript UI panel (PRIMARY - Most Reliable)
  try {
    console.log('Trying method 1: Transcript Panel');
    const result = await fetchFromTranscriptPanel();
    console.log('Panel result:', result.state, result.error || `segments: ${result.segments?.length}`);
    if (result.state === 'success') {
      return result;
    }
    if (result.error) {
      errors.push(`Transcript panel: ${result.error}`);
    }
  } catch (error) {
    errors.push(`Transcript panel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Method 2: Try extracting from page HTML
  try {
    console.log('Trying method 2: Page HTML');
    const result = await fetchFromPageHtml(videoId, preferredLanguage);
    console.log('Page HTML result:', result.state, result.error || `segments: ${result.segments?.length}`);
    if (result.state === 'success') {
      return result;
    }
    if (result.error) {
      errors.push(`Page HTML: ${result.error}`);
    }
  } catch (error) {
    errors.push(`Page HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Method 3: Try InnerTube API (with ANDROID client)
  try {
    console.log('Trying method 3: InnerTube API');
    const result = await fetchFromInnerTube(videoId, preferredLanguage);
    console.log('InnerTube result:', result.state, result.error || `segments: ${result.segments?.length}`);
    if (result.state === 'success') {
      return result;
    }
    if (result.error) {
      errors.push(`InnerTube API: ${result.error}`);
    }
  } catch (error) {
    errors.push(`InnerTube API: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // All methods failed
  return {
    state: 'error',
    error: `All methods failed:\n${errors.join('\n')}`
  };
}

async function fetchFromTranscriptPanel(): Promise<FetchTranscriptResult> {
  return new Promise(async (resolve) => {
    try {
      console.log('fetchFromTranscriptPanel: Starting...');
      
      // Check if panel is already open
      let panel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
      const wasPanelOpen = !!panel;
      console.log('fetchFromTranscriptPanel: Panel already open:', wasPanelOpen);
      
      if (!panel) {
        // Need to click transcript button
        const transcriptBtn = await findTranscriptButton();
        if (!transcriptBtn) {
          console.log('fetchFromTranscriptPanel: Transcript button not found');
          resolve({ state: 'error', error: 'Transcript button not found' });
          return;
        }
        
        console.log('fetchFromTranscriptPanel: Clicking transcript button');
        transcriptBtn.click();
        
        // Wait for panel to open with timeout
        const startTime = Date.now();
        const maxWait = 5000;
        
        while (!panel && Date.now() - startTime < maxWait) {
          await new Promise(r => setTimeout(r, 200));
          panel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        }
        
        if (!panel) {
          console.log('fetchFromTranscriptPanel: Panel did not open after clicking');
          resolve({ state: 'error', error: 'Transcript panel did not open' });
          return;
        }
        
        // Wait for content to load
        await waitForTranscriptPanelContent(panel, 5000);
      }
      
      console.log('fetchFromTranscriptPanel: Panel is open, extracting segments...');

      // Try multiple selectors for segments (based on working extensions)
      const segmentSelectors = [
        '.segment',  // Most reliable selector from working extensions
        'ytd-transcript-segment-renderer',
        '[class*="transcript-segment"]',
        'ytd-transcript-body-renderer ytd-transcript-segment-renderer'
      ];

      let segments: NodeListOf<Element> | null = null;
      for (const selector of segmentSelectors) {
        segments = panel.querySelectorAll(selector);
        console.log(`fetchFromTranscriptPanel: Selector "${selector}" found ${segments?.length || 0} elements`);
        if (segments && segments.length > 0) break;
      }

      if ((!segments || segments.length === 0) && !wasPanelOpen) {
        await waitForTranscriptPanelContent(panel, 3000);
        for (const selector of segmentSelectors) {
          segments = panel.querySelectorAll(selector);
          console.log(`fetchFromTranscriptPanel: Retry selector "${selector}" found ${segments?.length || 0} elements`);
          if (segments && segments.length > 0) break;
        }
      }

      if (!segments || segments.length === 0) {
        // Try to get any text content from the panel for debugging
        const panelText = panel.textContent || '';
        console.log('fetchFromTranscriptPanel: No segments found. Panel text preview:', panelText.substring(0, 500));
        resolve({ state: 'error', error: 'No transcript segments found in panel' });
        return;
      }

      console.log('fetchFromTranscriptPanel: Found', segments.length, 'segments, extracting text...');

      // Extract segments with multiple fallback selectors
      const transcriptSegments: TranscriptSegment[] = [];
      
      segments.forEach((segment, index) => {
        // Try multiple selectors for text (from working extensions)
        const textSelectors = [
          '[class*="segment-text"]',  // Most reliable
          '#content',
          '#text',
          '[class*="text"]'
        ];
        
        let text = '';
        for (const selector of textSelectors) {
          const textEl = segment.querySelector(selector);
          if (textEl?.textContent?.trim()) {
            text = textEl.textContent.trim();
            break;
          }
        }
        
        // Fallback: use segment's textContent excluding timestamp
        if (!text) {
          const timestampEl = segment.querySelector('[class*="timestamp"], [class*="time"]');
          const timestampText = timestampEl?.textContent?.trim() || '';
          const segmentText = segment.textContent?.trim() || '';
          text = segmentText.replace(timestampText, '').trim();
        }
        
        // Try multiple selectors for timestamp
        const timestampSelectors = [
          '[class*="segment-timestamp"]',
          '[class*="timestamp"]',
          '[class*="time"]'
        ];
        
        let timestampText = '';
        for (const selector of timestampSelectors) {
          const tsEl = segment.querySelector(selector);
          if (tsEl?.textContent?.trim()) {
            timestampText = tsEl.textContent.trim();
            break;
          }
        }
        
        // Parse timestamp (format: MM:SS or HH:MM:SS)
        const timeMatch = timestampText.match(/(\d+):(\d+)(?::(\d+))?/);
        let startMs = index * 5000; // Fallback: estimate time based on index
        
        if (timeMatch) {
          const hours = parseInt(timeMatch[3] ? timeMatch[1] : '0');
          const minutes = parseInt(timeMatch[3] ? timeMatch[2] : timeMatch[1]);
          const seconds = parseInt(timeMatch[3] ? timeMatch[3] : timeMatch[2]);
          startMs = ((hours * 60 + minutes) * 60 + seconds) * 1000;
        }

        if (text && text.length > 0) {
          transcriptSegments.push({
            startMs,
            durationMs: 5000, // Estimate
            text
          });
        }
      });

      console.log('fetchFromTranscriptPanel: Extracted', transcriptSegments.length, 'segments');

      if (transcriptSegments.length === 0) {
        resolve({ state: 'error', error: 'Could not extract text from segments' });
        return;
      }

      // Close panel if we opened it
      if (!wasPanelOpen) {
        const closeBtn = panel.querySelector('button[aria-label*="close" i], button[aria-label*="Close" i], ytd-button-renderer button');
        if (closeBtn) {
          (closeBtn as HTMLElement).click();
        }
      }

      resolve({
        state: 'success',
        segments: transcriptSegments,
        languageCode: 'unknown',
        languageLabel: 'Unknown',
        sourceType: 'unknown'
      });
    } catch (error) {
      resolve({ 
        state: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error in panel method' 
      });
    }
  });
}

async function findTranscriptButton(): Promise<HTMLElement | null> {
  console.log('findTranscriptButton: Searching for transcript button...');
  
  // Method 1: Direct transcript button (new YouTube UI)
  const directSelectors = [
    'ytd-video-description-transcript-section-renderer button',
    'button[aria-label*="transcript" i]',
    'button[aria-label*="Transcript" i]'
  ];
  
  for (const selector of directSelectors) {
    const btn = document.querySelector(selector) as HTMLElement;
    if (btn && btn.offsetParent !== null) { // Check if visible
      console.log('findTranscriptButton: Found direct button:', selector);
      return btn;
    }
  }
  
  // Method 2: Check in "More actions" menu (three dots)
  const moreButton = document.querySelector('button[aria-label*="more actions" i], button[aria-label*="More actions" i], #button[aria-label*="More" i]');
  if (moreButton) {
    console.log('findTranscriptButton: Found More actions button, checking menu...');
    (moreButton as HTMLElement).click();
    
    // Wait for menu to open
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Look for transcript in the opened menu
    const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item, ytd-menu-renderer [role="menuitem"]');
    for (const item of menuItems) {
      const text = item.textContent?.toLowerCase() || '';
      const ariaLabel = item.getAttribute('aria-label')?.toLowerCase() || '';
      if (text.includes('transcript') || ariaLabel.includes('transcript')) {
        console.log('findTranscriptButton: Found transcript in menu');
        return item as HTMLElement;
      }
    }
    
    // Close menu if not found
    const closeButton = document.querySelector('button[aria-label*="close" i], [aria-label*="Close" i]');
    if (closeButton) {
      (closeButton as HTMLElement).click();
    }
  }
  
  // Method 3: Look in video description
  const descriptionSelectors = [
    '#description-inline-expander',
    '#description',
    'ytd-video-secondary-info-renderer'
  ];
  
  for (const selector of descriptionSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const buttons = container.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('transcript')) {
          console.log('findTranscriptButton: Found transcript button in description');
          return btn as HTMLElement;
        }
      }
    }
  }
  
  console.log('findTranscriptButton: Could not find transcript button');
  return null;
}

async function fetchFromPageHtml(videoId: string, preferredLanguage?: string): Promise<FetchTranscriptResult> {
  try {
    console.log('fetchFromPageHtml: Starting for videoId:', videoId);
    
    const html = await getWatchPageHtml(videoId);
    const tracks = extractCaptionTracksFromHtml(html);

    if (!tracks || tracks.length === 0) {
      return { state: 'unavailable', error: 'No caption tracks found in page HTML' };
    }

    // Select best track
    let selectedTrack: YouTubeCaptionTrack | undefined;
    if (preferredLanguage) {
      selectedTrack = tracks.find(t => t.languageCode === preferredLanguage);
    }
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => !t.kind) || tracks[0];
    }

    if (!selectedTrack?.baseUrl) {
      return { state: 'error', error: 'Selected track has no baseUrl' };
    }

    console.log('fetchFromPageHtml: Selected track:', selectedTrack.languageCode);

    // Fetch transcript using the URL as-is (with session tokens)
    const response = await fetchCaptionTrack(selectedTrack.baseUrl);
    if (!response.ok) {
      return { state: 'error', error: `Failed to fetch: HTTP ${response.status}` };
    }

    const xmlText = await response.text();
    console.log('fetchFromPageHtml: Got XML, length:', xmlText.length);
    
    if (!xmlText || xmlText.trim().length === 0) {
      return { state: 'error', error: 'Empty transcript response' };
    }

    const segments = parseTranscriptResponse(xmlText, response.headers.get('content-type'));
    console.log('fetchFromPageHtml: Parsed', segments.length, 'segments');

    if (segments.length === 0) {
      return { state: 'error', error: 'Parsed transcript contains no segments' };
    }

    return {
      state: 'success',
      segments,
      languageCode: selectedTrack.languageCode,
      languageLabel: selectedTrack.name?.simpleText || selectedTrack.languageCode,
      sourceType: selectedTrack.kind === 'asr' ? 'auto-generated' : 'manual'
    };
  } catch (error) {
    return { 
      state: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error in HTML method' 
    };
  }
}

async function fetchFromInnerTube(videoId: string, preferredLanguage?: string): Promise<FetchTranscriptResult> {
  try {
    console.log('fetchFromInnerTube: Starting for videoId:', videoId);
    
    const html = await getWatchPageHtml(videoId);
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/) || 
                       html.match(/"innertubeApiKey":\s*"([a-zA-Z0-9_-]+)"/);
    
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    console.log('fetchFromInnerTube: Using API key:', apiKey.substring(0, 10) + '...');
    
    // Use ANDROID client (like youtube-transcript-api)
    const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Visitor-Id': '',
      },
      body: JSON.stringify({
        videoId: videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
            hl: preferredLanguage || 'en',
            gl: 'US'
          }
        }
      })
    });

    if (!response.ok) {
      return { state: 'error', error: `InnerTube API error: HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log('fetchFromInnerTube: Got response');
    
    const captions = data?.captions?.playerCaptionsTracklistRenderer;
    
    if (!captions?.captionTracks?.length) {
      return { state: 'unavailable', error: 'No captions in InnerTube response' };
    }

    const tracks: YouTubeCaptionTrack[] = captions.captionTracks;
    let selectedTrack: YouTubeCaptionTrack | undefined;

    if (preferredLanguage) {
      selectedTrack = tracks.find(t => t.languageCode === preferredLanguage);
    }
    if (!selectedTrack) {
      selectedTrack = tracks.find(t => !t.kind) || tracks[0];
    }
    
    if (!selectedTrack?.baseUrl) {
      return { state: 'error', error: 'Selected track has no baseUrl' };
    }

    console.log('fetchFromInnerTube: Selected track:', selectedTrack.languageCode);

    // Use URL as-is (don't reconstruct)
    const transcriptResponse = await fetchCaptionTrack(selectedTrack.baseUrl);
    if (!transcriptResponse.ok) {
      return { state: 'error', error: `Failed to fetch transcript: HTTP ${transcriptResponse.status}` };
    }

    const xmlText = await transcriptResponse.text();
    console.log('fetchFromInnerTube: Got XML, length:', xmlText.length);
    
    if (!xmlText || xmlText.trim().length === 0) {
      return { state: 'error', error: 'Empty transcript response' };
    }
    
    const segments = parseTranscriptResponse(xmlText, transcriptResponse.headers.get('content-type'));
    console.log('fetchFromInnerTube: Parsed', segments.length, 'segments');

    if (segments.length === 0) {
      return { state: 'error', error: 'Parsed transcript contains no segments' };
    }

    return {
      state: 'success',
      segments,
      languageCode: selectedTrack.languageCode,
      languageLabel: selectedTrack.name?.simpleText || selectedTrack.languageCode,
      sourceType: selectedTrack.kind === 'asr' ? 'auto-generated' : 'manual'
    };
  } catch (error) {
    return { 
      state: 'error', 
      error: error instanceof Error ? error.message : 'InnerTube API failed' 
    };
  }
}

async function waitForTranscriptPanelContent(panel: Element, timeoutMs: number): Promise<void> {
  const segmentSelectors = [
    '.segment',
    'ytd-transcript-segment-renderer',
    '[class*="transcript-segment"]',
    'ytd-transcript-body-renderer ytd-transcript-segment-renderer'
  ];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const selector of segmentSelectors) {
      if (panel.querySelector(selector)) {
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

async function getWatchPageHtml(videoId: string): Promise<string> {
  if (cachedWatchPageHtml && cachedWatchPageVideoId === videoId) {
    return cachedWatchPageHtml;
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const response = await fetch(canonicalUrl, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to load watch page HTML: HTTP ${response.status}`);
  }

  const html = await response.text();
  cachedWatchPageHtml = html;
  cachedWatchPageVideoId = videoId;
  return html;
}

function extractCaptionTracksFromHtml(html: string): YouTubeCaptionTrack[] | null {
  const captionsObject = extractJsonBlock(html, '"captions":');
  if (captionsObject) {
    try {
      const captions = JSON.parse(captionsObject) as YouTubePlayerCaptions;
      const tracks = captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks?.length) {
        console.log('extractCaptionTracksFromHtml: Found', tracks.length, 'tracks via captions object');
        return tracks;
      }
    } catch (error) {
      console.log('extractCaptionTracksFromHtml: Failed to parse captions object', error);
    }
  }

  const match = html.match(/"captionTracks":(\[[\s\S]*?\])[,}]/);
  if (!match) {
    return null;
  }

  try {
    const tracks = JSON.parse(match[1]) as YouTubeCaptionTrack[];
    if (tracks.length > 0) {
      console.log('extractCaptionTracksFromHtml: Found', tracks.length, 'tracks via regex fallback');
      return tracks;
    }
  } catch (error) {
    console.log('extractCaptionTracksFromHtml: Failed to parse regex match', error);
  }

  return null;
}

function extractJsonBlock(source: string, marker: string): string | null {
  const startIndex = source.indexOf(marker);
  if (startIndex === -1) {
    return null;
  }

  const jsonStart = source.indexOf('{', startIndex + marker.length);
  if (jsonStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = jsonStart; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(jsonStart, i + 1);
      }
    }
  }

  return null;
}

async function fetchCaptionTrack(baseUrl: string): Promise<Response> {
  const attempts = [baseUrl];
  const parsedUrl = new URL(baseUrl);

  if (!parsedUrl.searchParams.has('fmt')) {
    const json3Url = new URL(baseUrl);
    json3Url.searchParams.set('fmt', 'json3');
    attempts.push(json3Url.toString());

    const srv3Url = new URL(baseUrl);
    srv3Url.searchParams.set('fmt', 'srv3');
    attempts.push(srv3Url.toString());
  }

  let lastResponse: Response | null = null;

  for (const url of attempts) {
    const response = await fetch(url, {
      credentials: 'include'
    });
    const text = await response.clone().text();

    if (response.ok && text.trim().length > 0) {
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }

    lastResponse = response;
  }

  return lastResponse ?? fetch(baseUrl, { credentials: 'include' });
}

function parseTranscriptResponse(responseText: string, contentType: string | null): TranscriptSegment[] {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return [];
  }

  if (contentType?.includes('json') || trimmed.startsWith('{')) {
    const jsonSegments = parseTranscriptJson3(trimmed);
    if (jsonSegments.length > 0) {
      return jsonSegments;
    }
  }

  if (trimmed.startsWith('WEBVTT')) {
    const vttSegments = parseTranscriptVtt(trimmed);
    if (vttSegments.length > 0) {
      return vttSegments;
    }
  }

  return parseTranscriptXml(trimmed);
}

function parseTranscriptJson3(jsonText: string): TranscriptSegment[] {
  try {
    const data = JSON.parse(jsonText) as {
      events?: Array<{
        tStartMs?: number;
        dDurationMs?: number;
        segs?: Array<{ utf8?: string }>;
      }>;
    };

    return (data.events || [])
      .map(event => {
        const text = (event.segs || [])
          .map(segment => segment.utf8 || '')
          .join('')
          .replace(/\n+/g, ' ')
          .trim();

        if (!text) {
          return null;
        }

        return {
          startMs: event.tStartMs || 0,
          durationMs: event.dDurationMs || 0,
          text: decodeHtmlEntities(text)
        };
      })
      .filter((segment): segment is TranscriptSegment => !!segment);
  } catch (error) {
    console.log('parseTranscriptJson3: Failed to parse JSON3 transcript', error);
    return [];
  }
}

function parseTranscriptVtt(vttText: string): TranscriptSegment[] {
  const blocks = vttText.split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const timingLine = lines.find(line => line.includes('-->'));
    if (!timingLine) {
      continue;
    }

    const [startRaw, endRaw] = timingLine.split('-->').map(part => part.trim());
    const text = lines.slice(lines.indexOf(timingLine) + 1).join(' ').trim();
    if (!text) {
      continue;
    }

    const startMs = parseVttTimestamp(startRaw);
    const endMs = parseVttTimestamp(endRaw.split(' ')[0]);
    segments.push({
      startMs,
      durationMs: Math.max(endMs - startMs, 0),
      text: decodeHtmlEntities(text)
    });
  }

  return segments;
}

function parseVttTimestamp(raw: string): number {
  const match = raw.match(/(?:(\d+):)?(\d+):(\d+)\.(\d+)/);
  if (!match) {
    return 0;
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);

  return (((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds;
}

function parseTranscriptXml(xmlText: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  
  if (!xmlText || xmlText.trim().length === 0) {
    console.log('parseTranscriptXml: Empty XML text');
    return segments;
  }
  
  console.log('parseTranscriptXml: Parsing XML, first 300 chars:', xmlText.substring(0, 300));
  
  // Method 1: Try parsing timedtext format (YouTube's standard format)
  // Format: <p t="26080" d="3760"><s ac="0">Text</s>...</p>
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parser errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.log('parseTranscriptXml: XML parse error:', parseError.textContent);
    } else {
      // YouTube timedtext format: <p> elements with t (start ms) and d (duration ms)
      const pElements = doc.querySelectorAll('p[t]');
      console.log('parseTranscriptXml: DOMParser found', pElements.length, 'p elements with t attribute');

      if (pElements.length > 0) {
        pElements.forEach((pElement) => {
          const tAttr = pElement.getAttribute('t');
          const dAttr = pElement.getAttribute('d');
          
          if (tAttr) {
            const startMs = parseInt(tAttr, 10);
            const durationMs = dAttr ? parseInt(dAttr, 10) : 5000;
            
            // Get text from <s> elements or directly from <p>
            let text = '';
            const sElements = pElement.querySelectorAll('s');
            
            if (sElements.length > 0) {
              // Concatenate all <s> elements with their timestamps
              sElements.forEach((s, index) => {
                const stAttr = s.getAttribute('t');
                if (stAttr && index > 0) {
                  // Add space before words with timestamps (except first)
                  text += ' ';
                }
                text += s.textContent || '';
              });
            } else {
              text = pElement.textContent || '';
            }
            
            if (text.trim()) {
              segments.push({
                startMs,
                durationMs,
                text: decodeHtmlEntities(text.trim())
              });
            }
          }
        });

        if (segments.length > 0) {
          console.log('parseTranscriptXml: Successfully parsed', segments.length, 'segments from timedtext format');
          return segments;
        }
      }
    }
  } catch (error) {
    console.log('parseTranscriptXml: DOMParser method failed:', error);
  }
  
  // Method 2: Try legacy <text> format with start/dur attributes
  segments.length = 0; // Clear array
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const textElements = doc.querySelectorAll('text[start]');
    console.log('parseTranscriptXml: DOMParser found', textElements.length, 'text elements with start attribute');

    if (textElements.length > 0) {
      textElements.forEach((element) => {
        const start = parseFloat(element.getAttribute('start') || '0');
        const duration = parseFloat(element.getAttribute('dur') || element.getAttribute('d') || '0');
        const text = element.textContent || '';
        
        if (text.trim()) {
          segments.push({
            startMs: Math.round(start * 1000),
            durationMs: Math.round(duration * 1000),
            text: decodeHtmlEntities(text)
          });
        }
      });

      if (segments.length > 0) {
        console.log('parseTranscriptXml: Successfully parsed', segments.length, 'segments from legacy text format');
        return segments;
      }
    }
  } catch (error) {
    console.log('parseTranscriptXml: Legacy format parsing failed:', error);
  }

  // Method 3: Regex fallback for <p t="..." d="..."> format
  console.log('parseTranscriptXml: Trying regex method for timedtext format');
  segments.length = 0; // Clear array
  
  // Match <p t="start" d="duration"> content </p>
  const pRegex = /<p[^>]*t=["']([^"']+)["'][^>]*(?:d=["']([^"']+)["'])?[^>]*>([^]*?)<\/p>/gi;
  let match;
  let regexCount = 0;
  
  while ((match = pRegex.exec(xmlText)) !== null) {
    regexCount++;
    const startMs = parseInt(match[1], 10);
    const durationMs = match[2] ? parseInt(match[2], 10) : 5000;
    const content = match[3];
    
    // Extract text from <s> tags or use content directly
    let text = '';
    const sRegex = /<s[^>]*>([^]*?)<\/s>/gi;
    let sMatch;
    let sIndex = 0;
    
    while ((sMatch = sRegex.exec(content)) !== null) {
      if (sIndex > 0) text += ' ';
      text += sMatch[1];
      sIndex++;
    }
    
    // If no <s> tags found, use content directly and strip tags
    if (!text) {
      text = content.replace(/<[^>]+>/g, '');
    }
    
    if (text.trim()) {
      segments.push({
        startMs,
        durationMs,
        text: decodeHtmlEntities(text.trim())
      });
    }
  }
  
  console.log('parseTranscriptXml: Regex found', regexCount, 'matches, added', segments.length, 'segments');

  return segments;
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function calculateWordCount(segments: TranscriptSegment[]): number {
  return segments.reduce((count, segment) => {
    return count + segment.text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, 0);
}

export function joinTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map(s => s.text).join(' ');
}
