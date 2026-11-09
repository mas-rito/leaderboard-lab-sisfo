import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COUNTDOWN_SECONDS,
  MIN_COUNTDOWN_SECONDS,
  MAX_COUNTDOWN_SECONDS,
  parseCountdownSeconds,
} from "./settings.js";

test("parseCountdownSeconds menerima bilangan bulat dalam rentang", () => {
  assert.equal(parseCountdownSeconds(300).value, 300);
  assert.equal(parseCountdownSeconds("60").value, 60);
  assert.equal(parseCountdownSeconds(MIN_COUNTDOWN_SECONDS).value, 30);
  assert.equal(parseCountdownSeconds(MAX_COUNTDOWN_SECONDS).value, 3600);
});

test("parseCountdownSeconds menolak nilai tidak valid", () => {
  assert.ok(parseCountdownSeconds(29).error);
  assert.ok(parseCountdownSeconds(3601).error);
  assert.ok(parseCountdownSeconds(1.5).error);
  assert.ok(parseCountdownSeconds("abc").error);
  assert.ok(parseCountdownSeconds("").error);
});

test("nilai default adalah 5 menit", () => {
  assert.equal(DEFAULT_COUNTDOWN_SECONDS, 300);
});
