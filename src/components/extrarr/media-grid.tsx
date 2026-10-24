/**
 * MediaGrid — the responsive grid of MediaCards. Handles filtering, sorting,
 * and the alphabetical navigation sidebar.
 */

'use client';

import { useMemo, useRef } from 'react';
import { MediaCard } from './media-card';
import { useExtrarrStore } from '@/store/extrarr-store';
import type { MediaItem, CustomFilter } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface MediaGridProps {
  onQuickDownload: (id: number, btn: HTMLButtonElement | null) => void;
  onDownloadArtwork: (id: number, btn: HTMLButtonElement | null) => void;
  onPlayTheme: (id: number, title: string) => void;
  onViewArtwork: (id: number, title: string) => void;
  onPlayTrailer: (id: number, title: string) => void;
  onOpenEditor: (id: number) => void;
  onShowWarning: (msg: string) => void;
  activeCustomFilter: CustomFilter | null;
}

function checkCustomFilter(m: MediaItem, f: CustomFilter | null): boolean {
  if (!f) return true;
  return f.rules.every((r) => {
    const mediaVal = m[r.type];
    const expected = r.val === 'true';
    return mediaVal === expected;
  });
}

export function MediaGrid(props: MediaGridProps) {
  const {
    mediaList, loadingMedia, mediaError,
    sortField, sortDir,
    rootFolderFilter, mainFilter, localSearch,
  } = useExtrarrStore();

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const filtered = useMemo(() => {
    const q = localSearch.toLowerCase();
    let list = mediaList.filter((m) => {
      if (q && !m.title.toLowerCase().includes(q)) return false;
      if (rootFolderFilter !== 'all' && !m.root_folder.startsWith(rootFolderFilter)) return false;
      if (!m.is_mapped || !m.folder_exists) return false;
      if (mainFilter === 'missing_theme' && m.has_theme) return false;
      if (mainFilter === 'missing_art' && m.has_artwork) return false;
      if (mainFilter === 'missing_trailer' && m.has_trailer) return false;
      if (mainFilter === 'complete' && (!m.has_theme || !m.has_artwork || !m.has_trailer)) return false;
      if (mainFilter === 'custom_active' && !checkCustomFilter(m, props.activeCustomFilter)) return false;
      return true;
    });

    // With "all" filter, also include unmapped items so the user can see warnings
    if (mainFilter === 'all') {
      for (const m of mediaList) {
        if ((!m.is_mapped || !m.folder_exists) && !list.includes(m)) {
          if (rootFolderFilter !== 'all' && !m.root_folder.startsWith(rootFolderFilter)) continue;
          if (q && !m.title.toLowerCase().includes(q)) continue;
          list.push(m);
        }
      }
    }

    list = [...list].sort((a, b) => {
      if (sortField === 'title') return a.title.localeCompare(b.title);
      if (sortField === 'year') {
        const ay = typeof a.year === 'number' ? a.year : 0;
        const by = typeof b.year === 'number' ? b.year : 0;
        return by - ay;
      }
      if (sortField === 'date_added') {
        return new Date(b.date_added || '1970-01-01').getTime() - new Date(a.date_added || '1970-01-01').getTime();
      }
      return 0;
    });
    if (sortDir === 'asc') list.reverse();
    return list;
  }, [mediaList, sortField, sortDir, rootFolderFilter, mainFilter, localSearch, props.activeCustomFilter]);

  const letters = useMemo(
    () => [...new Set(filtered.map((m) => (m.title[0] || '#').toUpperCase()))].sort(),
    [filtered],
  );

  function scrollToLetter(letter: string) {
    // FIXED v1.x bug: dataset_title was undefined; now uses dataset.title
    for (const [id, el] of cardRefs.current.entries()) {
      if (el.dataset.title && el.dataset.title.toUpperCase().startsWith(letter)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">
          Risultati visualizzati: <Badge variant="outline" className="text-primary font-bold">{filtered.length}</Badge>
        </div>
      </div>

      {loadingMedia ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento in corso...</div>
      ) : mediaError ? (
        <div className="text-center py-12 text-destructive">Errore: {mediaError}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nessun risultato.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {filtered.map((m) => (
            <div
              key={m.id}
              ref={(el) => {
                if (el) cardRefs.current.set(m.id, el);
                else cardRefs.current.delete(m.id);
              }}
              data-title={m.title}
            >
              <MediaCard media={m} {...props} />
            </div>
          ))}
        </div>
      )}

      {/* Alpha navigation sidebar (right edge) */}
      {letters.length > 0 && (
        <nav
          aria-label="Navigazione alfabetica"
          // [0.7.1] z-40 — below the Radix Dialogs (z-50) so the alpha-nav
          // doesn't bleed through when a modal is open.
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-card border border-r-0 border-border rounded-l-lg py-2 px-1 flex flex-col gap-0.5 z-40"
        >
          {letters.map((l) => (
            <button
              key={l}
              className="text-[10px] text-muted-foreground hover:text-primary hover:font-bold"
              onClick={() => scrollToLetter(l)}
            >
              {l}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
