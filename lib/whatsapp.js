/**
 * Helper murni untuk nomor WhatsApp.
 * Tidak menyentuh DOM agar bisa dipakai di client, server, dan unit test.
 */

export function normalizeWhatsApp(value) {
  let digits = String(value ?? "").replace(/[\s().-]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }

  return digits;
}

export function isValidWhatsApp(value) {
  return /^628\d{7,11}$/.test(normalizeWhatsApp(value));
}

export function formatWhatsApp(value) {
  const normalized = normalizeWhatsApp(value);
  return normalized ? `+${normalized}` : "";
}

export function getWhatsAppLink(value) {
  const normalized = normalizeWhatsApp(value);
  return normalized ? `https://wa.me/${normalized}` : "";
}
