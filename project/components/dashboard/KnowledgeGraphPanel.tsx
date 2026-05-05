import { useState } from 'react';
import {
  X,
  Copy,
  RefreshCw,
  Lightbulb,
  GitCompare,
  TrendingUp,
  FileText,
  Check,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { CrossAnalysis } from '../../types';

interface KnowledgeGraphPanelProps {
  analysis: CrossAnalysis;
  onClose: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  isRegenerating?: boolean;
}

type TabId = 'themes' | 'contradictions' | 'progression' | 'synthesis';

export function KnowledgeGraphPanel({
  analysis,
  onClose,
  onRegenerate,
  onDelete,
  isRegenerating,
}: KnowledgeGraphPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('themes');
  const [copied, setCopied] = useState(false);

  const tabs: Array<{ id: TabId; label: string; icon: typeof Lightbulb; count?: number }> = [
    { id: 'themes', label: 'Themes', icon: Lightbulb, count: analysis.themes.length },
    { id: 'contradictions', label: 'Contradictions', icon: GitCompare, count: analysis.contradictions.length },
    { id: 'progression', label: 'Progression', icon: TrendingUp, count: analysis.progression.length },
    { id: 'synthesis', label: 'Synthesis', icon: FileText },
  ];

  function handleCopy() {
    const text = formatAnalysisAsText(analysis);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cross-Video Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {analysis.transcriptIds.length} videos analyzed • {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-2 text-gray-500 hover:bg-white/60 rounded-lg transition-colors"
            title="Copy analysis"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="p-2 text-gray-500 hover:bg-white/60 rounded-lg transition-colors disabled:opacity-50"
              title="Regenerate analysis"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              title="Delete analysis"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-white/60 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {activeTab === 'themes' && <ThemesTab themes={analysis.themes} />}
        {activeTab === 'contradictions' && <ContradictionsTab contradictions={analysis.contradictions} />}
        {activeTab === 'progression' && <ProgressionTab progression={analysis.progression} />}
        {activeTab === 'synthesis' && <SynthesisTab synthesis={analysis.synthesis} />}
      </div>
    </div>
  );
}

function ThemesTab({ themes }: { themes: CrossAnalysis['themes'] }) {
  if (themes.length === 0) {
    return <EmptyState message="No common themes identified." />;
  }

  return (
    <div className="space-y-4">
      {themes.map((theme, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lightbulb className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{theme.theme}</h3>
              <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
              {theme.videoEvidence.length > 0 && (
                <div className="mt-3 space-y-2">
                  {theme.videoEvidence.map((ev, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium whitespace-nowrap flex-shrink-0">
                        {ev.videoTitle.length > 40 ? ev.videoTitle.slice(0, 40) + '...' : ev.videoTitle}
                      </span>
                      <span className="text-gray-600">{ev.evidence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContradictionsTab({ contradictions }: { contradictions: CrossAnalysis['contradictions'] }) {
  if (contradictions.length === 0) {
    return <EmptyState message="No contradictions found between these videos." />;
  }

  return (
    <div className="space-y-4">
      {contradictions.map((c, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <GitCompare className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{c.topic}</h3>
              <div className="mt-3 space-y-2">
                {c.positions.map((pos, j) => (
                  <div key={j} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-medium whitespace-nowrap flex-shrink-0">
                      {pos.videoTitle.length > 40 ? pos.videoTitle.slice(0, 40) + '...' : pos.videoTitle}
                    </span>
                    <span className="text-sm text-gray-700">{pos.position}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressionTab({ progression }: { progression: CrossAnalysis['progression'] }) {
  if (progression.length === 0) {
    return <EmptyState message="No concept progression detected across these videos." />;
  }

  return (
    <div className="space-y-4">
      {progression.map((p, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{p.concept}</h3>
              <div className="mt-3 relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-green-200" />
                <div className="space-y-3">
                  {p.timeline.map((t, j) => (
                    <div key={j} className="flex items-start gap-3 relative pl-7">
                      <div className="absolute left-1.5 top-2 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      <div>
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                          {t.videoTitle.length > 40 ? t.videoTitle.slice(0, 40) + '...' : t.videoTitle}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">{t.development}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SynthesisTab({ synthesis }: { synthesis: string }) {
  if (!synthesis) {
    return <EmptyState message="No synthesis generated." />;
  }

  return (
    <div className="prose prose-sm max-w-none">
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-gray-900 m-0">Research Brief</h3>
        </div>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {synthesis}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-gray-500">
      <p>{message}</p>
    </div>
  );
}

// Loading state component for use while analysis is running
export function CrossAnalysisLoading({
  step,
  current,
  total,
  onCancel,
}: {
  step: string;
  current: number;
  total: number;
  onCancel?: () => void;
}) {
  const progress = Math.round((current / total) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Cross-Video Analysis</h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
        <span className="text-sm text-gray-600">{step}... ({current}/{total})</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function formatAnalysisAsText(analysis: CrossAnalysis): string {
  const lines: string[] = [
    '# Cross-Video Analysis',
    `Analyzed ${analysis.transcriptIds.length} videos on ${new Date(analysis.createdAt).toLocaleDateString()}`,
    '',
  ];

  if (analysis.themes.length > 0) {
    lines.push('## Themes', '');
    for (const theme of analysis.themes) {
      lines.push(`### ${theme.theme}`);
      lines.push(theme.description);
      for (const ev of theme.videoEvidence) {
        lines.push(`- **${ev.videoTitle}**: ${ev.evidence}`);
      }
      lines.push('');
    }
  }

  if (analysis.contradictions.length > 0) {
    lines.push('## Contradictions', '');
    for (const c of analysis.contradictions) {
      lines.push(`### ${c.topic}`);
      for (const pos of c.positions) {
        lines.push(`- **${pos.videoTitle}**: ${pos.position}`);
      }
      lines.push('');
    }
  }

  if (analysis.progression.length > 0) {
    lines.push('## Concept Progression', '');
    for (const p of analysis.progression) {
      lines.push(`### ${p.concept}`);
      for (const t of p.timeline) {
        lines.push(`- **${t.videoTitle}**: ${t.development}`);
      }
      lines.push('');
    }
  }

  if (analysis.synthesis) {
    lines.push('## Synthesis', '', analysis.synthesis);
  }

  return lines.join('\n');
}
