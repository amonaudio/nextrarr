/**
 * Radarr/Sonarr API client — port of app/services/radarr_sonarr.py
 *
 * Includes URL sanitization (strips trailing slashes) and explicit
 * Content-Type validation so we return a clear error when the configured
 * URL points to a web page instead of the API (e.g. user typed the
 * base URL of a reverse proxy, or the API key is wrong and Radarr
 * redirects to its login HTML page).
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

/**
 * [0.8.0] Media info from Radarr/Sonarr's MediaInfo probe (via ffprobe).
 * Only the fields we use for UI badges are typed — the API returns
 * many more (resolution name, audio bitrate, subtitles, runtimes, etc.)
 * but we don't need them and don't want to bloat the JSON over the wire.
 */
export interface ArrMediaInfo {
  videoCodec?: string | null;
  audioCodec?: string | null;
  audioChannels?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: string | null;
}

/**
 * [0.8.0] Quality object — what Radarr/Sonarr stores about the release
 * quality of a movie/episode file. We only use `resolution` (number)
 * and optionally `source` for future badges (BluRay / WEBDL / HDTV).
 */
export interface ArrQualityQuality {
  id?: number;
  name?: string;       // e.g. "HD-1080p", "UltraHD-2160p"
  source?: string;     // e.g. "BluRay", "WEBDL", "HDTV", "DVD"
  resolution?: number; // e.g. 1080, 2160, 720, 480
}

export interface ArrQuality {
  quality?: ArrQualityQuality;
  revision?: unknown;
  // other fields ignored
}

/**
 * [0.8.0] Movie file (Radarr only — Sonarr exposes EpisodeFile via a
 * separate endpoint, NOT in the series list). Contains the quality
 * and mediaInfo we use for the resolution/codec badges.
 */
export interface ArrMovieFile {
  id?: number;
  relativePath?: string;
  path?: string;
  size?: number;
  dateAdded?: string;
  quality?: ArrQuality;
  mediaInfo?: ArrMediaInfo | null;
}

/**
 * [0.8.0] Statistics for Sonarr series — count of episode files,
 * size on disk, % complete. Does NOT include mediaInfo (would require
 * a separate /api/v3/episodeFile?seriesId=X call per series).
 */
export interface ArrSeriesStatistics {
  episodeFileCount?: number;
  episodeFileCountTotal?: number;
  sizeOnDisk?: number;
  percentOfEpisodes?: number;
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
  /** [0.8.0] Radarr only — present when the movie has a downloaded file. */
  movieFile?: ArrMovieFile | null;
  /** [0.8.0] Sonarr only — aggregate stats (no mediaInfo). */
  statistics?: ArrSeriesStatistics;
  /** [0.8.0] Both — flag indicating a file exists on disk. */
  hasFile?: boolean;
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

/**
 * Strip trailing slashes from a base URL to avoid double slashes when
 * concatenating with /api/v3/...
 * Also remove any trailing /api/v3 path if user mistakenly included it.
 */
function sanitizeBaseUrl(raw: string): string {
  let url = raw.trim();
  // Strip trailing slash(es)
  url = url.replace(/\/+$/, '');
  // Strip trailing /api/v3 if user mistakenly included it
  url = url.replace(/\/api\/v\d+$/i, '');
  return url;
}

/**
 * Fetch a URL and parse JSON, with explicit Content-Type validation.
 * Throws a clear error if the response is HTML (likely wrong URL or auth).
 */
async function fetchJson(url: string, headers: HeadersInit, timeout = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      // Try to read the body for additional context (might be JSON error or HTML)
      let bodyPreview = '';
      try {
        bodyPreview = (await res.text()).slice(0, 200);
      } catch { /* ignore */ }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`API key non valida o mancante (HTTP ${res.status}). Verifica la chiave nelle Impostazioni.`);
      }
      if (res.status === 404) {
        throw new Error(`Endpoint non trovato (HTTP 404). L'URL "${url}" non è un endpoint API valido.`);
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} da ${url}. Risposta: ${bodyPreview.slice(0, 100)}`);
    }
    // Validate Content-Type is JSON, not HTML
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      // The response is HTML (probably Radarr's web UI homepage because URL is wrong)
      let bodyPreview = '';
      try { bodyPreview = (await res.text()).slice(0, 100); } catch { /* ignore */ }
      throw new Error(
        `L'URL "${url}" ha restituito HTML invece di JSON (Content-Type: ${contentType || 'vuoto'}). ` +
        `Probabile causa: URL errato (deve essere la BASE URL senza /api/v3), ` +
        `oppure stai puntando alla pagina web di login invece che all'API. ` +
        `Anteprima risposta: ${bodyPreview.slice(0, 60)}...`
      );
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
  const baseUrl = sanitizeBaseUrl(settings[urlKey]);
  if (!baseUrl) throw new Error(`URL per ${mediaType} mancante`);
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
  const baseUrl = sanitizeBaseUrl(settings[urlKey]);
  if (!baseUrl) throw new Error(`URL per ${mediaType} mancante`);
  const apiKey = settings[keyKey];
  if (!apiKey) throw new Error(`API Key per ${mediaType} mancante`);
  const apiPath = API_PATH[mediaType];
  const data = await fetchJson(
    `${baseUrl}/api/v3/${apiPath}/${mediaId}`,
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
  const baseUrl = sanitizeBaseUrl(settings[urlKey]);
  const apiKey = settings[keyKey];
  if (!baseUrl || !apiKey) return [];
  try {
    const data = await fetchJson(
      `${baseUrl}/api/v3/rootFolder`,
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
