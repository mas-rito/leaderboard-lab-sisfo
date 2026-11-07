const STORAGE_KEY = "leaderboard_entries";

export const INITIAL_ENTRIES = [
  { id: "1", name: "Raka", level: 42 },
  { id: "2", name: "Sinta", level: 38 },
  { id: "3", name: "Budi", level: 31 },
  { id: "4", name: "Dina", level: 24 },
  { id: "5", name: "Andi", level: 19 },
];

export const RANK_COLORS = [
  "#fef08a", // Posisi 1: Gold
  "#e2e8f0", // Posisi 2: Silver
  "#fed7aa", // Posisi 3: Bronze
];
export const DEFAULT_RANK_COLOR = "#ffffff"; // Posisi 4 dan ke bawah: sama

export function getRankColor(index) {
  return index < 3 ? RANK_COLORS[index] : DEFAULT_RANK_COLOR;
}

export function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => b.level - a.level);
}

export function parseEntry(name, levelInput, id) {
  const cleanName = String(name ?? "").trim();
  const level = Number(levelInput);
  if (!cleanName) return { error: "Nama wajib diisi." };
  if (!Number.isFinite(level) || !Number.isInteger(level) || level < 1) {
    return { error: "Level harus berupa angka bulat minimal 1." };
  }
  return {
    entry: {
      id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      level,
    },
  };
}

export function applyUpdate(entries, id, name, levelInput) {
  const result = parseEntry(name, levelInput, id);
  if (result.error) return result;
  if (!entries.some((item) => item.id === id)) return { error: "Data tidak ditemukan." };
  const next = sortLeaderboard(entries.map((item) => (item.id === id ? result.entry : item)));
  return { entries: next, entry: result.entry };
}

export function applyDelete(entries, id) {
  return sortLeaderboard(entries.filter((item) => item.id !== id));
}

// shortcut: stores data in browser localStorage per device, move to a database (e.g. Vercel Postgres/KV) when shared multi-user data is needed
export function loadEntries() {
  if (typeof window === "undefined") return sortLeaderboard(INITIAL_ENTRIES);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : INITIAL_ENTRIES;
    return sortLeaderboard(Array.isArray(parsed) ? parsed : INITIAL_ENTRIES);
  } catch {
    return sortLeaderboard(INITIAL_ENTRIES);
  }
}

export function saveEntry(name, levelInput) {
  const result = parseEntry(name, levelInput);
  if (result.error) return result;
  const next = sortLeaderboard([...loadEntries(), result.entry]);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { entries: next, entry: result.entry };
}

export function updateEntry(id, name, levelInput) {
  const result = applyUpdate(loadEntries(), id, name, levelInput);
  if (result.error) return result;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.entries));
  return result;
}

export function deleteEntry(id) {
  const next = applyDelete(loadEntries(), id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
