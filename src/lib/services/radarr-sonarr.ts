/**
 * Radarr/Sonarr API client — port of app/services/radarr_sonarr.py
 */

export type MediaType = 'radarr' | 'sonarr';
export type ApiPath = 'movie' | 'series';

const API_PATH: Record<MediaType, ApiPath> = {
  radarr: 'movie',
  sonarr: 'series',
};

export interface ArrImage {
  coverType: string;
  remoteUrl: string;
}

export interface ArrMedia {
  id: number;
  title: string;
  year?: number | null;
  path: string;
  images?: ArrImage[];
  added?: string;
  firstAired?: string;
  tmdbId?: number | null;
  tvdbId?: number | null;
}

export interface Settings {
  radarrUrl: string;
  radarrApiKey: string;
  sonarrUrl: string;
  sonarrApiKey: string;
  fanartApiKey: string;
  tmdbApiKey: string;
  pathMap: { docker: string; local: string }[];
}

function buildHeaders(apiKey: string): HeadersInit {
  return { 'X-Api-Key': apiKey };
}

async function fetchJson(url: string, headers: HeadersInit, timeout = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchMediaList(
  settings: Pick<Settings, 'radarrUrl' | 'radarrApiKey' | 'sonarrUrl' | 'sonarrApiKey'>,
  mediaType: MediaType,
  timeout = 15000,
): Promise<ArrMedia[]> {
  const urlKey = mediaType === 'radarr' ? 'radarrUrl' : 'sonarrUrl';
  const keyKey = mediaType === 'radarr' ? 'radarrApiKey' : 'sonarrApiKey';
  const baseUrl = settings[urlKey];
  const apiKey = settings[keyKey];
  if (!apiKey) throw new Error(`API Key per ${mediaType} mancante`);
  const apiPath = API_PATH[mediaType];
  const data = await fetchJson(`${baseUrl}/api/v3/${apiPath}`, buildHeaders(apiKey), timeout);
  return data as ArrMedia[];
}

export async function fetchSingleMedia(
  settings: Settings,
  mediaType: MediaType,
  mediaId: number,
  timeout = 10000,
): Promise<ArrMedia> {
  const urlKey = mediaType === 'radarr' ? 'radarrUrl' : 'sonarrUrl';
  const keyKey = mediaType === 'radarr' ? 'radarrApiKey' : 'sonarrApiKey';
  const apiKey = settings[keyKey];
  if (!apiKey) throw new Error(`API Key per ${mediaType} mancante`);
  const apiPath = API_PATH[mediaType];
  const data = await fetchJson(
    `${settings[urlKey]}/api/v3/${apiPath}/${mediaId}`,
    buildHeaders(apiKey),
    timeout,
  );
  return data as ArrMedia;
}

export async function fetchRootFolders(
  settings: Settings,
  mediaType: MediaType,
  timeout = 10000,
): Promise<string[]> {
  const urlKey = mediaType === 'radarr' ? 'radarrUrl' : 'sonarrUrl';
  const keyKey = mediaType === 'radarr' ? 'radarrApiKey' : 'sonarrApiKey';
  const apiKey = settings[keyKey];
  if (!apiKey) return [];
  try {
    const data = await fetchJson(
      `${settings[urlKey]}/api/v3/rootFolder`,
      buildHeaders(apiKey),
      timeout,
    );
    const list = data as { path: string }[];
    return list.map((rf) => rf.path);
  } catch (err) {
    console.warn(`[radarr-sonarr] fetchRootFolders(${mediaType}) failed:`, err);
    return [];
  }
}
