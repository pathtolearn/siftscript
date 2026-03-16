import { db } from '../schema';
import type { Summary } from '../../../types';

export class SummaryRepository {
  async getById(summaryId: string): Promise<Summary | undefined> {
    return await db.summaries.get(summaryId);
  }

  async getByTranscriptId(transcriptId: string): Promise<Summary[]> {
    return await db.summaries
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
  }

  async getLatestByTranscriptId(transcriptId: string): Promise<Summary | undefined> {
    const summaries = await db.summaries
      .where('transcriptId')
      .equals(transcriptId)
      .reverse()
      .sortBy('createdAt');
    return summaries[0];
  }

  async create(summary: Omit<Summary, 'summaryId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date();
    const id = `sum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const full: Summary = {
      ...summary,
      summaryId: id,
      createdAt: now,
      updatedAt: now
    };
    await db.summaries.put(full);
    return id;
  }

  async delete(summaryId: string): Promise<void> {
    await db.summaries.delete(summaryId);
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    await db.summaries
      .where('transcriptId')
      .equals(transcriptId)
      .delete();
  }
}

export const summaryRepository = new SummaryRepository();
