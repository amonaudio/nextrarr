/**
 * Path resolution utilities — port of app/paths.py
 * Translates Radarr/Sonarr container paths to host-local paths using configured maps.
 */

import path from 'node:path';
import { isSafeLocalPath } from './security';

// On Unraid the host media root is /mnt/user; the container typically
// bind-mounts it to the same path. Outside Unraid this can be overridden.
const ALLOWED_PREFIXES = (process.env.EXTRARR_ALLOWED_PREFIXES ?? '/mnt,/data/media')
  .split(',')
  .filter(Boolean);

export interface PathMapping {
  docker: string;
  local: string;
}

/**
 * Translate an *arr container path to a host-local path using configured maps.
 * Mirrors the Flask resolve_local_path: replace the first occurrence of the
 * docker path with the local path.
 */
export function resolveLocalPath(mediaPath: string, pathMap: PathMapping[]): string {
  if (typeof mediaPath !== 'string' || mediaPath.length === 0) return '';
  if (!Array.isArray(pathMap)) return mediaPath;
  for (const mapping of pathMap) {
    if (!mapping || typeof mapping.docker !== 'string' || typeof mapping.local !== 'string') continue;
    const { docker, local } = mapping;
    if (docker && mediaPath.startsWith(docker)) {
      // Replace only the first occurrence (Python's str.replace(..., 1) behavior)
      return local + mediaPath.slice(docker.length);
    }
  }
  return mediaPath;
}

/**
 * Check that a resolved path lives under an allowed prefix.
 */
export function validateLocalPath(localPath: string): { ok: boolean; error?: string } {
  if (!localPath) return { ok: false, error: 'Percorso vuoto.' };
  if (!isSafeLocalPath(localPath, ALLOWED_PREFIXES)) {
    return { ok: false, error: `Percorso non mappato o non sicuro: ${localPath}.` };
  }
  return { ok: true };
}

/**
 * Get the conventional NFO filename for a media.
 * - TV series: tvshow.nfo in the series folder.
 * - Movies: <foldername>.nfo alongside the video file.
 */
export function getNfoFilename(mediaType: 'radarr' | 'sonarr', localPath: string): string {
  if (mediaType === 'sonarr') return 'tvshow.nfo';
  const base = path.basename(localPath.replace(/\/+$/, ''));
  if (!base) return 'movie.nfo';
  return `${base}.nfo`;
}

/**
 * Get the allowed prefixes (for display/debug).
 */
export function getAllowedPrefixes(): string[] {
  return [...ALLOWED_PREFIXES];
}
