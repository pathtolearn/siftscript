import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Clock } from 'lucide-react';
import type { Chapter } from '../../types';

interface ChapterNavProps {
  chapters: Chapter[];
  currentTimeMs?: number;
  onChapterClick: (startMs: number) => void;
  formatTimestamp: (ms: number) => string;
}

export function ChapterNav({ chapters, currentTimeMs, onChapterClick, formatTimestamp }: ChapterNavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (chapters.length === 0) return null;

  const activeChapterIndex = currentTimeMs !== undefined
    ? chapters.findIndex((ch, i) => {
        const next = chapters[i + 1];
        return currentTimeMs >= ch.startMs && (!next || currentTimeMs < next.startMs);
      })
    : -1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div
        className="px-4 py-3 bg-indigo-50 border-b border-gray-200 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Chapters</h3>
            <span className="text-xs text-gray-500">({chapters.length})</span>
          </div>
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="divide-y divide-gray-100">
          {/* Progress bar */}
          {chapters.length > 1 && (
            <div className="px-4 py-2">
              <div className="flex w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                {chapters.map((chapter, idx) => {
                  const nextChapter = chapters[idx + 1];
                  const duration = (nextChapter?.startMs || chapter.endMs) - chapter.startMs;
                  const totalDuration = chapters[chapters.length - 1].endMs - chapters[0].startMs;
                  const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
                  const isActive = idx === activeChapterIndex;

                  return (
                    <div
                      key={chapter.chapterId}
                      className={`h-full transition-colors cursor-pointer ${
                        isActive ? 'bg-indigo-500' : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                      style={{ width: `${widthPercent}%` }}
                      onClick={() => onChapterClick(chapter.startMs)}
                      title={chapter.title}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Chapter list */}
          {chapters.map((chapter, idx) => {
            const isActive = idx === activeChapterIndex;

            return (
              <div
                key={chapter.chapterId}
                className={`px-4 py-2.5 cursor-pointer transition-colors ${
                  isActive ? 'bg-indigo-50 border-l-3 border-l-indigo-500' : 'hover:bg-gray-50'
                }`}
                onClick={() => onChapterClick(chapter.startMs)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-900' : 'text-gray-900'}`}>
                      {chapter.title}
                    </p>
                    {chapter.description && (
                      <p className="text-xs text-gray-500 truncate">{chapter.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                    {formatTimestamp(chapter.startMs)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
