/**
 * In-memory TTL cache — port of app/cache.py
 * Used to keep /api/media fast on big libraries.
 */

interface CacheEntry<T> {
  expiry: number;
  value: T;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtl: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.defaultTtl = defaultTtlMs;
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

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Singleton (per-process)
export const mediaCache = new TTLCache(5 * 60 * 1000);
