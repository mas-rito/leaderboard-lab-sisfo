import { neon } from "@neondatabase/serverless";
import { parseEnv } from "@neon/env";
import neonConfig from "../neon.ts";
import { INITIAL_ENTRIES } from "./leaderboard.js";
import { DEFAULT_COUNTDOWN_SECONDS } from "./settings.js";

export function getSql(unpooled = false) {
  const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
  const url =
    (unpooled && process.env.DATABASE_URL_UNPOOLED) || postgres.databaseUrl;
  return neon(url);
}

let schemaPromise = null;

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql(true);

      const [{ exists }] = await sql`
        SELECT to_regclass('public.leaderboard_entries') IS NOT NULL AS exists
      `;

      if (!exists) {
        await sql`
          CREATE TABLE IF NOT EXISTS leaderboard_entries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            origin TEXT NOT NULL DEFAULT '',
            whatsapp TEXT NOT NULL DEFAULT '',
            level INTEGER NOT NULL CHECK (level >= 1),
            duration_seconds INTEGER NOT NULL DEFAULT 0
              CHECK (duration_seconds >= 0 AND duration_seconds <= 3600),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;

        for (const item of INITIAL_ENTRIES) {
          await sql`
            INSERT INTO leaderboard_entries (
              id, name, origin, whatsapp, level, duration_seconds, created_at
            )
            VALUES (
              ${item.id},
              ${item.name},
              ${item.origin},
              ${item.whatsapp ?? ""},
              ${item.level},
              ${item.duration_seconds},
              ${item.created_at}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }
      } else {
        await sql`
          ALTER TABLE leaderboard_entries
          ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        `;

        // Hapus constraint lama (maksimal 300 detik) lalu pasang batas baru.
        // DO block + EXCEPTION membuat migrasi aman jika dua instance
        // serverless menjalankannya hampir bersamaan.
        await sql`
          DO $$
          BEGIN
            ALTER TABLE leaderboard_entries
              DROP CONSTRAINT IF EXISTS leaderboard_entries_duration_seconds_check;
            ALTER TABLE leaderboard_entries
              DROP CONSTRAINT IF EXISTS leaderboard_entries_duration_seconds_max_check;
            ALTER TABLE leaderboard_entries
              ADD CONSTRAINT leaderboard_entries_duration_seconds_max_check
              CHECK (duration_seconds >= 0 AND duration_seconds <= 3600);
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `;
      }

      await sql`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        INSERT INTO app_settings (key, value)
        VALUES ('countdown_seconds', ${String(DEFAULT_COUNTDOWN_SECONDS)})
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_tie_breaker
        ON leaderboard_entries (level DESC, duration_seconds ASC, created_at ASC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at
        ON leaderboard_entries (created_at)
      `;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }

  return schemaPromise;
}
