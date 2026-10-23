/**
 * GET  /api/settings — return current settings (path_map serialized)
 * POST /api/settings — update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings, saveSettings, type SettingsData } from '@/lib/settings-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadSettings();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  let body: Partial<SettingsData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'JSON non valido' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Payload non valido' }, { status: 400 });
  }
  if (body.pathMap !== undefined && !Array.isArray(body.pathMap)) {
    return NextResponse.json({ status: 'error', message: 'pathMap deve essere una lista' }, { status: 400 });
  }
  const merged: SettingsData = {
    radarrUrl: typeof body.radarrUrl === 'string' ? body.radarrUrl : '',
    radarrApiKey: typeof body.radarrApiKey === 'string' ? body.radarrApiKey : '',
    sonarrUrl: typeof body.sonarrUrl === 'string' ? body.sonarrUrl : '',
    sonarrApiKey: typeof body.sonarrApiKey === 'string' ? body.sonarrApiKey : '',
    fanartApiKey: typeof body.fanartApiKey === 'string' ? body.fanartApiKey : '',
    tmdbApiKey: typeof body.tmdbApiKey === 'string' ? body.tmdbApiKey : '',
    pathMap: Array.isArray(body.pathMap)
      ? body.pathMap.filter(
          (m): m is { docker: string; local: string } =>
            m && typeof m.docker === 'string' && typeof m.local === 'string',
        )
      : [],
  };
  try {
    await saveSettings(merged);
    return NextResponse.json({ status: 'success' });
  } catch (err) {
    console.error('[settings] save failed:', err);
    return NextResponse.json({ status: 'error', message: 'Impossibile salvare' }, { status: 500 });
  }
}
