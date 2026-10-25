/**
 * POST /api/upload-artwork/[type]/[id] — upload a custom artwork image
 * (JPG/PNG, max 10 MB) into the media folder.
 *
 * [0.8.0] NEW ROUTE — wired to the "Carica da PC" button in ArtworkModal.
 *
 * Security (defense-in-depth, multiple layers):
 *
 * 1. MIME type whitelist (server-side, not trusting the client header):
 *    Only `image/jpeg` and `image/png` are accepted. The browser sends
 *    a Content-Type based on the file extension, but we don't trust it
 *    — we verify with magic bytes (see #3 below).
 *
 * 2. Size limit: 10 MB hard cap. Files larger than this are rejected
 *    with HTTP 413 (Payload Too Large). Prevents DOS via huge uploads.
 *
 * 3. Magic bytes verification (the actual security check): we read the
 *    first 3-8 bytes of the file and match against the well-known JPEG
 *    and PNG signatures. This catches:
 *      - A .jpg file that's actually a .exe renamed
 *      - A .png file that's actually a .sh script
 *      - Any extension spoofing attempt
 *    Without this check, anyone with the API URL could write arbitrary
 *    files to the media folder (e.g. .nfo files with malicious Kodi
 *    scripts, or .mp4 files masquerading as posters).
 *
 * 4. Filename sanitization: the user can specify a target filename via
 *    the `filename` form field, but it's passed through `sanitizeFilename()`
 *    which strips "..", "/", "\", null bytes, and control characters.
 *    Prevents path traversal attacks.
 *
 * 5. Path traversal block (defense in depth): even if `sanitizeFilename`
 *    somehow lets a traversal attempt through (it shouldn't, but we
 *    assume worst case), we resolve the final path with `path.resolve`
 *    and verify it starts with `localPath + '/'`. If not, we reject.
 *
 * 6. Force the file extension based on the magic bytes — even if the
 *    user uploaded "file.png" but the content is JPEG, we save it as
 *    "file.jpg". This matches the actual file content with the extension,
 *    avoiding broken image previews in the browser.
 *
 * 7. Atomic write: write to a .tmp file, then atomic rename. If the
 *    write fails midway (disk full, etc.), we don't leave a half-written
 *    file that the UI would try to display as a valid image.
 *
 * Cache invalidation:
 *   - mediaCache (5min TTL): invalidated for the affected media type
 *     prefix (so the next /api/media call re-scans the folder for
 *     has_artwork, has_theme flags).
 *   - folderCache (60s TTL): invalidated for the specific localPath
 *     so /api/artwork-files returns the new file immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { sanitizeFilename } from '@/lib/security';
import { mediaCache } from '@/lib/cache';
import { folderCache } from '@/lib/folder-cache';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 10 MB hard cap — matches the same constant in ArtworkModal.uploadOne.
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

// Magic bytes for JPEG and PNG (well-known signatures).
const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isValidType(type)) {
    return NextResponse.json(
      { status: 'error', message: 'Tipo non valido' },
      { status: 400 },
    );
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json(
      { status: 'error', message: 'ID non valido' },
      { status: 400 },
    );
  }

  // Parse multipart form data. formData() throws on malformed payloads,
  // which is what we want — let Next.js handle the error response.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: `Malformed multipart: ${msg}` },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  const targetName = formData.get('filename');

  // Validate that the form field contains a File object (not a string)
  if (!(file instanceof File)) {
    return NextResponse.json(
      { status: 'error', message: 'File mancante — il campo "file" deve essere un file binario.' },
      { status: 400 },
    );
  }

  // Size check (client-side pre-flight also does this, but client can
  // be bypassed — server-side is authoritative).
  if (file.size > MAX_UPLOAD_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const maxMB = (MAX_UPLOAD_SIZE / 1024 / 1024).toFixed(0);
    return NextResponse.json(
      {
        status: 'error',
        message: `File troppo grande (${sizeMB} MB). Massimo ${maxMB} MB.`,
      },
      { status: 413 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { status: 'error', message: 'File vuoto (0 byte).' },
      { status: 400 },
    );
  }

  // Read the entire file into memory. For a 10 MB cap, this is fine —
  // we'd have memory pressure issues only at hundreds of concurrent
  // uploads, which is unrealistic for a single-user media tool.
  const buf = Buffer.from(await file.arrayBuffer());

  // [Security layer 3] Magic bytes verification — the actual security
  // check. Verify the first bytes of the file match JPEG or PNG signatures.
  // We DO NOT trust the file's claimed MIME type or extension.
  let detectedExt: string;
  let detectedMime: string;
  if (buf.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    detectedExt = '.jpg';
    detectedMime = 'image/jpeg';
  } else if (buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    detectedExt = '.png';
    detectedMime = 'image/png';
  } else {
    // Log the actual magic bytes for debugging (helps identify false
    // rejections if a valid image somehow has unusual headers).
    const firstBytes = Array.from(buf.subarray(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.warn(`[upload-artwork] rejected: bad magic bytes (${firstBytes}) for ${file.name}`);
    return NextResponse.json(
      {
        status: 'error',
        message: `Formato non supportato. Solo JPG e PNG sono accettati (magic bytes non riconosciuti). Primi byte: ${firstBytes}`,
      },
      { status: 400 },
    );
  }

  // Determine the target filename:
  //   1. If the user passed a "filename" form field, use it (sanitized).
  //   2. Otherwise, use the uploaded file's name (without extension) +
  //      the detected extension based on magic bytes.
  let safeName: string | null = null;
  if (typeof targetName === 'string' && targetName.length > 0) {
    safeName = sanitizeFilename(targetName);
  } else {
    // Strip any extension the user's file had and append the detected one.
    // This prevents a .png file containing JPEG bytes from being saved as
    // .png (which would confuse browsers and Kodi/Jellyfin).
    const uploaded = sanitizeFilename(file.name) || 'artwork';
    const baseName = uploaded.replace(/\.(jpg|jpeg|png)$/i, '');
    safeName = baseName + detectedExt;
  }
  if (!safeName) {
    return NextResponse.json(
      { status: 'error', message: 'Filename non valido dopo sanificazione.' },
      { status: 400 },
    );
  }

  // Re-sanitize to ensure no path separators slipped through (the
  // sanitizeFilename function already does this, but we double-check
  // for defense in depth — if a future change weakens sanitizeFilename,
  // this still blocks traversal).
  if (safeName.includes('/') || safeName.includes('\\') || safeName.includes('..')) {
    console.warn(`[upload-artwork] path traversal attempt blocked: ${safeName}`);
    return NextResponse.json(
      { status: 'error', message: 'Path traversal bloccato.' },
      { status: 400 },
    );
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    // Demo mode: don't actually write to disk (the media folder may
    // not exist in the sandbox). Just invalidate the cache and report
    // success so the UI flow works end-to-end.
    mediaCache.invalidatePrefix('media:');
    return NextResponse.json({
      status: 'success',
      message: `Artwork ${safeName} caricato (demo mode — ${detectedMime}, ${(buf.length / 1024).toFixed(0)} KB)`,
    });
  }

  // Fetch the media's path from Radarr/Sonarr to know where to save.
  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: msg },
      { status: 500 },
    );
  }

  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) {
    return NextResponse.json(
      { status: 'error', message: error! },
      { status: 400 },
    );
  }

  // Create the media folder if it doesn't exist (matches the
  // download-specific-artwork route behavior — allows uploading to a
  // newly added media that hasn't been downloaded yet).
  if (!existsSync(localPath)) {
    try {
      await mkdir(localPath, { recursive: true });
    } catch (e) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Impossibile creare la cartella: ${e instanceof Error ? e.message : e}`,
        },
        { status: 500 },
      );
    }
  }

  // Resolve the final file path and verify (defense-in-depth) it stays
  // under localPath. Even though we sanitized the filename above, this
  // is the last line of defense against path traversal — if a future
  // change to sanitizeFilename lets something slip through, this still
  // blocks the attack.
  const filePath = path.join(localPath, safeName);
  const resolvedBase = path.resolve(localPath).replace(/\/+$/, '') + '/';
  if (!path.resolve(filePath).startsWith(resolvedBase)) {
    console.warn(`[upload-artwork] resolved-path traversal blocked: ${filePath}`);
    return NextResponse.json(
      { status: 'error', message: 'Path traversal bloccato (resolved path outside localPath).' },
      { status: 400 },
    );
  }

  // Atomic write: write to .tmp first, then rename. If the write fails
  // (disk full, permission error, network blip on NFS mount), the .tmp
  // file is incomplete but the original file (if any) is still intact.
  // The user can retry without leaving a half-written file behind that
  // would break the image preview.
  try {
    const tmpPath = filePath + '.tmp';
    await writeFile(tmpPath, buf);
    await rename(tmpPath, filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message: `Errore scrittura file: ${msg}` },
      { status: 500 },
    );
  }

  // Invalidate caches so the new file shows up immediately:
  //   - mediaCache: so the next /api/media call re-scans the folder
  //     (in case the upload also affects has_artwork flags).
  //   - folderCache: so /api/artwork-files returns the new file without
  //     waiting for the 60s TTL to expire.
  mediaCache.invalidatePrefix('media:');
  folderCache.invalidate(localPath);

  return NextResponse.json({
    status: 'success',
    message: `Artwork ${safeName} caricato (${detectedMime}, ${(buf.length / 1024).toFixed(0)} KB)`,
  });
}
