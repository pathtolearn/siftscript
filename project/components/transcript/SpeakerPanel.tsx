import { useState } from 'react';
import { Users, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import type { Speaker } from '../../types';
import { speakerRepository } from '../../lib/db/repositories/speakerRepository';

interface SpeakerPanelProps {
  speakers: Speaker[];
  transcriptId: string;
  onSpeakersChange: (speakers: Speaker[]) => void;
}

const SPEAKER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

export function SpeakerPanel({ speakers, transcriptId, onSpeakersChange }: SpeakerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  async function handleAddSpeaker() {
    if (!newLabel.trim()) return;
    const color = SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length];
    const id = await speakerRepository.create({
      transcriptId,
      label: newLabel.trim(),
      color,
    });
    const updated = [...speakers, {
      speakerId: id,
      transcriptId,
      label: newLabel.trim(),
      color,
      createdAt: new Date(),
    }];
    onSpeakersChange(updated);
    setNewLabel('');
    setIsAdding(false);
  }

  async function handleUpdateSpeaker(speakerId: string) {
    if (!editLabel.trim()) return;
    await speakerRepository.update(speakerId, { label: editLabel.trim() });
    const updated = speakers.map(s =>
      s.speakerId === speakerId ? { ...s, label: editLabel.trim() } : s
    );
    onSpeakersChange(updated);
    setEditingId(null);
  }

  async function handleDeleteSpeaker(speakerId: string) {
    await speakerRepository.delete(speakerId);
    onSpeakersChange(speakers.filter(s => s.speakerId !== speakerId));
  }

  async function handleColorChange(speakerId: string, color: string) {
    await speakerRepository.update(speakerId, { color });
    const updated = speakers.map(s =>
      s.speakerId === speakerId ? { ...s, color } : s
    );
    onSpeakersChange(updated);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
          <Users className="w-4 h-4" />
          Speakers ({speakers.length})
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Speaker list */}
      <div className="space-y-2">
        {speakers.map((speaker) => (
          <div key={speaker.speakerId} className="flex items-center gap-2">
            <div className="relative group">
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: speaker.color }}
              />
              {/* Color picker on hover */}
              <div className="hidden group-hover:flex absolute top-full left-0 mt-1 gap-1 bg-white p-1.5 rounded-lg shadow-lg border border-gray-200 z-10">
                {SPEAKER_COLORS.map((color) => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded-full border border-gray-200"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(speaker.speakerId, color)}
                  />
                ))}
              </div>
            </div>

            {editingId === speaker.speakerId ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateSpeaker(speaker.speakerId)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={() => handleUpdateSpeaker(speaker.speakerId)} className="text-green-600">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-sm text-gray-900 flex-1 truncate">{speaker.label}</span>
                <button
                  onClick={() => { setEditingId(speaker.speakerId); setEditLabel(speaker.label); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteSpeaker(speaker.speakerId)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Add new speaker */}
        {isAdding && (
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0"
              style={{ backgroundColor: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length] }}
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSpeaker()}
              placeholder="Speaker name..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={handleAddSpeaker} className="text-green-600">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setIsAdding(false); setNewLabel(''); }} className="text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {speakers.length === 0 && !isAdding && (
          <p className="text-xs text-gray-400 text-center py-2">
            No speakers identified yet. Use AI detection or add manually.
          </p>
        )}
      </div>
    </div>
  );
}
