import { useState, useEffect, useRef } from 'react';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import { segmentRepository } from '../../lib/db/repositories/segmentRepository';
import { crossAnalysisRepository } from '../../lib/db/repositories/crossAnalysisRepository';
import { conceptRepository } from '../../lib/db/repositories/conceptRepository';
import { BulkActions } from '../../components/transcript/BulkActions';
import { TranscriptDetail } from '../../components/transcript/TranscriptDetail';
import { LibraryView } from '../../components/dashboard/LibraryView';
import { SettingsView } from '../../components/settings/SettingsView';
import { KnowledgeGraphView } from '../../components/dashboard/KnowledgeGraphView';
import { OnboardingFlow } from '../../components/onboarding/OnboardingFlow';
import { LoginModal } from '../../components/auth/LoginModal';
import { UpgradeModal } from '../../components/subscription/UpgradeModal';
import { UsageBanner } from '../../components/subscription/UsageBanner';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { initializeTheme, listenToThemeChanges } from '../../lib/utils/theme';
import { getAISettings } from '../../lib/utils/ai';
import { analyzeCrossVideo } from '../../lib/utils/crossVideoAI';
import { shouldShowOnboarding } from '../../lib/utils/onboarding';
import { extractConcepts } from '../../lib/utils/conceptExtractor';
import { buildConceptGraph } from '../../lib/utils/graphBuilder';
import type { Transcript, Category, SearchFilters, SortOption, Video, Tag, Segment, CrossAnalysis } from '../../types';
import {
  Library,
  Settings,
  Network,
} from 'lucide-react';

type ActiveTab = 'library' | 'knowledge-graph' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('library');
  const [view, setView] = useState<'library' | 'detail'>('library');
  const [detailTranscriptId, setDetailTranscriptId] = useState<string | null>(null);
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

  // Cross-analysis state
  const [activeAnalysis, setActiveAnalysis] = useState<CrossAnalysis | null>(null);
  const [isCrossAnalyzing, setIsCrossAnalyzing] = useState(false);
  const [crossAnalysisProgress, setCrossAnalysisProgress] = useState({ step: '', current: 0, total: 0 });
  const [savedAnalyses, setSavedAnalyses] = useState<CrossAnalysis[]>([]);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [transcriptCount, setTranscriptCount] = useState(0);

  // Auth / subscription modals
  const [showLogin, setShowLogin] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  // Concept extraction state
  const [extractionPending, setExtractionPending] = useState(0);
  const extractionRunning = useRef(false);

  useEffect(() => {
    initializeTheme();
    const cleanup = listenToThemeChanges(() => {});
    return cleanup;
  }, []);

  useEffect(() => {
    loadLibraryData();
    loadSavedAnalyses().catch(err => console.error('loadSavedAnalyses:', err));
    checkOnboarding().catch(err => console.error('checkOnboarding:', err));
  }, []);

  useEffect(() => {
    applyFiltersAndSearch();
    performSegmentSearch();
  }, [searchQuery, filters, sort, transcripts]);

  // Silently extract concepts whenever the library grows
  useEffect(() => {
    if (transcriptCount === 0 || extractionRunning.current) return;
    runExtractionQueue().catch(err => console.error('runExtractionQueue:', err));
  }, [transcriptCount]);

  async function runExtractionQueue() {
    if (extractionRunning.current) return;
    extractionRunning.current = true;
    try {
      const allTranscripts = await transcriptRepository.getAll();
      const ids = allTranscripts.map(t => t.transcriptId);
      const unextracted = await conceptRepository.getUnextractedTranscriptIds(ids);
      if (unextracted.length === 0) return;

      setExtractionPending(unextracted.length);

      for (let i = 0; i < unextracted.length; i++) {
        const tid = unextracted[i];
        const transcript = await transcriptRepository.getById(tid);
        if (!transcript) continue;
        const video = await videoRepository.getById(transcript.videoId);
        if (!video) continue;
        await extractConcepts(transcript, video).catch(() => {});
        setExtractionPending(unextracted.length - i - 1);
      }

      await buildConceptGraph().catch(() => {});
    } finally {
      extractionRunning.current = false;
      setExtractionPending(0);
    }
  }

  async function checkOnboarding() {
    try {
      const show = await shouldShowOnboarding();
      setShowOnboarding(show);
    } catch (err) {
      console.error('checkOnboarding:', err);
    }
  }

  async function loadLibraryData() {
    try {
      setIsLoading(true);
      const allTranscripts = await transcriptRepository.getAll();

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
      setTranscriptCount(enriched.length);
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function applyFiltersAndSearch() {
    let filtered = [...transcripts];

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

    filtered.sort((a, b) => {
      switch (sort) {
        case 'newest': return b.transcript.createdAt.getTime() - a.transcript.createdAt.getTime();
        case 'oldest': return a.transcript.createdAt.getTime() - b.transcript.createdAt.getTime();
        case 'recentlyOpened': return (b.transcript.lastOpenedAt?.getTime() || 0) - (a.transcript.lastOpenedAt?.getTime() || 0);
        case 'longest': return b.transcript.wordCount - a.transcript.wordCount;
        case 'shortest': return a.transcript.wordCount - b.transcript.wordCount;
        default: return b.transcript.createdAt.getTime() - a.transcript.createdAt.getTime();
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
            segments: segments.slice(0, 5),
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
    setSelectedIds(prev => selected ? [...prev, id] : prev.filter(i => i !== id));
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
    loadLibraryData();
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
    for (const id of selectedIds) await transcriptRepository.update(id, { archived: true });
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkUnarchive() {
    for (const id of selectedIds) await transcriptRepository.update(id, { archived: false });
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkFavorite() {
    for (const id of selectedIds) await transcriptRepository.update(id, { favorite: true });
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkUnfavorite() {
    for (const id of selectedIds) await transcriptRepository.update(id, { favorite: false });
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} transcript(s)?`)) return;
    for (const id of selectedIds) await transcriptRepository.delete(id);
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkChangeCategory(categoryId: string) {
    for (const id of selectedIds) await transcriptRepository.update(id, { categoryId });
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkAddTags(tagIds: string[]) {
    for (const transcriptId of selectedIds) {
      for (const tagId of tagIds) await tagRepository.addTagToTranscript(transcriptId, tagId);
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleBulkRemoveTags(tagIds: string[]) {
    for (const transcriptId of selectedIds) {
      for (const tagId of tagIds) await tagRepository.removeTagFromTranscript(transcriptId, tagId);
    }
    setSelectedIds([]);
    loadLibraryData();
  }

  async function handleCrossAnalyze() {
    if (selectedIds.length < 2) return;

    const settings = await getAISettings();
    if (!settings) {
      alert('Please configure your AI provider in Settings before using cross-video analysis.');
      return;
    }

    setIsCrossAnalyzing(true);
    setCrossAnalysisProgress({ step: 'Starting', current: 0, total: selectedIds.length + 1 });

    // Switch to Knowledge Graph tab so user sees progress
    setActiveTab('knowledge-graph');

    try {
      const transcriptInputs = await Promise.all(
        selectedIds.map(async (id) => {
          const transcript = await transcriptRepository.getById(id);
          if (!transcript) throw new Error(`Transcript ${id} not found`);
          const video = await videoRepository.getById(transcript.videoId);
          const segments = await segmentRepository.getByTranscriptId(id);
          return { transcriptId: id, videoTitle: video?.title || transcript.videoId, segments };
        })
      );

      const result = await analyzeCrossVideo(
        transcriptInputs,
        settings,
        (step, current, total) => setCrossAnalysisProgress({ step, current, total })
      );

      const now = new Date();
      const analysis: CrossAnalysis = {
        crossAnalysisId: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        transcriptIds: selectedIds,
        themes: result.themes,
        contradictions: result.contradictions,
        progression: result.progression,
        synthesis: result.synthesis,
        provider: settings.provider,
        model: settings.model,
        createdAt: now,
        updatedAt: now,
      };

      await crossAnalysisRepository.create(analysis);
      setActiveAnalysis(analysis);
      setSelectedIds([]);
      loadSavedAnalyses();
    } catch (error) {
      console.error('Cross-analysis error:', error);
      alert(`Cross-analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCrossAnalyzing(false);
    }
  }

  async function handleDeleteAnalysis(analysisId: string) {
    if (!confirm('Delete this analysis?')) return;
    await crossAnalysisRepository.delete(analysisId);
    if (activeAnalysis?.crossAnalysisId === analysisId) setActiveAnalysis(null);
    loadSavedAnalyses();
  }

  async function loadSavedAnalyses() {
    try {
      const analyses = await crossAnalysisRepository.getAll();
      setSavedAnalyses(analyses);
    } catch (err) {
      console.error('loadSavedAnalyses:', err);
    }
  }

  function clearFilters() {
    setFilters({});
    setSearchQuery('');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingFlow
          transcriptCount={transcriptCount}
          onComplete={() => {
            setShowOnboarding(false);
            setActiveTab('library');
          }}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* Auth modal */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
          reason="Sign in to use AI features without your own API key"
        />
      )}

      {/* Upgrade modal */}
      {showUpgrade && (
        <UpgradeModal
          reason={upgradeReason || undefined}
          onClose={() => setShowUpgrade(false)}
          onLoginRequired={() => { setShowUpgrade(false); setShowLogin(true); }}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <img src="/vidsage_logo.png" alt="VidSage" className="w-9 h-9 object-contain" />
              <h1 className="text-xl font-semibold text-gray-900">VidSage</h1>
            </div>
            <nav className="flex gap-1">
              <button
                onClick={() => { setActiveTab('library'); setView('library'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'library'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Library className="w-4 h-4" />
                Library
              </button>
              <button
                onClick={() => { setActiveTab('knowledge-graph'); setView('library'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'knowledge-graph'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Network className="w-4 h-4" />
                Knowledge Graph
                {savedAnalyses.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">
                    {savedAnalyses.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('settings'); setView('library'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'settings'
                    ? 'bg-indigo-50 text-indigo-700'
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

      {/* Usage banner — shown near limit */}
      <UsageBanner
        onUpgrade={() => {
          setUpgradeReason('');
          setShowUpgrade(true);
        }}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'detail' && detailTranscriptId ? (
          <ErrorBoundary>
            <TranscriptDetail
              transcriptId={detailTranscriptId}
              onBack={handleBackToLibrary}
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
        ) : activeTab === 'knowledge-graph' ? (
          <ErrorBoundary>
            <KnowledgeGraphView
              savedAnalyses={savedAnalyses}
              activeAnalysis={activeAnalysis}
              isAnalyzing={isCrossAnalyzing}
              analysisProgress={crossAnalysisProgress}
              extractionPending={extractionPending}
              onViewAnalysis={setActiveAnalysis}
              onCloseAnalysis={() => setActiveAnalysis(null)}
              onDeleteAnalysis={handleDeleteAnalysis}
              onRegenerateAnalysis={handleCrossAnalyze}
              onGoToLibrary={() => { setActiveTab('library'); setView('library'); }}
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
        onCrossAnalyze={handleCrossAnalyze}
      />
    </div>
  );
}

export default App;
