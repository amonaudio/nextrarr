/**
 * [0.7.9] External API cache for Fanart.tv and TMDB responses.
 *
 * Why this exists:
 * When the user opens the ArtworkModal for a card, the frontend fires 3
 * parallel requests. Two of them (`/api/search-artwork-online` and
 * `/api/search-tmdb-artwork`) make outbound HTTP calls to Fanart.tv and
 * TMDB respectively. For a 5000-title library browsed across multiple
 * cards in a session, this can be hundreds of external API calls — slow
 * (each one 200-500ms over the Internet), rate-limit-prone (TMDB has a
 * 50 req/sec limit, Fanart.tv is even stricter), and wasteful (the
 * artwork metadata for a movie/series rarely changes).
 *
 * This cache stores API responses keyed by `{service}:{mediaType}:{id}`
 * with a long TTL (30 min by default — Fanart/TMDB artwork for a given
 * movie/series doesn't change day-to-day, but we don't want to cache
 * forever in case the user uploads new artwork upstream).
 *
 * Memory budget: each Fanart response is ~5-20 KB (varies by media
 * popularity), each TMDB images response is ~10-50 KB. For 100 actively
 * browsed media that's ~3 MB — acceptable.
 *
 * Invalidation:
 * - TTL expiry (30 min)
 * - Manual: cleared by `/api/refresh` alongside `mediaCache` + `folderCache`
 * - Per-key: `invalidate(key)` for fine-grained control (not currently
 *   used, but available for future "force refresh this media's artwork"
 *   buttons)
 */

interface CacheEntry<T> {
  expiry: number;
  value: T;
}

export class ExternalCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtl: number;

  constructor(ttlMs = 30 * 60 * 1000) {  // 30 minutes default
    this.defaultTtl = ttlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs ?? this.defaultTtl);
    this.store.set(key, { expiry, value });
  }

  /**
   * Get the cached value if present, otherwise call the `fetcher` and
   * cache the result. Convenient wrapper for the common pattern.
   *
   * If `fetcher` throws, the error is propagated (NOT cached) — so a
   * transient network failure won't poison the cache for 30 min.
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate all entries whose key starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  /** For diagnostics: number of cached entries. */
  size(): number {
    return this.store.size;
  }
}

// Singleton (per-process)
export const externalCache = new ExternalCache(30 * 60 * 1000);

/**
 * Build cache keys. Centralized so a typo in one place can't cause
 * silent cache misses elsewhere.
 */
export const externalCacheKeys = {
  fanart: (mediaType: 'radarr' | 'sonarr', artId: number | string) =>
    `fanart:${mediaType}:${artId}`,
  tmdbImages: (mediaType: 'radarr' | 'sonarr', tmdbId: number) =>
    `tmdb:images:${mediaType}:${tmdbId}`,
  tmdbInfo: (mediaType: 'radarr' | 'sonarr', tmdbId: number, lang: string) =>
    `tmdb:info:${mediaType}:${tmdbId}:${lang}`,
  tmdbFindByTvdb: (tvdbId: number) =>
    `tmdb:find:tvdb:${tvdbId}`,
};
