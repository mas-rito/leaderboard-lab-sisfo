import test from "node:test";
import assert from "node:assert/strict";
import {
  getElapsedSeconds,
  getRemainingSeconds,
  parseStoredSession,
} from "./session.js";
import { DEFAULT_COUNTDOWN_SECONDS } from "./settings.js";

const START = 1_700_000_000_000;

test("getElapsedSeconds menghitung selisih waktu dan menghormati limit", () => {
  assert.equal(getElapsedSeconds(START, START), 0);
  assert.equal(getElapsedSeconds(START, START + 5_000), 5);
  assert.equal(getElapsedSeconds(START, START + 5_900), 5);
  assert.equal(getElapsedSeconds(START, START + 299_000), 299);
  assert.equal(getElapsedSeconds(START, START + 300_000), 300);
  assert.equal(getElapsedSeconds(START, START + 999_000), 300);
  assert.equal(getElapsedSeconds(START, START - 10_000), 0);
  assert.equal(getElapsedSeconds(null, START), 0);
  assert.equal(getElapsedSeconds("bukan-angka", START), 0);

  assert.equal(getElapsedSeconds(START, START + 5_000, 60), 5);
  assert.equal(getElapsedSeconds(START, START + 60_000, 60), 60);
  assert.equal(getElapsedSeconds(START, START + 999_000, 60), 60);
});

test("getRemainingSeconds memakai limit yang diberikan", () => {
  assert.equal(
    getRemainingSeconds(START, START),
    DEFAULT_COUNTDOWN_SECONDS
  );
  assert.equal(getRemainingSeconds(START, START + 5_000), 295);
  assert.equal(getRemainingSeconds(START, START + 300_000), 0);
  assert.equal(getRemainingSeconds(START, START + 999_000), 0);

  assert.equal(getRemainingSeconds(START, START, 60), 60);
  assert.equal(getRemainingSeconds(START, START + 30_000, 60), 30);
  assert.equal(getRemainingSeconds(START, START + 60_000, 60), 0);
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
  assert.equal(
    parseStoredSession(
      JSON.stringify({ name: "Budi", origin: "SMA 1", startTime: START })
    ),
    null
  );
});

test("parseStoredSession menyimpan WhatsApp dan snapshot countdown", () => {
  const running = parseStoredSession(
    JSON.stringify({
      name: "  Budi  ",
      origin: "  SMA 1  ",
      whatsapp: "0812-3456-7890",
      startTime: START,
      countdownSeconds: 120,
      finishedAt: null,
    })
  );

  assert.deepEqual(running, {
    name: "Budi",
    origin: "SMA 1",
    whatsapp: "6281234567890",
    startTime: START,
    countdownSeconds: 120,
    finishedAt: null,
  });

  const finished = parseStoredSession(
    JSON.stringify({
      name: "Budi",
      origin: "SMA 1",
      whatsapp: "081234567890",
      startTime: START,
      countdownSeconds: 60,
      finishedAt: START + 42_000,
    })
  );

  assert.equal(finished.finishedAt, START + 42_000);
  assert.equal(finished.countdownSeconds, 60);
  assert.equal(finished.whatsapp, "6281234567890");
});
