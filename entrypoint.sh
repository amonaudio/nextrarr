#!/bin/sh
# entrypoint.sh — initialize /config + DB, then exec the Next.js server
set -euo pipefail

CONFIG_DIR="/config"
DB_FILE="${CONFIG_DIR}/extrarr.db"
DB_JOURNAL="${CONFIG_DIR}/extrarr.db-journal"

echo "[entrypoint] nEXTrarr 0.8.3 (Next.js) starting..."
echo "[entrypoint] Config dir: ${CONFIG_DIR}"
echo "[entrypoint] Database:   ${DATABASE_URL}"

mkdir -p "${CONFIG_DIR}"

# Initialize empty SQLite DB file if missing (Prisma will create tables on first read,
# but we want /config to exist with proper perms before the app starts)
if [ ! -f "${DB_FILE}" ]; then
    echo "[entrypoint] Creating empty SQLite database at ${DB_FILE}"
    touch "${DB_FILE}"
fi

# Restrict perms on the DB file (it contains API keys)
chmod 600 "${DB_FILE}" 2>/dev/null || true
if [ -f "${DB_JOURNAL}" ]; then chmod 600 "${DB_JOURNAL}" 2>/dev/null || true; fi

# Note: schema initialization is handled by the Next.js app itself via
# @prisma/client's $executeRawUnsafe() in src/lib/db.ts (ensureSchema()).
# This is more reliable than calling `prisma db push` here, because the
# prisma CLI's transitive deps (effect, @prisma/config, ...) are not
# included in the Next.js standalone runtime image. The app creates the
# tables on first DB access — idempotent and self-healing.
echo "[entrypoint] DB schema will be initialized on first request via @prisma/client"

# Verify yt-dlp is available
if ! command -v yt-dlp >/dev/null 2>&1; then
    echo "[entrypoint] WARNING: yt-dlp binary not found. YouTube features (theme download, search) will fail." >&2
else
    echo "[entrypoint] yt-dlp version: $(yt-dlp --version)"
fi

# Verify ffmpeg is available (yt-dlp needs it for audio extraction)
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "[entrypoint] WARNING: ffmpeg binary not found. Audio conversion will fail." >&2
else
    echo "[entrypoint] ffmpeg version: $(ffmpeg -version | head -1)"
fi

echo "[entrypoint] Starting Next.js server: $@"
exec "$@"
