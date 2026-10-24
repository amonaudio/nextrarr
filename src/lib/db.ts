import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaInitialized: boolean | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Raw SQL statements to create the database schema if it doesn't exist yet.
 * These mirror prisma/schema.prisma 1:1 — kept in sync manually.
 *
 * Using CREATE TABLE IF NOT EXISTS makes this idempotent: safe to call on
 * every DB access. @prisma/client's $executeRawUnsafe() is used because the
 * `prisma` CLI binary's transitive deps (e.g. `effect`, `@prisma/config`)
 * are NOT included in the runtime Docker image (Next.js standalone build
 * only bundles what the app code imports, not dev tooling like the CLI).
 *
 * This makes the app self-healing: even on a fresh DB file, the first
 * request that touches the DB will create the tables on the fly.
 */
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Settings" (
    "id" TEXT NOT NULL,
    "radarr_url" TEXT NOT NULL DEFAULT '',
    "radarr_api_key" TEXT NOT NULL DEFAULT '',
    "sonarr_url" TEXT NOT NULL DEFAULT '',
    "sonarr_api_key" TEXT NOT NULL DEFAULT '',
    "fanart_api_key" TEXT NOT NULL DEFAULT '',
    "tmdb_api_key" TEXT NOT NULL DEFAULT '',
    "path_map" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "CustomFilter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomFilter_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "CustomFilter_name_idx" ON "CustomFilter"("name")`,
]

let initPromise: Promise<void> | null = null

/**
 * Idempotently create the database tables if they don't exist yet.
 * Safe to call on every DB access — the CREATE TABLE IF NOT EXISTS is a no-op
 * if tables already exist. The result is cached in a global so subsequent
 * calls in the same process skip the SQL queries entirely.
 */
export function ensureSchema(): Promise<void> {
  if (globalForPrisma.prismaSchemaInitialized) return Promise.resolve()
  if (!initPromise) {
    initPromise = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) {
        await db.$executeRawUnsafe(stmt)
      }
      globalForPrisma.prismaSchemaInitialized = true
    })()
  }
  return initPromise
}
