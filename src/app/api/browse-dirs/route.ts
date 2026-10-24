/**
 * POST /api/browse-dirs — list subdirectories of a given path (for directory browser).
 * Restricted to allowed prefixes for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const ALLOWED_PREFIXES = (process.env.EXTRARR_ALLOWED_PREFIXES ?? '/mnt,/data/media')
  .split(',')
  .filter(Boolean);

function isAllowed(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  if (p.includes('..')) return false;
  const real = path.resolve(p);
  return ALLOWED_PREFIXES.some((prefix) => real === prefix || real.startsWith(prefix.replace(/\/+$/, '') + '/'));
}

export async function POST(req: NextRequest) {
  let body: { path?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ current: '/mnt/user/', dirs: [], error: 'JSON non valido' }, { status: 400 });
  }
  let reqPath = typeof body.path === 'string' ? body.path : '/mnt/user/';
  if (!isAllowed(reqPath)) {
    return NextResponse.json(
      { current: '/mnt/user/', dirs: [], error: 'Percorso non consentito' },
      { status: 400 },
    );
  }
  if (!reqPath.endsWith('/')) reqPath += '/';

  try {
    const entries = await fs.readdir(reqPath);
    const dirs: { name: string; path: string }[] = [];
    for (const name of entries.sort()) {
      const full = path.join(reqPath, name);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          dirs.push({ name, path: full });
        }
      } catch {
        // skip inaccessible entries
      }
    }
    return NextResponse.json({ current: reqPath, dirs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ current: reqPath, dirs: [], error: msg }, { status: 500 });
  }
}
