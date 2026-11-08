import test from "node:test";
import assert from "node:assert/strict";
import {
  getRankColor,
  sortLeaderboard,
  formatDuration,
  parseEntry,
  applyUpdate,
  applyDelete,
} from "./leaderboard.js";

test("formatDuration mengonversi detik ke string MM:SS dengan benar", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(5), "00:05");
  assert.equal(formatDuration(65), "01:05");
  assert.equal(formatDuration(300), "05:00");
});

test("sortLeaderboard menerapkan logika tie-breaker: Level DESC -> Durasi ASC -> Waktu ASC", () => {
  const data = [
    { id: "a", name: "User A", origin: "SMA 1", level: 50, duration_seconds: 120, created_at: "2026-11-01T10:00:00Z" },
    { id: "b", name: "User B", origin: "SMA 2", level: 50, duration_seconds: 90, created_at: "2026-11-01T10:05:00Z" },
    { id: "c", name: "User C", origin: "SMA 3", level: 60, duration_seconds: 200, created_at: "2026-11-01T10:10:00Z" },
    { id: "d", name: "User D", origin: "SMA 4", level: 50, duration_seconds: 90, created_at: "2026-11-01T09:00:00Z" },
  ];

  const sorted = sortLeaderboard(data);

  // Posisi 1: Level tertinggi (User C, Level 60)
  assert.equal(sorted[0].id, "c");
  // Posisi 2: Level 50, durasi 90s, waktu paling awal (User D, 09:00)
  assert.equal(sorted[1].id, "d");
  // Posisi 3: Level 50, durasi 90s, waktu belakangan (User B, 10:05)
  assert.equal(sorted[2].id, "b");
  // Posisi 4: Level 50, durasi paling lama 120s (User A)
  assert.equal(sorted[3].id, "a");
});

test("parseEntry, applyUpdate, dan applyDelete mengelola data lengkap dengan benar", () => {
  assert.ok(parseEntry("", "SMA 1", 10, 100).error, "Nama kosong harus error");
  assert.ok(parseEntry("Budi", "", 10, 100).error, "Asal kosong harus error");
  assert.ok(parseEntry("Budi", "SMA 1", 0, 100).error, "Level 0 harus error");
  assert.ok(parseEntry("Budi", "SMA 1", 10, -5).error, "Durasi negatif harus error");
  assert.ok(parseEntry("Budi", "SMA 1", 10, 301).error, "Durasi > 300 harus error");

  const valid = parseEntry("  Budi  ", "  SMA 1  ", "25", "125", "1");
  assert.equal(valid.entry.name, "Budi");
  assert.equal(valid.entry.origin, "SMA 1");
  assert.equal(valid.entry.level, 25);
  assert.equal(valid.entry.duration_seconds, 125);

  const initial = [
    { id: "1", name: "Raka", origin: "SMA 1", level: 40, duration_seconds: 100, created_at: "2026-11-01T10:00:00Z" },
    { id: "2", name: "Sinta", origin: "SMA 2", level: 20, duration_seconds: 50, created_at: "2026-11-01T10:05:00Z" },
  ];

  const updated = applyUpdate(initial, "2", "Sinta Baru", "SMA 2 Baru", 99, 45);
  assert.equal(updated.entries[0].id, "2");
  assert.equal(updated.entries[0].name, "Sinta Baru");
  assert.equal(updated.entries[0].origin, "SMA 2 Baru");
  assert.equal(updated.entries[0].level, 99);
  assert.equal(updated.entries[0].duration_seconds, 45);

  const afterDelete = applyDelete(updated.entries, "2");
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, "1");
});
