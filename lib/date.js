export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_UTC_OFFSET = "+07:00";

/**
 * Mengembalikan tanggal lokal (YYYY-MM-DD) di zona waktu tertentu.
 */
export function getDateKey(date = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

export function getTodayKey(now = new Date(), timeZone = APP_TIME_ZONE) {
  return getDateKey(now, timeZone);
}

export function getYesterdayKey(now = new Date(), timeZone = APP_TIME_ZONE) {
  const todayKey = getDateKey(now, timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1));
  return yesterday.toISOString().slice(0, 10);
}

/**
 * day: "today" | "yesterday" | "all"
 * Mengembalikan null untuk "all" (tanpa filter tanggal).
 */
export function getRelativeDayKey(day, now = new Date(), timeZone = APP_TIME_ZONE) {
  if (day === "today") return getTodayKey(now, timeZone);
  if (day === "yesterday") return getYesterdayKey(now, timeZone);
  return null;
}

/**
 * Validasi format YYYY-MM-DD sekaligus memastikan tanggalnya nyata.
 */
export function isValidDateKey(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/**
 * Batas UTC untuk satu hari di Asia/Jakarta.
 * Contoh: 2026-11-08 -> 2026-11-07T17:00:00Z s/d 2026-11-08T17:00:00Z.
 */
export function getDayRange(dateKey) {
  const start = new Date(`${dateKey}T00:00:00${APP_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Label hari dalam bahasa Indonesia, mis. "Minggu, 8 November 2026".
 */
export function formatDateLabel(dateKey, timeZone = APP_TIME_ZONE) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
