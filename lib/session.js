/**
 * Konstanta & helper murni untuk sesi permainan player.
 * File ini sengaja tidak menyentuh DOM/localStorage agar mudah diuji.
 */

export const TOTAL_COUNTDOWN_SECONDS = 300; // 5 menit
export const SESSION_STORAGE_KEY = "lab-sisfo:active-session";

/**
 * Menghitung detik yang sudah berlalu sejak startTime.
 * Hasil selalu dibulatkan ke bawah dan dijepit di rentang 0..300.
 */
export function getElapsedSeconds(startTime, now = Date.now()) {
  const started = Number(startTime);
  if (!Number.isFinite(started) || started <= 0) return 0;

  const elapsed = Math.floor((Number(now) - started) / 1000);
  return Math.min(Math.max(elapsed, 0), TOTAL_COUNTDOWN_SECONDS);
}

/**
 * Sisa waktu countdown. 300 detik di awal, 0 saat habis.
 */
export function getRemainingSeconds(startTime, now = Date.now()) {
  return TOTAL_COUNTDOWN_SECONDS - getElapsedSeconds(startTime, now);
}

/**
 * Membaca sesi dari string JSON localStorage.
 * Mengembalikan null jika data tidak valid/korup.
 */
export function parseStoredSession(raw) {
  if (!raw) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const name = String(data?.name ?? "").trim();
  const origin = String(data?.origin ?? "").trim();
  const startTime = Number(data?.startTime);

  if (!name || !origin) return null;
  if (!Number.isFinite(startTime) || startTime <= 0) return null;

  const finishedAtRaw = Number(data?.finishedAt);
  const finishedAt =
    Number.isFinite(finishedAtRaw) && finishedAtRaw > 0 ? finishedAtRaw : null;

  return { name, origin, startTime, finishedAt };
}
