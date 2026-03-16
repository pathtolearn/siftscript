import { SearchBar } from '../transcript/SearchBar';
import { SegmentSearchResults } from '../transcript/SegmentSearchResults';
import { FilterSidebar } from '../filters/FilterSidebar';
import { TranscriptList } from '../transcript/TranscriptList';
import type { Transcript, Category, SearchFilters, SortOption, Video, Tag, Segment } from '../../types';

interface LibraryViewProps {
  transcripts: Array<{
    transcript: Transcript;
    video: Video | undefined;
    category: Category | undefined;
    tags: Tag[];
  }>;
  filteredTranscripts: Array<{
    transcript: Transcript;
    video: Video | undefined;
    category: Category | undefined;
    tags: Tag[];
  }>;
  searchQuery: string;
  filters: SearchFilters;
  sort: SortOption;
  selectedIds: string[];
  showFilters: boolean;
  segmentResults: Array<{
    transcriptId: string;
    video: Video | undefined;
    segments: Segment[];
    totalMatches: number;
  }>;
  isSearchingSegments: boolean;
  onSearchChange: (query: string) => void;
  onFilterChange: (filters: SearchFilters) => void;
  onSortChange: (sort: SortOption) => void;
  onClearFilters: () => void;
  onToggleFilters: () => void;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpenDetail: (transcriptId: string) => void;
  onToggleFavorite: (transcriptId: string, favorite: boolean) => void;
  onToggleArchive: (transcriptId: string, archived: boolean) => void;
  onOpenVideo: (url: string) => void;
  onDelete: () => void;
}

export function LibraryView({
  filteredTranscripts,
  searchQuery,
  filters,
  sort,
  selectedIds,
  showFilters,
  segmentResults,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onClearFilters,
  onToggleFilters,
  onSelect,
  onSelectAll,
  onOpenDetail,
  onToggleFavorite,
  onToggleArchive,
  onOpenVideo,
  onDelete,
}: LibraryViewProps) {
  return (
    <div className="flex gap-6">
      <FilterSidebar
        filters={filters}
        sort={sort}
        onFilterChange={onFilterChange}
        onSortChange={onSortChange}
        onClearFilters={onClearFilters}
        isOpen={showFilters}
        onClose={() => onToggleFilters()}
      />

      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            onFilterToggle={onToggleFilters}
            placeholder="Search by title, channel, transcript text, or tags..."
            resultCount={filteredTranscripts.length}
          />
        </div>

        {segmentResults.length > 0 && searchQuery.trim().length >= 3 && (
          <div className="mb-6">
            <SegmentSearchResults
              results={segmentResults}
              query={searchQuery}
              onOpenTranscript={onOpenDetail}
            />
          </div>
        )}

        <TranscriptList
          transcripts={filteredTranscripts}
          selectedIds={selectedIds}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
          onToggleArchive={onToggleArchive}
          onOpenVideo={onOpenVideo}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
