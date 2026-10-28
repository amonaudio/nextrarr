/**
 * POST /api/refresh — invalidate all in-process caches.
 *
 * [0.7.7] NEW ROUTE — wired to the previously-dead "Aggiorna" button in the
 * Header. The button now calls this endpoint, then reloads the media list
 * and root folders client-side.
 *
 * [0.7.8] Also clears the new folderCache (per-folder stat/readdir cache,
 * 60s TTL). Without this, after a path mapping change the per-folder flags
 * (hasTheme, hasArtwork, hasTrailer) would be stale for up to 60s even
 * after the user clicked Refresh. Now both caches clear together.
 *
 * [0.7.9] Also clears the externalCache (Fanart.tv + TMDB API responses,
 * 30 min TTL). Useful when the user wants to force a fresh fetch from
 * Fanart/TMDB (e.g. they uploaded new artwork upstream and want to see
 * it without waiting 30 min). All three caches clear together now.
 *
 * Why a dedicated endpoint? All caches are singletons in the Node process
 * — the browser can't directly clear them. Without this endpoint, the
 * only ways to refresh the caches were:
 *  1. Wait for the TTLs to expire (5 min mediaCache, 60s folderCache, 30 min externalCache)
 *  2. Restart the container (!)
 * After changing path mappings in Settings or downloading artwork outside
 * nEXTrarr (e.g. via SMB), the user had to restart the container to see
 * the changes reflected. Now they click the refresh button and all caches
 * are cleared immediately.
 */

import { NextResponse } from 'next/server';
import { mediaCache } from '@/lib/cache';
import { folderCache } from '@/lib/folder-cache';
import { externalCache } from '@/lib/external-cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  mediaCache.clear();
  folderCache.invalidateAll();
  externalCache.clear();
  return NextResponse.json({ status: 'success', message: 'All caches invalidated' });
}
