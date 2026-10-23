/**
 * Settings helpers — read/write to Prisma, with JSON serialization for pathMap.
 */

import { db, ensureSchema } from './db';

export interface SettingsData {
  radarrUrl: string;
  radarrApiKey: string;
  sonarrUrl: string;
  sonarrApiKey: string;
  fanartApiKey: string;
  tmdbApiKey: string;
  pathMap: { docker: string; local: string }[];
}

const DEFAULTS: SettingsData = {
  radarrUrl: '',
  radarrApiKey: '',
  sonarrUrl: '',
  sonarrApiKey: '',
  fanartApiKey: '',
  tmdbApiKey: '',
  pathMap: [],
};

export async function loadSettings(): Promise<SettingsData> {
  await ensureSchema();
  const row = await db.settings.findUnique({ where: { id: 'default' } });
  if (!row) return { ...DEFAULTS };
  let pathMap: { docker: string; local: string }[] = [];
  try {
    const parsed = JSON.parse(row.pathMap);
    if (Array.isArray(parsed)) {
      pathMap = parsed.filter(
        (m): m is { docker: string; local: string } =>
          m && typeof m.docker === 'string' && typeof m.local === 'string',
      );
    }
  } catch {
    // ignore parse error, keep empty
  }
  return {
    radarrUrl: row.radarrUrl,
    radarrApiKey: row.radarrApiKey,
    sonarrUrl: row.sonarrUrl,
    sonarrApiKey: row.sonarrApiKey,
    fanartApiKey: row.fanartApiKey,
    tmdbApiKey: row.tmdbApiKey,
    pathMap,
  };
}

export async function saveSettings(data: SettingsData): Promise<void> {
  await ensureSchema();
  await db.settings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      radarrUrl: data.radarrUrl,
      radarrApiKey: data.radarrApiKey,
      sonarrUrl: data.sonarrUrl,
      sonarrApiKey: data.sonarrApiKey,
      fanartApiKey: data.fanartApiKey,
      tmdbApiKey: data.tmdbApiKey,
      pathMap: JSON.stringify(data.pathMap),
    },
    update: {
      radarrUrl: data.radarrUrl,
      radarrApiKey: data.radarrApiKey,
      sonarrUrl: data.sonarrUrl,
      sonarrApiKey: data.sonarrApiKey,
      fanartApiKey: data.fanartApiKey,
      tmdbApiKey: data.tmdbApiKey,
      pathMap: JSON.stringify(data.pathMap),
    },
  });
}
