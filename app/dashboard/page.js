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
