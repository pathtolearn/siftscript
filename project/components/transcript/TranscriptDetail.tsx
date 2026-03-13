import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Archive, 
  ExternalLink, 
  Copy, 
  Download,
  Clock,
  FileText,
  Globe,
  Calendar,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { segmentRepository } from '../../lib/db/repositories/segmentRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import { formatTranscriptAsText, downloadText } from '../../lib/utils/export';
import { CitationGenerator } from './CitationGenerator';
import { Summarization } from './Summarization';
import { ChapterDetector } from './ChapterDetector';
import type { Transcript, Segment, Video, Category, Tag } from '../../types';

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

  useEffect(() => {
    loadTranscript();
  }, [transcriptId]);

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
        const [videoData, categoryData, tagsData] = await Promise.all([
          videoRepository.getById(transcriptData.videoId),
          transcriptData.categoryId ? categoryRepository.getById(transcriptData.categoryId) : Promise.resolve(null),
          tagRepository.getTagsForTranscript(transcriptId)
        ]);

        setVideo(videoData || null);
        setCategory(categoryData || null);
        setTags(tagsData);
        setSegments(segmentsData);

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

  function formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

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
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to library
        </button>

        <div className="flex items-start gap-4">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-32 h-20 object-cover rounded-lg"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" />
                {video.channelTitle}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(transcript.createdAt)}
              </span>
              {category && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.colorToken === 'gray' ? '#9ca3af' : category.colorToken }}
                  />
                  {category.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              {tags.map(tag => (
                <span key={tag.tagId} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded">
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg transition-colors ${
                transcript.favorite ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              <Heart className={`w-5 h-5 ${transcript.favorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleToggleArchive}
              className={`p-2 rounded-lg transition-colors ${
                transcript.archived ? 'text-gray-600 bg-gray-100' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              <Archive className="w-5 h-5" />
            </button>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs uppercase">Words</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{transcript.wordCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs uppercase">Segments</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{transcript.segmentCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Globe className="w-4 h-4" />
            <span className="text-xs uppercase">Language</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{transcript.languageLabel}</p>
          <p className="text-xs text-gray-500 capitalize">{transcript.sourceType.replace('-', ' ')}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs uppercase">Status</span>
          </div>
          <p className="text-lg font-semibold text-gray-900 capitalize">{transcript.status.replace('-', ' ')}</p>
          <p className="text-xs text-gray-500">Last opened: {formatDate(transcript.lastOpenedAt)}</p>
        </div>
      </div>

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
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Transcript */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Transcript</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {segments.map((segment) => (
              <div
                key={segment.segmentId}
                className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <button
                  className="text-xs font-medium text-blue-600 mb-1 hover:underline"
                  onClick={() => window.open(`${video.url}&t=${Math.floor(segment.startMs / 1000)}s`, '_blank')}
                >
                  {formatTimestamp(segment.startMs)}
                </button>
                <p className="text-sm text-gray-800 leading-relaxed">{segment.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Citation Generator */}
          <CitationGenerator 
            video={video} 
            transcript={transcript}
          />

          {/* AI Summary */}
          <Summarization
            transcriptId={transcriptId}
            video={video}
          />

          {/* Chapter Detection */}
          <ChapterDetector
            segments={segments}
            video={video}
            onChapterClick={(startMs) => {
              window.open(`${video.url}&t=${Math.floor(startMs / 1000)}s`, '_blank');
            }}
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
