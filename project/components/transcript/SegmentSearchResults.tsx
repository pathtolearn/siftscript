import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, FileText } from 'lucide-react';
import type { Segment, Video } from '../../types';

interface SegmentSearchResultsProps {
  results: Array<{
    transcriptId: string;
    video: Video | undefined;
    segments: Segment[];
    totalMatches: number;
  }>;
  query: string;
  onOpenTranscript: (transcriptId: string) => void;
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

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function SegmentSearchResults({ results, query, onOpenTranscript }: SegmentSearchResultsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const totalSegmentMatches = results.reduce((acc, r) => acc + r.totalMatches, 0);

  function toggleExpanded(transcriptId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(transcriptId)) {
        next.delete(transcriptId);
      } else {
        next.add(transcriptId);
      }
      return next;
    });
  }

  if (results.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            {totalSegmentMatches} segment match{totalSegmentMatches !== 1 ? 'es' : ''} across {results.length} transcript{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {results.map(({ transcriptId, video, segments, totalMatches }) => {
          const isExpanded = expandedIds.has(transcriptId);

          return (
            <div key={transcriptId}>
              <button
                onClick={() => toggleExpanded(transcriptId)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {video?.title || transcriptId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {video?.channelTitle && `${video.channelTitle} • `}
                    {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTranscript(transcriptId);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex-shrink-0"
                >
                  Open
                </button>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 ml-7">
                  {segments.map((segment) => (
                    <div
                      key={segment.segmentId}
                      className="flex gap-3 p-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <span className="flex items-center gap-1 text-xs text-blue-600 font-medium whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(segment.startMs)}
                      </span>
                      <p className="text-gray-700 line-clamp-2">
                        {highlightText(segment.text, query)}
                      </p>
                    </div>
                  ))}
                  {totalMatches > segments.length && (
                    <button
                      onClick={() => onOpenTranscript(transcriptId)}
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline ml-2"
                    >
                      + {totalMatches - segments.length} more matches
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
