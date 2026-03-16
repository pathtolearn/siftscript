import type { AIProvider, AISettings, Segment, RepurposeType } from '../../types';
import { getSecureKey, saveSecureKey, removeSecureKey, SECURE_KEYS } from './secureStorage';

// Storage keys
const AI_SETTINGS_KEY = 'ai_settings';

// Provider configurations
export const AI_PROVIDERS: Record<AIProvider, {
  name: string;
  models: string[];
  defaultModel: string;
  requiresKey: boolean;
}> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    requiresKey: true
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],
    defaultModel: 'claude-sonnet-4-6',
    requiresKey: true
  },
  google: {
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    requiresKey: true
  },
  ollama: {
    name: 'Ollama (Local)',
    models: ['llama3.1', 'llama3', 'mistral', 'mixtral', 'phi3', 'gemma2'],
    defaultModel: 'llama3.1',
    requiresKey: false
  }
};

export async function getAISettings(): Promise<AISettings | null> {
  const stored = localStorage.getItem(AI_SETTINGS_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    // Retrieve the API key from secure storage
    const apiKey = await getSecureKey(SECURE_KEYS.AI_API_KEY);
    return { ...parsed, apiKey: apiKey || '' };
  } catch {
    return null;
  }
}

export async function setAISettings(settings: AISettings): Promise<void> {
  // Save non-sensitive settings to localStorage (without the API key)
  const { apiKey, ...nonSensitive } = settings;
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(nonSensitive));
  // Save API key to secure storage
  await saveSecureKey(SECURE_KEYS.AI_API_KEY, apiKey);
}

export async function clearAISettings(): Promise<void> {
  localStorage.removeItem(AI_SETTINGS_KEY);
  await removeSecureKey(SECURE_KEYS.AI_API_KEY);
}

export async function validateAIConnection(settings: AISettings): Promise<boolean> {
  try {
    switch (settings.provider) {
      case 'openai':
        return await validateOpenAI(settings);
      case 'anthropic':
        return await validateAnthropic(settings);
      case 'google':
        return await validateGoogle(settings);
      case 'ollama':
        return await validateOllama(settings);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

async function validateOpenAI(settings: AISettings): Promise<boolean> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${settings.apiKey}` }
  });
  return response.ok;
}

async function validateAnthropic(settings: AISettings): Promise<boolean> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }]
    })
  });
  return response.ok;
}

async function validateGoogle(settings: AISettings): Promise<boolean> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`
  );
  return response.ok;
}

async function validateOllama(settings: AISettings): Promise<boolean> {
  const baseUrl = settings.baseUrl || 'http://localhost:11434';
  const response = await fetch(`${baseUrl}/api/tags`);
  return response.ok;
}

// Chunk transcript segments to fit within context windows
function chunkSegments(segments: Segment[], maxCharsPerChunk: number = 12000): Segment[][] {
  const chunks: Segment[][] = [];
  let currentChunk: Segment[] = [];
  let currentLength = 0;

  for (const segment of segments) {
    const segLength = segment.text.length + 20; // Account for timestamp formatting
    if (currentLength + segLength > maxCharsPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(segment);
    currentLength += segLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function sanitizeTranscriptText(text: string): string {
  // Remove non-printable characters except newlines
  let sanitized = text.replace(/[^\x20-\x7E\n]/g, '');

  // Strip common prompt injection patterns (case-insensitive)
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /ignore\s+(all\s+)?above\s+instructions/gi,
    /disregard\s+(all\s+)?previous\s+instructions/gi,
    /^system\s*:/gim,
    /^assistant\s*:/gim,
    /^human\s*:/gim,
    /\<\/?system\>/gi,
    /\<\/?assistant\>/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }

  // Limit individual segment text to 500 chars
  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 500) + '...';
  }

  return sanitized;
}

function formatSegmentsForPrompt(segments: Segment[]): string {
  return segments.map(s => {
    const seconds = Math.floor(s.startMs / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    const sanitizedText = sanitizeTranscriptText(s.text);
    return `[${min}:${sec.toString().padStart(2, '0')}] ${sanitizedText}`;
  }).join('\n');
}

export interface SummarizationResult {
  overallSummary: string;
  keyPoints: string[];
  keyTakeaways: Array<{
    takeaway: string;
    context: string;
  }>;
  highlights: Array<{
    startMs: number;
    text: string;
    summary: string;
  }>;
}

export async function summarizeTranscript(
  segments: Segment[],
  videoTitle: string,
  settings: AISettings,
  onProgress?: (current: number, total: number) => void
): Promise<SummarizationResult> {
  const chunks = chunkSegments(segments);

  if (chunks.length === 1) {
    const result = await summarizeChunk(chunks[0], videoTitle, settings, true);
    onProgress?.(1, 1);
    return result;
  }

  // Multi-chunk: summarize each chunk, then combine
  const chunkSummaries: SummarizationResult[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const result = await summarizeChunk(chunks[i], videoTitle, settings, false);
    chunkSummaries.push(result);
    onProgress?.(i + 1, chunks.length);
  }

  // Combine chunk summaries
  return await combineSummaries(chunkSummaries, videoTitle, settings);
}

async function summarizeChunk(
  segments: Segment[],
  videoTitle: string,
  settings: AISettings,
  isFull: boolean
): Promise<SummarizationResult> {
  const transcriptText = formatSegmentsForPrompt(segments);

  const prompt = isFull
    ? `You are an expert content analyst. Analyze this YouTube video transcript titled "${videoTitle}" and provide a structured breakdown.

Instructions:
- Write a clear, well-structured summary that captures the main narrative and purpose of the video
- Extract key points that represent the most important ideas discussed
- Identify actionable takeaways — things the viewer can learn, apply, or remember. Each takeaway should have a short context explaining why it matters
- Pick the most impactful or interesting moments as highlights with their timestamps (use the startMs value from the transcript timestamps)

Transcript:
${transcriptText}

Respond in this exact JSON format:
{
  "overallSummary": "A comprehensive 2-3 paragraph summary covering the main topic, key arguments, and conclusions",
  "keyPoints": ["Concise point 1", "Concise point 2"],
  "keyTakeaways": [{"takeaway": "Actionable insight or lesson", "context": "Brief explanation of why this matters"}],
  "highlights": [{"startMs": 0, "text": "quoted text from transcript", "summary": "Why this moment is notable"}]
}`
    : `Summarize this section of a YouTube video transcript titled "${videoTitle}". Extract key points, actionable takeaways, and notable moments.

Transcript section:
${transcriptText}

Respond in this exact JSON format:
{
  "overallSummary": "Section summary",
  "keyPoints": ["Point 1", "Point 2"],
  "keyTakeaways": [{"takeaway": "Actionable insight", "context": "Why it matters"}],
  "highlights": [{"startMs": 0, "text": "quoted text", "summary": "Why this is notable"}]
}`;

  const response = await callAI(prompt, settings);
  return parseAIResponse(response);
}

async function combineSummaries(
  summaries: SummarizationResult[],
  videoTitle: string,
  settings: AISettings
): Promise<SummarizationResult> {
  const combinedText = summaries.map((s, i) =>
    `Part ${i + 1}:\nSummary: ${s.overallSummary}\nKey Points: ${s.keyPoints.join('; ')}\nTakeaways: ${s.keyTakeaways.map(t => t.takeaway).join('; ')}`
  ).join('\n\n');

  const prompt = `Combine these section summaries of the YouTube video "${videoTitle}" into a single coherent analysis.

Section summaries:
${combinedText}

Respond in this exact JSON format:
{
  "overallSummary": "A unified 2-3 paragraph summary covering the entire video",
  "keyPoints": ["5-8 key points covering the whole video"],
  "keyTakeaways": [{"takeaway": "Actionable insight or lesson", "context": "Why this matters"}],
  "highlights": [{"startMs": 0, "text": "quoted text", "summary": "Why this is notable"}]
}`;

  const response = await callAI(prompt, settings);
  const result = parseAIResponse(response);

  // Merge highlights from all chunks if AI didn't include timestamps
  if (result.highlights.length === 0) {
    result.highlights = summaries.flatMap(s => s.highlights).slice(0, 5);
  }

  // Merge takeaways if AI didn't include them
  if (result.keyTakeaways.length === 0) {
    result.keyTakeaways = summaries.flatMap(s => s.keyTakeaways).slice(0, 6);
  }

  return result;
}

type AIResponseFormat = 'json' | 'text';

async function callAI(prompt: string, settings: AISettings, format: AIResponseFormat = 'json'): Promise<string> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 1000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      switch (settings.provider) {
        case 'openai':
          return await callOpenAI(prompt, settings, format);
        case 'anthropic':
          return await callAnthropic(prompt, settings, format);
        case 'google':
          return await callGoogle(prompt, settings, format);
        case 'ollama':
          return await callOllama(prompt, settings, format);
        default:
          throw new Error(`Unsupported AI provider: ${settings.provider}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if the error is retryable (429 or 5xx)
      const statusMatch = lastError.message.match(/(\d{3})/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;
      const isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

      if (!isRetryable || attempt >= MAX_RETRIES) {
        throw lastError;
      }

      // Exponential backoff: 1000ms, 2000ms, 4000ms
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

const SYSTEM_PROMPT_JSON = 'You are a helpful assistant that analyzes video transcripts. Always respond with valid JSON.';
const SYSTEM_PROMPT_TEXT = 'You are a helpful assistant that analyzes video transcripts. Respond with well-formatted markdown content.';

async function callOpenAI(prompt: string, settings: AISettings, format: AIResponseFormat): Promise<string> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [
      { role: 'system', content: format === 'json' ? SYSTEM_PROMPT_JSON : SYSTEM_PROMPT_TEXT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
  };
  if (format === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(prompt: string, settings: AISettings, format: AIResponseFormat): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      system: format === 'json' ? SYSTEM_PROMPT_JSON : SYSTEM_PROMPT_TEXT
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGoogle(prompt: string, settings: AISettings, format: AIResponseFormat): Promise<string> {
  const generationConfig: Record<string, unknown> = { temperature: 0.3 };
  if (format === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{ text: format === 'json' ? SYSTEM_PROMPT_JSON : SYSTEM_PROMPT_TEXT }]
        },
        generationConfig
      })
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Google AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callOllama(prompt: string, settings: AISettings, format: AIResponseFormat): Promise<string> {
  const baseUrl = settings.baseUrl || 'http://localhost:11434';
  const systemPrompt = format === 'json' ? SYSTEM_PROMPT_JSON : SYSTEM_PROMPT_TEXT;
  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: `${systemPrompt}\n\n${prompt}`,
    stream: false,
  };
  if (format === 'json') {
    body.format = 'json';
  }

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

// --- Content Repurposing ---

// Which repurpose types need JSON response vs plain text/markdown
const REPURPOSE_JSON_TYPES: Set<RepurposeType> = new Set(['twitter_thread', 'key_quotes']);

const REPURPOSE_PROMPTS: Record<RepurposeType, (title: string) => string> = {
  blog_post: (title) => `Convert this YouTube video transcript titled "${title}" into a well-structured blog post.

Instructions:
- Write a compelling introduction that hooks the reader
- Organize the content into logical sections with markdown headers (##)
- Add a conclusion that summarizes the key points
- Use markdown formatting: headers, bold, bullet points, blockquotes for key insights
- Write in a professional, engaging tone
- Aim for 800-1200 words

Respond with ONLY the blog post content in clean markdown. No JSON wrapping. No code fences.`,

  twitter_thread: (title) => `Convert this YouTube video transcript titled "${title}" into a Twitter/X thread.

Instructions:
- Create 10-15 tweets that cover the key ideas
- Start with a hook tweet that grabs attention
- Each tweet should be under 280 characters
- End with a summary/CTA tweet
- Include relevant emojis sparingly
- Make each tweet standalone yet connected to the narrative

Respond in this JSON format:
{"tweets": ["tweet 1 text", "tweet 2 text", ...]}`,

  study_guide: (title) => `Convert this YouTube video transcript titled "${title}" into a comprehensive study guide.

Instructions:
- Start with a "Learning Objectives" section
- Organize content into clearly labeled topics/sections
- Include "Key Terms" with definitions
- Add "Review Questions" at the end (5-8 questions)
- Use markdown formatting with headers, bullet points, and bold for emphasis
- Include a brief summary at the end

Respond with ONLY the study guide content in clean markdown. No JSON wrapping. No code fences.`,

  meeting_notes: (title) => `Convert this YouTube video transcript titled "${title}" into structured meeting notes.

Instructions:
- Start with meeting metadata (Topic, Date reference from content if available)
- List attendees/speakers if identifiable
- Create an "Agenda Items" section with key discussion points
- Include "Action Items" with clear owners if mentioned
- Add a "Decisions Made" section
- Include "Key Takeaways" at the end
- Use markdown formatting with checkboxes (- [ ]) for action items

Respond with ONLY the meeting notes in clean markdown. No JSON wrapping. No code fences.`,

  newsletter: (title) => `Convert this YouTube video transcript titled "${title}" into an engaging newsletter edition.

Instructions:
- Write a catchy subject line / headline as an H1 header
- Start with a brief, engaging intro (2-3 sentences)
- Break down the key insights into digestible sections with H2 headers
- Add a "Quick Takeaways" bullet list
- Include a "What This Means For You" section
- End with a call to action
- Use markdown formatting, keep it concise and scannable

Respond with ONLY the newsletter content in clean markdown. No JSON wrapping. No code fences.`,

  key_quotes: (title) => `Extract the most impactful and quotable moments from this YouTube video transcript titled "${title}".

Instructions:
- Find 8-12 of the most insightful, quotable, or thought-provoking statements
- For each quote, include the approximate timestamp and a brief context note
- Organize by theme if there are clear groupings
- Include the exact words from the transcript (minor cleanup for readability is fine)

Respond in this JSON format:
{"quotes": [{"text": "exact quote", "startMs": 0, "context": "brief context about why this quote matters"}]}`
};

export interface RepurposeResult {
  type: RepurposeType;
  content: string;
  metadata: Record<string, unknown>;
}

export async function repurposeTranscript(
  segments: Segment[],
  videoTitle: string,
  settings: AISettings,
  type: RepurposeType,
  onProgress?: (current: number, total: number) => void
): Promise<RepurposeResult> {
  const chunks = chunkSegments(segments);
  const promptBuilder = REPURPOSE_PROMPTS[type];
  const format: AIResponseFormat = REPURPOSE_JSON_TYPES.has(type) ? 'json' : 'text';

  if (chunks.length === 1) {
    const transcriptText = formatSegmentsForPrompt(chunks[0]);
    const prompt = `${promptBuilder(videoTitle)}\n\nTranscript:\n${transcriptText}`;
    const response = await callAI(prompt, settings, format);
    onProgress?.(1, 1);
    return parseRepurposeResponse(type, response);
  }

  // Multi-chunk: first summarize chunks, then repurpose from combined summary
  const chunkTexts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const text = formatSegmentsForPrompt(chunks[i]);
    chunkTexts.push(text);
    onProgress?.(i + 1, chunks.length + 1);
  }

  const combinedText = chunkTexts.join('\n\n---SECTION BREAK---\n\n');
  const prompt = `${promptBuilder(videoTitle)}\n\nTranscript (multiple sections):\n${combinedText}`;
  const response = await callAI(prompt, settings, format);
  onProgress?.(chunks.length + 1, chunks.length + 1);
  return parseRepurposeResponse(type, response);
}

function parseRepurposeResponse(type: RepurposeType, response: string): RepurposeResult {
  // Twitter thread: parse JSON, format as numbered tweets in markdown
  if (type === 'twitter_thread') {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const tweets = Array.isArray(parsed.tweets) ? parsed.tweets : [];
        const formatted = tweets.map((t: string, i: number) =>
          `**${i + 1}/${tweets.length}**\n${t}`
        ).join('\n\n---\n\n');
        return {
          type,
          content: formatted,
          metadata: { tweetCount: tweets.length, tweets },
        };
      }
    } catch { /* fall through */ }
  }

  // Key quotes: parse JSON, format as a styled markdown list
  if (type === 'key_quotes') {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const quotes = Array.isArray(parsed.quotes) ? parsed.quotes : [];
        const formatted = quotes.map((q: { text: string; startMs?: number; context?: string }, i: number) => {
          const min = Math.floor((q.startMs || 0) / 60000);
          const sec = Math.floor(((q.startMs || 0) % 60000) / 1000);
          const ts = q.startMs ? ` \`${min}:${String(sec).padStart(2, '0')}\`` : '';
          return `> "${q.text}"${ts}\n\n*${q.context || ''}*`;
        }).join('\n\n---\n\n');
        return { type, content: formatted, metadata: { quoteCount: quotes.length, quotes } };
      }
    } catch { /* fall through */ }
  }

  // For text-mode responses (blog, study guide, etc.): clean up the raw response
  let content = response;

  // Strip wrapping code fences (```markdown ... ``` or ``` ... ```)
  content = content.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/i, '');

  // If the AI still returned JSON with a "content" field, extract it
  if (content.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed.content === 'string') {
        content = parsed.content;
      } else if (typeof parsed.blog_post === 'string') {
        content = parsed.blog_post;
      } else if (typeof parsed.text === 'string') {
        content = parsed.text;
      } else if (typeof parsed.result === 'string') {
        content = parsed.result;
      } else if (typeof parsed.output === 'string') {
        content = parsed.output;
      }
    } catch { /* not JSON, use as-is */ }
  }

  return { type, content: content.trim(), metadata: {} };
}

// --- Chapter Detection ---

export interface ChapterDetectionResult {
  chapters: Array<{
    title: string;
    startMs: number;
    endMs: number;
    description: string;
  }>;
}

export async function detectChapters(
  segments: Segment[],
  videoTitle: string,
  settings: AISettings,
  onProgress?: (current: number, total: number) => void
): Promise<ChapterDetectionResult> {
  const chunks = chunkSegments(segments);

  if (chunks.length === 1) {
    const transcriptText = formatSegmentsForPrompt(chunks[0]);
    const prompt = buildChapterPrompt(videoTitle, transcriptText);
    const response = await callAI(prompt, settings);
    onProgress?.(1, 1);
    return parseChapterResponse(response);
  }

  // For multi-chunk: process all chunks together with a combined prompt
  const allText = chunks.map(c => formatSegmentsForPrompt(c)).join('\n');
  const prompt = buildChapterPrompt(videoTitle, allText);
  const response = await callAI(prompt, settings);
  onProgress?.(1, 1);
  return parseChapterResponse(response);
}

function buildChapterPrompt(videoTitle: string, transcriptText: string): string {
  return `Analyze this transcript of the YouTube video "${videoTitle}" and identify 5-10 distinct topic sections/chapters.

For each chapter, provide:
- A concise, descriptive title
- The startMs timestamp (use the timestamps from the transcript, converted to milliseconds)
- The endMs timestamp
- A one-line description of what's discussed

Transcript:
${transcriptText}

Respond in this exact JSON format:
{"chapters": [{"title": "Chapter Title", "startMs": 0, "endMs": 60000, "description": "Brief description of this section"}]}`;
}

function parseChapterResponse(response: string): ChapterDetectionResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
      return {
        chapters: chapters.map((c: { title?: string; startMs?: number; endMs?: number; description?: string }) => ({
          title: c.title || 'Untitled Section',
          startMs: c.startMs || 0,
          endMs: c.endMs || 0,
          description: c.description || '',
        })),
      };
    }
  } catch { /* fall through */ }
  return { chapters: [] };
}

// --- AI Transcript Cleanup ---

export interface CleanupResult {
  cleanedSegments: Array<{
    segmentId: string;
    cleanedText: string;
  }>;
}

export async function cleanupTranscript(
  segments: Segment[],
  languageCode: string,
  settings: AISettings,
  onProgress?: (current: number, total: number) => void
): Promise<CleanupResult> {
  const chunks = chunkSegments(segments, 8000);
  const allCleaned: CleanupResult['cleanedSegments'] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const segmentTexts = chunk.map(s => ({
      id: s.segmentId,
      text: sanitizeTranscriptText(s.text),
    }));

    const prompt = `Fix grammar, punctuation, capitalization, and proper nouns in this auto-generated transcript. Preserve the original meaning and timing structure. Language: ${languageCode}

Input segments (JSON array):
${JSON.stringify(segmentTexts)}

Respond in this exact JSON format:
{"segments": [{"id": "segment-id", "text": "cleaned text"}]}`;

    const response = await callAI(prompt, settings);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.segments)) {
          for (const s of parsed.segments) {
            allCleaned.push({ segmentId: s.id, cleanedText: s.text });
          }
        }
      }
    } catch {
      // If parsing fails, keep original text
      for (const s of chunk) {
        allCleaned.push({ segmentId: s.segmentId, cleanedText: s.text });
      }
    }
    onProgress?.(i + 1, chunks.length);
  }

  return { cleanedSegments: allCleaned };
}

// --- Speaker Detection ---

export interface SpeakerDetectionResult {
  speakers: Array<{
    id: string;
    label: string;
  }>;
  assignments: Array<{
    segmentId: string;
    speakerId: string;
  }>;
}

export async function detectSpeakers(
  segments: Segment[],
  settings: AISettings,
  onProgress?: (current: number, total: number) => void
): Promise<SpeakerDetectionResult> {
  const chunks = chunkSegments(segments, 8000);

  // First pass: detect speakers from initial chunk
  const firstChunkText = formatSegmentsForPrompt(chunks[0]);
  const detectPrompt = `Analyze this transcript and identify different speakers. Look for:
- Topic/perspective changes suggesting different speakers
- Question/answer patterns
- Speech style differences
- Explicit speaker references (interviewer mentions, introductions)

Transcript:
${firstChunkText}

Respond in this exact JSON format:
{"speakers": [{"id": "speaker_1", "label": "Speaker 1 (or their name if identifiable)"}], "assignments": [{"segmentIndex": 0, "speakerId": "speaker_1"}]}

Use segmentIndex (0-based position in the transcript) for assignments.`;

  const detectResponse = await callAI(detectPrompt, settings);
  onProgress?.(1, chunks.length + 1);

  let speakers: Array<{ id: string; label: string }> = [];
  const allAssignments: Array<{ segmentId: string; speakerId: string }> = [];

  try {
    const jsonMatch = detectResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      speakers = Array.isArray(parsed.speakers) ? parsed.speakers : [];

      if (Array.isArray(parsed.assignments)) {
        for (const a of parsed.assignments) {
          const segIndex = a.segmentIndex;
          if (segIndex >= 0 && segIndex < chunks[0].length) {
            allAssignments.push({
              segmentId: chunks[0][segIndex].segmentId,
              speakerId: a.speakerId,
            });
          }
        }
      }
    }
  } catch { /* continue with empty results */ }

  // Process remaining chunks with known speakers
  if (speakers.length > 0 && chunks.length > 1) {
    const speakerList = speakers.map(s => `${s.id}: ${s.label}`).join(', ');
    let globalIndex = chunks[0].length;

    for (let i = 1; i < chunks.length; i++) {
      const chunkText = formatSegmentsForPrompt(chunks[i]);
      const assignPrompt = `Given these known speakers: ${speakerList}

Assign speakers to each segment in this transcript continuation. Use segmentIndex (0-based for THIS chunk).

Transcript:
${chunkText}

Respond in JSON: {"assignments": [{"segmentIndex": 0, "speakerId": "speaker_1"}]}`;

      try {
        const response = await callAI(assignPrompt, settings);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.assignments)) {
            for (const a of parsed.assignments) {
              const segIndex = a.segmentIndex;
              if (segIndex >= 0 && segIndex < chunks[i].length) {
                allAssignments.push({
                  segmentId: chunks[i][segIndex].segmentId,
                  speakerId: a.speakerId,
                });
              }
            }
          }
        }
      } catch { /* skip failed chunk */ }

      globalIndex += chunks[i].length;
      onProgress?.(i + 1, chunks.length + 1);
    }
  }

  return { speakers, assignments: allAssignments };
}

function parseAIResponse(response: string): SummarizationResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      overallSummary: parsed.overallSummary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      keyTakeaways: Array.isArray(parsed.keyTakeaways)
        ? parsed.keyTakeaways.map((t: { takeaway?: string; context?: string }) => ({
            takeaway: t.takeaway || '',
            context: t.context || ''
          }))
        : [],
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.map((h: { startMs?: number; text?: string; summary?: string }) => ({
            startMs: h.startMs || 0,
            text: h.text || '',
            summary: h.summary || ''
          }))
        : []
    };
  } catch {
    // Fallback: treat the entire response as the summary
    return {
      overallSummary: response,
      keyPoints: [],
      keyTakeaways: [],
      highlights: []
    };
  }
}
