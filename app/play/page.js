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
        finishSession(startTime, startTime + TOTAL_COUNTDOWN_SECONDS * 1000);
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
