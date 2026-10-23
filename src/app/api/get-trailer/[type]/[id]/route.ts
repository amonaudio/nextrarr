/**
 * GET    /api/get-trailer/[type]/[id]   — extract trailer YouTube ID from NFO
 * POST   /api/set-trailer/[type]/[id]   — write/update trailer tag in NFO
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { extractTrailerId, extractYoutubeId, updateOrCreateNfo } from '@/lib/nfo';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { mediaCache } from '@/lib/cache';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

// Demo mode assigns a stable video ID per media id so the trailer modal always works
function mockVideoId(id: number): string {
  const base = 'dQw4w9WgXcQ';
  // Vary the ID deterministically but keep it valid (11 chars, alphanumeric/_/-)
  const variant = (id % 10).toString();
  return variant + base.slice(0, 10);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) return NextResponse.json({ status: 'error', message: 'Tipo non valido' }, { status: 400 });
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) return NextResponse.json({ status: 'error', message: 'ID non valido' }, { status: 400 });

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) return NextResponse.json({ status: 'error', message: 'Media non trovato (demo)' }, { status: 404 });
    return NextResponse.json({ status: 'success', video_id: mockVideoId(mediaId) });
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

  const nfoName = getNfoFilename(type, localPath);
  const nfoFile = path.join(localPath, nfoName);
  if (!existsSync(nfoFile)) {
    return NextResponse.json({ status: 'error', message: 'File NFO non trovato' }, { status: 404 });
  }
  try {
    const content = await readFile(nfoFile, 'utf-8');
    const vid = extractTrailerId(content);
    if (vid) return NextResponse.json({ status: 'success', video_id: vid });
    return NextResponse.json({ status: 'error', message: 'Nessun trailer trovato nell\'NFO' }, { status: 404 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore lettura NFO: ${msg}` }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) return NextResponse.json({ status: 'error', message: 'Tipo non valido' }, { status: 400 });
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) return NextResponse.json({ status: 'error', message: 'ID non valido' }, { status: 400 });

  let body: { url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const url = typeof body.url === 'string' ? body.url : '';
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    return NextResponse.json({ status: 'error', message: 'URL YouTube non valido' }, { status: 400 });
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) return NextResponse.json({ status: 'error', message: 'Media non trovato (demo)' }, { status: 404 });
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json({ status: 'success', message: `Trailer salvato (demo) in ${type === 'sonarr' ? 'tvshow.nfo' : `${mockMedia.title}.nfo`}` });
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
  if (!ok) return NextResponse.json({ status: 'error', message: error! }, { status: 400 });
  if (!existsSync(localPath)) {
    try {
      await mkdir(localPath, { recursive: true });
    } catch (e) {
      return NextResponse.json({ status: 'error', message: `Impossibile creare la cartella: ${e instanceof Error ? e.message : e}` }, { status: 500 });
    }
  }
  const nfoName = getNfoFilename(type, localPath);
  const nfoFile = path.join(localPath, nfoName);
  const saved = await updateOrCreateNfo(nfoFile, type, videoId);
  if (saved) {
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json({ status: 'success', message: `Trailer salvato in ${nfoName}` });
  }
  return NextResponse.json({ status: 'error', message: 'Errore scrittura NFO' }, { status: 500 });
}
