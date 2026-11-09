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
  assert.equal(formatDuration(3600), "60:00");
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

test("sortLeaderboard mengurutkan level sama berdasarkan durasi lalu created_at", () => {
  const data = [
    { id: "a", name: "A", origin: "X", level: 20, duration_seconds: 120, created_at: "2026-11-01T10:00:00Z" },
    { id: "b", name: "B", origin: "X", level: 20, duration_seconds: 90, created_at: "2026-11-01T10:05:00Z" },
    { id: "c", name: "C", origin: "X", level: 20, duration_seconds: 90, created_at: "2026-11-01T09:00:00Z" },
  ];

  const sorted = sortLeaderboard(data);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["c", "b", "a"]
  );
});

test("parseEntry mewajibkan WhatsApp yang valid", () => {
  assert.ok(
    parseEntry("Budi", "SMA 1", 10, 100).error,
    "WhatsApp kosong harus error"
  );
  assert.ok(
    parseEntry("Budi", "SMA 1", 10, 100, undefined, undefined, "12345").error,
    "WhatsApp tidak valid harus error"
  );

  const valid = parseEntry(
    "  Budi  ",
    "  SMA 1  ",
    "25",
    "125",
    "1",
    undefined,
    "0812-3456-7890"
  );

  assert.equal(valid.entry.name, "Budi");
  assert.equal(valid.entry.origin, "SMA 1");
  assert.equal(valid.entry.whatsapp, "6281234567890");
  assert.equal(valid.entry.level, 25);
  assert.equal(valid.entry.duration_seconds, 125);
});

test("parseEntry memvalidasi level dan batas durasi", () => {
  assert.ok(parseEntry("", "SMA 1", 10, 100, undefined, undefined, "081234567890").error);
  assert.ok(parseEntry("Budi", "", 10, 100, undefined, undefined, "081234567890").error);
  assert.ok(parseEntry("Budi", "SMA 1", 0, 100, undefined, undefined, "081234567890").error);
  assert.ok(parseEntry("Budi", "SMA 1", 10, -5, undefined, undefined, "081234567890").error);
  assert.ok(parseEntry("Budi", "SMA 1", 10, 3601, undefined, undefined, "081234567890").error);
  assert.equal(
    parseEntry("Budi", "SMA 1", 10, 3600, undefined, undefined, "081234567890")
      .entry.duration_seconds,
    3600
  );
});

test("applyUpdate dan applyDelete mengelola data lengkap dengan benar", () => {
  const initial = [
    { id: "1", name: "Raka", origin: "SMA 1", whatsapp: "628111111111", level: 40, duration_seconds: 100, created_at: "2026-11-01T10:00:00Z" },
    { id: "2", name: "Sinta", origin: "SMA 2", whatsapp: "628222222222", level: 20, duration_seconds: 50, created_at: "2026-11-01T10:05:00Z" },
  ];

  const updated = applyUpdate(
    initial,
    "2",
    "Sinta Baru",
    "SMA 2 Baru",
    99,
    45,
    "0812-3456-7890"
  );

  assert.equal(updated.entries[0].id, "2");
  assert.equal(updated.entries[0].name, "Sinta Baru");
  assert.equal(updated.entries[0].origin, "SMA 2 Baru");
  assert.equal(updated.entries[0].whatsapp, "6281234567890");
  assert.equal(updated.entries[0].level, 99);
  assert.equal(updated.entries[0].duration_seconds, 45);
  assert.equal(
    updated.entries[0].created_at,
    "2026-11-01T10:05:00Z",
    "created_at asli tidak boleh berubah saat edit"
  );

  const afterDelete = applyDelete(updated.entries, "2");
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, "1");
});

test("getRankColor mengembalikan warna podium dan default", () => {
  assert.equal(getRankColor(0), "#fef08a");
  assert.equal(getRankColor(1), "#e2e8f0");
  assert.equal(getRankColor(2), "#fed7aa");
  assert.equal(getRankColor(3), "#ffffff");
});
