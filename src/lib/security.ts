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

// Regex for valid filename characters: alphanumeric (including Unicode letters
// like à, è, ì, ò, ù, é, ü, etc.), dash, underscore, dot, parens, space,
// apostrophe, comma.
//
// [0.7.8] CRITICAL FIX: the previous regex `/^[\w\-.() ]+$/` used the
// JavaScript `\w` character class, which is **ASCII-only** by default.
// It did NOT match:
//   - Apostrophes → broke filenames like "L'Avventura-clearlogo.png"
//   - Accented letters (à, è, ì, ò, ù, é, ç, ñ, ü, etc.) → broke "Café Society-..."
//   - Dieresis (ü, ö, ä) → broke "Über-cool-movie-banner.jpg"
//   - Most non-Latin scripts (Cyrillic, Greek, CJK, etc.)
//
// [0.7.10] Added comma `,` to allowed characters — many movie/series titles
// contain commas (e.g. "Hello, Dolly!", "No Country for Old Men, The") and
// the folder name flows into the artwork filename. Without this, the comma
// was stripped → "Hello Dolly!-clearlogo.png" → 404.
//
// The fix uses the Unicode-aware pattern `[\p{L}\p{N}]` (any Unicode letter
// or digit, requires the `u` flag — supported in Node 18+, all modern browsers).
// Apostrophe and comma added explicitly (punctuation, not letters).
//
// We still reject path separators (/ and \) and the null byte — those are
// the only characters that could enable path traversal. The `..` check
// above catches the traversal-as-substring case.
const FILENAME_RE = /^[\p{L}\p{N}\-_.(), ']+$/u;

/**
 * Sanitize a filename: returns a safe basename or null if input is suspicious.
 * Defense-in-depth: rejects any input containing ".." anywhere, normalizes
 * backslashes to forward slashes, enforces charset.
 *
 * [0.7.8] Now Unicode-aware: supports apostrophes ("L'Avventura"), accented
 * letters ("Café", "Über"), dieresis, and any other Unicode letter/digit.
 * Path separators and null bytes are still rejected.
 */
export function sanitizeFilename(name: unknown, maxLength = 200): string | null {
  if (typeof name !== 'string' || name.length === 0) return null;
  // Hard reject any input containing ".." anywhere — defense in depth
  if (name.includes('..')) return null;
  // Reject null bytes (would allow truncation attacks in some FS APIs)
  if (name.includes('\0')) return null;
  // Reject path separators explicitly — even if Unicode-aware, we don't
  // want any / or \ in a basename (defense in depth)
  if (name.includes('/') || name.includes('\\')) {
    // Try to take basename only
    const normalized = name.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const last = parts[parts.length - 1]?.trim();
    if (!last) return null;
    return sanitizeFilename(last, maxLength);
  }
  let clean = name.trim();
  if (clean.length === 0) return null;
  if (!FILENAME_RE.test(clean)) {
    // Try to sanitize by removing problematic chars (path separators,
    // null bytes, control chars, shell metacharacters) but KEEP Unicode
    // letters, digits, apostrophes, dashes, dots, parens, spaces.
    // [0.7.8] Previously this stripped ALL non-ASCII → broke foreign titles.
    const stripped = clean.replace(/[^\p{L}\p{N}\-_.(), ']/gu, '');
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
