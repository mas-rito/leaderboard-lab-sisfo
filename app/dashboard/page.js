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
