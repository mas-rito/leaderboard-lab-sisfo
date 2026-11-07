import test from "node:test";
import assert from "node:assert/strict";
import {
  getRankColor,
  sortLeaderboard,
  parseEntry,
  applyUpdate,
  applyDelete,
} from "./leaderboard.js";

test("sortLeaderboard mengurutkan level tertinggi ke terendah", () => {
  const data = [
    { id: "a", name: "User A", level: 10 },
    { id: "b", name: "User B", level: 50 },
    { id: "c", name: "User C", level: 30 },
  ];
  const sorted = sortLeaderboard(data);
  assert.deepEqual(
    sorted.map((x) => x.level),
    [50, 30, 10]
  );
});

test("getRankColor membedakan posisi 1, 2, 3 dan menyamakan posisi 4 ke bawah", () => {
  const c1 = getRankColor(0);
  const c2 = getRankColor(1);
  const c3 = getRankColor(2);
  const c4 = getRankColor(3);
  const c5 = getRankColor(4);
  const c10 = getRankColor(9);

  assert.notEqual(c1, c2);
  assert.notEqual(c2, c3);
  assert.notEqual(c1, c3);
  assert.notEqual(c1, c4);
  assert.notEqual(c2, c4);
  assert.notEqual(c3, c4);
  assert.equal(c4, c5);
  assert.equal(c4, c10);
});

test("parseEntry, applyUpdate, dan applyDelete mengelola CRUD dengan benar", () => {
  assert.ok(parseEntry("", 10).error);
  assert.ok(parseEntry("Budi", 0).error);
  const valid = parseEntry("  Budi  ", "25", "1");
  assert.equal(valid.entry.name, "Budi");
  assert.equal(valid.entry.level, 25);

  const initial = [
    { id: "1", name: "Raka", level: 40 },
    { id: "2", name: "Sinta", level: 20 },
  ];
  const updated = applyUpdate(initial, "2", "Sinta Baru", 99);
  assert.equal(updated.entries[0].id, "2");
  assert.equal(updated.entries[0].name, "Sinta Baru");
  assert.equal(updated.entries[0].level, 99);

  const afterDelete = applyDelete(updated.entries, "2");
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, "1");
});
