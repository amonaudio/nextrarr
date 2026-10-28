/**
 * Next.js Middleware — adds no-cache HTTP headers to ALL /api/* responses.
 *
 * [0.7.13] CRITICAL FIX — "cache non rigenerata dopo Aggiorna / download artwork"
 *
 * The user reported two symptoms:
 *   1. After clicking "Aggiorna libreria", the MediaCard poster doesn't
 *      refresh — the old artwork stays on screen.
 *   2. After clicking "Scarica" on an online artwork in the ArtworkModal,
 *      the local image doesn't refresh in the modal — old bytes shown.
 *   3. The only way to see the new state was Ctrl+Shift+R (hard reload)
 *      or open the page in incognito mode (which starts with no cache).
 *
 * Root cause: BROWSERS CACHE HTTP GET RESPONSES HEURISTICALLY when the
 * server doesn't send explicit Cache-Control headers. The app's API
 * routes had `export const dynamic = 'force-dynamic'` (which only
 * affects Next.js's static-rendering pipeline) BUT did NOT set any
 * Cache-Control header on the HTTP response itself. So:
 *
 *   - GET /api/media/radarr returned 200 with no Cache-Control →
 *     browser cached it heuristically (e.g. for ~10% of Last-Modified
 *     age, or indefinitely if it considered the URL "fresh").
 *   - When onRefresh() called fetch('/api/media/radarr') again, the
 *     browser returned the CACHED response without hitting the server.
 *   - So even though the server's in-process mediaCache was cleared
 *     by POST /api/refresh, the browser never re-asked the server.
 *     The MediaGrid rendered with the OLD mediaList from Zustand
 *     (which had been populated from the cached response), and the
 *     poster <img> tags kept their old src URLs.
 *
 * Incognito works because the browser starts with an empty cache →
 * every fetch is fresh → server returns the freshly-cleared mediaCache
 * → frontend shows new state.
 *
 * Fix: this middleware runs on EVERY request matching /api/:path* and
 * adds the standard "don't cache anything" trio to the response:
 *
 *   - Cache-Control: no-store, no-cache, must-revalidate, must-understand
 *       no-store     → browser MUST NOT store the response in cache
 *       no-cache     → browser MUST revalidate before using a cached copy
 *       must-revalidate (only meaningful with max-age, kept for safety)
 *       must-understand (RFC 9211) → don't store if you don't understand
 *   - Pragma: no-cache  → HTTP/1.0 cache-buster (legacy, for old proxies)
 *   - Expires: 0        → HTTP/1.0 "already expired"
 *
 * This forces the browser to ALWAYS re-fetch from the server, so the
 * in-process cache invalidations (mediaCache, folderCache, externalCache)
 * are actually seen by the client. No more "must hard-reload or use
 * incognito" workaround.
 *
 * Trade-off: every /api/ request goes to the server now (no browser
 * cache hits). For a media-management tool on a LAN this is fine — the
 * server's own caches (5min mediaCache, 60s folderCache, 30min
 * externalCache) still keep the heavy work off Radarr/Sonarr/TMDB.
 * The browser→server hop is ~5ms on localhost, ~50ms on LAN.
 *
 * Note: the existing /api/artwork-image route already sets no-store
 * in its own response headers (added in 0.7.12-test). The middleware
 * is redundant for that route but doesn't hurt — Next.js will keep
 * the most restrictive of the two.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  // Get the Next.js "pass-through" response (the actual route will
  // populate the body). We just attach extra headers.
  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, must-understand');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

export const config = {
  // Match all /api/* routes. The colon-prefix is the Next.js matcher
  // syntax for "any path under /api/".
  matcher: '/api/:path*',
};
