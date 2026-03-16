import type { BulkExtractItem, BulkExtractProgress, BulkExtractStatus } from '../../types';

export class BulkExtractQueue {
  private items: BulkExtractItem[] = [];
  private cancelled = false;
  private onProgress: ((progress: BulkExtractProgress) => void) | null = null;

  constructor(videoIds: string[], onProgress?: (progress: BulkExtractProgress) => void) {
    this.items = videoIds.map(videoId => ({
      videoId,
      status: 'pending' as BulkExtractStatus,
    }));
    this.onProgress = onProgress || null;
  }

  getProgress(): BulkExtractProgress {
    return {
      total: this.items.length,
      completed: this.items.filter(i => i.status === 'done').length,
      failed: this.items.filter(i => i.status === 'error').length,
      skipped: this.items.filter(i => i.status === 'skipped').length,
      items: [...this.items],
    };
  }

  cancel(): void {
    this.cancelled = true;
  }

  updateItem(videoId: string, update: Partial<BulkExtractItem>): void {
    const item = this.items.find(i => i.videoId === videoId);
    if (item) {
      Object.assign(item, update);
      this.onProgress?.(this.getProgress());
    }
  }

  getItems(): BulkExtractItem[] {
    return [...this.items];
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  getFailedItems(): BulkExtractItem[] {
    return this.items.filter(i => i.status === 'error');
  }

  retryFailed(): void {
    for (const item of this.items) {
      if (item.status === 'error') {
        item.status = 'pending';
        item.error = undefined;
      }
    }
  }

  getPendingItems(): BulkExtractItem[] {
    return this.items.filter(i => i.status === 'pending');
  }
}

export function parsePlaylistUrl(html: string): string[] {
  const videoIds: string[] = [];
  const seen = new Set<string>();

  // Match video IDs from playlist page data patterns
  const patterns = [
    /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g,
    /watch\?v=([a-zA-Z0-9_-]{11})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const id = match[1];
      if (!seen.has(id)) {
        seen.add(id);
        videoIds.push(id);
      }
    }
  }

  return videoIds;
}

export function parseChannelUrl(html: string): string[] {
  // Same extraction logic as playlist - YouTube embeds video IDs in page data
  return parsePlaylistUrl(html);
}

export function extractVideoIdsFromUrl(url: string): { type: 'playlist' | 'channel' | 'video' | 'unknown'; id?: string } {
  try {
    const urlObj = new URL(url);

    // Playlist URL
    const listParam = urlObj.searchParams.get('list');
    if (listParam) {
      return { type: 'playlist', id: listParam };
    }

    // Channel URLs
    if (urlObj.pathname.startsWith('/@') || urlObj.pathname.startsWith('/channel/') || urlObj.pathname.startsWith('/c/')) {
      return { type: 'channel', id: urlObj.pathname };
    }

    // Single video
    const videoParam = urlObj.searchParams.get('v');
    if (videoParam) {
      return { type: 'video', id: videoParam };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
