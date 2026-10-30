'use client';

import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { filterLibrary, getFilterCounts } from '@/lib/library';
import { cn } from '@/lib/utils';

export type LibraryView = 'grid' | 'list';

interface LibraryToolbarProps {
  rootFolders: string[];
  onOpenCustomFilters: () => void;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
}

const FILTERS = [
  { id: 'all', label: 'Tutti' },
  { id: 'incomplete', label: 'Da completare' },
  { id: 'missing_theme', label: 'Tema' },
  { id: 'missing_art', label: 'Artwork' },
  { id: 'missing_trailer', label: 'Trailer' },
  { id: 'complete', label: 'Completi' },
] as const;

export function LibraryToolbar({
  rootFolders,
  onOpenCustomFilters,
  view,
  onViewChange,
}: LibraryToolbarProps) {
  const {
    mediaType,
    mediaList,
    rootFolderFilter,
    setRootFolderFilter,
    mainFilter,
    setMainFilter,
    sortField,
    setSortField,
    sortDir,
    toggleSortDir,
    localSearch,
    setLocalSearch,
    activeCustomFilter,
    setActiveCustomFilter,
  } = useExtrarrStore();

  const counts = useMemo(
    () => getFilterCounts(mediaList, activeCustomFilter),
    [mediaList, activeCustomFilter],
  );

  const visibleCount = useMemo(() => filterLibrary(mediaList, {
    rootFolderFilter,
    mainFilter,
    localSearch,
    sortField,
    sortDir,
    activeCustomFilter,
  }).length, [mediaList, rootFolderFilter, mainFilter, localSearch, sortField, sortDir, activeCustomFilter]);

  function chooseFilter(filter: string) {
    setMainFilter(filter);
    if (filter !== 'custom_active') setActiveCustomFilter(null);
  }

  function clearCustomFilter() {
    setActiveCustomFilter(null);
    setMainFilter('all');
  }

  return (
    <>
      <div className="library-head">
        <div>
          <h2>
            Libreria
            <span className="library-count">{mediaList.length}</span>
          </h2>
          <p>{visibleCount} {visibleCount === 1 ? 'titolo visibile' : 'titoli visibili'} · {mediaType === 'radarr' ? 'film' : 'serie TV'}</p>
        </div>
        <div className="view-toggle" role="group" aria-label="Vista libreria">
          <button
            type="button"
            className={cn(view === 'grid' && 'active')}
            onClick={() => onViewChange('grid')}
            aria-label="Vista griglia"
            title="Griglia"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(view === 'list' && 'active')}
            onClick={() => onViewChange('list')}
            aria-label="Vista lista"
            title="Lista"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="lib-toolbar">
        <div className="filter-chips">
          {FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={cn('filter-chip', mainFilter === filter.id && 'active')}
              onClick={() => chooseFilter(filter.id)}
            >
              {filter.label}
              <span className="chip-count">{counts[filter.id] ?? 0}</span>
            </button>
          ))}

          {activeCustomFilter && mainFilter === 'custom_active' && (
            <span className="filter-chip custom active">
              <button type="button" onClick={() => setMainFilter('custom_active')}>
                {activeCustomFilter.name}
              </button>
              <button type="button" className="chip-x" onClick={clearCustomFilter} aria-label="Rimuovi filtro personalizzato">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        <span className="toolbar-divider" />

        <div className="toolbar-right">
          <select
            className="toolbar-select"
            value={rootFolderFilter}
            onChange={(event) => setRootFolderFilter(event.target.value)}
            aria-label="Filtra per cartella"
          >
            <option value="all">Tutte le cartelle</option>
            {rootFolders.map((folder) => (
              <option key={folder} value={folder}>{folder.split('/').filter(Boolean).pop() ?? folder}</option>
            ))}
          </select>

          <select
            className="toolbar-select"
            value={sortField}
            onChange={(event) => setSortField(event.target.value as typeof sortField)}
            aria-label="Ordina libreria"
          >
            <option value="title">Titolo</option>
            <option value="year">Anno</option>
            <option value="date_added">Data aggiunta</option>
          </select>

          <button
            type="button"
            className="toolbar-field toolbar-icon"
            onClick={toggleSortDir}
            title={sortDir === 'asc' ? 'Ordina in modo decrescente' : 'Ordina in modo crescente'}
            aria-label="Inverti ordinamento"
          >
            {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>

          <label className="search-mini">
            <Search className="h-4 w-4" />
            <input
              type="search"
              placeholder="Filtra libreria..."
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              autoComplete="off"
              aria-label="Filtra libreria"
            />
          </label>

          <button
            type="button"
            className={cn('toolbar-field toolbar-icon', activeCustomFilter && 'is-active')}
            onClick={onOpenCustomFilters}
            title="Filtri personalizzati"
            aria-label="Filtri personalizzati"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
