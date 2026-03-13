import { useState } from 'react';
import { FileText, Loader2, Copy, Check, Download, Sparkles, List, AlignLeft, AlignJustify } from 'lucide-react';
import { 
  summarizeTranscript,
  formatSummary,
  copySummaryToClipboard,
  exportSummaryAsText,
  type SummaryResult,
  type SummaryOptions
} from '../../lib/utils/summarization';
import type { Video } from '../../types';

interface SummarizationProps {
  transcriptId: string;
  video: Video;
}

export function Summarization({ transcriptId, video }: SummarizationProps) {
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<'extractive' | 'abstractive' | 'hybrid'>('hybrid');
  const [format, setFormat] = useState<'bullet' | 'paragraph' | 'key-points'>('bullet');
  const [level, setLevel] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    try {
      setIsGenerating(true);
      setError(null);
      
      const options: Partial<SummaryOptions> = {
        format,
        level
      };
      
      const result = await summarizeTranscript(transcriptId, method, options);
      setSummary(result);
    } catch (err) {
      console.error('Error generating summary:', err);
      setError('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!summary) return;
    
    const success = await copySummaryToClipboard(summary);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleExport() {
    if (!summary) return;
    
    const content = exportSummaryAsText(summary, video.title, 'markdown');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-gray-900">
        <Sparkles className="w-5 h-5" />
        <h3 className="font-semibold">AI Summary</h3>
      </div>

      {/* Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Summarization Method
        </label>
        <div className="flex gap-2">
          {[
            { value: 'extractive', label: 'Extractive', desc: 'Key sentences' },
            { value: 'abstractive', label: 'Abstractive', desc: 'AI generated' },
            { value: 'hybrid', label: 'Hybrid', desc: 'Best of both' }
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value as typeof method)}
              className={`flex-1 p-2 rounded-lg text-sm font-medium transition-colors ${
                method === m.value
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-gray-500">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Output Format
        </label>
        <div className="flex gap-2">
          {[
            { value: 'bullet', label: 'Bullets', icon: List },
            { value: 'key-points', label: 'Numbered', icon: AlignLeft },
            { value: 'paragraph', label: 'Paragraph', icon: AlignJustify }
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value as typeof format)}
              className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors ${
                format === f.value
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Length Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Summary Length
        </label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as typeof level)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="short">Short (~50 words)</option>
          <option value="medium">Medium (~100 words)</option>
          <option value="detailed">Detailed (~200 words)</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : summary ? (
          <>
            <Sparkles className="w-4 h-4" />
            Regenerate Summary
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Summary
          </>
        )}
      </button>

      {/* Summary Display */}
      {summary && (
        <div className="space-y-4">
          {/* Summary Content */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Summary</h4>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {formatSummary(summary, format)}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-white rounded border border-gray-200 text-center">
              <p className="text-xs text-gray-500">Original</p>
              <p className="font-semibold text-gray-900">{summary.originalWordCount.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-white rounded border border-gray-200 text-center">
              <p className="text-xs text-gray-500">Summary</p>
              <p className="font-semibold text-gray-900">{summary.wordCount.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-white rounded border border-gray-200 text-center">
              <p className="text-xs text-gray-500">Compression</p>
              <p className="font-semibold text-gray-900">{summary.compressionRatio.toFixed(1)}x</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 border-t border-gray-200 pt-3">
        <p className="font-medium mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Extractive</strong>: Selects the most important sentences from the transcript</li>
          <li><strong>Abstractive</strong>: Generates new text using AI (may take longer)</li>
          <li><strong>Hybrid</strong>: Combines both methods for the best results</li>
        </ul>
      </div>
    </div>
  );
}
