import { useEffect, useState } from 'react';
import { buildCreatorOverlap } from '../../lib/utils/graphBuilder';
import type { CreatorOverlapEntry } from '../../lib/utils/graphBuilder';

interface CreatorOverlapViewProps {
  onConceptClick?: (normalizedLabel: string) => void;
}

export function CreatorOverlapView({ onConceptClick }: CreatorOverlapViewProps) {
  const [entries, setEntries] = useState<CreatorOverlapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await buildCreatorOverlap();
      setEntries(result);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 font-medium">No creator overlap yet</p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Save videos from at least 2 different channels covering related topics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        {entries.length} creator pair{entries.length !== 1 ? 's' : ''} with shared concepts — sorted by overlap score
      </p>
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <CreatorPairCard
            key={i}
            entry={entry}
            onConceptClick={onConceptClick}
          />
        ))}
      </div>
    </div>
  );
}

function CreatorPairCard({
  entry,
  onConceptClick,
}: {
  entry: CreatorOverlapEntry;
  onConceptClick?: (normalizedLabel: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entry.sharedConceptLabels : entry.sharedConceptLabels.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-200 transition-colors">
      {/* Creators row */}
      <div className="flex items-center gap-3 mb-3">
        <CreatorBadge title={entry.channelTitleA} />
        <div className="flex-1 flex flex-col items-center">
          <OverlapBar score={entry.overlapScore} />
          <span className="text-xs font-semibold text-indigo-600 mt-1">{entry.overlapScore}% overlap</span>
        </div>
        <CreatorBadge title={entry.channelTitleB} />
      </div>

      {/* Shared concepts */}
      <div className="flex flex-wrap gap-1.5">
        {visible.map((label, i) => (
          <button
            key={i}
            onClick={() => onConceptClick?.(entry.sharedConcepts[i])}
            className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full hover:bg-indigo-100 transition-colors"
          >
            {label}
          </button>
        ))}
        {!expanded && entry.sharedConceptLabels.length > 5 && (
          <button
            onClick={() => setExpanded(true)}
            className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full hover:bg-gray-200 transition-colors"
          >
            +{entry.sharedConceptLabels.length - 5} more
          </button>
        )}
      </div>
    </div>
  );
}

function CreatorBadge({ title }: { title: string }) {
  return (
    <div className="flex-shrink-0 max-w-[120px]">
      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-1">
        <span className="text-xs font-semibold text-slate-600 uppercase">
          {title.slice(0, 2)}
        </span>
      </div>
      <p className="text-xs text-gray-600 text-center truncate">{title}</p>
    </div>
  );
}

function OverlapBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-indigo-400 rounded-full transition-all"
        style={{ width: `${score}%` }}
      />
    </div>
  );
}
