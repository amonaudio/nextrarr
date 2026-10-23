/**
 * VideoModal — YouTube embed preview with action buttons (depends on context).
 */

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type VideoModalAction =
  | { kind: 'editor_theme'; onUse: (url: string) => void }
  | { kind: 'editor_trailer'; onUse: (url: string) => void }
  | { kind: 'card'; mediaId: number; onUse: (id: number, url: string) => void }
  | {
      kind: 'global';
      mediaChoices: { id: number; title: string; year: string | number }[];
      onTheme: (id: number, url: string) => void;
      onTrailer: (id: number, url: string) => void;
    };

interface VideoModalProps {
  open: boolean;
  videoId: string | null;
  videoUrl: string;
  action: VideoModalAction | null;
  onClose: () => void;
}

/**
 * Internal: the "global" search action requires a media selector + state.
 * Lives in its own component so the parent doesn't need useEffect.
 */
function GlobalActionPicker({
  choices,
  videoUrl,
  onTheme,
  onTrailer,
}: {
  choices: { id: number; title: string; year: string | number }[];
  videoUrl: string;
  onTheme: (id: number, url: string) => void;
  onTrailer: (id: number, url: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>('');
  return (
    <div className="space-y-2">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="w-2/3 mx-auto">
          <SelectValue placeholder="-- Seleziona un film --" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.title} ({m.year})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2 justify-center">
        <Button
          disabled={!selectedId}
          onClick={() => onTheme(parseInt(selectedId, 10), videoUrl)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          ⬇️ Scarica come Tema
        </Button>
        <Button
          disabled={!selectedId}
          onClick={() => onTrailer(parseInt(selectedId, 10), videoUrl)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          🎬 Usa come Trailer
        </Button>
      </div>
    </div>
  );
}

export function VideoModal({ open, videoId, videoUrl, action, onClose }: VideoModalProps) {
  if (!open || !videoId) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-black border border-primary rounded-lg max-w-3xl w-full p-3">
        <div className="flex justify-end mb-1">
          <button onClick={onClose} className="text-white text-2xl leading-none" aria-label="Chiudi">
            <X />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            frameBorder={0}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="YouTube preview"
          />
        </div>
        <div className="mt-2 bg-zinc-900 border-t border-zinc-800 p-3 text-center">
          {action?.kind === 'editor_theme' && (
            <Button
              onClick={() => action.onUse(videoUrl)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              ⬇️ Usa come Tema Musicale
            </Button>
          )}
          {action?.kind === 'editor_trailer' && (
            <Button
              onClick={() => action.onUse(videoUrl)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              ⬇️ Usa come Trailer
            </Button>
          )}
          {action?.kind === 'card' && (
            <Button
              onClick={() => action.onUse(action.mediaId, videoUrl)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              ⬇️ Scarica questo Tema
            </Button>
          )}
          {action?.kind === 'global' && (
            <GlobalActionPicker
              choices={action.mediaChoices}
              videoUrl={videoUrl}
              onTheme={action.onTheme}
              onTrailer={action.onTrailer}
            />
          )}
        </div>
      </div>
    </div>
  );
}
