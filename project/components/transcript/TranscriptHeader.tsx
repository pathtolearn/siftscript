import {
  ArrowLeft,
  Heart,
  Archive,
  ArchiveRestore,
  BookOpen,
  BookCheck,
  ExternalLink,
  Globe,
  Calendar,
} from 'lucide-react';
import type { Video, Transcript, Category, Tag } from '../../types';

interface TranscriptHeaderProps {
  video: Video;
  transcript: Transcript;
  category: Category | null;
  tags: Tag[];
  onBack: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onToggleRead: () => void;
  formatDate: (date: Date) => string;
}

export function TranscriptHeader({
  video,
  transcript,
  category,
  tags,
  onBack,
  onToggleFavorite,
  onToggleArchive,
  onToggleRead,
  formatDate,
}: TranscriptHeaderProps) {
  const isRead = transcript.status === 'reviewed' || transcript.status === 'in-review';
  return (
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
            onClick={onToggleFavorite}
            title={transcript.favorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 rounded-lg transition-colors ${
              transcript.favorite ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Heart className={`w-5 h-5 ${transcript.favorite ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={onToggleRead}
            title={isRead ? 'Mark as unread' : 'Mark as read'}
            className={`p-2 rounded-lg transition-colors ${
              isRead ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            {isRead ? <BookCheck className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </button>
          <button
            onClick={onToggleArchive}
            title={transcript.archived ? 'Unarchive' : 'Archive'}
            className={`p-2 rounded-lg transition-colors ${
              transcript.archived ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            {transcript.archived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
          </button>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on YouTube"
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
}
