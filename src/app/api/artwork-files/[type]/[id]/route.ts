/**
 * GET /api/artwork-files/[type]/[id] — list local artwork files for a media.
 * In demo mode returns a stable set of mock filenames.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { scanLocalArtwork } from '@/lib/services/artwork';
// [0.7.8] Reuse the folder-level cache populated by /api/media for the
// artwork-files list. Same folder, same readdir → cache hit avoids a
// second disk round-trip when the user opens an ArtworkModal that was
// already scanned during the grid render.
import { folderCache } from '@/lib/folder-cache';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) return NextResponse.json([]);
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) return NextResponse.json([]);

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    // Mock: pretend the first few media have a clearlogo + banner
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) return NextResponse.json([]);
    const safeName = mockMedia.title.replace(/[^a-zA-Z0-9-_(). ]/g, '').trim() || 'movie';
    const files: string[] = [];
    if (mediaId % 2 === 0) files.push(`${safeName}-clearlogo.png`);
    if (mediaId % 3 === 0) files.push(`${safeName}-banner.jpg`);
    if (mediaId % 5 === 0) files.push(`${safeName}-landscape.jpg`);
    return NextResponse.json(files);
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch {
    return NextResponse.json([]);
  }
  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok } = validateLocalPath(localPath);
  if (!ok) return NextResponse.json([]);

  // [0.7.8] Check folderCache first. If /api/media already scanned this
  // folder within the last 60s, the artwork files list is in the cache.
  // Falls back to a fresh scanLocalArtwork() call otherwise, and populates
  // the cache for the next caller.
  const cached = folderCache.get(localPath);
  if (cached && cached.artworkFiles.length > 0) {
    return NextResponse.json(cached.artworkFiles);
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
  return NextResponse.json(files);
}
