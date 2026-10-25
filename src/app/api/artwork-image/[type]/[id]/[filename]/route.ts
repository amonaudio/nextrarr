/**
 * GET /api/artwork-image/[type]/[id]/[filename] — serve a local artwork image.
 * Filename is sanitized via sanitizeFilename() to prevent traversal.
 * In demo mode returns a 1x1 transparent PNG.
 *
 * [0.7.12] CRITICAL FIX — special characters in titles (WALL•E, ?, !):
 * Next.js 15+ App Router AUTOMATICALLY URL-decodes the dynamic route
 * params. So `params.filename` arrives ALREADY decoded as `WALL•E-poster.jpg`
 * (NOT as `WALL%E2%80%A2E-poster.jpg`).
 *
 * The previous code unconditionally called `decodeURIComponent(filename)`,
 * which works for most cases BUT:
 *   - Throws `URIError: URI malformed` if the filename contains a `%`
 *     literal that is NOT a valid hex sequence (rare but possible when
 *     a movie title contains a `%` followed by non-hex chars like
 *     "100% Love" → folder name "100% Love" → "100% Love-poster.jpg"
 *     → Next.js passes the param decoded, so we get the literal `%`.
 *     Then `decodeURIComponent('100% Love-poster.jpg')` throws because
 *     `% L` is not valid hex).
 *   - When the URIError was thrown, the catch-less code path returned
 *     a 500 with JSON `{error: ...}` — the browser's `<img>` saw JSON
 *     where it expected bytes, and showed a broken-image icon for ALL
 *     artwork files of that media (not just the problematic one).
 *
 * Fix: wrap decodeURIComponent in try/catch. If it throws, fall back to
 * the raw param (already decoded by Next.js). Also, on ANY error path
 * (file not found, sanitize failure, traversal blocked), return a 1x1
 * transparent PNG instead of JSON — so the <img> just renders blank
 * rather than a broken-image icon, which is what the user actually sees.
 *
 * Same transparent-PNG fallback is used in demo mode for consistency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadSettings } from '@/lib/settings-store';
import { fetchSingleMedia, type MediaType } from '@/lib/services/radarr-sonarr';
import { resolveLocalPath, validateLocalPath } from '@/lib/paths';
import { sanitizeFilename } from '@/lib/security';
import { shouldUseMock } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

const TRANSPARENT_1PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgYAAAAAMAASsJXQAAAAAASUVORK5CYII=',
  'base64',
);

/**
 * Send a 1x1 transparent PNG with HTTP 200 so the browser's <img> renders
 * blank instead of showing the "broken image" icon. Used for ANY error
 * path in this route (file not found, sanitize failed, traversal blocked,
 * media not found, etc.) so the UI degrades gracefully.
 *
 * Returns Content-Type: image/png always (never application/json) so the
 * <img> tag doesn't try to render JSON text as an image.
 */
function sendTransparentPng(): NextResponse {
  return new NextResponse(TRANSPARENT_1PX_PNG as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string; filename: string }> },
) {
  const { type, id, filename } = await params;
  if (!isValidType(type)) {
    // [0.7.12] Return transparent PNG instead of JSON for invalid type —
    // the <img> would otherwise show broken icon if someone manually
    // navigates here with a wrong type.
    return sendTransparentPng();
  }
  const mediaId = parseInt(id, 10);
  if (!Number.isFinite(mediaId)) {
    return sendTransparentPng();
  }

  // [0.7.12] Safe decode: Next.js 15+ already decodes the param, so
  // `decodeURIComponent` is mostly a no-op. But if the filename contains
  // a literal `%` not followed by valid hex (rare edge case — see header
  // comment), `decodeURIComponent` throws URIError. Wrap in try/catch
  // and fall back to the raw (already-decoded) param.
  let decodedFilename = filename;
  try {
    // Only attempt decode if there's a `%` in the string (optimization +
    // avoids no-op decode of already-decoded Unicode chars like •).
    if (filename.includes('%')) {
      decodedFilename = decodeURIComponent(filename);
    }
  } catch {
    // URIError: malformed URI sequence — fall back to the raw param,
    // which is already URL-decoded by Next.js.
    decodedFilename = filename;
  }

  // CRITICAL: sanitize the filename to prevent traversal
  const safeName = sanitizeFilename(decodedFilename);
  if (!safeName) {
    return sendTransparentPng();
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    return sendTransparentPng();
  }

  let media: { path: string };
  try {
    const full = await fetchSingleMedia(settings, type, mediaId);
    media = { path: full.path };
  } catch {
    return sendTransparentPng();
  }
  const localPath = resolveLocalPath(media.path, settings.pathMap);
  const { ok, error } = validateLocalPath(localPath);
  if (!ok) {
    // [0.7.12] Don't leak error details to the <img>; log server-side.
    console.warn(`[artwork-image] invalid localPath for ${type}/${mediaId}: ${error}`);
    return sendTransparentPng();
  }

  const filePath = path.join(localPath, safeName);
  // Defense in depth: ensure resolved path stays under localPath
  const resolvedBase = path.resolve(localPath).replace(/\/+$/, '') + '/';
  if (!path.resolve(filePath).startsWith(resolvedBase)) {
    console.warn(`[artwork-image] path traversal blocked for ${type}/${mediaId}: ${safeName}`);
    return sendTransparentPng();
  }
  if (!existsSync(filePath)) {
    // [0.7.12] Common case: file doesn't exist on disk (user hasn't
    // downloaded a local poster, or deleted it). Return transparent PNG
    // so the card/poster falls back to the remote Radarr URL via onError.
    // Log at debug level so it doesn't spam production logs.
    console.warn(`[artwork-image] file not found: ${filePath}`);
    return sendTransparentPng();
  }
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/jpeg';
    // [0.7.12-test] CRITICAL FIX — switch from `public, max-age=3600`
    // to `no-store` so the browser does NOT cache local artwork images.
    //
    // Why this matters: when the user clicks "Scarica" on an online
    // artwork in the ArtworkModal, the route /api/download-specific-artwork
    // overwrites the existing file (e.g. WALL•E-clearlogo.jpg) with new
    // bytes from TMDB/Fanart. The server-side folderCache is correctly
    // invalidated, BUT the browser's HTTP cache is NOT — the previous
    // 1-hour max-age meant the <img> kept showing the OLD artwork bytes
    // for up to 60 minutes after the user had already replaced it on
    // disk. The user perceived "cache non rigenerata — continuo a vedere
    // i miei vecchi cambiamenti" (or non vedere i nuovi).
    //
    // Trade-off: every ArtworkModal open will re-fetch all the local
    // artwork images from the server instead of using browser cache.
    // For local-network Unraid deployments this is negligible (images
    // are typically <500 KB, localhost round-trip <50ms). For WAN
    // deployments behind a reverse proxy the overhead is more visible
    // but still acceptable for a media-management tool that's used
    // occasionally, not continuously.
    //
    // Future optimization: implement ETag based on file mtime+size so
    // the browser can send If-None-Match and the server can reply
    // 304 Not Modified when the file hasn't changed. For now, no-store
    // is the simple, correct, bug-free choice.
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error(`[artwork-image] failed to read ${filePath}:`, err);
    return sendTransparentPng();
  }
}
