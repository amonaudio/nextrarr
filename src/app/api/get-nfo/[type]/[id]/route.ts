/**
 * GET /api/get-nfo/[type]/[id] — return the raw NFO file content + filename.
 *
 * In demo mode returns a mock NFO based on the mock media data so the editor UI
 * is fully testable without a real Radarr connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

/**
 * Build a representative mock NFO so the editor UI is fully usable in demo mode.
 */
function buildMockNfo(mediaType: MediaType, title: string, year: number | string): string {
  const rootTag = mediaType === 'radarr' ? 'movie' : 'tvshow';
  const tmdbId = 12345;
  const imdbId = 'tt0000000';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<${rootTag}>
  <title>${title}</title>
  <originaltitle>${title}</originaltitle>
  <sorttitle>${title}</sorttitle>
  <rating name="themoviedb" max="10" default="true">8.5</rating>
  <year>${year}</year>
  <premiered>${year}-01-01</premiered>
  <runtime>120</runtime>
  <mpaa>Not Rated</mpaa>
  <studio>Demo Studio</studio>
  <genre>Science Fiction</genre>
  <genre>Action</genre>
  <director>Demo Director</director>
  <writer>Demo Writer</writer>
  <plot>This is a mock plot generated for demo mode. Configure Radarr API key to edit the real NFO file.</plot>
  <outline>Mock outline for demo mode.</outline>
  <tag>demo</tag>
  <uniqueid type="tmdb" default="true">${tmdbId}</uniqueid>
  <uniqueid type="imdb">${imdbId}</uniqueid>
  <trailer>plugin://plugin.video.youtube/play/?video_id=dQw4w9WgXcQ</trailer>
</${rootTag}>
`;
}

export async function GET(
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

  // Demo mode: synthesize a mock NFO so the editor UI is usable
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) {
      return NextResponse.json({ status: 'error', message: 'Media non trovato (demo)' }, { status: 404 });
    }
    const raw = buildMockNfo(type, mockMedia.title, mockMedia.year ?? 'N/A');
    const filename = getNfoFilename(type, mockMedia.path);
    return NextResponse.json({
      raw,
      filename,
      localPath: mockMedia.path,
      demo: true,
    });
  }

  // Real mode: read the actual NFO file from disk
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

  const filename = getNfoFilename(type, localPath);
  const nfoPath = path.join(localPath, filename);

  if (!existsSync(nfoPath)) {
    // NFO doesn't exist yet — return an empty template so the editor can create it
    const rootTag = type === 'radarr' ? 'movie' : 'tvshow';
    const raw = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${rootTag}>\n  <title>${escapeXml(media.title)}</title>\n</${rootTag}>\n`;
    return NextResponse.json({
      raw,
      filename,
      localPath,
      isNew: true,
    });
  }

  try {
    const raw = await readFile(nfoPath, 'utf-8');
    return NextResponse.json({ raw, filename, localPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore lettura NFO: ${msg}` }, { status: 500 });
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
