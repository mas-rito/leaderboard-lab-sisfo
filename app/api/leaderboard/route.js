import { neon } from "@neondatabase/serverless";
import { parseEnv } from "@neon/env";
import neonConfig from "../../../neon.ts";
import { INITIAL_ENTRIES, parseEntry } from "../../../lib/leaderboard.js";

function getSql(unpooled = false) {
  const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
  const url = (unpooled && process.env.DATABASE_URL_UNPOOLED) || postgres.databaseUrl;
  return neon(url);
}

let schemaPromise = null;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const directSql = getSql(true);
      const [{ exists }] = await directSql`
        SELECT to_regclass('public.leaderboard_entries') IS NOT NULL AS exists
      `;
      if (!exists) {
        await directSql`
          CREATE TABLE IF NOT EXISTS leaderboard_entries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            origin TEXT NOT NULL DEFAULT '',
            level INTEGER NOT NULL CHECK (level >= 1),
            duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        for (const item of INITIAL_ENTRIES) {
          await directSql`
            INSERT INTO leaderboard_entries (id, name, origin, level, duration_seconds, created_at)
            VALUES (${item.id}, ${item.name}, ${item.origin}, ${item.level}, ${item.duration_seconds}, ${item.created_at})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      } else {
        // Migration penambahan kolom jika tabel lama sudah ada
        await directSql`
          ALTER TABLE leaderboard_entries
          ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        `;
      }

      await directSql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_tie_breaker 
        ON leaderboard_entries (level DESC, duration_seconds ASC, created_at ASC)
      `;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function listEntries(sql) {
  const rows = await sql`
    SELECT id, name, origin, level, duration_seconds, created_at
    FROM leaderboard_entries
    ORDER BY level DESC, duration_seconds ASC, created_at ASC
    LIMIT 100
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    origin: row.origin || "-",
    level: Number(row.level),
    duration_seconds: Number(row.duration_seconds || 0),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));
}

export async function GET() {
  await ensureSchema();
  const entries = await listEntries(getSql());
  return Response.json({ entries });
}

export async function POST(request) {
  await ensureSchema();
  const body = await request.json();
  const result = parseEntry(body?.name, body?.origin, body?.level, body?.duration_seconds);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    INSERT INTO leaderboard_entries (id, name, origin, level, duration_seconds, created_at)
    VALUES (
      ${result.entry.id}, 
      ${result.entry.name}, 
      ${result.entry.origin}, 
      ${result.entry.level}, 
      ${result.entry.duration_seconds}, 
      ${result.entry.created_at}
    )
  `;
  const entries = await listEntries(sql);
  return Response.json({ entries, entry: result.entry }, { status: 201 });
}

export async function PUT(request) {
  await ensureSchema();
  const body = await request.json();
  const result = parseEntry(
    body?.name,
    body?.origin,
    body?.level,
    body?.duration_seconds,
    body?.id ? String(body.id) : undefined
  );
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const sql = getSql();
  const updated = await sql`
    UPDATE leaderboard_entries
    SET 
      name = ${result.entry.name}, 
      origin = ${result.entry.origin},
      level = ${result.entry.level},
      duration_seconds = ${result.entry.duration_seconds}
    WHERE id = ${result.entry.id}
    RETURNING id
  `;
  if (updated.length === 0) {
    return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  const entries = await listEntries(sql);
  return Response.json({ entries, entry: result.entry });
}

export async function DELETE(request) {
  await ensureSchema();
  const body = await request.json();
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "ID wajib diisi." }, { status: 400 });
  }
  const sql = getSql();
  await sql`DELETE FROM leaderboard_entries WHERE id = ${id}`;
  const entries = await listEntries(sql);
  return Response.json({ entries });
}
