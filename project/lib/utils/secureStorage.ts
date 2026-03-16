export const SECURE_KEYS = {
  AI_API_KEY: "secure_ai_api_key",
  NOTION_TOKEN: "secure_notion_token",
} as const;

type SecureKeyValue = (typeof SECURE_KEYS)[keyof typeof SECURE_KEYS];

/**
 * Returns the appropriate storage area.
 * Prefers chrome.storage.session (cleared on browser close) but falls back
 * to chrome.storage.local when session storage is unavailable.
 */
function getStorageArea(): chrome.storage.StorageArea {
  if (chrome.storage.session) {
    return chrome.storage.session;
  }
  return chrome.storage.local;
}

/**
 * Store a value securely in chrome.storage.session (or local as fallback).
 */
export async function saveSecureKey(
  key: string,
  value: string,
): Promise<void> {
  const storage = getStorageArea();
  await storage.set({ [key]: value });
}

/**
 * Retrieve a value from secure storage.
 * Returns null if the key does not exist.
 */
export async function getSecureKey(key: string): Promise<string | null> {
  const storage = getStorageArea();
  const result = await storage.get(key);
  return (result[key] as string) ?? null;
}

/**
 * Remove a value from secure storage.
 */
export async function removeSecureKey(key: string): Promise<void> {
  const storage = getStorageArea();
  await storage.remove(key);
}

/**
 * Migrate a key from localStorage into secure chrome storage, then delete
 * the original localStorage entry. No-op if the localStorage key doesn't exist.
 */
export async function migrateFromLocalStorage(
  localStorageKey: string,
  secureKey: string,
): Promise<void> {
  const value = localStorage.getItem(localStorageKey);
  if (value === null) {
    return;
  }
  await saveSecureKey(secureKey, value);
  localStorage.removeItem(localStorageKey);
}
