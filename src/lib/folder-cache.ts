/**
 * [0.7.8] Folder-level cache for media-folder scans.
 *
 * Why this exists:
 * The `mediaCache` (in `cache.ts`) caches the FULL media list per type
 * (radarr or sonarr). For 5000 titles, refreshing means 5000 stat/readdir
 * calls — fast on local SSD, slow on network mounts. The list-level cache
 * handles the "library list is fresh" case.
 *
 * But when a single card opens its ArtworkModal, the frontend fires 3
 * parallel requests (artwork-files, search-artwork-online, search-tmdb-artwork),
 * and the main media list also recomputes on every refresh. Each call
 * hits the disk for that media's folder. Without a folder-level cache,
 * opening 10 cards in a row = 10 × readdir per folder = 10 disk round-trips
 * for the same data.
 *
 * This cache stores, per absolute folder path:
 *   - local artwork filenames (scanLocalArtwork result)
 *   - has-theme.mp3 flag
 *   - has-extra-artwork flag
 *   - has-trailer-in-nfo flag (after reading the NFO file)
 * With a short TTL (60s default), so an out-of-band download (e.g. via
 * SMB) is picked up on the next card open within a minute. The user can
 * also force a full refresh via the "Aggiorna" button (which clears
 * `mediaCache` AND `folderCache` via the `/api/refresh` endpoint).
 *
 * Memory cost: each entry is ~200 bytes. For 5000 actively-browsed folders
 * that's ~1 MB — well within budget.
 *
 * Invalidation: `invalidateFolder(localPath)` removes the entry for one
 * folder; `invalidateAll()` clears everything (called from /api/refresh
 * and after any download that writes to a media folder).
 */

import { existsSync } from 'node:fs';

interface FolderCacheEntry {
  expiry: number;
  artworkFiles: string[];
  hasTheme: boolean;
  hasArtwork: boolean;
  hasTrailer: boolean;
  posterPath: string | null;  // absolute path of <foldername>-poster.{ext}, or null
}

const DEFAULT_TTL_MS = 60 * 1000;  // 60 seconds

class FolderCache {
  private store = new Map<string, FolderCacheEntry>();
  private ttl: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttl = ttlMs;
  }

  get(folderPath: string): FolderCacheEntry | null {
    const entry = this.store.get(folderPath);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(folderPath);
      return null;
    }
    return entry;
  }

  set(folderPath: string, data: Omit<FolderCacheEntry, 'expiry'>): void {
    this.store.set(folderPath, { ...data, expiry: Date.now() + this.ttl });
  }

  invalidate(folderPath: string): void {
    this.store.delete(folderPath);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  /** For diagnostics: number of cached folders. */
  size(): number {
    return this.store.size;
  }
}

export const folderCache = new FolderCache(DEFAULT_TTL_MS);

/**
 * Look up the local poster path for a folder, with caching.
 * Tries .jpg, .jpeg, .png in order (most common first).
 * Returns the absolute path if found, null otherwise.
 *
 * Cached as part of the folder cache entry (60s TTL) so repeated card
 * renders don't re-stat the same files.
 */
export function findLocalPoster(folderPath: string): string | null {
  const cached = folderCache.get(folderPath);
  if (cached) return cached.posterPath;

  // Compute and cache (even if null, so we don't re-stat for nothing)
  const folderName = folderPath.replace(/\/+$/, '').split('/').pop() ?? '';
  if (!folderName) return null;
  let found: string | null = null;
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const candidate = `${folderPath.replace(/\/+$/, '')}/${folderName}-poster.${ext}`;
    if (existsSync(candidate)) {
      found = candidate;
      break;
    }
  }
  return found;
}
