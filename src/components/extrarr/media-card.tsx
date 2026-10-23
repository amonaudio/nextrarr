/**
 * MediaCard — single card in the grid. Shows poster + status icons.
 * Uses textContent for all dynamic strings to prevent XSS.
 */

'use client';

import { useMemo } from 'react';
import { Settings2, Check, Download, Music, Eye, Film, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
    <Card
      id={`card-${media.id}`}
      data-title={media.title}
      className="relative overflow-hidden group hover:scale-105 transition-transform"
    >
      {/* Poster */}
      { }
      <img
        src={media.poster || fallbackSrc}
        alt={media.title}
        loading="lazy"
        className="w-full aspect-[2/3] object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackSrc; }}
      />

      {/* Icon overlays */}
      {warning ? (
        <div className="absolute top-1 left-1 bg-black/60 rounded p-0.5">
          <AlertTriangle
            className="h-5 w-5 text-yellow-500 cursor-pointer"
            onClick={() => onShowWarning(warning.msg)}
          />
        </div>
      ) : (
        <>
          <div className="absolute top-1 left-1 bg-black/60 rounded p-0.5">
            <Settings2
              className="h-5 w-5 text-foreground cursor-pointer"
              onClick={() => onOpenEditor(media.id)}
            />
          </div>
          <div className="absolute top-1 right-1 bg-black/60 rounded p-0.5">
            {media.has_theme ? (
              <Check
                className="h-5 w-5 text-green-500 cursor-pointer"
                onClick={(e) => onQuickDownload(media.id, e.currentTarget)}
              />
            ) : (
              <Download
                className="h-5 w-5 text-primary cursor-pointer"
                onClick={(e) => onQuickDownload(media.id, e.currentTarget)}
              />
            )}
          </div>
          <div className="absolute bottom-12 left-1 bg-black/60 rounded p-0.5 flex gap-1">
            <Music
              className={cn('h-5 w-5 text-foreground cursor-pointer', !media.has_theme && 'opacity-30 pointer-events-none')}
              onClick={() => onPlayTheme(media.id, media.title)}
            />
            <Eye
              className="h-5 w-5 text-foreground cursor-pointer"
              onClick={() => onViewArtwork(media.id, media.title)}
            />
            <Film
              className={cn('h-5 w-5 text-foreground cursor-pointer', !media.has_trailer && 'opacity-30 pointer-events-none')}
              onClick={() => onPlayTrailer(media.id, media.title)}
            />
          </div>
          <div className="absolute bottom-12 right-1 bg-black/60 rounded p-0.5">
            <ImageIcon
              className="h-5 w-5 text-foreground cursor-pointer"
              onClick={(e) => onDownloadArtwork(media.id, e.currentTarget)}
            />
          </div>
        </>
      )}

      {/* Card body */}
      <div className="p-2">
        <div className="text-sm font-bold truncate" title={media.title}>{media.title}</div>
        <div className="text-xs opacity-70">{media.year}</div>
      </div>
    </Card>
  );
}
