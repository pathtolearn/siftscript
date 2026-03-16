import { describe, it, expect } from 'vitest';
import {
  VideoContextSchema,
  TranscriptSegmentSchema,
  AISummaryResponseSchema,
  validateOrThrow,
  validateOrDefault,
} from '../lib/validation/schemas';

// ---------------------------------------------------------------------------
// VideoContextSchema
// ---------------------------------------------------------------------------
describe('VideoContextSchema', () => {
  const validVideoContext = {
    videoId: 'abc123',
    url: 'https://www.youtube.com/watch?v=abc123',
    title: 'Test Video',
    channelId: 'ch_001',
    channelTitle: 'Test Channel',
    thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    publishedAt: '2024-01-01',
    durationText: '10:30',
    isWatchPage: true,
  };

  it('accepts valid data', () => {
    const result = VideoContextSchema.safeParse(validVideoContext);
    expect(result.success).toBe(true);
  });

  it('accepts null publishedAt', () => {
    const result = VideoContextSchema.safeParse({
      ...validVideoContext,
      publishedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { title, ...missing } = validVideoContext;
    const result = VideoContextSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = VideoContextSchema.safeParse({
      ...validVideoContext,
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty videoId', () => {
    const result = VideoContextSchema.safeParse({
      ...validVideoContext,
      videoId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid thumbnailUrl', () => {
    const result = VideoContextSchema.safeParse({
      ...validVideoContext,
      thumbnailUrl: 'bad-url',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TranscriptSegmentSchema
// ---------------------------------------------------------------------------
describe('TranscriptSegmentSchema', () => {
  it('accepts a valid segment', () => {
    const result = TranscriptSegmentSchema.safeParse({
      startMs: 0,
      durationMs: 5000,
      text: 'Hello world',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative startMs', () => {
    const result = TranscriptSegmentSchema.safeParse({
      startMs: -100,
      durationMs: 5000,
      text: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero durationMs', () => {
    const result = TranscriptSegmentSchema.safeParse({
      startMs: 0,
      durationMs: 0,
      text: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer startMs', () => {
    const result = TranscriptSegmentSchema.safeParse({
      startMs: 1.5,
      durationMs: 5000,
      text: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty text', () => {
    const result = TranscriptSegmentSchema.safeParse({
      startMs: 0,
      durationMs: 1000,
      text: '',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AISummaryResponseSchema
// ---------------------------------------------------------------------------
describe('AISummaryResponseSchema', () => {
  it('accepts a valid response', () => {
    const result = AISummaryResponseSchema.safeParse({
      overallSummary: 'This video covers...',
      keyPoints: ['Point 1', 'Point 2'],
      highlights: [
        { startMs: 0, text: 'intro', summary: 'Beginning of video' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty arrays for keyPoints and highlights', () => {
    const result = AISummaryResponseSchema.safeParse({
      overallSummary: 'Summary text',
      keyPoints: [],
      highlights: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty overallSummary', () => {
    const result = AISummaryResponseSchema.safeParse({
      overallSummary: '',
      keyPoints: [],
      highlights: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing keyPoints', () => {
    const result = AISummaryResponseSchema.safeParse({
      overallSummary: 'Summary',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateOrThrow
// ---------------------------------------------------------------------------
describe('validateOrThrow', () => {
  it('returns parsed data on valid input', () => {
    const data = { startMs: 0, durationMs: 1000, text: 'hi' };
    const result = validateOrThrow(TranscriptSegmentSchema, data, 'test-segment');
    expect(result).toEqual(data);
  });

  it('throws with context message on invalid input', () => {
    expect(() =>
      validateOrThrow(TranscriptSegmentSchema, { startMs: -1 }, 'bad-segment'),
    ).toThrow('Validation failed (bad-segment)');
  });

  it('includes field path in error message', () => {
    try {
      validateOrThrow(TranscriptSegmentSchema, { startMs: -1, durationMs: 0, text: '' }, 'ctx');
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('startMs');
    }
  });
});

// ---------------------------------------------------------------------------
// validateOrDefault
// ---------------------------------------------------------------------------
describe('validateOrDefault', () => {
  it('returns parsed data on valid input', () => {
    const data = { startMs: 0, durationMs: 500, text: 'ok' };
    const result = validateOrDefault(TranscriptSegmentSchema, data, {
      startMs: 0,
      durationMs: 1,
      text: '',
    });
    expect(result).toEqual(data);
  });

  it('returns default value on invalid input', () => {
    const fallback = { startMs: 0, durationMs: 1, text: 'default' };
    const result = validateOrDefault(
      TranscriptSegmentSchema,
      { startMs: 'not a number' },
      fallback,
    );
    expect(result).toEqual(fallback);
  });
});
