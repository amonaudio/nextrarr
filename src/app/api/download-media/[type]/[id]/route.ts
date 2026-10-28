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
// [0.7.8] Invalidate the per-folder cache after a successful download —
// the hasTheme flag for this folder changed, so the next /api/media call
// would otherwise return stale data for up to 60s.
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

  // [0.7.3] Record the mtime of any existing theme.mp3 BEFORE the download,
  // so we can verify afterwards whether yt-dlp actually wrote a new file
  // or skipped (e.g. if --force-overwrites was removed or yt-dlp changed
  // behavior). The previous code always returned "success" if the file
  // existed after the call — even if yt-dlp had just skipped the download
  // and left the old file untouched → misleading green toast.
  let preDownloadMtime = 0;
  try {
    if (existsSync(themeMp3)) {
      const stat = await fs.stat(themeMp3);
      preDownloadMtime = stat.mtimeMs;
    }
  } catch {
    // ignore — proceed with download
  }

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

    // [0.7.3] Verify the file was actually rewritten. If the mtime hasn't
    // changed, yt-dlp skipped the download (shouldn't happen with
    // --force-overwrites, but be defensive — yt-dlp versions change).
    let actuallyDownloaded = true;
    try {
      const postStat = await fs.stat(themeMp3);
      if (preDownloadMtime > 0 && postStat.mtimeMs <= preDownloadMtime) {
        actuallyDownloaded = false;
      }
    } catch {
      // ignore — assume downloaded
    }

    mediaCache.invalidatePrefix('media:');
    // [0.7.8] Invalidate the per-folder cache so the next /api/media call
    // picks up the new hasTheme flag (otherwise it'd be stale for 60s).
    folderCache.invalidate(localPath);
    if (actuallyDownloaded) {
      const action = preDownloadMtime > 0 ? 'aggiornato' : 'scaricato';
      return NextResponse.json({
        status: 'success',
        message: `Tema ${action} per ${media.title}`,
      });
    }
    // File exists but wasn't rewritten — yt-dlp skipped. Tell the user
    // honestly instead of claiming success.
    return NextResponse.json({
      status: 'success',
      message: `Tema già esistente per ${media.title} (yt-dlp non lo ha sovrascritto — aggiorna yt-dlp con: docker exec -it extrarr pip3 install --upgrade --break-system-packages yt-dlp)`,
    });
  }

  return NextResponse.json(
    { status: 'error', message: 'Tema non trovato dopo il download' },
    { status: 500 },
  );
}
