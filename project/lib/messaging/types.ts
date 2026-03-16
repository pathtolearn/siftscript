import type {
  MessageType,
  VideoContext,
  TranscriptInfo,
  TranscriptSegment,
  ExtensionMessage,
  ExtensionResponse,
  BulkExtractProgress
} from '../../types';

// Message payloads
export interface GetCurrentVideoContextPayload {}

export interface GetCurrentVideoContextResponse {
  context: VideoContext | null;
}

export interface FetchTranscriptPayload {
  videoId: string;
  languageCode?: string;
}

export interface FetchTranscriptResponse {
  segments: TranscriptSegment[];
  languageCode: string;
  languageLabel: string;
  sourceType: 'manual' | 'auto-generated' | 'unknown';
}

export interface SaveTranscriptPayload {
  videoContext: VideoContext;
  segments: TranscriptSegment[];
  languageCode: string;
  languageLabel: string;
  sourceType: 'manual' | 'auto-generated' | 'unknown';
  categoryId?: string;
}

export interface SaveTranscriptResponse {
  transcriptId: string;
  isNew: boolean;
}

export interface RefetchTranscriptPayload {
  transcriptId: string;
  mode: 'overwrite' | 'new-version';
}

export interface OpenDashboardPayload {
  route?: string;
}

export interface ExportDataPayload {
  format: 'json' | 'txt';
  transcriptId?: string;
}

// Type-safe message definitions
export interface MessageDefinitions {
  GET_CURRENT_VIDEO_CONTEXT: {
    payload: GetCurrentVideoContextPayload;
    response: GetCurrentVideoContextResponse;
  };
  FETCH_TRANSCRIPT: {
    payload: FetchTranscriptPayload;
    response: FetchTranscriptResponse;
  };
  SAVE_TRANSCRIPT: {
    payload: SaveTranscriptPayload;
    response: SaveTranscriptResponse;
  };
  REFETCH_TRANSCRIPT: {
    payload: RefetchTranscriptPayload;
    response: { success: boolean };
  };
  OPEN_DASHBOARD: {
    payload: OpenDashboardPayload;
    response: void;
  };
  EXPORT_DATA: {
    payload: ExportDataPayload;
    response: { data: string; filename: string };
  };
  PING: {
    payload: {};
    response: { pong: true };
  };
  GET_SIDEBAR_DATA: {
    payload: { videoId: string };
    response: {
      transcript: { transcriptId: string; videoId: string; wordCount: number; notes: string } | null;
      video: { title: string; channelTitle: string } | null;
      segments: Array<{ segmentId: string; startMs: number; text: string }>;
      annotations: Array<{ annotationId: string; segmentId: string; color: string; note: string }>;
    };
  };
  SAVE_SIDEBAR_NOTES: {
    payload: { transcriptId: string; notes: string };
    response: null;
  };
  BULK_EXTRACT_START: {
    payload: BulkExtractStartPayload;
    response: { requestId: string };
  };
  BULK_EXTRACT_STATUS: {
    payload: BulkExtractStatusPayload;
    response: { progress: BulkExtractProgress | null };
  };
  BULK_EXTRACT_CANCEL: {
    payload: BulkExtractCancelPayload;
    response: { cancelled: boolean };
  };
}

// Bulk extract types
export interface BulkExtractStartPayload {
  url: string;
  videoIds?: string[];
}

export interface BulkExtractStatusPayload {
  requestId: string;
}

export interface BulkExtractCancelPayload {
  requestId: string;
}

// Helper type to extract payload/response for a specific message type
export type MessagePayload<T extends MessageType> = MessageDefinitions[T]['payload'];
export type MessageResponse<T extends MessageType> = MessageDefinitions[T]['response'];
