import { pipeline, SummarizationPipeline } from '@xenova/transformers';
import { segmentRepository } from '../db/repositories/segmentRepository';
import { generateEmbedding, cosineSimilarity } from './semanticSearch';
import type { Segment } from '../../types';

// Model instance (singleton)
let summarizationModel: SummarizationPipeline | null = null;

export interface SummaryOptions {
  maxLength?: number;
  minLength?: number;
  format?: 'bullet' | 'paragraph' | 'key-points';
  level?: 'short' | 'medium' | 'detailed';
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  originalWordCount: number;
  compressionRatio: number;
  method: 'extractive' | 'abstractive' | 'hybrid';
}

const DEFAULT_OPTIONS: SummaryOptions = {
  maxLength: 150,
  minLength: 30,
  format: 'bullet',
  level: 'medium'
};

// Load the summarization model
export async function loadSummarizationModel(
  onProgress?: (progress: number) => void
): Promise<SummarizationPipeline> {
  if (summarizationModel) {
    return summarizationModel;
  }

  try {
    summarizationModel = await pipeline(
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      {
        progress_callback: (progress: { status: string; progress?: number }) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            onProgress?.(progress.progress);
          }
        }
      }
    );

    return summarizationModel;
  } catch (error) {
    console.error('Error loading summarization model:', error);
    throw new Error('Failed to load summarization model');
  }
}

// Extractive summarization using embeddings
async function extractiveSummarize(
  segments: Segment[],
  options: SummaryOptions
): Promise<SummaryResult> {
  const fullText = segments.map(s => s.text).join(' ');
  const originalWordCount = fullText.split(/\s+/).length;
  
  // Target summary length based on level
  const targetLength = options.level === 'short' ? 50 : 
                       options.level === 'detailed' ? 200 : 100;
  
  // Number of sentences to extract
  const numSentences = Math.max(3, Math.ceil(targetLength / 20));
  
  // Generate embeddings for each segment
  const segmentEmbeddings = await Promise.all(
    segments.map(async (segment) => ({
      segment,
      embedding: await generateEmbedding(segment.text)
    }))
  );
  
  // Calculate centroid of all embeddings
  const centroid = segmentEmbeddings[0].embedding.map((_, i) => 
    segmentEmbeddings.reduce((sum, item) => sum + item.embedding[i], 0) / segmentEmbeddings.length
  );
  
  // Calculate similarity to centroid and select most representative sentences
  const scoredSegments = segmentEmbeddings.map(item => ({
    ...item,
    score: cosineSimilarity(item.embedding, centroid)
  }));
  
  // Sort by score and take top N
  const topSegments = scoredSegments
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences)
    .sort((a, b) => a.segment.sequence - b.segment.sequence); // Restore chronological order
  
  // Generate summary text
  const summaryText = topSegments.map(item => item.segment.text).join(' ');
  const keyPoints = topSegments.map(item => item.segment.text);
  
  return {
    summary: summaryText,
    keyPoints,
    wordCount: summaryText.split(/\s+/).length,
    originalWordCount,
    compressionRatio: originalWordCount / summaryText.split(/\s+/).length,
    method: 'extractive'
  };
}

// Abstractive summarization using transformer model
async function abstractiveSummarize(
  segments: Segment[],
  options: SummaryOptions
): Promise<SummaryResult> {
  const fullText = segments.map(s => s.text).join(' ');
  const originalWordCount = fullText.split(/\s+/).length;
  
  const model = await loadSummarizationModel();
  
  // Model has token limit, so we may need to chunk long transcripts
  const maxInputLength = 1024; // tokens
  let textToSummarize = fullText;
  
  if (fullText.length > maxInputLength * 4) { // Rough estimate: 4 chars per token
    // Take the beginning, middle, and end
    const chunkSize = maxInputLength * 3;
    const beginning = fullText.slice(0, chunkSize);
    const middle = fullText.slice(Math.floor(fullText.length / 2) - chunkSize / 2, 
                                  Math.floor(fullText.length / 2) + chunkSize / 2);
    const end = fullText.slice(-chunkSize);
    
    textToSummarize = `${beginning}\n\n[...middle section...]\n\n${end}`;
  }
  
  const output = await model(textToSummarize, {
    max_length: options.maxLength || 150,
    min_length: options.minLength || 30,
    do_sample: false
  });
  
  // Handle both single output and array output
  const result = Array.isArray(output) ? output[0] : output;
  const summaryText = (result as { summary_text: string }).summary_text || '';
  const keyPoints = summaryText.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
  
  return {
    summary: summaryText,
    keyPoints,
    wordCount: summaryText.split(/\s+/).length,
    originalWordCount,
    compressionRatio: originalWordCount / summaryText.split(/\s+/).length,
    method: 'abstractive'
  };
}

// Hybrid summarization: extractive + abstractive
async function hybridSummarize(
  segments: Segment[],
  options: SummaryOptions
): Promise<SummaryResult> {
  // First do extractive to get key segments
  const extractiveResult = await extractiveSummarize(segments, {
    ...options,
    level: 'detailed' // Get more content for abstractive
  });
  
  // Then summarize the extracted content
  const extractedSegments: Segment[] = extractiveResult.keyPoints.map((text, i) => ({
    segmentId: `extracted-${i}`,
    transcriptId: segments[0]?.transcriptId || '',
    sequence: i,
    startMs: 0,
    durationMs: 0,
    text
  }));
  
  const abstractiveResult = await abstractiveSummarize(extractedSegments, options);
  
  return {
    summary: abstractiveResult.summary,
    keyPoints: abstractiveResult.keyPoints,
    wordCount: abstractiveResult.wordCount,
    originalWordCount: extractiveResult.originalWordCount,
    compressionRatio: extractiveResult.originalWordCount / abstractiveResult.wordCount,
    method: 'hybrid'
  };
}

// Main summarize function
export async function summarizeTranscript(
  transcriptId: string,
  method: 'extractive' | 'abstractive' | 'hybrid' = 'hybrid',
  options: Partial<SummaryOptions> = {}
): Promise<SummaryResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Get segments
  const segments = await segmentRepository.getByTranscriptId(transcriptId);
  
  if (segments.length === 0) {
    throw new Error('No segments found for this transcript');
  }
  
  switch (method) {
    case 'extractive':
      return extractiveSummarize(segments, opts);
    case 'abstractive':
      return abstractiveSummarize(segments, opts);
    case 'hybrid':
    default:
      return hybridSummarize(segments, opts);
  }
}

// Format summary for display
export function formatSummary(
  result: SummaryResult,
  format: 'bullet' | 'paragraph' | 'key-points' = 'bullet'
): string {
  switch (format) {
    case 'bullet':
      return result.keyPoints
        .map((point, i) => `• ${point.trim()}`)
        .join('\n');
    
    case 'key-points':
      return result.keyPoints
        .map((point, i) => `${i + 1}. ${point.trim()}`)
        .join('\n');
    
    case 'paragraph':
    default:
      return result.summary;
  }
}

// Copy summary to clipboard
export async function copySummaryToClipboard(result: SummaryResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatSummary(result, 'bullet'));
    return true;
  } catch {
    return false;
  }
}

// Export summary in different formats
export function exportSummaryAsText(
  result: SummaryResult,
  title: string,
  format: 'markdown' | 'txt' = 'markdown'
): string {
  const content = format === 'markdown' 
    ? `# Summary: ${title}\n\n${formatSummary(result, 'bullet')}\n\n---\n\n**Statistics:**\n- Original: ${result.originalWordCount.toLocaleString()} words\n- Summary: ${result.wordCount.toLocaleString()} words\n- Compression: ${result.compressionRatio.toFixed(1)}x\n- Method: ${result.method}`
    : `Summary: ${title}\n\n${formatSummary(result, 'bullet')}\n\nStatistics:\n- Original: ${result.originalWordCount.toLocaleString()} words\n- Summary: ${result.wordCount.toLocaleString()} words\n- Compression: ${result.compressionRatio.toFixed(1)}x\n- Method: ${result.method}`;
  
  return content;
}

// Generate chapter titles from segments
export async function generateChapterTitles(
  segments: Segment[]
): Promise<Array<{ startMs: number; endMs: number; title: string }>> {
  // Simple chapter detection based on topic changes
  const chapters: Array<{ startMs: number; endMs: number; title: string }> = [];
  
  if (segments.length < 10) {
    // Too short for chapters
    return chapters;
  }
  
  // Group segments into chunks (every ~30 segments or 5 minutes)
  const chunkSize = 30;
  const chunks: Segment[][] = [];
  
  for (let i = 0; i < segments.length; i += chunkSize) {
    chunks.push(segments.slice(i, i + chunkSize));
  }
  
  // For each chunk, generate a title from the first sentence
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const firstText = chunk[0].text;
    
    // Extract first sentence or first 50 chars
    let title = firstText.split(/[.!?]/)[0] || firstText;
    if (title.length > 60) {
      title = title.slice(0, 60) + '...';
    }
    
    chapters.push({
      startMs: chunk[0].startMs,
      endMs: chunk[chunk.length - 1].startMs + chunk[chunk.length - 1].durationMs,
      title
    });
  }
  
  return chapters;
}
