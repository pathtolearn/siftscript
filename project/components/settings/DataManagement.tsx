import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { Trash2, AlertTriangle, Loader2, Check } from 'lucide-react';

export function DataManagement() {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<'idle' | 'success' | 'error'>('idle');

  async function handleClearAllData() {
    if (!confirm('Are you absolutely sure? This will delete ALL your saved transcripts, videos, categories, and tags. This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      
      // Delete all data from all stores
      await Promise.all([
        db.videos.clear(),
        db.transcripts.clear(),
        db.segments.clear(),
        db.categories.clear(),
        db.tags.clear(),
        db.transcriptTags.clear(),
        db.settings.clear()
      ]);

      setClearStatus('success');
      setShowClearConfirm(false);
      
      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error clearing data:', error);
      setClearStatus('error');
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Clear All Data */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-red-900">Clear All Data</h4>
            <p className="text-sm text-red-700 mt-1">
              Permanently delete all transcripts, videos, categories, and tags. This action cannot be undone.
            </p>
            
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Data
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-red-800">
                  Type "DELETE" to confirm:
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleClearAllData}
                    disabled={isClearing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Clearing...
                      </>
                    ) : clearStatus === 'success' ? (
                      <>
                        <Check className="w-4 h-4" />
                        Cleared!
                      </>
                    ) : (
                      'Confirm Delete'
                    )}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
                {clearStatus === 'error' && (
                  <p className="text-sm text-red-600">
                    Failed to clear data. Please try again.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-2">Storage Information</h4>
        <p className="text-sm text-gray-600">
          All data is stored locally in your browser using IndexedDB. No data is sent to any server.
        </p>
        <div className="mt-4 text-xs text-gray-500">
          <p>Database: YouTubeTranscriptManager</p>
          <p>Version: 1.0.0</p>
        </div>
      </div>
    </div>
  );
}
