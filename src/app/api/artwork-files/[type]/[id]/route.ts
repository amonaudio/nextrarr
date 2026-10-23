/**
 * GET /api/artwork-files/[type]/[id] — list local artwork files for a media.
 * In demo mode returns a stable set of mock filenames.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { scanLocalArtwork } from '@/lib/services/artwork';
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
  return NextResponse.json(await scanLocalArtwork(localPath));
}
