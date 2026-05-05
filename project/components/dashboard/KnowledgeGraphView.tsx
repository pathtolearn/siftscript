import { useState, useEffect } from 'react';
import {
  Network, Lightbulb, Library, Trash2, Eye, GitCompare,
  Share2, Users, Clock, Loader2,
} from 'lucide-react';
import { KnowledgeGraphPanel, CrossAnalysisLoading } from './KnowledgeGraphPanel';
import { GraphVisualization } from './GraphVisualization';
import { NodeDetailPanel } from './NodeDetailPanel';
import { ClusterView } from './ClusterView';
import { CreatorOverlapView } from './CreatorOverlapView';
import { TimelineView } from './TimelineView';
import { deriveGraphData } from '../../lib/utils/graphBuilder';
import { conceptClusterRepository } from '../../lib/db/repositories/conceptClusterRepository';
import type { CrossAnalysis, GraphData, GraphNode } from '../../types';

type KGTab = 'graph' | 'clusters' | 'creators' | 'timeline' | 'analyses';

interface KnowledgeGraphViewProps {
  savedAnalyses: CrossAnalysis[];
  activeAnalysis: CrossAnalysis | null;
  isAnalyzing: boolean;
  analysisProgress: { step: string; current: number; total: number };
  extractionPending?: number;
  onViewAnalysis: (analysis: CrossAnalysis) => void;
  onCloseAnalysis: () => void;
  onDeleteAnalysis: (id: string) => void;
  onRegenerateAnalysis: () => void;
  onGoToLibrary: () => void;
}

export function KnowledgeGraphView({
  savedAnalyses,
  activeAnalysis,
  isAnalyzing,
  analysisProgress,
  extractionPending = 0,
  onViewAnalysis,
  onCloseAnalysis,
  onDeleteAnalysis,
  onRegenerateAnalysis,
  onGoToLibrary,
}: KnowledgeGraphViewProps) {
  const [activeKGTab, setActiveKGTab] = useState<KGTab>('graph');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [clusterCount, setClusterCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    loadGraphData();
  }, [extractionPending]); // Reload when extraction finishes

  async function loadGraphData() {
    setGraphLoading(true);
    try {
      const [data, count] = await Promise.all([
        deriveGraphData(2),
        conceptClusterRepository.countCrossTranscript(2),
      ]);
      setGraphData(data);
      setClusterCount(count);
    } catch {
      setGraphData({ nodes: [], edges: [], lastBuiltAt: new Date() });
    } finally {
      setGraphLoading(false);
    }
  }

  // Show cross-analysis loading overlay
  if (isAnalyzing) {
    return (
      <div className="max-w-3xl mx-auto">
        <CrossAnalysisLoading
          step={analysisProgress.step}
          current={analysisProgress.current}
          total={analysisProgress.total}
        />
      </div>
    );
  }

  // Show active analysis detail
  if (activeAnalysis) {
    return (
      <KnowledgeGraphPanel
        analysis={activeAnalysis}
        onClose={onCloseAnalysis}
        onRegenerate={onRegenerateAnalysis}
        onDelete={() => onDeleteAnalysis(activeAnalysis.crossAnalysisId)}
        isRegenerating={isAnalyzing}
      />
    );
  }

  const hasGraph = (graphData?.nodes.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Network className="w-5 h-5 text-indigo-600" />
            </div>
            Knowledge Graph
          </h2>
          <p className="text-sm text-gray-500 mt-1 ml-[52px]">
            Connections and patterns across your saved videos
          </p>
        </div>

        {/* Extraction progress pill */}
        {extractionPending > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full text-sm text-indigo-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analysing {extractionPending} transcript{extractionPending !== 1 ? 's' : ''}…
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 -mb-3">
        <Tab id="graph" active={activeKGTab} icon={<Network className="w-3.5 h-3.5" />} label="Graph" onClick={setActiveKGTab} />
        <Tab id="clusters" active={activeKGTab} icon={<Share2 className="w-3.5 h-3.5" />} label={`Clusters${clusterCount > 0 ? ` (${clusterCount})` : ''}`} onClick={setActiveKGTab} />
        <Tab id="creators" active={activeKGTab} icon={<Users className="w-3.5 h-3.5" />} label="Creators" onClick={setActiveKGTab} />
        <Tab id="timeline" active={activeKGTab} icon={<Clock className="w-3.5 h-3.5" />} label="Timeline" onClick={setActiveKGTab} />
        <Tab id="analyses" active={activeKGTab} icon={<Lightbulb className="w-3.5 h-3.5" />} label={`Analyses${savedAnalyses.length > 0 ? ` (${savedAnalyses.length})` : ''}`} onClick={setActiveKGTab} />
      </div>

      {/* Tab panels */}
      <div className="pt-2">
        {activeKGTab === 'graph' && (
          graphLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasGraph ? (
            <GraphEmptyState extractionPending={extractionPending} onGoToLibrary={onGoToLibrary} />
          ) : (
            <div className={`grid gap-4 ${selectedNode ? 'grid-cols-[1fr,320px]' : 'grid-cols-1'}`}>
              <div className="h-[520px] rounded-xl border border-gray-200 overflow-hidden bg-white">
                <GraphVisualization
                  data={graphData!}
                  onNodeClick={setSelectedNode}
                  selectedNodeId={selectedNode?.id ?? null}
                />
              </div>
              {selectedNode && (
                <NodeDetailPanel
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                />
              )}
            </div>
          )
        )}

        {activeKGTab === 'clusters' && (
          <ClusterView />
        )}

        {activeKGTab === 'creators' && (
          <CreatorOverlapView />
        )}

        {activeKGTab === 'timeline' && (
          <TimelineView />
        )}

        {activeKGTab === 'analyses' && (
          savedAnalyses.length === 0 ? (
            <AnalysisEmptyState onGoToLibrary={onGoToLibrary} />
          ) : (
            <AnalysisList
              analyses={savedAnalyses}
              onView={onViewAnalysis}
              onDelete={onDeleteAnalysis}
              onGoToLibrary={onGoToLibrary}
            />
          )
        )}
      </div>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({
  id,
  active,
  icon,
  label,
  onClick,
}: {
  id: KGTab;
  active: KGTab;
  icon: React.ReactNode;
  label: string;
  onClick: (id: KGTab) => void;
}) {
  const isActive = id === active;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function GraphEmptyState({
  extractionPending,
  onGoToLibrary,
}: {
  extractionPending: number;
  onGoToLibrary: () => void;
}) {
  if (extractionPending > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Building your knowledge graph…
        </h3>
        <p className="text-gray-500 max-w-sm">
          Extracting concepts from {extractionPending} transcript{extractionPending !== 1 ? 's' : ''}.
          The graph will appear here once enough videos share overlapping topics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
        <Network className="w-10 h-10 text-indigo-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Your graph will appear here
      </h3>
      <p className="text-gray-500 max-w-sm mb-2">
        VidSage automatically finds concepts across your saved videos. Save videos on related topics and the graph builds itself.
      </p>
      <p className="text-sm text-gray-400 mb-8">
        The graph needs at least 2 videos sharing a concept to draw connections.
      </p>

      <button
        onClick={onGoToLibrary}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
      >
        <Library className="w-4 h-4" />
        Save more videos
      </button>

      <div className="flex items-center gap-6 mt-8 text-sm text-gray-400">
        <Step n={1} label="Save 2+ videos" />
        <Arrow />
        <Step n={2} label="VidSage extracts concepts" />
        <Arrow />
        <Step n={3} label="Graph appears here" />
      </div>
    </div>
  );
}

function AnalysisEmptyState({ onGoToLibrary }: { onGoToLibrary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
        <Lightbulb className="w-10 h-10 text-indigo-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No AI analyses yet</h3>
      <p className="text-gray-500 max-w-sm mb-8">
        Select 2+ videos in your Library and click Cross-Analyze for a deep AI synthesis of themes,
        contradictions, and concept progressions.
      </p>
      <button
        onClick={onGoToLibrary}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
      >
        <Library className="w-4 h-4" />
        Go to Library
      </button>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center">
        {n}
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

function Arrow() {
  return <div className="text-gray-300 mb-4">→</div>;
}

// ─── Analysis list (moved from old KnowledgeGraphView) ────────────────────────

function AnalysisList({
  analyses,
  onView,
  onDelete,
  onGoToLibrary,
}: {
  analyses: CrossAnalysis[];
  onView: (a: CrossAnalysis) => void;
  onDelete: (id: string) => void;
  onGoToLibrary: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'} saved
        </p>
        <button
          onClick={onGoToLibrary}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <GitCompare className="w-4 h-4" />
          New analysis
        </button>
      </div>

      <div className="grid gap-4">
        {analyses.map((analysis) => (
          <AnalysisCard
            key={analysis.crossAnalysisId}
            analysis={analysis}
            onView={() => onView(analysis)}
            onDelete={() => onDelete(analysis.crossAnalysisId)}
          />
        ))}
      </div>
    </div>
  );
}

function AnalysisCard({
  analysis,
  onView,
  onDelete,
}: {
  analysis: CrossAnalysis;
  onView: () => void;
  onDelete: () => void;
}) {
  const topThemes = analysis.themes.slice(0, 3).map(t => t.theme);
  const label = topThemes.length > 0 ? topThemes.join(' · ') : 'Cross-Video Analysis';

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-100 transition-colors">
            <Lightbulb className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{label}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {analysis.transcriptIds.length} videos ·{' '}
              {analysis.themes.length} themes ·{' '}
              {analysis.contradictions.length} contradictions ·{' '}
              {new Date(analysis.createdAt).toLocaleDateString()}
            </p>
            {analysis.themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {analysis.themes.slice(0, 4).map((t, i) => (
                  <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                    {t.theme}
                  </span>
                ))}
                {analysis.themes.length > 4 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                    +{analysis.themes.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="View analysis"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete analysis"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
