/**
 * POST /api/search-youtube — global YouTube search (not tied to a media)
 */

import { NextRequest, NextResponse } from 'next/server';
import { search as ytSearch } from '@/lib/services/youtube';
import { shouldUseMock } from '@/lib/mock-data';
import { loadSettings } from '@/lib/settings-store';

export const dynamic = 'force-dynamic';

const MOCK_GLOBAL = [
  { title: 'Epic Movie Themes Mix', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', video_id: 'dQw4w9WgXcQ' },
  { title: 'Best Soundtracks of All Time', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', video_id: '9bZkp7q19f0' },
  { title: 'Movie Theme Compilation HD', url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', video_id: 'kJQP7kiw5Fk' },
  { title: 'Hans Zimmer Greatest Hits', url: 'https://www.youtube.com/watch?v=OPf0YbXqDm0', video_id: 'OPf0YbXqDm0' },
  { title: 'Cinematic Trailer Music', url: 'https://www.youtube.com/watch?v=CevxZvSJLk8', video_id: 'CevxZvSJLk8' },
];

export async function POST(req: NextRequest) {
  let body: { query?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json([], { status: 200 });
  }
  const q = typeof body.query === 'string' ? body.query.trim() : '';
  if (!q) return NextResponse.json([]);
  if (q.length > 200) {
    return NextResponse.json({ status: 'error', message: 'Query troppo lunga' }, { status: 400 });
  }

  const settings = await loadSettings();
  // Demo mode if either Radarr or Sonarr is configured (just need to know if we're "live")
  if (shouldUseMock('radarr', settings) && shouldUseMock('sonarr', settings)) {
    return NextResponse.json(MOCK_GLOBAL);
  }

  try {
    const videos = await ytSearch(q, 10, 30000);
    return NextResponse.json(videos);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message: `Errore yt-dlp: ${msg}` }, { status: 500 });
  }
}
