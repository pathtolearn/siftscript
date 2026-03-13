import type { Video, Transcript, Segment } from '../../types';

export type CitationFormat = 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee' | 'custom';

export interface CitationOptions {
  format: CitationFormat;
  includeTimestamp: boolean;
  startTime: number; // in milliseconds
  endTime?: number; // in milliseconds
  customTemplate?: string;
}

export interface CitationResult {
  format: CitationFormat;
  fullCitation: string;
  inTextCitation: string;
  timestampRange: string;
}

const DEFAULT_OPTIONS: CitationOptions = {
  format: 'apa',
  includeTimestamp: true,
  startTime: 0
};

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

function formatTimestampRange(startMs: number, endMs?: number): string {
  const start = formatTimestamp(startMs);
  if (!endMs || endMs === startMs) {
    return start;
  }
  const end = formatTimestamp(endMs);
  return `${start}-${end}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatYear(date: Date): string {
  return new Date(date).getFullYear().toString();
}

export function generateCitation(
  video: Video,
  transcript: Transcript,
  options: Partial<CitationOptions> = {}
): CitationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timestampRange = formatTimestampRange(opts.startTime, opts.endTime);
  
  switch (opts.format) {
    case 'apa':
      return generateAPACitation(video, transcript, opts, timestampRange);
    case 'mla':
      return generateMLACitation(video, transcript, opts, timestampRange);
    case 'chicago':
      return generateChicagoCitation(video, transcript, opts, timestampRange);
    case 'harvard':
      return generateHarvardCitation(video, transcript, opts, timestampRange);
    case 'ieee':
      return generateIEEECitation(video, transcript, opts, timestampRange);
    case 'custom':
      return generateCustomCitation(video, transcript, opts, timestampRange);
    default:
      return generateAPACitation(video, transcript, opts, timestampRange);
  }
}

function generateAPACitation(
  video: Video,
  transcript: Transcript,
  options: CitationOptions,
  timestampRange: string
): CitationResult {
  const year = formatYear(video.publishedAt);
  const timestamp = options.includeTimestamp ? ` (YouTube, ${timestampRange})` : '';
  
  // Full citation
  const fullCitation = `${video.channelTitle}. (${year}). *${video.title}* [Video]. YouTube. ${video.url}`;
  
  // In-text citation
  const inTextCitation = options.includeTimestamp
    ? `(${video.channelTitle}, ${year}, ${timestampRange})`
    : `(${video.channelTitle}, ${year})`;
  
  return {
    format: 'apa',
    fullCitation,
    inTextCitation,
    timestampRange
  };
}

function generateMLACitation(
  video: Video,
  transcript: Transcript,
  options: CitationOptions,
  timestampRange: string
): CitationResult {
  const date = formatDate(video.publishedAt);
  const timestamp = options.includeTimestamp ? ` (${timestampRange})` : '';
  
  // Full citation
  const fullCitation = `"${video.title}." *YouTube*, uploaded by ${video.channelTitle}, ${date}, ${video.url}.`;
  
  // In-text citation
  const inTextCitation = options.includeTimestamp
    ? `("${video.title}" ${timestampRange})`
    : `("${video.title}")`;
  
  return {
    format: 'mla',
    fullCitation,
    inTextCitation,
    timestampRange
  };
}

function generateChicagoCitation(
  video: Video,
  transcript: Transcript,
  options: CitationOptions,
  timestampRange: string
): CitationResult {
  const date = formatDate(video.publishedAt);
  const timestamp = options.includeTimestamp ? ` (${timestampRange})` : '';
  
  // Full citation (17th edition)
  const fullCitation = `${video.channelTitle}. "${video.title}." Filmed ${date}. YouTube video, ${formatTimestamp(transcript.wordCount * 600 / 150)}. ${video.url}.`;
  
  // In-text citation
  const inTextCitation = options.includeTimestamp
    ? `${video.channelTitle}, "${video.title},"${timestamp}`
    : `${video.channelTitle}, "${video.title}"`;
  
  return {
    format: 'chicago',
    fullCitation,
    inTextCitation,
    timestampRange
  };
}

function generateHarvardCitation(
  video: Video,
  transcript: Transcript,
  options: CitationOptions,
  timestampRange: string
): CitationResult {
  const year = formatYear(video.publishedAt);
  const timestamp = options.includeTimestamp ? ` (${timestampRange})` : '';
  
  // Full citation
  const fullCitation = `${video.channelTitle} (${year}) *${video.title}*. Available at: ${video.url} (Accessed: ${new Date().toLocaleDateString('en-GB')}).`;
  
  // In-text citation
  const inTextCitation = options.includeTimestamp
    ? `(${video.channelTitle}, ${year}, ${timestampRange})`
    : `(${video.channelTitle}, ${year})`;
  
  return {
    format: 'harvard',
    fullCitation,
    inTextCitation,
    timestampRange
  };
}

function generateIEEECitation(
  video: Video,
  transcript: Transcript,
  options: CitationOptions,
  timestampRange: string
): CitationResult {
  const date = formatDate(video.publishedAt);
  
  // Full citation
  const fullCitation = `[1] ${video.channelTitle}, "${video.title}," YouTube, ${date}. [Online]. Available: ${video.url}`;
  
  // In-text citation (IEEE uses numbered references)
  const inTextCitation = options.includeTimestamp
    ? `[1, ${timestampRange}]`
    : '[1]';
  
  return {
    format: 'ieee',
    fullCitation,
    inTextCitation,
    timestampRange
  };
}

function generateCustomCitation(
  video: Video,
  transcript: Transcript,
  options: CitationOptions,
  timestampRange: string
): CitationResult {
  const template = options.customTemplate || '{channel} - {title} ({timestamp})';
  
  const replacements: Record<string, string> = {
    '{channel}': video.channelTitle,
    '{title}': video.title,
    '{url}': video.url,
    '{timestamp}': timestampRange,
    '{date}': formatDate(video.publishedAt),
    '{year}': formatYear(video.publishedAt),
    '{wordCount}': transcript.wordCount.toString()
  };
  
  let fullCitation = template;
  for (const [key, value] of Object.entries(replacements)) {
    fullCitation = fullCitation.replace(new RegExp(key, 'g'), value);
  }
  
  return {
    format: 'custom',
    fullCitation,
    inTextCitation: timestampRange,
    timestampRange
  };
}

// Copy citation to clipboard
export async function copyCitationToClipboard(citation: CitationResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(`${citation.fullCitation}\n\nIn-text: ${citation.inTextCitation}`);
    return true;
  } catch {
    return false;
  }
}

// Export citations in various formats
export function exportCitationsAsText(
  citations: CitationResult[],
  format: 'plain' | 'markdown' = 'plain'
): string {
  if (format === 'markdown') {
    return citations.map(c => `### ${c.format.toUpperCase()}\n\n**Full Citation:**\n${c.fullCitation}\n\n**In-text:** ${c.inTextCitation}\n\n---\n`).join('\n');
  }
  
  return citations.map(c => `[${c.format.toUpperCase()}]\n${c.fullCitation}\nIn-text: ${c.inTextCitation}\n\n`).join('');
}

// Get available citation formats
export function getCitationFormats(): Array<{ value: CitationFormat; label: string; description: string }> {
  return [
    { 
      value: 'apa', 
      label: 'APA 7th Edition',
      description: 'American Psychological Association - Popular in social sciences'
    },
    { 
      value: 'mla', 
      label: 'MLA 9th Edition',
      description: 'Modern Language Association - Popular in humanities'
    },
    { 
      value: 'chicago', 
      label: 'Chicago 17th Edition',
      description: 'Chicago Manual of Style - Popular in history and arts'
    },
    { 
      value: 'harvard', 
      label: 'Harvard',
      description: 'Harvard referencing style - Popular in UK universities'
    },
    { 
      value: 'ieee', 
      label: 'IEEE',
      description: 'Institute of Electrical and Electronics Engineers - Popular in engineering'
    },
    { 
      value: 'custom', 
      label: 'Custom',
      description: 'Create your own citation format using template variables'
    }
  ];
}

// Generate citation from segment
export function generateCitationFromSegment(
  video: Video,
  transcript: Transcript,
  segment: Segment,
  options: Partial<CitationOptions> = {}
): CitationResult {
  return generateCitation(video, transcript, {
    ...options,
    startTime: segment.startMs,
    endTime: segment.startMs + segment.durationMs
  });
}
