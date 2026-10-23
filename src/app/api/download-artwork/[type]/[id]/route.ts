/**
 * POST /api/download-artwork/[type]/[id] — batch download best Fanart artwork.
 * In demo mode simulates a success message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { fetchArtwork, parseArtworkForDownload } from '@/lib/services/fanart';
import { mediaCache } from '@/lib/cache';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

async function fetchBuf(url: string, timeoutMs = 15000): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(tid);
  }
}

export async function POST(
  _req: NextRequest,
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

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json({
      status: 'success',
      message: 'Scaricate 3 artwork: clearlogo.png, clearart.png, banner.jpg (demo)',
    });
  }
  if (!settings.fanartApiKey) {
    return NextResponse.json({ status: 'error', message: 'Fanart API Key mancante' }, { status: 400 });
  }

  let media;
  try {
    media = await fetchSingleMedia(settings, type, mediaId);
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

  const artId = type === 'radarr' ? media.tmdbId : media.tvdbId;
  if (!artId) {
    return NextResponse.json({ status: 'error', message: 'ID (TMDB/TVDB) mancante' }, { status: 400 });
  }

  let fanartData;
  try {
    fanartData = await fetchArtwork(settings.fanartApiKey, type, artId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore API Fanart.tv: ${msg}` }, { status: 500 });
  }

  const folderName = path.basename(localPath.replace(/\/+$/, ''));
  const downloads = parseArtworkForDownload(fanartData, type);
  const saved: string[] = [];

  for (const [filename, url] of Object.entries(downloads)) {
    const savePath = path.join(localPath, `${folderName}-${filename}`);
    if (existsSync(savePath)) continue; // don't overwrite
    try {
      const buf = await fetchBuf(url);
      await import('node:fs/promises').then((fs) => fs.writeFile(savePath, Buffer.from(buf)));
      saved.push(filename);
    } catch (err) {
      console.warn(`[artwork-batch] failed ${filename} from ${url}:`, err);
    }
  }

  mediaCache.invalidatePrefix('media:');
  if (saved.length > 0) {
    return NextResponse.json({
      status: 'success',
      message: `Scaricate ${saved.length} artwork: ${saved.join(', ')}`,
    });
  }
  return NextResponse.json({ status: 'success', message: 'Nessuna artwork extra trovata' });
}
