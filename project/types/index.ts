// Video types
export interface Video {
  videoId: string;
  url: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: Date;
  durationText: string;
  lastSeenAt: Date;
}

// Transcript types
export type TranscriptSourceType = 'manual' | 'auto-generated' | 'unknown';
export type TranscriptStatus = 'unread' | 'in-review' | 'reviewed' | 'archived';
export type FetchState = 'success' | 'unavailable' | 'disabled' | 'language-unavailable' | 'error';

export interface Transcript {
  transcriptId: string;
  videoId: string;
  languageCode: string;
  languageLabel: string;
  sourceType: TranscriptSourceType;
  fullText: string;
  segmentCount: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date;
  status: TranscriptStatus;
  favorite: boolean;
  archived: boolean;
  categoryId: string | null;
  notes: string;
  fetchState: FetchState;
  fetchErrorCode: string | null;
}

// Segment types
export interface Segment {
  segmentId: string;
  transcriptId: string;
  sequence: number;
  startMs: number;
  durationMs: number;
  text: string;
}

// Category types
export interface Category {
  categoryId: string;
  name: string;
  colorToken: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tag types
export interface Tag {
  tagId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptTag {
  id: string;
  transcriptId: string;
  tagId: string;
}

// Settings types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultLanguage: string;
  dashboardDensity: 'compact' | 'comfortable';
  defaultCategoryId: string | null;
}

// Message types
export type MessageType = 
  | 'GET_CURRENT_VIDEO_CONTEXT'
  | 'FETCH_TRANSCRIPT'
  | 'SAVE_TRANSCRIPT'
  | 'REFETCH_TRANSCRIPT'
  | 'OPEN_DASHBOARD'
  | 'EXPORT_DATA'
  | 'PING';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ExtensionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// YouTube types
export interface VideoContext {
  videoId: string;
  url: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string | null;
  durationText: string;
  isWatchPage: boolean;
}

export interface TranscriptInfo {
  available: boolean;
  languageCode: string | null;
  languageLabel: string | null;
  sourceType: TranscriptSourceType;
}

export interface TranscriptSegment {
  startMs: number;
  durationMs: number;
  text: string;
}

// Search types
export interface SearchFilters {
  category?: string;
  tag?: string;
  status?: TranscriptStatus;
  language?: string;
  channel?: string;
  sourceType?: TranscriptSourceType;
  dateFrom?: Date;
  dateTo?: Date;
  favorite?: boolean;
  archived?: boolean;
}

export type SortOption = 
  | 'newest'
  | 'oldest'
  | 'recentlyOpened'
  | 'titleAsc'
  | 'titleDesc'
  | 'channelAsc'
  | 'longest'
  | 'shortest';

// UI types
export interface TranscriptListItem {
  transcriptId: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  categoryName: string | null;
  tags: string[];
  createdAt: Date;
  languageCode: string;
  status: TranscriptStatus;
  favorite: boolean;
  archived: boolean;
  wordCount: number;
}

// Export types
export type ExportFormat = 'json' | 'txt' | 'csv' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  transcriptIds?: string[];
  includeMetadata?: boolean;
  includeSegments?: boolean;
}
