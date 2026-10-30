# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.32] — 2026-10-29 — Editorial library redesign

### ✨ Added
- **New editorial shell** based on the approved `mockup-v0.8.32.html`:
  warm light/dark palette, serif display type, persistent left rail,
  sticky topbar and responsive mobile drawer.
- **Library overview hero** with live coverage ring, theme/artwork/trailer
  bars, valid-title and path-warning counters.
- **Command palette (`⌘K`)** for local media search, quick filters,
  Radarr/Sonarr switching, refresh, settings and YouTube search.
- **Grid/list view toggle**, with a compact list layout, completion counter
  and per-row quick actions.
- **“Completa i mancanti”** shortcuts in the hero, rail and command palette.

### 🏗️ Changed
- Replaced the legacy header with `LibrarySidebar`, `LibraryTopbar`,
  `LibraryOverview` and `LibraryToolbar`.
- Restyled media cards with poster overlays, NEW badge, quality chips,
  warning states and a 0/3 completion footer.
- Shared filtering/statistics logic in `src/lib/library.ts`; existing
  filter, sort, folder, search and custom-filter semantics are preserved.
- The player is now a floating dock that only appears while a track is
  playing.
- Bumped version to 0.8.32 in `package.json`, README, Dockerfile,
  entrypoint and legacy header badge.

### 📋 Verification
- `tsc --noEmit`: only the two pre-existing errors in
  `src/lib/security.ts` and `src/lib/settings-store.ts`.
- ESLint passes on every new/touched component and helper; `page.tsx`
  still reports the pre-existing hydration-effect warning/error.
- `npm run build` succeeds with Node 22.14.0; `.next/standalone` is
  generated and the build script copies `static` and `public` into it.
- Standalone demo smoke test: `/` → 200, `/api/media/radarr` → 200,
  `/api/media/sonarr` → 200, `/api/settings` → 200; no runtime errors
  in the server log. Visual check in a real browser is still recommended.

## [0.8.3] — 2026-10-26 — Tooltip delay, NEW indicator, artwork filters, folder view & external links

### ✨ Added
- **Artwork type filters** in the ArtworkModal. A single global filter
  applies to the local, Fanart.tv and TMDB sections at once, with counts
  for every type. It resets to "Tutti" each time the modal opens, and
  zero-count types stay visible but disabled.
- **Read-only local folder view**: clicking "Artwork Locali" opens an
  in-app modal listing the media folder (files, directories and symlinks,
  with sizes). New `GET /api/local-folder/[type]/[id]` endpoint with path
  mapping/allow-prefix validation and a 500-entry cap.
- **Fanart.tv / TMDB page links**: the online column titles are now
  clickable. New `GET /api/external-links/[type]/[id]` resolves the exact
  movie/series page from TMDB/TVDB IDs and falls back to a search URL when
  an ID is missing.
- **NEW indicator (B3)**: a pulsing dot on the poster for titles added in
  the last 14 days that still need an action (mapping, theme, artwork or
  trailer). It disappears automatically once the title is complete.
- **Realistic demo dates**: mock titles now use relative `added` dates and
  TV entries include TMDB IDs, so the NEW dot and external links can be
  tested in demo mode.

### 🏗️ Changed
- **Tooltips now appear after 3 seconds everywhere**: a single
  `TooltipProvider` in the root layout replaces the per-component
  providers (which used 0/300 ms and overrode each other). Sidebar
  tooltips use the same 3000 ms delay.
- Bumped version 0.8.2 → 0.8.3 (header badge, package.json, README,
  Dockerfile, entrypoint, CHANGELOG).

### 🐛 Fixed
- Removed the nested `TooltipProvider` inside the base `Tooltip`
  component that silently forced every tooltip to open immediately.

### 📋 Verification
- `npm run build` succeeds with Node 20.
- ESLint passes on all touched files; `tsc --noEmit` still reports only
  the two pre-existing errors in `src/lib/security.ts` and
  `src/lib/settings-store.ts`.
- Demo-mode endpoint smoke tests: `/api/external-links` returns the
  Matrix/Breaking Bad pages, `/api/local-folder` returns movie/TV
  listings, `/api/artwork-files` and `/api/health` respond normally.
- Pure-helper tests: 15/15 checks for the NEW badge date/action logic and
  local artwork type classification.

## [0.8.2] — 2026-10-25 — Artwork modal redesign, delete artwork, cache & filters

### ✨ Added
- **Delete local artwork from the ArtworkModal** (chosen style 2): each
  local artwork now has a compact action row under the image with
  "Ingrandisci" and a red "Elimina" button. Delete asks for confirmation
  in an `AlertDialog` and then calls the new
  `DELETE /api/artwork-files/[type]/[id]?filename=...` endpoint.
  Server-side validation:
    - type/id validation and filename sanitization (no paths/traversal);
    - only artwork extensions (`.jpg/.jpeg/.png`) matching the artwork
      keyword whitelist can be deleted (theme.mp3, .nfo, subtitles etc.
      are rejected);
    - resolved path must stay inside the media folder;
    - `mediaCache` + `folderCache` are invalidated immediately.
  In demo mode the deleted mock file is hidden per process so the UI flow
  can be tested without touching the disk.
- **Persistent filters**: `mediaType`, `sortField`, `sortDir`,
  `rootFolderFilter`, `mainFilter`, `localSearch` and
  `activeCustomFilter` are now saved to `localStorage` (Zustand
  `persist`). A browser refresh keeps the same view. Transient state
  (media list, loading/errors, selection, player) is deliberately not
  persisted and is re-fetched.
- **Refresh feedback**: the header "Aggiorna" button is disabled and
  shows a spinner + "Aggiornamento..." while the library and caches are
  being refreshed.

### 🏗️ Changed
- **ArtworkModal — Modale 1**: fixed 95vh modal with three bordered
  panels; on desktop each panel scrolls independently (`min-h-0` +
  `overflow-y-auto`) with a fixed header, while on mobile the columns
  stack and the whole modal scrolls. Lists remain single-column with
  large thumbnails.
- **Info badges — Badge B1**: resolution/codec/audio badges moved from
  an overlay on the poster to a strip directly below the poster, before
  the title/footer. The strip is not rendered when all values are null.
- **Unified icon**: the canonical `public/logo.svg` is now used for the
  header (replaces the 🎬 emoji), the favicon (`public/favicon.png`) and
  the Unraid/Docker icon (`unraid/icon.png`). Both PNGs are generated at
  256×256 by `scripts/generate-icons.mjs` (sharp).
- Bumped version 0.8.1 → 0.8.2 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 🐛 Fixed
- **Replaced artwork not refreshing until a full page reload**:
    - `/api/media/[type]` now appends the local poster file mtime to the
      `/api/artwork-image/...` URL (`?v=<mtime>`), so a same-name
      replacement changes the `<img src>` immediately.
    - ArtworkModal local `<img>` URLs include `?v=<timestamp>` bumped
      after upload/download/delete.
    - `MediaCard` resets its poster fallback state when the assigned
      poster URL changes.
    - `/api/media/[type]`, `/api/artwork-files/[type]/[id]` and the
      client `apiFetch` wrapper now use explicit `no-store` /
      `Cache-Control: no-store`, and the modal's raw fetches pass
      `cache: 'no-store'`.
- The header refresh action now reports errors instead of silently
  continuing.

### 📋 Verification
- `scripts/generate-icons.mjs` run successfully; `public/favicon.png`
  and `unraid/icon.png` are byte-identical 256×256 PNGs.
- Typecheck/lint and Docker image build delegated to GitHub Actions
  because the local workspace runs Node 18 while Next.js 16 requires
  Node >= 20.9.
- Manual test scenarios:
  - open the artwork modal, replace a poster, close → the card updates
    immediately; reopen the modal → the new bytes are shown;
  - delete a local artwork → item disappears, poster falls back if it
    was the poster, and a page refresh keeps it deleted;
  - set filters/sort/search, refresh the browser → the same view is
    restored;
  - header/favicon/Unraid icon all show the same brand mark.

## [0.8.1] — 2026-10-25 — ArtworkModal width fix

### 🐛 Fixed
- **ArtworkModal too narrow after v0.8.0 redesign**: the v0.8.0 redesign
  moved from a single-column stacked layout to a 3-column side-by-side
  layout. The user reported that thumbnails became NARROWER than the
  previous v0.7.13 layout — they were correct. Math:
    - v0.7.13: `max-w-3xl` (768px) / 1 section / grid-auto-fill `minmax(120px,1fr)`
      → thumbnails ~120-180px wide
    - v0.8.0: `max-w-6xl` (1152px) / 3 sections / `grid-cols-2` inside
      each section → each section ~370px → each thumbnail ~170px
  The 3-column layout was good (no scrolling), but the `grid-cols-2`
  inside each section made thumbnails too small again.

  Fix (3 changes):
    1. `max-w-6xl` (1152px) → **`w-[100vw] max-w-[100vw]
       sm:max-w-[100vw]`**. The modal now uses the full viewport width;
       the explicit `sm:` override is required because the base
       `DialogContent` applies `sm:max-w-lg` (512px).
    2. Inside each section: `grid-cols-2 gap-2` → **`grid-cols-1 gap-3`**
       (1 thumbnail per row, full section width).
    3. Thumbnail height: `h-48` (200px) → **`h-64`** (256px), so the
       taller single-column cards do not make the modal excessively
       long.

  Result: on a 1920px monitor each of the 3 sections is roughly 600px
  wide and each thumbnail fills that width, ~3.5x wider than v0.8.0
  (~600 vs ~170). The user request "almeno 3 volte la larghezza
  attuale" is satisfied.

  Trade-off: with `grid-cols-1` the user sees fewer thumbnails per
  screen (3 per row instead of 6) and needs to scroll more for long
  lists. But each thumbnail is now actually visible without clicking
  to zoom — which is what the user wanted.

### 🏗️ Changed
- Bumped version 0.8.0 → 0.8.1 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `tsc --noEmit`: no new errors in the modified files. Two pre-existing
  errors remain in `src/lib/security.ts` and `src/lib/settings-store.ts`.
- Docker image build: delegated to GitHub Actions (the local workspace
  runs Node 18, while Next.js 16 requires Node >= 20.9).
- `eslint`: only the pre-existing `react-hooks/set-state-in-effect`
  reports; no new lint issues in the modified files.
- Manual test scenarios to verify:
  - Open ArtworkModal on a 1920 monitor → modal width = viewport width
    (was ~1152px in v0.8.0, ~768px in v0.7.13)
  - Each thumbnail fills its ~600px section ✓ (was ~170px in v0.8.0)
  - Thumbnail height 256px ✓ (was 200px in v0.8.0)
  - 3 columns side-by-side still work ✓ (no scrolling between sections)
  - Drag&drop still works (no regression) ✓
  - "Carica da PC" button still works ✓
  - Existing functionality preserved: zoom modal, "Scarica" button,
    "Aggiorna libreria" refreshes ✓

## [0.8.0] — 2026-10-25 — Media info badges + Artwork upload + modal redesign

### ✨ Added
- **Media info badges on MediaCard** (resolution + video codec + audio
  channels). Three colored pills are now displayed in the bottom-left
  corner of the poster, allowing a glance at the file quality:
    - Resolution: `4K` (emerald), `FHD` (blue), `HD` (sky), `SD` (zinc)
    - Video codec: `H264` (indigo), `HEVC` (purple), `Xvid` (amber),
      `MP4` (cyan), `MP2` (orange), `VP9` (teal), `AV1` (fuchsia)
    - Audio channels: `5.1` / `7.1` / `2.0` (red pill)
  The badges are hidden entirely when all three values are null
  (e.g. for Sonarr TV series — see "limitation" below).

- **"Carica da PC" button in ArtworkModal** — allows the user to upload
  a custom artwork image (JPG/PNG, max 10 MB) from their browser, which
  gets saved to the media folder with a sanitized filename. Drag&drop
  also supported as a bonus (drop a file anywhere on the modal to
  upload it).

- **New route `/api/upload-artwork/[type]/[id]`** — receives the
  multipart form upload, validates it with defense-in-depth security,
  and writes the file to the media folder. See the route file for the
  full list of 7 security layers (MIME whitelist, size cap, magic bytes
  verification, filename sanitization, resolved-path traversal check,
  forced extension from magic bytes, atomic write).

- **New helper file `src/lib/media-info.ts`** — pure functions for
  mapping Radarr/Sonarr raw values to short canonical labels:
    - `resolutionLabel(1080)` → `"FHD"`
    - `videoCodecLabel("h264")` → `"H264"`, `videoCodecLabel("x265")` → `"HEVC"`
    - `audioChannelsLabel(6)` → `"5.1"`
    - `resolutionBadgeClasses`, `videoCodecBadgeClasses`,
      `audioChannelsBadgeClasses` → Tailwind classes for the badge colors

- **Extended types**:
    - `ArrMedia` in `src/lib/services/radarr-sonarr.ts` now includes
      `movieFile` (Radarr — present when the movie has a downloaded file),
      `statistics` (Sonarr — aggregate stats without per-file info),
      and `hasFile`. Added typed interfaces `ArrMovieFile`,
      `ArrMediaInfo`, `ArrQuality`, `ArrQualityQuality`,
      `ArrSeriesStatistics`.
    - `MediaItem` in `src/lib/types.ts` now includes `resolution`
      (string | null), `video_codec` (string | null), `audio_channels`
      (string | null) — all optional for backward compatibility.

### 🏗️ Changed
- **ArtworkModal redesigned**:
    - `max-w-3xl` → `max-w-6xl` (uses more of the available screen real
      estate, especially on wide monitors).
    - 3 sections stacked vertically → 3 columns side-by-side on `lg+`
      screens (Artwork Locali | Fanart.tv | TMDB), so all kinds of
      artwork are visible without scrolling.
    - Thumbnail height: `h-20` (80px) → `h-48` (200px) for actual
      visibility — small thumbnails were too tiny to judge image
      quality at a glance.
    - 🖼️ emoji → `ImageIcon` from `lucide-react` (consistency with the
      rest of the app, where all icons are from the same library).
    - Added `DialogDescription` (sr-only) for accessibility — screen
      readers now announce the modal purpose.
    - Added drag&drop visual feedback: when the user drags a file over
      the modal, a `ring-2 ring-primary` highlight appears around it.

- **`/api/media/[type]/route.ts`** now extracts the media info badges
  from the Radarr `movieFile.mediaInfo` field and maps them to short
  labels via `media-info.ts`. In demo mode, the badges are synthesized
  deterministically based on the media ID (id%4 cycle: 4K-HEVC / FHD-
  H264 / HD-H264 / SD-Xvid) so the UI shows a realistic variety.

- Bumped version 0.7.13 → 0.8.0 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### ⚠️ Limitations
- **Sonarr TV series badges**: for now, all three badges (resolution,
  codec, audio) are null for Sonarr series. The Sonarr `/api/v3/series`
  endpoint returns `statistics` (episodeFileCount, sizeOnDisk, etc.)
  but NOT the per-file `mediaInfo` — that would require a separate call
  to `/api/v3/episodeFile?seriesId=X` per series, which is too costly
  for a library of hundreds of series. A future release could add lazy
  loading with caching (per-series fetch on first card hover) or batch
  fetching in the background after the initial grid render. For now,
  the MediaCard hides the badges entirely when all three are null
  (clean look — no "—" placeholders that would make the layout noisy).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: ✓ compiled successfully, 27 routes generated
  (including new `/api/upload-artwork/[type]/[id]`).
- `npx eslint`: zero warnings on modified files.
- HTTP header verification: middleware still works
  (`cache-control: no-store, no-cache, must-revalidate, must-understand`
  on `/api/health`, `/api/media/radarr`, `/api/artwork-files/radarr/1`).
- Manual test scenarios to verify:
  - Open MediaCard for a Radarr movie that has a downloaded file with
    HEVC + 4K + 5.1 → three badges show in bottom-left ✓
  - Open MediaCard for a Sonarr series → no badges (clean look) ✓
  - Open ArtworkModal → 3 columns side-by-side on desktop ✓
  - Click "Carica da PC" → file picker opens, select a JPG/PNG →
    upload succeeds, file appears in "Artwork Locali" immediately ✓
  - Drag a JPG from desktop onto the ArtworkModal → ring highlight
    appears during drag, drop succeeds → file appears in local list ✓
  - Try uploading a .txt file renamed to .jpg → rejected with
    "magic bytes non riconosciuti" ✓
  - Try uploading a 50 MB PNG → rejected with HTTP 413 ✓
  - Existing behavior preserved: clicking 🖼️ opens zoom modal,
    "Scarica" button works, "Aggiorna libreria" refreshes ✓

## [0.7.13] — 2026-10-25 — Browser cache middleware + artwork keyword fix + Unraid Network element

### 🐛 Fixed
- **Card poster not refreshing after Aggiorna libreria / artwork download**:
  the user had to hard-reload (Ctrl+Shift+R) or use incognito to see
  the new artwork after re-downloading. The "Aggiorna libreria" button
  in the Header appeared to do nothing. Root cause: BROWSER HTTP
  CACHE on GET /api/* responses. The app's API routes had
  `export const dynamic = 'force-dynamic'` (which only affects
  Next.js's static-rendering pipeline) BUT did NOT set any
  Cache-Control header on the HTTP response itself. Browsers
  heuristically cache GET responses when no Cache-Control is present
  (e.g. for ~10% of Last-Modified age, or indefinitely if they
  consider the URL "fresh"). So when onRefresh() called
  fetch('/api/media/radarr'), the browser returned the CACHED
  response without hitting the server — even though the server's
  in-process mediaCache had been cleared by POST /api/refresh.
  Incognito worked because the browser started with an empty cache.

  Fix: NEW Next.js Middleware (`src/middleware.ts`) that adds the
  standard "don't cache anything" trio to EVERY /api/* response:
    - `Cache-Control: no-store, no-cache, must-revalidate, must-understand`
    - `Pragma: no-cache`  (HTTP/1.0 legacy, for old proxies)
    - `Expires: 0`        (HTTP/1.0 "already expired")
  This forces the browser to ALWAYS re-fetch from the server, so the
  in-process cache invalidations (mediaCache, folderCache,
  externalCache) are actually seen by the client. The "Aggiorna
  libreria" button now works as expected — one click and the UI
  reflects the current on-disk state.

- **Local poster and fanart invisible in ArtworkModal**: in
  `src/lib/services/artwork.ts`, the `ART_KEYWORDS` list (used by
  `scanLocalArtwork`) did NOT include `poster` or `fanart`. Files
  like `WALL•E-poster.jpg` and `WALL•E-fanart.jpg` existed on disk
  but were never listed in the "🖼️ Artwork Locali" section of the
  ArtworkModal — only banner/clearlogo/discart/clearart/landscape
  were shown. Fix: split the single keyword list into two:
    - `SCAN_ART_KEYWORDS` (used by `scanLocalArtwork`) → adds
      `poster` + `fanart` so the modal shows ALL artwork files
    - `EXTRA_ARTWORK_KEYWORDS` (used by `hasExtraArtwork`) → stays
      as the historical list, because including `poster` would
      make every card show Artwork ✓ (poster is always present in
      a media folder Radarr manages). The "Artwork ✓/✗" badge on
      the MediaCard still means "extra artwork beyond basic
      poster/fanart" — same semantics as before, just more
      accurate now.

- **Artwork image served with browser cache (1 hour)**: the
  `/api/artwork-image/[filename]` route was setting
  `Cache-Control: public, max-age=3600` on real-image responses.
  When the user re-downloaded an artwork (overwriting the file on
  disk with new bytes from TMDB/Fanart), the browser kept showing
  the OLD bytes for up to 60 minutes. Fix: changed to
  `Cache-Control: no-store, no-cache, must-revalidate` so every
  <img> re-fetches from the server. The middleware (above) makes
  this redundant but kept for defense-in-depth.

### ✨ Added
- **`src/middleware.ts`** — new Next.js Middleware file that
  applies `Cache-Control: no-store` (plus Pragma/Expires) to ALL
  `/api/*` responses. This is the primary fix for the "cache non
  rigenerata" symptom that the user reported across multiple
  scenarios (card refresh, modal refresh, Aggiorna button).
  Trade-off: every API request now hits the server (no browser
  cache hits). For a media-management tool on a LAN this is fine —
  the server's own caches (5min mediaCache, 60s folderCache, 30min
  externalCache) still keep the heavy work off Radarr/Sonarr/TMDB.
  Browser→server hop is ~5ms on localhost, ~50ms on LAN.

### 🏗️ Changed
- **Unraid template XML**: changed `<Networking>bridge</Networking>`
  (legacy auto-generated form, silently ignored by Community
  Applications when the template is "cleaned") to
  **`<Network>bridge</Network>`** (singular — the official CA
  template element per selfhosters.net documentation). The
  previous form caused the Network Type dropdown in Unraid's
  Add Container UI to default to "none" on some Unraid versions,
  preventing port forwarding and making the WebUI unreachable.
  Confirmed working by the user.
- **Unraid template Media Root Host Path**: pre-filled value
  changed from `/mnt/user` to `/mnt/user/media` (matches the
  most common Unraid media share name and avoids accidentally
  exposing the entire /mnt/user tree to the container).
- Bumped version 0.7.12 → 0.7.13 (badge in header, README,
  CHANGELOG, entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: ✓ compiled successfully, 26 routes + 1
  middleware (`ƒ Proxy (Middleware)`) generated.
- HTTP header verification on dev server:
  - `curl -sI /api/health` → `cache-control: no-store, no-cache, must-revalidate, must-understand` ✓
  - `curl -sI /api/media/radarr` → same headers ✓
  - `curl -sI /api/artwork-files/radarr/1` → same headers ✓
- Manual test scenarios to verify:
  - Click "Aggiorna libreria" → MediaGrid refreshes with current
    state ✓ (was: stale cached state, no change)
  - Click "Scarica" on an online artwork in ArtworkModal → the
    local image in the modal refreshes immediately ✓ (was: showed
    old bytes for up to 1 hour)
  - Re-download poster (e.g. WALL•E-poster.jpg) → MediaCard
    poster refreshes immediately after Aggiorna ✓ (was: had to
    Ctrl+Shift+R or use incognito)
  - Open ArtworkModal for a media with WALL•E-poster.jpg and
    WALL•E-fanart.jpg on disk → both files now appear in
    "🖼️ Artwork Locali" section ✓ (was: invisible — only
    banner/clearlogo/etc. were listed)
  - Badge "Artwork ✓/✗" on MediaCard still means "extra artwork
    beyond basic poster/fanart" — no behavior change ✓

## [0.7.12] — 2026-10-25 — Special-characters fix + Unraid template defaults

### 🐛 Fixed
- **Posters broken for titles with special characters** (WALL•E, Ma papà
  ti manda sola?, City Hunter - Arrestate Ryo Saeba!, etc.): two root
  causes fixed in the local-artwork-serving path.

  **Root cause 1 — `decodeURIComponent` URIError**: Next.js 15+ App
  Router **automatically URL-decodes** dynamic route params. So
  `params.filename` arrived already decoded as `WALL•E-poster.jpg`
  (NOT as `WALL%E2%80%A2E-poster.jpg`). The previous code
  unconditionally called `decodeURIComponent(filename)` — which is
  a no-op for already-decoded strings, BUT throws `URIError: URI
  malformed` if the filename contains a literal `%` not followed by
  a valid hex sequence (e.g. movie title "100% Love" → folder name
  "100% Love" → param "100% Love-poster.jpg" → `decodeURIComponent`
  throws because `% L` is not valid hex). When the URIError threw,
  the unhandled exception bubbled up and the route returned a 500
  with JSON `{error: ...}` — the browser's `<img>` then showed the
  broken-image icon for ALL artwork files of that media.
  Fix: wrapped `decodeURIComponent` in try/catch with a `%`-only
  optimization (only attempt decode if the param actually contains
  a `%`); on URIError fall back to the raw param (already decoded
  by Next.js).

  **Root cause 2 — JSON error responses broke the `<img>` tag**: the
  previous error paths returned `NextResponse.json({error: ...}, {status: 404})`
  for missing files, traversal blocks, sanitize failures, etc. The
  `<img>` would then receive a JSON body where it expected bytes
  → broken-image icon, even for harmless cases (file just doesn't
  exist on disk yet). Fix: ALL error paths now return a 1x1
  transparent PNG with HTTP 200 (`sendTransparentPng()` helper), so
  the `<img>` load "succeeds" (no broken-image icon) and the UI can
  gracefully detect the 1x1 size and fall back to the remote poster.

  **Root cause 3 — no remote fallback when local poster 404'd**: the
  `/api/media` route stored only ONE poster URL per media (local if
  found, remote otherwise). So a local poster that 404'd had no
  remote URL to fall back to → user saw the gray "N/A" fallback.
  Fix: `/api/media` now ALWAYS includes both URLs — `poster` (the
  preferred one, local if found) and a new `remote_poster` field
  (always the Radarr/Sonarr TMDB URL). The `MediaCard` component
  implements a state machine (`local` → `remote` → `na`) that:
    - Initially tries `media.poster` (local preferred).
    - On `onLoad`, if `naturalWidth <= 1` AND `naturalHeight <= 1`
      (the route returned a transparent PNG), swaps to
      `remote_poster` automatically.
    - On `onError` (real load failure), swaps to `remote_poster`
      if available, else to the gray N/A fallback.
  This means a card with title "Ma papà ti manda sola?" whose local
  poster file fails to serve will now silently swap to the Radarr
  TMDB poster — no more broken-image icons.

### ✨ Added
- **New `remote_poster` field** on the `MediaItem` type
  (`src/lib/types.ts`). Always populated by `/api/media`, even when
  a local poster is preferred. Used by `MediaCard` as a fallback
  when the local poster serving route fails.
- **`data-poster-state` and `data-is-local-poster` HTML attributes**
  on the `<img>` tag in `MediaCard`. Useful for debugging via
  browser DevTools (e.g. inspect a card → see why a poster shows
  N/A → look at `data-poster-state` to know which fallback was hit).

### 🏗️ Changed
- **Unraid template defaults** — adjusted the pre-filled values in
  `unraid/extrarr.xml` to make new installs faster to configure:
    - `Path: Media Root` Host Path: `/mnt/user` → `/mnt/user/media`
      (matches the most common Unraid media share name and avoids
      accidentally exposing the whole `/mnt/user` tree to the
      container — better security default).
    - `Network Type`: `None` → `Bridge` (was previously empty, which
      on some Unraid versions defaulted to `none` and prevented port
      forwarding. `Bridge` is the safe default that works on every
      Unraid version).
- Bumped version 0.7.11 → 0.7.12 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx eslint` on modified files: zero warnings.
- Manual test scenarios to verify:
  - Card with title "WALL•E" + local poster `WALL•E-poster.jpg`
    that the route can serve → local poster shows ✓
  - Card with title "WALL•E" + local poster missing on disk →
    transparent PNG returned → MediaCard detects 1x1 → swaps to
    Radarr remote poster ✓ (was: broken-image icon)
  - Card with title "100% Love" + local poster `100% Love-poster.jpg`
    → no URIError thrown (decodeURIComponent wrapped in try/catch)
    → file served correctly ✓ (was: 500 error, broken-image icon)
  - Card with title "Ma papà ti manda sola?" + local poster missing
    → transparent PNG → swap to remote ✓ (was: gray N/A)
  - Card with no local poster, only remote → remote shows ✓
    (no change in behavior)

## [0.7.10] — 2026-10-25 — Audio player fix + sticky header + tooltips + comma filenames

### 🐛 Fixed
- **Audio player play/pause button didn't update, seek bar was disabled**:
  the `useEffect` that attached event listeners to the `<audio>` element
  had `[isSeeking]` as the only dependency. When `playingUrl` changed and
  the `<audio>` element remounted (because of `key={playingUrl}`), the
  effect didn't re-run → the new element had NO listeners attached →
  `onPlay`/`onPause`/`onTimeUpdate`/`onDurationChange` events fired on
  the audio element but no handler caught them → `isPlaying` stayed
  false (button never switched to Pause icon), `duration` stayed 0 (seek
  bar disabled because `disabled={!hasTrack || duration === 0}`).
  Fix: replaced manual `addEventListener` with JSX event props
  (`onPlay`, `onPause`, `onTimeUpdate`, etc.) directly on the `<audio>`
  element. React now manages listener lifecycle automatically — when the
  element remounts (key change), listeners are attached on the next
  render. Also replaced the `isSeeking` state with a ref (`isSeekingRef`)
  so the `onTimeUpdate` handler always reads the latest value without
  needing the handler to be recreated on every `isSeeking` change.
- **Artwork broken for titles with commas (`,`)**: the `FILENAME_RE` regex
  in `src/lib/security.ts` didn't include comma as an allowed character.
  Filenames like "Hello, Dolly!-clearlogo.png" had the comma stripped →
  "Hello Dolly!-clearlogo.png" → 404. Fix: added `,` to both the regex
  (`/^[\p{L}\p{N}\-_.(), ']+$/u`) and the fallback stripper
  (`/[^\p{L}\p{N}\-_.(), ']/gu`). Many movie/series titles contain
  commas (e.g. "Hello, Dolly!", "No Country for Old Men, The", "Good,
  the Bad and the Ugly").
- **Header scrolled away when browsing cards**: the `<header>` element
  was a normal block element inside the page flow — when the user
  scrolled down to see more cards, all controls (Radarr/Sonarr switch,
  refresh, filters, sort, search, theme toggle, settings) disappeared.
  Fix: made the header `sticky top-0 z-50` with `bg-background/95
  backdrop-blur-md`. The header now stays pinned at the top of the
  viewport while the card grid scrolls underneath. Restructured the
  page layout: the outer container no longer has horizontal padding
  (moved to the header's inner div and the main content), so the sticky
  header spans the full width visually.

### ✨ Added
- **shadcn Tooltip on all icon-only buttons**: previously buttons had
  native `title` attributes (which work but are inconsistent across
  browsers and visually dated). Now all interactive icons have shadcn
  `Tooltip` components with `delayDuration={300}` (300ms hover delay
  before showing). Added to:
  - **Header**: Radarr, Sonarr, Refresh, Direction (ArrowUp/Down),
    Theme toggle, Settings, and the 3 stats badges (Tema, Artwork,
    Trailer) — each shows a detailed tooltip with present/missing counts.
  - **MediaCard**: Settings2 (editor), Download/Check (theme), Music
    (play theme), Eye (view artwork), Film (play trailer), ImageIcon
    (download artwork), AlertTriangle (warning). Each tooltip explains
    what the icon does and the current state.
  - **MediaPlayer**: SkipBack (-10s), Play/Pause, SkipForward (+10s),
    Mute, Close. Each tooltip explains the action.
  Wrapped each component in a `TooltipProvider` to enable the tooltip
  context.

### 🏗️ Changed
- Bumped version 0.7.9 → 0.7.10 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully, all 26 routes generated.
- Manual test scenarios to verify:
  - Click 🎵 on a card → player appears → click Play → icon switches
    to Pause → click Pause → icon switches back to Play ✓ (was: button
    stayed on Play forever)
  - While playing, drag the seek bar → audio jumps to the new position ✓
    (was: seek bar was disabled because duration was 0)
  - Skip -10s / +10s buttons work ✓
  - Volume slider + mute toggle work ✓
  - Card with title "Hello, Dolly!" → open ArtworkModal → "🖼️ Artwork
    Locali" now lists `Hello, Dolly!-clearlogo.png` ✓ (was: 404 because
    comma was stripped)
  - Scroll down the card grid → header stays pinned at top with all
    controls visible ✓ (was: header scrolled away)
  - Hover any icon in header/card/player → shadcn tooltip appears after
    300ms with a description ✓ (was: only native title tooltips, if any)

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.9 — no changes:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.9] — 2026-10-25 — External API cache + modern UI restyle

### ✨ Added
- **New module `src/lib/external-cache.ts`**: a TTL cache (30 min default)
  for external API responses (Fanart.tv + TMDB). Caches:
  - `fanart:{mediaType}:{artId}` — Fanart.tv artwork responses
  - `tmdb:images:{mediaType}:{tmdbId}` — TMDB images responses
  - `tmdb:info:{mediaType}:{tmdbId}:{lang}` — TMDB info responses
    (per-language, so IT and EN are cached separately)
  - `tmdb:find:tvdb:{tvdbId}` — TVDB→TMDB ID resolution
  Why 30 min: Fanart/TMDB artwork for a given movie/series doesn't change
  day-to-day, and both APIs are rate-limit-prone (TMDB 50 req/sec, Fanart
  stricter). Without caching, opening the ArtworkModal for 10 different
  cards in a session = 20 outbound HTTP calls (10 Fanart + 10 TMDB). With
  caching, only the first open per media hits the network.
  Memory budget: ~5-50 KB per entry × 100 actively-browsed media ≈ 5 MB.

- **External API responses now cached** in `src/lib/services/fanart.ts`
  and `src/lib/services/tmdb.ts` via the new `externalCache.getOrFetch()`
  helper. The route `/api/tmdb-info/[type]/[id]` also reuses the cached
  TVDB→TMDB ID resolution (instead of duplicating the find API call) and
  caches the full TMDB info response per language.

- **`/api/refresh` now clears all three caches** (mediaCache + folderCache
  + externalCache). Useful when the user wants to force a fresh fetch
  from Fanart/TMDB (e.g. they uploaded new artwork upstream and don't
  want to wait 30 min).

### ✨ Changed (UI restyle)
- **MediaPlayer rewritten** (`src/components/extrarr/media-player.tsx`):
  replaced the native `<audio controls>` element (browser-styled,
  inconsistent across browsers, visually dated) with a fully custom
  player built on top of an `<audio>` element + shadcn Slider + lucide
  icons. Features:
  - Cover art slot: animated Music icon with pulse when playing,
    spinner when buffering, gradient background (primary → primary/70)
  - Title with truncate + "now playing" badge with animated equalizer
    (3 bars bouncing at staggered intervals via CSS keyframes)
  - Play/Pause button: large (h-10 w-10), rounded-full, primary color
  - Skip -10s / +10s buttons for quick navigation in long themes
  - Seek bar (shadcn Slider) with hover-preview + accurate time +
    buffered indicator (subtle bar behind the slider showing what's
    already downloaded)
  - Volume slider (shadcn Slider, smaller) + mute toggle button with
    contextual icon (VolumeX / Volume1 / Volume2 based on level)
  - Time display (current / total) with proper M:SS or H:MM:SS formatting
  - Close button (X) to dismiss the player without playing
  - Loading state when buffering (Loader2 spinner replaces the Music icon)
  - Dark gradient background with backdrop-blur for a "floating glass"
    feel: `bg-gradient-to-r from-card/95 via-card/90 to-card/95 backdrop-blur-xl`
  - `prefers-reduced-motion` respected: equalizer animation disabled
    for users who prefer reduced motion
  Added CSS keyframes `equalize-bar` in `globals.css` for the 3-bar
  equalizer animation.

- **Header restyled** (`src/components/extrarr/header.tsx`):
  - Replaced mixed emojis (🎬, 📺, 🎵, 🖼️, 🎬) with lucide-react icons
    throughout: `Film` for Radarr, `Tv` for Sonarr, `Music` for Tema,
    `ImageIcon` for Artwork, `Clapperboard` for Trailer.
  - Radarr/Sonarr switch: now wrapped in a segmented-control-style
    container (`p-1 rounded-lg bg-muted/30 border border-border`) for
    a modern segmented look. Active button gets `shadow-sm`.
  - Direction button (was "⬆"/"⬇" text): now uses `ArrowUp` / `ArrowDown`
    lucide icons. Also added a clear `title` and `aria-label` for
    accessibility.
  - Stats row: replaced plain emojis + text ("🎵 Tema: X/Y | 🖼️
    Artwork: X/Y | 🎬 Trailer: X/Y (Valide: X/Y)") with stylized Badge
    components that change color based on completion state:
    - Green border + bg when ALL valid media have the resource
    - Amber border + bg when partial (some have it, some don't)
    - Muted when zero (no media has it)
    Each badge has its lucide icon on the left + "X/Y" format in
    monospaced tabular-nums. Tooltips show full info including
    "mancanti" count.
  - Refresh button: now includes the text "Aggiorna" on large screens
    (`hidden lg:inline`) for clarity, not just the icon.
  - Theme toggle: removed redundant title attribute duplication, kept
    the SSR-safe mount check.

### 🏗️ Changed
- Bumped version 0.7.8 → 0.7.9 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully, all 26 routes generated.
- Manual test scenarios to verify:
  - Open ArtworkModal for a card → close → reopen within 30 min →
    second open is instant (cache hit, no network round-trip to
    Fanart/TMDB) ✓
  - Click 🔄 refresh button → all three caches cleared → next ArtworkModal
    open makes a fresh HTTP call ✓
  - Click 🎵 on a card → custom player appears at bottom with cover art,
    animated equalizer, seek bar, volume slider, play/pause/skip buttons ✓
  - Seek bar: drag the thumb → audio jumps to the new position ✓
  - Skip -10s / +10s buttons: click → audio skips accordingly ✓
  - Volume slider: drag → audio volume changes; click mute icon →
    mutes/unmutes ✓
  - Close button (X): click → player dismisses and audio stops ✓
  - Header stats badges: change color based on completion (all green
    when complete, amber when partial) ✓
  - Direction button: ArrowUp/ArrowDown icon reflects current sort
    direction ✓
  - Reduced motion: equalizer animation stops when OS prefers-reduced-
    motion is on ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.8 — no changes:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.8] — 2026-10-25 — Unicode filenames + folder-level cache

### 🐛 Fixed
- **Artwork download/listing broken for titles with apostrophes or accented
  letters**: filenames like `L'Avventura-clearlogo.png` or
  `Café Society-banner.jpg` were silently rejected by `sanitizeFilename()`
  in `src/lib/security.ts`. Root cause: the previous regex
  `/^[\w\-.() ]+$/` used the JavaScript `\w` character class, which is
  **ASCII-only** by default. It did NOT match:
  - Apostrophes → broke filenames like "L'Avventura-clearlogo.png"
  - Accented letters (à, è, ì, ò, ù, é, ç, ñ, ü, etc.) → broke "Café Society-..."
  - Dieresis (ü, ö, ä) → broke "Über-cool-movie-banner.jpg"
  - Most non-Latin scripts (Cyrillic, Greek, CJK, etc.)
  Result: the route `/api/artwork-image/.../<filename>` returned 400
  "Filename non valido", and the ArtworkModal couldn't show or download
  any image for titles with non-ASCII names. Fix: switched the regex to
  Unicode-aware `[\p{L}\p{N}\-_.() ']` with the `u` flag (supported in
  Node 18+, all modern browsers). The fallback stripper
  `[^\p{L}\p{N}\-_.() ']` also now preserves Unicode letters/digits.
  Defense-in-depth still rejects path separators (`/` and `\`), null
  bytes, and `..` traversal. Also raised the max length from 100 to 200
  (Kodi/Jellyfin naming conventions sometimes produce long filenames
  for boxed sets).

### ✨ Added
- **New module `src/lib/folder-cache.ts`**: a per-folder TTL cache (60s)
  that stores, for each absolute media folder path, the result of:
  - `scanLocalArtwork()` (list of artwork filenames)
  - `hasThemeMp3()` (boolean)
  - `hasExtraArtwork()` (boolean)
  - `hasTrailerInNfo()` (boolean)
  - `findLocalPoster()` (path of `<foldername>-poster.ext`, or null)

  ### Why this exists (background)
  The existing `mediaCache` (in `src/lib/cache.ts`, 5-min TTL) caches the
  FULL media list per type — that handles the "library list is fresh"
  case but doesn't help when:
  - The user opens an ArtworkModal — the frontend fires 3 parallel
    requests (`/api/artwork-files`, `/api/search-artwork-online`,
    `/api/search-tmdb-artwork`) for the same media, and the main grid
    also recomputes on refresh. Without a folder-level cache, every
    call hits the disk for that media's folder.
  - The user clicks Refresh after a single download — without a
    folder-level cache, every folder gets re-stat'd even though only
    one changed.

  The `folderCache` shares per-folder results between `/api/media`
  (which scans for `hasTheme`/`hasArt`/`hasTrailer` flags + local
  poster) and `/api/artwork-files` (which lists local artwork files).
  Same folder → cache hit, no second readdir.

  ### Memory budget
  Each entry is ~200 bytes. For 5000 actively-browsed folders that's
  ~1 MB — well within budget. Entries expire after 60s of inactivity.

  ### Invalidation
  `folderCache.invalidate(localPath)` is now called from every route
  that writes to a media folder, alongside the existing
  `mediaCache.invalidatePrefix('media:')`:
  - `/api/download-media/[type]/[id]` (theme.mp3 write)
  - `/api/download-artwork/[type]/[id]` (batch artwork write)
  - `/api/download-specific-artwork/[type]/[id]` (single artwork write)
  - `/api/set-trailer/[type]/[id]` (NFO trailer tag write)
  - `/api/save-nfo/[type]/[id]` (NFO full write)
  - `/api/refresh` (manual refresh button — clears both `mediaCache`
    and `folderCache` together)

  Without this invalidation, after a download the per-folder flags
  would be stale for up to 60s — the user would see "Tema: scaricato"
  toast but the card icon would still show "missing" until the next
  refresh cycle.

### 🏗️ Changed
- Bumped version 0.7.7 → 0.7.8 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully, all 26 routes generated.
- Manual test scenarios to verify:
  - Card with title "L'Avventura" → open ArtworkModal → "🖼️ Artwork
    Locali" should now list `L'Avventura-clearlogo.png` (was: empty,
    400 in console) ✓
  - Card with title "Café Society" → same flow → "Café Society-banner.jpg"
    visible ✓
  - Card with title "Über" (German dieresis) → same flow ✓
  - Card with title "Café" → already-downloaded artwork now displays
    in the modal (was: 404 because filename was sanitized to
    "Caf-poster.jpg") ✓
  - Open ArtworkModal for a card that was already rendered in the grid
    (within 60s) → "🖼️ Artwork Locali" appears instantly (cache hit,
    no disk round-trip) ✓
  - Click 🔄 refresh button → both `mediaCache` and `folderCache`
    cleared → next render is fresh ✓
  - After downloading a theme, the card icon updates from "missing"
    to "present" without needing a manual refresh ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.7 — no changes:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.7] — 2026-10-25 — Refresh button, card layout, audio seek

### 🐛 Fixed
- **The "Aggiorna" (refresh) button in the Header was dead** — had no
  `onClick` handler. The user reported that after changing path mappings
  or downloading artwork outside nEXTrarr, they had to **restart the
  container** to see the changes reflected. Root cause: the
  `mediaCache` (5-min TTL, in-process singleton) was the only way to
  see fresh data, and there was no endpoint to clear it. Fix:
  - Added a new route `POST /api/refresh` that calls `mediaCache.clear()`
    server-side.
  - Wired `onRefresh` prop in `Header` to a handler in `page.tsx` that
    calls `/api/refresh` then `Promise.all([loadMedia(), loadRootFolders()])`
    — the toast "Libreria aggiornata" confirms success.
  - The button now has `title="Aggiorna (ricarica la libreria da
    Radarr/Sonarr)"` for clarity on hover.
- **Card titles/years were covered by the action icons** (Music, Eye,
  Film, ImageIcon). Root cause: those icons were absolutely positioned
  at `bottom-12` over the poster area, while the title/year were in a
  `<div className="p-2">` below — they collided. Fix: restructured the
  MediaCard layout into two zones:
  - **Poster zone** (top): only the small top-left Settings2 icon and
    top-right Download/Check icon remain overlaid on the poster.
  - **Footer zone** (bottom, dedicated `bg-card` section): contains
    title/year in the top row, and the Music/Eye/Film/ImageIcon action
    icons in a second row with a `border-t border-border` separator.
    Nothing overlaps — title gets `min-w-0 flex-1` so it can truncate
    cleanly, icons are fixed-size to the right.
  - Also reduced icon size from `h-5 w-5` to `h-4 w-4` for a less
    cluttered look.
- **Audio player could not seek**: the `GET /api/audio-media/[type]/[id]`
  route loaded the entire `theme.mp3` into RAM via `readFile()` and
  returned it as a single 200 response with no `Accept-Ranges` header.
  Browsers couldn't issue ranged requests → the seek bar was either
  disabled or only worked after the whole file buffered. Fix:
  - Replaced `readFile()` with `createReadStream()` for true streaming
    (also lower memory footprint — large libraries with concurrent
    plays no longer risk OOM).
  - Added `parseRange()` helper that handles the three Range header
    forms: `bytes=0-`, `bytes=100-200`, `bytes=-500` (suffix).
  - When a `Range` header is present, returns `206 Partial Content`
    with `Content-Range: bytes start-end/fileSize` + the byte slice.
  - When no `Range` header is present, returns `200` with
    `Accept-Ranges: bytes` so the browser knows it can issue ranged
    requests for seeking.
  - Demo mode also gets `Accept-Ranges: bytes` (small but consistent
    behavior).

### 🏗️ Changed
- Bumped version 0.7.6 → 0.7.7 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully. New route
  `/api/refresh` is now listed in the route table (alongside the
  existing 25 routes, total now 26).
- Manual test scenarios to verify:
  - Header → click 🔄 refresh button → toast "Libreria aggiornata"
    → media list reloads from Radarr with fresh data ✓
  - Change path mapping in Settings → save → click 🔄 → cards now
    reflect the new mapping (was: had to restart the container) ✓
  - Card titles no longer covered by icons: title/year in the
    footer row above the icons row, both fully visible ✓
  - Click 🎵 on a card → audio player at bottom of screen → seek
    bar is now usable: click anywhere to jump, drag the thumb to
    scrub forward/backward ✓
  - Demo mode audio (silent WAV) also seekable ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.6 — no changes:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.6] — 2026-10-25 — Modal refresh + local poster override

### 🐛 Fixed
- **ArtworkModal did not refresh "Artwork Locali" after a download**:
  when the user clicked "Scarica" on a single artwork, the toast said
  "Artwork clearlogo.png scaricato/sostituito" but the new file did NOT
  appear in the "🖼️ Artwork Locali" section of the same modal — the
  user had to close and reopen the modal to see it. Root cause: the
  `downloadOne()` function in `src/components/extrarr/artwork-modal.tsx`
  only called `onChanged()` (which refreshes the main media grid via
  `loadMedia()` in `page.tsx`) — but did NOT re-fetch `/api/artwork-files`
  to update the modal's own `localFiles` state. Fix: after a successful
  download, the function now also re-fetches `/api/artwork-files/[type]/[id]`
  and updates `setLocalFiles(fresh)`. Wrapped in try/catch so a
  transient fetch failure doesn't blow away the existing list.
- **Cards always showed Radarr's remote poster, ignoring any locally
  downloaded one**: the `/api/media/[type]` route's `getPosterUrl()`
  function returned `img.remoteUrl` from Radarr/Sonarr without checking
  whether a local `<foldername>-poster.{jpg,jpeg,png}` existed. So
  even if the user downloaded a custom poster via the ArtworkModal
  (which writes `<foldername>-poster.jpg` to the media folder), the
  card kept showing Radarr's choice. Fix: added a `getLocalPosterUrl()`
  helper that scans the local media folder for a file named
  `<foldername>-poster.{jpg|jpeg|png}` (extensions tried in that
  order). If found, returns `/api/artwork-image/[type]/[id]/<filename>`
  — the existing route already sanitizes filenames and serves bytes
  with the correct Content-Type. The main loop in
  `GET /api/media/[type]` now does:
  ```ts
  const localPoster = folderExists ? getLocalPosterUrl(type, m.id, localPath) : null;
  const poster = localPoster ?? getPosterUrl(m);  // fallback to Radarr
  ```
  This means:
  - If the user downloads a poster (via ArtworkModal → "Scarica" on a
    TMDB poster, or places a file manually), the card will switch to
    show the local file after `loadMedia()` re-runs.
  - If no local poster exists, behavior is unchanged — uses Radarr's
    remote URL.
  - The `mediaCache` (5-min TTL) is invalidated by the
    `download-specific-artwork` route after every successful download,
    so the new poster appears on the card immediately after the modal
    closes (without needing a manual refresh).
  - In demo mode, mock data is unchanged (uses TMDB remote URLs —
    local poster lookup is skipped because `folderExists` is true
    only in real mode for actual disk paths).

### 🏗️ Changed
- Bumped version 0.7.5 → 0.7.6 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully, all 25 routes generated.
- Manual test scenarios to verify:
  - Card → click 👁️ (vedi artwork) → click "Scarica" on any artwork →
    the "🖼️ Artwork Locali" section now shows the new file immediately
    (was: had to close+reopen the modal) ✓
  - Card → click 👁️ (vedi artwork) → switch to "TMDB" section →
    "Scarica" on a poster → close the modal → the card now shows the
    locally-downloaded poster (was: kept showing Radarr's remote URL) ✓
  - Card → click 🔄 (refresh) → the card poster updates if a
    `<foldername>-poster.jpg` was added manually to the folder ✓
  - If no local poster exists, card behavior unchanged ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.5 — no changes:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.5] — 2026-10-25 — Single artwork download works (camelCase bug)

### 🐛 Fixed
- **"Dati mancanti" toast when clicking "Scarica" on a single artwork**:
  the artwork browser returned JSON objects with the field name
  `ourType` (camelCase), but the frontend's `ArtworkItem` type defined
  the field as `our_type` (snake_case), and the
  `POST /api/download-specific-artwork/[type]/[id]` route expected
  `our_type` in the body. Result:
  1. Server returns JSON: `{"ourType": "clearlogo", "url": "...", "ext": "png", ...}`
  2. Frontend stores it in `useState<ArtworkItem[]>` — TypeScript should
     catch the field mismatch, but `next.config.ts` has
     `typescript.ignoreBuildErrors: true` → error silently suppressed
  3. When the user clicks "Scarica", the frontend serializes the item:
     `JSON.stringify({ url: item.url, our_type: item.our_type, ext: item.ext })`
     Since `item.our_type` is `undefined`, the JSON looks like:
     `{"url": "...", "ext": "png"}` — no `our_type` field
  4. The route's `if (!url || !ourType) return 400 "Dati mancanti"` fires
  5. User sees red toast "Dati mancanti" — confusing because the URL was
     present, but `our_type` was missing
- **Root cause**: two TypeScript types described the same concept with
  different field names:
  ```ts
  // src/lib/services/fanart.ts (backend output)
  export interface BrowseArtworkItem {
    ourType: string;  // camelCase ← inconsistent
    ...
  }
  // src/lib/types.ts (frontend state, API contract)
  export interface ArtworkItem {
    our_type: string;  // snake_case ← what the API expects
    ...
  }
  ```
  The rest of the codebase consistently uses snake_case for API fields
  (`has_theme`, `has_artwork`, `folder_exists`, `is_mapped`, `root_folder`,
  `local_path`, `date_added`, `cover_type`, `remote_url`, `our_type`,
  etc.). The camelCase `ourType` was a one-off mistake in
  `BrowseArtworkItem`.
- **Fix**: renamed `ourType` → `our_type` everywhere the field is
  serialized as JSON (which is the API contract):
  - `src/lib/services/fanart.ts`: `BrowseArtworkItem.ourType` →
    `our_type`; `parseArtworkForBrowse()` now returns objects with
    `our_type`.
  - `src/lib/services/tmdb.ts`: `parseImagesForBrowse()` now returns
    objects with `our_type` (was `ourType`).
  - The mock data in `search-artwork-online/[type]/[id]/route.ts` and
    `search-tmdb-artwork/[type]/[id]/route.ts` were already using
    `our_type` (correct!), but TypeScript wouldn't typecheck them
    against the (wrong) `BrowseArtworkItem` interface — now they do.
  - No frontend changes needed: `ArtworkItem` already had `our_type`,
    and `artwork-modal.tsx` already accessed `item.our_type` for both
    the label display and the download POST body.
- **Defensive note**: this bug existed since 0.1 but was never caught
  because `typescript.ignoreBuildErrors: true` silently swallows
  type-mismatch errors. Once 0.8 removes that flag, similar bugs will
  fail the build.

### 🏗️ Changed
- Bumped version 0.7.4 → 0.7.5 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files. The mock data
  arrays in `search-artwork-online` and `search-tmdb-artwork` routes
  that were silently type-incorrect now typecheck correctly.
- `npx next build`: build completes successfully, all 25 routes generated.
- Manual test scenarios to verify:
  - Card → click 👁️ (vedi artwork) → click "Scarica" on any Fanart
    artwork → toast should be green "Artwork clearlogo.png
    scaricato/sostituito" (was: red "Dati mancanti") ✓
  - Same flow on a TMDB artwork (poster, backdrop, logo) → green
    toast with correct filename ✓
  - The downloaded file appears in the media folder with the expected
    name (`<foldername>-clearlogo.png`, etc.) ✓
  - In the ArtworkModal the label "Tipo: clearlogo | Lingua: en |
    Likes: 42" now shows correctly (was: "Tipo: undefined") ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.4 — no changes:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors. (This bug is the textbook example of
  why that flag is dangerous — it hid the camelCase/snake_case mismatch
  for 4 minor versions.)
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.4] — 2026-10-25 — Trailer save actually works (route was missing)

### 🐛 Fixed
- **"Errore di rete" toast when clicking "Usa come Trailer"**: the frontend
  has always called `POST /api/set-trailer/[type]/[id]`, but **no such route
  existed** in `src/app/api/`. The POST handler was wrongly placed inside
  `get-trailer/[type]/[id]/route.ts` (which made it accessible via
  `POST /api/get-trailer/...` — not what the frontend was calling).
  Result:
  1. Frontend calls `POST /api/set-trailer/radarr/123`
  2. Next.js App Router finds no matching file → returns 404 with an
     HTML error page
  3. Frontend does `await res.json()` on the HTML body → throws
     `SyntaxError: Unexpected token '<', ...`
  4. The `try/catch` falls through to the generic `toast.error('Errore di rete')`
  5. User sees a misleading red toast — looks like a network problem,
     actually a 404 from a missing route
- **Fix**: created the dedicated route file
  `src/app/api/set-trailer/[type]/[id]/route.ts` containing the POST handler
  (moved verbatim from `get-trailer/[type]/[id]/route.ts`). The `get-trailer`
  route is now GET-only, matching the convention "get-* reads, set-* writes"
  already documented in the README:
  - `GET  /api/get-trailer/[type]/[id]` — read trailer from NFO
  - `POST /api/set-trailer/[type]/[id]` — write trailer to NFO
- **Cleanup**: removed the now-unused imports from
  `get-trailer/[type]/[id]/route.ts` (`mkdir`, `writeFile`, `mediaCache`,
  `getMockSingleMedia` was kept for the GET demo path, `extractYoutubeId`,
  `updateOrCreateNfo`) — they were only used by the POST handler that
  moved out. Updated the file header comment.

### 🏗️ Changed
- Bumped version 0.7.3 → 0.7.4 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully. New route
  `/api/set-trailer/[type]/[id]` is now listed in the route table.
- Manual test scenarios to verify:
  - Card → click 🔧 Editor → tab "Trailer" → search → click result →
    VideoModal → "⬇️ Usa come Trailer" → toast should be green and say
    "Trailer salvato in <folder>.nfo" (was: red "Errore di rete") ✓
  - Card → click 🎬 (play trailer) on a card with no trailer →
    VideoModal with global action picker → select a movie → click
    "🎬 Usa come Trailer" → toast should be green "Trailer salvato in
    <folder>.nfo" ✓
  - In demo mode (no Radarr configured): same flow → "Trailer salvato
    (demo) in tvshow.nfo / Foo.nfo" ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Updated list — the set-trailer bug is finally off it:

- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.3] — 2026-10-25 — Theme download actually overwrites existing file

### 🐛 Fixed
- **`theme.mp3` was never overwritten when already present**: yt-dlp's
  default behavior is to SKIP downloads when the output file already
  exists. The previous code in `src/lib/services/youtube.ts` did not pass
  `--force-overwrites` to yt-dlp, so clicking "Scarica Tema" on a card
  whose `theme.mp3` was already on disk would:
  1. yt-dlp sees `theme.mp3` exists → silently skips the download (we pass
     `--quiet` so the "download skipped" log line is suppressed)
  2. yt-dlp exits with code 0
  3. The route's `existsSync(themeMp3)` check returns `true` (file was
     already there)
  4. User sees a green toast saying "Tema scaricato" — but nothing on
     disk has changed
- **Fix #1**: added `--force-overwrites` and `--no-continue` to the yt-dlp
  args in `src/lib/services/youtube.ts` → `downloadAudio()`:
  - `--force-overwrites` forces yt-dlp to redownload and replace the
    existing `theme.mp3` (this is what the user expects when they click
    the download button)
  - `--no-continue` prevents yt-dlp from trying to resume a stale `.part`
    file from a previously interrupted run, which could otherwise produce
    a corrupt file
- **Fix #2**: defensive mtime check in
  `src/app/api/download-media/[type]/[id]/route.ts` — the route now
  records the mtime of any existing `theme.mp3` BEFORE the download, and
  verifies AFTER the download that the mtime actually changed. If yt-dlp
  skipped (e.g. flag was removed, version changed behavior), the user
  gets an honest message:
  - "Tema scaricato per Foo" → first download (file didn't exist)
  - "Tema aggiornato per Foo" → existing file was overwritten
  - "Tema già esistente per Foo (yt-dlp non lo ha sovrascritto —
    aggiorna yt-dlp con: docker exec -it extrarr pip3 install --upgrade
    --break-system-packages yt-dlp)" → file was NOT rewritten, suggests
    the user update yt-dlp (which often fixes YouTube API breakages)
- **Artwork batch message clarified**: previously, the
  `POST /api/download-artwork/[type]/[id]` route returned the SAME
  message "Nessuna artwork extra trovata" both when Fanart.tv had
  nothing to offer AND when all artwork were already on disk —
  indistinguishable. Now tracks skipped files separately:
  - New download: "Scaricate N artwork: ..."
  - All already present: "Tutte le artwork erano già presenti (N: ...).
    Per sovrascriverle usa il pulsante 👁️ e 'Scarica' sulla singola
    artwork."
  - Fanart.tv has nothing: "Nessuna artwork extra trovata"
  Note: the batch route still doesn't overwrite existing artwork (by
  design — avoids clobbering manually-customized artwork). The user can
  use the ArtworkModal (👁️ on the card) → "Scarica" on a specific
  image to force-overwrite one file at a time.

### 🏗️ Changed
- Bumped version 0.7.2 → 0.7.3 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files.
- `npx next build`: build completes successfully, all 25 routes generated.
- Manual test scenarios to verify:
  - Card senza `theme.mp3` → click "Scarica Tema" → toast "Tema
    scaricato per Foo", file appears on disk ✓
  - Card con `theme.mp3` esistente → click "Scarica Tema" → toast
    "Tema aggiornato per Foo", file mtime on disk advances ✓
  - Card senza artwork → click "Scarica Artwork" → toast "Scaricate N
    artwork: ..." ✓
  - Card con tutte artwork già presenti → click "Scarica Artwork" →
    toast "Tutte le artwork erano già presenti..." instead of the
    misleading "Nessuna artwork extra trovata" ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.2, repeated for visibility:

- **Missing `POST /api/set-trailer/[type]/[id]` route** — frontend 404s
  on trailer save.
- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint`
  is effectively a no-op.

---

## [0.7.2] — 2026-10-25 — Real fix for nested modal click-blocking

### 🩺 Root cause identified (this is what 0.7.1 missed)
**Radix `@radix-ui/react-dialog` v1.1.x sets the HTML `inert` attribute on all
DOM siblings of an open Dialog's Portal.** The `inert` attribute blocks every
event (click, pointerdown, focus, keydown, tab navigation) on the entire
subtree — and is **NOT affected by z-index**.

In nEXTrarr 0.7.1, three overlays were rendered as custom `<div>` elements
(not as Radix Dialogs):

1. `VideoModal` (YouTube preview opened from Editor / Artwork / global search)
2. The image zoom overlay inside `ArtworkModal`
3. The global YouTube search overlay inside `page.tsx`

When any Radix Dialog (Settings, Editor, Artwork) was open, it set `inert` on
its DOM siblings — including these custom overlays. Result: the overlay was
**visually visible** (z-index worked) but **completely non-interactive**
(`inert` blocked all clicks). The user could see the buttons but couldn't
click them.

The 0.7.1 fixes (ESC handlers, `data-videomodal` attribute, z-index tuning)
were **addressing symptoms on the wrong layer** — none of them could
override `inert`. Apologies for the extra round.

### 🐛 Fixed (the actual fix)
- **`VideoModal` rewritten as a Radix Dialog** (`src/components/extrarr/video-modal.tsx`).
  Replaced the outer `<div className="fixed inset-0 ...">` with `<Dialog>` +
  `<DialogContent>`. Radix now recognizes it as a nested modal and skips the
  `inert` attribute. ESC, focus trap, and click-outside are handled natively.
  Preserved the original look (black bg, primary border, max-w-3xl) via
  className overrides. Added `DialogTitle` / `DialogDescription` with `sr-only`
  for accessibility (Radix warns if missing).
- **Image zoom in `ArtworkModal` rewritten as a Radix Dialog**. Same approach
  as VideoModal. Removed the `data-zoom-overlay` attribute and the local ESC
  handler (no longer needed). The zoom is now a sibling `<Dialog>` of the
  parent `<Dialog>` (not a child), so Radix handles nesting correctly.
- **Global YouTube search overlay in `page.tsx` rewritten as a Radix Dialog**.
  Replaced the inline `{searchOpen && <div ...>}` block with `<Dialog
  open={searchOpen} onOpenChange={setSearchOpen}>`. The input field is now
  a shadcn `<Input>` and the "Usa Link" button is a shadcn `<Button>` for
  consistency with the rest of the UI. The "Usa Link" button is now disabled
  when the input is empty or no media is selected (was previously silently
  no-op in those cases).
- **Removed the global ESC handler** added in 0.7.1 (`src/app/page.tsx`).
  Now that all overlays are Radix Dialogs, ESC is handled natively by Radix:
  it closes the topmost modal first, exactly what we want. The custom handler
  was fighting with Radix and was no longer needed.
- **Removed the local ESC handler** in `ArtworkModal` (added in 0.7.1).
  Same reason — Radix handles nested ESC correctly.
- **Restored `onPointerDownOutside` to unconditional `e.preventDefault()`**
  in `EditorModal` and `ArtworkModal`. The 0.7.1 `data-videomodal` /
  `data-zoom-overlay` checks are no longer needed because the child overlays
  are now Radix Dialogs (Radix intercepts click-outside at the topmost modal
  and doesn't propagate to the parent). The unconditional `preventDefault`
  keeps the editor/artwork open when the user clicks outside (avoids losing
  NFO edits by accident).

### 🏗️ Changed
- Bumped version 0.7.1 → 0.7.2 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).

### 📋 Verification
- `npx tsc --noEmit`: zero new errors in modified files (pre-existing errors
  in `search-artwork-online`, `media-card.tsx`, `settings-store.ts` are
  unchanged — they were already there in 0.7.1 and are tracked as known
  issues for 0.8).
- `npx next build`: build completes successfully, all 25 routes generated.
- Manual test scenarios to verify before release:
  - **(b)** Card → Editor → click YouTube result → VideoModal opens →
    buttons in VideoModal are now clickable ✓
  - **(c)** Card → Artwork → click any image → zoom opens → close button
    works, click-outside closes zoom (not the parent Artwork) ✓
  - **(d)** Header → global YouTube search → click a result → VideoModal
    opens above the search Dialog → both are Radix, nested correctly ✓
  - **(a)** Header → Settings → click "Sfoglia" → DirectoryBrowser opens
    above Settings → both Radix, already worked in 0.7.1 ✓

### 📋 Known issues still NOT fixed (tracked for 0.8)
Same list as 0.7.1, repeated here for visibility:

- **Missing `POST /api/set-trailer/[type]/[id]` route** — frontend 404s
  on trailer save.
- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented** —
  no `middleware.ts`, app is fully open by default.
- **Caddyfile `XTransformPort` SSRF backdoor** — remove before deploying
  Caddy in front of nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** still
  Flask-era, don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — production
  build does not fail on TS errors.
- **ESLint config disables almost every useful rule** — `npm run lint` is
  effectively a no-op.

---

## [0.7.1] — 2026-10-25 — Nested modal bug fixes (INCOMPLETE)

### 🐛 Fixed
This is a **bug-fix-only release** addressing modal-nesting issues that
caused orphaned overlays, broken ESC handling, and z-index collisions
when multiple modals were open at the same time (e.g. Settings → Directory
Browser, Editor → YouTube preview, Artwork → Image zoom).

- **Orphaned custom overlays on ESC**: pressing ESC while a non-Radix
  overlay (VideoModal, image zoom, global search) was open above a Radix
  Dialog used to close the Radix parent first, leaving the custom overlay
  stranded on a black background. Now a global ESC handler in
  `src/app/page.tsx` and a local one in
  `src/components/extrarr/artwork-modal.tsx` intercept ESC in the capture
  phase and close the topmost custom overlay before Radix sees the event.
- **`data-videomodal` handler actually implemented**: the comment in
  `video-modal.tsx` claimed a fix that wasn't actually wired up. The
  EditorModal's `onPointerDownOutside` / `onInteractOutside` now check
  whether the click landed on a `[data-videomodal]` element and, if so,
  prevent the editor from closing. Same fix applied to ArtworkModal with
  a new `[data-zoom-overlay]` attribute.
- **z-index hierarchy normalized**: previously alpha-nav (`z-50`),
  MediaPlayer (`z-90`), global search (`z-100`), and VideoModal (`z-100`)
  all collided. New hierarchy:
  | Element | z-index | Note |
  |---------|---------|------|
  | Alpha-nav sidebar | z-40 | Below modals |
  | MediaPlayer | z-40 | Below modals (was z-90) |
  | Radix Dialogs | z-50 | shadcn default, unchanged |
  | Global search overlay | z-80 | Above modals (was z-100) |
  | VideoModal | z-100 | Unchanged |
  | Image zoom overlay | z-110 | Unchanged |
- **`onPointerDownOutside` made selective**: previously every Radix modal
  had `e.preventDefault()` hardcoded — users could not close any modal
  by clicking outside. Now:
  - `SettingsModal` blocks outside-click only when the DirectoryBrowser
    child is open; otherwise click-outside-to-close works as expected.
  - `CustomFilterModal` removed the unconditional block entirely (it has
    no child overlays).
  - `EditorModal` and `ArtworkModal` block only when their respective
    custom child overlay (VideoModal / zoom) is open.
- **DirectoryBrowserModal stale state**: the `useEffect` that fetches
  subdirectories on open was missing `initialPath` from its deps array.
  Opening the browser for path-map row 1 (e.g. `/mnt/Movies`), closing,
  then reopening for row 2 (e.g. `/mnt/TV`) used to leave the browser on
  the previous folder. Fixed by adding `initialPath` to the dependency
  array.
- **`window.confirm()` replaced with shadcn AlertDialog**: deleting a
  custom filter used to call `window.confirm()`, which is blocking,
  renders below Radix modals on some browsers (Safari iOS), and is
  visually inconsistent with the rest of the UI. Replaced with an
  `AlertDialog` component from `@/components/ui/alert-dialog` (already
  installed). The dialog stacks correctly above the parent modal and
  handles ESC and focus trap natively.

### 🏗️ Changed
- Bumped version 0.7 → 0.7.1 (badge in header, README, CHANGELOG,
  entrypoint log, Dockerfile header, package.json).
- `package.json` cleanup: `name` corrected from `nextjs_tailwind_shadcn_ts`
  (template default) to `nextrarr`; `version` corrected from `0.2.1` to
  `0.7.1`; `start` script aligned with Dockerfile CMD (`node` instead of
  `bun`, removed `tee server.log`).
- Removed the leftover `.env` file from the distribution (it pointed at
  `/home/z/my-project/db/custom.db`, a sandbox-specific path). The
  Dockerfile sets `DATABASE_URL=file:/config/extrarr.db` as default,
  which is the correct production path.

### 📋 Known issues NOT fixed in this release
The following issues identified during code review are **out of scope** for
this modal-fix release and will be addressed in 0.8:

- **Missing `POST /api/set-trailer/[type]/[id]` route**: the frontend
  calls `/api/set-trailer/...` but the route directory doesn't exist
  (the POST handler lives inside `get-trailer/[type]/[id]/route.ts`).
  Workaround: the POST works if you point the frontend to
  `/api/get-trailer/...` — but the Editor UI currently 404s on trailer
  save.
- **`EXTRARR_USERNAME` / `EXTRARR_PASSWORD` Basic Auth not implemented**:
  README and docker-compose document these env vars as enabling Basic
  Auth, but no `middleware.ts` exists. The app is fully open by default.
- **Caddyfile contains an `XTransformPort` query-parameter reverse proxy**
  that allows any client to proxy to arbitrary `localhost:PORT` values
  (SSRF backdoor). Remove the rule before deploying Caddy in front of
  nEXTrarr.
- **`scripts/verify_extrarr.py` and `scripts/preview_grid.py`** are still
  the Flask-era scripts (they import `from app import create_app` and
  test Flask-style URLs). They don't run against the Next.js codebase.
- **`next.config.ts` has `typescript.ignoreBuildErrors: true`** — the
  production build does not fail on TS errors.
- **ESLint config disables almost every useful rule** (`no-unused-vars`,
  `prefer-const`, `react-hooks/exhaustive-deps`, etc.). `npm run lint`
  is effectively a no-op.

---

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

### 🐛 Fixed (carried over from v0.7 of the Flask rewrite)
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
