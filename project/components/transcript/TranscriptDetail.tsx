import { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Copy,
  Download,
  Edit3,
  Check,
  X,
  Search,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { segmentRepository } from '../../lib/db/repositories/segmentRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import { annotationRepository } from '../../lib/db/repositories/annotationRepository';
import { summaryRepository } from '../../lib/db/repositories/summaryRepository';
import { formatTranscriptAsText, downloadText } from '../../lib/utils/export';
import { getAISettings, summarizeTranscript } from '../../lib/utils/ai';
import { CitationGenerator } from './CitationGenerator';
import { TranscriptHeader } from './TranscriptHeader';
import { TranscriptStatsBar } from './TranscriptStatsBar';
import { AnnotationPanel } from './AnnotationPanel';
import { AISummaryPanel } from './AISummaryPanel';
import { ANNOTATION_COLORS, ALL_ANNOTATION_COLORS, formatTimestamp } from './transcriptUtils';
import type { Transcript, Segment, Video, Category, Tag, Annotation, AnnotationColor, Summary } from '../../types';

interface TranscriptDetailProps {
  transcriptId: string;
  onBack: () => void;
}

export function TranscriptDetail({ transcriptId, onBack }: TranscriptDetailProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string>>(new Set());
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchingSegmentIds, setMatchingSegmentIds] = useState<string[]>([]);

  // Annotation state
  const [annotations, setAnnotations] = useState<Map<string, Annotation>>(new Map());
  const [activeAnnotationSegmentId, setActiveAnnotationSegmentId] = useState<string | null>(null);
  const [annotationColor, setAnnotationColor] = useState<AnnotationColor>('yellow');
  const [annotationNote, setAnnotationNote] = useState('');

  // AI Summary state
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [summaryJustGenerated, setSummaryJustGenerated] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  // Virtualizer ref
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTranscript();
  }, [transcriptId]);

  useEffect(() => {
    getAISettings().then(settings => setAiConfigured(settings !== null));
  }, []);

  async function loadTranscript() {
    try {
      setIsLoading(true);

      const [transcriptData, segmentsData] = await Promise.all([
        transcriptRepository.getById(transcriptId),
        segmentRepository.getByTranscriptId(transcriptId)
      ]);

      if (transcriptData) {
        setTranscript(transcriptData);
        setNotes(transcriptData.notes);

        // Load related data
        const [videoData, categoryData, tagsData, annotationsMap, existingSummary] = await Promise.all([
          videoRepository.getById(transcriptData.videoId),
          transcriptData.categoryId ? categoryRepository.getById(transcriptData.categoryId) : Promise.resolve(null),
          tagRepository.getTagsForTranscript(transcriptId),
          annotationRepository.getHighlightedSegmentIds(transcriptId),
          summaryRepository.getLatestByTranscriptId(transcriptId)
        ]);

        setVideo(videoData || null);
        setCategory(categoryData || null);
        setTags(tagsData);
        setSegments(segmentsData);
        setAnnotations(annotationsMap);
        if (existingSummary) {
          setSummary(existingSummary);
        }

        // Update last opened
        await transcriptRepository.updateLastOpened(transcriptId);
      }
    } catch (error) {
      console.error('Error loading transcript:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleFavorite() {
    if (!transcript) return;
    await transcriptRepository.update(transcriptId, { favorite: !transcript.favorite });
    setTranscript({ ...transcript, favorite: !transcript.favorite });
  }

  async function handleToggleArchive() {
    if (!transcript) return;
    await transcriptRepository.update(transcriptId, { archived: !transcript.archived });
    setTranscript({ ...transcript, archived: !transcript.archived });
  }

  async function handleSaveNotes() {
    if (!transcript) return;
    await transcriptRepository.update(transcriptId, { notes });
    setTranscript({ ...transcript, notes });
    setIsEditingNotes(false);
  }

  function handleCopyTranscript() {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExport() {
    if (!transcript || !video || segments.length === 0) return;

    const content = formatTranscriptAsText(video.title, video.channelTitle, video.url, segments);
    const filename = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`;
    downloadText(content, filename);
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // --- Search Logic ---
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatchIds(new Set());
      setMatchingSegmentIds([]);
      setCurrentMatchIndex(0);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const matchIds: string[] = [];
    const matchSet = new Set<string>();

    for (const segment of segments) {
      if (segment.text.toLowerCase().includes(lowerQuery)) {
        matchIds.push(segment.segmentId);
        matchSet.add(segment.segmentId);
      }
    }

    setSearchMatchIds(matchSet);
    setMatchingSegmentIds(matchIds);
    setCurrentMatchIndex(matchIds.length > 0 ? 0 : -1);
  }, [searchQuery, segments]);

  const scrollToSegment = useCallback((segmentId: string) => {
    const index = segments.findIndex(s => s.segmentId === segmentId);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [segments]);

  function handleSearchNext() {
    if (matchingSegmentIds.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matchingSegmentIds.length;
    setCurrentMatchIndex(nextIndex);
    scrollToSegment(matchingSegmentIds[nextIndex]);
  }

  function handleSearchPrev() {
    if (matchingSegmentIds.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matchingSegmentIds.length) % matchingSegmentIds.length;
    setCurrentMatchIndex(prevIndex);
    scrollToSegment(matchingSegmentIds[prevIndex]);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handleSearchPrev();
      } else {
        handleSearchNext();
      }
    }
  }

  function highlightText(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    let idx = lowerText.indexOf(lowerQuery, lastIndex);
    while (idx !== -1) {
      if (idx > lastIndex) {
        parts.push(text.slice(lastIndex, idx));
      }
      parts.push(
        <mark key={idx} className="bg-yellow-200 rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
      );
      lastIndex = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, lastIndex);
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  }

  // Auto-scroll to current match when it changes
  useEffect(() => {
    if (currentMatchIndex >= 0 && matchingSegmentIds[currentMatchIndex]) {
      scrollToSegment(matchingSegmentIds[currentMatchIndex]);
    }
  }, [currentMatchIndex, matchingSegmentIds, scrollToSegment]);

  // --- Annotation Logic ---
  function handleSegmentClick(segmentId: string) {
    if (activeAnnotationSegmentId === segmentId) {
      setActiveAnnotationSegmentId(null);
      setAnnotationNote('');
      setAnnotationColor('yellow');
      return;
    }

    const existing = annotations.get(segmentId);
    if (existing) {
      setAnnotationColor(existing.color);
      setAnnotationNote(existing.note);
    } else {
      setAnnotationColor('yellow');
      setAnnotationNote('');
    }
    setActiveAnnotationSegmentId(segmentId);
  }

  async function handleSaveAnnotation(segmentId: string) {
    const existing = annotations.get(segmentId);
    if (existing) {
      await annotationRepository.update(existing.annotationId, {
        color: annotationColor,
        note: annotationNote
      });
      const updated = { ...existing, color: annotationColor, note: annotationNote, updatedAt: new Date() };
      setAnnotations(prev => new Map(prev).set(segmentId, updated));
    } else {
      const id = await annotationRepository.create({
        segmentId,
        transcriptId,
        color: annotationColor,
        note: annotationNote
      });
      const newAnnotation: Annotation = {
        annotationId: id,
        segmentId,
        transcriptId,
        color: annotationColor,
        note: annotationNote,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setAnnotations(prev => new Map(prev).set(segmentId, newAnnotation));
    }
    setActiveAnnotationSegmentId(null);
    setAnnotationNote('');
    setAnnotationColor('yellow');
  }

  async function handleDeleteAnnotation(segmentId: string) {
    const existing = annotations.get(segmentId);
    if (!existing) return;
    await annotationRepository.delete(existing.annotationId);
    setAnnotations(prev => {
      const next = new Map(prev);
      next.delete(segmentId);
      return next;
    });
    setActiveAnnotationSegmentId(null);
    setAnnotationNote('');
    setAnnotationColor('yellow');
  }

  // --- AI Summarization ---
  async function handleSummarize() {
    if (!video || segments.length === 0) return;
    const settings = await getAISettings();
    if (!settings) return;

    try {
      setIsSummarizing(true);
      setSummarizeError(null);
      setSummaryJustGenerated(false);
      const result = await summarizeTranscript(segments, video.title, settings);
      const summaryId = await summaryRepository.create({
        transcriptId,
        provider: settings.provider,
        model: settings.model,
        overallSummary: result.overallSummary,
        keyPoints: result.keyPoints,
        keyTakeaways: result.keyTakeaways,
        highlights: result.highlights
      });
      const saved = await summaryRepository.getById(summaryId);
      if (saved) {
        setSummary(saved);
        setSummaryJustGenerated(true);
      }
    } catch (error) {
      console.error('Error summarizing transcript:', error);
      setSummarizeError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  }

  // --- Virtualizer ---
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!transcript || !video) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Transcript not found</p>
        <button
          onClick={onBack}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <TranscriptHeader
        video={video}
        transcript={transcript}
        category={category}
        tags={tags}
        onBack={onBack}
        onToggleFavorite={handleToggleFavorite}
        onToggleArchive={handleToggleArchive}
        formatDate={formatDate}
      />

      {/* Stats Bar */}
      <TranscriptStatsBar transcript={transcript} formatDate={formatDate} />

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleCopyTranscript}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Full Text'}
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        {aiConfigured && (
          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSummarizing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isSummarizing ? 'Generating summary...' : summary ? 'Regenerate Summary' : 'Summarize with AI'}
          </button>
        )}
        {summarizeError && (
          <span className="text-xs text-red-500">{summarizeError}</span>
        )}
      </div>

      {/* AI Summary - Full width */}
      {(summary || isSummarizing) && (
        <div className="mb-6">
          {isSummarizing && !summary ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Analyzing transcript with AI...</p>
              </div>
            </div>
          ) : summary ? (
            <AISummaryPanel
              summary={summary}
              video={video}
              formatTimestamp={formatTimestamp}
              justGenerated={summaryJustGenerated}
            />
          ) : null}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Transcript */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold text-gray-900">Transcript</h2>
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search transcript..."
                    className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {searchQuery && matchingSegmentIds.length > 0 && (
                  <>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {currentMatchIndex + 1} of {matchingSegmentIds.length} matches
                    </span>
                    <button
                      onClick={handleSearchPrev}
                      className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                      title="Previous match (Shift+Enter)"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleSearchNext}
                      className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                      title="Next match (Enter)"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </>
                )}
                {searchQuery && matchingSegmentIds.length === 0 && (
                  <span className="text-xs text-gray-500 whitespace-nowrap">No matches</span>
                )}
              </div>
            </div>
          </div>
          <div ref={parentRef} className="max-h-[600px] overflow-y-auto">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const segment = segments[virtualRow.index];
                const annotation = annotations.get(segment.segmentId);
                const isSearchMatch = searchMatchIds.has(segment.segmentId);
                const isCurrentMatch = matchingSegmentIds[currentMatchIndex] === segment.segmentId;
                const isAnnotationActive = activeAnnotationSegmentId === segment.segmentId;

                return (
                  <div
                    key={segment.segmentId}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className={`px-4 py-3 border-b border-gray-100 transition-colors cursor-pointer ${
                        annotation ? `border-l-4 ${ANNOTATION_COLORS[annotation.color].border} ${ANNOTATION_COLORS[annotation.color].bg}` : ''
                      } ${isCurrentMatch ? 'bg-yellow-100' : isSearchMatch ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                      onClick={() => handleSegmentClick(segment.segmentId)}
                    >
                      <button
                        className="text-xs font-medium text-blue-600 mb-1 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`${video.url}&t=${Math.floor(segment.startMs / 1000)}s`, '_blank');
                        }}
                      >
                        {formatTimestamp(segment.startMs)}
                      </button>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {searchQuery ? highlightText(segment.text, searchQuery) : segment.text}
                      </p>
                      {annotation && annotation.note && (
                        <p className={`text-xs mt-1 ${ANNOTATION_COLORS[annotation.color].text} italic`}>
                          {annotation.note}
                        </p>
                      )}
                    </div>

                    {/* Annotation Popover */}
                    {isAnnotationActive && (
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-600">Color:</span>
                          {ALL_ANNOTATION_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAnnotationColor(color);
                              }}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${
                                ANNOTATION_COLORS[color].bg
                              } ${
                                annotationColor === color
                                  ? 'border-gray-800 scale-110'
                                  : 'border-gray-300 hover:border-gray-500'
                              }`}
                              style={{
                                backgroundColor: color === 'yellow' ? '#fef9c3' :
                                  color === 'green' ? '#dcfce7' :
                                  color === 'blue' ? '#dbeafe' :
                                  color === 'pink' ? '#fce7f3' :
                                  color === 'orange' ? '#ffedd5' :
                                  '#f3e8ff'
                              }}
                            />
                          ))}
                        </div>
                        <textarea
                          value={annotationNote}
                          onChange={(e) => setAnnotationNote(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Add a note..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
                          rows={2}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveAnnotation(segment.segmentId);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Save
                          </button>
                          {annotation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAnnotation(segment.segmentId);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAnnotationSegmentId(null);
                              setAnnotationNote('');
                              setAnnotationColor('yellow');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Citation Generator */}
          <CitationGenerator
            video={video}
            transcript={transcript}
          />

          {/* Annotations Panel */}
          <AnnotationPanel
            annotations={annotations}
            segments={segments}
            scrollToSegment={scrollToSegment}
            formatTimestamp={formatTimestamp}
          />

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                Notes
              </h3>
              {isEditingNotes ? (
                <div className="flex gap-1">
                  <button
                    onClick={handleSaveNotes}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingNotes(false);
                      setNotes(transcript.notes);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes here..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {transcript.notes || 'No notes added yet.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
