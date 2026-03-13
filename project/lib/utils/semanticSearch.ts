import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { db } from '../db/schema';
import { transcriptRepository } from '../db/repositories/transcriptRepository';
import { segmentRepository } from '../db/repositories/segmentRepository';
import type { Transcript, Segment } from '../../types';

// Storage keys for model and embeddings
const EMBEDDINGS_STORE = 'segmentEmbeddings';
const MODEL_KEY = 'semantic-search-model';

export interface SegmentEmbedding {
  segmentId: string;
  transcriptId: string;
  embedding: number[];
  text: string;
  startMs: number;
  createdAt: Date;
}

export interface SemanticSearchResult {
  segmentId: string;
  transcriptId: string;
  transcript?: Transcript;
  text: string;
  startMs: number;
  similarity: number;
}

// Model instance (singleton)
let embeddingModel: FeatureExtractionPipeline | null = null;

// Check if model is loaded
export function isModelLoaded(): boolean {
  return embeddingModel !== null;
}

// Load the embedding model
export async function loadEmbeddingModel(
  onProgress?: (progress: number) => void
): Promise<FeatureExtractionPipeline> {
  if (embeddingModel) {
    return embeddingModel;
  }

  try {
    // Use a small, fast model suitable for semantic search
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        progress_callback: (progress: { status: string; progress?: number }) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            onProgress?.(progress.progress);
          }
        }
      }
    );

    return embeddingModel;
  } catch (error) {
    console.error('Error loading embedding model:', error);
    throw new Error('Failed to load semantic search model');
  }
}

// Generate embedding for a single text
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await loadEmbeddingModel();
  
  const output = await model(text, {
    pooling: 'mean',
    normalize: true
  });
  
  // Convert Float32Array to regular array
  return Array.from(output.data);
}

// Generate embeddings for transcript segments
export async function generateTranscriptEmbeddings(
  transcriptId: string,
  segments: Segment[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const model = await loadEmbeddingModel();
  const embeddings: SegmentEmbedding[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    try {
      const embedding = await model(segment.text, {
        pooling: 'mean',
        normalize: true
      });

      embeddings.push({
        segmentId: segment.segmentId,
        transcriptId,
        embedding: Array.from(embedding.data),
        text: segment.text,
        startMs: segment.startMs,
        createdAt: new Date()
      });

      onProgress?.(i + 1, segments.length);
    } catch (error) {
      console.error(`Error generating embedding for segment ${segment.segmentId}:`, error);
    }
  }

  // Store embeddings in IndexedDB
  await db.table(EMBEDDINGS_STORE).bulkPut(embeddings);
}

// Delete embeddings for a transcript
export async function deleteTranscriptEmbeddings(transcriptId: string): Promise<void> {
  await db.table(EMBEDDINGS_STORE)
    .where('transcriptId')
    .equals(transcriptId)
    .delete();
}

// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Search for similar segments
export async function semanticSearch(
  query: string,
  options: {
    limit?: number;
    minSimilarity?: number;
    transcriptIds?: string[];
  } = {}
): Promise<SemanticSearchResult[]> {
  const { limit = 10, minSimilarity = 0.3, transcriptIds } = options;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Get all embeddings
  let allEmbeddings: SegmentEmbedding[];
  
  if (transcriptIds && transcriptIds.length > 0) {
    // Filter by specific transcripts
    const results = await Promise.all(
      transcriptIds.map(id => 
        db.table(EMBEDDINGS_STORE)
          .where('transcriptId')
          .equals(id)
          .toArray()
      )
    );
    allEmbeddings = results.flat();
  } else {
    // Get all embeddings
    allEmbeddings = await db.table(EMBEDDINGS_STORE).toArray();
  }

  if (allEmbeddings.length === 0) {
    return [];
  }

  // Calculate similarity for all segments
  const results: SemanticSearchResult[] = allEmbeddings.map(emb => ({
    segmentId: emb.segmentId,
    transcriptId: emb.transcriptId,
    text: emb.text,
    startMs: emb.startMs,
    similarity: cosineSimilarity(queryEmbedding, emb.embedding)
  }));

  // Sort by similarity and filter
  return results
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// Search across transcripts (returns transcripts with best matching segments)
export async function searchTranscripts(
  query: string,
  options: {
    limit?: number;
    minSimilarity?: number;
  } = {}
): Promise<Array<{
  transcript: Transcript;
  bestMatch: SemanticSearchResult;
  matchCount: number;
  averageSimilarity: number;
}>> {
  const { limit = 10, minSimilarity = 0.3 } = options;

  // Get segment-level results
  const segmentResults = await semanticSearch(query, {
    limit: 100, // Get more to aggregate by transcript
    minSimilarity
  });

  // Group by transcript
  const transcriptMap = new Map<string, {
    matches: SemanticSearchResult[];
  }>();

  for (const result of segmentResults) {
    if (!transcriptMap.has(result.transcriptId)) {
      transcriptMap.set(result.transcriptId, { matches: [] });
    }
    transcriptMap.get(result.transcriptId)!.matches.push(result);
  }

  // Load transcript data and calculate scores
  const transcriptResults = await Promise.all(
    Array.from(transcriptMap.entries()).map(async ([transcriptId, data]) => {
      const transcript = await transcriptRepository.getById(transcriptId);
      if (!transcript) return null;

      const bestMatch = data.matches[0];
      const matchCount = data.matches.length;
      const averageSimilarity = data.matches.reduce((sum, m) => sum + m.similarity, 0) / matchCount;

      return {
        transcript,
        bestMatch,
        matchCount,
        averageSimilarity
      };
    })
  );

  // Filter out nulls and sort by best match similarity
  return transcriptResults
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.bestMatch.similarity - a.bestMatch.similarity)
    .slice(0, limit);
}

// Get statistics about embeddings
export async function getEmbeddingStats(): Promise<{
  totalSegments: number;
  transcriptsWithEmbeddings: number;
}> {
  const allEmbeddings = await db.table(EMBEDDINGS_STORE).toArray();
  const uniqueTranscripts = new Set(allEmbeddings.map(e => e.transcriptId));
  
  return {
    totalSegments: allEmbeddings.length,
    transcriptsWithEmbeddings: uniqueTranscripts.size
  };
}

// Clear all embeddings
export async function clearAllEmbeddings(): Promise<void> {
  await db.table(EMBEDDINGS_STORE).clear();
}

// Process all transcripts without embeddings
export async function processAllTranscripts(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const transcripts = await transcriptRepository.getAll();
  
  // Get existing embeddings
  const existingEmbeddings = await db.table(EMBEDDINGS_STORE).toArray();
  const processedTranscriptIds = new Set(existingEmbeddings.map(e => e.transcriptId));
  
  // Filter transcripts that need processing
  const transcriptsToProcess = transcripts.filter(
    t => !processedTranscriptIds.has(t.transcriptId)
  );

  if (transcriptsToProcess.length === 0) {
    return;
  }

  // Load model
  await loadEmbeddingModel();

  for (let i = 0; i < transcriptsToProcess.length; i++) {
    const transcript = transcriptsToProcess[i];
    const segments = await segmentRepository.getByTranscriptId(transcript.transcriptId);
    
    await generateTranscriptEmbeddings(
      transcript.transcriptId,
      segments,
      (current, total) => {
        onProgress?.(
          i * 100 + (current / total) * 100,
          transcriptsToProcess.length * 100
        );
      }
    );
  }
}

// Check if embeddings table exists, create if not
export async function initializeEmbeddingsTable(): Promise<void> {
  // Check if table exists
  const tables = await db.tables.map(t => t.name);
  if (!tables.includes(EMBEDDINGS_STORE)) {
    // Table will be created on next version upgrade
    // For now, we'll use a separate store
    console.warn('Embeddings table not found. Please upgrade database schema.');
  }
}
