import {
  FileText,
  Heart,
  Archive,
  FolderOpen,
  Clock,
  GitCompare,
  Trash2,
  Eye,
} from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { BulkExtractPanel } from './BulkExtractPanel';
import { CategoryManager } from './CategoryManager';
import type { Transcript, Category, Video, CrossAnalysis } from '../../types';

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
  onCreateCategory?: (name: string, colorToken: string) => Promise<void>;
  onUpdateCategory?: (categoryId: string, name: string, colorToken: string) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
  savedAnalyses?: CrossAnalysis[];
  onViewAnalysis?: (analysis: CrossAnalysis) => void;
  onDeleteAnalysis?: (analysisId: string) => void;
}

export function DashboardView({ stats, categories, onOpenDetail, onRefresh, onCreateCategory, onUpdateCategory, onDeleteCategory, savedAnalyses, onViewAnalysis, onDeleteAnalysis }: DashboardViewProps) {
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
          {onCreateCategory && onUpdateCategory && onDeleteCategory ? (
            <CategoryManager
              categories={categories}
              onCreateCategory={onCreateCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
            />
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
      {/* Research / Cross-Video Analyses */}
      {savedAnalyses && savedAnalyses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-500" />
            Cross-Video Research
          </h2>
          <div className="space-y-3">
            {savedAnalyses.map((analysis) => (
              <div
                key={analysis.crossAnalysisId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {analysis.themes.length > 0
                      ? analysis.themes.map(t => t.theme).slice(0, 3).join(', ')
                      : 'Cross-Video Analysis'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {analysis.transcriptIds.length} videos • {analysis.themes.length} themes • {new Date(analysis.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  {onViewAnalysis && (
                    <button
                      onClick={() => onViewAnalysis(analysis)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="View analysis"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteAnalysis && (
                    <button
                      onClick={() => onDeleteAnalysis(analysis.crossAnalysisId)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete analysis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
