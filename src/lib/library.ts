import type { CustomFilter, MediaItem, SortDir, SortField } from '@/lib/types';
import { isRecentlyAdded, needsMediaAction } from '@/lib/media-badge';

export interface LibraryQuery {
  rootFolderFilter: string;
  mainFilter: string;
  localSearch: string;
  sortField: SortField;
  sortDir: SortDir;
  activeCustomFilter: CustomFilter | null;
}

export interface LibraryStats {
  total: number;
  valid: number;
  warnings: number;
  incomplete: number;
  complete: number;
  recent: number;
  coveragePct: number;
  theme: { have: number; total: number };
  artwork: { have: number; total: number };
  trailer: { have: number; total: number };
}

export function isUsableMedia(media: MediaItem): boolean {
  return media.is_mapped && media.folder_exists;
}

export function matchesCustomFilter(media: MediaItem, filter: CustomFilter | null): boolean {
  if (!filter) return true;
  return filter.rules.every((rule) => media[rule.type] === (rule.val === 'true'));
}

export function matchesMainFilter(
  media: MediaItem,
  mainFilter: string,
  activeCustomFilter: CustomFilter | null,
): boolean {
  if (mainFilter === 'all') return true;
  if (!isUsableMedia(media)) return false;

  switch (mainFilter) {
    case 'incomplete':
      return needsMediaAction(media);
    case 'missing_theme':
      return !media.has_theme;
    case 'missing_art':
      return !media.has_artwork;
    case 'missing_trailer':
      return !media.has_trailer;
    case 'complete':
      return media.has_theme && media.has_artwork && media.has_trailer;
    case 'custom_active':
      return matchesCustomFilter(media, activeCustomFilter);
    default:
      return true;
  }
}

export function filterLibrary(mediaList: MediaItem[], query: LibraryQuery): MediaItem[] {
  const q = query.localSearch.trim().toLowerCase();
  const list = mediaList.filter((media) => {
    if (q && !media.title.toLowerCase().includes(q)) return false;
    if (query.rootFolderFilter !== 'all' && !media.root_folder.startsWith(query.rootFolderFilter)) return false;
    return matchesMainFilter(media, query.mainFilter, query.activeCustomFilter);
  });

  list.sort((a, b) => {
    if (query.sortField === 'title') return a.title.localeCompare(b.title);
    if (query.sortField === 'year') {
      const ay = typeof a.year === 'number' ? a.year : 0;
      const by = typeof b.year === 'number' ? b.year : 0;
      return by - ay;
    }
    if (query.sortField === 'date_added') {
      return new Date(b.date_added || '1970-01-01').getTime() - new Date(a.date_added || '1970-01-01').getTime();
    }
    return 0;
  });

  if (query.sortDir === 'asc') list.reverse();
  return list;
}

export function computeLibraryStats(mediaList: MediaItem[]): LibraryStats {
  let valid = 0;
  let warnings = 0;
  let incomplete = 0;
  let complete = 0;
  let recent = 0;
  let themeHave = 0;
  let artworkHave = 0;
  let trailerHave = 0;

  for (const media of mediaList) {
    if (!isUsableMedia(media)) {
      warnings++;
      if (isRecentlyAdded(media.date_added)) recent++;
      continue;
    }

    valid++;
    if (media.has_theme) themeHave++;
    if (media.has_artwork) artworkHave++;
    if (media.has_trailer) trailerHave++;

    if (media.has_theme && media.has_artwork && media.has_trailer) complete++;
    else incomplete++;

    if (isRecentlyAdded(media.date_added) && needsMediaAction(media)) recent++;
  }

  const totalSlots = valid * 3;
  const filledSlots = themeHave + artworkHave + trailerHave;

  return {
    total: mediaList.length,
    valid,
    warnings,
    incomplete,
    complete,
    recent,
    coveragePct: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
    theme: { have: themeHave, total: valid },
    artwork: { have: artworkHave, total: valid },
    trailer: { have: trailerHave, total: valid },
  };
}

export function getFilterCounts(
  mediaList: MediaItem[],
  activeCustomFilter: CustomFilter | null,
): Record<string, number> {
  const counts: Record<string, number> = {
    all: mediaList.length,
    incomplete: 0,
    missing_theme: 0,
    missing_art: 0,
    missing_trailer: 0,
    complete: 0,
    custom_active: 0,
  };

  for (const media of mediaList) {
    if (!isUsableMedia(media)) continue;
    if (needsMediaAction(media)) counts.incomplete++;
    if (!media.has_theme) counts.missing_theme++;
    if (!media.has_artwork) counts.missing_art++;
    if (!media.has_trailer) counts.missing_trailer++;
    if (media.has_theme && media.has_artwork && media.has_trailer) counts.complete++;
    if (matchesCustomFilter(media, activeCustomFilter)) counts.custom_active++;
  }

  return counts;
}
