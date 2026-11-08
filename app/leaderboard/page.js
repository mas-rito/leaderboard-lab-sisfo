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
          Urutan Ranking: <strong>Level Tertinggi</strong> → <strong>Waktu Tercepat</strong>.
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
