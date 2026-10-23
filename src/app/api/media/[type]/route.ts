/**
 * GET /api/media/[type] — list media (movies or series) with status flags.
 * Mirrors the Flask endpoint: scans the local folder for theme.mp3,
 * artwork files, and the trailer tag in the NFO.
 *
 * Returns mock data when EXTRARR_DEMO_MODE=1 OR when the API key is missing.
 * In demo mode we synthesize plausible has_theme/has_artwork/has_trailer
 * combinations so the UI shows realistic state.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { loadSettings } from '@/lib/settings-store';
import {
  fetchMediaList,
  type ArrMedia,
  type MediaType,
} from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { hasThemeMp3, hasExtraArtwork } from '@/lib/services/artwork';
import { mediaCache } from '@/lib/cache';
import { shouldUseMock, getMockMediaList } from '@/lib/mock-data';
import type { MediaItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

const ART_KEYWORDS = ['clearlogo', 'clearart', 'banner', 'landscape', 'discart', 'keyart', 'logo'];

async function hasTrailerInNfo(nfoPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(nfoPath, 'utf-8');
    const lower = content.toLowerCase();
    return lower.includes('<trailer>') && lower.includes('</trailer>');
  } catch {
    return false;
  }
}

function getPosterUrl(media: ArrMedia): string {
  for (const img of media.images ?? []) {
    if (img.coverType === 'poster') return img.remoteUrl ?? '';
  }
  return '';
}

function getYear(media: ArrMedia, mediaType: MediaType): number | string {
  if (media.year) return media.year;
  if (mediaType === 'sonarr' && media.firstAired) {
    return media.firstAired.slice(0, 4);
  }
  return 'N/A';
}

/**
 * In demo mode we synthesize status flags deterministically based on the
 * media ID so the UI shows a mix of complete / partial / empty cards.
 */
function synthesizeFlags(id: number): { theme: boolean; art: boolean; trailer: boolean } {
  const mod = id % 4;
  switch (mod) {
    case 0: return { theme: true, art: true, trailer: true };
    case 1: return { theme: false, art: false, trailer: false };
    case 2: return { theme: true, art: false, trailer: false };
    case 3: return { theme: false, art: true, trailer: true };
    default: return { theme: false, art: false, trailer: false };
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: 'Tipo media non valido' }, { status: 400 });
  }

  const settings = await loadSettings();
  const cacheKey = `media:${type}`;
  const cached = mediaCache.get<MediaItem[]>(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Demo mode short-circuit
  if (shouldUseMock(type, settings)) {
    const mockList = getMockMediaList(type);
    const items: MediaItem[] = mockList.map((m) => {
      const flags = synthesizeFlags(m.id);
      return {
        id: m.id,
        title: m.title,
        year: getYear(m, type),
        poster: getPosterUrl(m),
        has_theme: flags.theme,
        has_artwork: flags.art,
        has_trailer: flags.trailer,
        // In demo mode we mark everything as mapped + folder exists so the UI
        // shows the full action set (no yellow warning icons everywhere).
        is_mapped: true,
        folder_exists: true,
        root_folder: m.path,
        local_path: m.path,
        date_added: m.added ?? '',
      };
    });
    items.sort((a, b) => a.title.localeCompare(b.title));
    mediaCache.set(cacheKey, items);
    return NextResponse.json(items);
  }

  // Real mode
  let raw: ArrMedia[];
  try {
    raw = await fetchMediaList(settings, type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Errore connessione ${type}: ${msg}` }, { status: 500 });
  }

  const items: MediaItem[] = [];
  for (const m of raw) {
    const radarrPath = m.path ?? '';
    const localPath = resolveLocalPath(radarrPath, settings.pathMap);
    const { ok: isMapped } = validateLocalPath(localPath);
    const folderExists = Boolean(isMapped && localPath && existsSync(localPath));

    let hasTheme = false;
    let hasArt = false;
    let hasTrailer = false;

    if (folderExists) {
      hasTheme = hasThemeMp3(localPath);
      hasArt = await hasExtraArtwork(localPath);
      const nfoName = getNfoFilename(type, localPath);
      const nfoFile = path.join(localPath, nfoName);
      hasTrailer = await hasTrailerInNfo(nfoFile);
    }

    items.push({
      id: m.id,
      title: m.title || 'Sconosciuto',
      year: getYear(m, type),
      poster: getPosterUrl(m),
      has_theme: hasTheme,
      has_artwork: hasArt,
      has_trailer: hasTrailer,
      is_mapped: isMapped,
      folder_exists: folderExists,
      root_folder: radarrPath,
      local_path: localPath,
      date_added: m.added ?? '',
    });
  }

  items.sort((a, b) => (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase()));
  mediaCache.set(cacheKey, items);
  return NextResponse.json(items);
}
