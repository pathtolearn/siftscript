import { db } from '../schema';
import type { Annotation, AnnotationColor } from '../../../types';

export class AnnotationRepository {
  async getById(annotationId: string): Promise<Annotation | undefined> {
    return await db.annotations.get(annotationId);
  }

  async getByTranscriptId(transcriptId: string): Promise<Annotation[]> {
    return await db.annotations
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
  }

  async getBySegmentId(segmentId: string): Promise<Annotation | undefined> {
    return await db.annotations
      .where('segmentId')
      .equals(segmentId)
      .first();
  }

  async create(annotation: Omit<Annotation, 'annotationId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date();
    const id = `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const full: Annotation = {
      ...annotation,
      annotationId: id,
      createdAt: now,
      updatedAt: now
    };
    await db.annotations.put(full);
    return id;
  }

  async update(annotationId: string, updates: Partial<Pick<Annotation, 'color' | 'note'>>): Promise<void> {
    await db.annotations.update(annotationId, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async delete(annotationId: string): Promise<void> {
    await db.annotations.delete(annotationId);
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    await db.annotations
      .where('transcriptId')
      .equals(transcriptId)
      .delete();
  }

  async getCountByTranscript(transcriptId: string): Promise<number> {
    return await db.annotations
      .where('transcriptId')
      .equals(transcriptId)
      .count();
  }

  async getHighlightedSegmentIds(transcriptId: string): Promise<Map<string, Annotation>> {
    const annotations = await this.getByTranscriptId(transcriptId);
    const map = new Map<string, Annotation>();
    for (const ann of annotations) {
      map.set(ann.segmentId, ann);
    }
    return map;
  }
}

export const annotationRepository = new AnnotationRepository();
