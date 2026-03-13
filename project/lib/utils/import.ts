import { db } from '../db/schema';
import { transcriptRepository } from '../db/repositories/transcriptRepository';
import type { ExportData } from './export';
import type { Video, Transcript, Segment, Category, Tag, TranscriptTag } from '../../types';

export interface ImportResult {
  success: boolean;
  videosImported: number;
  videosSkipped: number;
  transcriptsImported: number;
  transcriptsSkipped: number;
  segmentsImported: number;
  categoriesImported: number;
  categoriesMerged: number;
  tagsImported: number;
  tagsMerged: number;
  errors: string[];
}

export async function importFromJson(
  data: ExportData,
  mode: 'merge' | 'replace' = 'merge'
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    videosImported: 0,
    videosSkipped: 0,
    transcriptsImported: 0,
    transcriptsSkipped: 0,
    segmentsImported: 0,
    categoriesImported: 0,
    categoriesMerged: 0,
    tagsImported: 0,
    tagsMerged: 0,
    errors: []
  };

  try {
    // Validate data structure
    if (!validateExportData(data)) {
      throw new Error('Invalid export data structure');
    }

    await db.transaction('rw', 
      [db.videos, db.transcripts, db.segments, db.categories, db.tags, db.transcriptTags],
      async () => {
        if (mode === 'replace') {
          // Clear existing data
          await Promise.all([
            db.videos.clear(),
            db.transcripts.clear(),
            db.segments.clear(),
            db.categories.clear(),
            db.tags.clear(),
            db.transcriptTags.clear()
          ]);
        }

        // Import categories first (needed for transcripts)
        const categoryIdMap = new Map<string, string>();
        for (const category of data.categories) {
          try {
            const existing = await db.categories
              .where('name')
              .equals(category.name)
              .first();
            
            if (existing) {
              categoryIdMap.set(category.categoryId, existing.categoryId);
              result.categoriesMerged++;
            } else {
              await db.categories.put(category);
              categoryIdMap.set(category.categoryId, category.categoryId);
              result.categoriesImported++;
            }
          } catch (error) {
            result.errors.push(`Failed to import category ${category.name}: ${error}`);
          }
        }

        // Import tags
        const tagIdMap = new Map<string, string>();
        for (const tag of data.tags) {
          try {
            const existing = await db.tags
              .where('name')
              .equals(tag.name)
              .first();
            
            if (existing) {
              tagIdMap.set(tag.tagId, existing.tagId);
              result.tagsMerged++;
            } else {
              await db.tags.put(tag);
              tagIdMap.set(tag.tagId, tag.tagId);
              result.tagsImported++;
            }
          } catch (error) {
            result.errors.push(`Failed to import tag ${tag.name}: ${error}`);
          }
        }

        // Import videos
        for (const video of data.videos) {
          try {
            const existing = await db.videos.get(video.videoId);
            if (existing && mode === 'merge') {
              result.videosSkipped++;
            } else {
              await db.videos.put(video);
              result.videosImported++;
            }
          } catch (error) {
            result.errors.push(`Failed to import video ${video.videoId}: ${error}`);
          }
        }

        // Import transcripts
        for (const transcript of data.transcripts) {
          try {
            // Check for existing transcript by videoId + languageCode
            const existing = await transcriptRepository.getByVideoAndLanguage(
              transcript.videoId,
              transcript.languageCode
            );
            
            if (existing && mode === 'merge') {
              result.transcriptsSkipped++;
              continue;
            }

            // Map category ID
            const newCategoryId = transcript.categoryId 
              ? categoryIdMap.get(transcript.categoryId) || transcript.categoryId
              : null;

            const newTranscript: Transcript = {
              ...transcript,
              categoryId: newCategoryId,
              createdAt: new Date(transcript.createdAt),
              updatedAt: new Date(transcript.updatedAt),
              lastOpenedAt: new Date(transcript.lastOpenedAt)
            };

            await db.transcripts.put(newTranscript);
            result.transcriptsImported++;
          } catch (error) {
            result.errors.push(`Failed to import transcript ${transcript.transcriptId}: ${error}`);
          }
        }

        // Import segments
        for (const segment of data.segments) {
          try {
            await db.segments.put(segment);
            result.segmentsImported++;
          } catch (error) {
            result.errors.push(`Failed to import segment ${segment.segmentId}: ${error}`);
          }
        }

        // Import transcript-tag relationships
        for (const tt of data.transcriptTags) {
          try {
            const newTagId = tagIdMap.get(tt.tagId) || tt.tagId;
            await db.transcriptTags.put({
              ...tt,
              tagId: newTagId
            });
          } catch (error) {
            result.errors.push(`Failed to import transcript-tag relation: ${error}`);
          }
        }
      }
    );
  } catch (error) {
    result.success = false;
    result.errors.push(`Import failed: ${error}`);
  }

  return result;
}

function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  
  const d = data as ExportData;
  
  // Check required fields
  if (!d.version || typeof d.version !== 'string') return false;
  if (!d.exportedAt || typeof d.exportedAt !== 'string') return false;
  
  // Check arrays
  if (!Array.isArray(d.videos)) return false;
  if (!Array.isArray(d.transcripts)) return false;
  if (!Array.isArray(d.segments)) return false;
  if (!Array.isArray(d.categories)) return false;
  if (!Array.isArray(d.tags)) return false;
  if (!Array.isArray(d.transcriptTags)) return false;
  
  return true;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export async function parseImportFile(file: File): Promise<ExportData> {
  const content = await readFileAsText(file);
  
  try {
    const data = JSON.parse(content);
    if (!validateExportData(data)) {
      throw new Error('Invalid file format');
    }
    return data;
  } catch (error) {
    throw new Error(`Failed to parse import file: ${error}`);
  }
}
