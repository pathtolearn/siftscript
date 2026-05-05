import { db } from '../schema';
import type { CrossAnalysis } from '../../../types';

export const crossAnalysisRepository = {
  async getById(crossAnalysisId: string): Promise<CrossAnalysis | undefined> {
    return db.crossAnalyses.get(crossAnalysisId);
  },

  async getAll(): Promise<CrossAnalysis[]> {
    return db.crossAnalyses.orderBy('createdAt').reverse().toArray();
  },

  async create(analysis: CrossAnalysis): Promise<string> {
    await db.crossAnalyses.put(analysis);
    return analysis.crossAnalysisId;
  },

  async delete(crossAnalysisId: string): Promise<void> {
    await db.crossAnalyses.delete(crossAnalysisId);
  },

  async getByTranscriptId(transcriptId: string): Promise<CrossAnalysis[]> {
    const all = await db.crossAnalyses.toArray();
    return all.filter(a => a.transcriptIds.includes(transcriptId));
  },
};
