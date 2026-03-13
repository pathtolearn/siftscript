import { useState, useEffect } from 'react';
import { 
  getNotionToken, 
  setNotionToken, 
  getNotionDatabaseId, 
  setNotionDatabaseId,
  clearNotionCredentials,
  validateNotionToken,
  searchNotionDatabases 
} from '../../lib/utils/exportNotion';
import { Check, AlertCircle, Loader2, ExternalLink, Database, Key } from 'lucide-react';

export function NotionSettings() {
  const [token, setToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [databases, setDatabases] = useState<Array<{ id: string; title: string }>>([]);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      const savedToken = getNotionToken();
      const savedDatabaseId = getNotionDatabaseId();
      
      if (savedToken) {
        setToken(savedToken);
        const isValid = await validateNotionToken(savedToken);
        setIsConnected(isValid);
        
        if (isValid && savedDatabaseId) {
          setDatabaseId(savedDatabaseId);
          // Load available databases
          const dbs = await searchNotionDatabases(savedToken);
          setDatabases(dbs);
        }
      }
    } catch (error) {
      console.error('Error loading Notion settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!token.trim()) {
      setStatus('error');
      setErrorMessage('Please enter a Notion integration token');
      return;
    }

    try {
      setIsSaving(true);
      setStatus('idle');
      setErrorMessage('');

      // Validate token
      const isValid = await validateNotionToken(token);
      
      if (!isValid) {
        setStatus('error');
        setErrorMessage('Invalid Notion integration token');
        return;
      }

      // Save token
      setNotionToken(token);
      setIsConnected(true);

      // Save database ID if provided
      if (databaseId) {
        setNotionDatabaseId(databaseId);
      }

      // Load available databases
      const dbs = await searchNotionDatabases(token);
      setDatabases(dbs);

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving Notion settings:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to Notion');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDisconnect() {
    clearNotionCredentials();
    setToken('');
    setDatabaseId('');
    setIsConnected(false);
    setDatabases([]);
    setStatus('idle');
  }

  async function handleRefreshDatabases() {
    if (!token) return;
    
    try {
      setIsLoading(true);
      const dbs = await searchNotionDatabases(token);
      setDatabases(dbs);
    } catch (error) {
      console.error('Error fetching databases:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
        <div className="flex-1">
          <p className="font-medium text-gray-900">
            {isConnected ? 'Connected to Notion' : 'Not connected to Notion'}
          </p>
          <p className="text-sm text-gray-500">
            {isConnected 
              ? 'Your transcripts can be exported to Notion' 
              : 'Configure your Notion integration to enable export'}
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      {!isConnected && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">How to connect Notion</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 inline-flex items-center gap-1">Notion Integrations <ExternalLink className="w-3 h-3" /></a></li>
            <li>Create a new integration</li>
            <li>Copy the "Internal Integration Token"</li>
            <li>Paste it below</li>
            <li>(Optional) Share a database with your integration</li>
          </ol>
        </div>
      )}

      {/* Token Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Key className="w-4 h-4" />
          Integration Token
        </label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="secret_..."
            className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isConnected}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Your token is stored locally and never sent to our servers
        </p>
      </div>

      {/* Database Selection */}
      {isConnected && databases.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Target Database (Optional)
          </label>
          <select
            value={databaseId}
            onChange={(e) => setDatabaseId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Create in root page</option>
            {databases.map((db) => (
              <option key={db.id} value={db.id}>
                {db.title}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">
              Select a database to export transcripts with properties
            </p>
            <button
              onClick={handleRefreshDatabases}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        {!isConnected ? (
          <button
            onClick={handleSave}
            disabled={isSaving || !token.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : status === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                Connected!
              </>
            ) : (
              'Connect to Notion'
            )}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Disconnect
          </button>
        )}

        {/* Status Messages */}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Privacy Note */}
      <div className="p-3 bg-gray-50 rounded text-xs text-gray-500">
        <strong>Privacy:</strong> Your Notion token is stored locally in your browser. 
        It's only used to export transcripts directly from your browser to your Notion workspace.
      </div>
    </div>
  );
}
