# [ISSUE / PLAN] Halaman Player Mandiri — Input Identitas, Countdown 5 Menit, Input Level

> **Status:** Rencana implementasi (belum dikerjakan)
>
> **Basis kode:** branch `main`, commit `b88ef56`
>
> **Dokumen ini menggantikan** `issue.md` sebelumnya. Fitur pada dokumen lama (timer dashboard admin + tie-breaker leaderboard) **sudah diimplementasikan** dan menjadi dasar fitur baru ini.
>
> **Target pembaca:** junior programmer atau AI coding model dengan konteks terbatas.

## Cara memakai dokumen ini

1. Baca Bagian 1–4 untuk memahami tujuan dan keputusan desain.
2. Implementasikan file sesuai urutan di Bagian 8 (checklist).
3. Jangan mengubah file di luar daftar Bagian 6 tanpa alasan kuat.
4. Jalankan seluruh pengujian di Bagian 9 sebelum menyatakan selesai.
5. Cocokkan hasil akhir dengan Acceptance Criteria di Bagian 10.

---

## 1. Ringkasan Fitur & Latar Belakang

Saat ini, pencatatan peserta hanya bisa dilakukan lewat **dashboard admin** (`/dashboard`). Admin harus mengetik nama dan asal peserta, menjalankan timer, lalu menyimpan hasil. Untuk stand pameran, ini membuat satu orang (admin) menjadi bottleneck dan rawan salah input.

Fitur baru: **halaman player mandiri** di route `/play` agar peserta bisa:

1. Mengisi **nama** dan **asal sekolah/jurusan** sendiri.
2. Menekan tombol **Mulai**.
3. Melihat **countdown 5 menit (05:00 → 00:00)** berjalan di layar.
4. Setelah countdown selesai (atau peserta menyelesaikan permainan lebih awal), mengisi **level tertinggi yang berhasil dilewati**.
5. Menyimpan hasil ke leaderboard yang sama dengan dashboard admin.

Halaman ini **tidak membuat tabel atau API baru**. Semua data tetap masuk ke `leaderboard_entries` melalui `POST /api/leaderboard` yang sudah ada.

### Hasil yang diharapkan

- Peserta bisa mencatat skor tanpa bantuan admin.
- Data yang masuk tetap lengkap: `name`, `origin`, `level`, `duration_seconds`.
- Aturan ranking tetap: **Level tertinggi → durasi tercepat → waktu input paling awal**.
- Refresh halaman di tengah sesi tidak menghilangkan timer (dipulihkan dari `localStorage`).
- Dashboard admin dan halaman leaderboard publik tidak rusak.

---

## 2. Kondisi Project Saat Ini (Hasil Inspeksi)

Stack dan struktur yang relevan:

| Item | Kondisi saat ini |
| :--- | :--- |
| Framework | Next.js `16.4.5` App Router |
| React | `19.x` |
| Bahasa | JavaScript murni (`.js`), bukan TypeScript build |
| Styling | CSS global di `app/globals.css` (tanpa Tailwind) |
| Database | Neon Postgres via `@neondatabase/serverless` |
| Test | `node --test lib/leaderboard.test.mjs` |
| Home `/` | Redirect ke `/leaderboard` |

### 2.1 File yang sudah ada dan bisa dipakai ulang

| File | Isi yang relevan |
| :--- | :--- |
| `app/api/leaderboard/route.js` | `GET`, `POST`, `PUT`, `DELETE`. Sudah memvalidasi lewat `parseEntry()`. `POST` menerima `{ name, origin, level, duration_seconds }`. |
| `lib/leaderboard.js` | `formatDuration(seconds)`, `sortLeaderboard(entries)`, `parseEntry(...)`, `loadEntries()`, `saveEntry(name, origin, levelInput, durationInput)`, `updateEntry(...)`, `deleteEntry(...)`. |
| `lib/leaderboard.test.mjs` | 3 test: format durasi, tie-breaker, validasi & update/delete. |
| `app/leaderboard/page.js` | Leaderboard publik, auto-refresh tiap 10 detik, menampilkan nama, asal, level, durasi. |
| `app/dashboard/page.js` | Dashboard admin dengan timer `idle → running → stopped`, edit, dan hapus. |
| `app/globals.css` | Sudah ada style `.card`, `.form-group`, `.btn`, `.timer-box`, `.timer-display`, `.badge-live`, `.badge-done`, `.player-*`, dll. |
| `types/leaderboard.ts` | Hanya referensi tipe. Tidak dipakai saat runtime karena project berjalan sebagai JavaScript. |

### 2.2 Kontrak API yang sudah tersedia (JANGAN diubah)

`POST /api/leaderboard`

```json
{
  "name": "Budi",
  "origin": "SMKN 1 Surabaya",
  "level": 12,
  "duration_seconds": 95
}
```

Aturan validasi server (sudah ada di `parseEntry`):

- `name` wajib, tidak boleh kosong setelah `trim`.
- `origin` wajib, tidak boleh kosong setelah `trim`.
- `level` harus bilangan bulat ≥ 1.
- `duration_seconds` harus angka 0–300.
- `id` dan `created_at` dibuat otomatis.

Response sukses `POST`: `{ entries, entry }` dengan status `201`.
Response gagal validasi: `{ error }` dengan status `400`.

### 2.3 Kesimpulan penting

**Tidak perlu migrasi database dan tidak perlu mengubah API.** Fitur ini murni penambahan halaman client-side yang memakai `saveEntry()` yang sudah ada.

---

## 3. Alur Pengguna & State Machine

Route baru: **`/play`**

```
┌─────────┐   isi nama + asal, klik "Mulai"   ┌──────────┐
│  form   │ ────────────────────────────────► │ running  │
└─────────┘                                   └──────────┘
     ▲                                          │      │
     │                                          │      │ countdown 00:00
     │                                          │      ▼
     │                                          │  ┌──────────┐
     │                                          │  │ finished │
     │                                          │  └──────────┘
     │                                          │      │
     │        klik "Selesai & Input Level"      │      │ isi level,
     │        (minimal 5 detik)                 │      │ klik "Simpan"
     │                                          ▼      ▼
     │                                     ┌──────────┐
     └──────────────────────────────────── │  saved   │
              "Pemain Berikutnya"          └──────────┘
```

| Phase | Yang terlihat | Aksi yang tersedia |
| :--- | :--- | :--- |
| `form` | Form nama + asal | `Mulai (5 Menit)` |
| `running` | Countdown besar `MM:SS`, nama & asal, badge "SESI BERJALAN" | `Selesai & Input Level`, `Batalkan` |
| `finished` | Durasi bermain, form level | `Simpan ke Leaderboard`, `Batal` |
| `saved` | Ringkasan level, waktu, peringkat | `Lihat Leaderboard`, `Pemain Berikutnya` |

### Aturan transisi

- `form → running`: hanya jika `name.trim()` dan `origin.trim()` tidak kosong.
- `running → finished`:
  - otomatis saat sisa waktu mencapai `0`, **atau**
  - manual lewat tombol "Selesai & Input Level", minimal setelah **5 detik** bermain.
- `finished → saved`: hanya jika `level` valid (bilangan bulat ≥ 1) dan request `POST` sukses.
- `saved → form`: tombol "Pemain Berikutnya" mereset seluruh state.
- `running/finished → form`: tombol "Batalkan"/"Batal" (konfirmasi jika sedang running).

### Perilaku saat refresh

State sesi disimpan di `localStorage` dengan key `lab-sisfo:active-session`:

```json
{
  "name": "Budi",
  "origin": "SMKN 1 Surabaya",
  "startTime": 1730000000000,
  "finishedAt": null
}
```

- Refresh saat `running` → hitung ulang sisa waktu dari `startTime`, lanjutkan countdown.
- Refresh saat `finished` → tetap di form level dengan durasi yang sama (`finishedAt` tersimpan).
- Refresh saat `saved` → `localStorage` sudah dibersihkan, kembali ke `form`.

---

## 4. Keputusan Desain (Wajib Dibaca Sebelum Coding)

### 4.1 Tombol "Selesai & Input Level" (early finish) itu penting

Tanpa tombol ini, semua peserta yang memakai `/play` akan selalu mendapat `duration_seconds = 300`. Akibatnya, tie-breaker "durasi tercepat" tidak pernah membedakan peserta — yang membedakan hanya `created_at`, sehingga peserta yang mencatat lebih dulu justru menang. Itu tidak adil.

Karena itu alurnya:

- Countdown 5 menit adalah **batas maksimal**.
- Peserta yang selesai lebih cepat menekan **"Selesai & Input Level"**.
- Durasi yang disimpan = waktu berjalan sejak `startTime` sampai tombol ditekan.
- Jika countdown habis, durasi = `300`.

### 4.2 Timer dihitung dari timestamp, bukan decrement state

Jangan lakukan `setRemaining(remaining - 1)` setiap detik. Saat tab di-background atau laptop sleep, interval bisa melambat. Yang benar:

```js
remaining = 300 - Math.floor((Date.now() - startTime) / 1000)
```

Dengan cara ini, timer tetap akurat dan otomatis "mengejar" waktu yang terlewat.

### 4.3 `localStorage` hanya diakses di client

Next.js tetap melakukan server-side rendering untuk client component. Jangan membaca `localStorage` di:

- body component,
- `useState(() => localStorage.getItem(...))`,
- module scope.

Baca hanya di dalam `useEffect` atau event handler (`onClick`, `onSubmit`). Jika tidak, muncul error `localStorage is not defined` saat SSR.

### 4.4 Tidak ada autentikasi

`/play` memang publik agar peserta bisa memakai sendiri. Ini konsisten dengan kondisi project saat ini yang belum punya login. Jangan menambahkan auth pada task ini.

### 4.5 Validasi & keamanan

- Validasi utama tetap di server (`parseEntry`). Form player hanya validasi UX.
- Level bersifat **self-reported** dan durasi dihitung di client, jadi secara teknis bisa dimanipulasi (misalnya lewat DevTools atau memanggil API langsung). Untuk stand lab dengan pengawasan, ini dapat diterima.
- Jangan menambah kolom database baru untuk task ini. Pengerasan server-side (session token) dicatat sebagai pekerjaan opsional di Bagian 12.

### 4.6 Dashboard admin tidak diubah besar-besaran

Dashboard sudah punya timer sendiri. Pada task ini dashboard hanya ditambah **link** ke `/play` agar tidak terjadi regresi. Refactor dashboard agar memakai helper yang sama dicatat sebagai pekerjaan opsional.

---

## 5. Scope & Non-Scope

### Termasuk scope

- Halaman baru `/play` dengan alur form → countdown → input level → simpan.
- Helper timer murni + unit test.
- Pemulihan sesi dari `localStorage`.
- Style halaman player.
- Link navigasi dari `/leaderboard` dan `/dashboard` ke `/play`.
- Update script test agar menjalankan test baru.

### Di luar scope

- Migrasi database atau kolom baru.
- Perubahan aturan ranking.
- Login/admin authorization.
- WebSocket/real-time leaderboard (polling 10 detik sudah ada).
- Anti-cheat server-side.
- Perubahan besar pada dashboard admin.

---

## 6. Rencana Perubahan File

| File | Aksi | Keterangan |
| :--- | :---: | :--- |
| `lib/session.js` | **Baru** | Konstanta dan helper murni timer + parser `localStorage`. |
| `lib/session.test.mjs` | **Baru** | Unit test untuk helper timer. |
| `package.json` | **Ubah** | Script `test` menjalankan dua file test. |
| `app/play/page.js` | **Baru** | Halaman player mandiri. |
| `app/globals.css` | **Ubah** | Style halaman player, `.btn-primary`, `.header-links`. |
| `app/leaderboard/page.js` | **Ubah kecil** | Tambah link ke `/play`. |
| `app/dashboard/page.js` | **Ubah kecil** | Tambah link ke `/play`. |
| `app/api/leaderboard/route.js` | Tidak diubah | Sudah mendukung semua field. |
| `lib/leaderboard.js` | Tidak diubah | `formatDuration` dan `saveEntry` dipakai ulang. |
| `types/leaderboard.ts` | Tidak diubah | Interface sudah sesuai. |
| `app/page.js` | Tidak diubah | Tetap redirect ke `/leaderboard`. |

---

## 7. Implementasi Detail per File

### 7.1 File baru: `lib/session.js`

Buat file ini persis seperti berikut. Tujuannya memisahkan logika waktu dari komponen React agar mudah diuji tanpa browser.

```javascript
/**
 * Konstanta & helper murni untuk sesi permainan player.
 * File ini sengaja tidak menyentuh DOM/localStorage agar mudah diuji.
 */

export const TOTAL_COUNTDOWN_SECONDS = 300; // 5 menit
export const SESSION_STORAGE_KEY = "lab-sisfo:active-session";

/**
 * Menghitung detik yang sudah berlalu sejak startTime.
 * Hasil selalu dibulatkan ke bawah dan dijepit di rentang 0..300.
 */
export function getElapsedSeconds(startTime, now = Date.now()) {
  const started = Number(startTime);
  if (!Number.isFinite(started) || started <= 0) return 0;

  const elapsed = Math.floor((Number(now) - started) / 1000);
  return Math.min(Math.max(elapsed, 0), TOTAL_COUNTDOWN_SECONDS);
}

/**
 * Sisa waktu countdown. 300 detik di awal, 0 saat habis.
 */
export function getRemainingSeconds(startTime, now = Date.now()) {
  return TOTAL_COUNTDOWN_SECONDS - getElapsedSeconds(startTime, now);
}

/**
 * Membaca sesi dari string JSON localStorage.
 * Mengembalikan null jika data tidak valid/korup.
 */
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
  const startTime = Number(data?.startTime);

  if (!name || !origin) return null;
  if (!Number.isFinite(startTime) || startTime <= 0) return null;

  const finishedAtRaw = Number(data?.finishedAt);
  const finishedAt =
    Number.isFinite(finishedAtRaw) && finishedAtRaw > 0 ? finishedAtRaw : null;

  return { name, origin, startTime, finishedAt };
}
```

---

### 7.2 File baru: `lib/session.test.mjs`

```javascript
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
```

---

### 7.3 Ubah `package.json`

Saat ini script test hanya menjalankan satu file:

```json
"test": "node --test lib/leaderboard.test.mjs"
```

Ubah menjadi:

```diff
-    "test": "node --test lib/leaderboard.test.mjs"
+    "test": "node --test lib/leaderboard.test.mjs lib/session.test.mjs"
```

---

### 7.4 File baru: `app/play/page.js`

Ini komponen utama halaman player. Salin **persis**, lalu sesuaikan hanya jika ada kebutuhan produk yang berubah.

```jsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDuration, saveEntry } from "../../lib/leaderboard";
import {
  SESSION_STORAGE_KEY,
  TOTAL_COUNTDOWN_SECONDS,
  getElapsedSeconds,
  getRemainingSeconds,
  parseStoredSession,
} from "../../lib/session";

const MIN_EARLY_FINISH_SECONDS = 5;

export default function PlayPage() {
  // phase: "form" | "running" | "finished" | "saved"
  const [phase, setPhase] = useState("form");

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [level, setLevel] = useState("");

  const [startTime, setStartTime] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(
    TOTAL_COUNTDOWN_SECONDS
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState(null);

  const intervalRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Menyelesaikan sesi: hitung durasi dari timestamp, lalu simpan status finished.
  const finishSession = useCallback(
    (startedAt, finishedAt = Date.now()) => {
      clearTimer();

      const elapsed = getElapsedSeconds(startedAt, finishedAt);
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
              name: stored.name,
              origin: stored.origin,
              startTime: stored.startTime,
              finishedAt,
            })
          );
        }
      } catch {
        // localStorage tidak tersedia (mode privat); sesi tetap jalan di memori.
      }
    },
    [clearTimer]
  );

  // Pulihkan sesi setelah refresh / tidak sengaja menutup tab.
  useEffect(() => {
    let stored = null;
    try {
      stored = parseStoredSession(localStorage.getItem(SESSION_STORAGE_KEY));
    } catch {
      stored = null;
    }

    if (stored) {
      setName(stored.name);
      setOrigin(stored.origin);
      setStartTime(stored.startTime);

      if (stored.finishedAt) {
        setDurationSeconds(
          getElapsedSeconds(stored.startTime, stored.finishedAt)
        );
        setRemainingSeconds(0);
        setPhase("finished");
      } else {
        const elapsed = getElapsedSeconds(stored.startTime, Date.now());
        if (elapsed >= TOTAL_COUNTDOWN_SECONDS) {
          finishSession(
            stored.startTime,
            stored.startTime + TOTAL_COUNTDOWN_SECONDS * 1000
          );
        } else {
          setRemainingSeconds(TOTAL_COUNTDOWN_SECONDS - elapsed);
          setPhase("running");
        }
      }
    }

    return clearTimer;
  }, [clearTimer, finishSession]);

  // Tick countdown. Selalu dihitung dari startTime agar tidak drift.
  useEffect(() => {
    if (phase !== "running" || !startTime) return;

    clearTimer();
    intervalRef.current = setInterval(() => {
      const left = getRemainingSeconds(startTime, Date.now());
      if (left <= 0) {
        finishSession(
          startTime,
          startTime + TOTAL_COUNTDOWN_SECONDS * 1000
        );
      } else {
        setRemainingSeconds(left);
      }
    }, 250);

    return clearTimer;
  }, [phase, startTime, clearTimer, finishSession]);

  function handleStart(event) {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanOrigin = origin.trim();

    if (!cleanName) {
      setError("Nama wajib diisi sebelum mulai.");
      return;
    }
    if (!cleanOrigin) {
      setError("Asal sekolah/jurusan wajib diisi sebelum mulai.");
      return;
    }

    const now = Date.now();
    setStartTime(now);
    setRemainingSeconds(TOTAL_COUNTDOWN_SECONDS);
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
          startTime: now,
          finishedAt: null,
        })
      );
    } catch {
      // Abaikan jika localStorage diblokir.
    }
  }

  function handleFinishEarly() {
    if (!startTime) return;

    const elapsed = getElapsedSeconds(startTime, Date.now());
    if (elapsed < MIN_EARLY_FINISH_SECONDS) {
      setError(
        `Tunggu minimal ${MIN_EARLY_FINISH_SECONDS} detik sebelum menyelesaikan sesi.`
      );
      return;
    }

    setError("");
    finishSession(startTime);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (phase !== "finished") {
      setError("Sesi belum selesai. Selesaikan countdown terlebih dahulu.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveEntry(name, origin, level, durationSeconds);

      if (result?.error) {
        setError(result.error);
        return;
      }
      if (!result?.entry) {
        setError("Respons server tidak valid. Coba lagi.");
        return;
      }

      const entries = Array.isArray(result.entries) ? result.entries : [];
      const rank = entries.findIndex((item) => item.id === result.entry.id) + 1;

      setSavedInfo({
        name: result.entry.name,
        origin: result.entry.origin,
        level: result.entry.level,
        duration: result.entry.duration_seconds,
        rank,
        total: entries.length,
      });
      setPhase("saved");

      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Abaikan.
      }
    } catch {
      setError("Gagal menyimpan data. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  function handlePlayAgain() {
    clearTimer();
    setPhase("form");
    setName("");
    setOrigin("");
    setLevel("");
    setStartTime(null);
    setDurationSeconds(0);
    setRemainingSeconds(TOTAL_COUNTDOWN_SECONDS);
    setSavedInfo(null);
    setError("");
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Abaikan.
    }
  }

  function handleCancel() {
    if (
      phase === "running" &&
      !window.confirm("Sesi sedang berjalan. Yakin ingin membatalkan?")
    ) {
      return;
    }
    handlePlayAgain();
  }

  return (
    <section>
      <div className="header-row">
        <div>
          <h1>Main Sekarang</h1>
          <p className="subtitle">Laboratorium Sistem Informasi</p>
        </div>
        <Link href="/leaderboard" className="link-btn">
          Lihat Leaderboard
        </Link>
      </div>

      {phase === "form" && (
        <form className="card" onSubmit={handleStart}>
          <h2>Isi Identitas Peserta</h2>
          <p className="play-note">
            Isi nama dan asal sekolah/jurusan, lalu tekan mulai. Waktu bermain
            maksimal 5 menit.
          </p>

          {error && <p className="msg-error">{error}</p>}

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

          <button type="submit" className="btn btn-primary btn-block">
            Mulai (5 Menit)
          </button>
        </form>
      )}

      {phase === "running" && (
        <div className="card play-card">
          <div className="timer-header">
            <span className="timer-label">Sisa waktu bermain</span>
            <span className="badge-live">SESI BERJALAN</span>
          </div>

          <div
            className={`timer-display ${
              remainingSeconds <= 30 ? "timer-warning" : ""
            }`}
          >
            {formatDuration(remainingSeconds)}
          </div>

          <p className="play-identity">
            {name} &middot; {origin}
          </p>
          <p className="play-note">
            Timer berjalan otomatis. Jangan tutup atau muat ulang halaman ini.
          </p>

          {error && <p className="msg-error">{error}</p>}

          <div className="timer-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFinishEarly}
            >
              Selesai &amp; Input Level
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
            >
              Batalkan
            </button>
          </div>
        </div>
      )}

      {phase === "finished" && (
        <form className="card" onSubmit={handleSubmit}>
          <div className="timer-header">
            <span className="timer-label">Sesi selesai</span>
            <span className="badge-done">SESI SELESAI</span>
          </div>

          <p className="play-result">
            Waktu bermain: <strong>{formatDuration(durationSeconds)}</strong> (
            {durationSeconds} detik)
          </p>
          <p className="play-identity">
            {name} &middot; {origin}
          </p>

          {error && <p className="msg-error">{error}</p>}

          <div className="form-group" style={{ marginTop: "16px" }}>
            <label htmlFor="player-level">
              Level tertinggi yang berhasil dilewati
            </label>
            <input
              id="player-level"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Contoh: 12"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              required
              autoFocus
            />
            <small className="help-text">
              Masukkan angka level terakhir yang berhasil kamu lewati.
            </small>
          </div>

          <div className="action-row">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan ke Leaderboard"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {phase === "saved" && savedInfo && (
        <div className="card play-success">
          <h2>Terima kasih, {savedInfo.name}!</h2>
          <p>Data kamu sudah masuk ke leaderboard.</p>

          <div className="play-success-grid">
            <div>
              <span>Level</span>
              <strong>{savedInfo.level}</strong>
            </div>
            <div>
              <span>Waktu</span>
              <strong>{formatDuration(savedInfo.duration)}</strong>
            </div>
            <div>
              <span>Peringkat</span>
              <strong>
                {savedInfo.rank > 0 ? `#${savedInfo.rank}` : "-"}
              </strong>
            </div>
          </div>

          <div className="action-row" style={{ marginTop: "16px" }}>
            <Link href="/leaderboard" className="btn">
              Lihat Leaderboard
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePlayAgain}
            >
              Pemain Berikutnya
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
```

#### Catatan implementasi penting

- Tombol **"Selesai & Input Level"** wajib ada. Tanpa tombol ini, tie-breaker durasi tidak akan pernah bekerja untuk halaman player (semua peserta mendapat 300 detik).
- Jangan memindahkan pembacaan `localStorage` ke luar `useEffect`/event handler.
- Jangan mengganti perhitungan timer dengan decrement state. Selalu pakai `getRemainingSeconds(startTime, Date.now())`.
- Interval berjalan setiap **250 ms** agar transisi ke `00:00` tidak terlambat, tetapi angka yang ditampilkan tetap berubah per detik.
- Saat `finishSession` dipanggil karena countdown habis, gunakan `startTime + 300000` sebagai `finishedAt` supaya durasi tepat 300 detik meskipun tab sempat tertidur.
- `saveEntry` mengembalikan `{ error }` jika validasi server gagal. Selalu cek `result?.error` sebelum membaca `result.entry`.

---

### 7.5 Ubah `app/globals.css`

Tambahkan blok berikut di **paling bawah** file. Jangan menghapus style yang sudah ada.

```css
/* ===== Halaman Player (/play) ===== */
.header-links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.play-card {
  text-align: center;
}

.play-identity {
  font-weight: 600;
  color: #334155;
  margin-bottom: 4px;
}

.play-note {
  font-size: 0.85rem;
  color: #64748b;
  margin: 8px 0 16px;
}

.play-result {
  font-size: 1rem;
  margin: 8px 0 4px;
  color: #166534;
}

.timer-warning {
  color: #dc2626;
}

.btn-primary {
  background: #2563eb;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-block {
  width: 100%;
}

a.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.play-success {
  text-align: center;
}

.play-success-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.play-success-grid > div {
  background: #f1f5f9;
  border-radius: 8px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.play-success-grid span {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.play-success-grid strong {
  font-size: 1.15rem;
}

.play-success .action-row {
  justify-content: center;
  flex-wrap: wrap;
}
```

Efek samping yang aman:

- `.btn-primary` juga dipakai tombol "Mulai Sesi (5 Menit)" di dashboard; tombol itu akan berwarna biru. Ini perbaikan visual, bukan regresi.
- `a.btn` membuat link yang memakai class `.btn` (tombol "Lihat Leaderboard") tampil sebagai tombol.
- `.header-links` dipakai pada perubahan navigasi di Bagian 7.6 dan 7.7.

---

### 7.6 Ubah kecil `app/leaderboard/page.js`

Cari bagian header:

```jsx
        <Link href="/dashboard" className="link-btn">
          Kelola (Admin)
        </Link>
```

Ganti menjadi:

```jsx
        <div className="header-links">
          <Link href="/play" className="link-btn">
            Main
          </Link>
          <Link href="/dashboard" className="link-btn">
            Kelola (Admin)
          </Link>
        </div>
```

Tidak ada perubahan logika. Polling 10 detik yang sudah ada tetap dipertahankan.

---

### 7.7 Ubah kecil `app/dashboard/page.js`

Cari bagian header:

```jsx
        <Link href="/leaderboard" className="link-btn">
          Lihat Leaderboard Public
        </Link>
```

Ganti menjadi:

```jsx
        <div className="header-links">
          <Link href="/play" className="link-btn">
            Halaman Player
          </Link>
          <Link href="/leaderboard" className="link-btn">
            Lihat Leaderboard Public
          </Link>
        </div>
```

Selain itu **jangan mengubah dashboard**. Timer, edit, dan hapus yang sudah ada harus tetap berfungsi.

---

### 7.8 File yang tidak boleh diubah pada task ini

| File | Alasan |
| :--- | :--- |
| `app/api/leaderboard/route.js` | Schema dan validasi sudah lengkap. |
| `lib/leaderboard.js` | `formatDuration`, `parseEntry`, `saveEntry` sudah sesuai. |
| `lib/leaderboard.test.mjs` | Test lama harus tetap lulus tanpa perubahan. |
| `app/page.js` | Tetap redirect ke `/leaderboard`. |
| `types/leaderboard.ts` | Tidak ada field baru. |

Jika ada bug di file-file tersebut, buat issue terpisah. Jangan campur dengan fitur ini.

---

## 8. Langkah Eksekusi (Checklist Berurutan)

Kerjakan dari atas ke bawah. Jangan melompat.

### Langkah 1 — Pastikan branch bersih

```bash
git checkout main
git pull
git status
```

Pastikan working tree bersih dan berada di commit terbaru.

### Langkah 2 — Buat helper timer

1. Buat `lib/session.js` sesuai Bagian 7.1.
2. Buat `lib/session.test.mjs` sesuai Bagian 7.2.
3. Ubah script `test` di `package.json` sesuai Bagian 7.3.

### Langkah 3 — Jalankan unit test

```bash
npm test
```

Yang diharapkan:

- 3 test lama di `lib/leaderboard.test.mjs` **PASS**.
- 3 test baru di `lib/session.test.mjs` **PASS**.
- Total 6 test lulus, 0 gagal.

Jika gagal, perbaiki helper dulu sebelum lanjut. Jangan menulis halaman di atas logika timer yang belum teruji.

### Langkah 4 — Tambahkan CSS

Tambahkan blok CSS dari Bagian 7.5 ke bagian bawah `app/globals.css`.

### Langkah 5 — Buat halaman player

Buat `app/play/page.js` sesuai Bagian 7.4.

### Langkah 6 — Tambahkan navigasi

1. Ubah header `app/leaderboard/page.js` sesuai Bagian 7.6.
2. Ubah header `app/dashboard/page.js` sesuai Bagian 7.7.

### Langkah 7 — Jalankan dev server

```bash
npm run dev
```

Buka:

- `http://localhost:3000/play`
- `http://localhost:3000/leaderboard`
- `http://localhost:3000/dashboard`

### Langkah 8 — Uji manual

Ikuti skenario di Bagian 9.2. Jangan hanya mengandalkan unit test; timer dan `localStorage` harus diuji di browser.

### Langkah 9 — Build production

```bash
npm run build
```

Pastikan tidak ada error kompilasi JSX, import, atau route baru.

### Langkah 10 — Review akhir

- `git diff` hanya menyentuh file di Bagian 6.
- Tidak ada `console.log` debug yang tertinggal.
- Tidak ada perubahan pada `app/api/leaderboard/route.js`.
- Semua Acceptance Criteria di Bagian 10 terpenuhi.

---

## 9. Rencana Pengujian

### 9.1 Unit test otomatis

```bash
npm test
```

Cakupan:

- `getElapsedSeconds` menghitung selisih, membulatkan ke bawah, dan menjepit 0–300.
- `getRemainingSeconds` menghasilkan 300 → 0.
- `parseStoredSession` menolak JSON rusak, nama/origin kosong, dan `startTime` tidak valid.
- Test lama leaderboard tetap lulus.

### 9.2 Uji fungsional manual

> **Tips menguji countdown tanpa menunggu 5 menit:**
> 1. Mulai sesi di `/play`.
> 2. Buka DevTools → Application → Local Storage.
> 3. Cari key `lab-sisfo:active-session`.
> 4. Ubah `startTime` menjadi `Date.now() - 295000` (5 detik tersisa).
> 5. Refresh halaman. Countdown akan lanjut di sekitar `00:05` lalu habis otomatis.
>
> Cara ini sekaligus menguji fitur pemulihan sesi. Tidak perlu mengubah kode.

| No | Skenario | Langkah | Hasil yang diharapkan |
| :-: | :--- | :--- | :--- |
| 1 | Validasi form | Buka `/play`, klik Mulai tanpa mengisi apa pun | Pesan "Nama wajib diisi..." muncul; tidak pindah phase |
| 2 | Validasi origin | Isi nama saja, klik Mulai | Pesan asal wajib diisi muncul |
| 3 | Mulai sesi | Isi nama & asal, klik Mulai | Form hilang, countdown `05:00` tampil, badge "SESI BERJALAN" |
| 4 | Countdown berjalan | Tunggu 5 detik | Tampilan menjadi `04:55` |
| 5 | Early finish | Setelah ±10 detik, klik "Selesai & Input Level" | Phase `finished`, durasi ±`00:10`, form level muncul |
| 6 | Batas early finish | Klik "Selesai & Input Level" sebelum 5 detik | Pesan minimal 5 detik muncul; tetap running |
| 7 | Countdown habis | Gunakan trik `startTime` di atas | Otomatis pindah ke `finished`, durasi `05:00` (300 detik) |
| 8 | Simpan sukses | Isi level 12, klik Simpan | Phase `saved`, muncul level, waktu, dan peringkat |
| 9 | Data masuk | Buka `/leaderboard` | Entri baru muncul (maks. 10 detik karena polling) |
| 10 | Refresh saat running | Mulai sesi, refresh setelah ±10 detik | Countdown lanjut dari sisa waktu yang benar, bukan reset ke `05:00` |
| 11 | Refresh saat finished | Early finish, lalu refresh | Tetap di form level dengan durasi yang sama |
| 12 | Pemain berikutnya | Dari phase `saved`, klik "Pemain Berikutnya" | Kembali ke form kosong |
| 13 | Batal saat running | Klik Batalkan, setujui konfirmasi | Kembali ke form kosong, `localStorage` dibersihkan |
| 14 | Double submit | Klik Simpan dua kali cepat | Tombol disabled saat menyimpan; tidak ada baris ganda |
| 15 | Tie-breaker | Simpan dua peserta level sama, durasi 20 detik dan 60 detik | Peserta 20 detik berada di atas |
| 16 | Regresi dashboard | Buka `/dashboard`, jalankan timer admin, simpan | Dashboard tetap berfungsi seperti sebelumnya |
| 17 | Regresi leaderboard | Buka `/leaderboard` | Daftar, warna rank, dan durasi `MM:SS` tetap tampil |
| 18 | Mobile | Buka `/play` di lebar ±375 px | Timer besar, tombol tidak terpotong, form nyaman dipakai |

### 9.3 Uji data langsung ke API (opsional)

Untuk memastikan API tetap menerima payload halaman baru:

```bash
curl -X POST http://localhost:3000/api/leaderboard \
  -H "Content-Type: application/json" \
  -d '{"name":"Tes Player","origin":"SMK Tes","level":7,"duration_seconds":42}'
```

Response harus `201` dan berisi `entry` dengan data yang dikirim.

---

## 10. Acceptance Criteria

Task dinyatakan selesai jika **semua** poin berikut terpenuhi:

- [ ] Route `/play` dapat diakses tanpa login.
- [ ] Form meminta nama dan asal; input berisi spasi saja ditolak.
- [ ] Setelah klik Mulai, form identitas hilang dan countdown `05:00` tampil.
- [ ] Countdown berjalan mundur dan otomatis berhenti di `00:00`.
- [ ] Peserta dapat menyelesaikan lebih awal dengan tombol "Selesai & Input Level" (minimal 5 detik).
- [ ] Durasi yang disimpan adalah waktu bermain sebenarnya (bukan selalu 300).
- [ ] Input level hanya muncul di phase `finished`.
- [ ] Level divalidasi sebagai bilangan bulat ≥ 1 (validasi server tetap berlaku).
- [ ] Data tersimpan lewat `POST /api/leaderboard` yang sudah ada.
- [ ] Layar sukses menampilkan level, waktu `MM:SS`, dan peringkat.
- [ ] Refresh saat running memulihkan sisa waktu dengan benar.
- [ ] Refresh saat finished mempertahankan durasi dan form level.
- [ ] `localStorage` dibersihkan setelah simpan sukses atau reset.
- [ ] `/leaderboard` dan `/dashboard` tetap berfungsi.
- [ ] `npm test` lulus 6 test.
- [ ] `npm run build` selesai tanpa error.
- [ ] Tidak ada perubahan schema database atau API.

---

## 11. Pitfalls yang Sering Terjadi (Baca Sebelum Debugging)

1. **`localStorage is not defined`**
   Jangan akses `localStorage` saat render atau di initializer `useState`. Pindahkan ke `useEffect`/event handler.

2. **Timer terasa lambat atau melompat**
   Jangan decrement state. Selalu hitung dari `startTime` dengan `Date.now()`.

3. **Interval ganda**
   Selalu `clearInterval` sebelum membuat interval baru dan di cleanup function. React Strict Mode di development menjalankan effect dua kali.

4. **Refresh di phase finished malah mengulang timer**
   Pastikan `finishedAt` disimpan ke `localStorage` di `finishSession`, dan dibaca saat restore.

5. **Semua peserta dapat 300 detik**
   Berarti tombol early finish tidak ada atau tidak memanggil `finishSession(startTime)`.

6. **Durasi menjadi `NaN`**
   Pastikan `startTime` berupa number dan `getElapsedSeconds` menangani nilai tidak valid.

7. **Level `"0"` atau `"abc"` lolos**
   Validasi client hanya UX. `parseEntry` di `lib/leaderboard.js` yang menjadi penentu akhir; pastikan error API ditampilkan.

8. **Data ganda**
   Disable tombol saat `saving` dan jangan render dua form submit sekaligus.

9. **Dashboard rusak**
   Jangan mengubah logika dashboard. Cukup tambahkan link di header.

10. **Timer tetap berjalan saat tab hidden**
    Ini disengaja. Saat tab kembali aktif, timer akan mengejar dan mungkin langsung selesai. Jangan menambahkan pause, karena peserta bisa memanfaatkannya untuk menghentikan waktu.

11. **`window.confirm` saat SSR**
    Hanya dipanggil di event handler client, jadi aman. Jangan panggil di body komponen.

12. **`a.btn` tidak tampil sebagai tombol**
    Pastikan blok CSS `a.btn` dari Bagian 7.5 sudah ditambahkan.

---

## 12. Pekerjaan Opsional untuk Iterasi Berikutnya

Jangan dikerjakan pada task ini kecuali diminta:

1. **Anti-cheat server-side**
   Buat endpoint `POST /api/session/start` yang mengembalikan `sessionId` + `startedAt` bertanda tangan. Saat submit, server menghitung durasi sendiri dan menolak jika tidak konsisten.

2. **Pilihan asal berupa dropdown/autocomplete**
   Mengurangi typo nama sekolah. Butuh tabel referensi atau daftar statis.

3. **QR Code menuju `/play`**
   Ditempel di stand agar peserta langsung membuka halaman.

4. **Refactor timer dashboard**
   Gunakan `lib/session.js` di `app/dashboard/page.js` agar tidak ada duplikasi konstanta 300 dan logika durasi.

5. **Notifikasi suara di 30 detik terakhir**
   Membantu peserta menyadari waktu hampir habis.

6. **Admin bisa mereset sesi aktif**
   Berguna jika peserta meninggalkan perangkat di tengah sesi.

7. **Rate limiting / moderasi entri**
   Mencegah spam jika `/play` dibuka bebas di jaringan publik.

8. **Ubah redirect home ke `/play`**
   Saat ini `/` redirect ke `/leaderboard`. Jika perangkat stand ingin langsung membuka halaman player, ubah `app/page.js` menjadi `redirect("/play")`. Konfirmasi dulu dengan penanggung jawab stand karena ini mengubah halaman pertama yang dilihat pengunjung.

---

## 13. Ringkasan File Akhir Setelah Implementasi

```
app/
  play/
    page.js            ← BARU
  api/leaderboard/
    route.js           ← tidak berubah
  dashboard/
    page.js            ← tambah link
  leaderboard/
    page.js            ← tambah link
  globals.css          ← tambah style
  layout.js            ← tidak berubah
  page.js              ← tidak berubah
lib/
  session.js           ← BARU
  session.test.mjs     ← BARU
  leaderboard.js       ← tidak berubah
  leaderboard.test.mjs ← tidak berubah
package.json           ← update script test
```

Selesai. Setelah semua checklist dan test terpenuhi, fitur halaman player mandiri siap digunakan di stand.
