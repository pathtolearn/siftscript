import type { Video, Transcript, Segment, Category, Tag } from '../../types';
import { segmentRepository } from '../db/repositories/segmentRepository';
import { categoryRepository } from '../db/repositories/categoryRepository';
import { tagRepository } from '../db/repositories/tagRepository';

export interface ObsidianExportOptions {
  includeTimestamps: boolean;
  includeMetadata: boolean;
  includeNotes: boolean;
  includeTags: boolean;
  timestampFormat: 'hh:mm:ss' | 'mm:ss';
}

const DEFAULT_OPTIONS: ObsidianExportOptions = {
  includeTimestamps: true,
  includeMetadata: true,
  includeNotes: true,
  includeTags: true,
  timestampFormat: 'hh:mm:ss'
};

function formatTimestamp(ms: number, format: 'hh:mm:ss' | 'mm:ss'): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  if (format === 'hh:mm:ss' || hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid Windows chars
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim()
    .substring(0, 200);              // Limit length
}

export async function exportToObsidianFormat(
  transcript: Transcript,
  video: Video,
  options: Partial<ObsidianExportOptions> = {}
): Promise<{ filename: string; content: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Fetch additional data
  const [segments, category, tags] = await Promise.all([
    segmentRepository.getByTranscriptId(transcript.transcriptId),
    transcript.categoryId ? categoryRepository.getById(transcript.categoryId) : Promise.resolve(undefined),
    tagRepository.getTagsForTranscript(transcript.transcriptId)
  ]);
  
  // Generate filename
  const sanitizedTitle = sanitizeFilename(video.title);
  const filename = `${sanitizedTitle}.md`;
  
  // Build YAML frontmatter
  const frontmatter: Record<string, unknown> = {
    title: video.title,
    channel: video.channelTitle,
    url: video.url,
    video_id: video.videoId,
    transcript_id: transcript.transcriptId,
    language: transcript.languageLabel,
    language_code: transcript.languageCode,
    source_type: transcript.sourceType,
    word_count: transcript.wordCount,
    segment_count: transcript.segmentCount,
    saved_at: new Date(transcript.createdAt).toISOString(),
    updated_at: new Date(transcript.updatedAt).toISOString()
  };
  
  if (category) {
    frontmatter.category = category.name;
  }
  
  if (opts.includeTags && tags.length > 0) {
    frontmatter.tags = tags.map(t => t.name);
  }
  
  if (video.publishedAt) {
    frontmatter.published_at = new Date(video.publishedAt).toISOString();
  }
  
  // Build YAML frontmatter string
  const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
    }
    if (typeof value === 'string') {
      // Escape special characters in strings
      const escaped = value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `${key}: "${escaped}"`;
    }
    return `${key}: ${value}`;
  });
  
  const yamlContent = `---\n${yamlLines.join('\n')}\n---\n\n`;
  
  // Build transcript content
  let content = '';
  
  // Add video link at top
  content += `# ${video.title}\n\n`;
  content += `**Channel:** ${video.channelTitle}  \n`;
  content += `**URL:** [Watch on YouTube](${video.url})  \n`;
  
  if (opts.includeMetadata) {
    content += `**Language:** ${transcript.languageLabel}  \n`;
    content += `**Source:** ${transcript.sourceType}  \n`;
    content += `**Words:** ${transcript.wordCount.toLocaleString()}  \n`;
    content += `**Saved:** ${new Date(transcript.createdAt).toLocaleDateString()}\n`;
  }
  
  content += '\n';
  
  // Add tags as Obsidian tags if enabled
  if (opts.includeTags && tags.length > 0) {
    content += tags.map(t => `#${t.name.replace(/\s+/g, '_')}`).join(' ') + '\n\n';
  }
  
  // Add notes if present and enabled
  if (opts.includeNotes && transcript.notes) {
    content += `## Notes\n\n${transcript.notes}\n\n`;
  }
  
  // Add transcript
  content += '## Transcript\n\n';
  
  if (opts.includeTimestamps) {
    segments.forEach(seg => {
      const timestamp = formatTimestamp(seg.startMs, opts.timestampFormat);
      content += `[${timestamp}] ${seg.text}\n\n`;
    });
  } else {
    content += segments.map(seg => seg.text).join(' ');
  }
  
  // Combine frontmatter and content
  const fullContent = yamlContent + content;
  
  return { filename, content: fullContent };
}

export async function exportMultipleToObsidian(
  transcripts: Array<{ transcript: Transcript; video: Video }>,
  options: Partial<ObsidianExportOptions> = {}
): Promise<Array<{ filename: string; content: string }>> {
  const results = await Promise.all(
    transcripts.map(({ transcript, video }) => 
      exportToObsidianFormat(transcript, video, options)
    )
  );
  
  return results;
}

export function createObsidianExportZip(
  files: Array<{ filename: string; content: string }>
): Promise<Blob> {
  // Note: In a real implementation, you'd use JSZip or similar
  // For now, we'll just return individual files
  throw new Error('ZIP export requires JSZip library. Install with: npm install jszip');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/markdown'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportTranscriptToObsidian(
  transcriptId: string,
  options?: Partial<ObsidianExportOptions>
): Promise<void> {
  const { transcriptRepository } = await import('../db/repositories/transcriptRepository');
  const { videoRepository } = await import('../db/repositories/videoRepository');
  
  const transcript = await transcriptRepository.getById(transcriptId);
  if (!transcript) throw new Error('Transcript not found');
  
  const video = await videoRepository.getById(transcript.videoId);
  if (!video) throw new Error('Video not found');
  
  const { filename, content } = await exportToObsidianFormat(transcript, video, options);
  downloadFile(content, filename);
}
