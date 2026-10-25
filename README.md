# 🎬 nEXTrarr 0.8.0 (Next.js)

A web-based companion tool for **Radarr** and **Sonarr** that fills in the
metadata gaps your media server doesn't handle on its own:

- 🎵 **Theme songs** — searches YouTube and downloads `theme.mp3` per movie/series (via `yt-dlp`)
- 🎬 **Trailers** — writes a `<trailer>` tag into your `.nfo` files so Kodi/Jellyfin can play them
- 🖼️ **Extra artwork** — pulls clearlogo, clearart, banner, landscape, and discart from Fanart.tv and TMDB

Built for **Unraid** deployments via **Community Applications**, with a Docker image published to Docker Hub and GitHub Container Registry.

**This is the Next.js 16 (v0.8.0) version** — full TypeScript + React + Prisma rewrite of the original Flask app. Same feature set, same security model, modern UI with shadcn/ui.

[![Build & Publish](https://github.com/nextrarr/nextrarr/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/nextrarr/nextrarr/actions/workflows/docker-publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.8.0-orange)](CHANGELOG.md)

---

## ✨ Features

- **Switch** between Radarr (movies) and Sonarr (TV series) with one click
- **Filter** by missing theme / artwork / trailer, complete sets, or your own custom filters (saved to DB, shared across devices)
- **Sort** by title, year, or date added (ascending / descending)
- **Search** the local library or search YouTube globally and assign a result to any media
- **Editor** per media: search YouTube for theme or trailer, or paste a URL directly
- **Browse** local files, Fanart.tv results, and TMDB results side-by-side, download/specific
- **Directory browser** to set path mappings (Docker container path → host path)
- **Light / dark theme** with persistent preference (next-themes)
- **Alphabetical navigation** sidebar for fast jumping through large libraries (FIXED in v0.7 — was broken in v1.x due to a typo)
- **TTL cache** on `/api/media` to keep the UI snappy on big libraries
- **Demo mode**: when no API keys are configured, the UI loads 12 mock movies + 4 mock TV shows so you can preview without a real Radarr
- **Path traversal + SSRF protection**: artwork downloads are restricted to a domain whitelist, all filenames are sanitized
- **Optional Basic Auth** via environment variables (disabled by default for Unraid simplicity)
- **Multi-arch Docker image** (amd64 + arm64) — runs on Raspberry Pi Unraid setups

---

## 🚀 Quick install on Unraid

1. In the Unraid web UI, open the **Apps** tab (Community Applications).
2. Search for **nEXTrarr**.
3. Click **Install** and configure:
   - **Port**: `3000` (default)
   - **App Data**: `/mnt/user/appdata/extrarr` (persistent settings + SQLite DB)
   - **Media Root**: `/mnt/user` (read-write, so the app can save `theme.mp3`, artwork files, and NFO trailer tags)
4. Open the WebUI (`http://your-unraid:3000/`) and go to ⚙️ Settings:
   - Enter your **Radarr** and/or **Sonarr** URL + API key
   - Enter your **Fanart.tv** and **TMDB** API keys
   - Set up **path mappings** so the container knows where your media lives on disk
5. Done — start scanning, filtering, and downloading missing metadata.

> If nEXTrarr is not yet listed in Community Applications, you can add the
> template manually: in the Apps tab, click the gear icon → **Add the
> repository URL** → `https://raw.githubusercontent.com/nextrarr/nextrarr/main/unraid/extrarr.xml`

---

## 🐳 Manual Docker deployment

If you're not on Unraid, you can run nEXTrarr with plain Docker:

```bash
docker run -d \
  --name extrarr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/appdata:/config \
  -v /path/to/media:/mnt/user \
  nextrarr/nextrarr:latest
```

Or with Docker Compose (see `docker-compose.yml`):

```bash
git clone https://github.com/nextrarr/nextrarr.git
cd extrarr
docker compose up -d
```

Open `http://localhost:3000/` and follow the setup wizard in Settings.

### Optional Basic Auth

```bash
docker run -d \
  --name extrarr \
  -e EXTRARR_USERNAME=admin \
  -e EXTRARR_PASSWORD=your-strong-password \
  -p 3000:3000 \
  -v /path/to/appdata:/config \
  -v /path/to/media:/mnt/user \
  nextrarr/nextrarr:latest
```

### Demo Mode

To force the UI to load mock data (12 movies + 4 TV shows) even when API keys are configured:

```bash
docker run -d --name extrarr \
  -e EXTRARR_DEMO_MODE=1 \
  -p 3000:3000 \
  -v /path/to/appdata:/config \
  -v /path/to/media:/mnt/user \
  nextrarr/nextrarr:latest
```

---

## 🛠️ Local development

### Prerequisites

- Node.js 20+ (recommended: 22)
- Bun (recommended for fast installs) or npm
- Python 3 (for `yt-dlp` — or install `yt-dlp` system-wide via your package manager)
- `ffmpeg` (required by yt-dlp for audio extraction)
- A Radarr or Sonarr instance for testing (or use demo mode)

### Setup

```bash
git clone https://github.com/nextrarr/nextrarr.git
cd extrarr
bun install          # or: npm install
bun run db:push      # create SQLite tables
```

### Run dev server

```bash
bun run dev          # or: npm run dev
# → http://localhost:3000
```

The app starts in **demo mode** automatically (no API keys configured), so you can preview the UI immediately. To use real data, open ⚙️ Settings and configure your Radarr/Sonarr API keys + path mapping.

### Run lint

```bash
bun run lint
```

### Build the Docker image locally

```bash
docker build -t extrarr:local .
docker run -d --name extrarr-test \
  -p 3000:3000 \
  -v $PWD/config:/config \
  -v /mnt/user:/mnt/user \
  extrarr:local
```

---

## 🏗️ Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (theme provider + sonner toaster)
│   ├── page.tsx                 # Main page (orchestrates all components)
│   ├── globals.css
│   └── api/                     # 18 API routes (1:1 port of Flask blueprints)
│       ├── health/route.ts
│       ├── settings/route.ts
│       ├── browse-dirs/route.ts
│       ├── root-folders/[type]/route.ts
│       ├── media/[type]/route.ts
│       ├── search-media/[type]/[id]/[searchType]/route.ts
│       ├── search-youtube/route.ts
│       ├── download-media/[type]/[id]/route.ts
│       ├── audio-media/[type]/[id]/route.ts
│       ├── get-trailer/[type]/[id]/route.ts
│       ├── set-trailer/[type]/[id]/route.ts
│       ├── download-artwork/[type]/[id]/route.ts
│       ├── search-artwork-online/[type]/[id]/route.ts
│       ├── search-tmdb-artwork/[type]/[id]/route.ts
│       ├── download-specific-artwork/[type]/[id]/route.ts
│       ├── artwork-files/[type]/[id]/route.ts
│       ├── artwork-image/[type]/[id]/[filename]/route.ts
│       └── filters/route.ts + filters/[id]/route.ts
├── components/extrarr/          # 11 React components
│   ├── theme-provider.tsx
│   ├── header.tsx               # Top bar with all controls + stats
│   ├── media-grid.tsx           # Grid + filtering + alpha-nav
│   ├── media-card.tsx           # Single card (textContent for XSS prevention)
│   ├── media-player.tsx         # Bottom audio bar
│   ├── settings-modal.tsx
│   ├── directory-browser-modal.tsx
│   ├── custom-filter-modal.tsx
│   ├── editor-modal.tsx
│   ├── artwork-modal.tsx
│   └── video-modal.tsx
├── lib/
│   ├── security.ts              # sanitizeFilename, validateArtworkUrl, isSafeLocalPath
│   ├── paths.ts                 # resolveLocalPath, validateLocalPath, getNfoFilename
│   ├── nfo.ts                   # NFO read/write (atomic, 4 URL patterns)
│   ├── cache.ts                 # TTLCache for /api/media
│   ├── settings-store.ts        # Prisma-backed settings persistence
│   ├── mock-data.ts             # 12 movies + 4 TV shows for demo mode
│   ├── types.ts                 # Shared TypeScript types
│   ├── db.ts                    # Prisma client (singleton)
│   └── services/                # 5 backend services (1:1 port of Flask)
│       ├── radarr-sonarr.ts
│       ├── fanart.ts
│       ├── tmdb.ts
│       ├── youtube.ts           # yt-dlp wrapper via child_process
│       └── artwork.ts
└── store/
    └── extrarr-store.ts         # Zustand store (client state)

prisma/
└── schema.prisma                # Settings (singleton) + CustomFilter models
```

### Security highlights

- **No `debug=True` in production**: image runs `node server.js` (Next.js standalone), no dev server
- **Path traversal**: every dynamic filename is sanitized via `sanitizeFilename()` and the resolved path is verified to stay under the allowed root prefix (`/mnt` or `/data/media`)
- **SSRF**: artwork downloads only accept URLs on the `image.tmdb.org`, `assets.fanart.tv`, `webservice.fanart.tv` whitelist (HTTPS required)
- **XSS**: every dynamic string is rendered via React children / `textContent`, never `innerHTML` (the v1.x Flask codebase had XSS via media titles)
- **Atomic writes**: NFO updates and theme.mp3 downloads use tmp file + rename to prevent corruption
- **API keys**: stored in SQLite at `/config/extrarr.db` (chmod 600 by entrypoint)

---

## ⚙️ Configuration reference

All settings are stored in a SQLite database (`/config/extrarr.db`) and editable from the WebUI Settings modal.

| Field | Description |
|-------|-------------|
| `radarrUrl` | Base URL of your Radarr instance (e.g. `http://radarr:7878`) |
| `radarrApiKey` | Radarr API key (Settings → General in Radarr UI) |
| `sonarrUrl` | Base URL of your Sonarr instance |
| `sonarrApiKey` | Sonarr API key |
| `fanartApiKey` | Fanart.tv personal API key (https://fanart.tv/get-an-api-key/) |
| `tmdbApiKey` | TMDB v3 API key (https://www.themoviedb.org/settings/api) |
| `pathMap` | List of `{docker, local}` mappings to translate Radarr/Sonarr paths to host paths |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:/config/extrarr.db` | Prisma SQLite connection string (set by Dockerfile) |
| `EXTRARR_ALLOWED_PREFIXES` | `/mnt,/data/media` | Comma-separated list of allowed root prefixes for media paths |
| `EXTRARR_USERNAME` | (empty) | If set with `EXTRARR_PASSWORD`, enables Basic Auth |
| `EXTRARR_PASSWORD` | (empty) | Paired with `EXTRARR_USERNAME` |
| `EXTRARR_LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `EXTRARR_DEMO_MODE` | (empty) | Set to `1` to force mock data even when API keys are configured |
| `EXTRARR_ENV` | `production` | Tracked for logging |

---

## 🧭 Output files

When you click the download button on a media card, nEXTrarr writes the following
files into the media folder (compatible with Kodi/Jellyfin naming conventions):

| File | When | Description |
|------|------|-------------|
| `theme.mp3` | Theme download | Audio theme, played by Kodi on screen-saver and by the nEXTrarr UI |
| `<foldername>.nfo` (movie) or `tvshow.nfo` (TV) | Trailer set | NFO file gets a `<trailer>` tag with a `plugin://plugin.video.youtube/play/?video_id=XXX` URL |
| `<foldername>-clearlogo.png` | Artwork batch / specific | Used by Kodi for clear logos |
| `<foldername>-clearart.png` | Artwork batch / specific | Used by Kodi for clear art |
| `<foldername>-banner.jpg` | Artwork batch | Wide banner image |
| `<foldername>-landscape.jpg` | Artwork batch / specific | 16:9 fanart-style image |
| `<foldername>-discart.png` | Artwork batch (movies only) | Disc art |

---

## 🐛 Troubleshooting

### yt-dlp fails to download theme

1. Check the container logs — `docker logs extrarr` shows yt-dlp version on startup
2. YouTube may have changed their API — update yt-dlp: `docker exec -it extrarr pip3 install --upgrade --break-system-packages yt-dlp`
3. The theme query format is `<title> theme song`. Some movies have weird titles — try the manual URL input in the editor (🔧)

### "Percorso non mappato" error

You need to set up the path mapping in ⚙️ Settings so that the path Radarr sees (e.g. `/movies/Foo`) maps to the actual path on disk (e.g. `/mnt/user/Movies/Foo`). The mapping is applied via simple string replacement.

### Posters show as N/A

Radarr/Sonarr may not have a poster assigned. Open the media in Radarr/Sonarr and verify the poster exists, or use the TMDB artwork section in the nEXTrarr artwork modal to download a poster directly.

### Database schema not applied after update

If you upgrade the image and the schema is missing tables:
```bash
docker exec -it extrarr npx prisma db push --accept-data-loss
```

---

## 📜 License

MIT — see [LICENSE](LICENSE).

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests welcome.

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## ⚠️ Disclaimer

Downloading YouTube audio may violate YouTube's Terms of Service. Use only for
media you legally own. The authors are not responsible for misuse of this tool.
