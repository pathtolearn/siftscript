import { useState, useEffect, useCallback } from 'react';
import { Search, Brain, Loader2, AlertCircle, Check, Play } from 'lucide-react';
import { 
  semanticSearch, 
  searchTranscripts,
  loadEmbeddingModel,
  isModelLoaded,
  getEmbeddingStats,
  processAllTranscripts,
  type SemanticSearchResult 
} from '../../lib/utils/semanticSearch';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import type { Transcript } from '../../types';

interface SemanticSearchProps {
  onResultClick?: (transcriptId: string, startMs: number) => void;
}

export function SemanticSearch({ onResultClick }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [transcriptResults, setTranscriptResults] = useState<Array<{
    transcript: Transcript;
    bestMatch: SemanticSearchResult;
    matchCount: number;
    video?: { title: string; channelTitle: string; url: string };
  }>>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [stats, setStats] = useState({ totalSegments: 0, transcriptsWithEmbeddings: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'segments' | 'transcripts'>('transcripts');

  useEffect(() => {
    checkModelStatus();
    loadStats();
  }, []);

  async function checkModelStatus() {
    const loaded = isModelLoaded();
    setModelLoaded(loaded);
    
    if (!loaded) {
      // Try to load model in background
      loadModel();
    }
  }

  async function loadStats() {
    try {
      const embeddingStats = await getEmbeddingStats();
      setStats(embeddingStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function loadModel() {
    if (isLoadingModel || modelLoaded) return;
    
    try {
      setIsLoadingModel(true);
      setError(null);
      
      await loadEmbeddingModel((progress) => {
        setModelProgress(Math.round(progress * 100));
      });
      
      setModelLoaded(true);
    } catch (err) {
      setError('Failed to load semantic search model');
      console.error('Error loading model:', err);
    } finally {
      setIsLoadingModel(false);
    }
  }

  async function handleProcessTranscripts() {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setProcessingProgress(0);
      setError(null);
      
      // Make sure model is loaded
      if (!isModelLoaded()) {
        await loadEmbeddingModel((progress) => {
          setModelProgress(Math.round(progress * 100));
        });
      }
      
      await processAllTranscripts((current, total) => {
        setProcessingProgress(Math.round((current / total) * 100));
      });
      
      await loadStats();
    } catch (err) {
      setError('Failed to process transcripts');
      console.error('Error processing transcripts:', err);
    } finally {
      setIsProcessing(false);
    }
  }

  const handleSearch = useCallback(async () => {
    if (!query.trim() || isSearching) return;
    
    try {
      setIsSearching(true);
      setError(null);
      
      // Ensure model is loaded
      if (!isModelLoaded()) {
        await loadEmbeddingModel();
      }
      
      if (searchMode === 'segments') {
        const searchResults = await semanticSearch(query, {
          limit: 20,
          minSimilarity: 0.3
        });
        
        // Enrich with transcript data
        const enrichedResults = await Promise.all(
          searchResults.map(async (result) => {
            const transcript = await transcriptRepository.getById(result.transcriptId);
            return { ...result, transcript };
          })
        );
        
        setResults(enrichedResults);
      } else {
        const transcriptSearchResults = await searchTranscripts(query, {
          limit: 10,
          minSimilarity: 0.3
        });
        
        // Enrich with video data
        const enrichedTranscripts = await Promise.all(
          transcriptSearchResults.map(async (result) => {
            const video = await videoRepository.getById(result.transcript.videoId);
            return {
              transcript: result.transcript,
              bestMatch: result.bestMatch,
              matchCount: result.matchCount,
              video: video ? {
                title: video.title,
                channelTitle: video.channelTitle,
                url: video.url
              } : undefined
            };
          })
        );
        
        setTranscriptResults(enrichedTranscripts);
      }
    } catch (err) {
      setError('Search failed');
      console.error('Error searching:', err);
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode, isSearching]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
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

  function getSimilarityColor(similarity: number): string {
    if (similarity >= 0.7) return 'text-green-600 bg-green-50';
    if (similarity >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  }

  return (
    <div className="space-y-4">
      {/* Setup Status */}
      {!modelLoaded && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900">Semantic Search Setup</h4>
              <p className="text-sm text-blue-700 mt-1">
                Semantic search uses AI to understand the meaning of your search queries,
                not just match keywords.
              </p>
              
              {isLoadingModel ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading AI model... {modelProgress}%
                  </div>
                  <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${modelProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={loadModel}
                  disabled={isLoadingModel}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Load AI Model
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {modelLoaded && stats.transcriptsWithEmbeddings === 0 && (
        <div className="p-4 bg-yellow-50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900">Process Transcripts</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Your transcripts need to be processed for semantic search. This may take a few minutes.
              </p>
              
              {isProcessing ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing... {processingProgress}%
                  </div>
                  <div className="mt-2 h-2 bg-yellow-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-600 transition-all duration-300"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleProcessTranscripts}
                  disabled={isProcessing}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
                >
                  Process All Transcripts
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats.transcriptsWithEmbeddings > 0 && (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Brain className="w-4 h-4" />
            {stats.transcriptsWithEmbeddings} transcripts indexed
          </span>
          <span className="flex items-center gap-1">
            {stats.totalSegments.toLocaleString()} segments
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="space-y-3">
        {/* Search Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setSearchMode('transcripts')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'transcripts'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Search Transcripts
          </button>
          <button
            onClick={() => setSearchMode('segments')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'segments'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Search Segments
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by meaning (e.g., 'discusses market trends')"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!modelLoaded || stats.transcriptsWithEmbeddings === 0 || isSearching}
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || !modelLoaded || isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Enter a concept, topic, or question to find semantically similar content
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {searchMode === 'transcripts' ? (
        <div className="space-y-3">
          {transcriptResults.length > 0 && (
            <>
              <p className="text-sm text-gray-600">
                Found {transcriptResults.length} matching transcripts
              </p>
              {transcriptResults.map(({ transcript, bestMatch, matchCount, video }) => (
                <div
                  key={transcript.transcriptId}
                  onClick={() => onResultClick?.(transcript.transcriptId, bestMatch.startMs)}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {video?.title || transcript.videoId}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {video?.channelTitle} • {matchCount} matches
                      </p>
                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                        "{bestMatch.text.substring(0, 150)}..."
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSimilarityColor(bestMatch.similarity)}`}>
                        {(bestMatch.similarity * 100).toFixed(0)}% match
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (video?.url) {
                            window.open(`${video.url}&t=${Math.floor(bestMatch.startMs / 1000)}s`, '_blank');
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Play at this timestamp"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {results.length > 0 && (
            <>
              <p className="text-sm text-gray-600">
                Found {results.length} matching segments
              </p>
              {results.map((result) => (
                <div
                  key={result.segmentId}
                  onClick={() => onResultClick?.(result.transcriptId, result.startMs)}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getSimilarityColor(result.similarity)}`}>
                      {(result.similarity * 100).toFixed(0)}%
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">
                        "{result.text}"
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        At {formatTimestamp(result.startMs)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* No Results */}
      {((searchMode === 'transcripts' && transcriptResults.length === 0 && !isSearching && query) ||
        (searchMode === 'segments' && results.length === 0 && !isSearching && query)) && (
        <div className="text-center py-8 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No results found</p>
          <p className="text-sm mt-1">Try rephrasing your search query</p>
        </div>
      )}
    </div>
  );
}
