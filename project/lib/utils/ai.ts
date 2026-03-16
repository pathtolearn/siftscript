import type { AIProvider, AISettings, Segment } from '../../types';
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

async function callAI(prompt: string, settings: AISettings): Promise<string> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 1000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      switch (settings.provider) {
        case 'openai':
          return await callOpenAI(prompt, settings);
        case 'anthropic':
          return await callAnthropic(prompt, settings);
        case 'google':
          return await callGoogle(prompt, settings);
        case 'ollama':
          return await callOllama(prompt, settings);
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

async function callOpenAI(prompt: string, settings: AISettings): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that analyzes video transcripts. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(prompt: string, settings: AISettings): Promise<string> {
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
      system: 'You are a helpful assistant that analyzes video transcripts. Always respond with valid JSON.'
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGoogle(prompt: string, settings: AISettings): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{ text: 'You are a helpful assistant that analyzes video transcripts. Always respond with valid JSON.' }]
        },
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
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

async function callOllama(prompt: string, settings: AISettings): Promise<string> {
  const baseUrl = settings.baseUrl || 'http://localhost:11434';
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      prompt: `You are a helpful assistant that analyzes video transcripts. Always respond with valid JSON.\n\n${prompt}`,
      stream: false,
      format: 'json'
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
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
