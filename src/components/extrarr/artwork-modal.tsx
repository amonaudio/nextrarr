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
 *
 * [0.8.2] MODALE 1 — tre pannelli bordati con scroll indipendente:
 *   - DialogContent alto 95vh, header fisso, corpo a 3 colonne min-h-0
 *   - ogni colonna ha header sticky e lista con overflow-y-auto proprio
 *   - su mobile le colonne si impilano e la modale scorre normalmente
 *   - azioni locali sotto l'immagine (stile eliminazione 2): zoom + Elimina
 *   - Elimina apre un AlertDialog di conferma e chiama la nuova DELETE API
 *   - le img locali hanno ?v=<timestamp> per forzare il re-fetch dopo
 *     upload/sostituzione/eliminazione (cache-busting lato client)
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Download,
  Upload,
  Image as ImageIcon,
  Globe,
  Film,
  X,
  Trash2,
  Maximize2,
  Filter,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ARTWORK_TYPES,
  ARTWORK_TYPE_LABELS,
  getLocalArtworkType,
  normalizeArtworkType,
  type ArtworkType,
} from '@/lib/artwork-types';
import { LocalFolderModal } from '@/components/extrarr/local-folder-modal';
import type { ArtworkItem, MediaItem } from '@/lib/types';

interface ExternalLinks {
  fanart: string;
  tmdb: string;
}

type ArtworkFilter = 'all' | ArtworkType;

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // [0.8.2] Bumped after every local-list mutation. Local <img> URLs include
  // it as ?v=… so the browser cannot keep showing the previous bytes when a
  // file was overwritten (same filename) or deleted and re-uploaded.
  const [localVersion, setLocalVersion] = useState(0);
  // [0.8.0] Drag&drop visual feedback — when the user drags a file over
  // the modal, highlight the modal with a primary-color ring so they
  // know they can drop. Set/unset on dragenter/dragleave.
  const [dragActive, setDragActive] = useState(false);
  // [0.8.3] Global artwork-type filter (F1) — reset to "Tutti" on every
  // open (P1). Zero-count types stay visible but disabled (Z1).
  const [selectedType, setSelectedType] = useState<ArtworkFilter>('all');
  const [externalLinks, setExternalLinks] = useState<ExternalLinks | null>(null);
  const [localFolderOpen, setLocalFolderOpen] = useState(false);

  useEffect(() => {
    if (!open || !media) return;
    // Reset every dialog-local field when a new media is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalFiles([]);
    setFanartItems(null);
    setTmdbItems(null);
    setFanartError(null);
    setTmdbError(null);
    setDeleteTarget(null);
    setSelectedType('all');
    setExternalLinks(null);
    setLocalFolderOpen(false);
    setLocalVersion(Date.now());

    (async () => {
      const [loc, fan, tmdb, links] = await Promise.all([
        fetch(`/api/artwork-files/${mediaType}/${media.id}`, { cache: 'no-store' })
          .then((r) => r.json())
          .catch(() => []),
        fetch(`/api/search-artwork-online/${mediaType}/${media.id}`, { cache: 'no-store' })
          .then((r) => r.json())
          .catch((e) => ({ status: 'error', message: e.message })),
        fetch(`/api/search-tmdb-artwork/${mediaType}/${media.id}`, { cache: 'no-store' })
          .then((r) => r.json())
          .catch((e) => ({ status: 'error', message: e.message })),
        fetch(
          `/api/external-links/${mediaType}/${media.id}?title=${encodeURIComponent(media.title)}`,
          { cache: 'no-store' },
        )
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setLocalFiles(Array.isArray(loc) ? loc : []);
      if (Array.isArray(fan)) setFanartItems(fan);
      else if (fan.status === 'error') setFanartError(fan.message);
      if (Array.isArray(tmdb)) setTmdbItems(tmdb);
      else if (tmdb.status === 'error') setTmdbError(tmdb.message);
      if (links && typeof links.fanart === 'string' && typeof links.tmdb === 'string') {
        setExternalLinks(links);
      }
    })();
  }, [open, media, mediaType]);

  // Refresh the local files list — called after a successful download,
  // upload or delete so the new file appears/disappears immediately.
  const refreshLocalFiles = useCallback(async () => {
    if (!media) return;
    try {
      const fresh = await fetch(`/api/artwork-files/${mediaType}/${media.id}`, { cache: 'no-store' }).then((r) => r.json());
      if (Array.isArray(fresh)) {
        setLocalFiles(fresh);
      }
      setLocalVersion(Date.now());
    } catch {
      // ignore — list will refresh on next modal open
    }
  }, [media, mediaType]);

  // [0.8.3] Counts are global across the three sections, matching the
  // chosen F1 behaviour. Unknown/unmanaged file types still count in
  // "Tutti" but do not belong to any specific category.
  const typeCounts = useMemo(() => {
    const counts = { all: 0 } as Record<ArtworkFilter, number>;
    for (const type of ARTWORK_TYPES) counts[type] = 0;

    for (const filename of localFiles) {
      counts.all += 1;
      const type = getLocalArtworkType(filename);
      if (type) counts[type] += 1;
    }
    for (const item of [...(fanartItems ?? []), ...(tmdbItems ?? [])]) {
      counts.all += 1;
      const type = normalizeArtworkType(item.our_type);
      if (type) counts[type] += 1;
    }
    return counts;
  }, [localFiles, fanartItems, tmdbItems]);

  const visibleLocalFiles = selectedType === 'all'
    ? localFiles
    : localFiles.filter((filename) => getLocalArtworkType(filename) === selectedType);
  const visibleFanartItems = selectedType === 'all'
    ? (fanartItems ?? [])
    : (fanartItems ?? []).filter((item) => normalizeArtworkType(item.our_type) === selectedType);
  const visibleTmdbItems = selectedType === 'all'
    ? (tmdbItems ?? [])
    : (tmdbItems ?? []).filter((item) => normalizeArtworkType(item.our_type) === selectedType);
  const selectedTypeLabel = selectedType === 'all' ? 'Tutti' : ARTWORK_TYPE_LABELS[selectedType];

  function openExternal(kind: 'fanart' | 'tmdb') {
    const title = media?.title ?? '';
    const fallback = kind === 'fanart'
      ? (title ? `https://fanart.tv/?s=${encodeURIComponent(title)}` : 'https://fanart.tv/')
      : (title
        ? `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`
        : 'https://www.themoviedb.org/');
    window.open(externalLinks?.[kind] ?? fallback, '_blank', 'noopener,noreferrer');
  }

  if (!media) return null;

  function localUrl(filename: string): string {
    return `/api/artwork-image/${mediaType}/${media!.id}/${encodeURIComponent(filename)}?v=${localVersion}`;
  }

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

  // [0.8.2] Delete a local artwork file after AlertDialog confirmation.
  async function deleteOne(filename: string) {
    const deleteId = 'delete-' + filename;
    setBusy(deleteId);
    try {
      const res = await fetch(
        `/api/artwork-files/${mediaType}/${media!.id}?filename=${encodeURIComponent(filename)}`,
        { method: 'DELETE', cache: 'no-store' },
      );
      const data = await res.json();
      if (data.status === 'success') {
        // Optimistic removal so the item disappears even before the
        // refresh round-trip completes.
        setLocalFiles((prev) => prev.filter((f) => f !== filename));
        if (zoomedImage?.includes(encodeURIComponent(filename))) setZoomedImage(null);
        setLocalVersion(Date.now());
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
      setDeleteTarget(null);
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

  const deleting = busy?.startsWith('delete-') ?? false;

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
            // [0.8.2] Modale 1: altezza fissa 95vh, header in alto e corpo
            // che riempie lo spazio rimanente. Su desktop il contenuto non
            // scrolla (scrollano le singole liste); su mobile scrolla la
            // modale intera e le liste hanno un max-height.
            'w-[100vw] max-w-[100vw] sm:max-w-[100vw] h-[95vh] max-h-[95vh] overflow-y-auto lg:overflow-hidden',
            'grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-4 sm:p-6',
            dragActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          )}
        >
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Gestione Artwork
              <span className="text-sm text-muted-foreground font-normal truncate">
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

          {/* [0.8.3] F1 — unico filtro globale per tutte e tre le sezioni.
              P1: selectedType torna a "all" nell'effect di apertura.
              Z1: i tipi con 0 elementi restano visibili ma disabilitati. */}
          <div
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2"
            role="group"
            aria-label="Filtra artwork per tipo"
          >
            <Filter className="h-3.5 w-3.5 text-primary mr-1" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Filtra tipo
            </span>
            {(['all', ...ARTWORK_TYPES] as const).map((type) => {
              const count = typeCounts[type];
              const disabled = type !== 'all' && count === 0;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selectedType === type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                    selectedType === type
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                    disabled && 'cursor-not-allowed opacity-40 hover:bg-background/70 hover:text-muted-foreground',
                  )}
                >
                  {type === 'all' ? 'Tutti' : ARTWORK_TYPE_LABELS[type]}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Tre pannelli indipendenti. lg:min-h-0 + overflow-hidden sul
              contenitore permette alle liste interne di avere il proprio
              scroll senza far crescere la modale oltre il 95vh. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:min-h-0 lg:overflow-hidden">

            {/* === Colonna 1: Artwork Locali === */}
            <section className="flex flex-col min-h-0 overflow-hidden rounded-lg border border-border bg-card/40">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setLocalFolderOpen(true)}
                  className="group flex min-w-0 items-center gap-1.5 text-left text-sm font-semibold text-primary hover:text-primary/80"
                  title="Apri la cartella locale del media"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate underline decoration-dotted underline-offset-4">Artwork Locali</span>
                  <span className="text-xs font-normal text-muted-foreground">({localFiles.length})</span>
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
                </button>
                {/* [0.8.0] Pulsante "Carica da PC" — usa <label> con un <input type="file">
                    nascosto (via sr-only), così il pulsante è uno stile standard Button
                    ma attiva comunque il file picker nativo del browser.
                    Accettiamo solo image/jpeg e image/png per matchare il server-side. */}
                <label className="cursor-pointer shrink-0">
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

              <div className="overflow-y-auto p-2 space-y-2 max-h-[48vh] lg:max-h-none lg:flex-1 lg:min-h-0">
                {visibleLocalFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">
                    {localFiles.length === 0
                      ? 'Nessuna immagine locale trovata.'
                      : `Nessun artwork di tipo “${selectedTypeLabel}” nella cartella.`}
                    {localFiles.length === 0 && (
                      <>
                        <br />
                        <span className="text-[10px] opacity-70">
                          Usa il pulsante &quot;Carica da PC&quot; o scarica da Fanart/TMDB.
                        </span>
                      </>
                    )}
                  </p>
                ) : (
                  visibleLocalFiles.map((f) => (
                    <div key={f} className="rounded-md border border-border bg-background overflow-hidden">
                      {/* Stile eliminazione 2: immagine + riga azioni sotto. */}
                      <img
                        src={localUrl(f)}
                        alt={f}
                        className="w-full h-48 object-contain bg-black cursor-zoom-in hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => setZoomedImage(localUrl(f))}
                      />
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-border">
                        <span className="text-[11px] truncate min-w-0" title={f}>{f}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            title="Ingrandisci"
                            aria-label={`Ingrandisci ${f}`}
                            onClick={() => setZoomedImage(localUrl(f))}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            onClick={() => setDeleteTarget(f)}
                            disabled={deleting}
                            title="Elimina artwork"
                          >
                            {busy === 'delete-' + f ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            <span className="text-xs">Elimina</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drag&drop hint — always visible so the user knows they can drop. */}
              <p className="text-[10px] text-muted-foreground text-center px-2 py-1.5 border-t border-border shrink-0">
                <span className="opacity-70">💡 Trascina qui un&apos;immagine per caricarla</span>
              </p>
            </section>

            {/* === Colonna 2: Artwork Online (Fanart.tv) === */}
            <section className="flex flex-col min-h-0 overflow-hidden rounded-lg border border-border bg-card/40">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                <button
                  type="button"
                  onClick={() => openExternal('fanart')}
                  className="group flex min-w-0 items-center gap-1.5 text-left text-sm font-semibold text-primary hover:text-primary/80"
                  title="Apri la pagina Fanart.tv del media"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="truncate underline decoration-dotted underline-offset-4">Online (Fanart.tv)</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({fanartItems?.length ?? 0})
                  </span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-2 max-h-[48vh] lg:max-h-none lg:flex-1 lg:min-h-0">
                {fanartError ? (
                  <p className="text-xs text-destructive py-4 px-2">{fanartError}</p>
                ) : !fanartItems ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">Caricamento...</p>
                ) : visibleFanartItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">
                    {fanartItems.length === 0
                      ? 'Nessuna immagine trovata su Fanart.tv.'
                      : `Nessun artwork di tipo “${selectedTypeLabel}” su Fanart.tv.`}
                  </p>
                ) : (
                  visibleFanartItems.map((a) => (
                    <div key={a.url} className="rounded-md border border-border bg-background overflow-hidden">
                      <img
                        src={a.url}
                        alt={a.our_type}
                        className="w-full h-48 object-contain bg-black cursor-zoom-in hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => setZoomedImage(a.url)}
                      />
                      <div className="px-2 py-1.5 border-t border-border space-y-1.5">
                        <div className="text-[10px] text-center text-muted-foreground">
                          Tipo: {a.our_type} · Lingua: {a.lang} · Likes: {a.likes}
                        </div>
                        <Button size="sm" className="w-full h-7" onClick={() => downloadOne(a)} disabled={busy === a.url}>
                          {busy === a.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          <span className="ml-1 text-xs">Scarica</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* === Colonna 3: Artwork Online (TMDB) === */}
            <section className="flex flex-col min-h-0 overflow-hidden rounded-lg border border-border bg-card/40">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                <button
                  type="button"
                  onClick={() => openExternal('tmdb')}
                  className="group flex min-w-0 items-center gap-1.5 text-left text-sm font-semibold text-primary hover:text-primary/80"
                  title="Apri la pagina TMDB del media"
                >
                  <Film className="h-4 w-4 shrink-0" />
                  <span className="truncate underline decoration-dotted underline-offset-4">Online (TMDB)</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({tmdbItems?.length ?? 0})
                  </span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-2 max-h-[48vh] lg:max-h-none lg:flex-1 lg:min-h-0">
                {tmdbError ? (
                  <p className="text-xs text-destructive py-4 px-2">{tmdbError}</p>
                ) : !tmdbItems ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">Caricamento...</p>
                ) : visibleTmdbItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">
                    {tmdbItems.length === 0
                      ? 'Nessuna immagine trovata su TMDB.'
                      : `Nessun artwork di tipo “${selectedTypeLabel}” su TMDB.`}
                  </p>
                ) : (
                  visibleTmdbItems.map((a) => (
                    <div key={a.url} className="rounded-md border border-border bg-background overflow-hidden">
                      <img
                        src={a.url}
                        alt={a.our_type}
                        className="w-full h-48 object-contain bg-black cursor-zoom-in hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => setZoomedImage(a.url)}
                      />
                      <div className="px-2 py-1.5 border-t border-border space-y-1.5">
                        <div className="text-[10px] text-center text-muted-foreground">
                          Tipo: {a.our_type} · Lingua: {a.lang} · Voto: {a.likes}
                        </div>
                        <Button size="sm" className="w-full h-7" onClick={() => downloadOne(a)} disabled={busy === a.url}>
                          {busy === a.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          <span className="ml-1 text-xs">Scarica</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>
        </DialogContent>
      </Dialog>

      {localFolderOpen && (
        <LocalFolderModal
          open={localFolderOpen}
          onOpenChange={setLocalFolderOpen}
          media={media}
          mediaType={mediaType}
        />
      )}

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

      {/* [0.8.2] Conferma eliminazione artwork locale. Usa AlertDialog per
          rendere l'azione distruttiva esplicita; il file viene rimosso solo
          dopo la conferma (la DELETE API rivalida tutto lato server). */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo artwork?</AlertDialogTitle>
            <AlertDialogDescription>
              Il file <span className="font-mono text-foreground">{deleteTarget}</span> verrà
              eliminato definitivamente dalla cartella del media. Questa operazione non può
              essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                // Prevent Radix from closing immediately: we close only
                // after the DELETE request completes (success or error).
                e.preventDefault();
                if (deleteTarget) void deleteOne(deleteTarget);
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
