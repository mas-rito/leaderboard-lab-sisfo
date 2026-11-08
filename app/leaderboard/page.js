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
