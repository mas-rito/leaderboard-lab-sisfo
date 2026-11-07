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

export async function loadEntries() {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}

export async function saveEntry(name, levelInput) {
  const result = parseEntry(name, levelInput);
  if (result.error) return result;
  const res = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, level: levelInput }),
  });
  return res.json();
}

export async function updateEntry(id, name, levelInput) {
  const result = parseEntry(name, levelInput, id);
  if (result.error) return result;
  const res = await fetch("/api/leaderboard", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, level: levelInput }),
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
