/**
 * [0.8.3] Shared artwork type vocabulary for the ArtworkModal filters.
 *
 * This file is intentionally dependency-free (no node:fs, no React) so it
 * can be imported by both the client component and server code.
 */

export const ARTWORK_TYPES = [
  'poster',
  'clearlogo',
  'clearart',
  'banner',
  'landscape',
  'discart',
  'keyart',
] as const;

export type ArtworkType = (typeof ARTWORK_TYPES)[number];

export const ARTWORK_TYPE_LABELS: Record<ArtworkType, string> = {
  poster: 'Poster',
  clearlogo: 'Clearlogo',
  clearart: 'Clearart',
  banner: 'Banner',
  landscape: 'Landscape / Fanart',
  discart: 'Discart',
  keyart: 'Keyart',
};

const ART_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * Infer the artwork kind from a local filename using the same keywords as
 * scanLocalArtwork(). Returns null for files that are not managed artwork.
 *
 * Order matters: "clearlogo" must be checked before the shorter "logo",
 * and "clearart"/"discart"/"keyart" before generic artwork keywords.
 */
export function getLocalArtworkType(filename: string): ArtworkType | null {
  const lower = filename.toLowerCase();
  if (!ART_EXTENSIONS.some((ext) => lower.endsWith(ext))) return null;

  if (lower.includes('clearlogo') || lower.includes('logo')) return 'clearlogo';
  if (lower.includes('clearart')) return 'clearart';
  if (lower.includes('banner')) return 'banner';
  if (lower.includes('discart')) return 'discart';
  if (lower.includes('keyart')) return 'keyart';
  if (lower.includes('poster')) return 'poster';
  if (lower.includes('landscape') || lower.includes('fanart')) return 'landscape';
  return null;
}

/**
 * Normalize an `our_type` value coming from Fanart/TMDB. Some providers use
 * aliases (`logo`, `fanart`); unknown values are ignored by the filters.
 */
export function normalizeArtworkType(value: string | null | undefined): ArtworkType | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'logo') return 'clearlogo';
  if (lower === 'fanart') return 'landscape';
  return (ARTWORK_TYPES as readonly string[]).includes(lower)
    ? (lower as ArtworkType)
    : null;
}
