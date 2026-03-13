import { db } from '../db/schema';
import type { Video, Transcript, Segment, Category, Tag, TranscriptTag } from '../../types';

export interface ExportData {
  version: string;
  exportedAt: string;
  videos: Video[];
  transcripts: Transcript[];
  segments: Segment[];
  categories: Category[];
  tags: Tag[];
  transcriptTags: TranscriptTag[];
}

export async function exportAllData(): Promise<ExportData> {
  const [videos, transcripts, segments, categories, tags, transcriptTags] = await Promise.all([
    db.videos.toArray(),
    db.transcripts.toArray(),
    db.segments.toArray(),
    db.categories.toArray(),
    db.tags.toArray(),
    db.transcriptTags.toArray()
  ]);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    videos,
    transcripts,
    segments,
    categories,
    tags,
    transcriptTags
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatTranscriptAsText(
  title: string,
  channel: string,
  url: string,
  segments: Segment[]
): string {
  const header = `${title}\n${channel}\n${url}\n\n`;
  const body = segments.map(seg => {
    const timestamp = formatTimestamp(seg.startMs);
    return `[${timestamp}] ${seg.text}`;
  }).join('\n\n');
  
  return header + body;
}

function formatTimestamp(ms: number): string {
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

export function formatTranscriptsAsCsv(transcripts: Array<{
  transcript: Transcript;
  video?: Video;
  category?: Category;
}>): string {
  const headers = [
    'Video ID',
    'Title',
    'Channel',
    'Category',
    'Language',
    'Source Type',
    'Word Count',
    'Segment Count',
    'Status',
    'Favorite',
    'Archived',
    'Created At',
    'Updated At',
    'URL'
  ];
  
  const rows = transcripts.map(({ transcript, video, category }) => [
    transcript.videoId,
    video?.title || '',
    video?.channelTitle || '',
    category?.name || '',
    transcript.languageLabel,
    transcript.sourceType,
    transcript.wordCount,
    transcript.segmentCount,
    transcript.status,
    transcript.favorite ? 'Yes' : 'No',
    transcript.archived ? 'Yes' : 'No',
    new Date(transcript.createdAt).toISOString(),
    new Date(transcript.updatedAt).toISOString(),
    video?.url || ''
  ]);
  
  // Escape values and create CSV
  const escape = (value: string | number | boolean): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  return [headers.join(','), ...rows.map(row => row.map(escape).join(','))].join('\n');
}
