import { useState, useEffect } from 'react';
import { Sparkles, FileText, Lightbulb, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Summary, Video } from '../../types';

type SummaryTab = 'summary' | 'takeaways' | 'highlights';

interface AISummaryPanelProps {
  summary: Summary;
  video: Video;
  formatTimestamp: (ms: number) => string;
  justGenerated?: boolean;
}

const TABS: { id: SummaryTab; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'takeaways', label: 'Key Takeaways', icon: Lightbulb },
  { id: 'highlights', label: 'Highlights', icon: Clock },
];

export function AISummaryPanel({ summary, video, formatTimestamp, justGenerated }: AISummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<SummaryTab>('summary');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (justGenerated) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [justGenerated]);

  // Fallback for summaries without keyTakeaways (backward compat)
  const takeaways = summary.keyTakeaways ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold text-gray-900">AI Summary</h3>
            {showSuccess && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full animate-fade-in">
                <CheckCircle2 className="w-3 h-3" />
                Generated
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {summary.provider}/{summary.model}
            </span>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              // Show count badges
              const count = tab.id === 'takeaways' ? takeaways.length
                : tab.id === 'highlights' ? summary.highlights.length
                : summary.keyPoints.length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-5">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {summary.overallSummary}
                </p>

                {summary.keyPoints.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Key Points
                    </h4>
                    <ul className="space-y-2">
                      {summary.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'takeaways' && (
              <div className="space-y-3">
                {takeaways.length > 0 ? (
                  takeaways.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.takeaway}</p>
                          {item.context && (
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.context}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No key takeaways extracted. Try regenerating the summary.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'highlights' && (
              <div className="space-y-3">
                {summary.highlights.length > 0 ? (
                  summary.highlights.map((highlight, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 font-medium">{highlight.summary}</p>
                          <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                            "{highlight.text}"
                          </p>
                        </div>
                        <button
                          onClick={() => window.open(`${video.url}&t=${Math.floor(highlight.startMs / 1000)}s`, '_blank')}
                          className="flex-shrink-0 text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition-colors"
                        >
                          {formatTimestamp(highlight.startMs)}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No highlights extracted. Try regenerating the summary.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
