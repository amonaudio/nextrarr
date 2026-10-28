/**
 * GET /api/test-path-mapping?path=/movies/The Matrix
 *
 * Diagnostic endpoint: takes a sample Radarr path, applies the configured
 * path mapping, and returns:
 * - resolvedLocalPath: the translated host path
 * - isValid: whether it passes the allowed-prefixes check
 * - folderExists: whether the folder exists on disk
 * - error: detailed error message if something fails
 *
 * In demo mode, simulates a plausible resolution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadSettings } from '@/lib/settings-store';
import { resolveLocalPath, validateLocalPath, getNfoFilename } from '@/lib/paths';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const radarrPath = req.nextUrl.searchParams.get('path') ?? '';

  if (!radarrPath) {
    return NextResponse.json({
      status: 'error',
      message: 'Parametro "path" mancante. Esempio: /api/test-path-mapping?path=/movies/The Matrix',
    }, { status: 400 });
  }

  const settings = await loadSettings();

  // Demo mode: simulate a plausible resolution
  if (shouldUseMock('radarr', settings)) {
    const mockLocal = radarrPath.replace(/^\/movies/, '/mnt/user/Movies');
    return NextResponse.json({
      status: 'success',
      demo: true,
      inputPath: radarrPath,
      resolvedLocalPath: mockLocal,
      isValid: mockLocal.startsWith('/mnt/'),
      folderExists: false,
      pathMap: settings.pathMap,
      message: 'Demo mode: risoluzione simulata. Configura un Radarr reale per testare su disco.',
    });
  }

  // Real mode: apply path mapping
  const localPath = resolveLocalPath(radarrPath, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);

  if (!ok) {
    return NextResponse.json({
      status: 'error',
      inputPath: radarrPath,
      resolvedLocalPath: localPath,
      isValid: false,
      folderExists: false,
      pathMap: settings.pathMap,
      message: error ?? 'Percorso non valido.',
    });
  }

  const folderExists = existsSync(localPath);

  return NextResponse.json({
    status: 'success',
    inputPath: radarrPath,
    resolvedLocalPath: localPath,
    isValid: true,
    folderExists,
    pathMap: settings.pathMap,
    message: folderExists
      ? `✓ Path risolto correttamente: ${localPath}`
      : `⚠ Path risolto ma la cartella non esiste su disco: ${localPath}`,
  });
}
