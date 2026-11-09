export const DEFAULT_COUNTDOWN_SECONDS = 300;
export const MIN_COUNTDOWN_SECONDS = 30;
export const MAX_COUNTDOWN_SECONDS = 3600;
export const SETTINGS_REFRESH_MS = 10_000;

export function parseCountdownSeconds(input) {
  const value = Number(input);

  if (!Number.isInteger(value)) {
    return { error: "Durasi countdown harus berupa angka bulat (detik)." };
  }
  if (value < MIN_COUNTDOWN_SECONDS || value > MAX_COUNTDOWN_SECONDS) {
    return {
      error: `Durasi countdown harus antara ${MIN_COUNTDOWN_SECONDS} dan ${MAX_COUNTDOWN_SECONDS} detik.`,
    };
  }

  return { value };
}

export async function loadCountdownSeconds(
  fallback = DEFAULT_COUNTDOWN_SECONDS
) {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return fallback;

    const data = await res.json();
    const parsed = parseCountdownSeconds(data?.countdown_seconds);
    return parsed.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function saveCountdownSeconds(input) {
  const parsed = parseCountdownSeconds(input);
  if (parsed.error) return parsed;

  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countdown_seconds: parsed.value }),
  });

  return res.json();
}
