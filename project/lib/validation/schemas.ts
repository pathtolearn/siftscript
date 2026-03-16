import { z } from 'zod';

// ---------------------------------------------------------------------------
// VideoContext – scraped from the YouTube DOM
// ---------------------------------------------------------------------------
export const VideoContextSchema = z.object({
  videoId: z.string().min(1, 'videoId must be a non-empty string'),
  url: z.string().url('url must be a valid URL'),
  title: z.string().min(1, 'title must be a non-empty string'),
  channelId: z.string().min(1, 'channelId must be a non-empty string'),
  channelTitle: z.string().min(1, 'channelTitle must be a non-empty string'),
  thumbnailUrl: z.string().url('thumbnailUrl must be a valid URL'),
  publishedAt: z.string().nullable(),
  durationText: z.string(),
  isWatchPage: z.boolean(),
});

export type ValidatedVideoContext = z.infer<typeof VideoContextSchema>;

// ---------------------------------------------------------------------------
// TranscriptSegment – individual caption segment from YouTube
// ---------------------------------------------------------------------------
export const TranscriptSegmentSchema = z.object({
  startMs: z.number().int().nonnegative('startMs must be a non-negative integer'),
  durationMs: z.number().int().positive('durationMs must be a positive integer'),
  text: z.string(),
});

export type ValidatedTranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

// ---------------------------------------------------------------------------
// AI summarization response
// ---------------------------------------------------------------------------
export const AIHighlightSchema = z.object({
  startMs: z.number().int().nonnegative(),
  text: z.string(),
  summary: z.string(),
});

export const AISummaryResponseSchema = z.object({
  overallSummary: z.string().min(1, 'overallSummary must be a non-empty string'),
  keyPoints: z.array(z.string()),
  highlights: z.array(AIHighlightSchema),
});

export type ValidatedAISummaryResponse = z.infer<typeof AISummaryResponseSchema>;

// ---------------------------------------------------------------------------
// SaveTranscriptPayload – used by the SAVE_TRANSCRIPT message handler
// ---------------------------------------------------------------------------
export const TranscriptSourceTypeSchema = z.enum(['manual', 'auto-generated', 'unknown']);

export const SaveTranscriptPayloadSchema = z.object({
  videoContext: VideoContextSchema,
  segments: z.array(TranscriptSegmentSchema).min(1, 'segments must contain at least one entry'),
  languageCode: z.string().min(1, 'languageCode must be a non-empty string'),
  languageLabel: z.string().min(1, 'languageLabel must be a non-empty string'),
  sourceType: TranscriptSourceTypeSchema,
  categoryId: z.string().optional(),
});

export type ValidatedSaveTranscriptPayload = z.infer<typeof SaveTranscriptPayloadSchema>;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Validate data against a Zod schema and return the parsed result.
 * Throws a descriptive error that includes the `context` label when
 * validation fails.
 */
export function validateOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Validation failed (${context}):\n${issues}`);
  }
  return result.data;
}

/**
 * Validate data against a Zod schema, returning `defaultValue` when
 * validation fails instead of throwing.
 */
export function validateOrDefault<T>(
  schema: z.ZodType<T>,
  data: unknown,
  defaultValue: T,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    return defaultValue;
  }
  return result.data;
}
