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
//
// [0.7.11] CRITICAL FIX: switched from allowlist to BLOCKLIST approach.
// The allowlist regex `[\p{L}\p{N}\-_.(), ']+` still missed punctuation
// that's NOT a Unicode letter:
//   - `•` (U+2022 BULLET) → category Po, not L → stripped → "WALLE" instead of "WALL•E"
//   - `?` (U+003F) → category Po, not L → stripped → "sola" instead of "sola?"
//   - `!` (U+0021) → category Po, not L → stripped → "Saeba" instead of "Saeba!"
//   - `:` `;` `@` `&` `#` `+` `~` etc. → all stripped
//
// The blocklist approach only rejects characters that are actually dangerous:
//   - `..` (path traversal — checked separately)
//   - `/` and `\` (path separators — checked separately)
//   - `\0` (null byte — checked separately)
//   - Control characters (U+0000 to U+001F, U+007F)
// Everything else (including •, ?, !, à, ü, 日本語, 🎬, etc.) is allowed.
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/;

/**
 * Sanitize a filename: returns a safe basename or null if input is suspicious.
 * Defense-in-depth: rejects any input containing ".." anywhere, rejects path
 * separators, null bytes, and control characters. All other characters
 * (including Unicode punctuation like •, ?, !, accented letters, CJK, etc.)
 * are allowed.
 *
 * [0.7.11] Switched from allowlist to blocklist — the allowlist was always
 * one step behind reality (new punctuation → new 404s). The blocklist is
 * simpler and handles ALL valid filenames without missing edge cases.
 */
export function sanitizeFilename(name: unknown, maxLength = 200): string | null {
  if (typeof name !== 'string' || name.length === 0) return null;
  // Hard reject any input containing ".." anywhere — defense in depth
  if (name.includes('..')) return null;
  // Reject null bytes (would allow truncation attacks in some FS APIs)
  if (name.includes('\0')) return null;
  // Reject path separators explicitly — even if we take basename, we don't
  // want any / or \ in the final result (defense in depth)
  if (name.includes('/') || name.includes('\\')) {
    // Try to take basename only (in case the input is a path)
    const normalized = name.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const last = parts[parts.length - 1]?.trim();
    if (!last) return null;
    return sanitizeFilename(last, maxLength);
  }
  // Reject control characters (U+0000-U+001F, U+007F DEL)
  if (CONTROL_CHARS_RE.test(name)) {
    const cleaned = name.replace(CONTROL_CHARS_RE, '');
    if (!cleaned || cleaned.includes('..')) return null;
    name = cleaned;
  }
  let clean = name.trim();
  if (clean.length === 0) return null;
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
