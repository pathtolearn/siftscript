import { useState, useEffect, useCallback } from 'react';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import { segmentRepository } from '../../lib/db/repositories/segmentRepository';
import { BulkActions } from '../../components/transcript/BulkActions';
import { TranscriptDetail } from '../../components/transcript/TranscriptDetail';
import { DashboardView } from '../../components/dashboard/DashboardView';
import { LibraryView } from '../../components/dashboard/LibraryView';
import { SettingsView } from '../../components/settings/SettingsView';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { initializeTheme, listenToThemeChanges } from '../../lib/utils/theme';
import type { Transcript, Category, SearchFilters, SortOption, Video, Tag, Segment } from '../../types';
import {
  Library,
  Settings,
  LayoutDashboard,
  FileText,
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library' | 'settings'>('dashboard');
  const [view, setView] = useState<'dashboard' | 'library' | 'detail'>('dashboard');
  const [detailTranscriptId, setDetailTranscriptId] = useState<string | null>(null);

  // Dashboard state
  const [stats, setStats] = useState({
    total: 0,
    favorites: 0,
    archived: 0,
    recent: [] as Array<{
      transcript: Transcript;
      video: Video | undefined;
    }>
  });
  const [categories, setCategories] = useState<(Category & { count: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Library state
  const [transcripts, setTranscripts] = useState<Array<{
    transcript: Transcript;
    video: Video | undefined;
    category: Category | undefined;
    tags: Tag[];
  }>>([]);
  const [filteredTranscripts, setFilteredTranscripts] = useState<typeof transcripts>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sort, setSort] = useState<SortOption>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [segmentResults, setSegmentResults] = useState<Array<{
    transcriptId: string;
    video: Video | undefined;
    segments: Segment[];
    totalMatches: number;
  }>>([]);
  const [isSearchingSegments, setIsSearchingSegments] = useState(false);

  useEffect(() => {
    // Initialize theme on mount
    initializeTheme();

    // Listen for system theme changes
    const cleanup = listenToThemeChanges(() => {
      // Theme will be automatically applied by the listener
    });

    return cleanup;
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    } else if (activeTab === 'library') {
      setView('library');
      loadLibraryData();
    }
  }, [activeTab]);

  useEffect(() => {
    applyFiltersAndSearch();
    performSegmentSearch();
  }, [searchQuery, filters, sort, transcripts]);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      const [statsData, catsData, recentData] = await Promise.all([
        transcriptRepository.getStats(),
        categoryRepository.getStats(),
        transcriptRepository.getRecent(5)
      ]);

      // Load video data for recent transcripts
      const enrichedRecent = await Promise.all(
        recentData.map(async (transcript) => {
          const video = await videoRepository.getById(transcript.videoId);
          return { transcript, video };
        })
      );

      setStats({
        total: statsData.total,
        favorites: statsData.favorites,
        archived: statsData.archived,
        recent: enrichedRecent
      });
      setCategories(catsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadLibraryData() {
    try {
      setIsLoading(true);
      const allTranscripts = await transcriptRepository.getAll();

      // Load related data for each transcript
      const enriched = await Promise.all(
        allTranscripts.map(async (transcript) => {
          const [video, category, tags] = await Promise.all([
            videoRepository.getById(transcript.videoId),
            transcript.categoryId ? categoryRepository.getById(transcript.categoryId) : Promise.resolve(undefined),
            tagRepository.getTagsForTranscript(transcript.transcriptId)
          ]);

          return { transcript, video, category, tags };
        })
      );

      setTranscripts(enriched);
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function applyFiltersAndSearch() {
    let filtered = [...transcripts];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ transcript, video, tags }) => {
        const searchText = [
          video?.title,
          video?.channelTitle,
          transcript.fullText,
          ...tags.map(t => t.name),
          transcript.notes
        ].join(' ').toLowerCase();

        return searchText.includes(query);
      });
    }

    // Apply filters
    if (filters.category) {
      filtered = filtered.filter(({ transcript }) => transcript.categoryId === filters.category);
    }

    if (filters.status) {
      filtered = filtered.filter(({ transcript }) => transcript.status === filters.status);
    }

    if (filters.language) {
      filtered = filtered.filter(({ transcript }) => transcript.languageLabel === filters.language);
    }

    if (filters.favorite !== undefined) {
      filtered = filtered.filter(({ transcript }) => transcript.favorite === filters.favorite);
    }

    if (filters.archived !== undefined) {
      filtered = filtered.filter(({ transcript }) => transcript.archived === filters.archived);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.transcript.createdAt.getTime() - a.transcript.createdAt.getTime();
        case 'oldest':
          return a.transcript.createdAt.getTime() - b.transcript.createdAt.getTime();
        case 'recentlyOpened':
          return (b.transcript.lastOpenedAt?.getTime() || 0) - (a.transcript.lastOpenedAt?.getTime() || 0);
        case 'longest':
          return b.transcript.wordCount - a.transcript.wordCount;
        case 'shortest':
          return a.transcript.wordCount - b.transcript.wordCount;
        default:
          return b.transcript.createdAt.getTime() - a.transcript.createdAt.getTime();
      }
    });

    setFilteredTranscripts(filtered);
  }

  async function performSegmentSearch() {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSegmentResults([]);
      return;
    }

    setIsSearchingSegments(true);
    try {
      const results = await segmentRepository.searchAcrossTranscripts(query);
      const enriched = await Promise.all(
        Array.from(results.entries()).map(async ([transcriptId, segments]) => {
          const transcript = await transcriptRepository.getById(transcriptId);
          const video = transcript ? await videoRepository.getById(transcript.videoId) : undefined;
          return {
            transcriptId,
            video,
            segments: segments.slice(0, 5), // Show max 5 preview segments
            totalMatches: segments.length
          };
        })
      );
      setSegmentResults(enriched.filter(r => r.video));
    } catch (error) {
      console.error('Segment search error:', error);
    } finally {
      setIsSearchingSegments(false);
    }
  }

  function handleSelect(id: string, selected: boolean) {
    setSelectedIds(prev =>
      selected
        ? [...prev, id]
        : prev.filter(i => i !== id)
    );
  }

  function handleSelectAll(selected: boolean) {
    setSelectedIds(selected ? filteredTranscripts.map(t => t.transcript.transcriptId) : []);
  }

  function handleOpenDetail(transcriptId: string) {
    setDetailTranscriptId(transcriptId);
    setView('detail');
  }

  function handleBackToLibrary() {
    setView('library');
    setDetailTranscriptId(null);
    loadLibraryData(); // Refresh data
  }

  async function handleToggleFavorite(transcriptId: string, favorite: boolean) {
    await transcriptRepository.update(transcriptId, { favorite });
    loadLibraryData();
  }

  async function handleToggleArchive(transcriptId: string, archived: boolean) {
    await transcriptRepository.update(transcriptId, { archived });
    loadLibraryData();
  }

  async function handleBulkArchive() {
    for (const id of selectedIds) {
      await transcriptRepository.update(id, { archived: true });
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkUnarchive() {
    for (const id of selectedIds) {
      await transcriptRepository.update(id, { archived: false });
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkFavorite() {
    for (const id of selectedIds) {
      await transcriptRepository.update(id, { favorite: true });
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkUnfavorite() {
    for (const id of selectedIds) {
      await transcriptRepository.update(id, { favorite: false });
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} transcript(s)?`)) return;

    for (const id of selectedIds) {
      await transcriptRepository.delete(id);
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkChangeCategory(categoryId: string) {
    for (const id of selectedIds) {
      await transcriptRepository.update(id, { categoryId });
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkAddTags(tagIds: string[]) {
    for (const transcriptId of selectedIds) {
      for (const tagId of tagIds) {
        await tagRepository.addTagToTranscript(transcriptId, tagId);
      }
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkRemoveTags(tagIds: string[]) {
    for (const transcriptId of selectedIds) {
      for (const tagId of tagIds) {
        await tagRepository.removeTagFromTranscript(transcriptId, tagId);
      }
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  function clearFilters() {
    setFilters({});
    setSearchQuery('');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                YouTube Transcript Manager
              </h1>
            </div>
            <nav className="flex gap-1">
              <button
                onClick={() => { setActiveTab('dashboard'); setView('dashboard'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'library'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Library className="w-4 h-4" />
                Library
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'settings'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'detail' && detailTranscriptId ? (
          <ErrorBoundary>
            <TranscriptDetail
              transcriptId={detailTranscriptId}
              onBack={handleBackToLibrary}
            />
          </ErrorBoundary>
        ) : activeTab === 'dashboard' ? (
          <ErrorBoundary>
            <DashboardView
              stats={stats}
              categories={categories}
              onOpenDetail={handleOpenDetail}
            />
          </ErrorBoundary>
        ) : activeTab === 'library' ? (
          <ErrorBoundary>
            <LibraryView
              transcripts={transcripts}
              filteredTranscripts={filteredTranscripts}
              searchQuery={searchQuery}
              filters={filters}
              sort={sort}
              selectedIds={selectedIds}
              showFilters={showFilters}
              segmentResults={segmentResults}
              isSearchingSegments={isSearchingSegments}
              onSearchChange={setSearchQuery}
              onFilterChange={setFilters}
              onSortChange={setSort}
              onClearFilters={clearFilters}
              onToggleFilters={() => setShowFilters(!showFilters)}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onOpenDetail={handleOpenDetail}
              onToggleFavorite={handleToggleFavorite}
              onToggleArchive={handleToggleArchive}
              onOpenVideo={(url) => window.open(url, '_blank')}
              onDelete={handleBulkDelete}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <SettingsView />
          </ErrorBoundary>
        )}
      </main>

      {/* Bulk Actions */}
      <BulkActions
        selectedCount={selectedIds.length}
        onArchive={handleBulkArchive}
        onUnarchive={handleBulkUnarchive}
        onFavorite={handleBulkFavorite}
        onUnfavorite={handleBulkUnfavorite}
        onDelete={handleBulkDelete}
        onChangeCategory={handleBulkChangeCategory}
        onAddTags={handleBulkAddTags}
        onRemoveTags={handleBulkRemoveTags}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  );
}

export default App;
