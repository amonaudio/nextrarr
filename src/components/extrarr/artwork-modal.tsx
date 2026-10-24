/**
 * ArtworkModal — browse local + Fanart + TMDB artwork for a media.
 * Download specific artwork to the media folder.
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

      {/* Image zoom overlay — click to open fullscreen within modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl z-10"
            onClick={() => setZoomedImage(null)}
            aria-label="Chiudi zoom"
          >
            <X />
          </button>
          <img
            src={zoomedImage}
            alt="Artwork zoom"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </Dialog>
  );
}
