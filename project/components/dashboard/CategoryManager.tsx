import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Category } from '../../types';

const COLOR_OPTIONS = [
  { token: 'gray', label: 'Gray', hex: '#9ca3af' },
  { token: 'blue', label: 'Blue', hex: '#3b82f6' },
  { token: 'green', label: 'Green', hex: '#22c55e' },
  { token: 'purple', label: 'Purple', hex: '#a855f7' },
  { token: 'orange', label: 'Orange', hex: '#f97316' },
  { token: '#ef4444', label: 'Red', hex: '#ef4444' },
  { token: '#eab308', label: 'Yellow', hex: '#eab308' },
  { token: '#06b6d4', label: 'Cyan', hex: '#06b6d4' },
  { token: '#ec4899', label: 'Pink', hex: '#ec4899' },
  { token: '#14b8a6', label: 'Teal', hex: '#14b8a6' },
];

function getColorHex(token: string): string {
  const found = COLOR_OPTIONS.find(c => c.token === token);
  return found ? found.hex : token;
}

interface CategoryManagerProps {
  categories: (Category & { count: number })[];
  onCreateCategory: (name: string, colorToken: string) => Promise<void>;
  onUpdateCategory: (categoryId: string, name: string, colorToken: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

export function CategoryManager({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A category with this name already exists');
      return;
    }
    try {
      await onCreateCategory(trimmed, newColor);
      setNewName('');
      setNewColor('blue');
      setIsAdding(false);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to create category');
    }
  }

  function startEditing(cat: Category) {
    setEditingId(cat.categoryId);
    setEditName(cat.name);
    setEditColor(cat.colorToken);
    setError(null);
  }

  async function handleUpdate() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    const duplicate = categories.find(
      c => c.categoryId !== editingId && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setError('A category with this name already exists');
      return;
    }
    try {
      await onUpdateCategory(editingId, trimmed, editColor);
      setEditingId(null);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to update category');
    }
  }

  async function handleDelete(categoryId: string, name: string) {
    if (!confirm(`Delete "${name}"? Its transcripts will be moved to Uncategorized.`)) return;
    try {
      await onDeleteCategory(categoryId);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete category');
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Existing categories */}
      {categories.map((category) => (
        <div key={category.categoryId}>
          {editingId === category.categoryId ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                autoFocus
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.token}
                    onClick={() => setEditColor(color.token)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      editColor === color.token ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.label}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={() => { setEditingId(null); setError(null); }}
                  className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getColorHex(category.colorToken) }}
                />
                <span className="text-sm font-medium text-gray-900">
                  {category.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {category.count} transcripts
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditing(category)}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded"
                    title="Edit category"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {category.name !== 'Uncategorized' && (
                    <button
                      onClick={() => handleDelete(category.categoryId, category.name)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new category */}
      {isAdding ? (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.token}
                onClick={() => setNewColor(color.token)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  newColor === color.token ? 'border-gray-800 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.label}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Create
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewName(''); setError(null); }}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full p-2.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-300 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      )}
    </div>
  );
}
