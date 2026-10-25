/**
 * ArtworkModal — browse local + Fanart + TMDB artwork for a media.
 * Download specific artwork to the media folder, OR upload a custom one
 * from the user's PC.
 *
 * [0.7.2] Image zoom rewritten as a nested Radix Dialog. Previously it was
 * a custom <div>, which got `inert` from the parent Radix Dialog → its
 * close button (and any click on it) was blocked.
 *
 * [0.8.0] REDESIGN — see mockup-v0.8.0.html:
 *   - max-w-3xl → max-w-6xl (use more of the available screen real estate)
 *   - 3 sections stacked vertically → 3 columns side-by-side on desktop
 *     (lg:grid-cols-3) so all artwork kinds are visible without scrolling
 *   - h-20 (80px) thumbnails → h-48 (200px) for actual visibility
 *   - 🖼️ emoji → ImageIcon from lucide-react (consistency with the rest
 *     of the app)
 *   - NEW: "Carica da PC" button + drag&drop handler. Lets the user
 *     upload a custom artwork file from their browser, which gets
 *     saved to the media folder with a sanitized filename.
 *
 * [0.8.1] LAYOUT — modale a tutta larghezza (100vw), thumbnail su 1 colonna
 *   per sezione con altezza h-64 (256px), scroll unico per tutta la modale.
 *   Attenzione: il DialogContent di base applica sm:max-w-lg (512px), quindi
 *   la larghezza va sovrascritta anche sul breakpoint sm.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Upload, Image as ImageIcon, Globe, Film, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  // [0.8.0] Drag&drop visual feedback — when the user drags a file over
  // the modal, highlight the modal with a primary-color ring so they
  // know they can drop. Set/unset on dragenter/dragleave.
  const [dragActive, setDragActive] = useState(false);

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

  // Refresh the local files list — called after a successful download
  // or upload so the new file appears immediately in the modal.
  const refreshLocalFiles = useCallback(async () => {
    if (!media) return;
    try {
      const fresh = await fetch(`/api/artwork-files/${mediaType}/${media.id}`).then((r) => r.json());
      if (Array.isArray(fresh)) {
        setLocalFiles(fresh);
      }
    } catch {
      // ignore — list will refresh on next modal open
    }
  }, [media, mediaType]);

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
        await refreshLocalFiles();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      setBusy(null);
    }
  }

  // [0.8.0] Upload an arbitrary image file (JPG/PNG, max 10MB) to the
  // media folder. The server-side route validates:
  //   - magic bytes (must be JPEG or PNG — extension is not trusted)
  //   - file size (≤10 MB)
  //   - filename sanitization (no path traversal possible)
  //   - resolved path stays under localPath (defense-in-depth)
  // The uploaded file overwrites any existing artwork with the same
  // filename (default behavior per Q3 — "Sovrascrivi").
  async function uploadOne(file: File) {
    // Client-side pre-flight: check extension and size before sending
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      toast.error('Formato non supportato. Solo JPG e PNG sono accettati.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`File troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Massimo 10 MB.`);
      return;
    }
    const uploadId = 'upload-' + file.name;
    setBusy(uploadId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Optionally the user can specify a target filename via the file
      // picker. By default we use the uploaded file's name (sanitized
      // server-side).
      const res = await fetch(`/api/upload-artwork/${mediaType}/${media!.id}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        onChanged();
        await refreshLocalFiles();
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('Errore di rete: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(null);
    }
  }

  // Drag&drop handlers (attached to DialogContent). preventDefault on
  // dragover is REQUIRED to allow the drop event to fire (per the HTML5
  // drag&drop spec). Without it, the browser would treat the drop as a
  // "open this file in the current tab" navigation.
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!dragActive) setDragActive(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    // Only clear the active state when the mouse leaves the modal
    // entirely (not when it crosses into a child element). Without
    // this check, the highlight would flicker as the mouse moves
    // between children.
    if (e.currentTarget === e.target) {
      setDragActive(false);
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void uploadOne(files[0]);
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
          // [0.8.0] Also handles drag&drop — preventDefault on pointer
          // down outside prevents accidental close while dragging a file
          // onto the modal.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            // Larghezza pari a tutta la viewport. `sm:max-w-[100vw]` è
            // necessario perché DialogContent di base applica
            // `sm:max-w-lg` (512px), che altrimenti vincerebbe sui
            // breakpoint desktop. Lo scroll è unico per tutta la modale.
            'w-[100vw] max-w-[100vw] sm:max-w-[100vw] max-h-[95vh] overflow-y-auto',
            // Visual feedback when the user is dragging a file over the modal
            dragActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Gestione Artwork
              <span className="text-sm text-muted-foreground font-normal">
                {media.title}
                {typeof media.year === 'number' && media.year !== 0 ? ` (${media.year})` : ''}
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Modale di gestione artwork per {media.title}. Qui puoi vedere gli artwork locali,
              scaricarne di nuovi da Fanart.tv e TMDB, o caricarne uno dal tuo PC. Trascina
              un&apos;immagine nella modale o usa il pulsante &quot;Carica da PC&quot;.
            </DialogDescription>
          </DialogHeader>

          {/* 3 colonne su desktop (lg+), impilate su schermi piccoli.
              Ogni sezione mostra le thumbnail su 1 colonna. Lo scroll è
              unico per tutta la modale (max-h-[95vh] sul DialogContent). */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* === Colonna 1: Artwork Locali === */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4" />
                  Artwork Locali
                </h3>
                {/* [0.8.0] Pulsante "Carica da PC" — usa <label> con un <input type="file">
                    nascosto (via sr-only), così il pulsante è uno stile standard Button
                    ma attiva comunque il file picker nativo del browser.
                    Accettiamo solo image/jpeg e image/png per matchare il server-side. */}
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-2 py-1 rounded transition-colors">
                    {busy?.startsWith('upload-') ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Carica da PC
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await uploadOne(file);
                      }
                      // Reset the input value so the same file can be uploaded
                      // again later (otherwise the change event won't fire on
                      // re-selection of the same file).
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {localFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Nessuna immagine locale trovata.
                  <br />
                  <span className="text-[10px] opacity-70">
                    Usa il pulsante &quot;Carica da PC&quot; o scarica da Fanart/TMDB.
                  </span>
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {localFiles.map((f) => (
                    <div key={f} className="bg-card border border-border rounded p-1 flex flex-col items-center gap-1">
                      {/* [0.8.1] h-96 (384px) → h-64 (256px): con una
                          thumbnail per riga a tutta larghezza l'altezza
                          precedente rendeva la modale troppo alta. */}
                      <img
                        src={`/api/artwork-image/${mediaType}/${media.id}/${encodeURIComponent(f)}`}
                        alt={f}
                        className="w-full h-64 object-contain bg-black rounded cursor-pointer hover:opacity-80 transition-opacity"
                        loading="lazy"
                        onClick={() => setZoomedImage(`/api/artwork-image/${mediaType}/${media.id}/${encodeURIComponent(f)}`)}
                      />
                      <div className="text-[10px] text-center break-all">{f}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Drag&drop hint — visible only when localFiles is empty (so the
                  user knows they can drop) but always available. */}
              <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
                <span className="opacity-70">💡 Trascina qui un&apos;immagine per caricarla</span>
              </p>
            </section>

            {/* === Colonna 2: Artwork Online (Fanart.tv) === */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5 pb-2 border-b border-border">
                <Globe className="h-4 w-4" />
                Online (Fanart.tv)
              </h3>
              {fanartError ? (
                <p className="text-xs text-destructive py-4">{fanartError}</p>
              ) : !fanartItems ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Caricamento...</p>
              ) : fanartItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Nessuna immagine trovata su Fanart.tv.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {fanartItems.map((a) => (
                    <div key={a.url} className="bg-card border border-border rounded p-1 flex flex-col items-center gap-1">
                      <img
                        src={a.url}
                        alt={a.our_type}
                        className="w-full h-64 object-contain bg-black rounded cursor-pointer hover:opacity-80 transition-opacity"
                        loading="lazy"
                        onClick={() => setZoomedImage(a.url)}
                      />
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

            {/* === Colonna 3: Artwork Online (TMDB) === */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5 pb-2 border-b border-border">
                <Film className="h-4 w-4" />
                Online (TMDB)
              </h3>
              {tmdbError ? (
                <p className="text-xs text-destructive py-4">{tmdbError}</p>
              ) : !tmdbItems ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Caricamento...</p>
              ) : tmdbItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Nessuna immagine trovata su TMDB.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tmdbItems.map((a) => (
                    <div key={a.url} className="bg-card border border-border rounded p-1 flex flex-col items-center gap-1">
                      <img
                        src={a.url}
                        alt={a.our_type}
                        className="w-full h-64 object-contain bg-black rounded cursor-pointer hover:opacity-80 transition-opacity"
                        loading="lazy"
                        onClick={() => setZoomedImage(a.url)}
                      />
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

          </div>
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
