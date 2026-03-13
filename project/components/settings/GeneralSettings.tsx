import { useState, useEffect } from 'react';
import { settingsRepository } from '../../lib/db/repositories/settingsRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import type { AppSettings, Category } from '../../types';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export function GeneralSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      const [settingsData, categoriesData] = await Promise.all([
        settingsRepository.getSettings(),
        categoryRepository.getAll()
      ]);
      setSettings(settingsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    try {
      setIsSaving(true);
      await settingsRepository.updateSettings(settings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Theme
        </label>
        <select
          value={settings.theme}
          onChange={(e) => updateSetting('theme', e.target.value as AppSettings['theme'])}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Choose your preferred color scheme
        </p>
      </div>

      {/* Default Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Transcript Language
        </label>
        <select
          value={settings.defaultLanguage}
          onChange={(e) => updateSetting('defaultLanguage', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Preferred language for transcript fetching
        </p>
      </div>

      {/* Dashboard Density */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Dashboard Density
        </label>
        <select
          value={settings.dashboardDensity}
          onChange={(e) => updateSetting('dashboardDensity', e.target.value as AppSettings['dashboardDensity'])}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Adjust the spacing in the transcript list
        </p>
      </div>

      {/* Default Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Category
        </label>
        <select
          value={settings.defaultCategoryId || ''}
          onChange={(e) => updateSetting('defaultCategoryId', e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None (ask each time)</option>
          {categories.map(cat => (
            <option key={cat.categoryId} value={cat.categoryId}>
              {cat.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Default category for new transcripts
        </p>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : saveStatus === 'success' ? (
            <>
              <Check className="w-4 h-4" />
              Saved!
            </>
          ) : (
            'Save Settings'
          )}
        </button>

        {saveStatus === 'error' && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Failed to save settings
          </p>
        )}
      </div>
    </div>
  );
}
