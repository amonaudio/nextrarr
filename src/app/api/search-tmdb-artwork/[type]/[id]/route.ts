/**
 * GET /api/search-tmdb-artwork/[type]/[id] — browse TMDB artwork for a media.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { fetchImages, parseImagesForBrowse, type BrowseArtworkItem } from '@/lib/services/tmdb';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

const MOCK_TMDB: BrowseArtworkItem[] = [
  { our_type: 'clearlogo', ext: 'png', url: 'https://image.tmdb.org/t/p/original/abc123_logo.png', lang: 'en', likes: '8.5' },
  { our_type: 'clearlogo', ext: 'png', url: 'https://image.tmdb.org/t/p/original/def456_logo_it.png', lang: 'it', likes: '7.2' },
  { our_type: 'landscape', ext: 'jpg', url: 'https://image.tmdb.org/t/p/original/xyz789_backdrop.jpg', lang: '', likes: '9.1' },
  { our_type: 'landscape', ext: 'jpg', url: 'https://image.tmdb.org/t/p/original/ghi012_backdrop2.jpg', lang: '', likes: '6.4' },
  { our_type: 'poster', ext: 'jpg', url: 'https://image.tmdb.org/t/p/original/poster1.jpg', lang: 'en', likes: '8.8' },
  { our_type: 'poster', ext: 'jpg', url: 'https://image.tmdb.org/t/p/original/poster_it.jpg', lang: 'it', likes: '7.9' },
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
    return NextResponse.json(MOCK_TMDB);
  }
  if (!settings.tmdbApiKey) {
    return NextResponse.json({ status: 'error', message: 'TMDB API Key mancante' }, { status: 400 });
  }

  let media;
  try {
    media = await fetchSingleMedia(settings, type, mediaId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: msg }, { status: 500 });
  }
  try {
    const data = await fetchImages(settings.tmdbApiKey, media, type);
    return NextResponse.json(parseImagesForBrowse(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore API TMDB: ${msg}` }, { status: 500 });
  }
}
