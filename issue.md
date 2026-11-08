# [ISSUE / PLAN] Dashboard Tanpa Timer, Filter Harian, & Redesign Leaderboard

> **Status:** Rencana implementasi (belum dikerjakan)
>
> **Basis kode:** branch `feature/halaman-user`, commit `b6c48d4` (PR #4)
>
> **Prasyarat:** PR #4 (halaman player `/play`) sudah di-merge, **atau** branch baru dibuat dari `feature/halaman-user`. Kode di dokumen ini memakai link ke `/play` dan style `a.btn` yang berasal dari PR #4.
>
> **Dokumen ini menggantikan** `issue.md` sebelumnya (rencana halaman player). Rencana lama sudah diimplementasikan di PR #4 dan tetap tersimpan di riwayat Git.
>
> **Target pembaca:** junior programmer atau AI coding model dengan konteks terbatas.

## Cara memakai dokumen ini

1. Baca Bagian 1–4 untuk memahami perubahan perilaku dan keputusan desain.
2. Implementasikan file sesuai urutan di Bagian 8.
3. Jangan mengubah halaman `/play` atau aturan ranking.
4. Jalankan pengujian di Bagian 9 dan cocokkan dengan Acceptance Criteria di Bagian 10.

---

## 1. Ringkasan Perubahan

Ada tiga perubahan utama.

### 1.1 Dashboard admin tidak lagi memakai timer

Saat ini dashboard (`/dashboard`) masih memiliki countdown 5 menit, tombol mulai/stop, dan input level yang baru muncul setelah sesi berhenti. Setelah perubahan:

- Dashboard menjadi **halaman CRUD admin murni**.
- Admin bisa langsung menambahkan peserta: nama, asal, level, dan durasi.
- **Tidak ada countdown, tombol mulai, atau tombol stop** di dashboard.
- Timer 5 menit hanya ada di halaman player `/play`.

### 1.2 Leaderboard publik tidak menampilkan durasi dan tampilannya dipercantik

- Kolom/badge durasi (`⏱ 04:12`) **dihapus** dari `/leaderboard`.
- Informasi yang ditampilkan: peringkat, nama, asal, dan level.
- Tampilan diubah dari daftar polos menjadi:
  - hero section dengan gradient,
  - statistik ringkas (jumlah peserta, level tertinggi, puncak saat ini),
  - podium visual untuk 3 besar,
  - daftar kartu untuk peringkat 4 ke bawah,
  - skeleton loading, empty state, dan indikator auto-refresh.
- Tetap tanpa library/tema baru. Semua memakai CSS yang sudah ada.

### 1.3 Peserta dipisahkan berdasarkan hari

- Leaderboard memiliki tab: **Hari Ini**, **Kemarin**, dan **Semua**. Default: **Hari Ini**.
- Dashboard memiliki filter yang sama untuk melihat peserta hari ini, kemarin, atau semua.
- Pengelompokan memakai **tanggal `created_at`** dalam zona waktu **Asia/Jakarta (WIB)**.
- API mendukung filter tanggal: `GET /api/leaderboard?date=YYYY-MM-DD`.
- Podium, statistik, dan daftar di leaderboard mengikuti hari yang dipilih.
- Peserta baru dari dashboard selalu tercatat sebagai peserta **hari ini**.

### 1.4 Yang tidak berubah

- Skema database **tidak berubah**. Kolom `created_at` sudah ada.
- Field API yang dikirim/diterima tidak berubah.
- Aturan ranking: level tertinggi → durasi tercepat → waktu input paling awal.
- Halaman player `/play` dan countdown-nya.
- Fungsi `saveEntry`, `updateEntry`, `deleteEntry`, `formatDuration` di `lib/leaderboard.js`.
- `duration_seconds` tetap disimpan dan tetap dipakai untuk tie-breaker.

---

## 2. Kondisi Project Saat Ini

### 2.1 Dashboard (`app/dashboard/page.js`)

Saat ini dashboard memiliki:

- State timer: `sessionState` (`idle`/`running`/`stopped`), `countdownLeft`, `startTime`.
- `timerIntervalRef` dan dua `useEffect` (load data + cleanup interval).
- Handler `handleStartSession`, `handleStopSession`, `handleResetSession`.
- Panel timer `.timer-box`, tombol "Mulai Sesi (5 Menit)", "Stop Sesi Permainan", "Ulangi / Reset Sesi".
- Input level dan durasi yang hanya muncul saat `sessionState === "stopped"` atau mode edit.
- `handleSubmit` menolak simpan jika sesi belum `stopped`.

Semua bagian timer itu akan dihapus.

### 2.2 Leaderboard (`app/leaderboard/page.js`)

Saat ini:

- Mengimpor `getRankColor` dan `formatDuration`.
- Menampilkan durasi lewat `.player-time-badge` dengan teks `⏱ MM:SS`.
- Memakai baris `.board-row` dengan warna latar dari `getRankColor(index)`.
- Auto-refresh setiap 10 detik.
- Menampilkan **semua** peserta tanpa filter hari.
- Header berisi link "Main" ke `/play` dan "Kelola (Admin)" ke `/dashboard`.

Durasi akan dihapus dari tampilan, struktur visual diganti, dan data difilter per hari.

### 2.3 API (`app/api/leaderboard/route.js`)

Saat ini:

- `GET` mengembalikan semua entri, diurutkan `level DESC, duration_seconds ASC, created_at ASC`, dengan `LIMIT 100`.
- Belum ada parameter filter tanggal.
- `POST`, `PUT`, dan `DELETE` mengembalikan `{ entries }` berisi semua entri.
- `ensureSchema()` sudah membuat tabel, kolom, dan index tie-breaker.
- `created_at` bertipe `TIMESTAMPTZ` dan diisi otomatis oleh database saat insert.

### 2.4 CSS (`app/globals.css`)

Sudah tersedia:

- Dasar: `.container` (max-width `640px`), `.card`, `.form-group`, `.btn`, `.btn-secondary`, `.btn-primary`, `.header-links`, `.action-row`.
- Timer: `.timer-box`, `.timer-header`, `.timer-label`, `.badge-live`, `.badge-done`, `.timer-display`, `.timer-actions`, `.timer-warning`.
- Leaderboard lama: `.board-list`, `.board-row`, `.rank-badge`, `.player-*`, `.tie-breaker-info`.

**Penting:** jangan menghapus CSS timer. Halaman `/play` masih memakai `.timer-header`, `.timer-label`, `.badge-live`, `.badge-done`, `.timer-display`, `.timer-actions`, dan `.timer-warning`.

### 2.5 Data timestamp

- `created_at` sudah dikirim API sebagai ISO string.
- Belum ada kolom `played_on` atau `session_started_at`.
- Pengelompokan hari akan memakai `created_at`, yaitu waktu data **disimpan**, bukan waktu sesi dimulai.

---

## 3. Tujuan & Non-Tujuan

### Tujuan

- Admin dapat menambah peserta tanpa menjalankan countdown.
- Countdown hanya tersedia di `/play`.
- `/leaderboard` tidak menampilkan durasi.
- Tampilan leaderboard lebih menarik, modern, dan tidak minimalis.
- Peserta dipisahkan berdasarkan hari: hari ini, kemarin, dan semua.
- Filter hari tersedia di leaderboard dan dashboard.
- Tidak ada regresi pada `/play`, API, atau data lama.

### Non-Tujuan

- Mengubah skema database atau menambah kolom baru.
- Mengubah aturan tie-breaker.
- Menambah autentikasi admin.
- Menambah library UI/animation.
- Mengubah halaman `/play`.
- Menghapus data lama.
- Membuat date-range picker bebas (cukup Hari Ini/Kemarin/Semua).
- Mengelompokkan berdasarkan waktu sesi dimulai (butuh kolom baru; lihat Bagian 12).

---

## 4. Keputusan Desain

### 4.1 Dashboard tetap menyimpan `duration_seconds`

Meskipun leaderboard tidak menampilkan durasi, field `duration_seconds` masih dipakai untuk tie-breaker. Karena itu dashboard tetap punya input durasi:

- Default: **300 detik (05:00)**.
- Bisa diubah manual 0–300 detik.
- Label diberi keterangan "dipakai untuk tie-breaker".
- Admin yang tidak peduli durasi cukup membiarkan nilai default.

Alternatif yang **jangan** dipakai: mengirim `duration_seconds: 0` untuk semua entri dashboard. Itu membuat entri admin selalu menang tie-breaker secara tidak adil.

### 4.2 Dashboard tidak lagi memiliki state timer

Hapus seluruh state dan handler timer. Form langsung bisa disubmit. Ini mengurangi kompleksitas dan menghilangkan bug "sesi belum selesai" saat admin hanya ingin menambah peserta.

### 4.3 Leaderboard menyembunyikan durasi, bukan mengubah ranking

API tetap mengurutkan `level DESC, duration_seconds ASC, created_at ASC`. UI hanya tidak menampilkan durasi. Footer leaderboard menjelaskan aturan secara ringkas: "level tertinggi, lalu waktu bermain tercepat".

### 4.4 Redesign memakai CSS murni

Tidak menambah dependency. Semua style baru memakai class berprefix `lb-` agar tidak bentrok dengan dashboard atau `/play`.

### 4.5 Tetap mobile-first

Container saat ini `max-width: 640px`. Desain podium dan daftar harus nyaman di lebar 375 px. Podium menjadi susunan vertikal di layar kecil; daftar tetap satu kolom.

### 4.6 Definisi "hari" memakai Asia/Jakarta

- Zona waktu acuan: **Asia/Jakarta (WIB, UTC+7)**.
- Semua pengelompokan dan label hari memakai zona ini, bukan zona waktu perangkat pengunjung.
- Alasan: stand berada di Indonesia; hasil harus konsisten antara layar leaderboard, dashboard admin, dan API.
- Jakarta tidak memiliki DST, jadi offset `+07:00` aman.
- Jika stand dipindah ke zona waktu lain, ubah `APP_TIME_ZONE` dan `APP_UTC_OFFSET` di `lib/date.js`.

### 4.7 Filter tanggal dilakukan di server

- API menerima `?date=YYYY-MM-DD`.
- Server menghitung batas UTC untuk tanggal tersebut di Asia/Jakarta, lalu memfilter `created_at`.
- Tanpa parameter `date`, API tetap mengembalikan semua entri (backward compatible).
- Index sederhana pada `created_at` ditambahkan agar filter tetap cepat.

Alasan tidak memfilter hanya di client:

- API hanya mengembalikan maksimal 100 entri. Jika data sudah banyak, entri hari ini/kemarin bisa terpotong.
- Filter server membuat hasil konsisten dan tidak bergantung pada data yang sudah dimuat.

### 4.8 Leaderboard memakai tab, dashboard memakai select

- Leaderboard: tab **Hari Ini / Kemarin / Semua** agar podium tetap fokus pada satu hari.
- Dashboard: dropdown **Hari Ini / Kemarin / Semua** agar form dan daftar tetap ringkas.
- Alternatif dua section bertumpuk (Hari Ini + Kemarin sekaligus) tidak dipakai karena akan memanjangkan halaman dan membuat podium ganda.

### 4.9 Tambah peserta dari dashboard selalu masuk "Hari Ini"

- `created_at` diisi otomatis oleh database saat insert, jadi tidak bisa memilih hari saat menambah.
- Jika admin sedang melihat filter "Kemarin" lalu menambah peserta, dashboard otomatis berpindah ke filter "Hari Ini" setelah simpan agar peserta baru langsung terlihat.
- Edit tidak mengubah `created_at`; entri tetap berada di hari aslinya.
- Hapus tetap berada di filter yang sedang aktif.

### 4.10 Tidak menambah kolom `played_on`

Kolom `created_at` sudah cukup untuk memisahkan data berdasarkan hari pencatatan. Menambah kolom baru hanya diperlukan jika ingin mengelompokkan berdasarkan **waktu sesi dimulai** (lihat Bagian 12).

---

## 5. Alur

### 5.1 Dashboard

```
Buka /dashboard
   │
   ├─ Pilih filter: Hari Ini / Kemarin / Semua
   │     ▼
   │  GET /api/leaderboard?date=YYYY-MM-DD (atau tanpa date untuk Semua)
   │
   ├─ Form tambah (nama, asal, level, durasi)
   │     ▼
   │  POST /api/leaderboard
   │     ▼
   │  Jika filter bukan "Hari Ini", otomatis pindah ke "Hari Ini"
   │
   ├─ Edit baris
   │     ▼
   │  PUT /api/leaderboard → refresh filter aktif
   │
   └─ Hapus baris
         ▼
      DELETE /api/leaderboard → refresh filter aktif
```

### 5.2 Leaderboard

```
Buka /leaderboard
   │
   ├─ Tab default: Hari Ini
   │     ▼
   │  GET /api/leaderboard?date=<hari-ini-WIB>
   │
   ├─ Klik "Kemarin"
   │     ▼
   │  GET /api/leaderboard?date=<kemarin-WIB>
   │
   ├─ Klik "Semua"
   │     ▼
   │  GET /api/leaderboard (tanpa date)
   │
   └─ Setiap 10 detik, ulangi request untuk tab aktif
```

### 5.3 API

```
GET /api/leaderboard
  → semua entri (limit 100)

GET /api/leaderboard?date=2026-11-08
  → entri dengan created_at >= 2026-11-07T17:00:00Z
    dan created_at < 2026-11-08T17:00:00Z
    (yaitu 8 November 2026 00:00–23:59:59 WIB)

GET /api/leaderboard?date=2026-02-31
  → 400 { "error": "Format tanggal harus YYYY-MM-DD." }
```

---

## 6. Rencana Perubahan File

| File | Aksi | Keterangan |
| :--- | :---: | :--- |
| `lib/date.js` | **Baru** | Helper tanggal: date key WIB, kemarin, validasi, range, label. |
| `lib/date.test.mjs` | **Baru** | Unit test helper tanggal. |
| `package.json` | **Ubah** | Script test menjalankan `date.test.mjs`. |
| `lib/leaderboard.js` | **Ubah** | `loadEntries(dateKey)` mengirim query `?date=`. |
| `app/api/leaderboard/route.js` | **Ubah** | `GET` menerima `?date=`, filter SQL, validasi, index `created_at`. |
| `app/dashboard/page.js` | **Ganti total** | Hapus timer; form tambah/edit + filter hari. |
| `app/leaderboard/page.js` | **Ganti total** | Hapus durasi; hero, tab hari, podium, daftar kartu. |
| `app/globals.css` | **Tambah** | Style dashboard, tab hari, dan seluruh `.lb-*`. |
| `app/play/page.js` | Tidak diubah | Countdown tetap di sini. |
| `lib/session.js` | Tidak diubah | Hanya dipakai `/play`. |
| `app/layout.js` | Tidak diubah | Container tetap 640 px. |
| `types/leaderboard.ts` | Tidak diubah | Tidak ada field baru. |

---

## 7. Implementasi Detail

### 7.1 File baru: `lib/date.js`

Helper ini murni (tidak menyentuh DOM) sehingga bisa dipakai di client dan server.

```javascript
export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_UTC_OFFSET = "+07:00";

/**
 * Mengembalikan tanggal lokal (YYYY-MM-DD) di zona waktu tertentu.
 */
export function getDateKey(date = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

export function getTodayKey(now = new Date(), timeZone = APP_TIME_ZONE) {
  return getDateKey(now, timeZone);
}

export function getYesterdayKey(now = new Date(), timeZone = APP_TIME_ZONE) {
  const todayKey = getDateKey(now, timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1));
  return yesterday.toISOString().slice(0, 10);
}

/**
 * day: "today" | "yesterday" | "all"
 * Mengembalikan null untuk "all" (tanpa filter tanggal).
 */
export function getRelativeDayKey(day, now = new Date(), timeZone = APP_TIME_ZONE) {
  if (day === "today") return getTodayKey(now, timeZone);
  if (day === "yesterday") return getYesterdayKey(now, timeZone);
  return null;
}

/**
 * Validasi format YYYY-MM-DD sekaligus memastikan tanggalnya nyata.
 */
export function isValidDateKey(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/**
 * Batas UTC untuk satu hari di Asia/Jakarta.
 * Contoh: 2026-11-08 -> 2026-11-07T17:00:00Z s/d 2026-11-08T17:00:00Z.
 */
export function getDayRange(dateKey) {
  const start = new Date(`${dateKey}T00:00:00${APP_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Label hari dalam bahasa Indonesia, mis. "Minggu, 8 November 2026".
 */
export function formatDateLabel(dateKey, timeZone = APP_TIME_ZONE) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
```

Catatan:

- `getDateKey` memakai `formatToParts` agar hasil `YYYY-MM-DD` konsisten di berbagai runtime.
- `getYesterdayKey` memakai `Date.UTC` dari komponen tanggal, sehingga aman untuk pergantian bulan/tahun.
- `getDayRange` memakai offset tetap `+07:00` karena Asia/Jakarta tidak memiliki DST.
- `formatDateLabel` memakai pukul 12:00 UTC agar tidak bergeser hari saat diformat.

---

### 7.2 File baru: `lib/date.test.mjs`

```javascript
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
```

---

### 7.3 Ubah `package.json`

```diff
-    "test": "node --test lib/leaderboard.test.mjs lib/session.test.mjs"
+    "test": "node --test lib/leaderboard.test.mjs lib/session.test.mjs lib/date.test.mjs"
```

Total test setelah perubahan: **12 test** (3 leaderboard + 3 session + 6 date).

---

### 7.4 Ubah `lib/leaderboard.js`

Hanya fungsi `loadEntries` yang berubah. Fungsi lain tetap.

```javascript
export async function loadEntries(dateKey) {
  const query = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
  const res = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}
```

- `dateKey` opsional. Tanpa argumen, perilaku lama (semua entri) tetap sama.
- `encodeURIComponent` mencegah karakter aneh masuk ke query string.

---

### 7.5 Ubah `app/api/leaderboard/route.js`

#### 7.5.1 Tambahkan import

Di bagian atas file:

```javascript
import { getDayRange, isValidDateKey } from "../../../lib/date.js";
```

#### 7.5.2 Ganti fungsi `listEntries`

Ganti fungsi `listEntries` yang lama dengan dua fungsi berikut:

```javascript
function mapEntries(rows) {
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    origin: row.origin || "-",
    level: Number(row.level),
    duration_seconds: Number(row.duration_seconds || 0),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));
}

async function listEntries(sql, dateKey) {
  if (dateKey) {
    const { start, end } = getDayRange(dateKey);

    const rows = await sql`
      SELECT id, name, origin, level, duration_seconds, created_at
      FROM leaderboard_entries
      WHERE created_at >= ${start.toISOString()}::timestamptz
        AND created_at < ${end.toISOString()}::timestamptz
      ORDER BY level DESC, duration_seconds ASC, created_at ASC
      LIMIT 100
    `;

    return mapEntries(rows);
  }

  const rows = await sql`
    SELECT id, name, origin, level, duration_seconds, created_at
    FROM leaderboard_entries
    ORDER BY level DESC, duration_seconds ASC, created_at ASC
    LIMIT 100
  `;

  return mapEntries(rows);
}
```

#### 7.5.3 Ganti handler `GET`

```javascript
export async function GET(request) {
  await ensureSchema();

  const date = new URL(request.url).searchParams.get("date");

  if (date && !isValidDateKey(date)) {
    return Response.json(
      { error: "Format tanggal harus YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const entries = await listEntries(getSql(), date);
  return Response.json({ entries, date: date ?? null });
}
```

#### 7.5.4 Tambahkan index `created_at`

Di dalam `ensureSchema()`, setelah pembuatan index tie-breaker yang sudah ada, tambahkan:

```javascript
await directSql`
  CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at
  ON leaderboard_entries (created_at)
`;
```

Index ini mempercepat filter `created_at >= ... AND created_at < ...`.

#### 7.5.5 Handler lain

`POST`, `PUT`, dan `DELETE` **tidak perlu diubah**. Pemanggilan `listEntries(sql)` tetap valid karena `dateKey` opsional. Response mereka tetap berisi semua entri; halaman yang membutuhkan filter akan memanggil `loadEntries(dateKey)` lagi setelah mutasi.

---

### 7.6 Ganti isi `app/dashboard/page.js`

Ganti seluruh isi file dengan kode berikut.

```jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRankColor,
  loadEntries,
  saveEntry,
  updateEntry,
  deleteEntry,
  formatDuration,
} from "../../lib/leaderboard";
import { getRelativeDayKey } from "../../lib/date";

const DEFAULT_DURATION_SECONDS = 300;

const DAY_OPTIONS = [
  { value: "today", label: "Hari Ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "all", label: "Semua" },
];

export default function DashboardPage() {
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [selectedDay, setSelectedDay] = useState("today");
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [level, setLevel] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(
    DEFAULT_DURATION_SECONDS
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingEntries(true);

    loadEntries(getRelativeDayKey(selectedDay)).then((data) => {
      if (!active) return;
      setEntries(data);
      setLoadingEntries(false);
    });

    return () => {
      active = false;
    };
  }, [selectedDay]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setOrigin("");
    setLevel("");
    setDurationSeconds(DEFAULT_DURATION_SECONDS);
    setError("");
  }

  async function refreshEntries(day = selectedDay) {
    const data = await loadEntries(getRelativeDayKey(day));
    setEntries(data);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const result = editingId
        ? await updateEntry(editingId, name, origin, level, durationSeconds)
        : await saveEntry(name, origin, level, durationSeconds);

      if (result?.error) {
        setError(result.error);
        return;
      }
      if (!result?.entry) {
        setError("Respons server tidak valid. Coba lagi.");
        return;
      }

      setSuccess(
        editingId
          ? `Data "${result.entry.name}" berhasil diperbarui.`
          : `Peserta "${result.entry.name}" (${result.entry.origin}) berhasil ditambahkan ke hari ini. Level ${result.entry.level}, durasi ${formatDuration(result.entry.duration_seconds)}.`
      );

      if (editingId) {
        await refreshEntries();
      } else if (selectedDay !== "today") {
        setSelectedDay("today");
      } else {
        await refreshEntries("today");
      }

      resetForm();
    } catch {
      setError("Gagal menyimpan data. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setError("");
    setSuccess("");
    setEditingId(item.id);
    setName(item.name);
    setOrigin(item.origin || "");
    setLevel(String(item.level));
    setDurationSeconds(
      Number(item.duration_seconds ?? DEFAULT_DURATION_SECONDS)
    );
  }

  async function handleDelete(item) {
    setError("");
    setSuccess("");
    try {
      await deleteEntry(item.id);
      await refreshEntries();
      if (editingId === item.id) resetForm();
      setSuccess(`Data "${item.name}" berhasil dihapus.`);
    } catch {
      setError("Gagal menghapus data. Periksa koneksi lalu coba lagi.");
    }
  }

  const dayLabel =
    selectedDay === "today"
      ? "Data Hari Ini"
      : selectedDay === "yesterday"
      ? "Data Kemarin"
      : "Semua Data";

  return (
    <section>
      <div className="header-row">
        <div>
          <h1>Dashboard Admin</h1>
          <p className="subtitle">Tambah dan kelola peserta tanpa timer</p>
        </div>
        <div className="header-links">
          <Link href="/play" className="link-btn">
            Halaman Player
          </Link>
          <Link href="/leaderboard" className="link-btn">
            Lihat Leaderboard
          </Link>
        </div>
      </div>

      <div className="admin-note">
        Timer 5 menit hanya berjalan di{" "}
        <Link href="/play">halaman player</Link>. Peserta yang ditambahkan dari
        dashboard otomatis tercatat sebagai peserta hari ini.
      </div>

      <div className="day-filter">
        <label htmlFor="dashboard-day">Tampilkan peserta</label>
        <select
          id="dashboard-day"
          value={selectedDay}
          onChange={(event) => setSelectedDay(event.target.value)}
        >
          {DAY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? "Edit Data Peserta" : "Tambah Peserta"}</h2>
        {error && <p className="msg-error">{error}</p>}
        {success && <p className="msg-ok">{success}</p>}

        <div className="form-group">
          <label htmlFor="name">Nama Peserta</label>
          <input
            id="name"
            type="text"
            placeholder="Masukkan nama player..."
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="origin">Asal (Sekolah / Jurusan)</label>
          <input
            id="origin"
            type="text"
            placeholder="Contoh: SMKN 1 Surabaya / Sistem Informasi"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            maxLength={100}
            required
          />
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="level">Level</label>
            <input
              id="level"
              type="number"
              min="1"
              step="1"
              placeholder="Contoh: 12"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="duration">Durasi (detik)</label>
            <input
              id="duration"
              type="number"
              min="0"
              max="300"
              step="1"
              value={durationSeconds}
              onChange={(event) =>
                setDurationSeconds(Number(event.target.value))
              }
              required
            />
            <small className="help-text">
              {formatDuration(durationSeconds)} — dipakai untuk tie-breaker.
            </small>
          </div>
        </div>

        <div className="action-row">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? "Menyimpan..."
              : editingId
              ? "Simpan Perubahan"
              : "Tambah ke Leaderboard"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetForm}
            disabled={saving}
          >
            {editingId ? "Batal Edit" : "Reset"}
          </button>
        </div>
      </form>

      <h2 className="section-title">
        {dayLabel} ({entries.length})
      </h2>

      {loadingEntries ? (
        <p className="empty-state">Memuat data peserta...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">
          Belum ada peserta pada filter ini. Tambahkan peserta lewat form di
          atas.
        </p>
      ) : (
        <ol className="board-list">
          {entries.map((item, index) => (
            <li
              key={item.id}
              className="board-row"
              style={{ backgroundColor: getRankColor(index) }}
            >
              <div className="board-left">
                <span className="rank-badge">#{index + 1}</span>
                <div className="player-meta">
                  <span className="player-name">{item.name}</span>
                  <span className="player-origin">{item.origin || "-"}</span>
                </div>
              </div>

              <div className="board-right">
                <div className="score-badge">
                  <span className="player-level">Level {item.level}</span>
                  <span className="player-time">
                    ⏱ {formatDuration(item.duration_seconds)}
                  </span>
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() => handleEdit(item)}
                    disabled={saving}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-danger"
                    onClick={() => handleDelete(item)}
                    disabled={saving}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

#### Catatan dashboard

- `durationSeconds` default `300`. Admin boleh membiarkannya.
- `formatDuration` tetap dipakai untuk menampilkan durasi di daftar admin dan helper text.
- `getRankColor` tetap dipakai untuk warna baris di dashboard.
- Tidak ada `useRef`, interval, atau state timer.
- `resetForm()` tidak menghapus pesan `success`, sehingga notifikasi tetap terlihat setelah form direset.
- `saving` mencegah double submit dan menonaktifkan tombol edit/hapus saat request berjalan.
- Setelah menambah peserta, dashboard pindah ke filter "Hari Ini" jika sebelumnya berada di filter lain.
- Setelah edit/hapus, daftar di-refresh sesuai filter yang sedang aktif.

---

### 7.7 Ganti isi `app/leaderboard/page.js`

Ganti seluruh isi file dengan kode berikut.

```jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadEntries } from "../../lib/leaderboard";
import { formatDateLabel, getRelativeDayKey } from "../../lib/date";

const DAY_TABS = [
  { value: "today", label: "Hari Ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "all", label: "Semua" },
];

function getInitial(name) {
  return String(name ?? "").trim().charAt(0).toUpperCase() || "?";
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedDay, setSelectedDay] = useState("today");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setEntries([]);
    setLastUpdated(null);

    async function refreshData() {
      const data = await loadEntries(getRelativeDayKey(selectedDay));
      if (!active) return;
      setEntries(data);
      setLoading(false);
      setLastUpdated(new Date());
    }

    refreshData();
    const interval = setInterval(refreshData, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedDay]);

  const selectedDateKey = getRelativeDayKey(selectedDay);
  const dayLabel =
    selectedDay === "all"
      ? "Semua Hari"
      : formatDateLabel(selectedDateKey);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const topLevel = entries.length > 0 ? entries[0].level : 0;
  const topName = entries.length > 0 ? entries[0].name : "—";

  const emptyTitle =
    selectedDay === "today"
      ? "Belum ada peserta hari ini"
      : selectedDay === "yesterday"
      ? "Belum ada peserta kemarin"
      : "Belum ada peserta";

  return (
    <section className="leaderboard-page">
      <header className="lb-hero">
        <div className="lb-hero-content">
          <span className="lb-eyebrow">LABORATORIUM SISTEM INFORMASI</span>
          <h1>Leaderboard Game Stand</h1>
          <p className="lb-hero-subtitle">
            Cetak level tertinggi dan rebut posisi puncak.
          </p>
          <div className="lb-hero-actions">
            <Link href="/play" className="btn lb-cta">
              Main Sekarang
            </Link>
            <Link href="/dashboard" className="lb-ghost-btn">
              Kelola (Admin)
            </Link>
          </div>
        </div>

        <div className="lb-hero-stats">
          <div className="lb-stat">
            <strong>{entries.length}</strong>
            <span>Peserta</span>
          </div>
          <div className="lb-stat">
            <strong>{topLevel}</strong>
            <span>Level Tertinggi</span>
          </div>
          <div className="lb-stat">
            <strong className="lb-stat-name">{topName}</strong>
            <span>Puncak Saat Ini</span>
          </div>
        </div>
      </header>

      <div className="lb-day-header">
        <div className="lb-tabs" role="tablist" aria-label="Filter hari">
          {DAY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selectedDay === tab.value}
              className={`lb-tab ${
                selectedDay === tab.value ? "lb-tab-active" : ""
              }`}
              onClick={() => setSelectedDay(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="lb-day-label">{dayLabel}</p>
      </div>

      <div className="lb-meta">
        <span className="lb-live-dot" />
        <span>Diperbarui otomatis setiap 10 detik</span>
        {lastUpdated && (
          <span className="lb-updated">
            {lastUpdated.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {loading && entries.length === 0 ? (
        <div className="lb-skeleton" aria-label="Memuat leaderboard">
          <div className="lb-skeleton-card" />
          <div className="lb-skeleton-card" />
          <div className="lb-skeleton-card" />
        </div>
      ) : entries.length === 0 ? (
        <div className="lb-empty">
          <span className="lb-empty-icon">🏆</span>
          <h2>{emptyTitle}</h2>
          <p>Jadilah yang pertama mencetak skor di leaderboard.</p>
          {selectedDay === "yesterday" ? (
            <button
              type="button"
              className="btn lb-cta"
              onClick={() => setSelectedDay("today")}
            >
              Lihat Hari Ini
            </button>
          ) : (
            <Link href="/play" className="btn lb-cta">
              Main Sekarang
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="lb-podium">
            {podium.map((item, index) => (
              <article
                key={item.id}
                className={`lb-podium-card podium-${index + 1}`}
              >
                <span className="lb-medal">{index + 1}</span>
                <div className="lb-avatar">{getInitial(item.name)}</div>
                <div className="lb-podium-info">
                  <h2 className="lb-podium-name">{item.name}</h2>
                  <p className="lb-podium-origin">{item.origin || "-"}</p>
                </div>
                <span className="lb-level-chip">Level {item.level}</span>
              </article>
            ))}
          </div>

          {rest.length > 0 && (
            <ol className="lb-list">
              {rest.map((item, index) => (
                <li key={item.id} className="lb-row">
                  <span className="lb-rank">#{index + 4}</span>
                  <div className="lb-avatar lb-avatar-sm">
                    {getInitial(item.name)}
                  </div>
                  <div className="lb-player">
                    <span className="lb-name">{item.name}</span>
                    <span className="lb-origin">{item.origin || "-"}</span>
                  </div>
                  <span className="lb-level-pill">Level {item.level}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <p className="lb-footnote">
        Peringkat: level tertinggi, lalu waktu bermain tercepat.
      </p>
    </section>
  );
}
```

#### Catatan leaderboard

- `formatDuration` dan `getRankColor` **tidak lagi diimpor**. Durasi tidak ditampilkan.
- `selectedDay` mengontrol tab dan request API.
- Saat tab berubah, daftar lama dikosongkan dan skeleton ditampilkan agar tidak menampilkan data hari yang salah.
- `getRelativeDayKey(selectedDay)` dihitung ulang di dalam `refreshData`, sehingga pergantian hari saat halaman terbuka tetap tertangani pada refresh berikutnya.
- `entries.slice(0, 3)` untuk podium; `entries.slice(3)` untuk daftar #4 dan seterusnya.
- `active` flag mencegah `setState` setelah komponen unmount.
- `lastUpdated` diisi dari `Date` di client, jadi tidak menyebabkan hydration mismatch.
- Tab "Kemarin" yang kosong menampilkan tombol "Lihat Hari Ini" agar pengunjung tidak bingung.

---

### 7.8 Tambahkan CSS di `app/globals.css`

Tambahkan blok berikut di **paling bawah** file. Jangan menghapus CSS lama, terutama CSS timer yang dipakai `/play`.

```css
/* ===== Dashboard admin tanpa timer ===== */
.admin-note {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.admin-note a {
  color: inherit;
  font-weight: 700;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #64748b;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}

.day-filter {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 0.9rem;
  color: #475569;
}

.day-filter select {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  font: inherit;
}

/* ===== Leaderboard publik ===== */
.leaderboard-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.lb-hero {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 26px 22px 20px;
  background:
    radial-gradient(circle at 15% 0%, rgba(99, 102, 241, 0.45), transparent 45%),
    radial-gradient(circle at 100% 100%, rgba(14, 165, 233, 0.28), transparent 40%),
    linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%);
  color: #f8fafc;
  box-shadow: 0 18px 45px -22px rgba(15, 23, 42, 0.75);
}

.lb-hero::after {
  content: "";
  position: absolute;
  right: -60px;
  bottom: -110px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}

.lb-hero-content {
  position: relative;
  z-index: 1;
}

.lb-eyebrow {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #c7d2fe;
  margin-bottom: 8px;
}

.lb-hero h1 {
  font-size: 1.75rem;
  line-height: 1.15;
  margin: 0 0 8px;
  color: #ffffff;
}

.lb-hero-subtitle {
  font-size: 0.95rem;
  color: #cbd5e1;
  max-width: 34ch;
}

.lb-hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.lb-cta {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #1f2937;
  box-shadow: 0 10px 24px -10px rgba(245, 158, 11, 0.9);
}

.lb-cta:hover {
  background: linear-gradient(135deg, #fbbf24, #fb923c);
}

.lb-ghost-btn {
  color: #e2e8f0;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 9px 14px;
  border-radius: 9px;
  border: 1px solid rgba(226, 232, 240, 0.35);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(4px);
}

.lb-ghost-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

.lb-hero-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.18);
}

.lb-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.lb-stat strong {
  font-size: 1.25rem;
  color: #ffffff;
}

.lb-stat-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-stat span {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a5b4fc;
}

.lb-day-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lb-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lb-tab {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lb-tab:hover {
  border-color: #c7d2fe;
  color: #4338ca;
}

.lb-tab-active {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 8px 18px -10px rgba(79, 70, 229, 0.9);
}

.lb-day-label {
  font-size: 0.85rem;
  color: #64748b;
}

.lb-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  font-size: 0.8rem;
  color: #64748b;
}

.lb-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
  animation: lb-pulse 1.8s infinite;
}

@keyframes lb-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.85);
  }
}

.lb-updated {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.lb-podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.lb-podium-card {
  position: relative;
  flex: 1 1 170px;
  max-width: 200px;
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 22px 12px 16px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 16px 32px -24px rgba(15, 23, 42, 0.55);
}

.lb-podium-card.podium-1 {
  order: 2;
  min-height: 216px;
  border-color: #fcd34d;
  background: linear-gradient(180deg, #fffbeb, #fef3c7);
  box-shadow: 0 22px 40px -24px rgba(245, 158, 11, 0.8);
}

.lb-podium-card.podium-2 {
  order: 1;
  border-color: #cbd5e1;
  background: linear-gradient(180deg, #ffffff, #f1f5f9);
}

.lb-podium-card.podium-3 {
  order: 3;
  border-color: #fdba74;
  background: linear-gradient(180deg, #fff7ed, #ffedd5);
}

.lb-medal {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: #ffffff;
  background: #64748b;
  box-shadow: 0 4px 10px -4px rgba(15, 23, 42, 0.6);
}

.podium-1 .lb-medal {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.podium-2 .lb-medal {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}

.podium-3 .lb-medal {
  background: linear-gradient(135deg, #fb923c, #ea580c);
}

.lb-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1.1rem;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.5);
  margin-bottom: 10px;
}

.podium-1 .lb-avatar {
  width: 64px;
  height: 64px;
  font-size: 1.3rem;
  background: linear-gradient(135deg, #f59e0b, #ea580c);
}

.lb-podium-info {
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lb-podium-name {
  font-size: 1rem;
  margin: 0 0 2px;
  color: #0f172a;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-podium-origin {
  font-size: 0.75rem;
  color: #64748b;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-level-chip {
  margin-top: 12px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  color: #ffffff;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  box-shadow: 0 8px 16px -10px rgba(79, 70, 229, 0.9);
  flex-shrink: 0;
}

.lb-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.lb-row:hover {
  transform: translateY(-1px);
  border-color: #c7d2fe;
  box-shadow: 0 14px 30px -24px rgba(30, 41, 59, 0.7);
}

.lb-rank {
  min-width: 38px;
  font-weight: 800;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.lb-avatar-sm {
  width: 38px;
  height: 38px;
  font-size: 0.9rem;
  margin-bottom: 0;
  box-shadow: none;
}

.lb-player {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.lb-name {
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-origin {
  font-size: 0.78rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-level-pill {
  flex-shrink: 0;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  color: #3730a3;
  background: #e0e7ff;
}

.lb-skeleton {
  display: flex;
  gap: 10px;
}

.lb-skeleton-card {
  flex: 1;
  height: 190px;
  border-radius: 18px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%);
  background-size: 400% 100%;
  animation: lb-shimmer 1.4s ease infinite;
}

@keyframes lb-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.lb-empty {
  text-align: center;
  padding: 40px 20px;
  border-radius: 18px;
  border: 1px dashed #cbd5e1;
  background: #ffffff;
}

.lb-empty-icon {
  font-size: 2.2rem;
}

.lb-empty h2 {
  margin-top: 8px;
}

.lb-empty p {
  color: #64748b;
  margin-bottom: 16px;
}

.lb-footnote {
  text-align: center;
  font-size: 0.78rem;
  color: #94a3b8;
  padding-bottom: 8px;
}

@media (max-width: 560px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .lb-hero {
    padding: 22px 18px 18px;
    border-radius: 18px;
  }

  .lb-hero h1 {
    font-size: 1.45rem;
  }

  .lb-hero-stats {
    gap: 6px;
  }

  .lb-stat strong {
    font-size: 1.05rem;
  }

  .lb-stat span {
    font-size: 0.62rem;
  }

  .lb-podium {
    flex-direction: column;
    align-items: stretch;
  }

  .lb-podium-card,
  .lb-podium-card.podium-1 {
    order: 0;
    max-width: none;
    min-height: 0;
    flex-direction: row;
    text-align: left;
    align-items: center;
    gap: 12px;
    padding: 16px 14px 16px 16px;
  }

  .lb-podium-card .lb-medal {
    top: 50%;
    left: 12px;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
  }

  .lb-podium-card .lb-avatar {
    margin-left: 26px;
    margin-bottom: 0;
  }

  .lb-podium-card .lb-podium-info {
    align-items: flex-start;
  }

  .lb-podium-card .lb-level-chip {
    margin-top: 0;
    margin-left: auto;
    white-space: nowrap;
  }

  .lb-podium-name,
  .lb-podium-origin {
    white-space: normal;
  }

  .lb-skeleton {
    flex-direction: column;
  }

  .lb-skeleton-card {
    height: 76px;
  }
}
```

#### Catatan CSS

- `.lb-cta` dipakai bersama `.btn`; style `a.btn` dari PR #4 membuat link tampil sebagai tombol. Jika branch belum punya `a.btn`, tambahkan:

  ```css
  a.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }
  ```

- `.lb-hero h1` sengaja menimpa margin global `h1`.
- Podium memakai `order` agar juara 1 tampil di tengah pada desktop. Di mobile, `order: 0` membuat urutan kembali 1 → 2 → 3.
- Semua class baru berprefix `lb-` atau khusus dashboard (`.admin-note`, `.form-grid`, `.day-filter`) sehingga tidak mengganggu `/play`.
- Jangan menghapus `.timer-*`, `.badge-*`, `.play-*`; halaman `/play` masih membutuhkannya.

---

### 7.9 File yang tidak boleh diubah

| File | Alasan |
| :--- | :--- |
| `app/play/page.js` | Timer dan alur player tetap sama. |
| `lib/session.js` | Hanya dipakai `/play`. |
| `lib/leaderboard.test.mjs` | Test lama harus tetap lulus. |
| `lib/session.test.mjs` | Test lama harus tetap lulus. |
| `app/layout.js` | Container tetap 640 px. |
| `types/leaderboard.ts` | Tidak ada field baru. |

**Catatan:** berbeda dari rencana sebelumnya, `app/api/leaderboard/route.js` dan `lib/leaderboard.js` **memang berubah** pada rencana ini karena filter hari.

---

## 8. Langkah Eksekusi (Checklist Berurutan)

### Langkah 1 — Pastikan basis branch benar

```bash
git checkout main
git pull
```

Jika PR #4 belum di-merge, buat branch dari `feature/halaman-user`:

```bash
git checkout feature/halaman-user
git pull
git checkout -b feature/dashboard-leaderboard-redesign
```

Jika PR #4 sudah di-merge, cukup buat branch baru dari `main`:

```bash
git checkout -b feature/dashboard-leaderboard-redesign
```

### Langkah 2 — Buat helper tanggal

1. Buat `lib/date.js` sesuai Bagian 7.1.
2. Buat `lib/date.test.mjs` sesuai Bagian 7.2.
3. Ubah script `test` di `package.json` sesuai Bagian 7.3.

### Langkah 3 — Jalankan test helper tanggal

```bash
npm test
```

Harus lulus **12 test**: 3 leaderboard + 3 session + 6 date.

### Langkah 4 — Ubah `lib/leaderboard.js`

Ubah `loadEntries` sesuai Bagian 7.4.

### Langkah 5 — Ubah API route

Ikuti Bagian 7.5:

1. Tambah import `getDayRange` dan `isValidDateKey`.
2. Ganti `listEntries`.
3. Ganti `GET`.
4. Tambah index `created_at`.

### Langkah 6 — Ganti dashboard

Ganti seluruh isi `app/dashboard/page.js` dengan kode Bagian 7.6.

### Langkah 7 — Ganti leaderboard

Ganti seluruh isi `app/leaderboard/page.js` dengan kode Bagian 7.7.

### Langkah 8 — Tambahkan CSS

Tambahkan blok CSS Bagian 7.8 di paling bawah `app/globals.css`.

### Langkah 9 — Jalankan dev server

```bash
npm run dev
```

Buka:

- `http://localhost:3000/dashboard`
- `http://localhost:3000/leaderboard`
- `http://localhost:3000/play`

### Langkah 10 — Uji manual

Ikuti skenario Bagian 9.3, termasuk uji data kemarin memakai SQL di Bagian 9.4.

### Langkah 11 — Build production

```bash
npm run build
```

Pastikan `/dashboard`, `/leaderboard`, dan `/play` berhasil dikompilasi.

### Langkah 12 — Review akhir

- Tidak ada sisa state timer di dashboard.
- Tidak ada `formatDuration` atau `player-time-badge` di leaderboard.
- Filter hari berfungsi di dashboard dan leaderboard.
- API `?date=` berfungsi dan validasi tanggal bekerja.
- Halaman `/play` tidak berubah perilakunya.
- Semua Acceptance Criteria Bagian 10 terpenuhi.

---

## 9. Rencana Pengujian

### 9.1 Unit test otomatis

```bash
npm test
```

Cakupan:

- 3 test leaderboard lama.
- 3 test session lama.
- 6 test tanggal baru:
  - `getDateKey` di batas tengah malam WIB,
  - `getYesterdayKey` pada pergantian bulan/tahun,
  - `getRelativeDayKey`,
  - `isValidDateKey`,
  - `getDayRange`,
  - `formatDateLabel`.

Total: **12 test, 0 gagal**.

### 9.2 Uji API dengan curl

```bash
# Semua entri (backward compatible)
curl "http://localhost:3000/api/leaderboard"

# Entri hari ini (gunakan tanggal WIB yang benar)
TZ=Asia/Jakarta date +%F
curl "http://localhost:3000/api/leaderboard?date=$(TZ=Asia/Jakarta date +%F)"

# Tanggal tidak valid harus 400
curl -i "http://localhost:3000/api/leaderboard?date=2026-02-31"
```

Yang diharapkan:

- Tanpa `date` → `200` dan `{ entries, date: null }`.
- Dengan `date` valid → `200` dan hanya entri pada tanggal tersebut.
- Dengan `date` tidak valid → `400 { error: "Format tanggal harus YYYY-MM-DD." }`.

### 9.3 Uji fungsional manual

| No | Skenario | Langkah | Hasil yang diharapkan |
| :-: | :--- | :--- | :--- |
| 1 | Dashboard tanpa timer | Buka `/dashboard` | Tidak ada countdown, tombol mulai, atau tombol stop |
| 2 | Filter default dashboard | Buka `/dashboard` | Filter "Hari Ini" aktif; daftar hanya peserta hari ini |
| 3 | Tambah peserta langsung | Isi nama, asal, level 15; biarkan durasi 300; klik tambah | Peserta langsung muncul di daftar hari ini; tidak perlu menunggu timer |
| 4 | Tambah saat filter Kemarin | Pilih "Kemarin", lalu tambah peserta | Setelah simpan, filter otomatis pindah ke "Hari Ini" dan peserta baru terlihat |
| 5 | Durasi default | Perhatikan input durasi saat form kosong | Nilai `300`, helper `05:00` |
| 6 | Tambah dengan durasi kustom | Isi durasi 90, simpan | Data tersimpan dengan durasi `01:30` |
| 7 | Validasi nama | Kosongkan nama, submit | Pesan error muncul; data tidak tersimpan |
| 8 | Validasi asal | Kosongkan asal, submit | Pesan error muncul |
| 9 | Validasi level | Isi level 0, submit | Pesan "Level harus berupa angka bulat minimal 1." |
| 10 | Validasi durasi | Isi durasi 301, submit | Pesan durasi 0–300 muncul |
| 11 | Edit peserta | Klik Edit pada baris | Form terisi nama, asal, level, durasi |
| 12 | Simpan edit | Ubah level/durasi, simpan | Baris berubah dan urutan menyesuaikan; tetap di filter yang sama |
| 13 | Batal edit | Klik "Batal Edit" | Form kembali kosong, data tidak berubah |
| 14 | Hapus peserta | Klik Hapus | Baris hilang dari dashboard dan leaderboard |
| 15 | Leaderboard default | Buka `/leaderboard` | Tab "Hari Ini" aktif; hanya peserta hari ini yang tampil |
| 16 | Tab Kemarin | Klik "Kemarin" | Hanya peserta kemarin yang tampil; label tanggal kemarin muncul |
| 17 | Tab Semua | Klik "Semua" | Semua peserta tampil; label "Semua Hari" |
| 18 | Leaderboard tanpa durasi | Buka `/leaderboard` | Tidak ada teks `⏱` atau `MM:SS` per peserta |
| 19 | Podium | Pastikan ada minimal 3 peserta di hari yang dipilih | Tiga besar tampil sebagai kartu podium; juara 1 di tengah pada desktop |
| 20 | Daftar #4+ | Pastikan ada lebih dari 3 peserta | Peringkat 4 dan seterusnya tampil di daftar kartu |
| 21 | Statistik hero | Perhatikan hero | Jumlah peserta, level tertinggi, dan nama puncak sesuai hari yang dipilih |
| 22 | Auto-refresh per tab | Tambah peserta dari dashboard, tunggu 10 detik di leaderboard | Tab aktif ter-update tanpa reload |
| 23 | Loading state | Pindah tab dengan koneksi lambat | Skeleton tampil, bukan data hari sebelumnya |
| 24 | Empty state hari ini | Pastikan tidak ada peserta hari ini | "Belum ada peserta hari ini" + CTA "Main Sekarang" |
| 25 | Empty state kemarin | Pilih "Kemarin" saat kosong | "Belum ada peserta kemarin" + tombol "Lihat Hari Ini" |
| 26 | Mobile | Buka `/leaderboard` di lebar 375 px | Hero, tab, podium, dan daftar tidak terpotong; podium vertikal |
| 27 | Regresi `/play` | Buka `/play`, jalankan sesi | Countdown, early finish, dan simpan tetap berfungsi; peserta masuk hari ini |
| 28 | Regresi tie-breaker | Dua peserta level sama, durasi berbeda | Durasi lebih kecil tetap di atas |
| 29 | Tanpa parameter date | `curl /api/leaderboard` | Semua entri tetap tampil seperti sebelumnya |

### 9.4 Membuat data "kemarin" untuk pengujian

Jangan mengubah data production. Gunakan database/branch Neon test, atau buat entri khusus lalu hapus setelah selesai.

```sql
-- Jalankan di Neon SQL Editor
INSERT INTO leaderboard_entries
  (id, name, origin, level, duration_seconds, created_at)
VALUES
  ('test-kemarin', 'Test Kemarin', 'SMK Test', 9, 120, NOW() - INTERVAL '1 day');
```

Setelah selesai:

```sql
DELETE FROM leaderboard_entries WHERE id = 'test-kemarin';
```

Verifikasi:

- Tab "Hari Ini" tidak menampilkan `Test Kemarin`.
- Tab "Kemarin" menampilkan `Test Kemarin`.
- Dashboard filter "Kemarin" menampilkan `Test Kemarin`.
- Dashboard filter "Semua" juga menampilkannya.

---

## 10. Acceptance Criteria

- [ ] Dashboard tidak lagi menampilkan countdown, tombol mulai, atau tombol stop.
- [ ] Admin dapat menambahkan peserta langsung dari dashboard.
- [ ] Form dashboard memiliki nama, asal, level, dan durasi (default 300).
- [ ] Edit dan hapus peserta tetap berfungsi.
- [ ] `saveEntry`, `updateEntry`, dan `deleteEntry` tetap memakai API yang ada.
- [ ] Dashboard memiliki filter Hari Ini / Kemarin / Semua.
- [ ] Leaderboard tidak menampilkan durasi per peserta.
- [ ] Leaderboard memiliki tab Hari Ini / Kemarin / Semua dengan default Hari Ini.
- [ ] Leaderboard menampilkan hero, statistik, podium 3 besar, dan daftar peringkat 4+.
- [ ] Label tanggal/hari tampil sesuai tab yang dipilih.
- [ ] Filter hari menggunakan zona waktu Asia/Jakarta.
- [ ] API mendukung `GET /api/leaderboard?date=YYYY-MM-DD`.
- [ ] Tanpa parameter `date`, API tetap mengembalikan semua entri.
- [ ] Tanggal tidak valid menghasilkan `400`.
- [ ] Index `created_at` ditambahkan di `ensureSchema`.
- [ ] Peserta baru dari dashboard selalu masuk hari ini dan dashboard berpindah ke filter Hari Ini.
- [ ] Leaderboard tetap auto-refresh setiap 10 detik untuk tab aktif.
- [ ] Loading skeleton dan empty state tampil sesuai kondisi.
- [ ] Tampilan nyaman di lebar 375 px dan desktop.
- [ ] Halaman `/play` dan countdown tetap berfungsi.
- [ ] Aturan ranking tidak berubah.
- [ ] Tidak ada perubahan skema database (tidak ada kolom baru).
- [ ] `npm test` lulus 12/12.
- [ ] `npm run build` sukses.
- [ ] Tidak ada dependency baru.

---

## 11. Pitfalls yang Sering Terjadi

1. **Menggunakan zona waktu perangkat**
   Jangan memakai `new Date(created_at).toDateString()` atau `getDate()` mentah untuk grouping. Perangkat pengunjung bisa berbeda zona waktu. Gunakan `getDateKey`/`getRelativeDayKey` dari `lib/date.js`.

2. **Lupa mengirim `date` ke API**
   `loadEntries(dateKey)` harus menerima date key. Jika tidak, semua tab akan menampilkan data yang sama.

3. **Filter hanya di client**
   Jangan memfilter array hasil `loadEntries()` tanpa parameter. API hanya mengembalikan 100 entri; data hari tertentu bisa terpotong.

4. **Batas hari salah**
   `getDayRange("2026-11-08")` harus menghasilkan `2026-11-07T17:00:00Z` sampai `2026-11-08T17:00:00Z`. Jangan memakai tengah malam UTC.

5. **Menambah peserta saat filter Kemarin**
   Peserta baru selalu `created_at = now` (hari ini). Setelah menambah, pindahkan filter ke "Hari Ini", jika tidak peserta baru tidak terlihat.

6. **Mengedit `created_at` tanpa sengaja**
   API `PUT` tidak mengubah `created_at`. Jangan menambahkan field itu ke payload update.

7. **Daftar lama tampil saat pindah tab**
   Kosongkan `entries` dan set `loading = true` saat tab berubah agar skeleton tampil, bukan data hari sebelumnya.

8. **Interval ganda**
   Effect leaderboard bergantung pada `selectedDay`. Cleanup harus `clearInterval` dan set `active = false`.

9. **Midnight boundary**
   Saat halaman terbuka melewati tengah malam, `getRelativeDayKey` di dalam `refreshData` akan menghasilkan tanggal baru pada refresh berikutnya. Label hari ikut ter-update setelah state berubah. Jangan menyimpan date key sekali di module scope.

10. **`created_at` adalah waktu simpan, bukan waktu mulai sesi**
    Sesi yang dimulai 23:58 dan disimpan 00:01 akan tercatat di hari berikutnya. Ini dapat diterima untuk kebutuhan saat ini. Jika ingin berdasarkan waktu mulai, tambahkan kolom `session_started_at` (Bagian 12).

11. **Validasi tanggal**
    `isValidDateKey` harus menolak tanggal seperti `2026-02-31`, bukan hanya formatnya. Jangan hanya memakai regex.

12. **Index tidak terpakai**
    Pastikan `CREATE INDEX ... ON leaderboard_entries (created_at)` dijalankan di `ensureSchema`. Tanpa index, query tetap benar tetapi lebih lambat saat data banyak.

13. **Menghapus CSS timer**
    Jangan hapus `.timer-*` atau `.badge-*`; `/play` memakainya.

14. **Podium berantakan di mobile**
    Pastikan media query `max-width: 560px` mengubah `.lb-podium` menjadi kolom dan mereset `order` menjadi `0`.

15. **Nama panjang merusak layout**
    Gunakan `min-width: 0` pada container flex dan `text-overflow: ellipsis` pada nama/origin.

16. **Hydration mismatch**
    Jangan memakai `Date` atau `toLocaleTimeString` saat render awal. Di kode ini, `lastUpdated` baru diisi di dalam `useEffect`, sehingga aman.

17. **State update setelah unmount**
    `active` flag di `useEffect` leaderboard mencegah `setEntries` setelah komponen unmount.

18. **Mengubah API untuk menghapus durasi**
    Jangan. Durasi masih dipakai untuk sorting. Cukup sembunyikan dari tampilan leaderboard.

19. **Double submit**
    Gunakan `saving` untuk menonaktifkan tombol dan mencegah data ganda.

20. **Menganggap `loadEntries` selalu sukses**
    `loadEntries` mengembalikan `[]` jika response gagal. UI akan menampilkan empty state; ini perilaku yang dapat diterima.

---

## 12. Pekerjaan Opsional untuk Iterasi Berikutnya

Jangan dikerjakan pada task ini kecuali diminta:

1. **Date picker bebas** untuk melihat hari-hari sebelumnya.
2. **Filter rentang tanggal** (mingguan/bulanan).
3. **Leaderboard mingguan/bulanan** dengan tab tambahan.
4. **Kolom `session_started_at`** jika pengelompokan harus mengikuti waktu mulai bermain, bukan waktu simpan.
5. **Pagination** jika peserta per hari lebih dari 100.
6. **Mode layar besar/TV** untuk leaderboard di stand.
7. **Animasi masuk** untuk baris leaderboard saat data berubah.
8. **QR code** menuju `/play` di hero.
9. **Admin authentication** untuk `/dashboard`.
10. **Soft delete / audit log** untuk perubahan data.
11. **Cache API per tanggal** untuk mengurangi query saat ramai.

---

## 13. Ringkasan File Akhir Setelah Implementasi

```
app/
  dashboard/
    page.js            ← GANTI: CRUD tanpa timer + filter hari
  leaderboard/
    page.js            ← GANTI: hero + tab hari + podium + daftar, tanpa durasi
  play/
    page.js            ← tidak berubah
  api/leaderboard/
    route.js           ← UBAH: GET ?date=, filter SQL, index created_at
  globals.css          ← TAMBAH: .admin-note, .form-grid, .day-filter, .lb-*
  layout.js            ← tidak berubah
lib/
  leaderboard.js       ← UBAH: loadEntries(dateKey)
  date.js              ← BARU
  date.test.mjs        ← BARU
  session.js           ← tidak berubah
  leaderboard.test.mjs ← tidak berubah
  session.test.mjs     ← tidak berubah
package.json           ← UBAH: test mencakup date.test.mjs
```

Selesai. Setelah checklist dan pengujian terpenuhi, dashboard bisa dipakai untuk input cepat tanpa timer, leaderboard tampil lebih menarik tanpa durasi, dan peserta dipisahkan berdasarkan hari (hari ini, kemarin, semua) menggunakan zona waktu Asia/Jakarta.
