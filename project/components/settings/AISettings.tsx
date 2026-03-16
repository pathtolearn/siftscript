import { useState, useEffect } from 'react';
import {
  AI_PROVIDERS,
  getAISettings,
  setAISettings as saveAISettings,
  clearAISettings,
  validateAIConnection
} from '../../lib/utils/ai';
import type { AIProvider, AISettings as AISettingsType } from '../../types';
import { Check, AlertCircle, Loader2, Key, Cpu, Server } from 'lucide-react';

const providerKeys = Object.keys(AI_PROVIDERS) as AIProvider[];

export function AISettings() {
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // When provider changes, reset model to that provider's default
    setModel(AI_PROVIDERS[provider].defaultModel);
  }, [provider]);

  async function loadSettings() {
    try {
      setIsLoading(true);
      const saved = await getAISettings();

      if (saved) {
        setProvider(saved.provider);
        setApiKey(saved.apiKey);
        setModel(saved.model);
        if (saved.baseUrl) {
          setBaseUrl(saved.baseUrl);
        }

        const isValid = await validateAIConnection(saved);
        setIsConnected(isValid);
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTestConnection() {
    const providerConfig = AI_PROVIDERS[provider];

    if (providerConfig.requiresKey && !apiKey.trim()) {
      setStatus('error');
      setErrorMessage('Please enter an API key');
      return;
    }

    try {
      setIsTesting(true);
      setStatus('idle');
      setErrorMessage('');

      const settings: AISettingsType = {
        provider,
        apiKey,
        model,
        ...(provider === 'ollama' ? { baseUrl } : {})
      };

      const isValid = await validateAIConnection(settings);

      if (isValid) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setErrorMessage('Connection failed. Please check your settings.');
      }
    } catch (error) {
      console.error('Error testing AI connection:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave() {
    const providerConfig = AI_PROVIDERS[provider];

    if (providerConfig.requiresKey && !apiKey.trim()) {
      setStatus('error');
      setErrorMessage('Please enter an API key');
      return;
    }

    try {
      setIsSaving(true);
      setStatus('idle');
      setErrorMessage('');

      const settings: AISettingsType = {
        provider,
        apiKey,
        model,
        ...(provider === 'ollama' ? { baseUrl } : {})
      };

      const isValid = await validateAIConnection(settings);

      if (!isValid) {
        setStatus('error');
        setErrorMessage('Connection failed. Please check your settings and try again.');
        return;
      }

      await saveAISettings(settings);
      setIsConnected(true);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving AI settings:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    await clearAISettings();
    setApiKey('');
    setModel(AI_PROVIDERS[provider].defaultModel);
    setBaseUrl('http://localhost:11434');
    setIsConnected(false);
    setStatus('idle');
  }

  const currentProvider = AI_PROVIDERS[provider];

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
            {isConnected
              ? `Connected to ${AI_PROVIDERS[provider].name}`
              : 'Not connected to an AI provider'}
          </p>
          <p className="text-sm text-gray-500">
            {isConnected
              ? `Using ${model} for transcript analysis`
              : 'Configure an AI provider to enable summarization'}
          </p>
        </div>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          AI Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isConnected}
        >
          {providerKeys.map((key) => (
            <option key={key} value={key}>
              {AI_PROVIDERS[key].name}
            </option>
          ))}
        </select>
      </div>

      {/* API Key Input - only for providers that require it */}
      {currentProvider.requiresKey && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
              className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConnected}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Your API key is stored locally and never sent to our servers
          </p>
        </div>
      )}

      {/* Base URL for Ollama */}
      {provider === 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Server className="w-4 h-4" />
            Ollama Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isConnected}
          />
          <p className="mt-1 text-xs text-gray-500">
            The URL where your Ollama instance is running
          </p>
        </div>
      )}

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          Model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isConnected}
        >
          {currentProvider.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        {!isConnected ? (
          <div className="flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isTesting || (currentProvider.requiresKey && !apiKey.trim())}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : status === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Disconnect
          </button>
        )}

        {/* Status Messages */}
        {status === 'success' && !isSaving && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Connection successful</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Privacy Note */}
      <div className="p-3 bg-gray-50 rounded text-xs text-gray-500">
        <strong>Privacy:</strong> Your AI settings and API keys are stored locally in your browser.
        API calls are made directly from your browser to the selected provider. No data is sent to our servers.
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
        <strong>Security Note:</strong> API keys are stored in your browser's session storage and will be cleared when you close all browser windows. For Ollama, no API key is needed.
      </div>
    </div>
  );
}
