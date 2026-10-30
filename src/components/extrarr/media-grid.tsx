'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  Film,
  Image as ImageIcon,
  Music,
  SearchX,
  Settings2,
} from 'lucide-react';
import { MediaCard } from './media-card';
import { useExtrarrStore } from '@/store/extrarr-store';
import type { MediaItem, CustomFilter } from '@/lib/types';
import {
  audioChannelsBadgeClasses,
  resolutionBadgeClasses,
  videoCodecBadgeClasses,
} from '@/lib/media-info';
import { isRecentlyAdded, needsMediaAction } from '@/lib/media-badge';
import { filterLibrary } from '@/lib/library';
import { cn } from '@/lib/utils';
import type { LibraryView } from './library-toolbar';

interface MediaGridProps {
  onQuickDownload: (id: number, btn: HTMLButtonElement | null) => void;
  onDownloadArtwork: (id: number, btn: HTMLButtonElement | null) => void;
  onPlayTheme: (id: number, title: string) => void;
  onViewArtwork: (id: number, title: string) => void;
  onPlayTrailer: (id: number, title: string) => void;
  onOpenEditor: (id: number) => void;
  onShowWarning: (msg: string) => void;
  activeCustomFilter: CustomFilter | null;
  view: LibraryView;
}

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 225'><rect width='100%' height='100%' fill='%232b2b2b'/><text x='75' y='120' fill='%23ff8a4c' font-family='sans-serif' font-size='14' text-anchor='middle'>N/A</text></svg>`;

interface MediaListRowProps extends Omit<MediaGridProps, 'view' | 'activeCustomFilter'> {
  media: MediaItem;
}

function MediaListRow({
  media,
  onQuickDownload,
  onDownloadArtwork,
  onPlayTheme,
  onViewArtwork,
  onPlayTrailer,
  onOpenEditor,
  onShowWarning,
}: MediaListRowProps) {
  const posterIdentity = `${media.poster}\u0000${media.remote_poster ?? ''}`;
  const [posterFailure, setPosterFailure] = useState<{ key: string; src: string } | null>(null);
  const currentSrc = posterFailure?.key === posterIdentity
    ? posterFailure.src
    : (media.poster || media.remote_poster || FALLBACK_POSTER);

  const warning = !media.is_mapped
    ? `Attenzione: percorso non mappato. Vai su Impostazioni. Percorso: ${media.local_path}`
    : !media.folder_exists
      ? `Errore: la cartella non esiste sul disco. Percorso calcolato: ${media.local_path}`
      : null;

  const complete = [media.has_theme, media.has_artwork, media.has_trailer].filter(Boolean).length;
  const showNew = isRecentlyAdded(media.date_added) && needsMediaAction(media);

  function handlePosterError() {
    if (media.remote_poster && currentSrc !== media.remote_poster) {
      setPosterFailure({ key: posterIdentity, src: media.remote_poster });
      return;
    }
    setPosterFailure({ key: posterIdentity, src: FALLBACK_POSTER });
  }

  return (
    <div className={cn('list-row', warning && 'is-invalid')} data-title={media.title}>
      <div className="list-poster">
        <img src={currentSrc} alt={media.title} loading="lazy" onError={handlePosterError} />
      </div>

      <div className="list-main">
        <h3>
          {media.title}
          {showNew && <span className="list-new">NEW</span>}
        </h3>
        <div className="card-meta">
          <span>{media.year}</span>
          <span className="middot">·</span>
          <span>{media.root_folder.split('/').filter(Boolean).pop() ?? media.root_folder}</span>
        </div>
      </div>

      <div className="list-quality">
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

      <div className="list-status">
        {warning ? (
          <button
            type="button"
            className="status-btn"
            onClick={() => onShowWarning(warning)}
            title="Percorso non valido"
            aria-label="Mostra dettagli percorso non valido"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className={cn('status-btn', media.has_theme ? 'ok' : 'missing')}
              onClick={() => onQuickDownload(media.id, null)}
              title={media.has_theme ? 'Tema presente — riscarica' : 'Scarica tema'}
              aria-label={media.has_theme ? 'Riscarica tema' : 'Scarica tema'}
            >
              {media.has_theme ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              className={cn('status-btn', media.has_artwork ? 'ok' : 'missing')}
              onClick={(event) => onDownloadArtwork(media.id, event.currentTarget)}
              title="Scarica artwork"
              aria-label="Scarica artwork"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={cn('status-btn', media.has_trailer ? 'ok' : 'missing')}
              onClick={() => onPlayTrailer(media.id, media.title)}
              disabled={!media.has_trailer}
              title={media.has_trailer ? 'Riproduci trailer' : 'Trailer non presente'}
              aria-label="Riproduci trailer"
            >
              <Film className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <span className={cn(warning ? 'warning-txt' : 'completion-txt')}>
          {warning ? 'Percorso' : `${complete}/3`}
        </span>
      </div>

      <div className="list-actions">
        <button
          type="button"
          className="status-btn"
          onClick={() => onPlayTheme(media.id, media.title)}
          disabled={!media.has_theme}
          title="Riproduci tema"
          aria-label="Riproduci tema"
        >
          <Music className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="status-btn"
          onClick={() => onViewArtwork(media.id, media.title)}
          title="Vedi artwork"
          aria-label="Vedi artwork"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="status-btn"
          onClick={() => onOpenEditor(media.id)}
          title="Apri editor"
          aria-label="Apri editor"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MediaGrid(props: MediaGridProps) {
  const {
    mediaList, loadingMedia, mediaError,
    sortField, sortDir,
    rootFolderFilter, mainFilter, localSearch,
  } = useExtrarrStore();

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const filtered = useMemo(() => filterLibrary(mediaList, {
    rootFolderFilter,
    mainFilter,
    localSearch,
    sortField,
    sortDir,
    activeCustomFilter: props.activeCustomFilter,
  }), [mediaList, sortField, sortDir, rootFolderFilter, mainFilter, localSearch, props.activeCustomFilter]);

  const letters = useMemo(
    () => [...new Set(filtered.map((media) => (media.title[0] || '#').toUpperCase()))].sort(),
    [filtered],
  );

  function scrollToLetter(letter: string) {
    for (const [id, el] of cardRefs.current.entries()) {
      if (el.dataset.title && el.dataset.title.toUpperCase().startsWith(letter)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  }

  if (loadingMedia) {
    return <div className="media-loading">Caricamento in corso...</div>;
  }

  if (mediaError) {
    return <div className="media-error">Errore: {mediaError}</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="media-empty">
        <span className="media-empty-icon">
          <SearchX className="h-5 w-5" />
        </span>
        <h3>Nessun titolo trovato</h3>
        <p>Prova a cambiare filtro, cartella o termine di ricerca per vedere altri titoli della libreria.</p>
      </div>
    );
  }

  return (
    <>
      {props.view === 'list' ? (
        <div className="media-list">
          {filtered.map((media) => (
            <div
              key={media.id}
              ref={(el) => {
                if (el) cardRefs.current.set(media.id, el);
                else cardRefs.current.delete(media.id);
              }}
              data-title={media.title}
            >
              <MediaListRow media={media} {...props} />
            </div>
          ))}
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map((media) => (
            <div
              key={media.id}
              ref={(el) => {
                if (el) cardRefs.current.set(media.id, el);
                else cardRefs.current.delete(media.id);
              }}
              data-title={media.title}
            >
              <MediaCard media={media} {...props} />
            </div>
          ))}
        </div>
      )}

      {letters.length > 0 && (
        <nav aria-label="Navigazione alfabetica" className="alpha-nav">
          {letters.map((letter) => (
            <button key={letter} type="button" onClick={() => scrollToLetter(letter)}>
              {letter}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
