/**
 * GET /api/search-media/[type]/[id]/[searchType]
 * Search YouTube for a theme song or trailer for a specific media.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { search as ytSearch } from '@/lib/services/youtube';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

const MOCK_RESULTS = [
  { title: 'Official Theme Song [HD]', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', video_id: 'dQw4w9WgXcQ' },
  { title: 'Main Title Theme (Extended)', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', video_id: '9bZkp7q19f0' },
  { title: 'Original Soundtrack - Full OST', url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', video_id: 'kJQP7kiw5Fk' },
  { title: 'Trailer Ufficiale Italiano', url: 'https://www.youtube.com/watch?v=OPf0YbXqDm0', video_id: 'OPf0YbXqDm0' },
  { title: 'Behind the Scenes + Theme', url: 'https://www.youtube.com/watch?v=CevxZvSJLk8', video_id: 'CevxZvSJLk8' },
];

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

function buildQuery(media: { title: string }, searchType: string, lang: string): string {
  if (searchType === 'theme') return `${media.title} theme song`;
  if (lang === 'it') return `${media.title} trailer ita`;
  return `${media.title} trailer`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string; searchType: string }> },
) {
  const { type, id, searchType } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ status: 'error', message: 'Tipo non valido' }, { status: 400 });
  }
  if (searchType !== 'theme' && searchType !== 'trailer') {
    return NextResponse.json({ status: 'error', message: 'Tipo ricerca non valido' }, { status: 400 });
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json({ status: 'error', message: 'ID non valido' }, { status: 400 });
  }

  const settings = await loadSettings();
  const lang = req.nextUrl.searchParams.get('lang') ?? 'en';
  const customQuery = req.nextUrl.searchParams.get('query') ?? '';

  // Find the media (from Radarr/Sonarr, or mock)
  let media: { title: string } | null;
  if (shouldUseMock(type, settings)) {
    media = getMockSingleMedia(type, mediaId);
  } else {
    try {
      media = await fetchSingleMedia(settings, type, mediaId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ status: 'error', message: msg }, { status: 500 });
    }
  }
  if (!media) {
    return NextResponse.json({ status: 'error', message: 'Media non trovato' }, { status: 404 });
  }

  // In demo mode, return canned results
  if (shouldUseMock(type, settings)) {
    return NextResponse.json(MOCK_RESULTS);
  }

  const query = customQuery || buildQuery(media, searchType, lang);
  try {
    const videos = await ytSearch(query, 10, 30000);
    return NextResponse.json(videos);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore yt-dlp: ${msg}` }, { status: 500 });
  }
}
