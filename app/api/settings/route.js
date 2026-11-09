import { ensureSchema, getSql } from "../../../lib/db.js";
import {
  DEFAULT_COUNTDOWN_SECONDS,
  parseCountdownSeconds,
} from "../../../lib/settings.js";

export async function GET() {
  await ensureSchema();

  const sql = getSql();
  const rows = await sql`
    SELECT value
    FROM app_settings
    WHERE key = 'countdown_seconds'
    LIMIT 1
  `;

  const parsed = parseCountdownSeconds(rows[0]?.value);
  const countdownSeconds = parsed.value ?? DEFAULT_COUNTDOWN_SECONDS;

  return Response.json(
    { countdown_seconds: countdownSeconds },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(request) {
  await ensureSchema();

  const body = await request.json();
  const parsed = parseCountdownSeconds(body?.countdown_seconds);

  if (parsed.error) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('countdown_seconds', ${String(parsed.value)}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
  `;

  return Response.json(
    { countdown_seconds: parsed.value },
    { headers: { "Cache-Control": "no-store" } }
  );
}
