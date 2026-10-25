# ====================================================================
# nEXTrarr 0.8.1 — Next.js Docker image for Unraid
# Multi-stage build:
#   1. deps — install npm/bun deps (handles missing lockfile gracefully)
#   2. builder — compile Next.js (standalone output)
#   3. runtime — minimal image with yt-dlp + ffmpeg + node + standalone bundle
# ====================================================================

# ---------- Stage 1: deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
# Install bun (faster than npm, generates bun.lock on the fly if missing)
RUN npm install -g bun
COPY package.json ./
# Copy lockfile if present (we excluded bun.lock from the zip to save space —
# bun install will regenerate it on the fly)
COPY bun.lock* package-lock.json* ./
# Use bun install (not --frozen-lockfile so it works without a committed lockfile)
RUN bun install

# ---------- Stage 2: builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g bun
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate Prisma client before build (the postinstall hook in deps stage
# didn't have the schema available, so we must generate now that schema.prisma
# has been copied into the build context).
RUN bun run db:generate
# Build with standalone output (already set in next.config.ts)
RUN bun run build

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime

# Runtime deps: yt-dlp needs ffmpeg for audio extraction; curl for HEALTHCHECK;
# tini for proper PID 1 signal handling; ca-certificates for HTTPS.
# python3 + py3-pip to install yt-dlp.
RUN apk add --no-cache \
        ffmpeg \
        ca-certificates \
        curl \
        tini \
        su-exec \
        python3 \
        py3-pip \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Override Prisma DATABASE_URL to point to the persistent /config volume
    DATABASE_URL=file:/config/extrarr.db \
    EXTRARR_ENV=production

# Copy standalone Next.js bundle (only what's needed to run)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma client (the generated code) + schema for runtime DB access.
# The @prisma/client creates tables on first DB access via $executeRawUnsafe()
# in src/lib/db.ts (ensureSchema function) — no need to ship the prisma CLI
# binary (which has transitive deps like `effect` and `@prisma/config` that
# aren't bundled in the standalone runtime).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# Entrypoint script
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Persistent volumes:
#   /config    — SQLite DB, settings, runtime state
#   /mnt/user  — Unraid host media root (read-write for theme.mp3 + artwork)
VOLUME ["/config", "/mnt/user"]

EXPOSE 3000

# NOTE: This container runs as root. On Unraid, /mnt/user shares are typically
# owned by nobody:users (99:100) with 777 perms, so root can read/write without
# issues. If you want to run as non-root for security, add:
#   RUN addgroup -g 100 users && adduser -D -u 99 -G users nobody
#   RUN chown -R nobody:users /app /config
#   USER nobody
# And update entrypoint.sh to use `su-exec nobody` for the final exec.
# Leaving as root for now because it's the simplest path that works on Unraid.

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]
CMD ["node", "server.js"]
