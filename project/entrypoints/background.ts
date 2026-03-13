import { messaging } from '../lib/messaging/messaging';
import { initializeDatabase } from '../lib/db/schema';
import { videoRepository } from '../lib/db/repositories/videoRepository';
import { transcriptRepository } from '../lib/db/repositories/transcriptRepository';
import { segmentRepository } from '../lib/db/repositories/segmentRepository';
import { categoryRepository } from '../lib/db/repositories/categoryRepository';
import type { 
  SaveTranscriptPayload,
  OpenDashboardPayload,
  FetchTranscriptPayload
} from '../lib/messaging/types';
import type { Video, Transcript, Segment } from '../types';

// Initialize database on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error instanceof Error ? error.message : JSON.stringify(error));
  }
});

// Setup message handlers
export default defineBackground(() => {
  console.log('Background script started');

  // Initialize database
  initializeDatabase().catch(console.error);

  // Register message handlers
  messaging.registerHandler('GET_CURRENT_VIDEO_CONTEXT', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { context: null };
    }

    try {
      const response = await messaging.sendMessageToTab(tab.id, 'GET_CURRENT_VIDEO_CONTEXT', {});
      return response;
    } catch {
      return { context: null };
    }
  });

  messaging.registerHandler('FETCH_TRANSCRIPT', async (payload: FetchTranscriptPayload) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    try {
      const response = await messaging.sendMessageToTab(tab.id, 'FETCH_TRANSCRIPT', payload);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch transcript from content script');
    }
  });

  messaging.registerHandler('SAVE_TRANSCRIPT', async (payload: SaveTranscriptPayload) => {
    const { videoContext, segments, languageCode, languageLabel, sourceType, categoryId } = payload;

    // Validate that we have transcript data
    if (!segments || segments.length === 0) {
      throw new Error('Cannot save transcript: No transcript segments available');
    }

    // Check for existing transcript
    const existingTranscript = await transcriptRepository.getByVideoAndLanguage(
      videoContext.videoId,
      languageCode
    );

    const now = new Date();
    const isNew = !existingTranscript;

    // Save video metadata
    const video: Video = {
      videoId: videoContext.videoId,
      url: videoContext.url,
      title: videoContext.title,
      channelId: videoContext.channelId,
      channelTitle: videoContext.channelTitle,
      thumbnailUrl: videoContext.thumbnailUrl,
      publishedAt: videoContext.publishedAt ? new Date(videoContext.publishedAt) : now,
      durationText: videoContext.durationText,
      lastSeenAt: now
    };
    await videoRepository.upsert(video);

    // Get or create uncategorized category
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const uncategorized = await categoryRepository.getOrCreateUncategorized();
      finalCategoryId = uncategorized.categoryId;
    }

    // Calculate metadata
    const fullText = segments.map(s => s.text).join(' ');
    const wordCount = fullText.split(/\s+/).length;

    if (existingTranscript) {
      // Update existing transcript
      await transcriptRepository.update(existingTranscript.transcriptId, {
        fullText,
        segmentCount: segments.length,
        wordCount,
        updatedAt: now,
        fetchState: 'success',
        fetchErrorCode: null
      });

      // Delete old segments and add new ones
      await segmentRepository.deleteByTranscriptId(existingTranscript.transcriptId);
      
      const newSegments: Segment[] = segments.map((seg, index) => ({
        segmentId: `${existingTranscript.transcriptId}-seg-${index}`,
        transcriptId: existingTranscript.transcriptId,
        sequence: index,
        startMs: seg.startMs,
        durationMs: seg.durationMs,
        text: seg.text
      }));
      await segmentRepository.createMany(newSegments);

      return { 
        transcriptId: existingTranscript.transcriptId,
        isNew: false
      };
    } else {
      // Create new transcript
      const transcriptId = `transcript-${videoContext.videoId}-${languageCode}-${Date.now()}`;
      
      const transcript: Transcript = {
        transcriptId,
        videoId: videoContext.videoId,
        languageCode,
        languageLabel,
        sourceType,
        fullText,
        segmentCount: segments.length,
        wordCount,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        status: 'unread',
        favorite: false,
        archived: false,
        categoryId: finalCategoryId,
        notes: '',
        fetchState: 'success',
        fetchErrorCode: null
      };
      await transcriptRepository.create(transcript);

      // Save segments
      const newSegments: Segment[] = segments.map((seg, index) => ({
        segmentId: `${transcriptId}-seg-${index}`,
        transcriptId,
        sequence: index,
        startMs: seg.startMs,
        durationMs: seg.durationMs,
        text: seg.text
      }));
      await segmentRepository.createMany(newSegments);

      return { 
        transcriptId,
        isNew: true
      };
    }
  });

  messaging.registerHandler('OPEN_DASHBOARD', async (payload: OpenDashboardPayload) => {
    const url = chrome.runtime.getURL(`options.html${payload.route || ''}`);
    await chrome.tabs.create({ url });
  });

  messaging.registerHandler('PING', async () => {
    return { pong: true };
  });

  // Setup message listener
  messaging.setupMessageListener();
});
