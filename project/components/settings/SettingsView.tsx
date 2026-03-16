import { useState } from 'react';
import { GeneralSettings } from './GeneralSettings';
import { NotionSettings } from './NotionSettings';
import { AISettings } from './AISettings';
import { ImportExport } from './ImportExport';
import { DataManagement } from './DataManagement';
import {
  Settings,
  Link,
  Brain,
  ArrowLeftRight,
  Database,
} from 'lucide-react';

type SettingsTab = 'general' | 'notion' | 'ai' | 'import-export' | 'data';

const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'notion', label: 'Notion', icon: Link },
  { id: 'ai', label: 'AI', icon: Brain },
  { id: 'import-export', label: 'Import / Export', icon: ArrowLeftRight },
  { id: 'data', label: 'Data', icon: Database },
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab content */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === 'general' && (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">General</h3>
              <GeneralSettings />
            </>
          )}

          {activeTab === 'notion' && (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notion Integration</h3>
              <NotionSettings />
            </>
          )}

          {activeTab === 'ai' && (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">AI Summarization</h3>
              <AISettings />
            </>
          )}

          {activeTab === 'import-export' && (
            <ImportExport />
          )}

          {activeTab === 'data' && (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
              <DataManagement />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
