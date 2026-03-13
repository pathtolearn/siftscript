import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, Archive, MoreHorizontal, ExternalLink, Clock, FileText } from 'lucide-react';
import type { Transcript, Video, Category, Tag } from '../../types';

interface TranscriptListProps {
  transcripts: Array<{
    transcript: Transcript;
    video: Video | undefined;
    category: Category | undefined;
    tags: Tag[];
  }>;
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpenDetail: (transcriptId: string) => void;
  onToggleFavorite: (transcriptId: string, favorite: boolean) => void;
  onToggleArchive: (transcriptId: string, archived: boolean) => void;
  onOpenVideo: (url: string) => void;
  onDelete?: (transcriptIds: string[]) => void;
}

export function TranscriptList({
  transcripts,
  selectedIds,
  onSelect,
  onSelectAll,
  onOpenDetail,
  onToggleFavorite,
  onToggleArchive,
  onOpenVideo,
  onDelete
}: TranscriptListProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLDivElement>(null);
  const allSelected = transcripts.length > 0 && transcripts.every(t => selectedIds.includes(t.transcript.transcriptId));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // j/k navigation
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      setFocusedIndex(prev => {
        if (transcripts.length === 0) return -1;
        
        if (e.key === 'j') {
          // Move down
          const next = prev + 1;
          return next >= transcripts.length ? transcripts.length - 1 : next;
        } else {
          // Move up
          const next = prev - 1;
          return next < 0 ? 0 : next;
        }
      });
    }

    // Enter to open detail
    if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < transcripts.length) {
      e.preventDefault();
      onOpenDetail(transcripts[focusedIndex].transcript.transcriptId);
    }

    // Space to toggle selection
    if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < transcripts.length) {
      e.preventDefault();
      const transcriptId = transcripts[focusedIndex].transcript.transcriptId;
      onSelect(transcriptId, !selectedIds.includes(transcriptId));
    }

    // Ctrl/Cmd + A to select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      onSelectAll(!allSelected);
    }

    // Delete to remove selected
    if (e.key === 'Delete' && selectedIds.length > 0 && onDelete) {
      e.preventDefault();
      if (confirm(`Delete ${selectedIds.length} selected transcript(s)? This action cannot be undone.`)) {
        onDelete(selectedIds);
      }
    }

    // Shift + ? for help (we'll implement this later)
    if (e.shiftKey && e.key === '?') {
      e.preventDefault();
      // Could show a keyboard shortcuts modal here
      console.log('Keyboard shortcuts: j/k = navigate, Enter = open, Space = select, Ctrl+A = select all, Delete = delete');
    }
  }, [transcripts, focusedIndex, selectedIds, allSelected, onSelect, onSelectAll, onOpenDetail, onDelete]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus the row when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && tableRef.current) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      if (rows[focusedIndex]) {
        (rows[focusedIndex] as HTMLElement).focus();
        rows[focusedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  function formatDuration(wordCount: number): string {
    const minutes = Math.ceil(wordCount / 150); // Approx 150 words per minute
    return `${minutes} min read`;
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto" ref={tableRef}>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Video
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Language
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Saved
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transcripts.map(({ transcript, video, category, tags }, index) => (
              <tr
                key={transcript.transcriptId}
                tabIndex={0}
                onFocus={() => setFocusedIndex(index)}
                className={`hover:bg-gray-50 transition-colors outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                  selectedIds.includes(transcript.transcriptId) ? 'bg-blue-50' : ''
                } ${focusedIndex === index ? 'bg-gray-100' : ''}`}
              >
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(transcript.transcriptId)}
                    onChange={(e) => onSelect(transcript.transcriptId, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={video?.thumbnailUrl || `https://img.youtube.com/vi/${transcript.videoId}/mqdefault.jpg`}
                      alt={video?.title || 'Video thumbnail'}
                      className="w-16 h-9 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onOpenDetail(transcript.transcriptId)}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left line-clamp-2"
                      >
                        {video?.title || transcript.videoId}
                      </button>
                      <p className="text-xs text-gray-500 mt-0.5">{video?.channelTitle || 'Unknown Channel'}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <FileText className="w-3 h-3" />
                        <span>{transcript.wordCount.toLocaleString()} words</span>
                        <span>•</span>
                        <span>{formatDuration(transcript.wordCount)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {category ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: category.colorToken === 'gray' ? '#9ca3af' : category.colorToken }}
                      />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-700">{transcript.languageLabel}</span>
                    <span className="text-xs text-gray-400 capitalize">{transcript.sourceType.replace('-', ' ')}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {transcript.favorite && (
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    )}
                    {transcript.archived && (
                      <Archive className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      transcript.status === 'unread' ? 'bg-blue-50 text-blue-700' :
                      transcript.status === 'in-review' ? 'bg-yellow-50 text-yellow-700' :
                      transcript.status === 'reviewed' ? 'bg-green-50 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {transcript.status.replace('-', ' ')}
                    </span>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.slice(0, 3).map(tag => (
                        <span key={tag.tagId} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                          {tag.name}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(transcript.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onToggleFavorite(transcript.transcriptId, !transcript.favorite)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        transcript.favorite 
                          ? 'text-red-500 hover:bg-red-50' 
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      title={transcript.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={`w-4 h-4 ${transcript.favorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => onToggleArchive(transcript.transcriptId, !transcript.archived)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        transcript.archived 
                          ? 'text-gray-600 hover:bg-gray-100' 
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      title={transcript.archived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => video?.url && onOpenVideo(video.url)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Open in YouTube"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenDetail(transcript.transcriptId)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View details"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {transcripts.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No transcripts found</h3>
          <p className="text-xs text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}
      
      {/* Keyboard shortcuts hint */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
        <span>Keyboard shortcuts: j/k = navigate, Enter = open, Space = select, Ctrl+A = select all, Delete = delete</span>
        <span>Shift+? for help</span>
      </div>
    </div>
  );
}
