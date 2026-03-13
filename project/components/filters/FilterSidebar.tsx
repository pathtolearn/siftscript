import { useState, useEffect } from 'react';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import type { Category, TranscriptStatus, SearchFilters, SortOption } from '../../types';
import { X, ChevronDown, Filter } from 'lucide-react';

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
  const [channels, setChannels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>(['category', 'status', 'sort']);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  async function loadFilterOptions() {
    const [cats, allTranscripts] = await Promise.all([
      categoryRepository.getAll(),
      transcriptRepository.getAll()
    ]);

    setCategories(cats);

    // Extract unique channels and languages
    const uniqueChannels = [...new Set(allTranscripts.map(t => t.videoId))];
    const uniqueLanguages = [...new Set(allTranscripts.map(t => t.languageLabel))];
    
    // For now, we'll just show what we have
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
    onFilterChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

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
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-white border-r border-gray-200 overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between lg:hidden">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
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
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
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
                      checked={filters.category === category.categoryId}
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
                {filters.category && (
                  <button
                    onClick={() => updateFilter('category', undefined)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Clear category filter
                  </button>
                )}
              </div>
            )}
          </div>

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
                      checked={filters.status === status.value}
                      onChange={() => updateFilter('status', status.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{status.label}</span>
                  </label>
                ))}
                {filters.status && (
                  <button
                    onClick={() => updateFilter('status', undefined)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Clear status filter
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
                checked={filters.favorite === true}
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
                checked={filters.archived === true}
                onChange={(e) => updateFilter('archived', e.target.checked ? true : undefined)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show archived only</span>
            </label>
          </div>

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
                        checked={filters.language === lang}
                        onChange={() => updateFilter('language', lang)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{lang}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="w-full py-2 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
