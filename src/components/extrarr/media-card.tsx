/**
 * MediaCard — single card in the grid. Shows poster + status icons.
 * Uses textContent for all dynamic strings to prevent XSS.
 *
 * [0.7.10] Added shadcn Tooltip to all icon overlays for discoverability.
 */

'use client';

import { useMemo } from 'react';
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
          src={media.poster || fallbackSrc}
          alt={media.title}
          loading="lazy"
          className="w-full aspect-[2/3] object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackSrc; }}
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
