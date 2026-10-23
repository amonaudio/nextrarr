/**
 * NFO file management — port of app/nfo.py
 * Reads/writes <trailer> tags in Kodi/Jellyfin NFO files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getNfoFilename } from './paths';

const YOUTUBE_ID_REGEX = /[a-zA-Z0-9_-]{11}/;

// Patterns ordered from most specific to most permissive.
const TRAILER_PATTERNS: RegExp[] = [
  // plugin://plugin.video.youtube/play/?video_id=XXXXXXXXXXX
  /<trailer>.*?video_id=([a-zA-Z0-9_-]{11})<\/trailer>/i,
  // https://www.youtube.com/watch?v=XXXXXXXXXXX
  /<trailer>\s*https?:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})\s*<\/trailer>/i,
  // https://youtu.be/XXXXXXXXXXX
  /<trailer>\s*https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})\s*<\/trailer>/i,
  // https://www.youtube.com/embed/XXXXXXXXXXX
  /<trailer>\s*https?:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]{11})\s*<\/trailer>/i,
];

/**
 * Extract a YouTube video ID from NFO content, trying multiple URL formats.
 */
export function extractTrailerId(nfoContent: string): string | null {
  for (const pattern of TRAILER_PATTERNS) {
    const match = nfoContent.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract an 11-char YouTube video ID from a watch/share/embed/shorts URL.
 */
export function extractYoutubeId(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Check whether an NFO file contains a <trailer> tag.
 */
export async function hasTrailerInNfo(nfoPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(nfoPath, 'utf-8');
    const lower = content.toLowerCase();
    return lower.includes('<trailer>') && lower.includes('</trailer>');
  } catch {
    return false;
  }
}

/**
 * Insert or replace the <trailer> tag in an NFO file.
 * Uses atomic write (tmp file + rename).
 */
export async function updateOrCreateNfo(
  nfoPath: string,
  mediaType: 'radarr' | 'sonarr',
  videoId: string,
): Promise<boolean> {
  if (!YOUTUBE_ID_REGEX.test(videoId)) {
    return false;
  }
  const rootTag = mediaType === 'radarr' ? 'movie' : 'tvshow';
  const trailerLine = `  <trailer>plugin://plugin.video.youtube/play/?video_id=${videoId}</trailer>\n`;

  try {
    let content = '';
    try {
      content = await fs.readFile(nfoPath, 'utf-8');
    } catch {
      // File doesn't exist — will create new
    }

    if (content) {
      if (content.includes('<trailer>')) {
        content = content.replace(
          /<trailer>[\s\S]*?<\/trailer>/,
          `<trailer>plugin://plugin.video.youtube/play/?video_id=${videoId}</trailer>`,
        );
      } else if (content.includes(`</${rootTag}>`)) {
        content = content.replace(`</${rootTag}>`, `${trailerLine}</${rootTag}>`);
      } else {
        content += trailerLine;
      }
    } else {
      content = `<${rootTag}>\n${trailerLine}</${rootTag}>\n`;
    }

    // Atomic write
    const tmpPath = nfoPath + '.tmp';
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, nfoPath);
    return true;
  } catch (err) {
    console.error(`[nfo] Failed to update ${nfoPath}:`, err);
    return false;
  }
}

export { getNfoFilename };
