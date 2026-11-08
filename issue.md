
# [ISSUE / PLAN] Implementasi Timer Countdown Sesi Permainan & Tie-Breaker Leaderboard

## 1. Ringkasan Fitur & Latar Belakang

Game stand **Laboratorium Sistem Informasi** membutuhkan pencatatan durasi permainan peserta secara akurat menggunakan sistem timer countdown (maksimal 5 menit / 300 detik). Saat ini sistem hanya mencatat `name` dan `level`, serta mengurutkan peserta hanya berdasarkan `level DESC`.

### Kebutuhan Baru:
1. **Database Neon Postgres**:
   - Menambahkan kolom `origin` (Asal Sekolah/Jurusan), `duration_seconds` (durasi bermain dalam detik), dan `created_at` (timestamp pencatatan).
   
   
   (Tertinggi)} \rightarrow \text{Durasi Detik (Tercepat/Terkecil)} \rightarrow \text{Created At (Terdahulu)}$$
     `ORDER BY level DESC, duration_seconds ASC, created_at ASC`
2. **Dashboard Admin & Timer Countdown (5 Menit)**:
   - Input awal: Nama Peserta (`name`) & Asal Sekolah/Jurusan (`origin`).
   - Tombol **"Mulai Sesi Permainan"**: Menjalankan timer countdown 5 menit (05:00 $\rightarrow$ 00:00) dan mencatat timestamp `startTime`.
   - Tombol **"Stop Sesi"** atau jika waktu countdown habis otomatis:
     Menghitung durasi riil: `duration_seconds = Math.floor((Date.now() - startTime) / 1000)`.
   - Menampilkan input **Level** yang dicapai setelah sesi berhenti.
   - Mengirim data lengkap (`name`, `origin`, `level`, `duration_seconds`) ke API database.
3. **Leaderboard Public (`/leaderboard`)**:
   - Menampilkan kolom: Peringkat (#1, #2, dst.), Nama Peserta, Asal Sekolah/Jurusan, Level, dan Durasi Penyelesaian (format `MM:SS`).
   - Urutan peringkat presisi sesuai aturan tie-breaker.

---

## 2. Analisis File Codebase & Rencana Perubahan

| File | Status | Deskripsi Perubahan |
| :--- | :---: | :--- |
| `types/leaderboard.ts` | **Baru** | Definisi TypeScript interface `LeaderboardEntry`, `EntryPayload`, `ValidationResult`. |
| `neon.ts` | Tetap | Konfigurasi Neon branch & client (sudah ada). |
| `lib/leaderboard.js` (atau `.ts`) | **Diubah** | Tambah `formatDuration()`, update `sortLeaderboard()` (tie-breaker), update `parseEntry()`, `saveEntry()`, `updateEntry()`. |
| `lib/leaderboard.test.mjs` | **Diubah** | Update unit test untuk validasi tie-breaker, helper format waktu, dan field baru. |
| `app/api/leaderboard/route.js` (atau `.ts`) | **Diubah** | Migrasi skema database Neon (`ALTER TABLE` & `CREATE TABLE`), update query tie-breaker, simpan kolom baru di `POST` & `PUT`. |
| `app/dashboard/page.js` (atau `.tsx`) | **Diubah** | State machine countdown timer (idle $\rightarrow$ running $\rightarrow$ stopped), input Asal & Level, aksi simpan/reset. |
| `app/leaderboard/page.js` (atau `.tsx`) | **Diubah** | Tampilan kolom Asal, Level, dan Durasi (`MM:SS`) dengan styling badge peringkat. |
| `app/globals.css` | **Diubah** | Styling komponen timer digital, badge status sesi, dan kolom info tambahan di leaderboard. |

---

## 3. Spesifikasi Database & SQL Query (Neon Postgres)

### 3.1 DDL Schema Lengkap (Untuk Fresh Setup)
```sql
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL CHECK (level >= 1),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index komposit untuk mengoptimalkan performa sorting tie-breaker
CREATE INDEX IF NOT EXISTS idx_leaderboard_tie_breaker 
ON leaderboard_entries (level DESC, duration_seconds ASC, created_at ASC);
```

### 3.2 SQL Migration Script (Untuk Database Eksisting)
Jika tabel `leaderboard_entries` sudah pernah dibuat di database Neon:
```sql
ALTER TABLE leaderboard_entries
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_leaderboard_tie_breaker 
ON leaderboard_entries (level DESC, duration_seconds ASC, created_at ASC);
```

### 3.3 SQL Query Fetch Leaderboard (Tie-Breaker)
```sql
SELECT 
  id, 
  name, 
  origin, 
  level, 
  duration_seconds, 
  created_at
FROM leaderboard_entries
ORDER BY 
  level DESC, 
  duration_seconds ASC, 
  created_at ASC
LIMIT 100;
```

---

## 4. TypeScript Type Definitions

Buat file baru [`types/leaderboard.ts`](types/leaderboard.ts):

```typescript
export interface LeaderboardEntry {
  id: string;
  name: string;
  origin: string;
  level: number;
  duration_seconds: number;
  created_at?: string;
}

export interface EntryInput {
  name: string;
  origin: string;
  level: number | string;
  duration_seconds: number | string;
  id?: string;
}

export type ParseResult = 
  | { entry: LeaderboardEntry; error?: never }
  | { error: string; entry?: never };
```

---

## 5. Rencana Perubahan Kode per File (Detail & Snippet)

### 5.1 File: [`lib/leaderboard.js`](lib/leaderboard.js)

#### Fungsi & Penyesuaian:
1. **`formatDuration(seconds)`**:
   Konversi detik ke string format `MM:SS` (contoh: 65 detik $\rightarrow$ `"01:05"`).
2. **`sortLeaderboard(entries)`**:
   Logika 3 tingkat tie-breaker:
   - Tingkat 1: `b.level - a.level` (Level tertinggi di atas).
   - Tingkat 2: `a.duration_seconds - b.duration_seconds` (Durasi terkecil/tercepat di atas).
   - Tingkat 3: `new Date(a.created_at) - new Date(b.created_at)` (Sesi yang lebih awal di atas).
3. **`parseEntry(name, origin, levelInput, durationInput, id, createdAt)`**:
   Validasi `name`, `origin`, `level` (integer $\ge$ 1), dan `duration_seconds` (integer 0 s/d 300).
4. **`saveEntry(name, origin, level, durationSeconds)`** & **`updateEntry(id, name, origin, level, durationSeconds)`**:
   Sertakan `origin` dan `duration_seconds` pada payload HTTP POST/PUT.

#### Kode Lengkap Pengganti `lib/leaderboard.js`:
```javascript
export const INITIAL_ENTRIES = [
  { id: "1", name: "Raka", origin: "SMKN 1 Surabaya", level: 42, duration_seconds: 145, created_at: "2026-11-01T10:00:00Z" },
  { id: "2", name: "Sinta", origin: "SMA 2 Surabaya", level: 38, duration_seconds: 180, created_at: "2026-11-01T10:05:00Z" },
  { id: "3", name: "Budi", origin: "Sistem Informasi", level: 31, duration_seconds: 210, created_at: "2026-11-01T10:10:00Z" },
  { id: "4", name: "Dina", origin: "Teknik Informatika", level: 24, duration_seconds: 240, created_at: "2026-11-01T10:15:00Z" },
  { id: "5", name: "Andi", origin: "SMA 1 Gresik", level: 19, duration_seconds: 300, created_at: "2026-11-01T10:20:00Z" },
];

export const RANK_COLORS = [
  "#fef08a", // Posisi 1: Gold
  "#e2e8f0", // Posisi 2: Silver
  "#fed7aa", // Posisi 3: Bronze
];
export const DEFAULT_RANK_COLOR = "#ffffff"; // Posisi 4 ke bawah

export function getRankColor(index) {
  return index < 3 ? RANK_COLORS[index] : DEFAULT_RANK_COLOR;
}

/**
 * Format detik ke MM:SS (contoh: 125 -> "02:05")
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Sorting tie-breaker:
 * 1. Level DESC (tertinggi lebih dulu)
 * 2. duration_seconds ASC (tercepat lebih dulu)
 * 3. created_at ASC (pencatatan lebih awal lebih dulu)
 */
export function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.level !== a.level) {
      return b.level - a.level;
    }
    const durA = Number(a.duration_seconds ?? 0);
    const durB = Number(b.duration_seconds ?? 0);
    if (durA !== durB) {
      return durA - durB;
    }
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });
}

export function parseEntry(name, origin, levelInput, durationInput, id, createdAt) {
  const cleanName = String(name ?? "").trim();
  const cleanOrigin = String(origin ?? "").trim();
  const level = Number(levelInput);
  const duration = Number(durationInput ?? 0);

  if (!cleanName) return { error: "Nama peserta wajib diisi." };
  if (!cleanOrigin) return { error: "Asal (Sekolah/Jurusan) wajib diisi." };
  if (!Number.isFinite(level) || !Number.isInteger(level) || level < 1) {
    return { error: "Level harus berupa angka bulat minimal 1." };
  }
  if (!Number.isFinite(duration) || duration < 0 || duration > 300) {
    return { error: "Durasi permainan harus antara 0 hingga 300 detik." };
  }

  return {
    entry: {
      id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      origin: cleanOrigin,
      level,
      duration_seconds: Math.floor(duration),
      created_at: createdAt ?? new Date().toISOString(),
    },
  };
}

export function applyUpdate(entries, id, name, origin, levelInput, durationInput) {
  const result = parseEntry(name, origin, levelInput, durationInput, id);
  if (result.error) return result;
  if (!entries.some((item) => item.id === id)) return { error: "Data tidak ditemukan." };
  const next = sortLeaderboard(entries.map((item) => (item.id === id ? { ...item, ...result.entry } : item)));
  return { entries: next, entry: result.entry };
}

export function applyDelete(entries, id) {
  return sortLeaderboard(entries.filter((item) => item.id !== id));
}

export async function loadEntries() {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}

export async function saveEntry(name, origin, levelInput, durationInput) {
  const result = parseEntry(name, origin, levelInput, durationInput);
  if (result.error) return result;
  const res = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: result.entry.name,
      origin: result.entry.origin,
      level: result.entry.level,
      duration_seconds: result.entry.duration_seconds,
    }),
  });
  return res.json();
}

export async function updateEntry(id, name, origin, levelInput, durationInput) {
  const result = parseEntry(name, origin, levelInput, durationInput, id);
  if (result.error) return result;
  const res = await fetch("/api/leaderboard", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      name: result.entry.name,
      origin: result.entry.origin,
      level: result.entry.level,
      duration_seconds: result.entry.duration_seconds,
    }),
  });
  return res.json();
}

export async function deleteEntry(id) {
  const res = await fetch("/api/leaderboard", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}
```

---

### 5.2 File: [`app/api/leaderboard/route.js`](app/api/leaderboard/route.js)

#### Perubahan Backend API:
- `ensureSchema()`: Memastikan tabel dibuat dengan kolom `origin`, `duration_seconds`, dan `created_at`. Jika tabel sudah ada, jalankan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- `listEntries(sql)`: Mengambil kolom `origin`, `duration_seconds`, dan `created_at`, serta mengurutkan dengan:
  `ORDER BY level DESC, duration_seconds ASC, created_at ASC`.
- `POST`: Menerima `{ name, origin, level, duration_seconds }` dan menyimpannya.
- `PUT`: Mengupdate data termasuk `origin` dan `duration_seconds`.

#### Kode Pengganti `app/api/leaderboard/route.js`:
```javascript
import { neon } from "@neondatabase/serverless";
import { parseEnv } from "@neon/env";
import neonConfig from "../../../neon.ts";
import { INITIAL_ENTRIES, parseEntry } from "../../../lib/leaderboard.js";

function getSql(unpooled = false) {
  const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
  const url = (unpooled && process.env.DATABASE_URL_UNPOOLED) || postgres.databaseUrl;
  return neon(url);
}

let schemaPromise = null;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const directSql = getSql(true);
      const [{ exists }] = await directSql`
        SELECT to_regclass('public.leaderboard_entries') IS NOT NULL AS exists
      `;
      if (!exists) {
        await directSql`
          CREATE TABLE IF NOT EXISTS leaderboard_entries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            origin TEXT NOT NULL DEFAULT '',
            level INTEGER NOT NULL CHECK (level >= 1),
            duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        for (const item of INITIAL_ENTRIES) {
          await directSql`
            INSERT INTO leaderboard_entries (id, name, origin, level, duration_seconds, created_at)
            VALUES (${item.id}, ${item.name}, ${item.origin}, ${item.level}, ${item.duration_seconds}, ${item.created_at})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      } else {
        // Migration penambahan kolom jika tabel lama sudah ada
        await directSql`
          ALTER TABLE leaderboard_entries
          ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 300),
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        `;
      }

      await directSql`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_tie_breaker 
        ON leaderboard_entries (level DESC, duration_seconds ASC, created_at ASC)
      `;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function listEntries(sql) {
  const rows = await sql`
    SELECT id, name, origin, level, duration_seconds, created_at
    FROM leaderboard_entries
    ORDER BY level DESC, duration_seconds ASC, created_at ASC
    LIMIT 100
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    origin: row.origin || "-",
    level: Number(row.level),
    duration_seconds: Number(row.duration_seconds || 0),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));
}

export async function GET() {
  await ensureSchema();
  const entries = await listEntries(getSql());
  return Response.json({ entries });
}

export async function POST(request) {
  await ensureSchema();
  const body = await request.json();
  const result = parseEntry(body?.name, body?.origin, body?.level, body?.duration_seconds);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    INSERT INTO leaderboard_entries (id, name, origin, level, duration_seconds, created_at)
    VALUES (
      ${result.entry.id}, 
      ${result.entry.name}, 
      ${result.entry.origin}, 
      ${result.entry.level}, 
      ${result.entry.duration_seconds}, 
      ${result.entry.created_at}
    )
  `;
  const entries = await listEntries(sql);
  return Response.json({ entries, entry: result.entry }, { status: 201 });
}

export async function PUT(request) {
  await ensureSchema();
  const body = await request.json();
  const result = parseEntry(
    body?.name,
    body?.origin,
    body?.level,
    body?.duration_seconds,
    body?.id ? String(body.id) : undefined
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

export async function DELETE(request) {
  await ensureSchema();
  const body = await request.json();
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "ID wajib diisi." }, { status: 400 });
  }
  const sql = getSql();
  await sql`DELETE FROM leaderboard_entries WHERE id = ${id}`;
  const entries = await listEntries(sql);
  return Response.json({ entries });
}
```

---

### 5.3 File: [`app/dashboard/page.js`](app/dashboard/page.js) (Admin & Timer Countdown)

#### Alur State Mesin Timer:
1. **Status `idle`**:
   - Admin memasukkan Nama (`name`) dan Asal (`origin`).
   - Tombol **"Mulai Sesi (5 Menit)"** aktif.
2. **Status `running`**:
   - Dicatat `startTime = Date.now()`.
   - Countdown berjalan mundur dari `300` detik ke `0` (Interval 1 detik).
   - Input Nama dan Asal di-disable agar tidak terjadi perubahan data saat bermain.
   - Tombol **"Stop Sesi Permainan"** warna merah tampil.
3. **Status `stopped` (Sesi Berhenti)**:
   - Terjadi jika tombol "Stop Sesi" ditekan ATAU timer mencapai `00:00`.
   - Dihitung durasi:
     $$\text{durationSeconds} = \min\left(300, \max\left(0, \left\lfloor \frac{\text{Date.now()} - \text{startTime}}{1000} \right\rfloor\right)\right)$$
   - Tampilkan kotak info: Durasi bermain yang ditempuh (MM:SS).
   - Tampilkan input **Level**.
   - Tombol **"Simpan ke Leaderboard"** dan **"Batalkan / Reset Sesi"**.
4. **Edit Mode (Opsi Admin)**:
   - Jika admin klik tombol "Edit" pada daftar tabel, form beralih ke mode edit biasa untuk mengoreksi nama, asal, level, dan durasi secara manual tanpa harus memutar timer.

#### Kode Pengganti `app/dashboard/page.js`:
```javascript
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  getRankColor,
  loadEntries,
  saveEntry,
  updateEntry,
  deleteEntry,
  formatDuration,
} from "../../lib/leaderboard";

const TOTAL_COUNTDOWN_SECONDS = 300; // 5 Menit

export default function DashboardPage() {
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [level, setLevel] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Timer states: 'idle' | 'running' | 'stopped'
  const [sessionState, setSessionState] = useState("idle");
  const [countdownLeft, setCountdownLeft] = useState(TOTAL_COUNTDOWN_SECONDS);
  const [startTime, setStartTime] = useState(null);

  // Feedback states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const timerIntervalRef = useRef(null);

  useEffect(() => {
    loadEntries().then(setEntries);
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Handler: Mulai Sesi Permainan
  function handleStartSession() {
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Nama peserta wajib diisi sebelum memulai sesi!");
      return;
    }
    if (!origin.trim()) {
      setError("Asal (Sekolah/Jurusan) wajib diisi sebelum memulai sesi!");
      return;
    }

    const now = Date.now();
    setStartTime(now);
    setCountdownLeft(TOTAL_COUNTDOWN_SECONDS);
    setSessionState("running");
    setLevel("");

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - now) / 1000);
      const remaining = TOTAL_COUNTDOWN_SECONDS - elapsed;

      if (remaining <= 0) {
        // Countdown habis otomatis
        clearInterval(timerIntervalRef.current);
        setCountdownLeft(0);
        setDurationSeconds(TOTAL_COUNTDOWN_SECONDS);
        setSessionState("stopped");
      } else {
        setCountdownLeft(remaining);
      }
    }, 1000);
  }

  // Handler: Stop Sesi Permainan (Manual oleh Admin)
  function handleStopSession() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (startTime) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const finalDuration = Math.min(Math.max(elapsed, 0), TOTAL_COUNTDOWN_SECONDS);
      setDurationSeconds(finalDuration);
    }
    setSessionState("stopped");
  }

  // Handler: Reset Form & Sesi
  function handleResetSession() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setSessionState("idle");
    setEditingId(null);
    setName("");
    setOrigin("");
    setLevel("");
    setDurationSeconds(0);
    setCountdownLeft(TOTAL_COUNTDOWN_SECONDS);
    setStartTime(null);
    setError("");
  }

  // Submit Simpan / Update
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (editingId) {
      const result = await updateEntry(editingId, name, origin, level, durationSeconds);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEntries(result.entries);
      setSuccess(`Data "${result.entry.name}" berhasil diperbarui.`);
      handleResetSession();
      return;
    }

    // Normal mode setelah timer selesai
    if (sessionState !== "stopped") {
      setError("Sesi permainan belum selesai. Hentikan sesi sebelum menyimpan!");
      return;
    }

    const result = await saveEntry(name, origin, level, durationSeconds);
    if (result.error) {
      setError(result.error);
      return;
    }

    setEntries(result.entries);
    setSuccess(
      `Peserta "${result.entry.name}" (${result.entry.origin}) berhasil disimpan! Level: ${result.entry.level}, Waktu: ${formatDuration(result.entry.duration_seconds)}.`
    );
    handleResetSession();
  }

  // Edit manual dari daftar
  function handleEdit(item) {
    if (sessionState === "running") {
      setError("Tidak bisa mengedit data saat sesi permainan sedang berjalan!");
      return;
    }
    setError("");
    setSuccess("");
    setEditingId(item.id);
    setName(item.name);
    setOrigin(item.origin || "");
    setLevel(String(item.level));
    setDurationSeconds(item.duration_seconds || 0);
    setSessionState("stopped"); // Tampilkan form langsung untuk edit
  }

  async function handleDelete(item) {
    if (sessionState === "running") {
      setError("Tidak bisa menghapus data saat sesi permainan sedang berjalan!");
      return;
    }
    setError("");
    setEntries(await deleteEntry(item.id));
    if (editingId === item.id) handleResetSession();
    setSuccess(`Data "${item.name}" berhasil dihapus.`);
  }

  return (
    <section>
      <div className="header-row">
        <h1>Dashboard Kelola Leaderboard</h1>
        <Link href="/leaderboard" className="link-btn">
          Lihat Leaderboard Public
        </Link>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? "Edit Data Peserta" : "Input Sesi Game Peserta"}</h2>
        {error && <p className="msg-error">{error}</p>}
        {success && <p className="msg-ok">{success}</p>}

        {/* Form Identitas Peserta */}
        <div className="form-group">
          <label htmlFor="name">Nama Peserta</label>
          <input
            id="name"
            type="text"
            placeholder="Masukkan nama player..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={sessionState === "running"}
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
            onChange={(e) => setOrigin(e.target.value)}
            disabled={sessionState === "running"}
            required
          />
        </div>

        {/* Panel Timer Countdown (Non-Edit Mode) */}
        {!editingId && (
          <div className={`timer-box timer-${sessionState}`}>
            <div className="timer-header">
              <span className="timer-label">Countdown Waktu Bermain (Maks. 5 Menit)</span>
              {sessionState === "running" && <span className="badge-live">SESI BERJALAN</span>}
              {sessionState === "stopped" && <span className="badge-done">SESI SELESAI</span>}
            </div>

            <div className="timer-display">
              {sessionState === "running"
                ? formatDuration(countdownLeft)
                : sessionState === "stopped"
                ? formatDuration(durationSeconds)
                : formatDuration(TOTAL_COUNTDOWN_SECONDS)}
            </div>

            {sessionState === "stopped" && (
              <p className="timer-summary">
                Waktu selesai: <strong>{formatDuration(durationSeconds)}</strong> ({durationSeconds} detik)
              </p>
            )}

            <div className="timer-actions">
              {sessionState === "idle" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartSession}
                >
                  Mulai Sesi (5 Menit)
                </button>
              )}

              {sessionState === "running" && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleStopSession}
                >
                  Stop Sesi Permainan
                </button>
              )}

              {sessionState === "stopped" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetSession}
                >
                  Ulangi / Reset Sesi
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Level & Durasi (Muncul saat sesi stopped atau sedang edit) */}
        {(sessionState === "stopped" || editingId) && (
          <>
            <div className="form-group" style={{ marginTop: "16px" }}>
              <label htmlFor="level">Level yang Dicapai</label>
              <input
                id="level"
                type="number"
                min="1"
                step="1"
                placeholder="Masukkan level (contoh: 25)"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                required
                autoFocus
              />
            </div>

            {editingId && (
              <div className="form-group">
                <label htmlFor="duration">Durasi Penyelesaian (Detik)</label>
                <input
                  id="duration"
                  type="number"
                  min="0"
                  max="300"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  required
                />
                <small className="help-text">Setara: {formatDuration(durationSeconds)}</small>
              </div>
            )}

            <div className="action-row" style={{ marginTop: "16px" }}>
              <button type="submit" className="btn">
                {editingId ? "Simpan Perubahan" : "Simpan ke Leaderboard"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetSession}
              >
                Batal
              </button>
            </div>
          </>
        )}
      </form>

      {/* Tabel Data Saat Ini */}
      <h2 className="section-title">Data Leaderboard Saat Ini ({entries.length})</h2>
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
                <span className="player-time">⏱ {formatDuration(item.duration_seconds)}</span>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="btn-sm"
                  onClick={() => handleEdit(item)}
                  disabled={sessionState === "running"}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-sm btn-danger"
                  onClick={() => handleDelete(item)}
                  disabled={sessionState === "running"}
                >
                  Hapus
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

---

### 5.4 File: [`app/leaderboard/page.js`](app/leaderboard/page.js) (Public Leaderboard)

#### Tampilan Leaderboard Publik:
- Menampilkan ranking presisi (#1, #2, dst.).
- Menampilkan Nama Player & Asal Sekolah/Jurusan.
- Menampilkan Level dan Waktu Penyelesaian (`MM:SS`).
- Penambahan auto-refresh polling (opsional 10 detik) atau tombol refresh agar stand selalu up-to-date saat event berlangsung.

#### Kode Pengganti `app/leaderboard/page.js`:
```javascript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRankColor, loadEntries, formatDuration } from "../../lib/leaderboard";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refreshData() {
    const data = await loadEntries();
    setEntries(data);
    setLoading(false);
  }

  useEffect(() => {
    refreshData();
    // Auto-refresh setiap 10 detik agar pengunjung stand melihat perubahan langsung
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section>
      <div className="header-row">
        <div>
          <h1>Leaderboard Game Stand</h1>
          <p className="subtitle">Laboratorium Sistem Informasi</p>
        </div>
        <Link href="/dashboard" className="link-btn">
          Kelola (Admin)
        </Link>
      </div>

      <div className="tie-breaker-info">
        <small>
          Urutan Ranking: <strong>Level Tertinggi</strong> $\rightarrow$ <strong>Waktu Tercepat</strong>.
        </small>
      </div>

      {loading && entries.length === 0 ? (
        <p className="loading-state">Memuat data peringkat...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">Belum ada data peserta yang terdaftar.</p>
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

              <div className="board-right-score">
                <span className="player-level">Level {item.level}</span>
                <span className="player-time-badge">
                  ⏱ {formatDuration(item.duration_seconds)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

---

### 5.5 File: [`app/globals.css`](app/globals.css)

Tambahkan CSS styles berikut di bagian bawah `app/globals.css`:
```css
/* Styling Timer & Status Dashboard */
.timer-box {
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.timer-box.timer-running {
  border-color: #3b82f6;
  background: #eff6ff;
}

.timer-box.timer-stopped {
  border-color: #22c55e;
  background: #f0fdf4;
}

.timer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.timer-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.badge-live {
  background: #ef4444;
  color: white;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

.badge-done {
  background: #16a34a;
  color: white;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: bold;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.timer-display {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 3rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 2px;
  margin: 10px 0;
}

.timer-summary {
  font-size: 0.95rem;
  color: #166534;
  margin-bottom: 12px;
}

.timer-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

/* Metadata Player & Score di Baris Leaderboard */
.player-meta {
  display: flex;
  flex-direction: column;
}

.player-origin {
  font-size: 0.8rem;
  color: #475569;
  font-weight: 500;
}

.board-right, .board-right-score {
  display: flex;
  align-items: center;
  gap: 14px;
}

.score-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.player-time, .player-time-badge {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.help-text {
  display: block;
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 4px;
}

.subtitle {
  color: #64748b;
  font-size: 0.95rem;
  margin-top: -12px;
  margin-bottom: 12px;
}

.tie-breaker-info {
  background: #e0f2fe;
  color: #0369a1;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}
```

---

### 5.6 File: [`lib/leaderboard.test.mjs`](lib/leaderboard.test.mjs)

Update test suite untuk menguji:
1. `sortLeaderboard` tie-breaker (Level $\rightarrow$ Durasi $\rightarrow$ Waktu input).
2. `formatDuration` (konversi detik ke string format MM:SS).
3. `parseEntry` validasi parameter baru `origin` dan `duration_seconds`.

#### Kode Pengganti `lib/leaderboard.test.mjs`:
```javascript
import test from "node:test";
import assert from "node:assert/strict";
import {
  getRankColor,
  sortLeaderboard,
  formatDuration,
  parseEntry,
  applyUpdate,
  applyDelete,
} from "./leaderboard.js";

test("formatDuration mengonversi detik ke string MM:SS dengan benar", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(5), "00:05");
  assert.equal(formatDuration(65), "01:05");
  assert.equal(formatDuration(300), "05:00");
});

test("sortLeaderboard menerapkan logika tie-breaker: Level DESC -> Durasi ASC -> Waktu ASC", () => {
  const data = [
    { id: "a", name: "User A", origin: "SMA 1", level: 50, duration_seconds: 120, created_at: "2026-11-01T10:00:00Z" },
    { id: "b", name: "User B", origin: "SMA 2", level: 50, duration_seconds: 90, created_at: "2026-11-01T10:05:00Z" },
    { id: "c", name: "User C", origin: "SMA 3", level: 60, duration_seconds: 200, created_at: "2026-11-01T10:10:00Z" },
    { id: "d", name: "User D", origin: "SMA 4", level: 50, duration_seconds: 90, created_at: "2026-11-01T09:00:00Z" },
  ];

  const sorted = sortLeaderboard(data);

  // Posisi 1: Level tertinggi (User C, Level 60)
  assert.equal(sorted[0].id, "c");
  // Posisi 2: Level 50, durasi 90s, waktu paling awal (User D, 09:00)
  assert.equal(sorted[1].id, "d");
  // Posisi 3: Level 50, durasi 90s, waktu belakangan (User B, 10:05)
  assert.equal(sorted[2].id, "b");
  // Posisi 4: Level 50, durasi paling lama 120s (User A)
  assert.equal(sorted[3].id, "a");
});

test("parseEntry, applyUpdate, dan applyDelete mengelola data lengkap dengan benar", () => {
  assert.ok(parseEntry("", "SMA 1", 10, 100).error, "Nama kosong harus error");
  assert.ok(parseEntry("Budi", "", 10, 100).error, "Asal kosong harus error");
  assert.ok(parseEntry("Budi", "SMA 1", 0, 100).error, "Level 0 harus error");
  assert.ok(parseEntry("Budi", "SMA 1", 10, -5).error, "Durasi negatif harus error");
  assert.ok(parseEntry("Budi", "SMA 1", 10, 301).error, "Durasi > 300 harus error");

  const valid = parseEntry("  Budi  ", "  SMA 1  ", "25", "125", "1");
  assert.equal(valid.entry.name, "Budi");
  assert.equal(valid.entry.origin, "SMA 1");
  assert.equal(valid.entry.level, 25);
  assert.equal(valid.entry.duration_seconds, 125);

  const initial = [
    { id: "1", name: "Raka", origin: "SMA 1", level: 40, duration_seconds: 100, created_at: "2026-11-01T10:00:00Z" },
    { id: "2", name: "Sinta", origin: "SMA 2", level: 20, duration_seconds: 50, created_at: "2026-11-01T10:05:00Z" },
  ];

  const updated = applyUpdate(initial, "2", "Sinta Baru", "SMA 2 Baru", 99, 45);
  assert.equal(updated.entries[0].id, "2");
  assert.equal(updated.entries[0].name, "Sinta Baru");
  assert.equal(updated.entries[0].origin, "SMA 2 Baru");
  assert.equal(updated.entries[0].level, 99);
  assert.equal(updated.entries[0].duration_seconds, 45);

  const afterDelete = applyDelete(updated.entries, "2");
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, "1");
});
```

---

## 6. Panduan Implementasi Step-by-Step (Checklist Eksekusi)

Berikut urutan pengerjaan yang direkomendasikan untuk programmer/AI yang mengeksekusi:

### Langkah 1: Buat Type Definitions
- Buat file `types/leaderboard.ts` dengan interface `LeaderboardEntry`, `EntryInput`, dan `ParseResult`.

### Langkah 2: Update Modul `lib/leaderboard.js` & Jalankan Unit Test
1. Tambahkan fungsi `formatDuration(seconds)`.
2. Perbarui `sortLeaderboard` dengan 3 kriteria tie-breaker.
3. Perbarui `parseEntry`, `applyUpdate`, `saveEntry`, dan `updateEntry` agar menerima `origin` dan `duration_seconds`.
4. Update `lib/leaderboard.test.mjs` sesuai spesifikasi Bagian 5.6.
5. Jalankan verifikasi test:
   ```bash
   bun run test
   ```
   *Pastikan seluruh test berstatus PASS (3 passing).*

### Langkah 3: Update Backend API Route `app/api/leaderboard/route.js`
1. Tambahkan migrasi `ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS ...` di dalam `ensureSchema()`.
2. Tambahkan pembuatan index `idx_leaderboard_tie_breaker`.
3. Perbarui query SELECT di `listEntries()` untuk menyertakan `origin`, `duration_seconds`, dan sorting tie-breaker.
4. Perbarui handler `POST` dan `PUT` agar menerima dan menyimpan data `origin` dan `duration_seconds`.

### Langkah 4: Modifikasi Form Admin & Timer di `app/dashboard/page.js`
1. Terapkan state timer countdown 300 detik (5 menit).
2. Buat tombol "Mulai Sesi (5 Menit)" dan "Stop Sesi Permainan".
3. Validasi perhitungan otomatis durasi:
   `Math.min(Math.max(Math.floor((Date.now() - startTime) / 1000), 0), 300)`.
4. Tambahkan input Level yang muncul setelah sesi dihentikan.
5. Lengkapi tabel riwayat dashboard dengan kolom Asal dan Waktu Durasi.

### Langkah 5: Modifikasi Halaman Leaderboard Publik di `app/leaderboard/page.js`
1. Tampilkan nama player beserta asal sekolah/jurusan.
2. Tampilkan level dan badge durasi format `MM:SS`.
3. Pasang polling refresh otomatis setiap 10 detik.

### Langkah 6: Tambahkan CSS di `app/globals.css`
1. Salin blok CSS timer dan badge dari Bagian 5.5 ke `app/globals.css`.

---

## 7. Rencana Verifikasi & Uji Coba

1. **Unit Testing Otomatis**:
   ```bash
   bun run test
   ```
2. **Uji Coba Fungsional Manual**:
   - **Kasus A (Timer Habis Otomatis)**:
     - Masukkan Nama: "Tester A", Asal: "SMK A".
     - Klik "Mulai Sesi". Tunggu atau sesuaikan countdown hingga 00:00.
     - Pastikan durasi tercatat 300 detik (05:00).
     - Input Level 10, simpan.
   - **Kasus B (Stop Sesi Manual / Lebih Cepat)**:
     - Masukkan Nama: "Tester B", Asal: "SMA B".
     - Klik "Mulai Sesi", biarkan berjalan ~15 detik, lalu klik "Stop Sesi Permainan".
     - Pastikan durasi tercatat sekitar 15 detik (`00:15`).
     - Input Level 10, simpan.
   - **Kasus C (Verifikasi Tie-Breaker di `/leaderboard`)**:
     - Baik Tester A dan Tester B sama-sama memiliki Level 10.
     - Namun Tester B selesai dalam 15 detik, sedangkan Tester A 300 detik.
     - **Hasil yang Diharapkan**: Tester B harus berada di peringkat lebih tinggi dari Tester A!
   - **Kasus D (Level Berbeda)**:
     - Peserta C Level 12 dengan durasi 250 detik harus tetap di atas Tester B (Level 10, 15 detik), karena prioritas utama adalah Level tertinggi.
