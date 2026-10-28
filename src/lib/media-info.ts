/**
 * [0.8.0] Helpers to extract and normalize media info (resolution, codec,
 * audio channels) from the Radarr/Sonarr API responses into short labels
 * for the UI badges on MediaCard.
 *
 * Why this file exists:
 * - Radarr/Sonarr return raw values like "h264", "x265", "HEVC", "MPEG-4",
 *   numeric resolution (1080, 2160, 720, 480), and audio channel count (2, 6, 8).
 * - The UI wants short canonical labels: "H264", "HEVC", "4K", "5.1".
 * - Centralizing the mapping here makes it testable in isolation and easy
 *   to extend if a new codec appears (just add a case).
 *
 * No SSRF/path concerns here — pure functions on strings/numbers.
 */

/**
 * Convert a numeric resolution (e.g. 1080, 2160, 720, 480) to a short label.
 *
 * Mapping (per industry conventions):
 *   - 480 / 576 → "SD"   (Standard Definition, DVD-era)
 *   - 720       → "HD"   (HD Ready, 720p)
 *   - 1080      → "FHD"  (Full HD, 1080p)
 *   - 2160+     → "4K"   (Ultra HD, 2160p / 4K)
 *   - other     → null (don't show badge — unknown resolution)
 *
 * @param resolution Numeric resolution from ArrQuality.quality.resolution
 * @returns Short label or null
 */
export function resolutionLabel(resolution: number | undefined | null): string | null {
  if (resolution == null || typeof resolution !== 'number' || Number.isNaN(resolution)) return null;
  if (resolution <= 576) return 'SD';
  if (resolution === 720) return 'HD';
  if (resolution === 1080) return 'FHD';
  if (resolution >= 2160) return '4K';
  // Unknown resolution (e.g. 1440) — don't show a badge to avoid confusion.
  return null;
}

/**
 * Convert a raw video codec string from Radarr/Sonarr (e.g. "h264", "x265",
 * "hevc", "mpeg-4", "xvid", "divx") into a short canonical label for the UI.
 *
 * Mapping rules (case-insensitive, ignores punctuation):
 *   - h264 / x264 / AVC → "H264"   (H.264/AVC — most common)
 *   - h265 / x265 / HEVC → "HEVC"  (H.265/HEVC — modern, used for 4K)
 *   - xvid / divx / dx50 → "Xvid"  (legacy, SD content)
 *   - mpeg-4 / mp4v     → "MP4"   (MPEG-4 Part 2 — old web video)
 *   - mpeg-2 / mp2v     → "MP2"   (MPEG-2 — DVD, broadcast)
 *   - vp9               → "VP9"   (Google's codec, WebM)
 *   - av1               → "AV1"   (modern open codec)
 *   - other             → original uppercased, truncated to 5 chars
 *
 * @param codec Raw codec string from ArrMediaInfo.videoCodec
 * @returns Short label or null if input is empty/null
 */
export function videoCodecLabel(codec: string | undefined | null): string | null {
  if (!codec || typeof codec !== 'string') return null;
  // Normalize: lowercase, strip non-alphanumeric
  const lc = codec.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!lc) return null;
  if (lc === 'h264' || lc === 'x264' || lc === 'avc') return 'H264';
  if (lc === 'h265' || lc === 'x265' || lc === 'hevc') return 'HEVC';
  if (lc === 'xvid' || lc === 'divx' || lc === 'divx3' || lc === 'dx50') return 'Xvid';
  if (lc.startsWith('mpeg4') || lc === 'mp4v' || lc === 'mp4') return 'MP4';
  if (lc.startsWith('mpeg2') || lc === 'mp2v' || lc === 'mp2') return 'MP2';
  if (lc === 'vp9') return 'VP9';
  if (lc === 'av1') return 'AV1';
  // Fallback: uppercase, truncate to 5 chars (e.g. "VP90" → "VP90", "unknown1" → "UNKNO")
  return codec.toUpperCase().slice(0, 5);
}

/**
 * Convert audio channels number to X.Y surround format.
 *
 * Mapping:
 *   - 1  → "1.0"  (mono)
 *   - 2  → "2.0"  (stereo)
 *   - 3  → "2.1"  (stereo + LFE)
 *   - 6  → "5.1"  (5.1 surround, most common for movies)
 *   - 7  → "6.1"  (6.1 surround)
 *   - 8  → "7.1"  (7.1 surround)
 *   - 9+ → `${n-2}.2`  (positional fallback, e.g. 9 → "7.2")
 *   - other → `${n}.0`  (generic integer format)
 *
 * @param channels Audio channel count from ArrMediaInfo.audioChannels
 * @returns X.Y format label or null if input is null/undefined
 */
export function audioChannelsLabel(channels: number | undefined | null): string | null {
  if (channels == null || typeof channels !== 'number' || Number.isNaN(channels)) return null;
  if (channels <= 0) return null;
  if (channels === 1) return '1.0';
  if (channels === 2) return '2.0';
  if (channels === 3) return '2.1';
  if (channels === 6) return '5.1';
  if (channels === 7) return '6.1';
  if (channels === 8) return '7.1';
  // Generic fallback (rare): subtract 2 from total to get X.Y
  // (2 channels are usually stereo front L/R; rest are LFE + surround)
  if (channels >= 9) return `${channels - 2}.2`;
  // Other small integers (4, 5) — fall through to generic format
  return `${channels}.0`;
}

/**
 * Determine the Tailwind CSS classes for a resolution badge.
 * Returns the bg/text classes for the colored pill on the card.
 *
 * Color choices:
 *   - 4K  → emerald (high-quality, modern)
 *   - FHD → blue (common, good quality)
 *   - HD  → sky (acceptable, average quality)
 *   - SD  → zinc (low quality, dated)
 */
export function resolutionBadgeClasses(label: string | null): string {
  if (!label) return 'bg-zinc-700/90 text-zinc-400';
  switch (label) {
    case '4K': return 'bg-emerald-600/90 text-white';
    case 'FHD': return 'bg-blue-600/90 text-white';
    case 'HD': return 'bg-sky-700/90 text-white';
    case 'SD': return 'bg-zinc-600/90 text-white';
    default: return 'bg-zinc-700/90 text-zinc-300';
  }
}

/**
 * Determine the Tailwind CSS classes for a video codec badge.
 *
 * Color choices:
 *   - H264 → indigo (very common)
 *   - HEVC → purple (modern, efficient)
 *   - Xvid → amber (legacy)
 *   - MP4  → cyan (web video)
 *   - MP2  → orange (broadcast/DVD)
 *   - VP9  → teal (Google)
 *   - AV1  → fuchsia (cutting-edge)
 *   - default → zinc
 */
export function videoCodecBadgeClasses(label: string | null): string {
  if (!label) return 'bg-zinc-700/90 text-zinc-400';
  switch (label) {
    case 'H264': return 'bg-indigo-700/90 text-white';
    case 'HEVC': return 'bg-purple-700/90 text-white';
    case 'Xvid': return 'bg-amber-700/90 text-white';
    case 'MP4': return 'bg-cyan-700/90 text-white';
    case 'MP2': return 'bg-orange-700/90 text-white';
    case 'VP9': return 'bg-teal-700/90 text-white';
    case 'AV1': return 'bg-fuchsia-700/90 text-white';
    default: return 'bg-zinc-700/90 text-zinc-300';
  }
}

/**
 * Determine the Tailwind CSS classes for an audio channels badge.
 * All channels badges use red (audio is typically red in media UIs).
 */
export function audioChannelsBadgeClasses(label: string | null): string {
  if (!label) return 'bg-zinc-700/90 text-zinc-400';
  return 'bg-red-700/90 text-white';
}
