export const INITIAL_ENTRIES = [
  { id: "1", name: "Raka", origin: "SMKN 1 Surabaya", level: 42, duration_seconds: 145, created_at: "2026-11-01T10:00:00Z" },
  { id: "2", name: "Sinta", origin: "SMA 2 Surabaya", level: 38, duration_seconds: 180, created_at: "2026-11-01T10:05:00Z" },
  { id: "3", name: "Budi", origin: "Sistem Informasi", level: 31, duration_seconds: 210, created_at: "2026-11-01T10:10:00Z" },
  { id: "4", name: "Dina", origin: "Teknik Informatika", level: 24, duration_seconds: 240, created_at: "2026-11-01T10:15:00Z" },
  { id: "5", name: "Andi", origin: "SMA 1 Gresik", level: 19, duration_seconds: 300, created_at: "2026-11-01T10:20:00Z" },
];

export const RANK_COLORS = [
  "#fef08a", // Posisi 1: Gold
  "#e2e8f0", // Posisi 2: Silver
  "#fed7aa", // Posisi 3: Bronze
];
export const DEFAULT_RANK_COLOR = "#ffffff"; // Posisi 4 ke bawah

export function getRankColor(index) {
  return index < 3 ? RANK_COLORS[index] : DEFAULT_RANK_COLOR;
}

/**
 * Format detik ke MM:SS (contoh: 125 -> "02:05")
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Sorting tie-breaker:
 * 1. Level DESC (tertinggi lebih dulu)
 * 2. duration_seconds ASC (tercepat lebih dulu)
 * 3. created_at ASC (pencatatan lebih awal lebih dulu)
 */
export function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.level !== a.level) {
      return b.level - a.level;
    }
    const durA = Number(a.duration_seconds ?? 0);
    const durB = Number(b.duration_seconds ?? 0);
    if (durA !== durB) {
      return durA - durB;
    }
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });
}

export function parseEntry(name, origin, levelInput, durationInput, id, createdAt) {
  const cleanName = String(name ?? "").trim();
  const cleanOrigin = String(origin ?? "").trim();
  const level = Number(levelInput);
  const duration = Number(durationInput ?? 0);

  if (!cleanName) return { error: "Nama peserta wajib diisi." };
  if (!cleanOrigin) return { error: "Asal (Sekolah/Jurusan) wajib diisi." };
  if (!Number.isFinite(level) || !Number.isInteger(level) || level < 1) {
    return { error: "Level harus berupa angka bulat minimal 1." };
  }
  if (!Number.isFinite(duration) || duration < 0 || duration > 300) {
    return { error: "Durasi permainan harus antara 0 hingga 300 detik." };
  }

  return {
    entry: {
      id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      origin: cleanOrigin,
      level,
      duration_seconds: Math.floor(duration),
      created_at: createdAt ?? new Date().toISOString(),
    },
  };
}

export function applyUpdate(entries, id, name, origin, levelInput, durationInput) {
  const result = parseEntry(name, origin, levelInput, durationInput, id);
  if (result.error) return result;
  if (!entries.some((item) => item.id === id)) return { error: "Data tidak ditemukan." };
  const next = sortLeaderboard(entries.map((item) => (item.id === id ? { ...item, ...result.entry } : item)));
  return { entries: next, entry: result.entry };
}

export function applyDelete(entries, id) {
  return sortLeaderboard(entries.filter((item) => item.id !== id));
}

export async function loadEntries(dateKey) {
  const query = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
  const res = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}

export async function saveEntry(name, origin, levelInput, durationInput) {
  const result = parseEntry(name, origin, levelInput, durationInput);
  if (result.error) return result;
  const res = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: result.entry.name,
      origin: result.entry.origin,
      level: result.entry.level,
      duration_seconds: result.entry.duration_seconds,
    }),
  });
  return res.json();
}

export async function updateEntry(id, name, origin, levelInput, durationInput) {
  const result = parseEntry(name, origin, levelInput, durationInput, id);
  if (result.error) return result;
  const res = await fetch("/api/leaderboard", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      name: result.entry.name,
      origin: result.entry.origin,
      level: result.entry.level,
      duration_seconds: result.entry.duration_seconds,
    }),
  });
  return res.json();
}

export async function deleteEntry(id) {
  const res = await fetch("/api/leaderboard", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}
