import { useState } from 'react';
import { 
  Archive, 
  Heart, 
  Trash2, 
  FolderOpen, 
  Tag as TagIcon,
  X,
  Check,
  MoreHorizontal
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
  onClearSelection
}: BulkActionsProps) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  async function loadCategories() {
    const cats = await categoryRepository.getAll();
    setCategories(cats);
  }

  async function loadTags() {
    const allTags = await tagRepository.getAll();
    setTags(allTags);
  }

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-lg">
        <span className="text-sm font-medium px-2">
          {selectedCount} selected
        </span>
        <div className="w-px h-4 bg-gray-700" />
        
        {/* Favorite */}
        <button
          onClick={onFavorite}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          title="Add to favorites"
        >
          <Heart className="w-4 h-4" />
        </button>
        <button
          onClick={onUnfavorite}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          title="Remove from favorites"
        >
          <Heart className="w-4 h-4 text-gray-400" />
        </button>

        {/* Archive */}
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
          <Archive className="w-4 h-4 text-gray-400" />
        </button>

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
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
              <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                Add tags
              </p>
              {tags.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No tags created yet</p>
              ) : (
                tags.map(tag => (
                  <button
                    key={tag.tagId}
                    onClick={() => {
                      onAddTags([tag.tagId]);
                      setShowTagMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {tag.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

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
