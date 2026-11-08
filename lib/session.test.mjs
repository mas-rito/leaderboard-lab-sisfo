import test from "node:test";
import assert from "node:assert/strict";
import {
  TOTAL_COUNTDOWN_SECONDS,
  getElapsedSeconds,
  getRemainingSeconds,
  parseStoredSession,
} from "./session.js";

const START = 1_700_000_000_000;

test("getElapsedSeconds menghitung selisih waktu dan menjepit 0..300", () => {
  assert.equal(getElapsedSeconds(START, START), 0);
  assert.equal(getElapsedSeconds(START, START + 5_000), 5);
  assert.equal(getElapsedSeconds(START, START + 5_900), 5);
  assert.equal(getElapsedSeconds(START, START + 299_000), 299);
  assert.equal(getElapsedSeconds(START, START + 300_000), 300);
  assert.equal(getElapsedSeconds(START, START + 999_000), 300);
  assert.equal(getElapsedSeconds(START, START - 10_000), 0);
  assert.equal(getElapsedSeconds(null, START), 0);
  assert.equal(getElapsedSeconds("bukan-angka", START), 0);
});

test("getRemainingSeconds menghasilkan countdown 300 -> 0", () => {
  assert.equal(getRemainingSeconds(START, START), TOTAL_COUNTDOWN_SECONDS);
  assert.equal(getRemainingSeconds(START, START + 5_000), 295);
  assert.equal(getRemainingSeconds(START, START + 300_000), 0);
  assert.equal(getRemainingSeconds(START, START + 999_000), 0);
});

test("parseStoredSession memvalidasi data localStorage", () => {
  assert.equal(parseStoredSession(null), null);
  assert.equal(parseStoredSession(""), null);
  assert.equal(parseStoredSession("{bukan json"), null);
  assert.equal(
    parseStoredSession(
      JSON.stringify({ name: "", origin: "SMA 1", startTime: START })
    ),
    null
  );
  assert.equal(
    parseStoredSession(
      JSON.stringify({ name: "Budi", origin: "", startTime: START })
    ),
    null
  );
  assert.equal(
    parseStoredSession(
      JSON.stringify({ name: "Budi", origin: "SMA 1", startTime: "x" })
    ),
    null
  );

  const running = parseStoredSession(
    JSON.stringify({ name: "  Budi  ", origin: "  SMA 1  ", startTime: START })
  );
  assert.deepEqual(running, {
    name: "Budi",
    origin: "SMA 1",
    startTime: START,
    finishedAt: null,
  });

  const finished = parseStoredSession(
    JSON.stringify({
      name: "Budi",
      origin: "SMA 1",
      startTime: START,
      finishedAt: START + 42_000,
    })
  );
  assert.equal(finished.finishedAt, START + 42_000);
});
