import Dexie, { Table } from 'dexie';
import type { 
  Video, 
  Transcript, 
  Segment, 
  Category, 
  Tag, 
  TranscriptTag,
  AppSettings 
} from '../../types';

export class TranscriptDatabase extends Dexie {
  videos!: Table<Video>;
  transcripts!: Table<Transcript>;
  segments!: Table<Segment>;
  categories!: Table<Category>;
  tags!: Table<Tag>;
  transcriptTags!: Table<TranscriptTag>;
  settings!: Table<{ key: string; value: unknown }>;

  constructor() {
    super('YouTubeTranscriptManager');
    
    this.version(1).stores({
      videos: 'videoId, title, channelTitle, publishedAt, lastSeenAt',
      transcripts: 'transcriptId, videoId, languageCode, status, favorite, archived, categoryId, createdAt, updatedAt, lastOpenedAt',
      segments: 'segmentId, transcriptId, sequence, [transcriptId+sequence]',
      categories: 'categoryId, name',
      tags: 'tagId, name',
      transcriptTags: 'id, transcriptId, tagId, [transcriptId+tagId]',
      settings: 'key'
    });
  }
}

export const db = new TranscriptDatabase();

// Default categories
export const DEFAULT_CATEGORIES: Omit<Category, 'categoryId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Uncategorized', colorToken: 'gray' },
  { name: 'Research', colorToken: 'blue' },
  { name: 'Learning', colorToken: 'green' },
  { name: 'Entertainment', colorToken: 'purple' },
  { name: 'Work', colorToken: 'orange' }
];

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultLanguage: 'en',
  dashboardDensity: 'comfortable',
  defaultCategoryId: null
};

// Initialize database with defaults
export async function initializeDatabase(): Promise<void> {
  try {
    // Check if categories exist
    const categoryCount = await db.categories.count();
    if (categoryCount === 0) {
      const now = new Date();
      await db.categories.bulkPut(
        DEFAULT_CATEGORIES.map((cat, index) => ({
          ...cat,
          categoryId: `default-${index}`,
          createdAt: now,
          updatedAt: now
        }))
      );
    }
  } catch (error) {
    console.warn('Category initialization skipped:', error instanceof Error ? error.message : error);
  }

  try {
    // Check if settings exist
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.bulkPut(
        Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
          key,
          value
        }))
      );
    }
  } catch (error) {
    console.warn('Settings initialization skipped:', error instanceof Error ? error.message : error);
  }
}

// Migration helpers
export async function runMigrations(): Promise<void> {
  // Future migrations will go here
  console.log('Database migrations completed');
}
