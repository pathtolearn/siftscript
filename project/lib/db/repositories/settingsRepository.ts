import { db, DEFAULT_SETTINGS } from '../schema';
import type { AppSettings } from '../../../types';

export class SettingsRepository {
  async get<T>(key: string): Promise<T | undefined> {
    const setting = await db.settings.get(key);
    return setting?.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await db.settings.put({ key, value });
  }

  async getAllSettings(): Promise<Partial<AppSettings>> {
    const allSettings = await db.settings.toArray();
    return allSettings.reduce((acc, setting) => {
      acc[setting.key as keyof AppSettings] = setting.value as never;
      return acc;
    }, {} as Partial<AppSettings>);
  }

  async getSettings(): Promise<AppSettings> {
    const stored = await this.getAllSettings();
    return {
      ...DEFAULT_SETTINGS,
      ...stored
    };
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const entries = Object.entries(updates);
    await db.settings.bulkPut(
      entries.map(([key, value]) => ({ key, value }))
    );
  }

  async resetToDefaults(): Promise<void> {
    await db.settings.clear();
    await db.settings.bulkAdd(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
        key,
        value
      }))
    );
  }
}

export const settingsRepository = new SettingsRepository();
