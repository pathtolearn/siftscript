import type { TranscriptInfo, TranscriptSegment, FetchState } from '../../types';

interface YouTubeCaptionTrack {
  baseUrl: string;
  name?: { simpleText: string };
  vssId?: string;
  languageCode: string;
  kind?: string;
  isTranslatable: boolean;
}

interface YouTubePlayerResponse {
  captions?: {
    captionTracks?: YouTubeCaptionTrack[];
    translationLanguages?: Array<{ languageCode: string; languageName: { simpleText: string } }>;
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

export async function checkTranscriptAvailability(): Promise<TranscriptInfo> {
  try {
    const tracks = await getCaptionTracks();
    
    if (!tracks || tracks.length === 0) {
      return {
        available: false,
        languageCode: null,
        languageLabel: null,
        sourceType: 'unknown'
      };
    }

    // Prefer manual captions over auto-generated
    const preferredTrack = tracks.find(t => !t.kind) || tracks[0];
    
    return {
      available: true,
      languageCode: preferredTrack.languageCode,
      languageLabel: preferredTrack.name?.simpleText || preferredTrack.languageCode,
      sourceType: preferredTrack.kind === 'asr' ? 'auto-generated' : 'manual'
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
  try {
    const tracks = await getCaptionTracks();
    
    if (!tracks || tracks.length === 0) {
      return {
        state: 'unavailable',
        error: 'No transcript available for this video'
      };
    }

    // Select the best track
    let selectedTrack: YouTubeCaptionTrack | undefined;

    if (preferredLanguage) {
      // Try to find the preferred language
      selectedTrack = tracks.find(t => t.languageCode === preferredLanguage);
    }

    if (!selectedTrack) {
      // Prefer manual captions
      selectedTrack = tracks.find(t => !t.kind) || tracks[0];
    }

    // Fetch the transcript XML
    const response = await fetch(selectedTrack.baseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }

    const xmlText = await response.text();
    const segments = parseTranscriptXml(xmlText);

    return {
      state: 'success',
      segments,
      languageCode: selectedTrack.languageCode,
      languageLabel: selectedTrack.name?.simpleText || selectedTrack.languageCode,
      sourceType: selectedTrack.kind === 'asr' ? 'auto-generated' : 'manual'
    };
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return {
      state: 'error',
      error: error instanceof Error ? error.message : 'Unknown error fetching transcript'
    };
  }
}

async function getCaptionTracks(): Promise<YouTubeCaptionTrack[] | null> {
  // Try to extract from ytInitialPlayerResponse
  const playerResponse = getPlayerResponse();
  
  if (!playerResponse?.captions?.captionTracks) {
    return null;
  }

  return playerResponse.captions.captionTracks;
}

function getPlayerResponse(): YouTubePlayerResponse | null {
  // Try to get from window object
  if ((window as unknown as { ytInitialPlayerResponse?: YouTubePlayerResponse }).ytInitialPlayerResponse) {
    return (window as unknown as { ytInitialPlayerResponse: YouTubePlayerResponse }).ytInitialPlayerResponse;
  }

  // Try to parse from script tags
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (match) {
      try {
        return JSON.parse(match[1]) as YouTubePlayerResponse;
      } catch {
        continue;
      }
    }
  }

  return null;
}

function parseTranscriptXml(xmlText: string): TranscriptSegment[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const textElements = doc.querySelectorAll('text');

  const segments: TranscriptSegment[] = [];
  
  textElements.forEach((element, index) => {
    const start = parseFloat(element.getAttribute('start') || '0');
    const duration = parseFloat(element.getAttribute('dur') || '0');
    const text = element.textContent || '';
    
    // Decode HTML entities
    const decodedText = decodeHtmlEntities(text);

    segments.push({
      startMs: Math.round(start * 1000),
      durationMs: Math.round(duration * 1000),
      text: decodedText
    });
  });

  return segments;
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function calculateWordCount(segments: TranscriptSegment[]): number {
  return segments.reduce((count, segment) => {
    return count + segment.text.trim().split(/\s+/).length;
  }, 0);
}

export function joinTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map(s => s.text).join(' ');
}
