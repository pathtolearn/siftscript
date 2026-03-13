export { 
  isYouTubeWatchPage, 
  getVideoIdFromUrl, 
  extractVideoContext, 
  waitForVideoMetadata,
  setupPageChangeListener 
} from './pageDetector';

export { 
  checkTranscriptAvailability, 
  fetchTranscript,
  calculateWordCount,
  joinTranscriptText
} from './fetchTranscript';

export type { FetchTranscriptResult } from './fetchTranscript';
