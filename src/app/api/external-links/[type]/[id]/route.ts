/**
 * GET /api/external-links/[type]/[id]?title=...
 *
 * [0.8.3] Resolve the public Fanart.tv and TMDB pages for a media item.
 * The artwork modal uses these URLs for the clickable column headers.
 *
 * When a provider ID is missing (or Radarr/Sonarr is unreachable) we return
 * a search URL instead, so the link is always useful. The optional `title`
 * query is only a fallback and is never used for filesystem access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type ArrMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveTmdbId } from '@/lib/services/tmdb';
import { shouldUseMock, getMockSingleMedia } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(type: string | undefined): type is MediaType {
  return type === 'radarr' || type === 'sonarr';
}

function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return slug || 'media';
}

function fanartSearch(title: string): string {
  return title
    ? `https://fanart.tv/?s=${encodeURIComponent(title)}`
    : 'https://fanart.tv/';
}

function tmdbSearch(title: string): string {
  return title
    ? `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`
    : 'https://www.themoviedb.org/';
}

export async function GET(
  req: NextRequest,
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

  const queryTitle = (req.nextUrl.searchParams.get('title') ?? '').trim().slice(0, 200);
  const settings = await loadSettings();

  let media: ArrMedia | null = null;
  if (shouldUseMock(type, settings)) {
    media = getMockSingleMedia(type, mediaId);
  } else {
    try {
      media = await fetchSingleMedia(settings, type, mediaId);
    } catch {
      // The card metadata may still be usable; fall back to search links.
    }
  }

  const title = media?.title ?? queryTitle;
  const slug = slugify(title);

  let tmdbId = media?.tmdbId ?? null;
  if (!tmdbId && media && type === 'sonarr' && settings.tmdbApiKey) {
    tmdbId = await resolveTmdbId(settings.tmdbApiKey, media, type);
  }

  const fanartId = type === 'radarr' ? media?.tmdbId : media?.tvdbId;
  const fanartUrl = fanartId
    ? `https://fanart.tv/${type === 'radarr' ? 'movie' : 'series'}/${fanartId}/${slug}/`
    : fanartSearch(title);

  const tmdbUrl = tmdbId
    ? `https://www.themoviedb.org/${type === 'radarr' ? 'movie' : 'tv'}/${tmdbId}-${slug}`
    : tmdbSearch(title);

  return NextResponse.json(
    {
      fanart: fanartUrl,
      tmdb: tmdbUrl,
      has_fanart_id: !!fanartId,
      has_tmdb_id: !!tmdbId,
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
