'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  Film,
  Image as ImageIcon,
  Music,
  Settings2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  resolutionBadgeClasses,
  videoCodecBadgeClasses,
  audioChannelsBadgeClasses,
} from '@/lib/media-info';
import { isRecentlyAdded, needsMediaAction } from '@/lib/media-badge';
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
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 225'><rect width='100%' height='100%' fill='%232b2b2b'/><text x='75' y='120' fill='%23ff8a4c' font-family='sans-serif' font-size='14' text-anchor='middle'>N/A</text></svg>`;
    return `data:image/svg+xml;utf8,${svg}`;
  }, []);

  const isLocalPoster = media.poster.startsWith('/api/artwork-image/');
  const remotePoster = media.remote_poster ?? '';
  const defaultPosterState: 'local' | 'remote' | 'na' =
    isLocalPoster ? 'local' : (remotePoster ? 'remote' : 'na');
  const posterIdentity = `${media.poster}\u0000${remotePoster}`;
  const [posterFailure, setPosterFailure] = useState<{ key: string; state: 'remote' | 'na' } | null>(null);
  const posterState =
    posterFailure?.key === posterIdentity ? posterFailure.state : defaultPosterState;

  function handleImgError() {
    const current = posterFailure?.key === posterIdentity ? posterFailure.state : defaultPosterState;
    setPosterFailure({
      key: posterIdentity,
      state: current === 'local' && remotePoster ? 'remote' : 'na',
    });
  }

  function handleImgLoad(event: SyntheticEvent<HTMLImageElement>) {
    if (posterState !== 'local') return;
    const img = event.currentTarget;
    if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
      setPosterFailure({ key: posterIdentity, state: remotePoster ? 'remote' : 'na' });
    }
  }

  const currentSrc =
    posterState === 'na' ? fallbackSrc :
    posterState === 'remote' ? (remotePoster || fallbackSrc) :
    (media.poster || fallbackSrc);

  const warning = !media.is_mapped
    ? { kind: 'unmapped' as const, msg: `Attenzione: Percorso non mappato! Vai su Impostazioni. Percorso: ${media.local_path}` }
    : !media.folder_exists
      ? { kind: 'nofolder' as const, msg: `Errore: La cartella non esiste sul disco! Percorso calcolato: ${media.local_path}` }
      : null;

  const showNewBadge = isRecentlyAdded(media.date_added) && needsMediaAction(media);
  const complete = [media.has_theme, media.has_artwork, media.has_trailer].filter(Boolean).length;
  const rootName = media.root_folder.split('/').filter(Boolean).pop() ?? media.root_folder;

  return (
    <div
      id={`card-${media.id}`}
      data-title={media.title}
      className={cn('lib-card group', warning && 'is-invalid')}
    >
      <div className="lib-poster">
        <img
          src={currentSrc}
          alt={media.title}
          loading="lazy"
          onError={handleImgError}
          onLoad={handleImgLoad}
          data-poster-state={posterState}
          data-is-local-poster={isLocalPoster ? 'true' : 'false'}
        />

        <div className="card-top">
          {showNewBadge ? (
            <span className="card-new">
              <i />
              NEW
            </span>
          ) : (
            <span />
          )}

          {warning ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="card-action"
                  onClick={() => onShowWarning(warning.msg)}
                  aria-label="Mostra dettagli percorso non valido"
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {warning.kind === 'unmapped'
                  ? 'Percorso non mappato — clicca per dettagli'
                  : 'Cartella inesistente — clicca per dettagli'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="card-action"
                    onClick={() => onOpenEditor(media.id)}
                    aria-label="Apri editor"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Apri editor (tema, trailer, NFO)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn('card-action', media.has_theme ? 'ok' : 'missing')}
                    onClick={(event) => onQuickDownload(media.id, event.currentTarget)}
                    aria-label={media.has_theme ? 'Riscarica tema' : 'Scarica tema'}
                  >
                    {media.has_theme ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {media.has_theme ? 'Tema presente — clicca per riscaricare' : 'Scarica tema musicale'}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {warning ? (
          <button type="button" className="card-warning" onClick={() => onShowWarning(warning.msg)}>
            <AlertTriangle />
            <span>{warning.kind === 'unmapped' ? 'Percorso non mappato' : 'Cartella non accessibile'}</span>
          </button>
        ) : (
          <>
            {(media.resolution || media.video_codec || media.audio_channels) && (
              <div className="card-quality">
                {media.resolution && (
                  <span className={resolutionBadgeClasses(media.resolution)}>{media.resolution}</span>
                )}
                {media.video_codec && (
                  <span className={videoCodecBadgeClasses(media.video_codec)}>{media.video_codec}</span>
                )}
                {media.audio_channels && (
                  <span className={audioChannelsBadgeClasses(media.audio_channels)}>{media.audio_channels}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card-footer">
        <div className="card-title" title={media.title}>{media.title}</div>
        <div className="card-meta">
          <span>{media.year}</span>
          <span className="middot">·</span>
          <span>{rootName}</span>
        </div>

        {!warning && (
          <div className="card-status-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn('status-btn', media.has_theme ? 'ok' : 'missing')}
                  onClick={() => onPlayTheme(media.id, media.title)}
                  disabled={!media.has_theme}
                  aria-label="Riproduci tema"
                >
                  <Music className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {media.has_theme ? 'Riproduci tema musicale' : 'Tema non presente'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn('status-btn', media.has_artwork ? 'ok' : 'missing')}
                  onClick={() => onViewArtwork(media.id, media.title)}
                  aria-label="Vedi artwork"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Vedi e scarica artwork</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn('status-btn', media.has_trailer ? 'ok' : 'missing')}
                  onClick={() => onPlayTrailer(media.id, media.title)}
                  disabled={!media.has_trailer}
                  aria-label="Riproduci trailer"
                >
                  <Film className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {media.has_trailer ? 'Riproduci trailer' : 'Trailer non presente'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="status-btn"
                  onClick={(event) => onDownloadArtwork(media.id, event.currentTarget)}
                  aria-label="Scarica artwork"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Scarica artwork (batch da Fanart.tv)</TooltipContent>
            </Tooltip>

            <span className="completion-txt">{complete}/3</span>
          </div>
        )}
      </div>
    </div>
  );
}
