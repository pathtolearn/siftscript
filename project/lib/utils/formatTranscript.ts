import type { Segment, FormattedParagraph } from '../../types';

const SENTENCE_ENDINGS = /[.!?]+\s*/;
const PAUSE_THRESHOLD_MS = 2000;

export function formatAsReadableText(segments: Segment[]): FormattedParagraph[] {
  if (segments.length === 0) return [];

  const paragraphs: FormattedParagraph[] = [];
  let currentText = '';
  let currentStartMs = segments[0].startMs;
  let currentSegmentIds: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    currentSegmentIds.push(segment.segmentId);

    // Add space before appending if needed
    if (currentText && !currentText.endsWith(' ')) {
      currentText += ' ';
    }
    currentText += segment.text.trim();

    // Determine if we should break into a new paragraph
    const hasLongPause = nextSegment &&
      (nextSegment.startMs - (segment.startMs + segment.durationMs)) > PAUSE_THRESHOLD_MS;
    const isLastSegment = i === segments.length - 1;

    if (hasLongPause || isLastSegment) {
      if (currentText.trim()) {
        paragraphs.push({
          startMs: currentStartMs,
          endMs: segment.startMs + segment.durationMs,
          text: cleanupText(currentText),
          segmentIds: [...currentSegmentIds],
        });
      }
      currentText = '';
      currentSegmentIds = [];
      if (nextSegment) {
        currentStartMs = nextSegment.startMs;
      }
    }
  }

  // If no natural breaks were found and we only got one giant paragraph,
  // split by sentence boundaries for readability
  if (paragraphs.length === 1 && paragraphs[0].segmentIds.length > 20) {
    return splitBySentences(segments);
  }

  return paragraphs;
}

function splitBySentences(segments: Segment[]): FormattedParagraph[] {
  const paragraphs: FormattedParagraph[] = [];
  let currentText = '';
  let currentStartMs = segments[0].startMs;
  let currentSegmentIds: string[] = [];
  let sentenceCount = 0;
  const TARGET_SENTENCES = 4;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentSegmentIds.push(segment.segmentId);

    if (currentText && !currentText.endsWith(' ')) {
      currentText += ' ';
    }
    currentText += segment.text.trim();

    // Count sentence endings in this segment
    const endings = segment.text.match(/[.!?]+/g);
    if (endings) {
      sentenceCount += endings.length;
    }

    if (sentenceCount >= TARGET_SENTENCES || i === segments.length - 1) {
      if (currentText.trim()) {
        paragraphs.push({
          startMs: currentStartMs,
          endMs: segment.startMs + segment.durationMs,
          text: cleanupText(currentText),
          segmentIds: [...currentSegmentIds],
        });
      }
      currentText = '';
      currentSegmentIds = [];
      sentenceCount = 0;
      if (segments[i + 1]) {
        currentStartMs = segments[i + 1].startMs;
      }
    }
  }

  return paragraphs;
}

function cleanupText(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/\s([.!?,;:])/g, '$1') // Remove space before punctuation
    .trim();
}

export function formatAsPlainText(segments: Segment[]): string {
  const paragraphs = formatAsReadableText(segments);
  return paragraphs.map(p => p.text).join('\n\n');
}

export function formatTimestampAnchor(ms: number): string {
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

export function formatAsReadableMarkdown(segments: Segment[], includeTimestamps: boolean = true): string {
  const paragraphs = formatAsReadableText(segments);
  return paragraphs.map(p => {
    const anchor = includeTimestamps ? `**[${formatTimestampAnchor(p.startMs)}]** ` : '';
    return `${anchor}${p.text}`;
  }).join('\n\n');
}
