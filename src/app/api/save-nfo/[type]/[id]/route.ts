/**
 * POST /api/save-nfo/[type]/[id] — atomically write the new NFO content to disk.
 *
 * Body: { raw: string }
 * - Validates that the XML is well-formed (basic check: starts with `<` and
 *   ends with `>` and has balanced root tag)
 * - Writes to a tmp file first, then atomic rename (no corruption on crash)
 * - Returns success / error message
 *
 * In demo mode, returns success without writing (no real media folder).
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { mediaCache } from '@/lib/cache';
// [0.7.8] Invalidate per-folder cache after writes — flags may have changed.
import { folderCache } from '@/lib/folder-cache';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

/**
 * Lightweight XML well-formedness check (no external deps):
 * - Has a root element
 * - Root open tag matches root close tag
 * - Has more opening than closing tags overall (rough balance)
 *
 * Not a substitute for a real XML parser but catches the worst mistakes.
 */
function isLikelyValidXml(raw: string): { ok: boolean; error?: string } {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, error: 'Contenuto vuoto' };
  }
  const trimmed = raw.trim();
  // Strip XML declaration
  const body = trimmed.replace(/^<\?xml[^>]*\?>\s*/, '');
  // Find root tag
  const openMatch = body.match(/^<([a-zA-Z_][\w-]*)\b[^>]*>/);
  if (!openMatch) {
    return { ok: false, error: 'Manca il tag radice di apertura' };
  }
  const rootTag = openMatch[1];
  const closePattern = new RegExp(`</${rootTag}>\\s*$`);
  if (!closePattern.test(body)) {
    return { ok: false, error: `Manca il tag di chiusura </${rootTag}>` };
  }
  // Count opening vs closing tags (rough)
  const opens = (body.match(/<[a-zA-Z_]/g) || []).length;
  const closes = (body.match(/<\/[a-zA-Z_]/g) || []).length;
  const selfClosing = (body.match(/<[a-zA-Z_][^>]*\/>/g) || []).length;
  if (opens - selfClosing !== closes) {
    return { ok: false, error: `Tag sbilanciati: ${opens - selfClosing} aperture vs ${closes} chiusure` };
  }
  return { ok: true };
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

  let body: { raw?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'JSON non valido' }, { status: 400 });
  }
  const raw = typeof body.raw === 'string' ? body.raw : '';
  if (!raw) {
    return NextResponse.json({ status: 'error', message: 'Contenuto NFO vuoto' }, { status: 400 });
  }

  // Validate XML well-formedness
  const validation = isLikelyValidXml(raw);
  if (!validation.ok) {
    return NextResponse.json(
      { status: 'error', message: `XML non valido: ${validation.error}` },
      { status: 400 },
    );
  }

  const settings = await loadSettings();

  // Demo mode: simulate success without writing
  if (shouldUseMock(type, settings)) {
    const mockMedia = getMockSingleMedia(type, mediaId);
    if (!mockMedia) {
      return NextResponse.json({ status: 'error', message: 'Media non trovato (demo)' }, { status: 404 });
    }
    const filename = getNfoFilename(type, mockMedia.path);
    return NextResponse.json({
      status: 'success',
      message: `NFO salvato in ${filename} (demo)`,
      demo: true,
    });
  }

  // Real mode: write to disk
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
      return NextResponse.json(
        { status: 'error', message: `Impossibile creare la cartella: ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
  }

  const filename = getNfoFilename(type, localPath);
  const nfoPath = path.join(localPath, filename);

  try {
    // Atomic write: tmp file + rename
    const tmpPath = nfoPath + '.tmp';
    await writeFile(tmpPath, raw, 'utf-8');
    const { rename } = await import('node:fs/promises');
    await rename(tmpPath, nfoPath);
    mediaCache.invalidatePrefix('media:');
  folderCache.invalidate(localPath);  // [0.7.8] per-folder cache
    return NextResponse.json({ status: 'success', message: `NFO salvato in ${filename}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: `Errore scrittura NFO: ${msg}` },
      { status: 500 },
    );
  }
}
