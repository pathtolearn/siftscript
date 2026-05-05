import { useEffect, useState } from 'react';
import { conceptClusterRepository } from '../../lib/db/repositories/conceptClusterRepository';
import { categoryColour } from '../../lib/utils/graphBuilder';
import type { ConceptCluster, ConceptCategory } from '../../types';

const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  idea: 'Idea',
  framework: 'Framework',
  person: 'Person',
  book: 'Book',
  topic: 'Topic',
  organization: 'Organization',
};

const ALL_CATEGORIES: ConceptCategory[] = ['idea', 'framework', 'person', 'book', 'topic', 'organization'];

interface ClusterViewProps {
  onConceptClick?: (normalizedLabel: string) => void;
}

export function ClusterView({ onConceptClick }: ClusterViewProps) {
  const [clusters, setClusters] = useState<ConceptCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ConceptCategory | 'all'>('all');
  const [minVideos, setMinVideos] = useState(2);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const all = await conceptClusterRepository.getCrossTranscript(minVideos);
      setClusters(all);
      setLoading(false);
    }
    load();
  }, [minVideos]);

  const filtered = filter === 'all'
    ? clusters
    : clusters.filter(c => c.category === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 font-medium">No concept clusters yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Save more videos — clusters appear when the same concept shows up in{' '}
          {minVideos}+ videos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(['all', ...ALL_CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <span>Min videos:</span>
          {[2, 3, 5].map(n => (
            <button
              key={n}
              onClick={() => setMinVideos(n)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                minVideos === n
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              {n}+
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">
        {filtered.length} concept{filtered.length !== 1 ? 's' : ''} across{' '}
        {filter === 'all' ? 'all categories' : CATEGORY_LABELS[filter]}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(cluster => (
          <ClusterCard
            key={cluster.clusterId}
            cluster={cluster}
            onClick={onConceptClick ? () => onConceptClick(cluster.normalizedLabel) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({
  cluster,
  onClick,
}: {
  cluster: ConceptCluster;
  onClick?: () => void;
}) {
  const colour = categoryColour(cluster.category);

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 transition-all ${
        onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
          style={{ backgroundColor: colour }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate text-sm">{cluster.label}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: colour + '15', color: colour }}
            >
              {CATEGORY_LABELS[cluster.category]}
            </span>
            <span className="text-xs text-gray-400">
              {cluster.transcriptIds.length} video{cluster.transcriptIds.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">
              {cluster.totalMentions} mention{cluster.totalMentions !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-xs text-gray-400">
              {new Date(cluster.firstSeenAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
            {cluster.channelIds.length > 1 && (
              <>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  {cluster.channelIds.length} creators
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
