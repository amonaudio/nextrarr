/**
 * GET /api/local-folder/[type]/[id]
 *
 * [0.8.3] Read-only listing of a media folder for the in-app folder modal.
 * This replaces the old idea of opening the server's file manager: browsers
 * cannot open Finder/Explorer on the server, so we show the contents here.
 *
 * Security: type/id are validated, the path comes from Radarr/Sonarr and is
 * resolved through the configured path map, then checked against the allowed
 * media prefixes. No user-supplied path is accepted, and the listing is not
 * recursive. Symlinks are reported but never followed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };
const MAX_ENTRIES = 500;

interface FolderEntry {
  name: string;
  type: 'directory' | 'file' | 'symlink';
  size: number | null;
}

function isValidType(type: string | undefined): type is MediaType {
  return type === 'radarr' || type === 'sonarr';
}

function mockListing(type: MediaType, mediaId: number) {
  const media = getMockSingleMedia(type, mediaId);
  if (!media) return null;
  const safeName = media.title.replace(/[^a-zA-Z0-9-_(). ]/g, '').trim() || 'media';
  const entries: FolderEntry[] = [
    { name: `${safeName}-poster.jpg`, type: 'file', size: 842_133 },
    { name: `${safeName}-fanart.jpg`, type: 'file', size: 1_248_902 },
    { name: `${safeName}.mkv`, type: 'file', size: 4_812_441_600 },
    { name: type === 'sonarr' ? 'tvshow.nfo' : `${safeName}.nfo`, type: 'file', size: 12_840 },
    { name: 'Extras', type: 'directory', size: null },
    { name: 'theme.mp3', type: 'file', size: 3_211_482 },
  ];
  return { path: media.path, entries, truncated: false };
}

export async function GET(
  _req: NextRequest,
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

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    const listing = mockListing(type, mediaId);
    if (!listing) {
      return NextResponse.json({ status: 'error', message: 'Media non trovato' }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(listing, { headers: NO_STORE });
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

  let dirents;
  try {
    const info = await lstat(localPath);
    if (!info.isDirectory()) {
      return NextResponse.json({ status: 'error', message: 'Il percorso non è una cartella' }, { status: 400, headers: NO_STORE });
    }
    dirents = await readdir(localPath, { withFileTypes: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: `Impossibile leggere la cartella: ${msg}` },
      { status: 500, headers: NO_STORE },
    );
  }

  const sorted = [...dirents].sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, 'it', { numeric: true, sensitivity: 'base' });
  });
  const limited = sorted.slice(0, MAX_ENTRIES);

  const entries: FolderEntry[] = await Promise.all(
    limited.map(async (dirent) => {
      const entryType: FolderEntry['type'] = dirent.isDirectory()
        ? 'directory'
        : dirent.isSymbolicLink()
          ? 'symlink'
          : 'file';
      let size: number | null = null;
      if (entryType === 'file') {
        try {
          size = (await lstat(path.join(localPath, dirent.name))).size;
        } catch {
          // The file disappeared between readdir and lstat — keep the name.
        }
      }
      return { name: dirent.name, type: entryType, size };
    }),
  );

  return NextResponse.json(
    { path: localPath, entries, truncated: sorted.length > MAX_ENTRIES },
    { headers: NO_STORE },
  );
}
