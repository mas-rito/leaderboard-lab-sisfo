"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRankColor,
  loadEntries,
  saveEntry,
  updateEntry,
  deleteEntry,
} from "../../lib/leaderboard";

export default function DashboardPage() {
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadEntries().then(setEntries);
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLevel("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const result = editingId
      ? await updateEntry(editingId, name, level)
      : await saveEntry(name, level);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEntries(result.entries);
    setSuccess(
      editingId
        ? `Data "${result.entry.name}" berhasil diperbarui.`
        : `Data "${result.entry.name}" (Level ${result.entry.level}) berhasil ditambahkan.`
    );
    resetForm();
  }

  function handleEdit(item) {
    setError("");
    setSuccess("");
    setEditingId(item.id);
    setName(item.name);
    setLevel(String(item.level));
  }

  async function handleDelete(item) {
    setError("");
    setEntries(await deleteEntry(item.id));
    if (editingId === item.id) resetForm();
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
        <h2>{editingId ? "Edit Data" : "Tambah Data Baru"}</h2>
        {error && <p className="msg-error">{error}</p>}
        {success && <p className="msg-ok">{success}</p>}
        <div className="form-group">
          <label htmlFor="name">Nama</label>
          <input
            id="name"
            type="text"
            placeholder="Masukkan nama..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="level">Level</label>
          <input
            id="level"
            type="number"
            min="1"
            step="1"
            placeholder="Masukkan level (contoh: 45)"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            required
          />
        </div>
        <div className="action-row">
          <button type="submit" className="btn">
            {editingId ? "Simpan Perubahan" : "Tambah ke Leaderboard"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Batal
            </button>
          )}
        </div>
      </form>

      <h2 className="section-title">Data Saat Ini ({entries.length})</h2>
      <ol className="board-list">
        {entries.map((item, index) => (
          <li
            key={item.id}
            className="board-row"
            style={{ backgroundColor: getRankColor(index) }}
          >
            <div className="board-left">
              <span className="rank-badge">#{index + 1}</span>
              <span className="player-name">{item.name}</span>
              <span className="player-level">Level {item.level}</span>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="btn-sm"
                onClick={() => handleEdit(item)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-sm btn-danger"
                onClick={() => handleDelete(item)}
              >
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
