import {
  FileText,
  Heart,
  Archive,
  FolderOpen,
  Clock
} from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { BulkExtractPanel } from './BulkExtractPanel';
import type { Transcript, Category, Video } from '../../types';

interface DashboardViewProps {
  stats: {
    total: number;
    favorites: number;
    archived: number;
    recent: Array<{ transcript: Transcript; video: Video | undefined }>;
  };
  categories: (Category & { count: number })[];
  onOpenDetail: (transcriptId: string) => void;
  onRefresh?: () => void;
}

export function DashboardView({ stats, categories, onOpenDetail, onRefresh }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* Global Search */}
      <GlobalSearch onOpenTranscript={(transcriptId) => onOpenDetail(transcriptId)} />

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <BulkExtractPanel onComplete={onRefresh} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Transcripts</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Favorites</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.favorites}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Archive className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Archived</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.archived}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Categories</p>
              <p className="text-2xl font-semibold text-gray-900">{categories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transcripts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Recent Transcripts
          </h2>
          {stats.recent.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No transcripts saved yet</p>
              <p className="text-sm mt-1">Navigate to a YouTube video and save your first transcript</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recent.map(({ transcript, video }) => (
                <div
                  key={transcript.transcriptId}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => onOpenDetail(transcript.transcriptId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {video?.title || transcript.videoId}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {video?.channelTitle && <span className="text-gray-700">{video.channelTitle} • </span>}
                        {transcript.languageCode} • {transcript.wordCount} words • {new Date(transcript.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {transcript.favorite && (
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-gray-400" />
            Categories
          </h2>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No categories yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.categoryId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.colorToken === 'gray' ? '#9ca3af' : category.colorToken }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {category.name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {category.count} transcripts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
