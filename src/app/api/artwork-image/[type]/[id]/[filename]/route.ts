/**
 * GET /api/artwork-image/[type]/[id]/[filename] — serve a local artwork image.
 * Filename is sanitized via sanitizeFilename() to prevent traversal.
 * In demo mode returns a 1x1 transparent PNG.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { sanitizeFilename } from '@/lib/security';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

const TRANSPARENT_1PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgYAAAAAMAASsJXQAAAAAASUVORK5CYII=',
  'base64',
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string; filename: string }> },
) {
  const { type, id, filename } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 });
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
  }
  // CRITICAL: sanitize the filename to prevent traversal
  const safeName = sanitizeFilename(decodeURIComponent(filename));
  if (!safeName) {
    return NextResponse.json({ error: 'Filename non valido' }, { status: 400 });
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    // Return a 1x1 transparent PNG so the <img> doesn't break
    return new NextResponse(TRANSPARENT_1PX_PNG as unknown as BodyInit, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch {
    return NextResponse.json({ error: 'Media non trovato' }, { status: 404 });
  }
  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) return NextResponse.json({ error: error! }, { status: 400 });

  const filePath = path.join(localPath, safeName);
  // Defense in depth: ensure resolved path stays under localPath
  if (!path.resolve(filePath).startsWith(path.resolve(localPath).replace(/\/+$/, '') + '/')) {
    return NextResponse.json({ error: 'Path traversal bloccato' }, { status: 400 });
  }
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  const buf = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/jpeg';
  return new NextResponse(buf as unknown as BodyInit, { status: 200, headers: { 'Content-Type': mime } });
}
