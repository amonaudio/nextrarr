/**
 * POST /api/download-media/[type]/[id] — download a theme song for a media.
 * Body: { url?: string } — if URL is provided, download that; else yt-dlp search.
 *
 * In demo mode we simulate a successful download after a short delay.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { downloadAudio } from '@/lib/services/youtube';
import { mediaCache } from '@/lib/cache';
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
    // body without URL — that's fine, we'll search
  }
  const targetUrl = typeof body.url === 'string' && body.url.length > 0 ? body.url : null;

  const settings = await loadSettings();

  // Demo mode: simulate success after a short wait, clear cache
  if (shouldUseMock(type, settings)) {
    await new Promise((r) => setTimeout(r, 400));
    mediaCache.invalidatePrefix('media:');
    const mockMedia = getMockSingleMedia(type, mediaId);
    return NextResponse.json({
      status: 'success',
      message: `Tema scaricato per ${mockMedia?.title ?? 'media'} (demo)`,
    });
  }

  // Real mode
  let media: { title: string; path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { title: full.title, path: full.path };
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
      await fs.mkdir(localPath, { recursive: true });
    } catch (e) {
      return NextResponse.json(
        { status: 'error', message: `Impossibile creare la cartella: ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
  }

  const themeMp3 = path.join(localPath, 'theme.mp3');
  const outTemplate = path.join(localPath, 'theme.%(ext)s');
  const searchQuery = targetUrl ?? `ytsearch1:${media.title} theme song`;

  // Cleanup any previous partials (but keep existing theme.mp3 until new one is ready)
  try {
    const entries = await fs.readdir(localPath);
    for (const entry of entries) {
      if (entry.startsWith('theme.') && entry !== 'theme.mp3') {
        await fs.unlink(path.join(localPath, entry)).catch(() => {});
      }
    }
  } catch {
    // ignore
  }

  let success: boolean;
  try {
    success = await downloadAudio(searchQuery, outTemplate, 180000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore yt-dlp: ${msg}` }, { status: 500 });
  }

  if (!success) {
    return NextResponse.json(
      { status: 'error', message: 'Errore yt-dlp (download fallito)' },
      { status: 500 },
    );
  }

  // yt-dlp may have produced theme.m4a/opus instead of theme.mp3 — rename
  if (!existsSync(themeMp3)) {
    try {
      const entries = await fs.readdir(localPath);
      const candidates = entries
        .filter((e) => e.startsWith('theme.') && e !== 'theme.mp3')
        .map((e) => path.join(localPath, e));
      if (candidates.length > 0) {
        await fs.rename(candidates[0], themeMp3);
      }
    } catch (e) {
      console.error('[theme] rename failed:', e);
    }
  }

  if (existsSync(themeMp3)) {
    // Final cleanup of partials
    try {
      const entries = await fs.readdir(localPath);
      for (const entry of entries) {
        if (entry.startsWith('theme.') && entry !== 'theme.mp3') {
          await fs.unlink(path.join(localPath, entry)).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json({ status: 'success', message: `Tema scaricato per ${media.title}` });
  }

  return NextResponse.json(
    { status: 'error', message: 'Tema non trovato dopo il download' },
    { status: 500 },
  );
}
