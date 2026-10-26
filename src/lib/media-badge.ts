/**
 * [0.8.3] Helpers for the "NEW" badge on MediaCard.
 *
 * A title is considered new when its Radarr/Sonarr `added` date is within
 * the last 14 days. The badge is only shown when the title still needs an
 * action from the user (mapping, theme, extra artwork or trailer), so it
 * disappears automatically once everything is complete.
 *
 * Pure functions only — no React, no server imports. This keeps the badge
 * logic testable and prevents the client bundle from pulling in Node code.
 */

export const NEW_MEDIA_DAYS = 14;

export interface BadgeMediaFlags {
  is_mapped: boolean;
  folder_exists: boolean;
  has_theme: boolean;
  has_artwork: boolean;
  has_trailer: boolean;
}

/**
 * True when `dateAdded` is a valid date no older than `days` days.
 *
 * Empty/invalid dates return false (e.g. Radarr/Sonarr payloads that omit
 * `added`). Future dates are treated as new: clocks can be slightly off
 * between the arr service and the container.
 */
export function isRecentlyAdded(
  dateAdded: string | null | undefined,
  days = NEW_MEDIA_DAYS,
  now = Date.now(),
): boolean {
  if (!dateAdded || typeof dateAdded !== 'string') return false;
  const timestamp = Date.parse(dateAdded);
  if (!Number.isFinite(timestamp)) return false;
  const maxAgeMs = days * 24 * 60 * 60 * 1000;
  return now - timestamp <= maxAgeMs;
}

/**
 * True when at least one user action is still required for this title.
 * Mapping/folder problems count as actions too, because the user must fix
 * the path mapping or restore the folder before the metadata can be written.
 */
export function needsMediaAction(media: BadgeMediaFlags): boolean {
  return (
    !media.is_mapped ||
    !media.folder_exists ||
    !media.has_theme ||
    !media.has_artwork ||
    !media.has_trailer
  );
}
