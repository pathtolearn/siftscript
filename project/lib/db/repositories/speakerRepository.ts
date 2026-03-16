import { db } from '../schema';
import type { Speaker, SpeakerAssignment } from '../../../types';

export class SpeakerRepository {
  async getByTranscriptId(transcriptId: string): Promise<Speaker[]> {
    return await db.speakers
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
  }

  async create(speaker: Omit<Speaker, 'speakerId' | 'createdAt'>): Promise<string> {
    const now = new Date();
    const id = `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const full: Speaker = { ...speaker, speakerId: id, createdAt: now };
    await db.speakers.put(full);
    return id;
  }

  async update(speakerId: string, updates: Partial<Pick<Speaker, 'label' | 'color'>>): Promise<void> {
    await db.speakers.update(speakerId, updates);
  }

  async delete(speakerId: string): Promise<void> {
    await db.speakers.delete(speakerId);
    // Also delete all assignments for this speaker
    await db.speakerAssignments
      .where('speakerId')
      .equals(speakerId)
      .delete();
  }

  async deleteByTranscriptId(transcriptId: string): Promise<void> {
    await db.speakers.where('transcriptId').equals(transcriptId).delete();
    await db.speakerAssignments.where('transcriptId').equals(transcriptId).delete();
  }

  // Speaker assignments
  async getAssignmentsByTranscriptId(transcriptId: string): Promise<Map<string, SpeakerAssignment>> {
    const assignments = await db.speakerAssignments
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
    const map = new Map<string, SpeakerAssignment>();
    for (const a of assignments) {
      map.set(a.segmentId, a);
    }
    return map;
  }

  async assignSpeaker(segmentId: string, transcriptId: string, speakerId: string): Promise<void> {
    const existing = await db.speakerAssignments
      .where('[transcriptId+segmentId]')
      .equals([transcriptId, segmentId])
      .first();

    if (existing) {
      await db.speakerAssignments.update(existing.assignmentId, { speakerId });
    } else {
      const id = `sa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await db.speakerAssignments.put({
        assignmentId: id,
        segmentId,
        transcriptId,
        speakerId,
      });
    }
  }

  async unassignSpeaker(segmentId: string, transcriptId: string): Promise<void> {
    await db.speakerAssignments
      .where('[transcriptId+segmentId]')
      .equals([transcriptId, segmentId])
      .delete();
  }

  async bulkAssignSpeakers(assignments: Array<{ segmentId: string; transcriptId: string; speakerId: string }>): Promise<void> {
    const records: SpeakerAssignment[] = assignments.map(a => ({
      assignmentId: `sa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...a,
    }));
    await db.speakerAssignments.bulkPut(records);
  }
}

export const speakerRepository = new SpeakerRepository();
