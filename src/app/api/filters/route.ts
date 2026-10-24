/**
 * GET    /api/filters       — list all saved custom filters
 * POST   /api/filters       — create a new custom filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, ensureSchema } from '@/lib/db';
import type { CustomFilter, CustomFilterRule } from '@/lib/types';

export const dynamic = 'force-dynamic';

function parseRules(json: string): CustomFilterRule[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r): r is CustomFilterRule =>
        r && (r.type === 'has_theme' || r.type === 'has_artwork' || r.type === 'has_trailer')
        && (r.val === 'true' || r.val === 'false'),
    );
  } catch {
    return [];
  }
}

export async function GET() {
  await ensureSchema();
  const rows = await db.customFilter.findMany({ orderBy: { createdAt: 'asc' } });
  const result: CustomFilter[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    rules: parseRules(r.rules),
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: { name?: unknown; rules?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'JSON non valido' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ status: 'error', message: 'Nome mancante' }, { status: 400 });
  }
  if (!Array.isArray(body.rules) || body.rules.length === 0) {
    return NextResponse.json({ status: 'error', message: 'Aggiungi almeno una regola' }, { status: 400 });
  }
  const rules = body.rules.filter(
    (r): r is CustomFilterRule =>
      r && (r.type === 'has_theme' || r.type === 'has_artwork' || r.type === 'has_trailer')
      && (r.val === 'true' || r.val === 'false'),
  );
  if (rules.length === 0) {
    return NextResponse.json({ status: 'error', message: 'Regole non valide' }, { status: 400 });
  }
  const row = await db.customFilter.create({
    data: { name, rules: JSON.stringify(rules) },
  });
  return NextResponse.json({ status: 'success', id: row.id, name: row.name, rules });
}
