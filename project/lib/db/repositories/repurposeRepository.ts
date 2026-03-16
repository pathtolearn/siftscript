import { db } from '../schema';
import type { RepurposedContent, RepurposeType } from '../../../types';

export class RepurposeRepository {
  async getById(repurposeId: string): Promise<RepurposedContent | undefined> {
    return await db.repurposedContent.get(repurposeId);
  }

  async getByTranscriptId(transcriptId: string): Promise<RepurposedContent[]> {
    return await db.repurposedContent
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
  }

  async getByTranscriptAndType(transcriptId: string, type: RepurposeType): Promise<RepurposedContent | undefined> {
    return await db.repurposedContent
      .where('transcriptId')
      .equals(transcriptId)
      .filter(r => r.type === type)
      .first();
  }

  async create(content: Omit<RepurposedContent, 'repurposeId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date();
    const id = `repurpose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const full: RepurposedContent = {
      ...content,
      repurposeId: id,
      createdAt: now,
      updatedAt: now,
    };
    await db.repurposedContent.put(full);
    return id;
  }

  async delete(repurposeId: string): Promise<void> {
    await db.repurposedContent.delete(repurposeId);
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    await db.repurposedContent
      .where('transcriptId')
      .equals(transcriptId)
      .delete();
  }
}

export const repurposeRepository = new RepurposeRepository();
