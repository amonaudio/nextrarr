/**
 * GET /api/get-trailer/[type]/[id] — extract trailer YouTube ID from NFO.
 *
 * [0.7.4] This route is now GET-only. The trailer-save logic (formerly a
 * POST handler also exported here) has moved to the dedicated route:
 *   POST /api/set-trailer/[type]/[id]
 * That split fixes the "Errore di rete" toast that appeared when the user
 * clicked "Usa come Trailer" in the VideoModal — the frontend was calling
 * /api/set-trailer/... but no such file existed, so Next.js returned 404
 * HTML, which failed JSON parsing on the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { extractTrailerId } from '@/lib/nfo';
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

// [0.7.4] The POST handler that lived here has been moved to the dedicated
// route `/api/set-trailer/[type]/[id]/route.ts`. This file is now GET-only,
// matching the README's documented API and the convention that "get-*" reads
// and "set-*" writes. See the new set-trailer route for the implementation.

