import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chrome.storage API before importing the module under test
// ---------------------------------------------------------------------------
const mockStorageData: Record<string, string> = {};

const mockStorageArea: chrome.storage.StorageArea = {
  get: vi.fn(async (key: string | string[] | Record<string, unknown> | null) => {
    if (typeof key === 'string') {
      return key in mockStorageData ? { [key]: mockStorageData[key] } : {};
    }
    return {};
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(items)) {
      mockStorageData[k] = v as string;
    }
  }),
  remove: vi.fn(async (key: string | string[]) => {
    if (typeof key === 'string') {
      delete mockStorageData[key];
    }
  }),
  clear: vi.fn(async () => {
    for (const key of Object.keys(mockStorageData)) {
      delete mockStorageData[key];
    }
  }),
  // These are part of the interface but won't be called in tests
  getBytesInUse: vi.fn(async () => 0),
  setAccessLevel: vi.fn(async () => {}),
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
    hasListeners: vi.fn(() => false),
    addRules: vi.fn(),
    removeRules: vi.fn(),
    getRules: vi.fn(),
  } as unknown as chrome.events.Event<(changes: { [key: string]: chrome.storage.StorageChange }) => void>,
} as unknown as chrome.storage.StorageArea;

// Provide global chrome mock
vi.stubGlobal('chrome', {
  storage: {
    session: mockStorageArea,
    local: mockStorageArea,
  },
});

// Import after mocking chrome
import {
  saveSecureKey,
  getSecureKey,
  removeSecureKey,
  SECURE_KEYS,
} from '../lib/utils/secureStorage';

describe('secureStorage', () => {
  beforeEach(() => {
    // Clear mock storage between tests
    for (const key of Object.keys(mockStorageData)) {
      delete mockStorageData[key];
    }
    vi.clearAllMocks();
  });

  it('SECURE_KEYS contains expected constants', () => {
    expect(SECURE_KEYS.AI_API_KEY).toBe('secure_ai_api_key');
    expect(SECURE_KEYS.NOTION_TOKEN).toBe('secure_notion_token');
  });

  it('saveSecureKey stores a value', async () => {
    await saveSecureKey('test_key', 'test_value');
    expect(mockStorageArea.set).toHaveBeenCalledWith({ test_key: 'test_value' });
    expect(mockStorageData['test_key']).toBe('test_value');
  });

  it('getSecureKey retrieves a stored value', async () => {
    mockStorageData['my_key'] = 'my_value';
    const result = await getSecureKey('my_key');
    expect(result).toBe('my_value');
  });

  it('getSecureKey returns null for missing key', async () => {
    const result = await getSecureKey('nonexistent');
    expect(result).toBeNull();
  });

  it('removeSecureKey deletes a stored value', async () => {
    mockStorageData['to_remove'] = 'val';
    await removeSecureKey('to_remove');
    expect(mockStorageArea.remove).toHaveBeenCalledWith('to_remove');
    expect(mockStorageData['to_remove']).toBeUndefined();
  });

  it('round-trips save and get', async () => {
    await saveSecureKey(SECURE_KEYS.AI_API_KEY, 'sk-abc123');
    const retrieved = await getSecureKey(SECURE_KEYS.AI_API_KEY);
    expect(retrieved).toBe('sk-abc123');
  });
});
