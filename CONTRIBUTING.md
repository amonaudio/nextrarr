# Contributing to nEXTrarr (Next.js version)

Thanks for your interest in improving nEXTrarr! This document covers the
basics of setting up a development environment, running tests, and
submitting changes.

## Development setup

```bash
git clone https://github.com/amonaudio/nextrarr.git
cd extrarr
bun install          # or: npm install
bun run db:push      # create SQLite tables
```

You'll also need:
- `ffmpeg` installed (required by yt-dlp for audio extraction)
- A Radarr or Sonarr instance to test against (or use demo mode — the app loads mock data automatically when no API keys are configured)
- API keys for Fanart.tv and TMDB (for the artwork features)

## Running the dev server

```bash
bun run dev          # or: npm run dev
# → http://localhost:3000
```

> ⚠️ The dev server runs with `--debug` enabled by default. Never expose it to the internet.
> Use the Docker image (`docker build -t extrarr:local .`) for anything beyond local testing.

## Lint

```bash
bun run lint         # or: npm run lint
```

## Prisma operations

```bash
# Apply schema changes to the DB
bun run db:push

# Generate Prisma Client (after schema changes)
bun run db:generate

# Create a migration (for production schema changes)
bun run db:migrate

# Reset DB (DESTRUCTIVE)
bun run db:reset
```

## Code style

- **TypeScript**: strict types throughout, prefer `interface` over `type` for object shapes
- **React**: function components only, no class components, prefer hooks
- **Styling**: Tailwind CSS 4 + shadcn/ui — no inline styles, no CSS files except `globals.css`
- **Server vs client**: `'use client'` only on components that need it (uses hooks, browser APIs, event handlers)
- **API routes**: App Router `route.ts` files, default export named HTTP methods (`GET`, `POST`, etc.)
- **State**: Zustand for client state, server state via `fetch()` (TanStack Query available if needed)
- **Icons**: Lucide React (`import { SomeIcon } from 'lucide-react'`)

## Before submitting a PR

1. Run `bun run lint` and make sure no errors
2. If you added a new endpoint, document it in `README.md`
3. If you changed the public API contract (URL shape, JSON fields, response codes), update `CHANGELOG.md` under `[Unreleased]`
4. If you changed the Prisma schema, run `bun run db:push` locally to verify it works, then commit `schema.prisma`

## Reporting security vulnerabilities

**Do not open a public GitHub issue** for security problems. Instead,
email the maintainers at `security@extrarr.example` (replace with the
real address once published) and include:

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Suggested fix (if any)

We'll respond within 72 hours.

## License

By contributing, you agree that your contributions are licensed under
the MIT License, as defined in [LICENSE](LICENSE).
