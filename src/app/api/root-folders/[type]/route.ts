/**
 * GET /api/root-folders/[type] — list root folders configured in Radarr/Sonarr.
 * Falls back to MOCK_ROOT_FOLDERS when in demo mode or no API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { fetchRootFolders, type MediaType } from '@/lib/services/radarr-sonarr';
import { MOCK_ROOT_FOLDERS, shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isValidType(type)) {
    return NextResponse.json([], { status: 400 });
  }
  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    return NextResponse.json(MOCK_ROOT_FOLDERS);
  }
  try {
    const folders = await fetchRootFolders(settings, type);
    return NextResponse.json(folders);
  } catch (err) {
    console.warn(`[root-folders] fetch failed for ${type}:`, err);
    return NextResponse.json([]);
  }
}
