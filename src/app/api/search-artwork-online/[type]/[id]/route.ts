/**
 * GET /api/search-artwork-online/[type]/[id] — browse Fanart.tv artwork.
 * In demo mode returns a small canned list of artwork items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { fetchArtwork, parseArtworkForBrowse, type BrowseArtworkItem } from '@/lib/services/fanart';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

const MOCK_FANART: BrowseArtworkItem[] = [
  { ourType: 'clearlogo', ext: 'png', url: 'https://assets.fanart.tv/fanart/movies/603/hdmovielogo/the-matrix-5e3b2c4e9e8c4.png', lang: 'en', likes: '42' },
  { ourType: 'clearart', ext: 'png', url: 'https://assets.fanart.tv/fanart/movies/603/hdmovieclearart/the-matrix-art-7f3a1b2c4d5e6.png', lang: 'en', likes: '31' },
  { ourType: 'banner', ext: 'jpg', url: 'https://assets.fanart.tv/fanart/movies/603/moviebanner/the-matrix-banner.jpg', lang: 'en', likes: '18' },
  { ourType: 'landscape', ext: 'jpg', url: 'https://assets.fanart.tv/fanart/movies/603/moviethumb/the-matrix-thumb.jpg', lang: 'en', likes: '27' },
  { ourType: 'discart', ext: 'png', url: 'https://assets.fanart.tv/fanart/movies/603/moviedisc/the-matrix-disc.png', lang: 'en', likes: '12' },
];

export async function GET(
  _req: NextRequest,
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

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    return NextResponse.json(MOCK_FANART);
  }
  if (!settings.fanartApiKey) {
    return NextResponse.json({ status: 'error', message: 'Fanart API Key mancante' }, { status: 400 });
  }

  let media: { tmdbId?: number | null; tvdbId?: number | null };
  try {
    media = await fetchSingleMedia(settings, type, mediaId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: msg }, { status: 500 });
  }
  const artId = type === 'radarr' ? media.tmdbId : media.tvdbId;
  if (!artId) {
    return NextResponse.json({ status: 'error', message: 'ID (TMDB/TVDB) mancante' }, { status: 400 });
  }
  try {
    const data = await fetchArtwork(settings.fanartApiKey, type, artId);
    return NextResponse.json(parseArtworkForBrowse(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore API Fanart.tv: ${msg}` }, { status: 500 });
  }
}
