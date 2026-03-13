import { db } from '../schema';
import type { Transcript, TranscriptStatus, SearchFilters, SortOption } from '../../../types';

export class TranscriptRepository {
  async getById(transcriptId: string): Promise<Transcript | undefined> {
    return await db.transcripts.get(transcriptId);
  }

  async getByVideoId(videoId: string): Promise<Transcript[]> {
    return await db.transcripts
      .where('videoId')
      .equals(videoId)
      .toArray();
  }

  async getAll(): Promise<Transcript[]> {
    return await db.transcripts.toArray();
  }

  async create(transcript: Transcript): Promise<string> {
    await db.transcripts.put(transcript);
    return transcript.transcriptId;
  }

  async update(transcriptId: string, updates: Partial<Transcript>): Promise<void> {
    await db.transcripts.update(transcriptId, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async delete(transcriptId: string): Promise<void> {
    await db.transcripts.delete(transcriptId);
  }

  async getByVideoAndLanguage(videoId: string, languageCode: string): Promise<Transcript | undefined> {
    return await db.transcripts
      .where({ videoId, languageCode })
      .first();
  }

  async getByCategory(categoryId: string): Promise<Transcript[]> {
    return await db.transcripts
      .where('categoryId')
      .equals(categoryId)
      .toArray();
  }

  async getFavorites(): Promise<Transcript[]> {
    return await db.transcripts
      .where('favorite')
      .equals(1)
      .toArray();
  }

  async getArchived(): Promise<Transcript[]> {
    return await db.transcripts
      .where('archived')
      .equals(1)
      .toArray();
  }

  async getByStatus(status: TranscriptStatus): Promise<Transcript[]> {
    return await db.transcripts
      .where('status')
      .equals(status)
      .toArray();
  }

  async updateLastOpened(transcriptId: string): Promise<void> {
    await this.update(transcriptId, { lastOpenedAt: new Date() });
  }

  async search(query: string): Promise<Transcript[]> {
    const lowerQuery = query.toLowerCase();
    return await db.transcripts
      .filter(transcript => 
        transcript.fullText.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  async getRecent(limit: number = 10): Promise<Transcript[]> {
    return await db.transcripts
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getCount(): Promise<number> {
    return await db.transcripts.count();
  }

  async getStats(): Promise<{
    total: number;
    favorites: number;
    archived: number;
    byStatus: Record<TranscriptStatus, number>;
  }> {
    const all = await this.getAll();
    const favorites = all.filter(t => t.favorite).length;
    const archived = all.filter(t => t.archived).length;
    const byStatus = all.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<TranscriptStatus, number>);

    return {
      total: all.length,
      favorites,
      archived,
      byStatus
    };
  }

  async filterAndSort(
    filters: SearchFilters,
    sort: SortOption = 'newest'
  ): Promise<Transcript[]> {
    let collection = db.transcripts.toCollection();

    // Apply filters
    if (filters.category) {
      collection = db.transcripts.where('categoryId').equals(filters.category);
    }

    if (filters.status) {
      collection = db.transcripts.where('status').equals(filters.status);
    }

    if (filters.favorite !== undefined) {
      collection = db.transcripts.where('favorite').equals(filters.favorite ? 1 : 0);
    }

    if (filters.archived !== undefined) {
      collection = db.transcripts.where('archived').equals(filters.archived ? 1 : 0);
    }

    // Get filtered results
    let results = await collection.toArray();

    // Apply additional filters that can't be indexed
    if (filters.language) {
      results = results.filter(t => t.languageCode === filters.language);
    }

    if (filters.channel) {
      // Need to join with videos for this
      const videos = await db.videos.toArray();
      const videoIds = videos
        .filter(v => v.channelTitle === filters.channel)
        .map(v => v.videoId);
      results = results.filter(t => videoIds.includes(t.videoId));
    }

    if (filters.dateFrom || filters.dateTo) {
      results = results.filter(t => {
        const date = t.createdAt;
        if (filters.dateFrom && date < filters.dateFrom) return false;
        if (filters.dateTo && date > filters.dateTo) return false;
        return true;
      });
    }

    // Apply sorting
    results.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'recentlyOpened':
          return (b.lastOpenedAt?.getTime() || 0) - (a.lastOpenedAt?.getTime() || 0);
        case 'titleAsc':
          return 0; // Need to join with videos
        case 'titleDesc':
          return 0; // Need to join with videos
        case 'longest':
          return b.wordCount - a.wordCount;
        case 'shortest':
          return a.wordCount - b.wordCount;
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    return results;
  }

  async exists(videoId: string, languageCode: string): Promise<boolean> {
    const transcript = await this.getByVideoAndLanguage(videoId, languageCode);
    return !!transcript;
  }
}

export const transcriptRepository = new TranscriptRepository();
