import { messaging } from '../lib/messaging/messaging';
import { 
  isYouTubeWatchPage, 
  waitForVideoMetadata, 
  setupPageChangeListener,
  extractVideoContext
} from '../lib/youtube/pageDetector';
import { checkTranscriptAvailability, fetchTranscript } from '../lib/youtube/fetchTranscript';
import type { GetCurrentVideoContextPayload, FetchTranscriptPayload } from '../lib/messaging/types';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  runAt: 'document_end',
  main() {
    console.log('YouTube Transcript Manager: Content script loaded');

    // Track current video context and transcript availability
    let currentContext = extractVideoContext();
    let transcriptInfo: { available: boolean; languageCode: string | null } | null = null;

    // Register message handlers for content script
    messaging.registerHandler('GET_CURRENT_VIDEO_CONTEXT', async (_payload: GetCurrentVideoContextPayload) => {
      if (!currentContext) {
        currentContext = await waitForVideoMetadata();
      }
      
      // Also check transcript availability
      if (currentContext && !transcriptInfo) {
        try {
          const info = await checkTranscriptAvailability();
          transcriptInfo = {
            available: info.available,
            languageCode: info.languageCode
          };
        } catch (error) {
          console.error('Error checking transcript availability:', error);
          transcriptInfo = { available: false, languageCode: null };
        }
      }
      
      return { 
        context: currentContext,
        transcriptAvailable: transcriptInfo?.available || false
      };
    });

    messaging.registerHandler('FETCH_TRANSCRIPT', async (payload: FetchTranscriptPayload) => {
      console.log('Fetching transcript for video:', payload.videoId);
      
      const result = await fetchTranscript(payload.videoId, payload.languageCode);
      
      if (result.state !== 'success') {
        console.error('Transcript fetch failed:', result.error);
        throw new Error(result.error || 'Failed to fetch transcript');
      }

      console.log('Transcript fetched successfully:', {
        segments: result.segments?.length,
        language: result.languageCode,
        sourceType: result.sourceType
      });

      return {
        segments: result.segments!,
        languageCode: result.languageCode!,
        languageLabel: result.languageLabel!,
        sourceType: result.sourceType!
      };
    });

    // Setup message listener
    messaging.setupContentScriptListener();

    // Setup page change detection
    setupPageChangeListener(async (context) => {
      currentContext = context;
      transcriptInfo = null;
      
      if (context) {
        try {
          const info = await checkTranscriptAvailability();
          transcriptInfo = {
            available: info.available,
            languageCode: info.languageCode
          };
          console.log('Transcript availability:', info);
        } catch (error) {
          console.error('Error checking transcript availability:', error);
        }
      }
      
      console.log('Video context updated:', context);
    });

    // Initial check
    if (isYouTubeWatchPage()) {
      waitForVideoMetadata().then(async (context) => {
        currentContext = context;
        console.log('Initial video context:', context);
        
        if (context) {
          try {
            const info = await checkTranscriptAvailability();
            transcriptInfo = {
              available: info.available,
              languageCode: info.languageCode
            };
            console.log('Initial transcript availability:', info);
          } catch (error) {
            console.error('Error checking initial transcript availability:', error);
          }
        }
      });
    }
  },
});
