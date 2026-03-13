import { useState, useCallback } from 'react';
import { BookOpen, Loader2, Play, ChevronDown, ChevronRight, Download, Copy, Check, Sparkles } from 'lucide-react';
import { 
  detectChapters,
  formatTimestamp,
  exportChaptersAsText,
  getChapterAtTime,
  type Chapter,
  type ChapterDetectionOptions
} from '../../lib/utils/chapterDetection';
import type { Video, Segment } from '../../types';

interface ChapterDetectorProps {
  segments: Segment[];
  video: Video;
  onChapterClick?: (startMs: number) => void;
}

export function ChapterDetector({ segments, video, onChapterClick }: ChapterDetectorProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [maxChapters, setMaxChapters] = useState(10);
  const [minDuration, setMinDuration] = useState(60); // seconds

  async function handleDetectChapters() {
    if (segments.length < 10) {
      setError('Transcript too short for chapter detection (minimum 10 segments)');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const options: ChapterDetectionOptions = {
        maxChapters,
        minChapterDuration: minDuration * 1000 // convert to ms
      };
      
      const detectedChapters = await detectChapters(segments, options);
      setChapters(detectedChapters);
      
      if (detectedChapters.length === 0) {
        setError('Could not detect clear chapter boundaries. Try adjusting the settings.');
      }
    } catch (err) {
      console.error('Error detecting chapters:', err);
      setError('Failed to detect chapters. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapter(expandedChapter === chapterId ? null : chapterId);
  }

  async function handleExport(format: 'markdown' | 'txt' | 'youtube') {
    if (chapters.length === 0) return;
    
    const content = exportChaptersAsText(chapters, video.title, video.url, format);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const extension = format === 'youtube' ? 'txt' : format;
    a.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chapters.${extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCopyYouTubeFormat() {
    if (chapters.length === 0) return;
    
    const content = exportChaptersAsText(chapters, video.title, video.url, 'youtube');
    
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function calculateChapterProgress(startMs: number, endMs: number): number {
    if (chapters.length === 0) return 0;
    const totalDuration = chapters[chapters.length - 1].endMs - chapters[0].startMs;
    const chapterDuration = endMs - startMs;
    return (chapterDuration / totalDuration) * 100;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-gray-900">
        <BookOpen className="w-5 h-5" />
        <h3 className="font-semibold">Chapter Detection</h3>
      </div>

      {/* Settings */}
      {!chapters.length && !isLoading && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Chapters: {maxChapters}
            </label>
            <input
              type="range"
              min="3"
              max="30"
              value={maxChapters}
              onChange={(e) => setMaxChapters(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Chapter Duration: {minDuration}s
            </label>
            <input
              type="range"
              min="30"
              max="300"
              step="30"
              value={minDuration}
              onChange={(e) => setMinDuration(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Detect Button */}
      {!chapters.length && (
        <button
          onClick={handleDetectChapters}
          disabled={isLoading || segments.length < 10}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Detecting chapters...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Detect Chapters
            </>
          )}
        </button>
      )}

      {/* Chapters List */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Detected {chapters.length} chapters
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => handleExport('markdown')}
                className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                Markdown
              </button>
              <button
                onClick={() => handleExport('youtube')}
                className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                YouTube
              </button>
            </div>
          </div>

          {/* Chapters Timeline */}
          <div className="space-y-2">
            {chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  onClick={() => toggleChapter(chapter.id)}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <button className="text-gray-400">
                    {expandedChapter === chapter.id ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {chapter.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTimestamp(chapter.startMs)} - {formatTimestamp(chapter.endMs)}
                      {' · '}
                      {chapter.segments.length} segments
                    </p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChapterClick?.(chapter.startMs);
                    }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Play from this chapter"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Expanded Content */}
                {expandedChapter === chapter.id && (
                  <div className="px-3 pb-3 border-t border-gray-100">
                    <p className="text-sm text-gray-700 mt-3">
                      {chapter.summary}
                    </p>
                    <div className="mt-3 space-y-1">
                      {chapter.segments.slice(0, 5).map((segment, i) => (
                        <div
                          key={segment.segmentId}
                          onClick={() => onChapterClick?.(segment.startMs)}
                          className="text-xs text-gray-600 hover:text-blue-600 cursor-pointer flex items-start gap-2"
                        >
                          <span className="text-gray-400 flex-shrink-0">
                            {formatTimestamp(segment.startMs)}
                          </span>
                          <span className="line-clamp-1">{segment.text}</span>
                        </div>
                      ))}
                      {chapter.segments.length > 5 && (
                        <p className="text-xs text-gray-400 pl-14">
                          +{chapter.segments.length - 5} more segments...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* YouTube Export */}
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">YouTube Format</span>
              <button
                onClick={handleCopyYouTubeFormat}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
              {chapters.map(c => `${formatTimestamp(c.startMs)} ${c.title}`).join('\n')}
            </div>
          </div>

          {/* Regenerate Button */}
          <button
            onClick={handleDetectChapters}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Regenerate Chapters
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 border-t border-gray-200 pt-3">
        <p className="font-medium mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>AI analyzes topic changes and pauses in the transcript</li>
          <li>Chapters are detected at significant topic transitions</li>
          <li>Titles are generated from the chapter content</li>
          <li>Export in YouTube format to add to video descriptions</li>
        </ul>
      </div>
    </div>
  );
}
