import { generateEmbedding, cosineSimilarity } from './semanticSearch';
import type { Segment } from '../../types';

export interface Chapter {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
  segments: Segment[];
  summary: string;
  topicChangeScore: number;
}

export interface ChapterDetectionOptions {
  minSegmentCount?: number;
  maxChapters?: number;
  minChapterDuration?: number; // in milliseconds
  similarityThreshold?: number;
}

const DEFAULT_OPTIONS: ChapterDetectionOptions = {
  minSegmentCount: 10,
  maxChapters: 20,
  minChapterDuration: 60000, // 1 minute
  similarityThreshold: 0.7
};

// Detect chapters using topic segmentation
export async function detectChapters(
  segments: Segment[],
  options: Partial<ChapterDetectionOptions> = {}
): Promise<Chapter[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (segments.length < opts.minSegmentCount!) {
    return []; // Too short for chapters
  }
  
  // Generate embeddings for all segments
  const segmentEmbeddings = await Promise.all(
    segments.map(async (segment) => ({
      segment,
      embedding: await generateEmbedding(segment.text)
    }))
  );
  
  // Calculate topic change scores
  const changeScores: Array<{ index: number; score: number }> = [];
  
  for (let i = 1; i < segmentEmbeddings.length; i++) {
    const prevEmbedding = segmentEmbeddings[i - 1].embedding;
    const currEmbedding = segmentEmbeddings[i].embedding;
    
    // Calculate similarity between consecutive segments
    const similarity = cosineSimilarity(prevEmbedding, currEmbedding);
    const changeScore = 1 - similarity; // Higher score = more change
    
    // Check for pauses (gaps between segments)
    const prevSegment = segmentEmbeddings[i - 1].segment;
    const currSegment = segmentEmbeddings[i].segment;
    const gap = currSegment.startMs - (prevSegment.startMs + prevSegment.durationMs);
    const pauseScore = Math.min(gap / 5000, 1); // Normalize pause to 5 seconds max
    
    // Combined score: weighted average
    const combinedScore = (changeScore * 0.7) + (pauseScore * 0.3);
    
    changeScores.push({ index: i, score: combinedScore });
  }
  
  // Sort by score and select top chapter boundaries
  const sortedChanges = changeScores
    .filter(item => item.score > 0.3) // Minimum threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxChapters! - 1); // -1 because we always have first chapter
  
  // Get boundary indices and sort them by position
  const boundaries = [0, ...sortedChanges.map(c => c.index)].sort((a, b) => a - b);
  
  // Create chapters
  const chapters: Chapter[] = [];
  
  for (let i = 0; i < boundaries.length; i++) {
    const startIndex = boundaries[i];
    const endIndex = boundaries[i + 1] ?? segments.length;
    
    const chapterSegments = segments.slice(startIndex, endIndex);
    
    // Skip if too short
    const duration = chapterSegments[chapterSegments.length - 1].startMs + 
                     chapterSegments[chapterSegments.length - 1].durationMs - 
                     chapterSegments[0].startMs;
    
    if (duration < opts.minChapterDuration!) {
      continue;
    }
    
    // Generate chapter title
    const title = await generateChapterTitle(chapterSegments);
    const summary = await generateChapterSummary(chapterSegments);
    
    chapters.push({
      id: `chapter-${i}`,
      startMs: chapterSegments[0].startMs,
      endMs: chapterSegments[chapterSegments.length - 1].startMs + 
              chapterSegments[chapterSegments.length - 1].durationMs,
      title,
      segments: chapterSegments,
      summary,
      topicChangeScore: i < sortedChanges.length ? sortedChanges[i].score : 0
    });
  }
  
  return chapters;
}

// Generate a title for a chapter
async function generateChapterTitle(segments: Segment[]): Promise<string> {
  if (segments.length === 0) return 'Untitled Chapter';
  
  // Combine first 3 segments for context
  const context = segments
    .slice(0, 3)
    .map(s => s.text)
    .join(' ')
    .slice(0, 200);
  
  // Extract key phrases (simple approach)
  const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length === 0) {
    return 'Chapter';
  }
  
  // Use first sentence as title, but limit length
  let title = sentences[0].trim();
  if (title.length > 60) {
    title = title.slice(0, 60) + '...';
  }
  
  return title;
}

// Generate a summary for a chapter
async function generateChapterSummary(segments: Segment[]): Promise<string> {
  if (segments.length === 0) return '';
  
  // Combine all segment text
  const fullText = segments.map(s => s.text).join(' ');
  
  // Take first 2-3 sentences as summary
  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  const summarySentences = sentences.slice(0, 2);
  const summary = summarySentences.join('. ') + (summarySentences.length > 0 ? '.' : '');
  
  // Limit length
  if (summary.length > 200) {
    return summary.slice(0, 200) + '...';
  }
  
  return summary;
}

// Format timestamp for display
export function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Export chapters in different formats
export function exportChaptersAsText(
  chapters: Chapter[],
  videoTitle: string,
  videoUrl: string,
  format: 'markdown' | 'txt' | 'youtube' = 'markdown'
): string {
  switch (format) {
    case 'youtube':
      // Format for YouTube chapter timestamps in description
      return chapters.map(c => 
        `${formatTimestamp(c.startMs)} ${c.title}`
      ).join('\n');
    
    case 'txt':
      return `Chapters: ${videoTitle}\n\n` + 
        chapters.map((c, i) => 
          `Chapter ${i + 1}: ${c.title}\n` +
          `Time: ${formatTimestamp(c.startMs)} - ${formatTimestamp(c.endMs)}\n` +
          `Summary: ${c.summary}\n`
        ).join('\n');
    
    case 'markdown':
    default:
      return `# Chapters: ${videoTitle}\n\n` +
        `Video: ${videoUrl}\n\n` +
        chapters.map((c, i) => 
          `## ${i + 1}. ${c.title}\n\n` +
          `**Time:** [${formatTimestamp(c.startMs)}](${videoUrl}&t=${Math.floor(c.startMs / 1000)}s) - ${formatTimestamp(c.endMs)}\n\n` +
          `${c.summary}\n`
        ).join('\n');
  }
}

// Get chapter at specific timestamp
export function getChapterAtTime(
  chapters: Chapter[],
  timestampMs: number
): Chapter | undefined {
  return chapters.find(c => timestampMs >= c.startMs && timestampMs < c.endMs);
}

// Get chapter index at specific timestamp
export function getChapterIndexAtTime(
  chapters: Chapter[],
  timestampMs: number
): number {
  return chapters.findIndex(c => timestampMs >= c.startMs && timestampMs < c.endMs);
}

// Calculate total duration
export function calculateTotalDuration(chapters: Chapter[]): number {
  if (chapters.length === 0) return 0;
  return chapters[chapters.length - 1].endMs - chapters[0].startMs;
}

// Calculate average chapter duration
export function calculateAverageChapterDuration(chapters: Chapter[]): number {
  if (chapters.length === 0) return 0;
  return calculateTotalDuration(chapters) / chapters.length;
}
