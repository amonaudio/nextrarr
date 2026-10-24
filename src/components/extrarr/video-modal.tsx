/**
 * VideoModal — YouTube embed preview with action buttons (depends on context).
 *
 * [0.7.2] REWRITE: previously a custom <div> overlay. Radix Dialog sets
 * `inert` on all DOM siblings when a modal is open — that included this
 * custom overlay, which made all its buttons unclickable whenever it was
 * opened above another Radix Dialog (EditorModal, ArtworkModal).
 *
 * By rendering the VideoModal as a Radix Dialog itself, Radix recognizes
 * it as a nested modal and skips the `inert` attribute. ESC, focus trap,
 * and z-index are now handled natively by Radix.
 *
 * v0.6.2 retained:
 * - `loading` state on action buttons so the user sees a spinner
 *   while the API call is in flight (prevents double-click → "skip" bug)
 */

'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type VideoModalAction =
  | { kind: 'editor_theme'; onUse: (url: string) => Promise<void> }
  | { kind: 'editor_trailer'; onUse: (url: string) => Promise<void> }
  | { kind: 'card'; mediaId: number; onUse: (id: number, url: string) => Promise<void> }
  | {
      kind: 'global';
      mediaChoices: { id: number; title: string; year: string | number }[];
      onTheme: (id: number, url: string) => Promise<void>;
      onTrailer: (id: number, url: string) => Promise<void>;
    };

interface VideoModalProps {
  open: boolean;
  videoId: string | null;
  videoUrl: string;
  action: VideoModalAction | null;
  onClose: () => void;
}

function GlobalActionPicker({
  choices, videoUrl, onTheme, onTrailer,
}: {
  choices: { id: number; title: string; year: string | number }[];
  videoUrl: string;
  onTheme: (id: number, url: string) => Promise<void>;
  onTrailer: (id: number, url: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState<'theme' | 'trailer' | null>(null);

  async function handleAction(type: 'theme' | 'trailer') {
    if (!selectedId || loading) return;
    setLoading(type);
    try {
      const id = parseInt(selectedId, 10);
      if (type === 'theme') await onTheme(id, videoUrl);
      else await onTrailer(id, videoUrl);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="w-2/3 mx-auto"><SelectValue placeholder="-- Seleziona un film --" /></SelectTrigger>
        <SelectContent>
          {choices.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>{m.title} ({m.year})</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2 justify-center">
        <Button disabled={!selectedId || loading !== null} onClick={() => handleAction('theme')} className="bg-green-600 hover:bg-green-700 text-white">
          {loading === 'theme' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span className="ml-1">⬇️ Scarica come Tema</span>
        </Button>
        <Button disabled={!selectedId || loading !== null} onClick={() => handleAction('trailer')} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading === 'trailer' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span className="ml-1">🎬 Usa come Trailer</span>
        </Button>
      </div>
    </div>
  );
}

export function VideoModal({ open, videoId, videoUrl, action, onClose }: VideoModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleAction() {
    if (!action || loading) return;
    setLoading(true);
    try {
      if (action.kind === 'editor_theme' || action.kind === 'editor_trailer') {
        await action.onUse(videoUrl);
      } else if (action.kind === 'card') {
        await action.onUse(action.mediaId, videoUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        // [0.7.2] Override shadcn defaults: black background, primary border,
        // no gap (we manage spacing ourselves), full max width for the video.
        className="max-w-3xl bg-black border-primary p-3 gap-0"
        // Block outside-click: this modal is opened from within another modal
        // (Editor/Artwork). Closing on outside-click would close BOTH and
        // leave the user disoriented. Force them to use the X or pick an action.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Radix requires DialogTitle for accessibility. Visually hidden. */}
        <DialogTitle className="sr-only">Anteprima YouTube</DialogTitle>
        <DialogDescription className="sr-only">
          Anteprima del video YouTube selezionato. Usa i pulsanti in basso per scaricarlo come tema o trailer.
        </DialogDescription>

        <div className="flex justify-end mb-1">
          <button onClick={onClose} className="text-white text-2xl leading-none" aria-label="Chiudi"><X /></button>
        </div>
        <div className="aspect-video bg-black">
          {videoId && (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              frameBorder={0}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="YouTube preview"
            />
          )}
        </div>
        <div className="mt-2 bg-zinc-900 border-t border-zinc-800 p-3 text-center">
          {(action?.kind === 'editor_theme' || action?.kind === 'editor_trailer' || action?.kind === 'card') && (
            <Button onClick={handleAction} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">
                {action?.kind === 'editor_theme' && '⬇️ Usa come Tema Musicale'}
                {action?.kind === 'editor_trailer' && '⬇️ Usa come Trailer'}
                {action?.kind === 'card' && '⬇️ Scarica questo Tema'}
              </span>
            </Button>
          )}
          {action?.kind === 'global' && (
            <GlobalActionPicker choices={action.mediaChoices} videoUrl={videoUrl} onTheme={action.onTheme} onTrailer={action.onTrailer} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
