import { useState, useEffect, useCallback } from 'react';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import { TranscriptList } from '../../components/transcript/TranscriptList';
import { SearchBar } from '../../components/transcript/SearchBar';
import { FilterSidebar } from '../../components/filters/FilterSidebar';
import { BulkActions } from '../../components/transcript/BulkActions';
import { TranscriptDetail } from '../../components/transcript/TranscriptDetail';
import { GeneralSettings } from '../../components/settings/GeneralSettings';
import { ImportExport } from '../../components/settings/ImportExport';
import { DataManagement } from '../../components/settings/DataManagement';
import type { Transcript, Category, SearchFilters, SortOption, Video, Tag } from '../../types';
import { 
  Library, 
  Settings, 
  LayoutDashboard, 
  FileText,
  Clock,
  Heart,
  Archive,
  FolderOpen
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
    recent: [] as Transcript[]
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
  }, [searchQuery, filters, sort, transcripts]);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      const [statsData, catsData, recentData] = await Promise.all([
        transcriptRepository.getStats(),
        categoryRepository.getStats(),
        transcriptRepository.getRecent(5)
      ]);

      setStats({
        total: statsData.total,
        favorites: statsData.favorites,
        archived: statsData.archived,
        recent: recentData
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
          <TranscriptDetail 
            transcriptId={detailTranscriptId} 
            onBack={handleBackToLibrary} 
          />
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-6">
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
                    {stats.recent.map((transcript) => (
                      <div
                        key={transcript.transcriptId}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(transcript.transcriptId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {transcript.videoId}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
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
        ) : activeTab === 'library' ? (
          <div className="flex gap-6">
            <FilterSidebar
              filters={filters}
              sort={sort}
              onFilterChange={setFilters}
              onSortChange={setSort}
              onClearFilters={clearFilters}
              isOpen={showFilters}
              onClose={() => setShowFilters(false)}
            />
            
            <div className="flex-1 min-w-0">
              <div className="mb-6">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onFilterToggle={() => setShowFilters(!showFilters)}
                  placeholder="Search by title, channel, transcript text, or tags..."
                  resultCount={filteredTranscripts.length}
                />
              </div>
              
              <TranscriptList
                transcripts={filteredTranscripts}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onOpenDetail={handleOpenDetail}
                onToggleFavorite={handleToggleFavorite}
                onToggleArchive={handleToggleArchive}
                onOpenVideo={(url) => window.open(url, '_blank')}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            
            <div className="space-y-8">
              {/* General Settings */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">General</h3>
                <GeneralSettings />
              </div>

              {/* Import/Export */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <ImportExport />
              </div>

              {/* Data Management */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
                <DataManagement />
              </div>
            </div>
          </div>
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
        onAddTags={() => {}}
        onRemoveTags={() => {}}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  );
}

export default App;
