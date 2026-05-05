import { callAI, getAISettings } from './ai';
import { conceptRepository } from '../db/repositories/conceptRepository';
import type { Concept, ConceptCategory, Transcript, Video, Segment } from '../../types';

// ─── Keyword extraction (no AI key needed) ───────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','about','into','through','during','is','are','was',
  'were','be','been','being','have','has','had','do','does','did','will',
  'would','could','should','may','might','shall','can','need','dare',
  'ought','used','this','that','these','those','i','you','he','she','it',
  'we','they','what','which','who','whom','whose','when','where','why',
  'how','all','both','each','every','either','neither','one','two','three',
  'so','if','then','than','because','as','until','while','although',
  'though','even','not','no','nor','very','just','also','here','there',
  'now','only','own','same','too','more','most','other','some','such',
  'like','well','back','still','way','first','go','think','know','see',
  'get','make','come','take','want','look','use','find','give','tell',
  'work','call','try','ask','need','feel','become','leave','put','mean',
  'keep','let','begin','show','hear','play','run','move','live','believe',
  'hold','bring','happen','write','provide','sit','stand','lose','pay',
  'meet','include','continue','set','learn','change','lead','understand',
  'watch','follow','stop','create','speak','read','spend','grow','open',
  'walk','win','offer','remember','love','consider','appear','buy','wait',
  'serve','die','send','expect','stay','fall','reach','kill','remain',
  'suggest','raise','pass','sell','require','report','decide','pull',
  'they\'re','it\'s','that\'s','i\'m','you\'re','we\'re','don\'t','can\'t',
  'won\'t','isn\'t','aren\'t','wasn\'t','weren\'t','haven\'t','hasn\'t',
  'hadn\'t','didn\'t','wouldn\'t','couldn\'t','shouldn\'t','really',
  'actually','basically','literally','honestly','definitely','probably',
  'something','anything','everything','nothing','someone','anyone','everyone',
  'kind','sort','type','thing','things','time','times','way','ways','point',
  'points','lot','lots','bit','bits','part','parts','people','person',
  'year','years','day','days','right','good','great','new','old','big',
  'little','small','large','long','short','high','low','different','same',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function extractNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    // Skip ngrams where all tokens are stopwords
    if (tokens.slice(i, i + n).every(t => STOPWORDS.has(t))) continue;
    ngrams.push(gram);
  }
  return ngrams;
}

export function extractConceptsFromKeywords(
  transcript: Transcript,
  video: Video,
): Omit<Concept, 'conceptId' | 'extractedAt'>[] {
  const tokens = tokenize(transcript.fullText);
  if (tokens.length === 0) return [];

  // Build TF map for unigrams + bigrams
  const freq = new Map<string, number>();
  const unigrams = tokens.filter(t => !STOPWORDS.has(t) && t.length > 3);
  const bigrams = extractNgrams(tokens, 2);
  const trigrams = extractNgrams(tokens, 3);

  for (const t of [...unigrams, ...bigrams, ...trigrams]) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  // Prefer longer phrases — boost bigrams/trigrams
  const scored = Array.from(freq.entries())
    .map(([phrase, count]) => {
      const wordCount = phrase.split(' ').length;
      const score = count * Math.sqrt(wordCount); // longer phrases score higher
      return { phrase, count, score };
    })
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return scored.map(({ phrase, count }) => {
    // Find a context snippet
    const idx = transcript.fullText.toLowerCase().indexOf(phrase);
    const context = idx >= 0
      ? transcript.fullText.slice(Math.max(0, idx - 40), idx + phrase.length + 80).trim()
      : '';

    return {
      transcriptId: transcript.transcriptId,
      videoId: transcript.videoId,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      label: phrase,
      normalizedLabel: phrase.toLowerCase().trim(),
      category: 'topic' as ConceptCategory,
      mentions: count,
      context,
      publishedAt: video.publishedAt,
      extractionMethod: 'keyword' as const,
    };
  });
}

// ─── AI extraction ────────────────────────────────────────────────────────────

interface RawAIConcept {
  label: string;
  category: string;
  mentions: number;
  context: string;
}

const VALID_CATEGORIES = new Set<ConceptCategory>([
  'idea','framework','person','book','topic','organization',
]);

function sanitizeCategory(raw: string): ConceptCategory {
  const lower = raw?.toLowerCase()?.trim() as ConceptCategory;
  return VALID_CATEGORIES.has(lower) ? lower : 'topic';
}

export async function extractConceptsWithAI(
  transcript: Transcript,
  video: Video,
): Promise<Omit<Concept, 'conceptId' | 'extractedAt'>[] | null> {
  const settings = await getAISettings();
  if (!settings) return null;

  // Use first 8000 chars to keep prompt cost low — enough context for concept extraction
  const excerpt = transcript.fullText.slice(0, 8000);

  const prompt = `Extract the most significant concepts from this YouTube transcript for a research knowledge base.

Video: "${video.title}" by ${video.channelTitle}

Transcript:
${excerpt}

Extract up to 20 of the most significant concepts. Focus on:
- Ideas and mental models discussed (not just mentioned)
- Frameworks or methodologies explained
- Notable people referenced by name
- Books or papers mentioned
- Key subject areas covered in depth
- Organizations or institutions relevant to the content

Return JSON only:
{
  "concepts": [
    {
      "label": "exact concept name as it would be searched",
      "category": "idea|framework|person|book|topic|organization",
      "mentions": <estimated frequency 1-10>,
      "context": "one sentence from the transcript that best shows this concept"
    }
  ]
}`;

  try {
    const raw = await callAI(prompt, settings, 'json');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { concepts: RawAIConcept[] };
    if (!Array.isArray(parsed.concepts)) return null;

    return parsed.concepts
      .filter(c => c.label && typeof c.label === 'string' && c.label.trim().length > 1)
      .map(c => ({
        transcriptId: transcript.transcriptId,
        videoId: transcript.videoId,
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        label: c.label.trim(),
        normalizedLabel: c.label.trim().toLowerCase(),
        category: sanitizeCategory(c.category),
        mentions: typeof c.mentions === 'number' ? Math.max(1, c.mentions) : 1,
        context: typeof c.context === 'string' ? c.context.slice(0, 300) : '',
        publishedAt: video.publishedAt,
        extractionMethod: 'ai' as const,
      }));
  } catch {
    return null;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

function makeId(): string {
  return `concept-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract concepts for a transcript and persist them.
 * Tries AI first; falls back to keyword extraction if no key / AI fails.
 * Idempotent — safe to re-run on the same transcript.
 */
export async function extractConcepts(
  transcript: Transcript,
  video: Video,
): Promise<void> {
  const now = new Date();

  // Try AI extraction first
  let rawConcepts = await extractConceptsWithAI(transcript, video);

  // Fallback to keywords
  if (!rawConcepts || rawConcepts.length === 0) {
    rawConcepts = extractConceptsFromKeywords(transcript, video);
  }

  if (rawConcepts.length === 0) return;

  const concepts: Concept[] = rawConcepts.map(c => ({
    ...c,
    conceptId: makeId(),
    extractedAt: now,
  }));

  await conceptRepository.saveForTranscript(concepts);
}
