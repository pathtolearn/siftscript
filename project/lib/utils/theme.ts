import { settingsRepository } from '../db/repositories/settingsRepository';

export type Theme = 'light' | 'dark' | 'system';

export function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export async function getAppliedTheme(): Promise<'light' | 'dark'> {
  const settings = await settingsRepository.getSettings();
  const theme = settings.theme;
  
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

export function applyTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function toggleTheme(): void {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

export async function initializeTheme(): Promise<void> {
  const theme = await getAppliedTheme();
  applyTheme(theme);
}

// Listen for system theme changes
export function listenToThemeChanges(callback: (theme: 'light' | 'dark') => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handler = async (e: MediaQueryListEvent) => {
    const settings = await settingsRepository.getSettings();
    if (settings.theme === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      applyTheme(newTheme);
      callback(newTheme);
    }
  };
  
  mediaQuery.addEventListener('change', handler);
  
  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}
