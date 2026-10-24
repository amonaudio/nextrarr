/**
 * POST /api/download-specific-artwork/[type]/[id]
 * Body: { url, our_type, ext }
 * Downloads an artwork image into the media folder (with SSRF + path safety).
 *
 * In demo mode just simulates success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { downloadArtworkToFolder } from '@/lib/services/artwork';
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

  let body: { url?: unknown; our_type?: unknown; ext?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const url = typeof body.url === 'string' ? body.url : '';
  const ourType = typeof body.our_type === 'string' ? body.our_type : '';
  const ext = typeof body.ext === 'string' ? body.ext : 'png';
  if (!url || !ourType) {
    return NextResponse.json({ status: 'error', message: 'Dati mancanti' }, { status: 400 });
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json({
      status: 'success',
      message: `Artwork ${ourType}.${ext} scaricato/sostituito (demo)`,
    });
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: msg }, { status: 500 });
  }

  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) return NextResponse.json({ status: 'error', message: error! }, { status: 400 });
  if (!existsSync(localPath)) {
    try {
      await mkdir(localPath, { recursive: true });
    } catch (e) {
      return NextResponse.json({ status: 'error', message: `Impossibile creare la cartella: ${e instanceof Error ? e.message : e}` }, { status: 500 });
    }
  }

  try {
    const filename = await downloadArtworkToFolder(url, ourType, ext, localPath);
    mediaCache.invalidatePrefix('media:');
  folderCache.invalidate(localPath);  // [0.7.8] per-folder cache
    return NextResponse.json({ status: 'success', message: `Artwork ${filename} scaricato/sostituito` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('URL non consentito') || msg.includes('non valido') ? 400 : 500;
    return NextResponse.json({ status: 'error', message: msg }, { status });
  }
}
