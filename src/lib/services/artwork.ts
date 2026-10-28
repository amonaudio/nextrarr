/**
 * Artwork file management — port of app/services/artwork.py
 *
 * [0.7.12-test] Two separate keyword lists:
 *
 *   SCAN_ART_KEYWORDS — used by scanLocalArtwork() to enumerate which
 *     files to show in the ArtworkModal "🖼️ Artwork Locali" grid.
 *     Includes ALL artwork kinds the app recognizes: the historical
 *     "extra" set (clearlogo/clearart/banner/landscape/discart/keyart/
 *     logo) PLUS poster and fanart, which were previously missing →
 *     files like "WALL•E-poster.jpg" and "WALL•E-fanart.jpg" were
 *     invisible in the modal even though they existed on disk.
 *
 *   EXTRA_ARTWORK_KEYWORDS — used by hasExtraArtwork() to compute the
 *     "Artwork ✓/✗" badge on the MediaCard. Stays as the historical
 *     list ONLY, because:
 *       - poster is almost always present in a media folder (it's the
 *         main poster Radarr already downloads); if we included it,
 *         every card would show Artwork ✓ even when no EXTRA artwork
 *         has been downloaded, defeating the purpose of the flag.
 *       - fanart (background) is also commonly shipped by Radarr and
 *         would inflate the same counter.
 *     So the badge reflects "extra artwork beyond the basic
 *     poster/fanart" — a more useful signal.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateArtworkUrl, sanitizeFilename } from '../security';

const SCAN_ART_KEYWORDS = [
  'clearlogo', 'clearart', 'banner', 'landscape', 'discart', 'keyart', 'logo',
  'poster', 'fanart',
];
const EXTRA_ARTWORK_KEYWORDS = [
  'clearlogo', 'clearart', 'banner', 'landscape', 'discart', 'keyart', 'logo',
];
const ART_EXTENSIONS = ['.jpg', '.png', '.jpeg'];

/**
 * [0.8.2] True when a filename is one of the artwork files we manage in
 * the ArtworkModal (same rules as scanLocalArtwork). Used by the DELETE
 * route so a malicious/buggy request cannot delete theme.mp3, .nfo files
 * or arbitrary files inside the media folder.
 */
export function isArtworkFilename(filename: string): boolean {
  const fl = filename.toLowerCase();
  return (
    ART_EXTENSIONS.some((ext) => fl.endsWith(ext)) &&
    SCAN_ART_KEYWORDS.some((kw) => fl.includes(kw))
  );
}

export async function scanLocalArtwork(localPath: string): Promise<string[]> {
  const images: string[] = [];
  try {
    const files = await fs.readdir(localPath);
    for (const f of files) {
      // [0.7.12-test] Use SCAN_ART_KEYWORDS (includes poster + fanart)
      // so the ArtworkModal shows ALL artwork files, not just the
      // "extra" set. The hasExtraArtwork flag uses a separate list.
      if (isArtworkFilename(f)) {
        images.push(f);
      }
    }
  } catch (err) {
    console.warn(`[artwork] cannot list ${localPath}:`, err);
  }
  return images;
}

export function hasThemeMp3(localPath: string): boolean {
  return existsSync(path.join(localPath, 'theme.mp3'));
}

export async function hasExtraArtwork(localPath: string): Promise<boolean> {
  try {
    const files = await fs.readdir(localPath);
    for (const f of files) {
      const fl = f.toLowerCase();
      if (ART_EXTENSIONS.some((ext) => fl.endsWith(ext)) &&
          EXTRA_ARTWORK_KEYWORDS.some((kw) => fl.includes(kw))) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export async function downloadArtworkToFolder(
  url: string,
  ourType: string,
  ext: string,
  localPath: string,
): Promise<string> {
  if (!validateArtworkUrl(url)) {
    throw new Error(`URL non consentito: ${url}`);
  }
  const safeType = sanitizeFilename(ourType);
  if (!safeType) throw new Error(`Tipo artwork non valido: ${JSON.stringify(ourType)}`);
  let safeExt = sanitizeFilename(ext) ?? 'png';
  safeExt = safeExt.replace(/^\./, '');

  const folderName = path.basename(localPath.replace(/\/+$/, ''));
  if (!folderName) throw new Error(`Percorso cartella non valido: ${JSON.stringify(localPath)}`);

  const filename = `${folderName}-${safeType}.${safeExt}`;
  const savePath = path.join(localPath, filename);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
    const buf = await res.arrayBuffer();
    const tmpPath = savePath + '.tmp';
    await fs.writeFile(tmpPath, Buffer.from(buf));
    await fs.rename(tmpPath, savePath);
    return filename;
  } finally {
    clearTimeout(timeoutId);
  }
}
