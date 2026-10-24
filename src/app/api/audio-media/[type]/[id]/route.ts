/**
 * GET /api/audio-media/[type]/[id] — stream the theme.mp3 file.
 * In demo mode returns a 5-second silent WAV (seekable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

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

export async function GET(
  _req: NextRequest,
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
  const buf = await readFile(themePath);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
