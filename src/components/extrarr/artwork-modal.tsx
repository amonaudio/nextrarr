/**
 * ArtworkModal — browse local + Fanart + TMDB artwork for a media.
 * Download specific artwork to the media folder.
 *
 * [0.7.2] Image zoom rewritten as a nested Radix Dialog. Previously it was
 * a custom <div>, which got `inert` from the parent Radix Dialog → its
 * close button (and any click on it) was blocked.
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ArtworkItem, MediaItem } from '@/lib/types';

interface ArtworkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  mediaType: 'radarr' | 'sonarr';
  onChanged: () => void;
}

export function ArtworkModal({ open, onOpenChange, media, mediaType, onChanged }: ArtworkModalProps) {
  const [localFiles, setLocalFiles] = useState<string[]>([]);
  const [fanartItems, setFanartItems] = useState<ArtworkItem[] | null>(null);
  const [tmdbItems, setTmdbItems] = useState<ArtworkItem[] | null>(null);
  const [fanartError, setFanartError] = useState<string | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !media) return;
    setLocalFiles([]);
    setFanartItems(null);
    setTmdbItems(null);
    setFanartError(null);
    setTmdbError(null);

    (async () => {
      const [loc, fan, tmdb] = await Promise.all([
        fetch(`/api/artwork-files/${mediaType}/${media.id}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/search-artwork-online/${mediaType}/${media.id}`)
          .then((r) => r.json())
          .catch((e) => ({ status: 'error', message: e.message })),
        fetch(`/api/search-tmdb-artwork/${mediaType}/${media.id}`)
          .then((r) => r.json())
          .catch((e) => ({ status: 'error', message: e.message })),
      ]);
      setLocalFiles(Array.isArray(loc) ? loc : []);
      if (Array.isArray(fan)) setFanartItems(fan);
      else if (fan.status === 'error') setFanartError(fan.message);
      if (Array.isArray(tmdb)) setTmdbItems(tmdb);
      else if (tmdb.status === 'error') setTmdbError(tmdb.message);
    })();
  }, [open, media, mediaType]);

  if (!media) return null;

  async function downloadOne(item: ArtworkItem) {
    setBusy(item.url);
    try {
      const res = await fetch(`/api/download-specific-artwork/${mediaType}/${media!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url, our_type: item.our_type, ext: item.ext }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        onChanged();
        // [0.7.6] Refresh the "Artwork Locali" list inside this modal so
        // the newly-downloaded file appears immediately. Previously the
        // user had to close and reopen the modal to see the new file —
        // because onChanged() only refreshes the main grid, not the
        // modal's local-files state. We re-fetch /api/artwork-files and
        // also keep the existing local-files state if the fetch fails
        // (don't blow away the UI on a transient network error).
        try {
          const fresh = await fetch(`/api/artwork-files/${mediaType}/${media!.id}`).then((r) => r.json());
          if (Array.isArray(fresh)) {
            setLocalFiles(fresh);
          }
        } catch {
          // ignore — the download itself succeeded, the local-files
          // list will refresh on next modal open.
        }
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          // [0.7.2] Restored unconditional preventDefault: now the zoom is
          // a Radix Dialog too, so Radix handles nested ESC/click-outside
          // natively. We don't want click-outside on the artwork modal to
          // close it while the user is browsing — they should use the X.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Gestione Artwork: {media.title}</DialogTitle>
          </DialogHeader>

          <section className="mb-4">
            <h3 className="text-sm font-semibold text-primary border-b border-border pb-1 mb-2">🖼️ Artwork Locali</h3>
            {localFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessuna immagine locale trovata.</p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {localFiles.map((f) => (
                  <div key={f} className="bg-card border border-border rounded p-1 flex flex-col items-center gap-1">
                    { }
                    <img src={`/api/artwork-image/${mediaType}/${media.id}/${encodeURIComponent(f)}`} alt={f} className="w-full h-20 object-contain bg-black rounded cursor-pointer" loading="lazy" onClick={() => setZoomedImage(`/api/artwork-image/${mediaType}/${media.id}/${encodeURIComponent(f)}`)} />
                    <div className="text-[10px] text-center break-all">{f}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-4">
            <h3 className="text-sm font-semibold text-primary border-b border-border pb-1 mb-2">🌐 Artwork Online (Fanart.tv)</h3>
            {fanartError ? (
              <p className="text-xs text-destructive">{fanartError}</p>
            ) : !fanartItems ? (
              <p className="text-xs text-muted-foreground">Caricamento...</p>
            ) : fanartItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessuna immagine trovata su Fanart.tv.</p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {fanartItems.map((a) => (
                  <div key={a.url} className="bg-card border border-border rounded p-1 flex flex-col items-center gap-1">
                    { }
                    <img src={a.url} alt={a.our_type} className="w-full h-20 object-contain bg-black rounded cursor-pointer" loading="lazy" onClick={() => setZoomedImage(a.url)} />
                    <div className="text-[10px] text-center">
                      Tipo: {a.our_type}<br />Lingua: {a.lang} | Likes: {a.likes}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => downloadOne(a)} disabled={busy === a.url}>
                      {busy === a.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      <span className="ml-1 text-xs">Scarica</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-primary border-b border-border pb-1 mb-2">🎬 Artwork Online (TMDB)</h3>
            {tmdbError ? (
              <p className="text-xs text-destructive">{tmdbError}</p>
            ) : !tmdbItems ? (
              <p className="text-xs text-muted-foreground">Caricamento...</p>
            ) : tmdbItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessuna immagine trovata su TMDB.</p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {tmdbItems.map((a) => (
                  <div key={a.url} className="bg-card border border-border rounded p-1 flex flex-col items-center gap-1">
                    { }
                    <img src={a.url} alt={a.our_type} className="w-full h-20 object-contain bg-black rounded cursor-pointer" loading="lazy" onClick={() => setZoomedImage(a.url)} />
                    <div className="text-[10px] text-center">
                      Tipo: {a.our_type}<br />Lingua: {a.lang} | Voto: {a.likes}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => downloadOne(a)} disabled={busy === a.url}>
                      {busy === a.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      <span className="ml-1 text-xs">Scarica</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>

      {/* [0.7.2] Image zoom — now a Radix Dialog, so it stacks correctly
          above the parent ArtworkModal and is not affected by `inert`.
          Click-outside and ESC close the zoom first (Radix handles this
          natively for nested Dialogs). */}
      <Dialog open={!!zoomedImage} onOpenChange={(o) => { if (!o) setZoomedImage(null); }}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] bg-black/95 border-none p-0 gap-0 shadow-none"
          // Click-outside closes the zoom (which is what users expect for
          // a fullscreen image viewer).
        >
          <DialogTitle className="sr-only">Anteprima artwork</DialogTitle>
          <DialogDescription className="sr-only">
            Immagine artwork ingrandita. Premi ESC o clicca fuori per chiudere.
          </DialogDescription>
          <button
            className="absolute top-4 right-4 text-white text-3xl z-10 hover:text-primary transition-colors"
            onClick={() => setZoomedImage(null)}
            aria-label="Chiudi zoom"
          >
            <X />
          </button>
          {zoomedImage && (
            <img
              src={zoomedImage}
              alt="Artwork zoom"
              className="max-w-[95vw] max-h-[95vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
