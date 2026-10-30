'use client';

import { useMemo } from 'react';
import { Check, Film, Folder, Grid2X2, Settings, Sparkles, Tv } from 'lucide-react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { computeLibraryStats, getFilterCounts } from '@/lib/library';
import { cn } from '@/lib/utils';

interface LibrarySidebarProps {
  rootFolders: string[];
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function LibrarySidebar({ rootFolders, open, onClose, onOpenSettings }: LibrarySidebarProps) {
  const {
    mediaType,
    setMediaType,
    mediaList,
    mainFilter,
    setMainFilter,
    rootFolderFilter,
    setRootFolderFilter,
    setLocalSearch,
    activeCustomFilter,
    setActiveCustomFilter,
  } = useExtrarrStore();

  const stats = useMemo(() => computeLibraryStats(mediaList), [mediaList]);
  const counts = useMemo(
    () => getFilterCounts(mediaList, activeCustomFilter),
    [mediaList, activeCustomFilter],
  );

  const sourceLabel = mediaType === 'radarr' ? 'Film' : 'Serie';

  function chooseFilter(filter: string) {
    setMainFilter(filter);
    if (filter !== 'custom_active') setActiveCustomFilter(null);
    onClose();
  }

  function chooseSource(source: 'radarr' | 'sonarr') {
    if (source === mediaType) return;
    setMediaType(source);
    setRootFolderFilter('all');
    setLocalSearch('');
    setMainFilter('all');
    setActiveCustomFilter(null);
    onClose();
  }

  return (
    <>
      <aside className={cn('app-rail', open && 'is-open')} aria-label="Navigazione principale">
        <div className="brand">
          <span className="brand-logo" aria-hidden>N</span>
          <div className="brand-name">
            n<b>EXT</b>rarr
            <span className="version-pill">0.8.32</span>
          </div>
        </div>

        <div className="source-switch" role="tablist" aria-label="Sorgente libreria">
          <button
            type="button"
            role="tab"
            aria-selected={mediaType === 'radarr'}
            className={cn(mediaType === 'radarr' && 'active')}
            onClick={() => chooseSource('radarr')}
          >
            <Film className="h-4 w-4" />
            Film
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mediaType === 'sonarr'}
            className={cn(mediaType === 'sonarr' && 'active')}
            onClick={() => chooseSource('sonarr')}
          >
            <Tv className="h-4 w-4" />
            Serie
          </button>
        </div>

        <div className="rail-section">
          <div className="rail-label">Workspace</div>
          <button
            type="button"
            className={cn('nav-item', mainFilter === 'all' && 'active')}
            onClick={() => chooseFilter('all')}
          >
            <Grid2X2 className="h-4 w-4" />
            Libreria
            <span className="nav-count">{counts.all}</span>
          </button>
          <button
            type="button"
            className={cn('nav-item', mainFilter === 'incomplete' && 'active')}
            onClick={() => chooseFilter('incomplete')}
          >
            <Sparkles className="h-4 w-4" />
            Da completare
            <span className="nav-count">{counts.incomplete}</span>
          </button>
          <button
            type="button"
            className={cn('nav-item', mainFilter === 'complete' && 'active')}
            onClick={() => chooseFilter('complete')}
          >
            <Check className="h-4 w-4" />
            Completi
            <span className="nav-count">{counts.complete}</span>
          </button>
        </div>

        <div className="rail-section">
          <div className="rail-label">Cartelle</div>
          <div className="folder-list">
            <button
              type="button"
              className={cn('folder-item', rootFolderFilter === 'all' && 'active')}
              onClick={() => { setRootFolderFilter('all'); onClose(); }}
            >
              <Folder className="h-3.5 w-3.5" />
              Tutte le cartelle
              <span>{stats.total}</span>
            </button>
            {rootFolders.map((folder) => {
              const label = folder.split('/').filter(Boolean).pop() ?? folder;
              const count = mediaList.filter((media) => media.root_folder.startsWith(folder)).length;
              return (
                <button
                  type="button"
                  key={folder}
                  title={folder}
                  className={cn('folder-item', rootFolderFilter === folder && 'active')}
                  onClick={() => { setRootFolderFilter(folder); onClose(); }}
                >
                  <Folder className="h-3.5 w-3.5" />
                  <span className="folder-name">{label}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rail-spacer" />

        <div className="connection-card">
          <span className="pulse-dot" />
          <div className="connection-copy">
            <strong>{mediaType === 'radarr' ? 'Radarr' : 'Sonarr'}</strong>
            <span>Connesso · {stats.valid} titoli validi</span>
          </div>
        </div>

        <button type="button" className="rail-settings" onClick={onOpenSettings}>
          <span className="avatar">NX</span>
          <span className="who">
            <strong>Impostazioni</strong>
            <span>Connessioni e percorsi</span>
          </span>
          <Settings className="h-4 w-4" />
        </button>

        <span className="rail-source-note">{sourceLabel} workspace</span>
      </aside>
      <button
        type="button"
        aria-label="Chiudi menu"
        className={cn('rail-backdrop', open && 'is-open')}
        onClick={onClose}
      />
    </>
  );
}
