/**
 * Zustand store for client-side nEXTrarr state.
 * Replaces the v1.x module-level `state` object in grid.js.
 */

import { create } from 'zustand';
import type { MediaType, SortField, SortDir, CustomFilter, MediaItem } from '@/lib/types';

interface ExtrarrState {
  // Library state
  mediaType: MediaType;
  mediaList: MediaItem[];
  loadingMedia: boolean;
  mediaError: string | null;
  // Selection / current target
  currentMediaId: number | null;
  // Sort + filter
  sortField: SortField;
  sortDir: SortDir;
  rootFolderFilter: string; // 'all' or a path
  mainFilter: string; // FilterType as string
  localSearch: string;
  // Active custom filter
  activeCustomFilter: CustomFilter | null;
  // Now playing
  playingTitle: string;
  playingUrl: string | null;

  // Actions
  setMediaType: (t: MediaType) => void;
  setMediaList: (list: MediaItem[]) => void;
  setLoadingMedia: (b: boolean) => void;
  setMediaError: (e: string | null) => void;
  setCurrentMediaId: (id: number | null) => void;
  setSortField: (f: SortField) => void;
  toggleSortDir: () => void;
  setRootFolderFilter: (f: string) => void;
  setMainFilter: (f: string) => void;
  setLocalSearch: (s: string) => void;
  setActiveCustomFilter: (f: CustomFilter | null) => void;
  setPlaying: (title: string, url: string | null) => void;
  // Update a single media in-place (after a download completes)
  patchMedia: (id: number, patch: Partial<MediaItem>) => void;
}

export const useExtrarrStore = create<ExtrarrState>((set) => ({
  mediaType: 'radarr',
  mediaList: [],
  loadingMedia: false,
  mediaError: null,
  currentMediaId: null,
  sortField: 'title',
  sortDir: 'asc',
  rootFolderFilter: 'all',
  mainFilter: 'all',
  localSearch: '',
  activeCustomFilter: null,
  playingTitle: 'Nessun media selezionato',
  playingUrl: null,

  setMediaType: (t) => set({ mediaType: t }),
  setMediaList: (list) => set({ mediaList: list }),
  setLoadingMedia: (b) => set({ loadingMedia: b }),
  setMediaError: (e) => set({ mediaError: e }),
  setCurrentMediaId: (id) => set({ currentMediaId: id }),
  setSortField: (f) => set({ sortField: f }),
  toggleSortDir: () => set((s) => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
  setRootFolderFilter: (f) => set({ rootFolderFilter: f }),
  setMainFilter: (f) => set({ mainFilter: f }),
  setLocalSearch: (s) => set({ localSearch: s }),
  setActiveCustomFilter: (f) => set({ activeCustomFilter: f }),
  setPlaying: (title, url) => set({ playingTitle: title, playingUrl: url }),
  patchMedia: (id, patch) => set((s) => ({
    mediaList: s.mediaList.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  })),
}));
