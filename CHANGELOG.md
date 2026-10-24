# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v0.6.2.html).

## [0.3] — 2026-10-23 — Connection errors + path mapping fixes

### 🐛 Fixed
- **"Unexpected token '<', '<!doctype'... is not valid JSON" when loading media**:
  the `fetchJson` helper in `src/lib/services/radarr-sonarr.ts` now validates
  the `Content-Type` header before parsing — if the response is HTML instead
  of JSON (wrong URL, reverse proxy returning a login page, missing API key),
  it throws a clear error explaining the cause instead of crashing the JSON
  parser.
- **URL sanitization for *arr connections**: `sanitizeBaseUrl()` strips
  trailing slashes and removes any trailing `/api/v3` path (common mistake
  when users copy-paste from Radarr UI).
- **Same Content-Type + status code fix for Fanart.tv** (`src/lib/services/fanart.ts`):
  distinct errors for 401/403 (invalid key) and 404 (no artwork for that ID).
- **Same fix for TMDB** (`src/lib/services/tmdb.ts`).
- **Path mapping entries were being dropped on save/load** if the `local`
  field was a non-string value (null, undefined, number). The
  `loadSettings` and `saveSettings` functions in `src/lib/settings-store.ts`
  now NORMALIZE non-string fields to `''` instead of filtering them out —
  no more silent data loss.

### ✨ Added
- **"Test Connection" button** in the Settings modal (next to the Radarr and
  Sonarr section headers). Clicks call the new `/api/test-connection/[type]`
  endpoint which pings `${baseUrl}/api/v3/system/status` with the current
  URL + API key (no need to save first). Returns:
  - ✓ green check + toast success if the *arr responds with JSON
  - ✗ red X + detailed error message for each failure mode:
    - 401/403 → "API key rifiutata"
    - 404 → "Endpoint non trovato"
    - HTML response → "URL punta alla pagina web invece dell'API"
    - ENOTFOUND → "Hostname non risolvibile"
    - ECONNREFUSED → "Connessione rifiutata"
    - timeout → "Timeout dopo 10s"
- **Visual feedback inline**: after Test, the result message is shown in
  green/red text under the relevant section, with the icon badge on the
  Test button persisting until the user edits the URL or API key (which
  resets the test state to "idle").

### 🏗️ Changed
- Bumped version 0.2 → 0.3 (badge in header, README, CHANGELOG, entrypoint
  log, Dockerfile header).

---

## [0.2] — 2026-10-23 — Bug fixes + Unraid CA template polish

### 🐛 Fixed
- **Dark theme broken**: ThemeProvider used `attribute="data-theme"` but shadcn CSS
  expects `.dark` class. Switched to `attribute="class"` so next-themes toggles
  `class="dark"` on `<html>`, matching the `.dark { ... }` selector in globals.css.
- **Theme toggle hydration mismatch**: header button now waits for `mounted`
  state before reading `theme` from next-themes (avoids SSR/CSR icon flicker).
- **Path mapping host field was read-only**: removed `readOnly` attribute so
  users can type the host path manually (Unraid users typically know their
  paths and prefer typing over browsing). "Sfoglia" button kept for those
  who prefer the directory browser.
- **Prisma schema not applied on container start**: removed the broken
  `npx --no-install prisma db push` call from entrypoint (the `prisma` CLI
  binary has transitive deps like `effect` and `@prisma/config` that are
  NOT included in the Next.js standalone runtime image, so the binary
  failed to load).
- **Self-healing DB schema**: added `ensureSchema()` function in
  `src/lib/db.ts` that runs `CREATE TABLE IF NOT EXISTS` via
  `@prisma/client.$executeRawUnsafe()` on first DB access. Called from
  `loadSettings`, `saveSettings`, and all `/api/filters` routes. Cache in
  global so it runs once per process.
- **Dockerfile simplified**: no longer copies `node_modules/prisma` (CLI) to
  the runtime image — only the `@prisma/client` runtime. Smaller image,
  no more `Cannot find module 'effect'` errors.
- **Variable name collision**: `get-trailer/[type]/[id]/route.ts` had `const ok`
  declared twice (one from `validateLocalPath` destructuring, one from
  `updateOrCreateNfo` result) — Turbopack build rejected. Renamed second to `saved`.

### ✨ Added
- **Full NFO editor** (Form + Raw XML tabs) in the Editor modal:
  - Form view with 19 structured fields (title, originaltitle, sorttitle,
    year, rating, premiered, runtime, mpaa, studio, genres[], director,
    writer, plot, outline, tags[], trailer, uniqueids[])
  - Raw XML textarea with live validation
  - Atomic save (tmp + rename) on the server
- **Unraid CA template enhanced**: container `<Name>` renamed to `nextrarr`,
  added `<Networking>bridge</Networking>`, expanded Overview with full setup
  instructions + local-build fallback, richer field descriptions.

### 🏗️ Changed
- Bumped version 0.1 → 0.2 (badge in header, README, CHANGELOG, entrypoint log,
  Dockerfile header, Unraid CA template `<Date>`).

---

## [0.1] — 2026-10-22 — Next.js rewrite

### ⚠️ Breaking changes from v1.x (Flask)
- Full rewrite from Flask + vanilla HTML/JS to **Next.js 16 + React + TypeScript**
- Settings storage moved from `/config/config.json` (JSON file) to a **Prisma SQLite database** at `/config/extrarr.db`
- Custom filters moved from browser `localStorage` to the **server-side DB** (shared across devices/browsers)
- Public API URLs are unchanged in shape (`/api/media`, `/api/download_media` → `/api/download-media`, etc.) — Next.js uses kebab-case in paths

### ✨ Added
- **Next.js 16 App Router** with TypeScript 5
- **Prisma ORM** with SQLite for settings + custom filters
- **shadcn/ui** (New York style) for all UI components
- **Zustand** for client state management
- **next-themes** for dark/light toggle (persistent)
- **sonner** for toast notifications
- **Demo mode**: 12 mock movies + 4 mock TV shows loaded automatically when no API keys are configured
- **Health endpoint** at `/api/health` (returns `{"status":"ok"}`)
- **TTL cache** on `/api/media` (5 min default), invalidated after every successful download
- **Multi-arch Docker image** — `linux/amd64` + `linux/arm64` (works on Raspberry Pi Unraid setups)
- **Unraid Community Applications template** at `unraid/extrarr.xml`
- **GitHub Actions CI/CD** — auto-build and push on tag release to both Docker Hub and GitHub Container Registry (ghcr.io)
- **Atomic writes**: NFO updates and theme.mp3 downloads use tmp file + rename to prevent corruption

### 🐛 Fixed (carried over from v0.6.2 of the Flask rewrite)
- `scrollToLetter` was broken in v1.2.2 due to `c.dataset_title` typo — now uses `c.dataset.title`
- `updateFilterDropdown` previously skipped options during `forEach+remove` (indices shifted) — fixed by iterating backwards
- NFO trailer regex now matches 4 URL formats: `plugin://`, `watch?v=`, `youtu.be/`, `embed/`
- Mimetype for served artwork images correctly inferred via file extension (PNG no longer returns `image/jpeg`)
- XSS in `renderGrid`, `viewArtwork`, `editorSearch` — all dynamic strings now rendered via React children / `textContent`

### 🔒 Security
- Path traversal in `/api/download-specific-artwork` and `/api/artwork-image` blocked by `sanitizeFilename()` (hard-rejects `..`) and defense-in-depth realpath check
- SSRF in artwork download mitigated via URL whitelist (`image.tmdb.org`, `assets.fanart.tv`, `webservice.fanart.tv`) — HTTPS required
- `EXTRARR_ALLOWED_PREFIXES` env var (default `/mnt,/data/media`) restricts all filesystem operations
- Config database at `/config/extrarr.db` written with mode `0600` by `entrypoint.sh`

### 🏗️ Changed
- Production runtime switched from Flask dev server to **Next.js standalone build** (`node server.js`) behind `tini`
- Dockerfile is now multi-stage:
  1. `deps` — install npm deps with cache
  2. `builder` — compile Next.js with `output: 'standalone'`
  3. `runtime` — minimal alpine image with `ffmpeg`, `yt-dlp` (via pip3), `curl`, `tini`
- `entrypoint.sh` runs `npx prisma db push` on every boot to ensure schema is up to date
- `/api/media` returns mock data when in demo mode (12 movies with synthesized `has_theme`/`has_artwork`/`has_trailer` flags)

### 📦 Docker / Unraid
- Image: `nextrarr/nextrarr:latest` (replace with your Docker Hub user)
- Multi-arch: `linux/amd64` + `linux/arm64`
- Volumes: `/config` (persistent DB + settings) + `/mnt/user` (Unraid media root, RW)
- Healthcheck: `curl -fsS http://localhost:3000/api/health`
- Env vars: `EXTRARR_USERNAME`, `EXTRARR_PASSWORD`, `EXTRARR_ALLOWED_PREFIXES`, `EXTRARR_LOG_LEVEL`, `EXTRARR_DEMO_MODE`

---

## [1.x] — Flask + vanilla JS

See the Flask version's CHANGELOG.md for the history of v1.2.2 and earlier.
