import { useState } from 'react';
import {
  Archive,
  Heart,
  Trash2,
  FolderOpen,
  Tag as TagIcon,
  X,
  Plus,
  Minus,
  GitCompare,
} from 'lucide-react';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import { tagRepository } from '../../lib/db/repositories/tagRepository';
import type { Category, Tag } from '../../types';

interface BulkActionsProps {
  selectedCount: number;
  onArchive: () => void;
  onUnarchive: () => void;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onDelete: () => void;
  onChangeCategory: (categoryId: string) => void;
  onAddTags: (tagIds: string[]) => void;
  onRemoveTags: (tagIds: string[]) => void;
  onClearSelection: () => void;
  onCrossAnalyze?: () => void;
}

export function BulkActions({
  selectedCount,
  onArchive,
  onUnarchive,
  onFavorite,
  onUnfavorite,
  onDelete,
  onChangeCategory,
  onAddTags,
  onRemoveTags,
  onClearSelection,
  onCrossAnalyze
}: BulkActionsProps) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagMode, setTagMode] = useState<'add' | 'remove'>('add');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  async function loadCategories() {
    const cats = await categoryRepository.getAll();
    setCategories(cats);
  }

  async function loadTags() {
    const allTags = await tagRepository.getAll();
    setTags(allTags);
  }

  async function handleCreateAndAddTag() {
    const name = newTagName.trim();
    if (!name) return;
    setIsCreatingTag(true);
    try {
      const tag = await tagRepository.findOrCreateByName(name);
      onAddTags([tag.tagId]);
      setNewTagName('');
      setShowTagMenu(false);
    } finally {
      setIsCreatingTag(false);
    }
  }

  function closeAllMenus() {
    setShowCategoryMenu(false);
    setShowTagMenu(false);
  }

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-lg">
        <span className="text-sm font-medium px-2">
          {selectedCount} selected
        </span>
        <div className="w-px h-4 bg-gray-700" />

        {/* Favorite / Unfavorite */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onFavorite}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Add to favorites"
          >
            <Heart className="w-4 h-4 text-red-400" />
          </button>
          <button
            onClick={onUnfavorite}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Remove from favorites"
          >
            <Heart className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Archive / Unarchive */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onArchive}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={onUnarchive}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Unarchive"
          >
            <Archive className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Category */}
        <div className="relative">
          <button
            onClick={() => {
              loadCategories();
              setShowCategoryMenu(!showCategoryMenu);
              setShowTagMenu(false);
            }}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Change category"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          {showCategoryMenu && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
              <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                Move to category
              </p>
              {categories.map(cat => (
                <button
                  key={cat.categoryId}
                  onClick={() => {
                    onChangeCategory(cat.categoryId);
                    setShowCategoryMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.colorToken === 'gray' ? '#9ca3af' : cat.colorToken }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="relative">
          <button
            onClick={() => {
              loadTags();
              setShowTagMenu(!showTagMenu);
              setShowCategoryMenu(false);
            }}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Manage tags"
          >
            <TagIcon className="w-4 h-4" />
          </button>

          {showTagMenu && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
              {/* Mode toggle */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
                <button
                  onClick={() => setTagMode('add')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    tagMode === 'add'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
                <button
                  onClick={() => setTagMode('remove')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    tagMode === 'remove'
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                  Remove
                </button>
              </div>

              <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                {tagMode === 'add' ? 'Add tag' : 'Remove tag'}
              </p>

              {tags.length === 0 && tagMode === 'remove' ? (
                <p className="px-3 py-2 text-sm text-gray-400">No tags to remove</p>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  {tags.map(tag => (
                    <button
                      key={tag.tagId}
                      onClick={() => {
                        if (tagMode === 'add') {
                          onAddTags([tag.tagId]);
                        } else {
                          onRemoveTags([tag.tagId]);
                        }
                        setShowTagMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                        tagMode === 'remove' ? 'text-red-600' : 'text-gray-700'
                      }`}
                    >
                      <TagIcon className="w-3 h-3" />
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Create new tag */}
              {tagMode === 'add' && (
                <div className="px-3 py-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateAndAddTag();
                      }}
                      placeholder="New tag..."
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                    <button
                      onClick={handleCreateAndAddTag}
                      disabled={!newTagName.trim() || isCreatingTag}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cross-Analyze */}
        {onCrossAnalyze && selectedCount >= 2 && (
          <>
            <div className="w-px h-4 bg-gray-700" />
            <button
              onClick={onCrossAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors text-sm font-medium"
              title="Cross-analyze selected transcripts"
            >
              <GitCompare className="w-4 h-4" />
              Cross-Analyze
            </button>
          </>
        )}

        <div className="w-px h-4 bg-gray-700" />

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-900 rounded-full transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>

        <div className="w-px h-4 bg-gray-700" />

        {/* Clear */}
        <button
          onClick={onClearSelection}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
