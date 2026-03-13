import type { Video, Transcript, Segment } from '../../types';
import { segmentRepository } from '../db/repositories/segmentRepository';
import { categoryRepository } from '../db/repositories/categoryRepository';
import { tagRepository } from '../db/repositories/tagRepository';

// Notion API types
interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: unknown;
}

interface NotionPage {
  parent: { database_id: string } | { page_id: string };
  properties: Record<string, unknown>;
  children?: NotionBlock[];
}

export interface NotionExportOptions {
  includeTimestamps: boolean;
  includeMetadata: boolean;
  includeNotes: boolean;
  maxSegmentsPerPage: number;
}

const DEFAULT_OPTIONS: NotionExportOptions = {
  includeTimestamps: true,
  includeMetadata: true,
  includeNotes: true,
  maxSegmentsPerPage: 100 // Notion has a limit of 100 blocks per request
};

// Storage key for Notion token
const NOTION_TOKEN_KEY = 'notion_integration_token';
const NOTION_DATABASE_ID_KEY = 'notion_database_id';

export function getNotionToken(): string | null {
  return localStorage.getItem(NOTION_TOKEN_KEY);
}

export function setNotionToken(token: string): void {
  localStorage.setItem(NOTION_TOKEN_KEY, token);
}

export function getNotionDatabaseId(): string | null {
  return localStorage.getItem(NOTION_DATABASE_ID_KEY);
}

export function setNotionDatabaseId(databaseId: string): void {
  localStorage.setItem(NOTION_DATABASE_ID_KEY, databaseId);
}

export function clearNotionCredentials(): void {
  localStorage.removeItem(NOTION_TOKEN_KEY);
  localStorage.removeItem(NOTION_DATABASE_ID_KEY);
}

export async function validateNotionToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function searchNotionDatabases(token: string): Promise<Array<{ id: string; title: string }>> {
  try {
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          value: 'database',
          property: 'object'
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to search databases');
    }

    const data = await response.json();
    return data.results.map((db: { id: string; title?: Array<{ text?: { content?: string } }> }) => ({
      id: db.id,
      title: db.title?.[0]?.text?.content || 'Untitled'
    }));
  } catch (error) {
    console.error('Error searching databases:', error);
    return [];
  }
}

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

export async function exportTranscriptToNotion(
  transcript: Transcript,
  video: Video,
  options: Partial<NotionExportOptions> = {}
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const token = getNotionToken();
  const databaseId = getNotionDatabaseId();

  if (!token) {
    return { success: false, error: 'Notion integration token not configured' };
  }

  // Fetch additional data
  const [segments, category, tags] = await Promise.all([
    segmentRepository.getByTranscriptId(transcript.transcriptId),
    transcript.categoryId ? categoryRepository.getById(transcript.categoryId) : Promise.resolve(undefined),
    tagRepository.getTagsForTranscript(transcript.transcriptId)
  ]);

  // Build page properties
  const properties: Record<string, unknown> = {
    'Name': {
      title: [{ text: { content: video.title } }]
    }
  };

  if (databaseId) {
    // If we have a database, try to match properties
    // This is a simplified version - in practice you'd query the database schema first
    properties['Channel'] = { rich_text: [{ text: { content: video.channelTitle } }] };
    properties['URL'] = { url: video.url };
    properties['Word Count'] = { number: transcript.wordCount };
    properties['Language'] = { select: { name: transcript.languageLabel } };
    
    if (category) {
      properties['Category'] = { select: { name: category.name } };
    }
    
    if (tags.length > 0) {
      properties['Tags'] = { multi_select: tags.map(t => ({ name: t.name })) };
    }
  }

  // Build content blocks
  const blocks: NotionBlock[] = [];

  // Add heading
  blocks.push({
    object: 'block',
    type: 'heading_1',
    heading_1: {
      rich_text: [{ text: { content: video.title } }]
    }
  });

  // Add metadata
  if (opts.includeMetadata) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'Channel: ', annotations: { bold: true } } },
          { text: { content: video.channelTitle } },
          { text: { content: '\nURL: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: video.url, link: { url: video.url } } }
        ]
      }
    });

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { text: { content: 'Language: ', annotations: { bold: true } } },
          { text: { content: transcript.languageLabel } },
          { text: { content: ' • Words: ', annotations: { bold: true } } },
          { text: { content: transcript.wordCount.toLocaleString() } }
        ]
      }
    });

    if (category) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { text: { content: 'Category: ', annotations: { bold: true } } },
            { text: { content: category.name } }
          ]
        }
      });
    }

    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {}
    });
  }

  // Add notes
  if (opts.includeNotes && transcript.notes) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: 'Notes' } }]
      }
    });
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: transcript.notes } }]
      }
    });
  }

  // Add transcript heading
  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ text: { content: 'Transcript' } }]
    }
  });

  // Add transcript segments
  if (opts.includeTimestamps) {
    // Group segments and add with timestamps
    for (const segment of segments) {
      const timestamp = formatTimestamp(segment.startMs);
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { text: { content: `[${timestamp}] ` }, annotations: { code: true } },
            { text: { content: segment.text } }
          ]
        }
      });
    }
  } else {
    // Just add as paragraphs without timestamps
    const fullText = segments.map(s => s.text).join(' ');
    // Split into chunks if too long (Notion has 2000 char limit per block)
    const chunks = fullText.match(/.{1,1900}/g) || [fullText];
    for (const chunk of chunks) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: chunk } }]
        }
      });
    }
  }

  // Create page
  try {
    const pageData: NotionPage = {
      parent: databaseId 
        ? { database_id: databaseId }
        : { page_id: 'root' }, // This would need to be a valid page ID
      properties,
      children: blocks.slice(0, opts.maxSegmentsPerPage)
    };

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create Notion page');
    }

    const data = await response.json();
    return { success: true, pageId: data.id };
  } catch (error) {
    console.error('Error creating Notion page:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function exportMarkdownToNotion(
  title: string,
  markdownContent: string
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  const token = getNotionToken();
  
  if (!token) {
    return { success: false, error: 'Notion integration token not configured' };
  }

  // Simple markdown to Notion blocks conversion
  const lines = markdownContent.split('\n');
  const blocks: NotionBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ text: { content: trimmed.slice(2) } }]
        }
      });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: trimmed.slice(3) } }]
        }
      });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: trimmed.slice(4) } }]
        }
      });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: trimmed.slice(2) } }]
        }
      });
    } else if (/^\d+\. /.test(trimmed)) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ text: { content: trimmed.replace(/^\d+\. /, '') } }]
        }
      });
    } else if (trimmed === '---') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
    } else if (trimmed) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: trimmed } }]
        }
      });
    }
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { page_id: 'root' }, // This needs to be configured
        properties: {
          'Name': {
            title: [{ text: { content: title } }]
          }
        },
        children: blocks.slice(0, 100)
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create Notion page');
    }

    const data = await response.json();
    return { success: true, pageId: data.id };
  } catch (error) {
    console.error('Error creating Notion page:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
