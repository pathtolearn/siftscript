import { db } from '../schema';
import type { ConceptCluster } from '../../../types';

export class ConceptClusterRepository {
  /** Atomic replace — called after every graph rebuild */
  async replaceAll(clusters: ConceptCluster[]): Promise<void> {
    await db.transaction('rw', db.conceptClusters, async () => {
      await db.conceptClusters.clear();
      if (clusters.length > 0) {
        await db.conceptClusters.bulkPut(clusters);
      }
    });
  }

  async getAll(): Promise<ConceptCluster[]> {
    return db.conceptClusters
      .orderBy('totalMentions')
      .reverse()
      .toArray();
  }

  /** Clusters appearing in minTranscripts or more — the meaningful connections */
  async getCrossTranscript(minTranscripts = 2): Promise<ConceptCluster[]> {
    const all = await this.getAll();
    return all.filter(c => c.transcriptIds.length >= minTranscripts);
  }

  async getByNormalizedLabel(label: string): Promise<ConceptCluster | undefined> {
    return db.conceptClusters.where('normalizedLabel').equals(label).first();
  }

  async count(): Promise<number> {
    return db.conceptClusters.count();
  }

  async countCrossTranscript(minTranscripts = 2): Promise<number> {
    const clusters = await this.getCrossTranscript(minTranscripts);
    return clusters.length;
  }
}

export const conceptClusterRepository = new ConceptClusterRepository();
