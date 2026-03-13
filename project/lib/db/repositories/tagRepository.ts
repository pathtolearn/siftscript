import { db } from '../schema';
import type { Tag, TranscriptTag } from '../../../types';

export class TagRepository {
  async getById(tagId: string): Promise<Tag | undefined> {
    return await db.tags.get(tagId);
  }

  async getAll(): Promise<Tag[]> {
    return await db.tags.toArray();
  }

  async create(tag: Tag): Promise<string> {
    await db.tags.put(tag);
    return tag.tagId;
  }

  async update(tagId: string, updates: Partial<Tag>): Promise<void> {
    await db.tags.update(tagId, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async delete(tagId: string): Promise<void> {
    // Remove all associations first
    await db.transcriptTags
      .where('tagId')
      .equals(tagId)
      .delete();
    
    await db.tags.delete(tagId);
  }

  async getByName(name: string): Promise<Tag | undefined> {
    return await db.tags
      .where('name')
      .equals(name)
      .first();
  }

  async findOrCreateByName(name: string): Promise<Tag> {
    let tag = await this.getByName(name);
    if (!tag) {
      const now = new Date();
      tag = {
        tagId: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        createdAt: now,
        updatedAt: now
      };
      await this.create(tag);
    }
    return tag;
  }

  async search(query: string): Promise<Tag[]> {
    const lowerQuery = query.toLowerCase();
    return await db.tags
      .filter(tag => 
        tag.name.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  // Transcript-Tag relationships
  async addTagToTranscript(transcriptId: string, tagId: string): Promise<void> {
    // Check if already exists
    const existing = await db.transcriptTags
      .where({ transcriptId, tagId })
      .first();
    
    if (!existing) {
      await db.transcriptTags.put({
        id: `${transcriptId}-${tagId}`,
        transcriptId,
        tagId
      });
    }
  }

  async removeTagFromTranscript(transcriptId: string, tagId: string): Promise<void> {
    await db.transcriptTags
      .where({ transcriptId, tagId })
      .delete();
  }

  async getTagsForTranscript(transcriptId: string): Promise<Tag[]> {
    const associations = await db.transcriptTags
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
    
    const tagIds = associations.map(a => a.tagId);
    return await db.tags
      .where('tagId')
      .anyOf(tagIds)
      .toArray();
  }

  async getTranscriptsForTag(tagId: string): Promise<string[]> {
    const associations = await db.transcriptTags
      .where('tagId')
      .equals(tagId)
      .toArray();
    
    return associations.map(a => a.transcriptId);
  }

  async setTagsForTranscript(transcriptId: string, tagIds: string[]): Promise<void> {
    // Remove existing tags
    await db.transcriptTags
      .where('transcriptId')
      .equals(transcriptId)
      .delete();
    
    // Add new tags
    if (tagIds.length > 0) {
      await db.transcriptTags.bulkPut(
        tagIds.map(tagId => ({
          id: `${transcriptId}-${tagId}`,
          transcriptId,
          tagId
        }))
      );
    }
  }

  async getAllWithCounts(): Promise<Array<Tag & { count: number }>> {
    const tags = await this.getAll();
    const counts = await Promise.all(
      tags.map(async (tag) => {
        const count = await db.transcriptTags
          .where('tagId')
          .equals(tag.tagId)
          .count();
        return { ...tag, count };
      })
    );
    return counts;
  }

  async mergeTags(sourceTagId: string, targetTagId: string): Promise<void> {
    // Get all transcripts with source tag
    const transcriptIds = await this.getTranscriptsForTag(sourceTagId);
    
    // Add target tag to all those transcripts
    for (const transcriptId of transcriptIds) {
      await this.addTagToTranscript(transcriptId, targetTagId);
    }
    
    // Delete source tag
    await this.delete(sourceTagId);
  }
}

export const tagRepository = new TagRepository();
