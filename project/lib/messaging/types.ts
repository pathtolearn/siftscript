import type { 
  MessageType, 
  VideoContext, 
  TranscriptInfo,
  TranscriptSegment,
  ExtensionMessage,
  ExtensionResponse 
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
}

// Helper type to extract payload/response for a specific message type
export type MessagePayload<T extends MessageType> = MessageDefinitions[T]['payload'];
export type MessageResponse<T extends MessageType> = MessageDefinitions[T]['response'];
