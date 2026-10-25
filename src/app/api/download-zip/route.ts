/**
 * GET /api/download-zip — serves the nEXTrarr release zip from the
 * project's /home/z/my-project/download/ directory. Lets the user
 * download the latest release zip via the workspace's preview URL
 * (https://preview-<bot-id>.space-z.ai/api/download-zip) when the
 * download/ folder is not directly browsable.
 *
 * Returns the zip with Content-Disposition: attachment so the browser
 * triggers a download instead of trying to render it inline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ZIP_PATH = '/home/z/my-project/download/nextrarr-0.7.12.zip';
const ZIP_FILENAME = 'nextrarr-0.7.12.zip';

export async function GET(_req: NextRequest) {
  try {
    const buf = await readFile(ZIP_PATH);
    // Encode the filename safely per RFC 5987 (handles UTF-8 if ever needed)
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(buf.length),
        'Content-Disposition': `attachment; filename="${ZIP_FILENAME}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Zip non disponibile', detail: msg, path: ZIP_PATH },
      { status: 404 },
    );
  }
}
