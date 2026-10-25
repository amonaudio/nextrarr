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
import { existsSync, statSync } from 'node:fs';
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
// [0.7.8] Folder-level cache for per-folder stat/readdir results.
// Reduces disk I/O when the same folder is scanned multiple times
// within 60s (e.g. /api/media + /api/artwork-files for the same media).
import { folderCache } from '@/lib/folder-cache';
import { shouldUseMock, getMockMediaList } from '@/lib/mock-data';
// [0.8.0] Media info mapping helpers (resolution/codec/audio → short labels).
import { resolutionLabel, videoCodecLabel, audioChannelsLabel } from '@/lib/media-info';
import type { MediaItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

const ART_KEYWORDS = ['clearlogo', 'clearart', 'banner', 'landscape', 'discart', 'keyart', 'logo'];

// [0.8.2] Never let the browser reuse a stale media list after an artwork
// replacement/delete or after the "Aggiorna" button cleared the server caches.
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

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

/**
 * [0.7.6] Look for a locally-downloaded poster named `<foldername>-poster.{ext}`
 * in the media folder. If found, return the URL of the /api/artwork-image route
 * that serves local files (with sanitizeFilename + path-traversal protection).
 *
 * This lets the user override Radarr's remote poster per media by simply
 * downloading a custom poster via the ArtworkModal (or placing the file
 * manually). The card will show the local file instead of Radarr's choice.
 *
 * Tries extensions in order: .jpg, .jpeg, .png (most common for posters).
 * Returns null if no local poster is found.
 */
function getLocalPosterUrl(
  mediaType: MediaType,
  mediaId: number,
  localPath: string,
): string | null {
  const folderName = path.basename(localPath.replace(/\/+$/, ''));
  if (!folderName) return null;
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const filename = `${folderName}-poster.${ext}`;
    const fullPath = path.join(localPath, filename);
    if (existsSync(fullPath)) {
      // The /api/artwork-image/[type]/[id]/[filename] route will sanitize the
      // filename, validate it stays under localPath, and serve the bytes.
      // encodeURIComponent handles spaces and special chars in folder names.
      //
      // [0.8.2] Append the file mtime as a cache-busting version. When the
      // user replaces a poster from the ArtworkModal, the URL changes even
      // though the filename is the same → React updates <img src> and the
      // browser re-fetches the new bytes immediately. Without this, the
      // browser keeps displaying the decoded old image until a full reload.
      try {
        const mtime = Math.floor(statSync(fullPath).mtimeMs);
        return `/api/artwork-image/${mediaType}/${mediaId}/${encodeURIComponent(filename)}?v=${mtime}`;
      } catch {
        return `/api/artwork-image/${mediaType}/${mediaId}/${encodeURIComponent(filename)}`;
      }
    }
  }
  return null;
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

/**
 * [0.8.0] In demo mode, synthesize media info badges deterministically
 * based on the media ID so the UI shows a realistic mix of resolutions
 * and codecs. Maps the same id%4 cycle to a 4K-HEVC / FHD-H264 / HD-H264 /
 * SD-Xvid combo — gives a nice visual variety on the demo grid.
 *
 * NOTE: audio channels always synthesized as "5.1" (the most common
 * surround setup) for cards #0 and #2, "2.0" (stereo) for the others.
 */
function synthesizeMediaInfo(id: number): {
  resolution: string | null;
  video_codec: string | null;
  audio_channels: string | null;
} {
  const mod = id % 4;
  switch (mod) {
    case 0: return { resolution: '4K',  video_codec: 'HEVC', audio_channels: '5.1' };
    case 1: return { resolution: 'FHD', video_codec: 'H264', audio_channels: '5.1' };
    case 2: return { resolution: 'HD',  video_codec: 'H264', audio_channels: '2.0' };
    case 3: return { resolution: 'SD',  video_codec: 'Xvid', audio_channels: '2.0' };
    default: return { resolution: null, video_codec: null, audio_channels: null };
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
  if (cached) return NextResponse.json(cached, { headers: NO_STORE });

  // Demo mode short-circuit
  if (shouldUseMock(type, settings)) {
    const mockList = getMockMediaList(type);
    const items: MediaItem[] = mockList.map((m) => {
      const flags = synthesizeFlags(m.id);
      // [0.8.0] Mock media info badges — deterministic per id%4.
      const mi = synthesizeMediaInfo(m.id);
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
        // [0.8.0] Media info badges (mock).
        resolution: mi.resolution,
        video_codec: mi.video_codec,
        audio_channels: mi.audio_channels,
      };
    });
    items.sort((a, b) => a.title.localeCompare(b.title));
    mediaCache.set(cacheKey, items);
    return NextResponse.json(items, { headers: NO_STORE });
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
      // [0.7.8] Check folderCache first — avoids redundant stat/readdir
      // when the same folder is scanned multiple times within 60s.
      const cached = folderCache.get(localPath);
      if (cached) {
        hasTheme = cached.hasTheme;
        hasArt = cached.hasArtwork;
        hasTrailer = cached.hasTrailer;
      } else {
        hasTheme = hasThemeMp3(localPath);
        hasArt = await hasExtraArtwork(localPath);
        const nfoName = getNfoFilename(type, localPath);
        const nfoFile = path.join(localPath, nfoName);
        hasTrailer = await hasTrailerInNfo(nfoFile);
        // Cache the per-folder flags for 60s (TTL in folderCache).
        // The posterPath field is computed lazily by findLocalPoster.
        folderCache.set(localPath, {
          artworkFiles: [],  // not used here — populated by artwork-files route
          hasTheme,
          hasArtwork: hasArt,
          hasTrailer,
          posterPath: null,   // computed below
        });
      }
    }

    // [0.7.6] Prefer a locally-downloaded poster (foldername-poster.ext)
    // over Radarr's remote URL. Lets the user customize the poster per
    // media by downloading one via the ArtworkModal or placing the file
    // manually. Falls back to Radarr's remote URL if no local poster is
    // found (or the folder doesn't exist on disk).
    const localPoster = folderExists ? getLocalPosterUrl(type, m.id, localPath) : null;
    const poster = localPoster ?? getPosterUrl(m);

    // [0.8.0] Extract media info badges (resolution / codec / audio channels)
    // from the ArrMedia. For Radarr movies: present in movieFile.mediaInfo.
    // For Sonarr series: statistics endpoint doesn't include per-file info,
    // so all three badges will be null (UI shows "—" placeholder).
    const resolution = resolutionLabel(m.movieFile?.quality?.quality?.resolution ?? null);
    const videoCodec = videoCodecLabel(m.movieFile?.mediaInfo?.videoCodec ?? null);
    const audioChannels = audioChannelsLabel(m.movieFile?.mediaInfo?.audioChannels ?? null);

    items.push({
      id: m.id,
      title: m.title || 'Sconosciuto',
      year: getYear(m, type),
      poster,
      // [0.7.12] Always include the remote Radarr poster as a fallback.
      // Used by MediaCard when the local poster route returns a 1x1
      // transparent PNG (file missing or has special chars in the
      // filename that the route can't serve). Previously the remote URL
      // was only stored when no local poster existed — so a local poster
      // that 404'd would show a gray "N/A" instead of falling back to
      // the Radarr TMDB image. Now we always have both URLs available.
      remote_poster: getPosterUrl(m),
      has_theme: hasTheme,
      has_artwork: hasArt,
      has_trailer: hasTrailer,
      is_mapped: isMapped,
      folder_exists: folderExists,
      root_folder: radarrPath,
      local_path: localPath,
      date_added: m.added ?? '',
      // [0.8.0] Media info badges (null for Sonarr — see comment above).
      resolution,
      video_codec: videoCodec,
      audio_channels: audioChannels,
    });
  }

  items.sort((a, b) => (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase()));
  mediaCache.set(cacheKey, items);
  return NextResponse.json(items, { headers: NO_STORE });
}
