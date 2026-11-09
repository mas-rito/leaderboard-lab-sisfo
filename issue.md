# [ISSUE / PLAN] Nomor WhatsApp Player & Countdown Dinamis

> **Status:** Rencana implementasi (belum dikerjakan)
>
> **Basis kode:** branch `feature/filter-harian`, commit `bea5250`
>
> **Dokumen ini menggantikan** `issue.md` sebelumnya (rencana dashboard tanpa timer, filter harian, dan redesign leaderboard). Rencana lama sudah diimplementasikan dan tetap tersimpan di riwayat Git.
>
> **Target pembaca:** junior programmer atau AI coding model dengan konteks terbatas.
>
> **Penting:** dokumen ini hanya rencana. Jangan mengubah kode aplikasi sebelum rencana disetujui.

## Cara memakai dokumen ini

1. Baca Bagian 1–5 untuk memahami perubahan perilaku dan keputusan desain.
2. Implementasikan file sesuai urutan di Bagian 8.
3. Jangan menampilkan nomor WhatsApp di halaman `/leaderboard`.
4. Jangan mengubah aturan ranking yang sudah ada.
5. Jalankan pengujian di Bagian 9 dan cocokkan dengan Acceptance Criteria di Bagian 10.

---

## 1. Ringkasan Perubahan

Ada dua fitur utama dan satu klarifikasi aturan ranking.

### 1.1 Nomor WhatsApp player

- Form di halaman player `/play` mendapat field baru: **Nomor WhatsApp Aktif**.
- Nomor disimpan bersama data peserta.
- Nomor **tidak pernah ditampilkan di `/leaderboard`**.
- Nomor hanya ditampilkan di `/dashboard` agar admin dapat menghubungi peserta.
- Nomor dinormalisasi ke format `628xxxxxxxxx` agar bisa langsung dipakai untuk tautan `https://wa.me/...`.
- Data lama yang belum punya nomor tetap aman; dashboard menampilkan “belum ada nomor WA” dan admin dapat melengkapinya lewat form edit.

### 1.2 Durasi countdown dapat diubah dari dashboard

- Saat ini durasi countdown di `/play` di-hardcode 300 detik (5 menit).
- Setelah perubahan, durasi countdown menjadi **pengaturan global** yang disimpan di database.
- Dashboard mendapat panel **Pengaturan Countdown** dengan input detik dan tombol **Simpan Countdown**.
- Setelah tombol simpan ditekan, nilai baru langsung tersimpan di server.
- `/play` mengambil nilai terbaru dari server:
  - saat halaman dibuka,
  - saat tab kembali aktif,
  - setiap 10 detik selama masih di form,
  - sekali lagi tepat sebelum tombol **Mulai** ditekan.
- Teks tombol di `/play` berubah dari **“Mulai (5 Menit)”** menjadi **“Mulai”**.
- Teks “Waktu bermain maksimal 5 menit” dihapus dari `/play`.
- Sesi yang sedang berjalan memakai **snapshot** durasi saat sesi dimulai. Jika admin mengubah countdown di tengah sesi, sesi yang sedang berjalan tidak ikut berubah.

### 1.3 Tie-breaker untuk level yang sama

Aturan ranking tetap sama:

1. **Level tertinggi** menang.
2. Jika level sama, **durasi bermain tercepat** menang.
3. Jika level dan durasi sama, **waktu input paling awal** menang.

Perubahan countdown global **tidak mengubah aturan ini**. Dua peserta dengan level sama tetap dibandingkan berdasarkan `duration_seconds` (waktu bermain aktual), lalu `created_at`.

Contoh:

- Peserta A level 20 selesai dalam 120 detik.
- Peserta B level 20 selesai dalam 90 detik.
- Maka B berada di atas A.

Jika keduanya timeout di level yang sama, `duration_seconds` sama dengan countdown sesi masing-masing, lalu `created_at` menentukan urutan.

> **Asumsi produk:** yang dimaksud “player yang memiliki level yang sama di score akhirnya” adalah tie-breaker yang sudah ada. Dokumen ini mempertahankan perilaku tersebut. Jika yang diinginkan adalah aturan lain (misalnya level sama mendapat peringkat sama), itu perubahan produk terpisah dan tidak termasuk dalam rencana ini.

### 1.4 Yang tidak berubah

- Halaman `/leaderboard` tidak menampilkan WhatsApp dan tidak menampilkan durasi.
- Filter Hari Ini / Kemarin / Semua tetap berjalan.
- Podium dan tampilan leaderboard tetap.
- Struktur `id`, `name`, `origin`, `level`, `duration_seconds`, `created_at` tetap.
- API leaderboard tetap memakai urutan `level DESC, duration_seconds ASC, created_at ASC`.
- Autentikasi admin tidak ditambahkan.
- Tidak ada library baru.
- Tidak ada penghapusan data lama.

---

## 2. Kondisi Project Saat Ini

### 2.1 Skema database

Tabel `leaderboard_entries` saat ini memiliki kolom:

```sql
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
origin TEXT NOT NULL DEFAULT '',
level INTEGER NOT NULL CHECK (level >= 1),
duration_seconds INTEGER NOT NULL DEFAULT 0
  CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
```

Belum ada kolom `whatsapp`. Belum ada tabel pengaturan.

### 2.2 API leaderboard (`app/api/leaderboard/route.js`)

- `getSql()` dan `ensureSchema()` masih didefinisikan langsung di file route.
- `ensureSchema()` membuat tabel, menambahkan kolom lama, dan membuat index.
- `GET` menerima `?date=YYYY-MM-DD`.
- `POST`, `PUT`, dan `DELETE` mengembalikan `{ entries, entry }`.
- `mapEntries()` belum mengirim `whatsapp`.
- Validasi entri dilakukan oleh `parseEntry()` di `lib/leaderboard.js`.

### 2.3 Halaman player (`app/play/page.js`)

- Form awal berisi Nama dan Asal Sekolah/Jurusan.
- Countdown memakai konstanta `TOTAL_COUNTDOWN_SECONDS` dari `lib/session.js`, nilainya 300 detik.
- Tombol form berbunyi `Mulai (5 Menit)`.
- Catatan form berbunyi “Waktu bermain maksimal 5 menit.”
- Sesi aktif disimpan di `localStorage` dengan `SESSION_STORAGE_KEY`.
- Setelah selesai, pemain mengisi level lalu menyimpan ke leaderboard.
- Belum ada input WhatsApp.

### 2.4 Helper sesi (`lib/session.js`)

- `TOTAL_COUNTDOWN_SECONDS = 300`.
- `getElapsedSeconds()` dan `getRemainingSeconds()` selalu menjepit di 300 detik.
- `parseStoredSession()` memvalidasi `name`, `origin`, `startTime`, dan `finishedAt`.

### 2.5 Dashboard (`app/dashboard/page.js`)

- Sudah tanpa timer.
- Form tambah/edit berisi Nama, Asal, Level, dan Durasi (detik).
- Durasi manual dibatasi 0–300 dan dipakai untuk tie-breaker.
- Belum ada input WhatsApp.
- Belum ada pengaturan countdown.
- Catatan admin masih menyebut “Timer 5 menit”.

### 2.6 Leaderboard (`app/leaderboard/page.js`)

- Hanya menampilkan peringkat, nama, asal, dan level.
- Tidak menampilkan durasi.
- Tidak boleh menampilkan WhatsApp.

### 2.7 Tipe data (`types/leaderboard.ts`)

```ts
export interface LeaderboardEntry {
  id: string;
  name: string;
  origin: string;
  level: number;
  duration_seconds: number;
  created_at?: string;
}
```

Belum ada `whatsapp`.

### 2.8 CSS (`app/globals.css`)

Sudah tersedia:

- `.card`, `.form-group`, `.form-grid`, `.help-text`, `.action-row`
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`
- `.board-list`, `.board-row`, `.player-meta`, `.player-origin`, `.score-badge`
- seluruh style `.lb-*` untuk leaderboard
- `.timer-*` untuk halaman `/play`

Style baru yang diperlukan hanya untuk panel pengaturan countdown dan tampilan tautan WhatsApp di dashboard.

---

## 3. Tujuan & Non-Tujuan

### Tujuan

- Pemain memberikan nomor WhatsApp aktif saat mengisi identitas.
- Admin dapat melihat dan menghubungi nomor WhatsApp dari dashboard.
- Nomor WhatsApp tidak terlihat di leaderboard.
- Admin dapat mengubah durasi countdown tanpa mengubah kode.
- `/play` selalu memakai durasi countdown terbaru dari server.
- Sesi yang sedang berjalan tidak terpengaruh perubahan setting.
- Teks “5 Menit” di `/play` dihapus; tombol cukup “Mulai”.
- Aturan tie-breaker level sama tetap jelas dan tidak berubah.
- Data lama tetap dapat dibaca dan diedit.

### Non-Tujuan

- Menambah autentikasi atau otorisasi admin.
- Menampilkan WhatsApp di leaderboard.
- Mengirim pesan WhatsApp otomatis.
- Mengubah aturan ranking.
- Membuat countdown per pemain atau per sesi dari dashboard.
- Menambah library UI, state management, atau websocket.
- Mengubah desain leaderboard.
- Menghapus data lama.

---

## 4. Keputusan Desain

### 4.1 WhatsApp disimpan dalam format ternormalisasi

Nomor disimpan sebagai `628xxxxxxxxx` tanpa spasi, tanda hubung, kurung, atau tanda `+`.

Alasan:

- Konsisten untuk pencarian dan tampilan.
- Langsung bisa dipakai di `https://wa.me/628xxxxxxxxx`.
- Menghindari duplikasi format `08...`, `+62...`, dan `628...`.

Helper yang dipakai:

```js
normalizeWhatsApp("0812-3456-7890")       // "6281234567890"
normalizeWhatsApp("+62 812 3456 7890")    // "6281234567890"
normalizeWhatsApp("6281234567890")        // "6281234567890"
normalizeWhatsApp("81234567890")          // "6281234567890"
```

Validasi memakai pola nomor seluler Indonesia:

```js
/^628\d{7,11}$/
```

Artinya setelah `628` harus ada 7–11 digit. Nomor rumah `021...` dan nomor terlalu pendek ditolak.

### 4.2 WhatsApp wajib untuk entri baru

- Form `/play` dan form dashboard menandai input WhatsApp sebagai `required`.
- `parseEntry()` menolak entri baru tanpa WhatsApp yang valid.
- Data lama di database boleh memiliki `whatsapp = ''` karena migrasi.
- Saat admin mengedit data lama, form akan meminta nomor WhatsApp sebelum bisa menyimpan.
- Dashboard menampilkan “Belum ada nomor WA” untuk data lama.

### 4.3 WhatsApp hanya dikirim ke dashboard

- `GET /api/leaderboard` **tidak** menyertakan `whatsapp` secara default.
- `GET /api/leaderboard?include_whatsapp=1` menyertakan `whatsapp`.
- Dashboard memakai parameter tersebut.
- Leaderboard memanggil endpoint tanpa parameter, sehingga field tidak pernah masuk ke state halaman publik.
- `POST`/`PUT` tetap mengembalikan `entry` yang baru disimpan, termasuk WhatsApp, karena hanya dikirim ke pemanggil yang memang mengirim data itu.
- Ini bukan kontrol akses keamanan. Tanpa autentikasi, siapa pun yang memanggil API dengan parameter bisa melihatnya. Untuk kebutuhan stand, pemisahan ini cukup agar UI publik bersih. Autentikasi admin dicatat sebagai risiko, bukan scope.

### 4.4 Countdown disimpan di tabel `app_settings`

Tabel key-value sederhana:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Nilai awal:

```sql
INSERT INTO app_settings (key, value)
VALUES ('countdown_seconds', '300')
ON CONFLICT (key) DO NOTHING;
```

Alasan memakai tabel pengaturan, bukan kolom di `leaderboard_entries`:

- Countdown adalah pengaturan global, bukan properti satu peserta.
- Tidak perlu menduplikasi nilai di setiap baris.
- Mudah menambah setting lain di masa depan.

### 4.5 Batas countdown 30–3600 detik

- Default: **300 detik**.
- Minimum: **30 detik**.
- Maksimum: **3600 detik (60 menit)**.
- Nilai harus bilangan bulat.
- UI dashboard menampilkan preview `MM:SS`.

Konsekuensi: kolom `duration_seconds` harus bisa menampung sesi yang lebih dari 300 detik. Karena itu batas `CHECK` lama (`<= 300`) diganti menjadi `<= 3600`.

### 4.6 `/play` mengambil setting secara dinamis

`/play` tidak boleh mengimpor angka 300 sebagai satu-satunya sumber kebenaran.

Alur:

1. Saat form tampil, ambil `GET /api/settings`.
2. Simpan hasilnya di state `countdownSeconds`.
3. Selama masih di form, ulangi pengambilan setiap 10 detik dan saat tab kembali aktif.
4. Sebelum sesi dimulai, ambil sekali lagi agar nilai paling baru dipakai.
5. Saat sesi dimulai, simpan nilai tersebut sebagai `sessionCountdown` dan ke `localStorage`.

Dengan begitu, perubahan dari dashboard langsung tersimpan di server dan `/play` memakainya paling lambat pada pengecekan berikutnya, atau tepat saat tombol **Mulai** ditekan.

### 4.7 Sesi berjalan memakai snapshot countdown

- `sessionCountdown` disimpan di state dan `localStorage` saat sesi dimulai.
- Tick countdown dan perhitungan selesai memakai `sessionCountdown`, bukan nilai global terbaru.
- Jika admin mengubah setting dari 60 detik ke 120 detik saat sesi berjalan, sesi tetap selesai di 60 detik.
- Setelah sesi selesai dan pemain memulai sesi baru, nilai global terbaru dipakai.

### 4.8 Countdown tidak mengubah tie-breaker

- `duration_seconds` tetap diisi waktu bermain aktual.
- Urutan tetap `level DESC, duration_seconds ASC, created_at ASC`.
- Panel pengaturan countdown di dashboard diberi catatan: “Tidak mengubah aturan tie-breaker.”
- Test tie-breaker yang sudah ada tetap dipertahankan dan ditambah kasus level sama.

### 4.9 Data lama tetap kompatibel

- Kolom baru `whatsapp` memakai `DEFAULT ''`, sehingga baris lama tidak error.
- Tabel `app_settings` dibuat jika belum ada.
- Constraint durasi diganti tanpa menghapus data.
- Sesi `localStorage` lama yang tidak memiliki `whatsapp` dianggap tidak valid dan dikembalikan ke form. Ini disengaja karena nomor WhatsApp wajib untuk menyimpan entri baru. Sesi lama yang belum selesai akan hilang saat refresh setelah deploy; risikonya kecil dan dicatat di Bagian 12.

---

## 5. Alur

### 5.1 Halaman player `/play`

```
Buka /play
   │
   ├─ Form tampil
   │     ├─ GET /api/settings → countdownSeconds
   │     ├─ isi Nama, Asal, Nomor WhatsApp
   │     └─ tombol "Mulai" (tanpa teks 5 menit)
   │
   ├─ Tekan "Mulai"
   │     ├─ validasi Nama, Asal, WhatsApp
   │     ├─ GET /api/settings sekali lagi (nilai terbaru)
   │     ├─ simpan sesi ke localStorage:
   │     │    name, origin, whatsapp, startTime,
   │     │    countdownSeconds, finishedAt: null
   │     └─ phase = running
   │
   ├─ Timer berjalan
   │     ├─ hitung sisa dari startTime + sessionCountdown
   │     ├─ perubahan setting global TIDAK memengaruhi sesi ini
   │     └─ jika habis → phase = finished
   │
   ├─ phase = finished
   │     ├─ isi Level
   │     └─ POST /api/leaderboard (termasuk whatsapp)
   │
   └─ phase = saved
         └─ tampilkan level, waktu, peringkat
```

### 5.2 Dashboard admin

```
Buka /dashboard
   │
   ├─ GET /api/leaderboard?date=...&include_whatsapp=1
   │     └─ daftar peserta + nomor WA
   │
   ├─ GET /api/settings
   │     └─ tampilkan countdown saat ini
   │
   ├─ Form tambah/edit peserta
   │     ├─ Nama, Asal, WhatsApp, Level, Durasi
   │     ├─ POST /api/leaderboard
   │     └─ PUT /api/leaderboard
   │
   ├─ Panel Pengaturan Countdown
   │     ├─ input detik 30–3600
   │     └─ PUT /api/settings
   │           └─ nilai langsung tersimpan untuk /play berikutnya
   │
   └─ Klik nomor WA
         └─ buka https://wa.me/628xxxxxxxxx
```

### 5.3 API

```
GET /api/settings
  → { "countdown_seconds": 300 }

PUT /api/settings
  body: { "countdown_seconds": 120 }
  → { "countdown_seconds": 120 }
  → 400 jika bukan bilangan bulat 30–3600

GET /api/leaderboard?date=2026-11-08
  → entries tanpa field whatsapp

GET /api/leaderboard?date=2026-11-08&include_whatsapp=1
  → entries dengan field whatsapp (dipakai dashboard)

POST /api/leaderboard
  body: { name, origin, whatsapp, level, duration_seconds }
  → 201 { entries, entry }

PUT /api/leaderboard
  body: { id, name, origin, whatsapp, level, duration_seconds }
  → { entries, entry }
```

---

## 6. Rencana Perubahan File

| File | Aksi | Keterangan |
| :--- | :---: | :--- |
| `lib/whatsapp.js` | **Baru** | Normalisasi, validasi, format tampilan, dan link `wa.me`. |
| `lib/whatsapp.test.mjs` | **Baru** | Unit test helper WhatsApp. |
| `lib/settings.js` | **Baru** | Konstanta countdown, validasi, loader, dan penyimpan setting. |
| `lib/settings.test.mjs` | **Baru** | Unit test validasi countdown. |
| `lib/db.js` | **Baru** | `getSql()`, `ensureSchema()`, migrasi kolom, tabel settings, dan index. |
| `app/api/settings/route.js` | **Baru** | `GET` dan `PUT` pengaturan countdown. |
| `lib/leaderboard.js` | **Ubah** | Tambah WhatsApp pada `parseEntry`, `saveEntry`, `updateEntry`, `applyUpdate`; `loadEntries` mendukung `includeWhatsApp`. |
| `lib/session.js` | **Ubah** | Countdown tidak lagi hardcoded; simpan WhatsApp dan snapshot countdown. |
| `lib/session.test.mjs` | **Ubah** | Test limit countdown dinamis dan data sesi baru. |
| `lib/leaderboard.test.mjs` | **Ubah** | Test WhatsApp wajib/valid, batas durasi 3600, tie-breaker level sama. |
| `app/api/leaderboard/route.js` | **Ubah** | Pakai `lib/db.js`; dukung `include_whatsapp=1`; kirim `whatsapp`. |
| `app/play/page.js` | **Ubah** | Input WhatsApp; setting countdown dinamis; tombol “Mulai”; snapshot sesi. |
| `app/dashboard/page.js` | **Ubah** | Input/kolom WhatsApp; panel pengaturan countdown; catatan admin dinamis. |
| `app/globals.css` | **Tambah** | Style panel countdown dan tautan WhatsApp dashboard. |
| `types/leaderboard.ts` | **Ubah** | Tambah `whatsapp` pada tipe entri dan input. |
| `package.json` | **Ubah** | Script test menjalankan test WhatsApp dan settings. |
| `app/leaderboard/page.js` | Tidak diubah | Tidak boleh menampilkan WhatsApp. |
| `app/layout.js` | Tidak diubah | Container tetap. |
| `app/page.js` | Tidak diubah | Tetap redirect ke leaderboard. |

---

## 7. Implementasi Detail

### 7.1 File baru: `lib/whatsapp.js`

```js
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
```

Catatan:

- Hanya spasi, titik, kurung, dan tanda hubung yang dibuang. Huruf atau karakter lain akan membuat validasi gagal.
- Nomor yang sudah `62...` tidak diubah.
- Nomor yang diawali `0` atau `8` diubah ke `62...`.
- Nomor kosong menghasilkan string kosong dan dianggap tidak valid.

### 7.2 File baru: `lib/whatsapp.test.mjs`

```js
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
```

### 7.3 File baru: `lib/settings.js`

```js
export const DEFAULT_COUNTDOWN_SECONDS = 300;
export const MIN_COUNTDOWN_SECONDS = 30;
export const MAX_COUNTDOWN_SECONDS = 3600;
export const SETTINGS_REFRESH_MS = 10_000;

export function parseCountdownSeconds(input) {
  const value = Number(input);

  if (!Number.isInteger(value)) {
    return { error: "Durasi countdown harus berupa angka bulat (detik)." };
  }
  if (value < MIN_COUNTDOWN_SECONDS || value > MAX_COUNTDOWN_SECONDS) {
    return {
      error: `Durasi countdown harus antara ${MIN_COUNTDOWN_SECONDS} dan ${MAX_COUNTDOWN_SECONDS} detik.`,
    };
  }

  return { value };
}

export async function loadCountdownSeconds(
  fallback = DEFAULT_COUNTDOWN_SECONDS
) {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return fallback;

    const data = await res.json();
    const parsed = parseCountdownSeconds(data?.countdown_seconds);
    return parsed.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function saveCountdownSeconds(input) {
  const parsed = parseCountdownSeconds(input);
  if (parsed.error) return parsed;

  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countdown_seconds: parsed.value }),
  });

  return res.json();
}
```

Catatan:

- `loadCountdownSeconds()` selalu mengembalikan angka yang aman. Jika API gagal, dipakai nilai `fallback` (default 300 detik).
- Di `/play`, `fallback` diisi nilai countdown yang sudah diketahui agar gangguan jaringan sesaat tidak menurunkan durasi ke 300 detik.
- `saveCountdownSeconds()` mengembalikan `{ error }` atau respons API `{ countdown_seconds }`.

### 7.4 File baru: `lib/settings.test.mjs`

```js
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
```

### 7.5 File baru: `lib/db.js`

Pindahkan `getSql()` dan `ensureSchema()` dari `app/api/leaderboard/route.js` agar bisa dipakai bersama oleh route leaderboard dan route settings.

```js
import { neon } from "@neondatabase/serverless";
import { parseEnv } from "@neon/env";
import neonConfig from "../neon.ts";
import { INITIAL_ENTRIES } from "./leaderboard.js";
import { DEFAULT_COUNTDOWN_SECONDS } from "./settings.js";

export function getSql(unpooled = false) {
  const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
  const url =
    (unpooled && process.env.DATABASE_URL_UNPOOLED) || postgres.databaseUrl;
  return neon(url);
}

let schemaPromise = null;

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql(true);

      const [{ exists }] = await sql`
        SELECT to_regclass('public.leaderboard_entries') IS NOT NULL AS exists
      `;

      if (!exists) {
        await sql`
          CREATE TABLE IF NOT EXISTS leaderboard_entries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            origin TEXT NOT NULL DEFAULT '',
            whatsapp TEXT NOT NULL DEFAULT '',
            level INTEGER NOT NULL CHECK (level >= 1),
            duration_seconds INTEGER NOT NULL DEFAULT 0
              CHECK (duration_seconds >= 0 AND duration_seconds <= 3600),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;

        for (const item of INITIAL_ENTRIES) {
          await sql`
            INSERT INTO leaderboard_entries (
              id, name, origin, whatsapp, level, duration_seconds, created_at
            )
            VALUES (
              ${item.id},
              ${item.name},
              ${item.origin},
              ${item.whatsapp ?? ""},
              ${item.level},
              ${item.duration_seconds},
              ${item.created_at}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }
      } else {
        await sql`
          ALTER TABLE leaderboard_entries
          ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        `;

        // Hapus constraint lama (maksimal 300 detik) lalu pasang batas baru.
        // DO block + EXCEPTION membuat migrasi aman jika dua instance
        // serverless menjalankannya hampir bersamaan.
        await sql`
          DO $$
          BEGIN
            ALTER TABLE leaderboard_entries
              DROP CONSTRAINT IF EXISTS leaderboard_entries_duration_seconds_check;
            ALTER TABLE leaderboard_entries
              DROP CONSTRAINT IF EXISTS leaderboard_entries_duration_seconds_max_check;
            ALTER TABLE leaderboard_entries
              ADD CONSTRAINT leaderboard_entries_duration_seconds_max_check
              CHECK (duration_seconds >= 0 AND duration_seconds <= 3600);
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `;
      }

      await sql`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        INSERT INTO app_settings (key, value)
        VALUES ('countdown_seconds', ${String(DEFAULT_COUNTDOWN_SECONDS)})
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_tie_breaker
        ON leaderboard_entries (level DESC, duration_seconds ASC, created_at ASC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at
        ON leaderboard_entries (created_at)
      `;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }

  return schemaPromise;
}
```

Catatan migrasi:

- `ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT ''` aman untuk data lama.
- Constraint lama bernama default `leaderboard_entries_duration_seconds_check` karena dibuat inline pada `CREATE TABLE`/`ADD COLUMN`.
- Jika constraint lama tidak ada, `DROP CONSTRAINT IF EXISTS` tidak error.
- Constraint baru diberi nama eksplisit agar mudah dicari.
- `DO $$ ... EXCEPTION WHEN duplicate_object` mencegah error jika dua instance serverless menjalankan migrasi hampir bersamaan.
- `ensureSchema()` hanya dijalankan sekali per proses (module cache), sama seperti perilaku saat ini.

### 7.6 File baru: `app/api/settings/route.js`

```js
import { ensureSchema, getSql } from "../../../lib/db.js";
import {
  DEFAULT_COUNTDOWN_SECONDS,
  parseCountdownSeconds,
} from "../../../lib/settings.js";

export async function GET() {
  await ensureSchema();

  const sql = getSql();
  const rows = await sql`
    SELECT value
    FROM app_settings
    WHERE key = 'countdown_seconds'
    LIMIT 1
  `;

  const parsed = parseCountdownSeconds(rows[0]?.value);
  const countdownSeconds = parsed.value ?? DEFAULT_COUNTDOWN_SECONDS;

  return Response.json(
    { countdown_seconds: countdownSeconds },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(request) {
  await ensureSchema();

  const body = await request.json();
  const parsed = parseCountdownSeconds(body?.countdown_seconds);

  if (parsed.error) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('countdown_seconds', ${String(parsed.value)}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
  `;

  return Response.json(
    { countdown_seconds: parsed.value },
    { headers: { "Cache-Control": "no-store" } }
  );
}
```

Catatan Next.js:

- Route Handler `GET` tidak di-cache secara default pada versi Next.js project ini.
- Header `Cache-Control: no-store` ditambahkan sebagai pengaman agar browser/proxy tidak menyimpan nilai lama.
- `PUT` tidak di-cache.

### 7.7 Ubah `lib/leaderboard.js`

#### 7.7.1 Import helper baru

```js
import { isValidWhatsApp, normalizeWhatsApp } from "./whatsapp.js";
import { MAX_COUNTDOWN_SECONDS } from "./settings.js";
```

#### 7.7.2 Tambah `whatsapp` ke `INITIAL_ENTRIES`

```js
export const INITIAL_ENTRIES = [
  { id: "1", name: "Raka", origin: "SMKN 1 Surabaya", whatsapp: "", level: 42, duration_seconds: 145, created_at: "2026-11-01T10:00:00Z" },
  // ... entri lain mengikuti pola yang sama
];
```

#### 7.7.3 Ubah `parseEntry`

```js
export function parseEntry(
  name,
  origin,
  levelInput,
  durationInput,
  id,
  createdAt,
  whatsappInput
) {
  const cleanName = String(name ?? "").trim();
  const cleanOrigin = String(origin ?? "").trim();
  const whatsapp = normalizeWhatsApp(whatsappInput);
  const level = Number(levelInput);
  const duration = Number(durationInput ?? 0);

  if (!cleanName) return { error: "Nama peserta wajib diisi." };
  if (!cleanOrigin) return { error: "Asal (Sekolah/Jurusan) wajib diisi." };
  if (!isValidWhatsApp(whatsapp)) {
    return {
      error:
        "Nomor WhatsApp wajib diisi dengan format yang valid (contoh: 081234567890).",
    };
  }
  if (!Number.isFinite(level) || !Number.isInteger(level) || level < 1) {
    return { error: "Level harus berupa angka bulat minimal 1." };
  }
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > MAX_COUNTDOWN_SECONDS
  ) {
    return {
      error: `Durasi permainan harus antara 0 hingga ${MAX_COUNTDOWN_SECONDS} detik.`,
    };
  }

  return {
    entry: {
      id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      origin: cleanOrigin,
      whatsapp,
      level,
      duration_seconds: Math.floor(duration),
      created_at: createdAt ?? new Date().toISOString(),
    },
  };
}
```

#### 7.7.4 Ubah `applyUpdate`

```js
export function applyUpdate(
  entries,
  id,
  name,
  origin,
  levelInput,
  durationInput,
  whatsappInput
) {
  const existing = entries.find((item) => item.id === id);
  if (!existing) return { error: "Data tidak ditemukan." };

  const result = parseEntry(
    name,
    origin,
    levelInput,
    durationInput,
    id,
    existing.created_at,
    whatsappInput
  );
  if (result.error) return result;

  const next = sortLeaderboard(
    entries.map((item) =>
      item.id === id ? { ...item, ...result.entry } : item
    )
  );

  return { entries: next, entry: result.entry };
}
```

Perubahan `existing.created_at` memastikan edit tidak mengubah waktu input asli. Ini penting karena `created_at` adalah tie-breaker terakhir untuk level dan durasi yang sama.

#### 7.7.5 Ubah `loadEntries`

```js
export async function loadEntries(dateKey, { includeWhatsApp = false } = {}) {
  const params = new URLSearchParams();

  if (dateKey) params.set("date", dateKey);
  if (includeWhatsApp) params.set("include_whatsapp", "1");

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}
```

#### 7.7.6 Ubah `saveEntry` dan `updateEntry`

```js
export async function saveEntry(
  name,
  origin,
  levelInput,
  durationInput,
  whatsappInput
) {
  const result = parseEntry(
    name,
    origin,
    levelInput,
    durationInput,
    undefined,
    undefined,
    whatsappInput
  );
  if (result.error) return result;

  const res = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: result.entry.name,
      origin: result.entry.origin,
      whatsapp: result.entry.whatsapp,
      level: result.entry.level,
      duration_seconds: result.entry.duration_seconds,
    }),
  });

  return res.json();
}

export async function updateEntry(
  id,
  name,
  origin,
  levelInput,
  durationInput,
  whatsappInput
) {
  const result = parseEntry(
    name,
    origin,
    levelInput,
    durationInput,
    id,
    undefined,
    whatsappInput
  );
  if (result.error) return result;

  const res = await fetch("/api/leaderboard", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      name: result.entry.name,
      origin: result.entry.origin,
      whatsapp: result.entry.whatsapp,
      level: result.entry.level,
      duration_seconds: result.entry.duration_seconds,
    }),
  });

  return res.json();
}
```

### 7.8 Ubah `lib/session.js`

```js
import {
  DEFAULT_COUNTDOWN_SECONDS,
  MAX_COUNTDOWN_SECONDS,
  MIN_COUNTDOWN_SECONDS,
} from "./settings.js";
import { isValidWhatsApp, normalizeWhatsApp } from "./whatsapp.js";

export const SESSION_STORAGE_KEY = "lab-sisfo:active-session";

export function getElapsedSeconds(
  startTime,
  now = Date.now(),
  limitSeconds = DEFAULT_COUNTDOWN_SECONDS
) {
  const started = Number(startTime);
  if (!Number.isFinite(started) || started <= 0) return 0;

  const elapsed = Math.floor((Number(now) - started) / 1000);
  return Math.min(Math.max(elapsed, 0), limitSeconds);
}

export function getRemainingSeconds(
  startTime,
  now = Date.now(),
  limitSeconds = DEFAULT_COUNTDOWN_SECONDS
) {
  return Math.max(0, limitSeconds - getElapsedSeconds(startTime, now, limitSeconds));
}

export function parseStoredSession(raw) {
  if (!raw) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const name = String(data?.name ?? "").trim();
  const origin = String(data?.origin ?? "").trim();
  const whatsapp = normalizeWhatsApp(data?.whatsapp);
  const startTime = Number(data?.startTime);

  if (!name || !origin) return null;
  if (!isValidWhatsApp(whatsapp)) return null;
  if (!Number.isFinite(startTime) || startTime <= 0) return null;

  const rawLimit = Number(data?.countdownSeconds);
  const countdownSeconds =
    Number.isInteger(rawLimit) &&
    rawLimit >= MIN_COUNTDOWN_SECONDS &&
    rawLimit <= MAX_COUNTDOWN_SECONDS
      ? rawLimit
      : DEFAULT_COUNTDOWN_SECONDS;

  const finishedAtRaw = Number(data?.finishedAt);
  const finishedAt =
    Number.isFinite(finishedAtRaw) && finishedAtRaw > 0 ? finishedAtRaw : null;

  return { name, origin, whatsapp, startTime, countdownSeconds, finishedAt };
}
```

Catatan:

- `TOTAL_COUNTDOWN_SECONDS` dihapus. Semua pemakai diganti `DEFAULT_COUNTDOWN_SECONDS` atau nilai dari setting.
- `getElapsedSeconds()` menerima parameter ketiga `limitSeconds` agar test dan sesi bisa memakai durasi selain 300.
- `parseStoredSession()` mengembalikan `null` untuk sesi lama yang tidak punya WhatsApp valid. Ini disengaja.

### 7.9 Ubah `lib/session.test.mjs`

Tambahkan/ubah test:

```js
import {
  getElapsedSeconds,
  getRemainingSeconds,
  parseStoredSession,
} from "./session.js";
import { DEFAULT_COUNTDOWN_SECONDS } from "./settings.js";

const START = 1_700_000_000_000;

test("getElapsedSeconds menghormati limit countdown", () => {
  assert.equal(getElapsedSeconds(START, START + 5_000, 60), 5);
  assert.equal(getElapsedSeconds(START, START + 60_000, 60), 60);
  assert.equal(getElapsedSeconds(START, START + 999_000, 60), 60);
  assert.equal(getElapsedSeconds(START, START + 999_000), 300);
});

test("getRemainingSeconds memakai limit yang diberikan", () => {
  assert.equal(getRemainingSeconds(START, START, 60), 60);
  assert.equal(getRemainingSeconds(START, START + 30_000, 60), 30);
  assert.equal(getRemainingSeconds(START, START + 60_000, 60), 0);
  assert.equal(
    getRemainingSeconds(START, START, DEFAULT_COUNTDOWN_SECONDS),
    DEFAULT_COUNTDOWN_SECONDS
  );
});

test("parseStoredSession menyimpan WhatsApp dan snapshot countdown", () => {
  const stored = parseStoredSession(
    JSON.stringify({
      name: "  Budi  ",
      origin: "  SMA 1  ",
      whatsapp: "0812-3456-7890",
      startTime: START,
      countdownSeconds: 120,
      finishedAt: null,
    })
  );

  assert.deepEqual(stored, {
    name: "Budi",
    origin: "SMA 1",
    whatsapp: "6281234567890",
    startTime: START,
    countdownSeconds: 120,
    finishedAt: null,
  });
});

test("parseStoredSession menolak sesi tanpa WhatsApp valid", () => {
  assert.equal(
    parseStoredSession(
      JSON.stringify({ name: "Budi", origin: "SMA 1", startTime: START })
    ),
    null
  );
});
```

### 7.10 Ubah `app/api/leaderboard/route.js`

#### 7.10.1 Ganti import dan hapus kode DB lokal

Di atas file:

```js
import { INITIAL_ENTRIES, parseEntry } from "../../../lib/leaderboard.js";
import { ensureSchema, getSql } from "../../../lib/db.js";
import { getDayRange, isValidDateKey } from "../../../lib/date.js";
```

Hapus:

- import `neon`
- import `parseEnv`
- import `neonConfig`
- fungsi `getSql`
- variabel `schemaPromise`
- fungsi `ensureSchema`

`INITIAL_ENTRIES` hanya diperlukan di `lib/db.js`, jadi di route ini bisa dihapus dari import jika tidak dipakai lagi.

#### 7.10.2 Ubah `mapEntries`

```js
function mapEntries(rows, includeWhatsApp = false) {
  return rows.map((row) => {
    const entry = {
      id: String(row.id),
      name: row.name,
      origin: row.origin || "-",
      level: Number(row.level),
      duration_seconds: Number(row.duration_seconds || 0),
      created_at: row.created_at
        ? new Date(row.created_at).toISOString()
        : null,
    };

    if (includeWhatsApp) {
      entry.whatsapp = row.whatsapp || "";
    }

    return entry;
  });
}
```

#### 7.10.3 Ubah `listEntries`

```js
async function listEntries(sql, dateKey, includeWhatsApp = false) {
  if (dateKey) {
    const { start, end } = getDayRange(dateKey);

    const rows = await sql`
      SELECT id, name, origin, whatsapp, level, duration_seconds, created_at
      FROM leaderboard_entries
      WHERE created_at >= ${start.toISOString()}::timestamptz
        AND created_at < ${end.toISOString()}::timestamptz
      ORDER BY level DESC, duration_seconds ASC, created_at ASC
      LIMIT 100
    `;

    return mapEntries(rows, includeWhatsApp);
  }

  const rows = await sql`
    SELECT id, name, origin, whatsapp, level, duration_seconds, created_at
    FROM leaderboard_entries
    ORDER BY level DESC, duration_seconds ASC, created_at ASC
    LIMIT 100
  `;

  return mapEntries(rows, includeWhatsApp);
}
```

#### 7.10.4 Ubah `GET`

```js
export async function GET(request) {
  await ensureSchema();

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const includeWhatsApp =
    url.searchParams.get("include_whatsapp") === "1";

  if (date && !isValidDateKey(date)) {
    return Response.json(
      { error: "Format tanggal harus YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const entries = await listEntries(getSql(), date, includeWhatsApp);
  return Response.json({ entries, date: date ?? null });
}
```

#### 7.10.5 Ubah `POST`

```js
export async function POST(request) {
  await ensureSchema();
  const body = await request.json();

  const result = parseEntry(
    body?.name,
    body?.origin,
    body?.level,
    body?.duration_seconds,
    undefined,
    undefined,
    body?.whatsapp
  );

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO leaderboard_entries (
      id, name, origin, whatsapp, level, duration_seconds, created_at
    )
    VALUES (
      ${result.entry.id},
      ${result.entry.name},
      ${result.entry.origin},
      ${result.entry.whatsapp},
      ${result.entry.level},
      ${result.entry.duration_seconds},
      ${result.entry.created_at}
    )
  `;

  const entries = await listEntries(sql);
  return Response.json({ entries, entry: result.entry }, { status: 201 });
}
```

#### 7.10.6 Ubah `PUT`

```js
export async function PUT(request) {
  await ensureSchema();
  const body = await request.json();

  const result = parseEntry(
    body?.name,
    body?.origin,
    body?.level,
    body?.duration_seconds,
    body?.id ? String(body.id) : undefined,
    undefined,
    body?.whatsapp
  );

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const sql = getSql();
  const updated = await sql`
    UPDATE leaderboard_entries
    SET
      name = ${result.entry.name},
      origin = ${result.entry.origin},
      whatsapp = ${result.entry.whatsapp},
      level = ${result.entry.level},
      duration_seconds = ${result.entry.duration_seconds}
    WHERE id = ${result.entry.id}
    RETURNING id
  `;

  if (updated.length === 0) {
    return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }

  const entries = await listEntries(sql);
  return Response.json({ entries, entry: result.entry });
}
```

`DELETE` tidak perlu diubah selain tetap memakai `ensureSchema`/`getSql` dari `lib/db.js`.

### 7.11 Ubah `app/play/page.js`

#### 7.11.1 Import

```js
import { formatDuration, saveEntry } from "../../lib/leaderboard";
import {
  DEFAULT_COUNTDOWN_SECONDS,
  SETTINGS_REFRESH_MS,
  loadCountdownSeconds,
} from "../../lib/settings";
import { isValidWhatsApp, normalizeWhatsApp } from "../../lib/whatsapp";
import {
  SESSION_STORAGE_KEY,
  getElapsedSeconds,
  getRemainingSeconds,
  parseStoredSession,
} from "../../lib/session";
```

#### 7.11.2 State baru

```js
const [whatsapp, setWhatsapp] = useState("");
const [countdownSeconds, setCountdownSeconds] = useState(
  DEFAULT_COUNTDOWN_SECONDS
);
const [sessionCountdown, setSessionCountdown] = useState(
  DEFAULT_COUNTDOWN_SECONDS
);
const [starting, setStarting] = useState(false);
```

Keterangan:

- `countdownSeconds`: nilai setting terbaru dari server.
- `sessionCountdown`: snapshot yang dipakai sesi aktif.
- `starting`: mencegah double submit saat mengambil setting sebelum mulai.

#### 7.11.3 Effect mengambil setting

Tambahkan effect yang hanya berjalan saat `phase === "form"`:

```js
useEffect(() => {
  if (phase !== "form") return;

  let active = true;

  async function refresh() {
    const value = await loadCountdownSeconds(countdownSeconds);
    if (active && value !== countdownSeconds) {
      setCountdownSeconds(value);
    }
  }

  refresh();
  const interval = setInterval(refresh, SETTINGS_REFRESH_MS);
  const onFocus = () => refresh();
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    active = false;
    clearInterval(interval);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}, [phase, countdownSeconds]);
```

#### 7.11.4 Pulihkan sesi

Di effect pemulihan:

```js
setName(stored.name);
setOrigin(stored.origin);
setWhatsapp(stored.whatsapp);
setStartTime(stored.startTime);
setSessionCountdown(stored.countdownSeconds);
setCountdownSeconds(stored.countdownSeconds);

if (stored.finishedAt) {
  setDurationSeconds(
    getElapsedSeconds(stored.startTime, stored.finishedAt, stored.countdownSeconds)
  );
  setRemainingSeconds(0);
  setPhase("finished");
} else {
  const elapsed = getElapsedSeconds(stored.startTime, Date.now(), stored.countdownSeconds);

  if (elapsed >= stored.countdownSeconds) {
    finishSession(
      stored.startTime,
      stored.startTime + stored.countdownSeconds * 1000,
      stored.countdownSeconds
    );
  } else {
    setRemainingSeconds(stored.countdownSeconds - elapsed);
    setPhase("running");
  }
}
```

#### 7.11.5 `finishSession` menerima limit

```js
const finishSession = useCallback(
  (
    startedAt,
    finishedAt = Date.now(),
    limitSeconds = DEFAULT_COUNTDOWN_SECONDS
  ) => {
    clearTimer();

    const elapsed = getElapsedSeconds(startedAt, finishedAt, limitSeconds);
    setDurationSeconds(elapsed);
    setRemainingSeconds(0);
    setPhase("finished");

    try {
      const stored = parseStoredSession(
        localStorage.getItem(SESSION_STORAGE_KEY)
      );
      if (stored) {
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            ...stored,
            finishedAt,
          })
        );
      }
    } catch {
      // localStorage tidak tersedia.
    }
  },
  [clearTimer]
);
```

Semua pemanggil harus mengirim limit secara eksplisit:

- restore sesi: `finishSession(stored.startTime, ..., stored.countdownSeconds)`
- tick countdown: `finishSession(startTime, ..., sessionCountdown)`
- tombol **Selesai & Input Level**: `finishSession(startTime, Date.now(), sessionCountdown)`

Dengan begitu `finishSession` tidak perlu bergantung pada `sessionCountdown` dan effect pemulihan tidak ikut berjalan ulang saat state berubah.

#### 7.11.6 Tick countdown memakai `sessionCountdown`

```js
useEffect(() => {
  if (phase !== "running" || !startTime) return;

  clearTimer();
  intervalRef.current = setInterval(() => {
    const left = getRemainingSeconds(
      startTime,
      Date.now(),
      sessionCountdown
    );

    if (left <= 0) {
      finishSession(
        startTime,
        startTime + sessionCountdown * 1000,
        sessionCountdown
      );
    } else {
      setRemainingSeconds(left);
    }
  }, 250);

  return clearTimer;
}, [phase, startTime, sessionCountdown, clearTimer, finishSession]);
```

#### 7.11.7 `handleStart` menjadi async

```js
async function handleStart(event) {
  event.preventDefault();
  setError("");

  const cleanName = name.trim();
  const cleanOrigin = origin.trim();
  const cleanWhatsapp = normalizeWhatsApp(whatsapp);

  if (!cleanName) {
    setError("Nama wajib diisi sebelum mulai.");
    return;
  }
  if (!cleanOrigin) {
    setError("Asal sekolah/jurusan wajib diisi sebelum mulai.");
    return;
  }
  if (!isValidWhatsApp(cleanWhatsapp)) {
    setError(
      "Nomor WhatsApp wajib diisi dengan format yang valid (contoh: 081234567890)."
    );
    return;
  }

  setStarting(true);
  let limit = countdownSeconds;

  try {
    limit = await loadCountdownSeconds(countdownSeconds);
    setCountdownSeconds(limit);
  } catch {
    // loadCountdownSeconds sudah punya fallback.
  } finally {
    setStarting(false);
  }

  const now = Date.now();
  setStartTime(now);
  setSessionCountdown(limit);
  setRemainingSeconds(limit);
  setDurationSeconds(0);
  setLevel("");
  setSavedInfo(null);
  setPhase("running");

  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        name: cleanName,
        origin: cleanOrigin,
        whatsapp: cleanWhatsapp,
        startTime: now,
        countdownSeconds: limit,
        finishedAt: null,
      })
    );
  } catch {
    // Abaikan jika localStorage diblokir.
  }
}
```

#### 7.11.8 `handleSubmit` mengirim WhatsApp

```js
const result = await saveEntry(
  name,
  origin,
  level,
  durationSeconds,
  whatsapp
);
```

#### 7.11.9 `handlePlayAgain` mereset WhatsApp dan snapshot

```js
setWhatsapp("");
setStartTime(null);
setDurationSeconds(0);
setSessionCountdown(countdownSeconds);
setRemainingSeconds(countdownSeconds);
```

#### 7.11.10 Form awal

```jsx
<p className="play-note">
  Isi nama, asal sekolah/jurusan, dan nomor WhatsApp aktif, lalu tekan Mulai.
</p>

<div className="form-group">
  <label htmlFor="player-name">Nama</label>
  <input
    id="player-name"
    type="text"
    placeholder="Contoh: Budi"
    value={name}
    onChange={(event) => setName(event.target.value)}
    maxLength={60}
    autoComplete="off"
    required
  />
</div>

<div className="form-group">
  <label htmlFor="player-origin">Asal Sekolah / Jurusan</label>
  <input
    id="player-origin"
    type="text"
    placeholder="Contoh: SMKN 1 Surabaya / Sistem Informasi"
    value={origin}
    onChange={(event) => setOrigin(event.target.value)}
    maxLength={100}
    autoComplete="off"
    required
  />
</div>

<div className="form-group">
  <label htmlFor="player-whatsapp">Nomor WhatsApp Aktif</label>
  <input
    id="player-whatsapp"
    type="tel"
    inputMode="tel"
    autoComplete="tel"
    placeholder="Contoh: 081234567890"
    value={whatsapp}
    onChange={(event) => setWhatsapp(event.target.value)}
    maxLength={20}
    required
  />
  <small className="help-text">
    Dipakai admin untuk menghubungi jika ada kendala. Tidak ditampilkan di
    leaderboard.
  </small>
</div>

<button
  type="submit"
  className="btn btn-primary btn-block"
  disabled={starting}
>
  {starting ? "Menyiapkan..." : "Mulai"}
</button>
```

#### 7.11.11 Teks lain

- Hapus semua text “5 menit” / “5 Menit” dari `/play`.
- Timer yang berjalan tetap menampilkan sisa waktu `MM:SS`, tetapi tidak menyebut durasi total.
- Form selesai dan halaman sukses tidak perlu menampilkan WhatsApp.

### 7.12 Ubah `app/dashboard/page.js`

#### 7.12.1 Import

```js
import {
  DEFAULT_COUNTDOWN_SECONDS,
  MAX_COUNTDOWN_SECONDS,
  MIN_COUNTDOWN_SECONDS,
  loadCountdownSeconds,
  parseCountdownSeconds,
  saveCountdownSeconds,
} from "../../lib/settings";
import {
  formatWhatsApp,
  getWhatsAppLink,
  normalizeWhatsApp,
} from "../../lib/whatsapp";
```

#### 7.12.2 State baru

Ganti konstanta `DEFAULT_DURATION_SECONDS = 300` dengan `DEFAULT_COUNTDOWN_SECONDS` dari `lib/settings.js`.

```js
const [whatsapp, setWhatsapp] = useState("");
const [durationSeconds, setDurationSeconds] = useState(
  DEFAULT_COUNTDOWN_SECONDS
);
const [countdownSeconds, setCountdownSeconds] = useState(
  DEFAULT_COUNTDOWN_SECONDS
);
const [countdownInput, setCountdownInput] = useState(
  String(DEFAULT_COUNTDOWN_SECONDS)
);
const [savingCountdown, setSavingCountdown] = useState(false);
const [countdownError, setCountdownError] = useState("");
const [countdownSuccess, setCountdownSuccess] = useState("");
```

#### 7.12.3 Muat setting

```js
useEffect(() => {
  let active = true;

  loadCountdownSeconds().then((value) => {
    if (!active) return;
    setCountdownSeconds(value);
    setCountdownInput(String(value));
    setDurationSeconds((current) =>
      current === DEFAULT_COUNTDOWN_SECONDS ? value : current
    );
  });

  return () => {
    active = false;
  };
}, []);
```

#### 7.12.4 Muat entries dengan WhatsApp

```js
loadEntries(getRelativeDayKey(selectedDay), { includeWhatsApp: true }).then(
  (data) => {
    if (!active) return;
    setEntries(data);
    setLoadingEntries(false);
  }
);
```

`refreshEntries()` juga memakai opsi yang sama:

```js
const data = await loadEntries(getRelativeDayKey(day), {
  includeWhatsApp: true,
});
```

#### 7.12.5 Reset dan edit

- `resetForm()` menambahkan `setWhatsapp("")` dan memakai countdown terbaru sebagai default durasi peserta:

  ```js
  setDurationSeconds(countdownSeconds);
  ```

- `handleEdit(item)` menambahkan `setWhatsapp(item.whatsapp || "")`.
- Input durasi peserta memakai `max={MAX_COUNTDOWN_SECONDS}`.
- `handleSubmit()` mengirim WhatsApp:

```js
const result = editingId
  ? await updateEntry(
      editingId,
      name,
      origin,
      level,
      durationSeconds,
      whatsapp
    )
  : await saveEntry(name, origin, level, durationSeconds, whatsapp);
```

#### 7.12.6 Handler simpan countdown

```js
async function handleSaveCountdown(event) {
  event.preventDefault();
  setCountdownError("");
  setCountdownSuccess("");

  const parsed = parseCountdownSeconds(countdownInput);
  if (parsed.error) {
    setCountdownError(parsed.error);
    return;
  }

  setSavingCountdown(true);
  try {
    const result = await saveCountdownSeconds(parsed.value);

    if (result?.error) {
      setCountdownError(result.error);
      return;
    }

    const next = Number(result.countdown_seconds);
    setCountdownSeconds(next);
    setCountdownInput(String(next));
    setCountdownSuccess(
      `Countdown diperbarui menjadi ${formatDuration(next)}. Sesi yang sedang berjalan di /play tidak berubah.`
    );
  } catch {
    setCountdownError("Gagal menyimpan countdown. Periksa koneksi lalu coba lagi.");
  } finally {
    setSavingCountdown(false);
  }
}
```

#### 7.12.7 Panel pengaturan countdown

Letakkan di atas form peserta atau di bawah catatan admin:

```jsx
<form className="card settings-card" onSubmit={handleSaveCountdown}>
  <h2>Pengaturan Countdown</h2>
  <p className="help-text">
    Durasi ini dipakai halaman player untuk sesi baru. Sesi yang sedang
    berjalan tidak berubah.
  </p>

  {countdownError && <p className="msg-error">{countdownError}</p>}
  {countdownSuccess && <p className="msg-ok">{countdownSuccess}</p>}

  <div className="form-grid">
    <div className="form-group">
      <label htmlFor="countdown-seconds">Durasi Countdown (detik)</label>
      <input
        id="countdown-seconds"
        type="number"
        min={MIN_COUNTDOWN_SECONDS}
        max={MAX_COUNTDOWN_SECONDS}
        step="1"
        value={countdownInput}
        onChange={(event) => setCountdownInput(event.target.value)}
        required
      />
      <small className="help-text">
        {formatDuration(countdownInput)} — minimal {MIN_COUNTDOWN_SECONDS} detik,
        maksimal {MAX_COUNTDOWN_SECONDS} detik.
      </small>
    </div>
  </div>

  <div className="action-row">
    <button
      type="submit"
      className="btn btn-primary"
      disabled={savingCountdown}
    >
      {savingCountdown ? "Menyimpan..." : "Simpan Countdown"}
    </button>
  </div>
</form>
```

Catatan:

- Panel ini terpisah dari form tambah/edit peserta agar admin tidak bingung antara “durasi peserta” dan “durasi countdown”.
- Input `durationSeconds` pada form peserta tetap ada karena dipakai untuk tie-breaker. Batasnya diubah dari 300 menjadi `MAX_COUNTDOWN_SECONDS`.
- Default `durationSeconds` untuk peserta baru mengikuti countdown terbaru jika nilainya masih default.

#### 7.12.8 Input WhatsApp pada form peserta

```jsx
<div className="form-group">
  <label htmlFor="whatsapp">Nomor WhatsApp Aktif</label>
  <input
    id="whatsapp"
    type="tel"
    inputMode="tel"
    autoComplete="tel"
    placeholder="Contoh: 081234567890"
    value={whatsapp}
    onChange={(event) => setWhatsapp(event.target.value)}
    maxLength={20}
    required
  />
  <small className="help-text">
    Hanya terlihat di dashboard admin, tidak ditampilkan di leaderboard.
  </small>
</div>
```

#### 7.12.9 Tampilkan WhatsApp di daftar peserta

Di dalam `.player-meta`, setelah asal:

```jsx
<span className="player-origin">{item.origin || "-"}</span>

{item.whatsapp ? (
  <a
    className="player-whatsapp"
    href={getWhatsAppLink(item.whatsapp)}
    target="_blank"
    rel="noreferrer"
  >
    WA: {formatWhatsApp(item.whatsapp)}
  </a>
) : (
  <span className="player-whatsapp player-whatsapp-empty">
    WA: belum ada
  </span>
)}
```

Catatan:

- Tautan membuka WhatsApp di tab baru.
- Nomor ditampilkan dalam format `+628...`.
- Leaderboard tidak diubah, sehingga tidak ada elemen ini di sana.

#### 7.12.10 Catatan admin dinamis

Ganti teks:

```text
Timer 5 menit hanya berjalan di halaman player.
```

Menjadi:

```text
Timer berjalan di halaman player sesuai Pengaturan Countdown. Peserta yang
ditambahkan dari dashboard otomatis tercatat sebagai peserta hari ini.
```

### 7.13 Ubah `app/globals.css`

Tambahkan style berikut. Jangan menghapus style `.timer-*` karena masih dipakai `/play`.

```css
/* Panel pengaturan countdown */
.settings-card {
  margin-bottom: 16px;
  border-color: #bfdbfe;
  background: #f8fbff;
}

.settings-card h2 {
  margin-bottom: 4px;
}

.settings-card .help-text {
  margin-bottom: 12px;
}

/* Nomor WhatsApp di dashboard */
.player-whatsapp {
  display: inline-block;
  margin-top: 2px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #15803d;
  text-decoration: none;
  word-break: break-all;
}

.player-whatsapp:hover {
  text-decoration: underline;
}

.player-whatsapp-empty {
  color: #94a3b8;
  font-weight: 500;
}
```

Jika perlu, tambahkan media query kecil agar `.settings-card .form-grid` tetap satu kolom di layar sempit. Aturan `.form-grid` yang sudah ada di `@media (max-width: 560px)` sudah menangani ini.

### 7.14 Ubah `types/leaderboard.ts`

```ts
export interface LeaderboardEntry {
  id: string;
  name: string;
  origin: string;
  whatsapp?: string;
  level: number;
  duration_seconds: number;
  created_at?: string;
}

export interface EntryInput {
  name: string;
  origin: string;
  whatsapp?: string;
  level: number | string;
  duration_seconds: number | string;
  id?: string;
}
```

`whatsapp` dibuat opsional pada tipe karena response publik tidak menyertakannya. Dashboard dapat menganggapnya ada setelah memakai `include_whatsapp=1`.

### 7.15 Ubah `package.json`

```diff
-    "test": "node --test lib/leaderboard.test.mjs lib/session.test.mjs lib/date.test.mjs"
+    "test": "node --test lib/leaderboard.test.mjs lib/session.test.mjs lib/date.test.mjs lib/whatsapp.test.mjs lib/settings.test.mjs"
```

### 7.16 Ubah `lib/leaderboard.test.mjs`

Sesuaikan semua pemanggilan `parseEntry` dan `applyUpdate` agar mengirim WhatsApp, lalu tambahkan kasus baru.

Contoh:

```js
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
    "Budi",
    "SMA 1",
    10,
    100,
    undefined,
    undefined,
    "0812-3456-7890"
  );

  assert.equal(valid.entry.whatsapp, "6281234567890");
});

test("durasi maksimal mengikuti countdown maksimum", () => {
  assert.ok(
    parseEntry(
      "Budi",
      "SMA 1",
      10,
      3601,
      undefined,
      undefined,
      "081234567890"
    ).error
  );
  assert.equal(
    parseEntry(
      "Budi",
      "SMA 1",
      10,
      3600,
      undefined,
      undefined,
      "081234567890"
    ).entry.duration_seconds,
    3600
  );
});

test("tie-breaker level sama memakai durasi lalu created_at", () => {
  const data = [
    { id: "a", name: "A", origin: "X", whatsapp: "628111111111", level: 20, duration_seconds: 120, created_at: "2026-11-01T10:00:00Z" },
    { id: "b", name: "B", origin: "X", whatsapp: "628222222222", level: 20, duration_seconds: 90, created_at: "2026-11-01T10:05:00Z" },
    { id: "c", name: "C", origin: "X", whatsapp: "628333333333", level: 20, duration_seconds: 90, created_at: "2026-11-01T09:00:00Z" },
  ];

  const sorted = sortLeaderboard(data);

  assert.deepEqual(sorted.map((item) => item.id), ["c", "b", "a"]);
});
```

### 7.17 `app/leaderboard/page.js` tidak diubah

File ini tetap memanggil `loadEntries(getRelativeDayKey(selectedDay))` tanpa opsi `includeWhatsApp`, sehingga:

- tidak ada field `whatsapp` di state,
- tidak ada render nomor,
- tidak ada perubahan visual.

---

## 8. Urutan Implementasi

1. Buat `lib/whatsapp.js` dan test-nya.
2. Buat `lib/settings.js` dan test-nya.
3. Buat `lib/db.js` dengan migrasi kolom `whatsapp`, tabel `app_settings`, dan constraint durasi baru.
4. Ubah `app/api/leaderboard/route.js` agar memakai `lib/db.js`, mendukung `include_whatsapp`, dan mengirim/menyimpan `whatsapp`.
5. Buat `app/api/settings/route.js`.
6. Ubah `lib/leaderboard.js` (validasi WhatsApp, batas durasi, loader).
7. Ubah `lib/session.js` dan test-nya (limit dinamis, snapshot, WhatsApp).
8. Ubah `app/play/page.js`.
9. Ubah `app/dashboard/page.js`.
10. Tambah style di `app/globals.css`.
11. Ubah `types/leaderboard.ts` dan `package.json`.
12. Jalankan `npm test`, lalu `npm run build`.
13. Lakukan pengujian manual di Bagian 9.2.

---

## 9. Pengujian

### 9.1 Unit test

Jalankan:

```bash
npm test
```

Yang harus lulus:

- test lama `lib/leaderboard.test.mjs`, `lib/session.test.mjs`, `lib/date.test.mjs`
- test baru `lib/whatsapp.test.mjs`
- test baru `lib/settings.test.mjs`
- test tie-breaker level sama
- test batas durasi 3600
- test sesi dengan countdown selain 300

### 9.2 Pengujian manual

#### A. Database dan API

1. Jalankan `npm run dev`.
2. Buka `GET /api/settings`. Pastikan `countdown_seconds` bernilai `300` pada database baru.
3. Kirim `PUT /api/settings` dengan `{ "countdown_seconds": 120 }`. Pastikan respons `200`.
4. Kirim `PUT /api/settings` dengan `{ "countdown_seconds": 10 }`. Pastikan `400`.
5. Kirim `PUT /api/settings` dengan `{ "countdown_seconds": 3601 }`. Pastikan `400`.
6. `POST /api/leaderboard` dengan WhatsApp `0812-3456-7890`. Pastikan tersimpan sebagai `6281234567890`.
7. `POST /api/leaderboard` tanpa WhatsApp. Pastikan `400`.
8. `GET /api/leaderboard` dan pastikan response **tidak** memiliki `whatsapp`.
9. `GET /api/leaderboard?include_whatsapp=1` dan pastikan response memiliki `whatsapp`.

#### B. Halaman `/play`

1. Buka `/play`.
2. Pastikan form memiliki field **Nomor WhatsApp Aktif**.
3. Pastikan tombol berbunyi **Mulai**, bukan “Mulai (5 Menit)”.
4. Pastikan tidak ada teks “5 menit”.
5. Isi nama, asal, dan WhatsApp tidak valid. Pastikan error muncul.
6. Isi WhatsApp valid dan tekan Mulai.
7. Pastikan timer berjalan sesuai setting terbaru (misalnya 120 detik jika baru diubah).
8. Refresh di tengah sesi. Pastikan sesi pulih dengan sisa waktu yang benar.
9. Ubah setting countdown di dashboard dari 120 ke 60 saat sesi berjalan. Pastikan sesi yang sedang berjalan tetap memakai 120.
10. Selesaikan sesi, isi level, simpan. Pastikan data masuk.
11. Buka `/play` lagi, mulai sesi baru. Pastikan memakai 60 detik.

#### C. Dashboard

1. Buka `/dashboard`.
2. Pastikan panel **Pengaturan Countdown** muncul dan menampilkan nilai saat ini.
3. Ubah countdown, tekan **Simpan Countdown**. Pastikan pesan sukses muncul.
4. Pastikan data peserta menampilkan nomor WhatsApp sebagai tautan `wa.me`.
5. Klik tautan WhatsApp. Pastikan membuka `https://wa.me/628...`.
6. Tambah peserta baru dengan WhatsApp. Pastikan berhasil.
7. Edit peserta lama yang belum punya WhatsApp. Pastikan form meminta nomor sebelum bisa menyimpan.
8. Hapus peserta. Pastikan tetap berfungsi.

#### D. Leaderboard

1. Buka `/leaderboard`.
2. Pastikan tidak ada nomor WhatsApp di podium, daftar, maupun teks halaman.
3. Buka DevTools → Network → response `/api/leaderboard`. Pastikan tidak ada field `whatsapp`.
4. Pastikan tampilan dan filter hari tidak berubah.

#### E. Tie-breaker level sama

1. Tambah dua peserta dengan level sama, durasi berbeda.
2. Pastikan yang durasinya lebih kecil berada di atas.
3. Tambah dua peserta dengan level dan durasi sama, `created_at` berbeda.
4. Pastikan yang lebih awal berada di atas.
5. Pastikan perubahan countdown tidak mengubah urutan yang sudah ada.

### 9.3 Build

```bash
npm run build
```

Pastikan tidak ada error build, terutama pada Route Handler baru dan import `neon.ts`.

---

## 10. Acceptance Criteria

- [ ] Form `/play` memiliki input **Nomor WhatsApp Aktif**.
- [ ] WhatsApp wajib diisi dan divalidasi sebelum sesi dimulai.
- [ ] WhatsApp tersimpan dalam format `628...`.
- [ ] WhatsApp tampil di `/dashboard` dan dapat diklik menuju `wa.me`.
- [ ] WhatsApp **tidak** tampil di `/leaderboard`.
- [ ] `GET /api/leaderboard` tanpa parameter tidak mengembalikan `whatsapp`.
- [ ] Dashboard memakai `include_whatsapp=1` untuk mendapatkan WhatsApp.
- [ ] Dashboard memiliki input dan tombol **Simpan Countdown**.
- [ ] Countdown disimpan di database dan bertahan setelah refresh/deploy.
- [ ] `/play` memakai countdown terbaru dari server.
- [ ] `/play` tidak menulis “5 Menit”; tombolnya hanya **Mulai**.
- [ ] Sesi yang sedang berjalan tidak berubah saat setting countdown diubah.
- [ ] Sesi baru memakai setting terbaru.
- [ ] `duration_seconds` dapat menyimpan nilai hingga 3600 detik.
- [ ] Aturan ranking tetap: level DESC → durasi ASC → created_at ASC.
- [ ] Data lama tetap dapat dibaca; WhatsApp kosong ditampilkan sebagai “belum ada”.
- [ ] `npm test` lulus.
- [ ] `npm run build` lulus.

---

## 11. Migrasi & Rollback

### Migrasi

Saat aplikasi pertama kali memanggil `ensureSchema()` setelah deploy:

1. Tabel `leaderboard_entries` yang sudah ada mendapat kolom `whatsapp TEXT NOT NULL DEFAULT ''`.
2. Constraint lama `leaderboard_entries_duration_seconds_check` dihapus.
3. Constraint baru `leaderboard_entries_duration_seconds_max_check` ditambahkan dengan batas 3600.
4. Tabel `app_settings` dibuat.
5. Baris `countdown_seconds = '300'` ditambahkan jika belum ada.
6. Index lama tetap.

Tidak ada data yang dihapus. Data lama memiliki `whatsapp = ''`.

### Rollback

- Kode lama tidak membaca `whatsapp` dan tidak membaca `app_settings`, sehingga kolom/tabel tambahan tidak mengganggu.
- Kode lama hanya menulis `duration_seconds <= 300`, sehingga constraint baru yang lebih longgar tetap menerima.
- Entri baru dengan `duration_seconds > 300` tetap bisa ditampilkan kode lama, karena kode lama hanya membatasi saat menulis, bukan saat membaca.
- Jika ingin menghapus kolom/tabel baru, lakukan manual dan pastikan tidak ada kode baru yang masih memakainya.

---

## 12. Risiko & Catatan

1. **Tidak ada autentikasi admin.** Siapa pun yang tahu endpoint dapat mengubah countdown atau memanggil `include_whatsapp=1`. Ini sama dengan kondisi dashboard saat ini. Autentikasi di luar scope.
2. **Privasi WhatsApp.** Nomor tidak ditampilkan di UI leaderboard dan tidak dikirim pada response publik default. Namun bukan jaminan keamanan penuh.
3. **Sesi lama hilang.** Sesi `localStorage` yang dibuat sebelum deploy tidak memiliki `whatsapp`, sehingga `parseStoredSession()` mengembalikan `null`. Pemain harus mengisi form ulang. Risiko kecil, tetapi sebaiknya deploy saat tidak ada sesi berjalan.
4. **Perubahan countdown tidak real-time push.** `/play` memakai polling 10 detik dan pengecekan sebelum mulai. Perubahan dashboard tersimpan langsung di server, tetapi halaman `/play` yang sudah terbuka baru memakai nilai baru pada pengecekan berikutnya.
5. **Constraint migration.** Nama constraint lama mengandalkan nama default PostgreSQL. Jika di database tertentu nama constraint berbeda, `DROP CONSTRAINT IF EXISTS` tidak akan menghapusnya dan `ADD CONSTRAINT` bisa gagal karena constraint lama masih membatasi 300. Periksa nama constraint di database target sebelum deploy.
6. **Countdown maksimum 60 menit.** Jika kebutuhan stand membutuhkan lebih dari 60 menit, ubah `MAX_COUNTDOWN_SECONDS` dan constraint database secara bersamaan.
7. **Durasi manual dashboard.** Admin masih bisa mengisi `duration_seconds` manual. Nilai ini dipakai untuk tie-breaker, bukan untuk mengatur timer. Beri label yang jelas agar tidak tertukar dengan pengaturan countdown.
8. **Format nomor internasional.** Validasi hanya mendukung nomor seluler Indonesia (`62` + `8...`). Jika ada peserta dengan nomor luar negeri, validasi perlu dilonggarkan.

---

## 13. Pertanyaan Terbuka

Pertanyaan berikut tidak menghalangi implementasi karena dokumen ini sudah memilih default. Konfirmasi jika ingin berbeda:

1. Apakah WhatsApp wajib? **Default rencana: wajib.**
2. Apakah countdown boleh lebih dari 5 menit? **Default rencana: ya, 30–3600 detik.**
3. Apakah aturan level sama tetap memakai durasi tercepat? **Default rencana: ya, tidak berubah.**
4. Apakah perlu autentikasi admin? **Default rencana: tidak, di luar scope.**

---

## 14. Definition of Done

Pekerjaan dianggap selesai jika:

- Semua Acceptance Criteria di Bagian 10 terpenuhi.
- `npm test` dan `npm run build` lulus.
- Tidak ada perubahan pada tampilan leaderboard selain yang sudah ada.
- Nomor WhatsApp tidak muncul di `/leaderboard`.
- Dashboard dapat mengubah countdown dan `/play` memakai nilai terbaru.
- Dokumen ini diperbarui jika ada keputusan implementasi yang berbeda saat pengerjaan.
