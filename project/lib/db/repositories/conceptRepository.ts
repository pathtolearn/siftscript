import { db } from '../schema';
import type { Concept } from '../../../types';

export class ConceptRepository {
  /** Replace all concepts for a transcript (idempotent — safe to re-run) */
  async saveForTranscript(concepts: Concept[]): Promise<void> {
    if (concepts.length === 0) return;
    const transcriptId = concepts[0].transcriptId;
    await db.transaction('rw', db.concepts, async () => {
      await db.concepts.where('transcriptId').equals(transcriptId).delete();
      await db.concepts.bulkPut(concepts);
    });
  }

  async getByTranscriptId(transcriptId: string): Promise<Concept[]> {
    return db.concepts.where('transcriptId').equals(transcriptId).toArray();
  }

  /** All concepts grouped by normalizedLabel — used for cluster building */
  async getAllGroupedByLabel(): Promise<Map<string, Concept[]>> {
    const all = await db.concepts.toArray();
    const map = new Map<string, Concept[]>();
    for (const c of all) {
      const key = c.normalizedLabel;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }

  async getByChannelId(channelId: string): Promise<Concept[]> {
    return db.concepts.where('channelId').equals(channelId).toArray();
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    await db.concepts.where('transcriptId').equals(transcriptId).delete();
  }

  async hasExtraction(transcriptId: string): Promise<boolean> {
    const count = await db.concepts.where('transcriptId').equals(transcriptId).count();
    return count > 0;
  }

  async countAll(): Promise<number> {
    return db.concepts.count();
  }

  /** IDs of transcripts that have no concepts extracted yet */
  async getUnextractedTranscriptIds(allTranscriptIds: string[]): Promise<string[]> {
    const extracted = new Set(
      await db.concepts.orderBy('transcriptId').uniqueKeys()
    );
    return allTranscriptIds.filter(id => !extracted.has(id));
  }
}

export const conceptRepository = new ConceptRepository();
