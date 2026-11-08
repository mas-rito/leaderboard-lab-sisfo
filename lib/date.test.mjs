import test from "node:test";
import assert from "node:assert/strict";
import {
  getDateKey,
  getYesterdayKey,
  getRelativeDayKey,
  isValidDateKey,
  getDayRange,
  formatDateLabel,
} from "./date.js";

test("getDateKey memakai zona Asia/Jakarta", () => {
  assert.equal(getDateKey(new Date("2026-11-08T16:59:59Z")), "2026-11-08");
  assert.equal(getDateKey(new Date("2026-11-08T17:00:00Z")), "2026-11-09");
});

test("getYesterdayKey menangani pergantian bulan dan tahun", () => {
  assert.equal(getYesterdayKey(new Date("2026-11-08T12:00:00Z")), "2026-11-07");
  assert.equal(getYesterdayKey(new Date("2026-12-01T12:00:00Z")), "2026-11-30");
  assert.equal(getYesterdayKey(new Date("2027-01-01T12:00:00Z")), "2026-12-31");
});

test("getRelativeDayKey mengembalikan null untuk semua hari", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(getRelativeDayKey("today", now), "2026-11-08");
  assert.equal(getRelativeDayKey("yesterday", now), "2026-11-07");
  assert.equal(getRelativeDayKey("all", now), null);
});

test("isValidDateKey menolak format dan tanggal tidak valid", () => {
  assert.equal(isValidDateKey("2026-11-08"), true);
  assert.equal(isValidDateKey("2026-02-31"), false);
  assert.equal(isValidDateKey("08-11-2026"), false);
  assert.equal(isValidDateKey(""), false);
  assert.equal(isValidDateKey(null), false);
});

test("getDayRange menghasilkan batas UTC untuk Asia/Jakarta", () => {
  const { start, end } = getDayRange("2026-11-08");
  assert.equal(start.toISOString(), "2026-11-07T17:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-08T17:00:00.000Z");
});

test("formatDateLabel menampilkan hari dalam bahasa Indonesia", () => {
  const label = formatDateLabel("2026-11-08");
  assert.ok(label.includes("Minggu"));
  assert.ok(label.includes("November"));
  assert.ok(label.includes("2026"));
});
