import { useEffect, useState } from 'react';
import { conceptClusterRepository } from '../../lib/db/repositories/conceptClusterRepository';
import { buildTimeline } from '../../lib/utils/graphBuilder';
import { categoryColour } from '../../lib/utils/graphBuilder';
import type { ConceptCluster } from '../../types';
import type { TimelineEntry } from '../../lib/utils/graphBuilder';

interface TimelineViewProps {
  onNavigateToVideo?: (videoId: string) => void;
}

export function TimelineView({ onNavigateToVideo }: TimelineViewProps) {
  const [clusters, setClusters] = useState<ConceptCluster[]>([]);
  const [selected, setSelected] = useState<ConceptCluster | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingClusters(true);
      const all = await conceptClusterRepository.getCrossTranscript(2);
      setClusters(all);
      // Auto-select the most-mentioned concept
      if (all.length > 0) {
        selectConcept(all[0]);
      }
      setLoadingClusters(false);
    }
    load();
  }, []);

  async function selectConcept(cluster: ConceptCluster) {
    setSelected(cluster);
    setLoadingTimeline(true);
    const tl = await buildTimeline(cluster.normalizedLabel);
    setTimeline(tl);
    setLoadingTimeline(false);
  }

  if (loadingClusters) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 font-medium">No concept timelines yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Save videos over time to see how topics evolve across your library.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[220px,1fr] gap-6 h-full">
      {/* Concept selector */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto max-h-[600px]">
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepts</p>
        </div>
        <div className="divide-y divide-gray-50">
          {clusters.map(cl => {
            const colour = categoryColour(cl.category);
            const isActive = selected?.clusterId === cl.clusterId;
            return (
              <button
                key={cl.clusterId}
                onClick={() => selectConcept(cl)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colour }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isActive ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                    {cl.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cl.transcriptIds.length} videos
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline display */}
      <div className="flex-1 overflow-y-auto max-h-[600px]">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a concept to view its timeline
          </div>
        ) : loadingTimeline ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <TimelineTrack
            concept={selected}
            entries={timeline}
            onNavigate={onNavigateToVideo}
          />
        )}
      </div>
    </div>
  );
}

function TimelineTrack({
  concept,
  entries,
  onNavigate,
}: {
  concept: ConceptCluster;
  entries: TimelineEntry[];
  onNavigate?: (videoId: string) => void;
}) {
  const colour = categoryColour(concept.category);

  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{concept.label}</h3>
        <p className="text-sm text-gray-400">
          Appears in {entries.length} transcript{entries.length !== 1 ? 's' : ''} ·{' '}
          {entries.reduce((s, e) => s + e.mentions, 0)} total mentions
        </p>
      </div>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-2 top-2 bottom-0 w-px bg-gray-200" />

        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div key={i} className="relative">
              {/* Dot */}
              <div
                className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-white"
                style={{ backgroundColor: colour }}
              />

              <div className="bg-white rounded-lg border border-gray-200 p-3 hover:border-indigo-200 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{entry.channelTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                      {entry.mentions > 1 && ` · mentioned ${entry.mentions}×`}
                    </p>
                    {entry.context && (
                      <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">
                        "…{entry.context}…"
                      </p>
                    )}
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(entry.videoId)}
                      className="text-xs text-indigo-500 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap flex-shrink-0"
                    >
                      Open →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
