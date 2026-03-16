import { Highlighter } from 'lucide-react';
import { ANNOTATION_COLORS, formatTimestamp } from './transcriptUtils';
import type { Annotation, Segment } from '../../types';

interface AnnotationPanelProps {
  annotations: Map<string, Annotation>;
  segments: Segment[];
  scrollToSegment: (segmentId: string) => void;
  formatTimestamp: (ms: number) => string;
}

export function AnnotationPanel({
  annotations,
  segments,
  scrollToSegment,
  formatTimestamp: formatTs,
}: AnnotationPanelProps) {
  // Build sorted annotation list
  const annotationList = (() => {
    const list = Array.from(annotations.values());
    const segmentIndexMap = new Map(segments.map((s, i) => [s.segmentId, i]));
    list.sort((a, b) => (segmentIndexMap.get(a.segmentId) ?? 0) - (segmentIndexMap.get(b.segmentId) ?? 0));
    return list;
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
        <Highlighter className="w-4 h-4" />
        Annotations
        {annotationList.length > 0 && (
          <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {annotationList.length}
          </span>
        )}
      </h3>
      {annotationList.length === 0 ? (
        <p className="text-sm text-gray-500">No annotations yet. Click a segment to annotate it.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {annotationList.map((ann) => {
            const segment = segments.find(s => s.segmentId === ann.segmentId);
            if (!segment) return null;
            const colors = ANNOTATION_COLORS[ann.color];
            return (
              <button
                key={ann.annotationId}
                onClick={() => scrollToSegment(ann.segmentId)}
                className={`w-full text-left p-2 rounded-lg border-l-4 ${colors.border} ${colors.bg} hover:opacity-80 transition-opacity`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-blue-600">
                    {formatTs(segment.startMs)}
                  </span>
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: ann.color === 'yellow' ? '#eab308' :
                        ann.color === 'green' ? '#22c55e' :
                        ann.color === 'blue' ? '#3b82f6' :
                        ann.color === 'pink' ? '#ec4899' :
                        ann.color === 'orange' ? '#f97316' :
                        '#a855f7'
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{segment.text}</p>
                {ann.note && (
                  <p className={`text-xs mt-0.5 ${colors.text} italic line-clamp-1`}>
                    {ann.note}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
