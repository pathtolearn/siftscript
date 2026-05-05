import type { AISettings, CrossAnalysis, Segment } from '../../types';
import { callAI, chunkSegments, sanitizeTranscriptText } from './ai';

interface TranscriptInput {
  transcriptId: string;
  videoTitle: string;
  segments: Segment[];
}

export interface CrossVideoAnalysisResult {
  themes: CrossAnalysis['themes'];
  contradictions: CrossAnalysis['contradictions'];
  progression: CrossAnalysis['progression'];
  synthesis: string;
}

/**
 * Two-pass cross-video analysis pipeline:
 * 1. Summarize each transcript into a concise argument summary
 * 2. Cross-analyze all summaries together for themes, contradictions, progression
 */
export async function analyzeCrossVideo(
  transcripts: TranscriptInput[],
  settings: AISettings,
  onProgress?: (step: string, current: number, total: number) => void
): Promise<CrossVideoAnalysisResult> {
  if (transcripts.length < 2) {
    throw new Error('Cross-video analysis requires at least 2 transcripts');
  }

  // Pass 1: Generate concise argument summaries for each transcript
  const videoSummaries: Array<{ videoTitle: string; summary: string }> = [];
  const totalSteps = transcripts.length + 1;

  for (let i = 0; i < transcripts.length; i++) {
    const t = transcripts[i];
    onProgress?.('Summarizing', i + 1, totalSteps);

    const summary = await summarizeForCrossAnalysis(t.segments, t.videoTitle, settings);
    videoSummaries.push({ videoTitle: t.videoTitle, summary });
  }

  // Pass 2: Cross-analyze all summaries together
  onProgress?.('Cross-analyzing', transcripts.length + 1, totalSteps);
  const result = await crossAnalyze(videoSummaries, settings);

  return result;
}

async function summarizeForCrossAnalysis(
  segments: Segment[],
  videoTitle: string,
  settings: AISettings
): Promise<string> {
  const chunks = chunkSegments(segments);

  // Build a condensed text representation
  const textParts: string[] = [];
  for (const chunk of chunks) {
    const text = chunk.map(s => sanitizeTranscriptText(s.text)).join(' ');
    textParts.push(text);
  }

  let combinedText = textParts.join('\n\n');

  // If too long, truncate to ~12K chars to fit in a single prompt
  if (combinedText.length > 12000) {
    combinedText = combinedText.slice(0, 12000) + '...';
  }

  const prompt = `Provide a concise argument summary of this video transcript titled "${videoTitle}". Focus on:
- Main thesis/argument
- Key claims and evidence presented
- Notable opinions or positions taken
- Conclusions reached

Keep the summary under 500 words. Focus on the substance and positions, not surface-level description.

Transcript:
${combinedText}

Respond with ONLY the summary text, no JSON.`;

  return await callAI(prompt, settings, 'text');
}

async function crossAnalyze(
  videoSummaries: Array<{ videoTitle: string; summary: string }>,
  settings: AISettings
): Promise<CrossVideoAnalysisResult> {
  const summariesText = videoSummaries.map((v, i) =>
    `--- Video ${i + 1}: "${v.videoTitle}" ---\n${v.summary}`
  ).join('\n\n');

  // Truncate if combined summaries exceed limits
  const truncatedText = summariesText.length > 12000
    ? summariesText.slice(0, 12000) + '\n...(truncated)'
    : summariesText;

  const prompt = `You are a research analyst. Analyze these video transcript summaries and produce a cross-video analysis.

${truncatedText}

Analyze across ALL videos and respond in this exact JSON format:
{
  "themes": [
    {
      "theme": "Theme name",
      "description": "What this theme is about",
      "videoEvidence": [{"videoTitle": "exact video title", "evidence": "How this video relates to the theme"}]
    }
  ],
  "contradictions": [
    {
      "topic": "Topic where videos disagree",
      "positions": [{"videoTitle": "exact video title", "position": "What this video argues"}]
    }
  ],
  "progression": [
    {
      "concept": "A concept that develops across videos",
      "timeline": [{"videoTitle": "exact video title", "development": "How this video advances the concept"}]
    }
  ],
  "synthesis": "A 2-3 paragraph unified research brief that synthesizes findings across all videos, noting agreements, tensions, and key insights."
}

Guidelines:
- Find 3-6 common themes with specific evidence from each video
- Only include contradictions if genuine disagreements exist (can be empty array)
- Track concept progression if ideas build on each other across videos (can be empty array)
- The synthesis should be the most valuable part — a coherent brief a researcher could use
- Use exact video titles in videoEvidence/positions/timeline`;

  const response = await callAI(prompt, settings, 'json');
  return parseCrossAnalysisResponse(response);
}

function parseCrossAnalysisResponse(response: string): CrossVideoAnalysisResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      themes: Array.isArray(parsed.themes)
        ? parsed.themes.map((t: Record<string, unknown>) => ({
            theme: String(t.theme || ''),
            description: String(t.description || ''),
            videoEvidence: Array.isArray(t.videoEvidence)
              ? (t.videoEvidence as Array<Record<string, unknown>>).map(e => ({
                  videoTitle: String(e.videoTitle || ''),
                  evidence: String(e.evidence || ''),
                }))
              : [],
          }))
        : [],
      contradictions: Array.isArray(parsed.contradictions)
        ? parsed.contradictions.map((c: Record<string, unknown>) => ({
            topic: String(c.topic || ''),
            positions: Array.isArray(c.positions)
              ? (c.positions as Array<Record<string, unknown>>).map(p => ({
                  videoTitle: String(p.videoTitle || ''),
                  position: String(p.position || ''),
                }))
              : [],
          }))
        : [],
      progression: Array.isArray(parsed.progression)
        ? parsed.progression.map((p: Record<string, unknown>) => ({
            concept: String(p.concept || ''),
            timeline: Array.isArray(p.timeline)
              ? (p.timeline as Array<Record<string, unknown>>).map(t => ({
                  videoTitle: String(t.videoTitle || ''),
                  development: String(t.development || ''),
                }))
              : [],
          }))
        : [],
      synthesis: String(parsed.synthesis || ''),
    };
  } catch {
    return {
      themes: [],
      contradictions: [],
      progression: [],
      synthesis: 'Failed to parse cross-video analysis response.',
    };
  }
}
