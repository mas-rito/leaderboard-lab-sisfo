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
            level INTEGER NOT NULL CHECK (level >= 1)
          )
        `;
        for (const item of INITIAL_ENTRIES) {
          await directSql`
            INSERT INTO leaderboard_entries (id, name, level)
            VALUES (${item.id}, ${item.name}, ${item.level})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function listEntries(sql) {
  const rows = await sql`
    SELECT id, name, level
    FROM leaderboard_entries
    ORDER BY level DESC, id ASC
    LIMIT 100
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    level: Number(row.level),
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
  const result = parseEntry(body?.name, body?.level);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    INSERT INTO leaderboard_entries (id, name, level)
    VALUES (${result.entry.id}, ${result.entry.name}, ${result.entry.level})
  `;
  const entries = await listEntries(sql);
  return Response.json({ entries, entry: result.entry }, { status: 201 });
}

export async function PUT(request) {
  await ensureSchema();
  const body = await request.json();
  const result = parseEntry(body?.name, body?.level, body?.id ? String(body.id) : undefined);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const sql = getSql();
  const updated = await sql`
    UPDATE leaderboard_entries
    SET name = ${result.entry.name}, level = ${result.entry.level}
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
