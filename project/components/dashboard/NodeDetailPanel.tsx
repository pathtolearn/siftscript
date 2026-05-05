import { useEffect, useState } from 'react';
import { X, ExternalLink, Calendar, Hash, Users, Clock } from 'lucide-react';
import { conceptClusterRepository } from '../../lib/db/repositories/conceptClusterRepository';
import { buildTimeline } from '../../lib/utils/graphBuilder';
import { categoryColour } from '../../lib/utils/graphBuilder';
import type { GraphNode, ConceptCluster } from '../../types';
import type { TimelineEntry } from '../../lib/utils/graphBuilder';

interface NodeDetailPanelProps {
  node: GraphNode;
  onClose: () => void;
  onNavigateToVideo?: (videoId: string) => void;
}

export function NodeDetailPanel({ node, onClose, onNavigateToVideo }: NodeDetailPanelProps) {
  const [cluster, setCluster] = useState<ConceptCluster | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (node.type === 'concept') {
        const normalizedLabel = node.id.replace(/^concept:/, '');
        const [cl, tl] = await Promise.all([
          conceptClusterRepository.getByNormalizedLabel(normalizedLabel),
          buildTimeline(normalizedLabel),
        ]);
        setCluster(cl ?? null);
        setTimeline(tl);
      }
      setLoading(false);
    }
    load();
  }, [node.id, node.type]);

  const colour = node.type === 'creator' ? '#64748B' : categoryColour(node.category!);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-gray-100">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: colour + '20', border: `2px solid ${colour}` }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colour }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{node.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: colour + '15', color: colour }}
            >
              {node.type === 'creator' ? 'Creator' : (node.category ?? 'topic')}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex divide-x divide-gray-100 border-b border-gray-100">
        <Stat icon={<Hash className="w-3.5 h-3.5" />} label="Videos" value={node.transcriptCount} />
        <Stat icon={<Users className="w-3.5 h-3.5" />} label="Mentions" value={node.totalMentions} />
        {cluster && (
          <Stat
            icon={<Clock className="w-3.5 h-3.5" />}
            label="First seen"
            value={new Date(cluster.firstSeenAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Timeline */}
            {timeline.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Appearances
                </h4>
                <div className="space-y-2">
                  {timeline.map((entry, i) => (
                    <TimelineItem
                      key={i}
                      entry={entry}
                      onNavigate={onNavigateToVideo}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Context snippets */}
            {timeline.some(e => e.context) && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  In context
                </h4>
                <div className="space-y-2">
                  {timeline
                    .filter(e => e.context)
                    .slice(0, 3)
                    .map((entry, i) => (
                      <blockquote
                        key={i}
                        className="text-sm text-gray-600 italic border-l-2 pl-3 py-0.5"
                        style={{ borderColor: colour }}
                      >
                        "…{entry.context}…"
                        <cite className="block text-xs text-gray-400 not-italic mt-1">
                          — {entry.channelTitle}
                        </cite>
                      </blockquote>
                    ))}
                </div>
              </section>
            )}

            {node.type === 'creator' && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Channel
                </h4>
                <p className="text-sm text-gray-600">{node.label}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {node.transcriptCount} saved transcript{node.transcriptCount !== 1 ? 's' : ''}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 py-3 px-2">
      <div className="text-gray-400 mb-0.5">{icon}</div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function TimelineItem({
  entry,
  onNavigate,
}: {
  entry: TimelineEntry;
  onNavigate?: (videoId: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 group">
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{entry.channelTitle}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-400">
            {new Date(entry.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {entry.mentions > 1 && (
            <span className="text-xs text-gray-400">· {entry.mentions}×</span>
          )}
        </div>
      </div>
      {onNavigate && (
        <button
          onClick={() => onNavigate(entry.videoId)}
          className="p-1 text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title="Open transcript"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
