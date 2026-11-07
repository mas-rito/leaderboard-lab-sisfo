"use client";

import { useEffect, useState } from "react";
import { getRankColor, loadEntries } from "../../lib/leaderboard";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    loadEntries().then(setEntries);
  }, []);

  return (
    <section>
      <h1>Leaderboard game stand Laboratorium Sistem Informasi</h1>
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
            </div>
            <span className="player-level">Level {item.level}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
