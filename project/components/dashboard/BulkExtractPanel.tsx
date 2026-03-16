import { useState, useEffect, useRef } from 'react';
import {
  Download,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  SkipForward,
  Link,
  X,
} from 'lucide-react';
import { extractVideoIdsFromUrl, parsePlaylistUrl, BulkExtractQueue, delay } from '../../lib/youtube/bulkExtract';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { messaging } from '../../lib/messaging/messaging';
import type { BulkExtractItem, BulkExtractProgress } from '../../types';

interface BulkExtractPanelProps {
  onComplete?: () => void;
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  fetching: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
  skipped: SkipForward,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-400',
  fetching: 'text-blue-500 animate-spin',
  done: 'text-green-500',
  error: 'text-red-500',
  skipped: 'text-yellow-500',
};

export function BulkExtractPanel({ onComplete }: BulkExtractPanelProps) {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<BulkExtractProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const queueRef = useRef<BulkExtractQueue | null>(null);

  async function handleStartExtraction() {
    if (!url.trim()) return;
    setError(null);

    const urlInfo = extractVideoIdsFromUrl(url.trim());

    if (urlInfo.type === 'unknown') {
      setError('Invalid URL. Please enter a YouTube playlist, channel, or video URL.');
      return;
    }

    if (urlInfo.type === 'video' && urlInfo.id) {
      // Single video - just use the video ID directly
      await startQueue([urlInfo.id]);
      return;
    }

    // For playlist/channel, we need to fetch the page to extract video IDs
    try {
      setIsExtracting(true);
      setError(null);

      // Use fetch to get the page HTML (this works from extension context)
      const response = await fetch(url.trim());
      const html = await response.text();
      const videoIds = parsePlaylistUrl(html);

      if (videoIds.length === 0) {
        setError('No videos found at this URL. Try a different playlist or channel link.');
        setIsExtracting(false);
        return;
      }

      await startQueue(videoIds);
    } catch (err) {
      setError('Failed to fetch video list. Check the URL and try again.');
      setIsExtracting(false);
    }
  }

  async function startQueue(videoIds: string[]) {
    setIsExtracting(true);
    const queue = new BulkExtractQueue(videoIds, setProgress);
    queueRef.current = queue;

    setProgress(queue.getProgress());

    for (const item of queue.getItems()) {
      if (queue.isCancelled()) break;

      // Check if already saved
      const existing = await transcriptRepository.getByVideoAndLanguage(item.videoId, 'en');
      if (existing) {
        queue.updateItem(item.videoId, { status: 'skipped', title: 'Already saved' });
        continue;
      }

      queue.updateItem(item.videoId, { status: 'fetching' });

      try {
        // Use messaging to fetch transcript via content script
        const fetchResponse = await messaging.sendMessage('FETCH_TRANSCRIPT', {
          videoId: item.videoId,
        });

        if (fetchResponse && 'segments' in fetchResponse) {
          // Save the transcript
          await messaging.sendMessage('SAVE_TRANSCRIPT', {
            videoContext: {
              videoId: item.videoId,
              url: `https://www.youtube.com/watch?v=${item.videoId}`,
              title: `Video ${item.videoId}`,
              channelId: '',
              channelTitle: '',
              thumbnailUrl: `https://i.ytimg.com/vi/${item.videoId}/default.jpg`,
              publishedAt: null,
              durationText: '',
              isWatchPage: false,
            },
            segments: (fetchResponse as { segments: Array<{ startMs: number; durationMs: number; text: string }> }).segments,
            languageCode: 'en',
            languageLabel: 'English',
            sourceType: 'auto-generated' as const,
          });

          queue.updateItem(item.videoId, { status: 'done' });
        } else {
          queue.updateItem(item.videoId, { status: 'error', error: 'No transcript available' });
        }
      } catch (err) {
        queue.updateItem(item.videoId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Rate limiting
      await delay(2000);
    }

    setIsExtracting(false);
    onComplete?.();
  }

  function handleCancel() {
    queueRef.current?.cancel();
    setIsExtracting(false);
  }

  async function handleRetryFailed() {
    if (!queueRef.current) return;
    queueRef.current.retryFailed();
    setProgress(queueRef.current.getProgress());

    setIsExtracting(true);
    const queue = queueRef.current;

    for (const item of queue.getPendingItems()) {
      if (queue.isCancelled()) break;

      queue.updateItem(item.videoId, { status: 'fetching' });

      try {
        const fetchResponse = await messaging.sendMessage('FETCH_TRANSCRIPT', {
          videoId: item.videoId,
        });

        if (fetchResponse && 'segments' in fetchResponse) {
          await messaging.sendMessage('SAVE_TRANSCRIPT', {
            videoContext: {
              videoId: item.videoId,
              url: `https://www.youtube.com/watch?v=${item.videoId}`,
              title: `Video ${item.videoId}`,
              channelId: '',
              channelTitle: '',
              thumbnailUrl: `https://i.ytimg.com/vi/${item.videoId}/default.jpg`,
              publishedAt: null,
              durationText: '',
              isWatchPage: false,
            },
            segments: (fetchResponse as { segments: Array<{ startMs: number; durationMs: number; text: string }> }).segments,
            languageCode: 'en',
            languageLabel: 'English',
            sourceType: 'auto-generated' as const,
          });

          queue.updateItem(item.videoId, { status: 'done' });
        } else {
          queue.updateItem(item.videoId, { status: 'error', error: 'No transcript available' });
        }
      } catch (err) {
        queue.updateItem(item.videoId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      await delay(2000);
    }

    setIsExtracting(false);
    onComplete?.();
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        Bulk Extract
      </button>
    );
  }

  const completedPercent = progress
    ? Math.round(((progress.completed + progress.failed + progress.skipped) / progress.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Bulk Transcript Extraction
        </h3>
        <button
          onClick={() => { setIsOpen(false); handleCancel(); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* URL Input */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube playlist or channel URL..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isExtracting}
          />
        </div>
        {!isExtracting ? (
          <button
            onClick={handleStartExtraction}
            disabled={!url.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Play className="w-4 h-4" />
            Extract All
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <Square className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <>
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{completedPercent}% complete</span>
              <span>
                {progress.completed} done, {progress.failed} failed, {progress.skipped} skipped / {progress.total} total
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${completedPercent}%` }}
              />
            </div>
          </div>

          {/* Retry button */}
          {!isExtracting && progress.failed > 0 && (
            <button
              onClick={handleRetryFailed}
              className="flex items-center gap-2 px-3 py-1.5 mb-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry {progress.failed} Failed
            </button>
          )}

          {/* Item List */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {progress.items.map((item) => {
              const Icon = STATUS_ICONS[item.status] || Clock;
              const colorClass = STATUS_COLORS[item.status] || 'text-gray-400';

              return (
                <div
                  key={item.videoId}
                  className="flex items-center gap-2 py-1.5 px-2 rounded text-sm"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />
                  <span className="text-gray-700 truncate flex-1 font-mono text-xs">
                    {item.title || item.videoId}
                  </span>
                  {item.error && (
                    <span className="text-xs text-red-500 truncate max-w-48">{item.error}</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
