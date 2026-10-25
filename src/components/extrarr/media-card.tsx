/**
 * MediaCard — single card in the grid. Shows poster + status icons.
 * Uses textContent for all dynamic strings to prevent XSS.
 *
 * [0.7.10] Added shadcn Tooltip to all icon overlays for discoverability.
 *
 * [0.7.12] Robust poster fallback chain for titles with special chars
 * (WALL•E, ?, !, accented letters, etc.):
 *   1. Try the assigned `media.poster` (could be a local /api/artwork-image
 *      URL OR a remote Radarr TMDB URL).
 *   2. If that fails to load (onError), instead of immediately showing
 *      the gray "N/A" fallback, try ONE alternate source if we have one.
 *      Specifically: if the assigned poster is a LOCAL /api/artwork-image
 *      URL (because a local poster file was found at scan time, but the
 *      file may have been deleted or has a special-char filename that
 *      triggers a 404 → /api/artwork-image now returns a 1x1 transparent
 *      PNG so the <img> load "succeeds" but the image is blank), we
 *      swap to a data-attr `data-remote-poster` (the Radarr TMDB URL)
 *      on the first error and only fall back to the gray N/A on a second
 *      error.
 *   3. This means a card with title "Ma papà ti manda sola?" whose
 *      local poster file exists but the local serving route fails will
 *      still show the Radarr remote poster, instead of N/A.
 *
 * Implementation: useState for the currently-displayed src + a flag for
 * whether we've already tried the fallback. onError handler:
 *   - if we haven't tried remote yet AND we have a remote URL → switch.
 *   - else → switch to gray N/A fallback.
 */

'use client';

import { useMemo, useState } from 'react';
import { Settings2, Check, Download, Music, Eye, Film, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';

interface MediaCardProps {
  media: MediaItem;
  onQuickDownload: (id: number, btn: HTMLButtonElement | null) => void;
  onDownloadArtwork: (id: number, btn: HTMLButtonElement | null) => void;
  onPlayTheme: (id: number, title: string) => void;
  onViewArtwork: (id: number, title: string) => void;
  onPlayTrailer: (id: number, title: string) => void;
  onOpenEditor: (id: number) => void;
  onShowWarning: (msg: string) => void;
}

export function MediaCard({
  media,
  onQuickDownload,
  onDownloadArtwork,
  onPlayTheme,
  onViewArtwork,
  onPlayTrailer,
  onOpenEditor,
  onShowWarning,
}: MediaCardProps) {
  const fallbackSrc = useMemo(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 225'><rect width='100%' height='100%' fill='%232b2b2b'/><text x='75' y='120' fill='%23ff8c1f' font-family='sans-serif' font-size='14' text-anchor='middle'>N/A</text></svg>`;
    return `data:image/svg+xml;utf8,${svg}`;
  }, []);

  // [0.7.12] Detect if media.poster is a LOCAL route (/api/artwork-image/...)
  // — if so, we have a `remote_poster` fallback we can try when the local
  // route returns a 1x1 transparent PNG (file missing/fails).
  const isLocalPoster = media.poster.startsWith('/api/artwork-image/');
  const remotePoster = media.remote_poster ?? '';
  // State machine:
  //   - 'local'  → currently showing local poster (initial state).
  //   - 'remote' → tried local, swapped to remote (on 1x1 detection OR onError).
  //   - 'na'     → both failed, showing gray N/A fallback.
  const [posterState, setPosterState] = useState<'local' | 'remote' | 'na'>(
    isLocalPoster ? 'local' : (remotePoster ? 'remote' : 'na')
  );

  function handleImgError() {
    // Real load failure (network error, 4xx, 5xx that returned HTML, etc.)
    setPosterState((prev) => {
      if (prev === 'local' && remotePoster) return 'remote';
      return 'na';
    });
  }

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    // [0.7.12] Detect the 1x1 transparent PNG that /api/artwork-image
    // returns when a local file is missing/fails (special chars in
    // filename, file deleted, traversal blocked, etc.).
    if (posterState !== 'local') return;
    const img = e.currentTarget;
    if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
      // The /api/artwork-image route returned its transparent fallback.
      // Swap to the remote Radarr poster if we have one.
      if (remotePoster) {
        setPosterState('remote');
      } else {
        setPosterState('na');
      }
    }
  }

  const currentSrc =
    posterState === 'na' ? fallbackSrc :
    posterState === 'remote' ? (remotePoster || fallbackSrc) :
    (media.poster || fallbackSrc);  // 'local'

  const warning = !media.is_mapped
    ? { kind: 'unmapped' as const, msg: `Attenzione: Percorso non mappato! Vai su ⚙️ Impostazioni. Percorso: ${media.local_path}` }
    : !media.folder_exists
      ? { kind: 'nofolder' as const, msg: `Errore: La cartella non esiste sul disco! Percorso calcolato: ${media.local_path}` }
      : null;

  return (
    <TooltipProvider delayDuration={300}>
    <Card
      id={`card-${media.id}`}
      data-title={media.title}
      className="relative overflow-hidden group hover:scale-105 transition-transform flex flex-col"
    >
      {/* === Poster (with top-row icon overlays only) === */}
      <div className="relative">
        <img
          src={currentSrc}
          alt={media.title}
          loading="lazy"
          className="w-full aspect-[2/3] object-cover"
          onError={handleImgError}
          onLoad={handleImgLoad}
          // [0.7.12] Tag the img with current poster state — useful for
          // debugging via DevTools (e.g. "why am I seeing N/A for WALL•E?").
          data-poster-state={posterState}
          data-is-local-poster={isLocalPoster ? 'true' : 'false'}
        />

        {/* Top icons with tooltips */}
        {warning ? (
          <div className="absolute top-1 left-1 bg-black/70 rounded p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle
                  className="h-4 w-4 text-yellow-500 cursor-pointer"
                  onClick={() => onShowWarning(warning.msg)}
                />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {warning.kind === 'unmapped' ? 'Percorso non mappato — clicca per dettagli' : 'Cartella inesistente — clicca per dettagli'}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            <div className="absolute top-1 left-1 bg-black/70 rounded p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Settings2
                    className="h-4 w-4 text-foreground cursor-pointer"
                    onClick={() => onOpenEditor(media.id)}
                  />
                </TooltipTrigger>
                <TooltipContent>Apri editor (tema, trailer, NFO)</TooltipContent>
              </Tooltip>
            </div>
            <div className="absolute top-1 right-1 bg-black/70 rounded p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  {media.has_theme ? (
                    <Check
                      className="h-4 w-4 text-green-500 cursor-pointer"
                      onClick={(e) => onQuickDownload(media.id, e.currentTarget as unknown as HTMLButtonElement)}
                    />
                  ) : (
                    <Download
                      className="h-4 w-4 text-primary cursor-pointer"
                      onClick={(e) => onQuickDownload(media.id, e.currentTarget as unknown as HTMLButtonElement)}
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {media.has_theme ? 'Tema presente — clicca per riscaricare' : 'Scarica tema musicale'}
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {/* === Footer: title/year + action icons (NO overlap) === */}
      <div className="p-2 flex flex-col gap-1 bg-card">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate leading-tight" title={media.title}>{media.title}</div>
            <div className="text-xs opacity-70">{media.year}</div>
          </div>
        </div>
        {!warning && (
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-border">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Music
                    className={cn('h-4 w-4 cursor-pointer', media.has_theme ? 'text-primary' : 'text-muted-foreground opacity-40 pointer-events-none')}
                    onClick={() => onPlayTheme(media.id, media.title)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {media.has_theme ? 'Riproduci tema musicale' : 'Tema non presente'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Eye
                    className="h-4 w-4 text-foreground cursor-pointer"
                    onClick={() => onViewArtwork(media.id, media.title)}
                  />
                </TooltipTrigger>
                <TooltipContent>Vedi e scarica artwork</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Film
                    className={cn('h-4 w-4 cursor-pointer', media.has_trailer ? 'text-primary' : 'text-muted-foreground opacity-40 pointer-events-none')}
                    onClick={() => onPlayTrailer(media.id, media.title)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {media.has_trailer ? 'Riproduci trailer' : 'Trailer non presente'}
                </TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <ImageIcon
                  className="h-4 w-4 text-foreground cursor-pointer hover:text-primary"
                  onClick={(e) => onDownloadArtwork(media.id, e.currentTarget as unknown as HTMLButtonElement)}
                />
              </TooltipTrigger>
              <TooltipContent>Scarica artwork (batch da Fanart.tv)</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </Card>
    </TooltipProvider>
  );
}
