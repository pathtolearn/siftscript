import { useState, useEffect } from 'react';
import { Copy, Check, BookOpen, Quote } from 'lucide-react';
import { 
  generateCitation, 
  generateCitationFromSegment,
  copyCitationToClipboard,
  getCitationFormats,
  type CitationFormat,
  type CitationResult,
  type CitationOptions 
} from '../../lib/utils/citations';
import type { Video, Transcript, Segment } from '../../types';

interface CitationGeneratorProps {
  video: Video;
  transcript: Transcript;
  selectedSegment?: Segment;
}

export function CitationGenerator({ video, transcript, selectedSegment }: CitationGeneratorProps) {
  const [format, setFormat] = useState<CitationFormat>('apa');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [customTemplate, setCustomTemplate] = useState('{channel} - {title} ({timestamp})');
  const [citation, setCitation] = useState<CitationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullCitation, setShowFullCitation] = useState(true);

  const formats = getCitationFormats();

  useEffect(() => {
    generateNewCitation();
  }, [format, includeTimestamp, customTemplate, selectedSegment]);

  function generateNewCitation() {
    const options: Partial<CitationOptions> = {
      format,
      includeTimestamp,
      startTime: selectedSegment?.startMs ?? 0,
      endTime: selectedSegment ? selectedSegment.startMs + selectedSegment.durationMs : undefined
    };

    if (format === 'custom') {
      options.customTemplate = customTemplate;
    }

    const result = selectedSegment
      ? generateCitationFromSegment(video, transcript, selectedSegment, options)
      : generateCitation(video, transcript, options);

    setCitation(result);
  }

  async function handleCopy() {
    if (!citation) return;
    
    const success = await copyCitationToClipboard(citation);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCopyInText() {
    if (!citation) return;
    navigator.clipboard.writeText(citation.inTextCitation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyFull() {
    if (!citation) return;
    navigator.clipboard.writeText(citation.fullCitation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-gray-900">
        <BookOpen className="w-5 h-5" />
        <h3 className="font-semibold">Citation Generator</h3>
      </div>

      {/* Format Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Citation Format
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as CitationFormat)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {formats.map(f => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {formats.find(f => f.value === format)?.description}
        </p>
      </div>

      {/* Custom Template */}
      {format === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Template
          </label>
          <input
            type="text"
            value={customTemplate}
            onChange={(e) => setCustomTemplate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="{channel} - {title} ({timestamp})"
          />
          <p className="mt-1 text-xs text-gray-500">
            Available variables: {'{channel}'}, {'{title}'}, {'{url}'}, {'{timestamp}'}, {'{date}'}, {'{year}'}, {'{wordCount}'}
          </p>
        </div>
      )}

      {/* Timestamp Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="includeTimestamp"
          checked={includeTimestamp}
          onChange={(e) => setIncludeTimestamp(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="includeTimestamp" className="text-sm text-gray-700">
          Include timestamp
          {selectedSegment && (
            <span className="text-xs text-gray-500 ml-1">
              ({citation?.timestampRange})
            </span>
          )}
        </label>
      </div>

      {/* Selected Segment Info */}
      {selectedSegment && (
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Citing segment:</strong> [{citation?.timestampRange}] {selectedSegment.text.substring(0, 100)}
            {selectedSegment.text.length > 100 && '...'}
          </p>
        </div>
      )}

      {/* Citation Display */}
      {citation && (
        <div className="space-y-3">
          {/* Toggle between full and in-text */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFullCitation(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                showFullCitation
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Full Citation
            </button>
            <button
              onClick={() => setShowFullCitation(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                !showFullCitation
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              In-Text Citation
            </button>
          </div>

          {/* Citation Text */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
              <Quote className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-800 font-mono leading-relaxed">
                  {showFullCitation ? citation.fullCitation : citation.inTextCitation}
                </p>
              </div>
            </div>
          </div>

          {/* Copy Buttons */}
          <div className="flex gap-2">
            <button
              onClick={showFullCitation ? handleCopyFull : handleCopyInText}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy {showFullCitation ? 'Full' : 'In-Text'}
                </>
              )}
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Both
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 border-t border-gray-200 pt-3">
        <p className="font-medium mb-1">Tip:</p>
        <p>
          Select a specific segment in the transcript to cite that exact moment, 
          or generate a citation for the entire video.
        </p>
      </div>
    </div>
  );
}
