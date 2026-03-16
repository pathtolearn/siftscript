import { db } from '../schema';
import type { Segment } from '../../../types';

export class SegmentRepository {
  async getById(segmentId: string): Promise<Segment | undefined> {
    return await db.segments.get(segmentId);
  }

  async getByTranscriptId(transcriptId: string): Promise<Segment[]> {
    return await db.segments
      .where('transcriptId')
      .equals(transcriptId)
      .sortBy('sequence');
  }

  async create(segment: Segment): Promise<string> {
    await db.segments.put(segment);
    return segment.segmentId;
  }

  async createMany(segments: Segment[]): Promise<void> {
    await db.segments.bulkPut(segments);
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    const segments = await this.getByTranscriptId(transcriptId);
    const ids = segments.map(s => s.segmentId);
    await db.segments.bulkDelete(ids);
  }

  async getCountByTranscript(transcriptId: string): Promise<number> {
    return await db.segments
      .where('transcriptId')
      .equals(transcriptId)
      .count();
  }

  async searchInTranscript(transcriptId: string, query: string): Promise<Segment[]> {
    const lowerQuery = query.toLowerCase();
    return await db.segments
      .where('transcriptId')
      .equals(transcriptId)
      .filter(segment =>
        segment.text.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  async searchAcrossTranscripts(query: string): Promise<Map<string, Segment[]>> {
    const lowerQuery = query.toLowerCase();
    const matching = await db.segments
      .filter(segment => segment.text.toLowerCase().includes(lowerQuery))
      .toArray();

    const grouped = new Map<string, Segment[]>();
    for (const segment of matching) {
      const existing = grouped.get(segment.transcriptId) || [];
      existing.push(segment);
      grouped.set(segment.transcriptId, existing);
    }
    return grouped;
  }
}

export const segmentRepository = new SegmentRepository();
