/**
 * Konstanta & helper murni untuk sesi permainan player.
 * File ini sengaja tidak menyentuh DOM/localStorage agar mudah diuji.
 */

import {
  DEFAULT_COUNTDOWN_SECONDS,
  MAX_COUNTDOWN_SECONDS,
  MIN_COUNTDOWN_SECONDS,
} from "./settings.js";
import { isValidWhatsApp, normalizeWhatsApp } from "./whatsapp.js";

export const SESSION_STORAGE_KEY = "lab-sisfo:active-session";

function resolveLimitSeconds(limitSeconds) {
  const value = Number(limitSeconds);

  if (
    !Number.isInteger(value) ||
    value < MIN_COUNTDOWN_SECONDS ||
    value > MAX_COUNTDOWN_SECONDS
  ) {
    return DEFAULT_COUNTDOWN_SECONDS;
  }

  return value;
}

/**
 * Menghitung detik yang sudah berlalu sejak startTime.
 * Hasil selalu dibulatkan ke bawah dan dijepit di rentang 0..limit.
 */
export function getElapsedSeconds(
  startTime,
  now = Date.now(),
  limitSeconds = DEFAULT_COUNTDOWN_SECONDS
) {
  const started = Number(startTime);
  if (!Number.isFinite(started) || started <= 0) return 0;

  const limit = resolveLimitSeconds(limitSeconds);
  const elapsed = Math.floor((Number(now) - started) / 1000);
  return Math.min(Math.max(elapsed, 0), limit);
}

/**
 * Sisa waktu countdown. Limit berasal dari snapshot sesi.
 */
export function getRemainingSeconds(
  startTime,
  now = Date.now(),
  limitSeconds = DEFAULT_COUNTDOWN_SECONDS
) {
  const limit = resolveLimitSeconds(limitSeconds);
  return Math.max(0, limit - getElapsedSeconds(startTime, now, limit));
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
  const whatsapp = normalizeWhatsApp(data?.whatsapp);
  const startTime = Number(data?.startTime);

  if (!name || !origin) return null;
  if (!isValidWhatsApp(whatsapp)) return null;
  if (!Number.isFinite(startTime) || startTime <= 0) return null;

  const rawLimit = Number(data?.countdownSeconds);
  const countdownSeconds =
    Number.isInteger(rawLimit) &&
    rawLimit >= MIN_COUNTDOWN_SECONDS &&
    rawLimit <= MAX_COUNTDOWN_SECONDS
      ? rawLimit
      : DEFAULT_COUNTDOWN_SECONDS;

  const finishedAtRaw = Number(data?.finishedAt);
  const finishedAt =
    Number.isFinite(finishedAtRaw) && finishedAtRaw > 0 ? finishedAtRaw : null;

  return { name, origin, whatsapp, startTime, countdownSeconds, finishedAt };
}
