import { db } from '../schema';
import type { Chapter } from '../../../types';

export class ChapterRepository {
  async getByTranscriptId(transcriptId: string): Promise<Chapter[]> {
    return await db.chapters
      .where('transcriptId')
      .equals(transcriptId)
      .sortBy('sequence');
  }

  async create(chapter: Omit<Chapter, 'chapterId' | 'createdAt'>): Promise<string> {
    const now = new Date();
    const id = `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const full: Chapter = {
      ...chapter,
      chapterId: id,
      createdAt: now,
    };
    await db.chapters.put(full);
    return id;
  }

  async createMany(chapters: Omit<Chapter, 'chapterId' | 'createdAt'>[]): Promise<void> {
    const now = new Date();
    const full: Chapter[] = chapters.map((ch, i) => ({
      ...ch,
      chapterId: `chapter-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
    }));
    await db.chapters.bulkPut(full);
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    await db.chapters
      .where('transcriptId')
      .equals(transcriptId)
      .delete();
  }
}

export const chapterRepository = new ChapterRepository();
