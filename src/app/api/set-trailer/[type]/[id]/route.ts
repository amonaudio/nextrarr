/**
 * POST /api/set-trailer/[type]/[id] — write/update the trailer tag in the NFO.
 *
 * [0.7.4] NEW ROUTE — fixes the long-standing "Errore di rete" toast that
 * appeared when the user clicked "Usa come Trailer" in the VideoModal.
 *
 * Previously, the frontend called `POST /api/set-trailer/...`, but no such
 * route existed — the POST handler lived inside `get-trailer/[type]/[id]/route.ts`.
 * Next.js returned a 404 HTML page, the frontend tried `res.json()` on the
 * HTML → threw → catch → "Errore di rete" toast. Misleading.
 *
 * The route is now properly separated:
 *   GET  /api/get-trailer/[type]/[id]  → read trailer from NFO
 *   POST /api/set-trailer/[type]/[id]  → write trailer to NFO
 *
 * Body: { url: string } — a YouTube URL or plugin:// URL.
 * 11-char video ID is extracted via `extractYoutubeId()`.
 *
 * In demo mode, returns success without writing (no real media folder).
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { extractYoutubeId, updateOrCreateNfo } from '@/lib/nfo';
import { mediaCache } from '@/lib/cache';
// [0.7.8] Invalidate per-folder cache after writes — flags may have changed.
import { folderCache } from '@/lib/folder-cache';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ status: 'error', message: 'Tipo non valido' }, { status: 400 });
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json({ status: 'error', message: 'ID non valido' }, { status: 400 });
  }

  let body: { url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'JSON non valido' }, { status: 400 });
  }
  const url = typeof body.url === 'string' ? body.url : '';
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    return NextResponse.json({ status: 'error', message: 'URL YouTube non valido' }, { status: 400 });
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) {
      return NextResponse.json({ status: 'error', message: 'Media non trovato (demo)' }, { status: 404 });
    }
    mediaCache.invalidatePrefix('media:');
    const nfoName = type === 'sonarr' ? 'tvshow.nfo' : `${mockMedia.title}.nfo`;
    return NextResponse.json({
      status: 'success',
      message: `Trailer salvato (demo) in ${nfoName}`,
    });
  }

  let media: { path: string; title: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path, title: full.title };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: msg }, { status: 500 });
  }
  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) {
    return NextResponse.json({ status: 'error', message: error! }, { status: 400 });
  }
  if (!existsSync(localPath)) {
    try {
      await mkdir(localPath, { recursive: true });
    } catch (e) {
      return NextResponse.json(
        { status: 'error', message: `Impossibile creare la cartella: ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
  }
  const nfoName = getNfoFilename(type, localPath);
  const nfoFile = path.join(localPath, nfoName);
  const saved = await updateOrCreateNfo(nfoFile, type, videoId);
  if (saved) {
    mediaCache.invalidatePrefix('media:');
  folderCache.invalidate(localPath);  // [0.7.8] per-folder cache
    return NextResponse.json({ status: 'success', message: `Trailer salvato in ${nfoName}` });
  }
  return NextResponse.json({ status: 'error', message: 'Errore scrittura NFO' }, { status: 500 });
}
