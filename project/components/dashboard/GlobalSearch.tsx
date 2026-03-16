import { useState, useEffect, useCallback } from 'react';
import { Search, X, Clock, ChevronRight } from 'lucide-react';
import { segmentRepository } from '../../lib/db/repositories/segmentRepository';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import type { GlobalSearchResult } from '../../types';

interface GlobalSearchProps {
  onOpenTranscript: (transcriptId: string, segmentId?: string) => void;
}

export function GlobalSearch({ onOpenTranscript }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const segmentResults = await segmentRepository.searchAcrossTranscripts(searchQuery);
      const enrichedResults: GlobalSearchResult[] = [];

      for (const [transcriptId, segments] of segmentResults.entries()) {
        const transcript = await transcriptRepository.getById(transcriptId);
        if (!transcript) continue;
        const video = await videoRepository.getById(transcript.videoId);
        if (!video) continue;

        enrichedResults.push({
          transcriptId,
          videoId: video.videoId,
          videoTitle: video.title,
          channelTitle: video.channelTitle,
          thumbnailUrl: video.thumbnailUrl,
          matches: segments.slice(0, 3).map(s => ({
            segmentId: s.segmentId,
            text: s.text,
            startMs: s.startMs,
          })),
          totalMatches: segments.length,
        });
      }

      // Sort by number of matches (most relevant first)
      enrichedResults.sort((a, b) => b.totalMatches - a.totalMatches);
      setResults(enrichedResults.slice(0, 20));
    } catch (error) {
      console.error('Global search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  function formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function highlightMatch(text: string, searchQuery: string): React.ReactNode {
    if (!searchQuery.trim()) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;

    // Show context around match
    const contextStart = Math.max(0, idx - 40);
    const contextEnd = Math.min(text.length, idx + searchQuery.length + 40);
    const prefix = contextStart > 0 ? '...' : '';
    const suffix = contextEnd < text.length ? '...' : '';

    const before = text.slice(contextStart, idx);
    const match = text.slice(idx, idx + searchQuery.length);
    const after = text.slice(idx + searchQuery.length, contextEnd);

    return (
      <>
        {prefix}{before}
        <mark className="bg-yellow-200 rounded px-0.5">{match}</mark>
        {after}{suffix}
      </>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsExpanded(true);
          }}
          onFocus={() => setIsExpanded(true)}
          placeholder="Search across all transcripts..."
          className="w-full pl-10 pr-10 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isExpanded && query.trim().length >= 2 && (
        <div className="mt-3">
          {isSearching ? (
            <div className="flex items-center gap-2 py-4 justify-center text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No results found across your transcripts.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <p className="text-xs text-gray-500">
                Found matches in {results.length} transcript{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((result) => (
                <div
                  key={result.transcriptId}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => {
                    onOpenTranscript(result.transcriptId, result.matches[0]?.segmentId);
                    setIsExpanded(false);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={result.thumbnailUrl}
                      alt=""
                      className="w-16 h-9 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {result.videoTitle}
                        </p>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{result.channelTitle}</p>
                      <div className="space-y-1">
                        {result.matches.map((match, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-xs text-blue-600 font-mono flex-shrink-0 mt-0.5">
                              {formatTimestamp(match.startMs)}
                            </span>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {highlightMatch(match.text, query)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {result.totalMatches > 3 && (
                        <p className="text-xs text-blue-600 mt-1">
                          +{result.totalMatches - 3} more matches
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
