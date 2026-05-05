import { useState, useEffect } from 'react';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import type { Category, TranscriptStatus, SearchFilters, SortOption, Tag } from '../../types';
import { X, ChevronDown, Filter, Tag as TagIcon } from 'lucide-react';

interface FilterSidebarProps {
  filters: SearchFilters;
  sort: SortOption;
  onFilterChange: (filters: SearchFilters) => void;
  onSortChange: (sort: SortOption) => void;
  onClearFilters: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'recentlyOpened', label: 'Recently Opened' },
  { value: 'titleAsc', label: 'Title A-Z' },
  { value: 'titleDesc', label: 'Title Z-A' },
  { value: 'longest', label: 'Longest First' },
  { value: 'shortest', label: 'Shortest First' },
];

const STATUSES: { value: TranscriptStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'in-review', label: 'In Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'archived', label: 'Archived' },
];

export function FilterSidebar({
  filters,
  sort,
  onFilterChange,
  onSortChange,
  onClearFilters,
  isOpen,
  onClose
}: FilterSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<(Tag & { count: number })[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>(['category', 'status', 'sort']);

  // Pending (staged) state — only applied when user clicks Apply
  const [pendingFilters, setPendingFilters] = useState<SearchFilters>(filters);
  const [pendingSort, setPendingSort] = useState<SortOption>(sort);

  // Sync pending state when applied filters change externally (e.g. clear all)
  useEffect(() => {
    setPendingFilters(filters);
    setPendingSort(sort);
  }, [filters, sort]);

  useEffect(() => {
    loadFilterOptions().catch(err => console.error('loadFilterOptions:', err));
  }, []);

  async function loadFilterOptions() {
    const [cats, tagsWithCounts, allTranscripts] = await Promise.all([
      categoryRepository.getAll(),
      tagRepository.getAllWithCounts(),
      transcriptRepository.getAll()
    ]);

    setCategories(cats);
    setTags(tagsWithCounts.filter(t => t.count > 0));

    const videoIds = allTranscripts.map(t => t.videoId);
    const videos = await Promise.all(videoIds.map(id => videoRepository.getById(id)));
    const uniqueChannels = [...new Set(videos.filter(v => v).map(v => v!.channelTitle))];
    const uniqueLanguages = [...new Set(allTranscripts.map(t => t.languageLabel).filter(Boolean))];

    setChannels(uniqueChannels.sort());
    setLanguages(uniqueLanguages.sort());
  }

  function toggleSection(section: string) {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  }

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setPendingFilters(prev => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onFilterChange(pendingFilters);
    onSortChange(pendingSort);
  }

  function handleClearAll() {
    setPendingFilters({});
    setPendingSort('newest');
    onClearFilters();
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);
  const hasPendingChanges =
    JSON.stringify(pendingFilters) !== JSON.stringify(filters) || pendingSort !== sort;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static top-16 lg:top-auto bottom-0 left-0 z-50
        w-72 bg-card border-r border-border overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-border flex items-center justify-between lg:hidden">
          <h2 className="font-semibold text-card-foreground flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Sort */}
          <div>
            <button
              onClick={() => toggleSection('sort')}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
            >
              Sort By
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('sort') ? '' : '-rotate-90'}`} />
            </button>
            {expandedSections.includes('sort') && (
              <select
                value={pendingSort}
                onChange={(e) => setPendingSort(e.target.value as SortOption)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Category */}
          <div>
            <button
              onClick={() => toggleSection('category')}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
            >
              Category
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('category') ? '' : '-rotate-90'}`} />
            </button>
            {expandedSections.includes('category') && (
              <div className="space-y-2">
                {categories.map(category => (
                  <label key={category.categoryId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      checked={pendingFilters.category === category.categoryId}
                      onChange={() => updateFilter('category', category.categoryId)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: category.colorToken === 'gray' ? '#9ca3af' : category.colorToken }}
                      />
                      <span className="text-sm text-gray-700">{category.name}</span>
                    </div>
                  </label>
                ))}
                {pendingFilters.category && (
                  <button
                    onClick={() => updateFilter('category', undefined)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection('tags')}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
              >
                <span className="flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('tags') ? '' : '-rotate-90'}`} />
              </button>
              {expandedSections.includes('tags') && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tags.map(tag => (
                    <label key={tag.tagId} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tag"
                        checked={pendingFilters.tag === tag.tagId}
                        onChange={() => updateFilter('tag', tag.tagId)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">{tag.name}</span>
                      <span className="text-xs text-gray-400">({tag.count})</span>
                    </label>
                  ))}
                  {pendingFilters.tag && (
                    <button
                      onClick={() => updateFilter('tag', undefined)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <button
              onClick={() => toggleSection('status')}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
            >
              Status
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('status') ? '' : '-rotate-90'}`} />
            </button>
            {expandedSections.includes('status') && (
              <div className="space-y-2">
                {STATUSES.map(status => (
                  <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={pendingFilters.status === status.value}
                      onChange={() => updateFilter('status', status.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{status.label}</span>
                  </label>
                ))}
                {pendingFilters.status && (
                  <button
                    onClick={() => updateFilter('status', undefined)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Favorites */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pendingFilters.favorite === true}
                onChange={(e) => updateFilter('favorite', e.target.checked ? true : undefined)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show favorites only</span>
            </label>
          </div>

          {/* Archived */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pendingFilters.archived === true}
                onChange={(e) => updateFilter('archived', e.target.checked ? true : undefined)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show archived only</span>
            </label>
          </div>

          {/* Channel */}
          {channels.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection('channel')}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
              >
                Channel
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('channel') ? '' : '-rotate-90'}`} />
              </button>
              {expandedSections.includes('channel') && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {channels.map(channel => (
                    <label key={channel} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="channel"
                        checked={pendingFilters.channel === channel}
                        onChange={() => updateFilter('channel', channel)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 truncate">{channel}</span>
                    </label>
                  ))}
                  {pendingFilters.channel && (
                    <button
                      onClick={() => updateFilter('channel', undefined)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Language */}
          {languages.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection('language')}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
              >
                Language
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('language') ? '' : '-rotate-90'}`} />
              </button>
              {expandedSections.includes('language') && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {languages.map(lang => (
                    <label key={lang} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        checked={pendingFilters.language === lang}
                        onChange={() => updateFilter('language', lang)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{lang}</span>
                    </label>
                  ))}
                  {pendingFilters.language && (
                    <button
                      onClick={() => updateFilter('language', undefined)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date Range */}
          <div>
            <button
              onClick={() => toggleSection('dateRange')}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
            >
              Date Range
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes('dateRange') ? '' : '-rotate-90'}`} />
            </button>
            {expandedSections.includes('dateRange') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={pendingFilters.dateFrom ? pendingFilters.dateFrom.toISOString().split('T')[0] : ''}
                    onChange={(e) => updateFilter('dateFrom', e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={pendingFilters.dateTo ? pendingFilters.dateTo.toISOString().split('T')[0] : ''}
                    onChange={(e) => updateFilter('dateTo', e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(pendingFilters.dateFrom || pendingFilters.dateTo) && (
                  <button
                    onClick={() => {
                      updateFilter('dateFrom', undefined);
                      updateFilter('dateTo', undefined);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer — Apply / Clear */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex gap-2">
          <button
            onClick={handleApply}
            disabled={!hasPendingChanges}
            className="flex-1 py-2 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          {(hasActiveFilters || hasPendingChanges) && (
            <button
              onClick={handleClearAll}
              className="py-2 px-3 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
