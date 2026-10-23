/**
 * TMDB API client — port of app/services/tmdb.py
 */

import type { MediaType, ArrMedia } from './radarr-sonarr';
import type { BrowseArtworkItem } from './fanart';

interface TmdbImage {
  file_path?: string;
  iso_639_1?: string | null;
  vote_average?: number;
}

interface TmdbImagesResponse {
  logos?: TmdbImage[];
  backdrops?: TmdbImage[];
  posters?: TmdbImage[];
}

async function resolveTmdbId(
  tmdbKey: string,
  media: ArrMedia,
  mediaType: MediaType,
  timeout = 10000,
): Promise<number | null> {
  if (media.tmdbId) return media.tmdbId;
  if (mediaType !== 'sonarr') return null;
  const tvdbId = media.tvdbId;
  if (!tmdbKey || !tvdbId) return null;
  try {
    const url = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${tmdbKey}&external_source=tvdb_id`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const data = await res.json() as { tv_results?: { id?: number }[] };
      return data.tv_results?.[0]?.id ?? null;
    } finally {
      clearTimeout(tid);
    }
  } catch {
    return null;
  }
}

export async function fetchImages(
  tmdbKey: string,
  media: ArrMedia,
  mediaType: MediaType,
  timeout = 15000,
): Promise<TmdbImagesResponse> {
  if (!tmdbKey) throw new Error('TMDB API Key mancante');
  const tmdbId = await resolveTmdbId(tmdbKey, media, mediaType);
  if (!tmdbId) throw new Error('TMDB ID non disponibile');
  const endpoint = mediaType === 'radarr' ? 'movie' : 'tv';
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/images?api_key=${tmdbKey}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TMDB API HTTP ${res.status}`);
    return await res.json() as TmdbImagesResponse;
  } finally {
    clearTimeout(tid);
  }
}

export function parseImagesForBrowse(data: TmdbImagesResponse): BrowseArtworkItem[] {
  const result: BrowseArtworkItem[] = [];
  for (const logo of data.logos ?? []) {
    if (!logo.file_path) continue;
    result.push({
      ourType: 'clearlogo',
      ext: 'png',
      url: `https://image.tmdb.org/t/p/original${logo.file_path}`,
      lang: logo.iso_639_1 ?? 'N/D',
      likes: String(logo.vote_average ?? 0),
    });
  }
  for (const bd of data.backdrops ?? []) {
    if (!bd.file_path) continue;
    result.push({
      ourType: 'landscape',
      ext: 'jpg',
      url: `https://image.tmdb.org/t/p/original${bd.file_path}`,
      lang: bd.iso_639_1 ?? 'N/D',
      likes: String(bd.vote_average ?? 0),
    });
  }
  for (const p of data.posters ?? []) {
    if (!p.file_path) continue;
    result.push({
      ourType: 'poster',
      ext: 'jpg',
      url: `https://image.tmdb.org/t/p/original${p.file_path}`,
      lang: p.iso_639_1 ?? 'N/D',
      likes: String(p.vote_average ?? 0),
    });
  }
  return result;
}
