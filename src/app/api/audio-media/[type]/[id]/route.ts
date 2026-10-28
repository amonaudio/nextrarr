/**
 * GET /api/audio-media/[type]/[id] — stream the theme.mp3 file.
 * In demo mode returns a 5-second silent WAV (seekable).
 *
 * [0.7.7] Real mode now supports HTTP Range requests, enabling the
 * browser's <audio> element to seek within the file. Previously the
 * route loaded the entire file into RAM via `readFile()` and returned
 * it as a single 200 response with no `Accept-Ranges` header — the
 * browser could play the file but the seek bar was effectively a
 * no-op (or worked only after the whole file buffered).
 *
 * The fix uses `fs.stat` to get the file size, then checks the
 * `Range` request header. If present, returns 206 Partial Content with
 * `Content-Range` + the byte slice. If not, returns the whole file
 * as 200 with `Accept-Ranges: bytes` so the browser knows it can
 * re-issue a ranged request for seeking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

/** Generate a proper silent WAV file (seekable in all browsers). */
function generateSilentWav(durationSec: number = 5): Buffer {
  const sampleRate = 44100;
  const bitsPerSample = 16;
  const numChannels = 1;
  const dataSize = durationSec * sampleRate * (bitsPerSample / 8) * numChannels;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

/**
 * [0.7.7] Parse an HTTP `Range: bytes=start-end` header.
 * Returns `{ start, end }` (inclusive end) or null if missing/invalid.
 * Supports:
 *   - `bytes=0-` (from 0 to end of file)
 *   - `bytes=100-200` (specific range)
 *   - `bytes=-500` (last 500 bytes)
 */
function parseRange(rangeHeader: string | null, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;
  const spec = rangeHeader.slice(6).trim();
  const dashIdx = spec.indexOf('-');
  if (dashIdx < 0) return null;
  const startStr = spec.slice(0, dashIdx);
  const endStr = spec.slice(dashIdx + 1);
  let start: number;
  let end: number;
  if (startStr === '') {
    // suffix: bytes=-500 → last 500 bytes
    const len = parseInt(endStr, 10);
    if (!Number.isFinite(len) || len <= 0) return null;
    start = Math.max(0, fileSize - len);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    if (!Number.isFinite(start) || start < 0 || start >= fileSize) return null;
    end = endStr === '' ? fileSize - 1 : parseInt(endStr, 10);
    if (!Number.isFinite(end) || end < start) return null;
    if (end >= fileSize) end = fileSize - 1;
  }
  return { start, end };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 });
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const silentWav = generateSilentWav(5);
    return new NextResponse(silentWav as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(silentWav.length),
        // [0.7.7] Advertise range support so the browser knows the WAV
        // is seekable (even though it's small — Chrome in particular
        // won't try to seek without this header).
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) {
    return NextResponse.json({ error: error! }, { status: 400 });
  }

  const themePath = path.join(localPath, "theme.mp3");
  if (!existsSync(themePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // [0.7.7] Stream the file with HTTP Range support for seeking.
  // Previously the whole file was loaded into RAM via readFile() — for
  // large libraries with many concurrent plays this could OOM the
  // container. Now we stat the file and createReadStream on the slice.
  const stat = statSync(themePath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.get('range');
  const range = parseRange(rangeHeader, fileSize);

  if (range) {
    const { start, end } = range;
    const contentLength = end - start + 1;
    const stream = createReadStream(themePath, { start, end });
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(contentLength),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  }

  // No Range header → return the whole file (200), but advertise range
  // support so the browser can issue ranged requests for seeking.
  const stream = createReadStream(themePath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
