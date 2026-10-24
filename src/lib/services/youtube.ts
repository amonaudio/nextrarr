/**
 * yt-dlp wrapper — port of app/services/youtube.py
 * Uses Node child_process to spawn the yt-dlp binary.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const YT_DLP_BIN = 'yt-dlp';
const DEFAULT_UA = 'Mozilla/5.0';

export function isAvailable(): boolean {
  // Check via which/where
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    try {
      execSync(`${cmd} ${YT_DLP_BIN}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export interface SearchResult {
  title: string;
  url: string;
  video_id: string;
}

function runYtDlp(args: string[], timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeout);
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`yt-dlp timed out after ${timeout}s`));
        return;
      }
      if (code !== 0 && stderr) {
        console.warn(`[yt-dlp] non-zero exit ${code}: ${stderr.slice(0, 500)}`);
      }
      resolve(stdout);
    });
  });
}

export async function search(query: string, limit = 10, timeout = 30000): Promise<SearchResult[]> {
  if (!isAvailable()) throw new Error('yt-dlp binary not installed');
  const args = [
    '--flat-playlist', '--dump-json', '--quiet', '--no-warnings',
    '--user-agent', DEFAULT_UA, '--force-ipv4',
    `ytsearch${limit}:${query}`,
  ];
  const stdout = await runYtDlp(args, timeout);
  const videos: SearchResult[] = [];
  for (const line of stdout.trim().split('\n')) {
    if (!line) continue;
    try {
      const data = JSON.parse(line);
      const vid = data.id;
      if (vid) {
        videos.push({
          title: data.title ?? '(senza titolo)',
          url: `https://www.youtube.com/watch?v=${vid}`,
          video_id: vid,
        });
      }
    } catch {
      // skip malformed line
    }
  }
  return videos;
}

export async function downloadAudio(
  urlOrQuery: string,
  outputTemplate: string,
  timeout = 180000,
): Promise<boolean> {
  if (!isAvailable()) throw new Error('yt-dlp binary not installed');
  const args = [
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '-o', outputTemplate,
    '--no-playlist', '--quiet', '--no-warnings',
    '--no-write-thumbnail', '--no-write-info-json',
    '--user-agent', DEFAULT_UA, '--force-ipv4',
    // [0.7.3] Force overwrite: by default yt-dlp SKIPS downloads when the
    // output file already exists (e.g. theme.mp3 from a previous run).
    // The user clicked "scarica tema" expecting a fresh download —
    // without this flag they get a green toast but the old file is kept.
    '--force-overwrites',
    // Don't try to resume partial downloads: a stale .part file from a
    // previous interrupted run could confuse yt-dlp. Always start clean.
    '--no-continue',
    urlOrQuery,
  ];
  try {
    await runYtDlp(args, timeout);
    return true;
  } catch (err) {
    console.error('[yt-dlp] download failed:', err);
    return false;
  }
}
