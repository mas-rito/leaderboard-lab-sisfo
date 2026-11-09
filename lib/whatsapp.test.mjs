import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWhatsApp,
  isValidWhatsApp,
  formatWhatsApp,
  getWhatsAppLink,
} from "./whatsapp.js";

test("normalizeWhatsApp menyeragamkan format nomor Indonesia", () => {
  assert.equal(normalizeWhatsApp("0812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsApp("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsApp("6281234567890"), "6281234567890");
  assert.equal(normalizeWhatsApp("81234567890"), "6281234567890");
  assert.equal(normalizeWhatsApp(""), "");
  assert.equal(normalizeWhatsApp(null), "");
});

test("isValidWhatsApp menerima nomor seluler Indonesia yang wajar", () => {
  assert.equal(isValidWhatsApp("081234567890"), true);
  assert.equal(isValidWhatsApp("+62 812-3456-7890"), true);
  assert.equal(isValidWhatsApp("6281234567890"), true);
  assert.equal(isValidWhatsApp(""), false);
  assert.equal(isValidWhatsApp("12345"), false);
  assert.equal(isValidWhatsApp("0212345678"), false);
  assert.equal(isValidWhatsApp("0812abc7890"), false);
});

test("formatWhatsApp dan getWhatsAppLink memakai nomor ternormalisasi", () => {
  assert.equal(formatWhatsApp("0812-3456-7890"), "+6281234567890");
  assert.equal(getWhatsAppLink("0812-3456-7890"), "https://wa.me/6281234567890");
  assert.equal(formatWhatsApp(""), "");
  assert.equal(getWhatsAppLink(""), "");
});
