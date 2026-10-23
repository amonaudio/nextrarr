/**
 * Mock data provider — used when EXTRARR_DEMO_MODE is set OR when no API keys
 * are configured. Lets the user see the UI in the sandbox preview without a
 * real Radarr/Sonarr connection.
 */

import type { ArrMedia, MediaType } from './services/radarr-sonarr';

const MOCK_MOVIES: ArrMedia[] = [
  {
    id: 1,
    title: 'The Matrix',
    year: 1999,
    path: '/movies/The Matrix',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/f89U3saN9XHCfQNjVqPGjEH2R7m.jpg' }],
    added: '2024-01-15T00:00:00Z',
    tmdbId: 603,
  },
  {
    id: 2,
    title: 'Blade Runner 2049',
    year: 2017,
    path: '/movies/Blade Runner 2049',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/gajva2f0B8X1kC0fFNcSjLsPtLP.jpg' }],
    added: '2024-02-20T00:00:00Z',
    tmdbId: 335984,
  },
  {
    id: 3,
    title: 'Interstellar',
    year: 2014,
    path: '/movies/Interstellar',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/gEU2QdEafN9oH0a5pR1zojVW6rN.jpg' }],
    added: '2024-03-30T00:00:00Z',
    tmdbId: 157336,
  },
  {
    id: 4,
    title: 'The Godfather',
    year: 1972,
    path: '/movies/The Godfather',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/3bhkrj58Vtxx1REj4cFBHD7f6Wz.jpg' }],
    added: '2024-04-10T00:00:00Z',
    tmdbId: 238,
  },
  {
    id: 5,
    title: 'Dune',
    year: 2021,
    path: '/movies/Dune',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/d5NXI3I1n5kMcdXU1t6tSuPRF8Y.jpg' }],
    added: '2024-05-12T00:00:00Z',
    tmdbId: 438631,
  },
  {
    id: 6,
    title: 'Pulp Fiction',
    year: 1994,
    path: '/movies/Pulp Fiction',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/d5iIlFn2sVA0EE3Rv0YFnEcALEw.jpg' }],
    added: '2024-06-05T00:00:00Z',
    tmdbId: 680,
  },
  {
    id: 7,
    title: 'Inception',
    year: 2010,
    path: '/movies/Inception',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/9gk7ad4fYHk2Ri5eCfmmZ2nTkvs.jpg' }],
    added: '2024-07-22T00:00:00Z',
    tmdbId: 27205,
  },
  {
    id: 8,
    title: 'The Dark Knight',
    year: 2008,
    path: '/movies/The Dark Knight',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/qJ2tW6WMUDuxVz5hm3CQ6XuUOfR.jpg' }],
    added: '2024-08-15T00:00:00Z',
    tmdbId: 155,
  },
  {
    id: 9,
    title: 'Avatar',
    year: 2009,
    path: '/movies/Avatar',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/jRXYjD9Ncv1d0eFn6nhpYN1a5XZ.jpg' }],
    added: '2024-09-01T00:00:00Z',
    tmdbId: 19995,
  },
  {
    id: 10,
    title: 'Parasite',
    year: 2019,
    path: '/movies/Parasite',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/7IiTTgloJoKcfLTu3U6CssnoUd2.jpg' }],
    added: '2024-10-10T00:00:00Z',
    tmdbId: 496243,
  },
  {
    id: 11,
    title: 'Mad Max: Fury Road',
    year: 2015,
    path: '/movies/Mad Max Fury Road',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/8tZYtuVg0BSdPwm45OPsWjj5D9r.jpg' }],
    added: '2024-11-03T00:00:00Z',
    tmdbId: 76341,
  },
  {
    id: 12,
    title: 'Everything Everywhere All at Once',
    year: 2022,
    path: '/movies/Everything Everywhere',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/w3LGuY6mS7NIQ9RDxKdHnWVa9aY.jpg' }],
    added: '2024-12-15T00:00:00Z',
    tmdbId: 545611,
  },
];

const MOCK_TV: ArrMedia[] = [
  {
    id: 101,
    title: 'Breaking Bad',
    year: 2008,
    path: '/tv/Breaking Bad',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/ggFHVNu6YYdNtXjVmt5nQNUbVYc.jpg' }],
    added: '2024-01-20T00:00:00Z',
    tvdbId: 81189,
  },
  {
    id: 102,
    title: 'Stranger Things',
    year: 2016,
    path: '/tv/Stranger Things',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/49WFEfeYsfQB87y4XTV7c6Js7BP.jpg' }],
    added: '2024-02-25T00:00:00Z',
    tvdbId: 305439,
  },
  {
    id: 103,
    title: 'The Office',
    year: 2005,
    path: '/tv/The Office',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/qWnYa5JSucvv6Y7of3CuUFTX7oj.jpg' }],
    added: '2024-03-15T00:00:00Z',
    tvdbId: 73244,
  },
  {
    id: 104,
    title: 'Game of Thrones',
    year: 2011,
    path: '/tv/Game of Thrones',
    images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/u37b9nmI4r7PioxPuhq5jo0x1a3.jpg' }],
    added: '2024-04-18T00:00:00Z',
    tvdbId: 121361,
  },
];

export const MOCK_ROOT_FOLDERS = ['/movies', '/tv', '/unmapped'];

/**
 * Determine whether to use mock data. Returns true when EXTRARR_DEMO_MODE=1
 * OR when the requested media type has no API key configured.
 */
export function shouldUseMock(
  mediaType: MediaType,
  settings: { radarrApiKey?: string; sonarrApiKey?: string } | null | undefined,
): boolean {
  if (process.env.EXTRARR_DEMO_MODE === '1') return true;
  if (!settings) return true;
  const key = mediaType === 'radarr' ? settings.radarrApiKey : settings.sonarrApiKey;
  return !key;
}

export function getMockMediaList(mediaType: MediaType): ArrMedia[] {
  return mediaType === 'radarr' ? MOCK_MOVIES : MOCK_TV;
}

export function getMockSingleMedia(mediaType: MediaType, mediaId: number): ArrMedia | null {
  const list = getMockMediaList(mediaType);
  return list.find((m) => m.id === mediaId) ?? null;
}
