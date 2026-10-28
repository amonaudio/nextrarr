/**
 * Fanart.tv client — port of app/services/fanart.py
 */

import type { MediaType } from './radarr-sonarr';
// [0.7.9] Cache Fanart.tv API responses (30 min TTL) to avoid hammering
// the external API on every ArtworkModal open. Same artwork for a given
// movie/series doesn't change day-to-day.
import { externalCache, externalCacheKeys } from '../external-cache';

interface FanartItem {
  url?: string;
  lang?: string;
  likes?: string | number;
}

interface FanartResponse {
  [key: string]: FanartItem[] | undefined;
}

const FILENAME_MAP_MOVIES: Record<string, string> = {
  hdmovielogo: 'clearlogo.png',
  movielogo: 'clearlogo.png',
  hdmovieclearart: 'clearart.png',
  movieart: 'clearart.png',
  moviebanner: 'banner.jpg',
  moviedisc: 'discart.png',
  moviethumb: 'landscape.jpg',
};

const FILENAME_MAP_TV: Record<string, string> = {
  hdtvlogo: 'clearlogo.png',
  clearlogo: 'clearlogo.png',
  hdclearart: 'clearart.png',
  clearart: 'clearart.png',
  tvbanner: 'banner.jpg',
  tvthumb: 'landscape.jpg',
};

const TYPE_MAP: Record<string, string> = {
  hdmovielogo: 'clearlogo', movielogo: 'clearlogo',
  hdmovieclearart: 'clearart', movieart: 'clearart',
  moviebanner: 'banner', moviedisc: 'discart', moviethumb: 'landscape',
  hdtvlogo: 'clearlogo', clearlogo: 'clearlogo',
  hdclearart: 'clearart', clearart: 'clearart',
  tvbanner: 'banner', tvthumb: 'landscape',
};

export interface BrowseArtworkItem {
  // [0.7.5] Field renamed from `ourType` to `our_type` for consistency
  // with the frontend `ArtworkItem` type and the API contract
  // (the download-specific-artwork route expects `our_type` in the body).
  // Previously, the frontend's `item.our_type` access silently returned
  // `undefined` because the JSON had `ourType` (camelCase), which caused
  // the route to reject the request with "Dati mancanti".
  our_type: string;
  ext: string;
  url: string;
  lang: string;
  likes: string;
}

function parseLikes(v: string | number | undefined): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchArtwork(
  fanartKey: string,
  mediaType: MediaType,
  artId: number | string,
  timeout = 15000,
): Promise<FanartResponse> {
  if (!fanartKey) throw new Error('Fanart API Key mancante');
  // [0.7.9] Check cache first — same movie/series artwork doesn't change
  // day-to-day, and Fanart.tv is rate-limit-prone. The fetcher closure is
  // only called on cache miss.
  const cacheKey = externalCacheKeys.fanart(mediaType, artId);
  return externalCache.getOrFetch(cacheKey, async () => {
    const category = mediaType === 'radarr' ? 'movies' : 'tv';
    const url = `https://webservice.fanart.tv/v3/${category}/${artId}?api_key=${fanartKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Fanart API key non valida o mancante (HTTP ${res.status}). Verifica la chiave nelle Impostazioni.`);
        }
        if (res.status === 404) {
          throw new Error(`Fanart non ha artwork per ${mediaType} ID ${artId} (HTTP 404). L'ID potrebbe non essere registrato su Fanart.tv.`);
        }
        throw new Error(`Fanart API HTTP ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(`Fanart ha restituito HTML invece di JSON (Content-Type: ${contentType}). Probabile URL/API key errati.`);
      }
      return await res.json() as FanartResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

/**
 * Return {local_filename: best_image_url} for batch download.
 */
export function parseArtworkForDownload(
  data: FanartResponse,
  mediaType: MediaType,
): Record<string, string> {
  const map = mediaType === 'radarr' ? FILENAME_MAP_MOVIES : FILENAME_MAP_TV;
  const result: Record<string, string> = {};
  for (const [ftType, filename] of Object.entries(map)) {
    const items = data[ftType];
    if (!Array.isArray(items) || items.length === 0) continue;
    const sorted = [...items].sort((a, b) => parseLikes(b.likes) - parseLikes(a.likes));
    const url = sorted[0]?.url;
    if (url) result[filename] = url;
  }
  return result;
}

/**
 * Return flat list of all artwork entries for the browse modal.
 */
export function parseArtworkForBrowse(data: FanartResponse): BrowseArtworkItem[] {
  const result: BrowseArtworkItem[] = [];
  for (const [ftType, ourType] of Object.entries(TYPE_MAP)) {
    const items = data[ftType];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const url = item.url;
      if (!url) continue;
      let ext = url.split('?')[0].split('.').pop() ?? '';
      if (!ext) ext = 'png';
      result.push({
        our_type: ourType,
        ext,
        url,
        lang: item.lang ?? 'N/D',
        likes: String(item.likes ?? '0'),
      });
    }
  }
  return result;
}
