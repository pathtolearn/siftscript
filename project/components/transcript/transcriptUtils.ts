import type { AnnotationColor } from '../../types';

export const ANNOTATION_COLORS: Record<AnnotationColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: 'bg-yellow-50', border: 'border-l-yellow-400', text: 'text-yellow-700' },
  green: { bg: 'bg-green-50', border: 'border-l-green-400', text: 'text-green-700' },
  blue: { bg: 'bg-blue-50', border: 'border-l-blue-400', text: 'text-blue-700' },
  pink: { bg: 'bg-pink-50', border: 'border-l-pink-400', text: 'text-pink-700' },
  orange: { bg: 'bg-orange-50', border: 'border-l-orange-400', text: 'text-orange-700' },
  purple: { bg: 'bg-purple-50', border: 'border-l-purple-400', text: 'text-purple-700' },
};

export const ALL_ANNOTATION_COLORS: AnnotationColor[] = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'];

export function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
