/**
 * Security utilities — port of app/security.py
 * Provides path sanitization, URL whitelist validation, and traversal-safe paths.
 */

import path from 'node:path';

// Whitelist of domains allowed for artwork download (SSRF mitigation).
// These are the only external sources we ever fetch images from.
const ARTWORK_URL_WHITELIST = new Set([
  'image.tmdb.org',
  'images.tmdb.org',
  'assets.fanart.tv',
  'webservice.fanart.tv',
  'assets.flixart.tv',
]);

// Regex for valid filename characters: alphanumeric, dash, underscore, dot, parens, space
const FILENAME_RE = /^[\w\-.() ]+$/;

/**
 * Sanitize a filename: returns a safe basename or null if input is suspicious.
 * Defense-in-depth: rejects any input containing ".." anywhere, normalizes
 * backslashes to forward slashes, enforces charset.
 */
export function sanitizeFilename(name: unknown, maxLength = 100): string | null {
  if (typeof name !== 'string' || name.length === 0) return null;
  // Hard reject any input containing ".." anywhere — defense in depth
  if (name.includes('..')) return null;
  // Normalize backslashes (Windows-style) and take basename
  const normalized = name.replace(/\\/g, '/');
  let clean = normalized.includes('/')
    ? normalized.split('/').pop()!.trim()
    : name.trim();
  if (clean.length === 0) return null;
  if (!FILENAME_RE.test(clean)) {
    // Try to sanitize by removing problematic chars
    const stripped = clean.replace(/[^\w\-.() ]/g, '');
    if (!stripped || stripped.includes('..')) return null;
    clean = stripped;
  }
  if (clean.length > maxLength) clean = clean.slice(0, maxLength);
  return clean;
}

/**
 * Validate that an artwork URL is on the whitelist and uses HTTPS.
 */
export function validateArtworkUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!ARTWORK_URL_WHITELIST.has(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify a resolved local path stays under one of the allowed prefixes.
 * Used to prevent the app from reading/writing outside the media root.
 */
export function isSafeLocalPath(path: string, allowedPrefixes: string[]): boolean {
  if (typeof path !== 'string' || path.length === 0) return false;
  // Defense in depth: reject any input with traversal attempts outright.
  if (path.includes('..')) return false;
  const real = realPath(path);
  for (const prefix of allowedPrefixes) {
    const trimmed = prefix.replace(/\/+$/, '');
    if (real === trimmed || real.startsWith(trimmed + '/')) return true;
  }
  return false;
}

/**
 * Resolve a path to its absolute/real form using node:path.
 */
function realPath(p: string): string {
  return path.resolve(p);
}
