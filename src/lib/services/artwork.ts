/**
 * Artwork file management — port of app/services/artwork.py
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateArtworkUrl, sanitizeFilename } from '../security';

const ART_KEYWORDS = ['clearlogo', 'clearart', 'banner', 'landscape', 'discart', 'keyart', 'logo'];
const ART_EXTENSIONS = ['.jpg', '.png', '.jpeg'];

export async function scanLocalArtwork(localPath: string): Promise<string[]> {
  const images: string[] = [];
  try {
    const files = await fs.readdir(localPath);
    for (const f of files) {
      const fl = f.toLowerCase();
      if (!ART_EXTENSIONS.some((ext) => fl.endsWith(ext))) continue;
      if (ART_KEYWORDS.some((kw) => fl.includes(kw))) {
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
          ART_KEYWORDS.some((kw) => fl.includes(kw))) {
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
