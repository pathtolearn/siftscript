import { useState, useEffect } from 'react';
import { messaging } from '../../lib/messaging/messaging';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import type { VideoContext, Category } from '../../types';
import { Save, ExternalLink, Loader2, CheckCircle, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';

type SaveAction = 'save' | 'overwrite' | 'skip';

function App() {
  const [videoContext, setVideoContext] = useState<VideoContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [transcriptAvailable, setTranscriptAvailable] = useState<boolean | null>(null);
  const [existingTranscript, setExistingTranscript] = useState<{ transcriptId: string; updatedAt: Date } | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [transcriptInfo, setTranscriptInfo] = useState<{ languageCode: string; sourceType: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      
      // Load video context with transcript availability
      const response = await messaging.sendMessage('GET_CURRENT_VIDEO_CONTEXT', {});
      setVideoContext(response.context);
      
      // @ts-expect-error - transcriptAvailable might be in response
      if (response.transcriptAvailable !== undefined) {
        // @ts-expect-error
        setTranscriptAvailable(response.transcriptAvailable);
      }
      
      // Load categories
      const cats = await categoryRepository.getAll();
      setCategories(cats);
      const uncategorized = cats.find(c => c.name === 'Uncategorized');
      if (uncategorized) {
        setSelectedCategory(uncategorized.categoryId);
      }
      
      if (response.context) {
        // Check for existing transcript
        await checkExistingTranscript(response.context.videoId);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function checkExistingTranscript(videoId: string) {
    try {
      // Check for any transcript for this video
      const transcripts = await transcriptRepository.getByVideoId(videoId);
      if (transcripts.length > 0) {
        // Get the most recently updated one
        const mostRecent = transcripts.sort((a, b) => 
          b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0];
        setExistingTranscript({
          transcriptId: mostRecent.transcriptId,
          updatedAt: mostRecent.updatedAt
        });
        setTranscriptInfo({
          languageCode: mostRecent.languageCode,
          sourceType: mostRecent.sourceType
        });
      } else {
        setExistingTranscript(null);
      }
      
      // Assume transcript is available (content script will verify)
      setTranscriptAvailable(true);
    } catch (error) {
      console.error('Error checking existing transcript:', error);
    }
  }

  async function handleSaveTranscript(action: SaveAction = 'save') {
    if (!videoContext) return;

    if (action === 'skip') {
      setShowDuplicateDialog(false);
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');
    setShowDuplicateDialog(false);

    try {
      // Fetch transcript
      const transcriptResponse = await messaging.sendMessage('FETCH_TRANSCRIPT', {
        videoId: videoContext.videoId
      });

      // Save transcript
      const saveResponse = await messaging.sendMessage('SAVE_TRANSCRIPT', {
        videoContext,
        segments: transcriptResponse.segments,
        languageCode: transcriptResponse.languageCode,
        languageLabel: transcriptResponse.languageLabel,
        sourceType: transcriptResponse.sourceType,
        categoryId: selectedCategory || undefined
      });

      setSaveStatus('success');
      
      // Update existing transcript info
      if (!saveResponse.isNew) {
        await checkExistingTranscript(videoContext.videoId);
      }
      
      console.log('Transcript saved:', saveResponse);
    } catch (error) {
      console.error('Error saving transcript:', error);
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save transcript');
    } finally {
      setIsSaving(false);
    }
  }

  function initiateSave() {
    if (existingTranscript) {
      setShowDuplicateDialog(true);
    } else {
      handleSaveTranscript('save');
    }
  }

  function handleOpenDashboard() {
    messaging.sendMessage('OPEN_DASHBOARD', {});
  }

  if (isLoading) {
    return (
      <div className="w-80 p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!videoContext) {
    return (
      <div className="w-80 p-4">
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h2 className="text-sm font-medium text-gray-900 mb-1">No YouTube Video Detected</h2>
          <p className="text-xs text-gray-500">
            Navigate to a YouTube video to save its transcript
          </p>
        </div>
        <button
          onClick={handleOpenDashboard}
          className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 p-4">
      {/* Video Info */}
      <div className="mb-4">
        <div className="flex gap-3">
          <img
            src={videoContext.thumbnailUrl}
            alt={videoContext.title}
            className="w-20 h-12 object-cover rounded"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
              {videoContext.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{videoContext.channelTitle}</p>
          </div>
        </div>
      </div>

      {/* Transcript Status */}
      <div className="mb-4 p-2 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${transcriptAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-600">
            {transcriptAvailable ? 'Transcript available' : 'No transcript available'}
          </span>
        </div>
        {existingTranscript && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <RefreshCw className="w-3 h-3" />
              <span>Already saved ({transcriptInfo?.languageCode})</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {existingTranscript.updatedAt.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Category Selector */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
          <FolderOpen className="w-3 h-3" />
          Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {categories.map((cat) => (
            <option key={cat.categoryId} value={cat.categoryId}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <button
        onClick={initiateSave}
        disabled={isSaving || !transcriptAvailable}
        className="w-full mb-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : existingTranscript ? (
          <>
            <RefreshCw className="w-4 h-4" />
            Update Transcript
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Transcript
          </>
        )}
      </button>

      {/* Duplicate Dialog */}
      {showDuplicateDialog && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800 mb-2">
            A transcript for this video already exists. What would you like to do?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveTranscript('overwrite')}
              disabled={isSaving}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Update
            </button>
            <button
              onClick={() => handleSaveTranscript('skip')}
              className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {saveStatus === 'success' && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-700">
            {existingTranscript ? 'Transcript updated successfully!' : 'Transcript saved successfully!'}
          </span>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-red-700">{errorMessage}</span>
        </div>
      )}

      {/* Open Dashboard */}
      <button
        onClick={handleOpenDashboard}
        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
      >
        <ExternalLink className="w-4 h-4" />
        Open Dashboard
      </button>
    </div>
  );
}

export default App;
