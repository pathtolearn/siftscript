import {
  FileText,
  Clock,
  Globe,
  Calendar,
} from 'lucide-react';
import type { Transcript } from '../../types';

interface TranscriptStatsBarProps {
  transcript: Transcript;
  formatDate: (date: Date) => string;
}

export function TranscriptStatsBar({ transcript, formatDate }: TranscriptStatsBarProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <FileText className="w-4 h-4" />
          <span className="text-xs uppercase">Words</span>
        </div>
        <p className="text-2xl font-semibold text-gray-900">{transcript.wordCount.toLocaleString()}</p>
      </div>
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs uppercase">Segments</span>
        </div>
        <p className="text-2xl font-semibold text-gray-900">{transcript.segmentCount.toLocaleString()}</p>
      </div>
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Globe className="w-4 h-4" />
          <span className="text-xs uppercase">Language</span>
        </div>
        <p className="text-lg font-semibold text-gray-900">{transcript.languageLabel}</p>
        <p className="text-xs text-gray-500 capitalize">{transcript.sourceType.replace('-', ' ')}</p>
      </div>
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Calendar className="w-4 h-4" />
          <span className="text-xs uppercase">Status</span>
        </div>
        <p className="text-lg font-semibold text-gray-900 capitalize">{transcript.status.replace('-', ' ')}</p>
        <p className="text-xs text-gray-500">Last opened: {formatDate(transcript.lastOpenedAt)}</p>
      </div>
    </div>
  );
}
