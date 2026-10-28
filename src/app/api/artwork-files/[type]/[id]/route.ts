/**
 * GET    /api/artwork-files/[type]/[id] — list local artwork files.
 * DELETE /api/artwork-files/[type]/[id]?filename=... — delete one local
 *        artwork file (only files recognized as artwork).
 *
 * In demo mode GET returns a stable set of mock filenames and DELETE marks
 * a mock filename as deleted in memory, so the UI flow can be tested
 * without writing to disk.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { unlink } from 'node:fs/promises';

import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { scanLocalArtwork, isArtworkFilename } from '@/lib/services/artwork';
// [0.7.8] Reuse the folder-level cache populated by /api/media for the
// artwork-files list. Same folder, same readdir → cache hit avoids a
// second disk round-trip when the user opens an ArtworkModal that was
// already scanned during the grid render.
import { folderCache } from '@/lib/folder-cache';
import { mediaCache } from '@/lib/cache';
import { sanitizeFilename } from '@/lib/security';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

// Demo mode has no real files; track deletions per process so the item
// disappears from the modal after a (simulated) delete.
const demoDeletedArtwork = new Set<string>();

function demoKey(type: MediaType, id: number, filename: string): string {
  return `${type}:${id}:${filename}`;
}

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) return NextResponse.json([], { headers: NO_STORE });
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) return NextResponse.json([], { headers: NO_STORE });

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    // Mock: pretend the first few media have a clearlogo + banner
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) return NextResponse.json([], { headers: NO_STORE });
    const safeName = mockMedia.title.replace(/[^a-zA-Z0-9-_(). ]/g, '').trim() || 'movie';
    const files: string[] = [];
    if (mediaId % 2 === 0) files.push(`${safeName}-clearlogo.png`);
    if (mediaId % 3 === 0) files.push(`${safeName}-banner.jpg`);
    if (mediaId % 5 === 0) files.push(`${safeName}-landscape.jpg`);
    return NextResponse.json(
      files.filter((f) => !demoDeletedArtwork.has(demoKey(type, mediaId, f))),
      { headers: NO_STORE },
    );
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch {
    return NextResponse.json([], { headers: NO_STORE });
  }
  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok } = validateLocalPath(localPath);
  if (!ok) return NextResponse.json([], { headers: NO_STORE });

  // [0.7.8] Check folderCache first. If /api/media already scanned this
  // folder within the last 60s, the artwork files list is in the cache.
  // Falls back to a fresh scanLocalArtwork() call otherwise, and populates
  // the cache for the next caller.
  const cached = folderCache.get(localPath);
  if (cached && cached.artworkFiles.length > 0) {
    return NextResponse.json(cached.artworkFiles, { headers: NO_STORE });
  }
  const files = await scanLocalArtwork(localPath);
  // Merge with existing cache entry (if any) — don't blow away the
  // hasTheme/hasArtwork/hasTrailer flags just because we filled in
  // artworkFiles now.
  if (cached) {
    folderCache.set(localPath, { ...cached, artworkFiles: files });
  } else {
    folderCache.set(localPath, {
      artworkFiles: files,
      hasTheme: false,         // unknown here, populated by /api/media
      hasArtwork: files.length > 0,
      hasTrailer: false,
      posterPath: null,
    });
  }
  return NextResponse.json(files, { headers: NO_STORE });
}

/**
 * [0.8.2] Delete a single local artwork file.
 *
 * Security:
 *   - type/id validation (same as GET)
 *   - filename sanitized and required to be EXACTLY the sanitized value
 *     (rejects paths and traversal attempts)
 *   - only files matching the artwork keyword/extension whitelist can be
 *     deleted (theme.mp3, .nfo, subtitles, etc. are rejected)
 *   - resolved path must stay inside the media folder
 *   - mediaCache + folderCache invalidated so flags/poster update at once
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ status: 'error', message: 'Tipo non valido' }, { status: 400, headers: NO_STORE });
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json({ status: 'error', message: 'ID non valido' }, { status: 400, headers: NO_STORE });
  }

  const filename = req.nextUrl.searchParams.get('filename') ?? '';
  if (!filename) {
    return NextResponse.json({ status: 'error', message: 'Filename mancante' }, { status: 400, headers: NO_STORE });
  }
  const safeName = sanitizeFilename(filename);
  if (!safeName || safeName !== filename || !isArtworkFilename(safeName)) {
    return NextResponse.json(
      { status: 'error', message: 'Filename non valido o non è un artwork gestito' },
      { status: 400, headers: NO_STORE },
    );
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) {
      return NextResponse.json({ status: 'error', message: 'Media non trovato' }, { status: 404, headers: NO_STORE });
    }
    demoDeletedArtwork.add(demoKey(type, mediaId, safeName));
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json(
      { status: 'success', message: `Artwork ${safeName} eliminato (demo)` },
      { headers: NO_STORE },
    );
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: msg }, { status: 500, headers: NO_STORE });
  }

  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) {
    return NextResponse.json({ status: 'error', message: error! }, { status: 400, headers: NO_STORE });
  }
  if (!existsSync(localPath)) {
    return NextResponse.json(
      { status: 'error', message: 'La cartella del media non esiste sul disco' },
      { status: 404, headers: NO_STORE },
    );
  }

  const filePath = path.join(localPath, safeName);
  // Defense in depth: ensure the resolved path stays under localPath.
  const resolvedBase = path.resolve(localPath).replace(/\/+$/, '') + '/';
  if (!path.resolve(filePath).startsWith(resolvedBase)) {
    return NextResponse.json({ status: 'error', message: 'Path traversal bloccato' }, { status: 400, headers: NO_STORE });
  }
  if (!existsSync(filePath)) {
    return NextResponse.json({ status: 'error', message: 'Artwork non trovato' }, { status: 404, headers: NO_STORE });
  }

  try {
    await unlink(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: `Impossibile eliminare il file: ${msg}` },
      { status: 500, headers: NO_STORE },
    );
  }

  mediaCache.invalidatePrefix('media:');
  folderCache.invalidate(localPath);

  return NextResponse.json(
    { status: 'success', message: `Artwork ${safeName} eliminato` },
    { headers: NO_STORE },
  );
}
