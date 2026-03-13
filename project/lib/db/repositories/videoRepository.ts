import { db } from '../schema';
import type { Video } from '../../../types';

export class VideoRepository {
  async getById(videoId: string): Promise<Video | undefined> {
    return await db.videos.get(videoId);
  }

  async getAll(): Promise<Video[]> {
    return await db.videos.toArray();
  }

  async create(video: Video): Promise<string> {
    await db.videos.put(video);
    return video.videoId;
  }

  async update(videoId: string, updates: Partial<Video>): Promise<void> {
    await db.videos.update(videoId, {
      ...updates,
      lastSeenAt: new Date()
    });
  }

  async delete(videoId: string): Promise<void> {
    await db.videos.delete(videoId);
  }

  async upsert(video: Video): Promise<string> {
    const existing = await this.getById(video.videoId);
    if (existing) {
      await this.update(video.videoId, video);
    } else {
      await this.create(video);
    }
    return video.videoId;
  }

  async searchByTitle(query: string): Promise<Video[]> {
    return await db.videos
      .filter(video => 
        video.title.toLowerCase().includes(query.toLowerCase())
      )
      .toArray();
  }

  async getByChannel(channelTitle: string): Promise<Video[]> {
    return await db.videos
      .where('channelTitle')
      .equals(channelTitle)
      .toArray();
  }
}

export const videoRepository = new VideoRepository();
