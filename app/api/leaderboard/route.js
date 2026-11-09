import { parseEntry } from "../../../lib/leaderboard.js";
import { ensureSchema, getSql } from "../../../lib/db.js";
import { getDayRange, isValidDateKey } from "../../../lib/date.js";

function mapEntries(rows, includeWhatsApp = false) {
  return rows.map((row) => {
    const entry = {
      id: String(row.id),
      name: row.name,
      origin: row.origin || "-",
      level: Number(row.level),
      duration_seconds: Number(row.duration_seconds || 0),
      created_at: row.created_at
        ? new Date(row.created_at).toISOString()
        : null,
    };

    if (includeWhatsApp) {
      entry.whatsapp = row.whatsapp || "";
    }

    return entry;
  });
}

async function listEntries(sql, dateKey, includeWhatsApp = false) {
  if (dateKey) {
    const { start, end } = getDayRange(dateKey);

    const rows = await sql`
      SELECT id, name, origin, whatsapp, level, duration_seconds, created_at
      FROM leaderboard_entries
      WHERE created_at >= ${start.toISOString()}::timestamptz
        AND created_at < ${end.toISOString()}::timestamptz
      ORDER BY level DESC, duration_seconds ASC, created_at ASC
      LIMIT 100
    `;

    return mapEntries(rows, includeWhatsApp);
  }

  const rows = await sql`
    SELECT id, name, origin, whatsapp, level, duration_seconds, created_at
    FROM leaderboard_entries
    ORDER BY level DESC, duration_seconds ASC, created_at ASC
    LIMIT 100
  `;

  return mapEntries(rows, includeWhatsApp);
}

export async function GET(request) {
  await ensureSchema();

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const includeWhatsApp =
    url.searchParams.get("include_whatsapp") === "1";

  if (date && !isValidDateKey(date)) {
    return Response.json(
      { error: "Format tanggal harus YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const entries = await listEntries(getSql(), date, includeWhatsApp);
  return Response.json({ entries, date: date ?? null });
}

export async function POST(request) {
  await ensureSchema();
  const body = await request.json();

  const result = parseEntry(
    body?.name,
    body?.origin,
    body?.level,
    body?.duration_seconds,
    undefined,
    undefined,
    body?.whatsapp
  );

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO leaderboard_entries (
      id, name, origin, whatsapp, level, duration_seconds, created_at
    )
    VALUES (
      ${result.entry.id},
      ${result.entry.name},
      ${result.entry.origin},
      ${result.entry.whatsapp},
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
    body?.id ? String(body.id) : undefined,
    undefined,
    body?.whatsapp
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
      whatsapp = ${result.entry.whatsapp},
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
