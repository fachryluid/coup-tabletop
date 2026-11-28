"use client";
import { useEffect, useMemo } from "react";
import { computeMatchStats, type MatchAwardId } from "../domain/match-stats";
import type { RoomView } from "../domain/view";
import type { Command } from "../server/rooms";

function playMatchOverSound(kind: "win" | "finish" | "ended") {
  if (typeof window === "undefined") return;
  try {
    const savedVol = Number(localStorage.getItem("coup:music-volume"));
    const volume =
      Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1
        ? savedVol
        : 0.35;
    if (volume <= 0.01) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = volume * 0.35;
    master.connect(ctx.destination);

    const scheduleNote = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType,
      peak: number,
    ) => {
      const now = ctx.currentTime + startOffset;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1600, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(env);
      env.connect(master);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    };

    if (kind === "win") {
      // Triumphant warm brass/harp royal fanfare
      const notes = [
        [261.63, 0.0, 0.45],
        [329.63, 0.11, 0.45],
        [392.0, 0.22, 0.5],
        [523.25, 0.34, 1.3],
        [659.25, 0.44, 1.25],
        [783.99, 0.54, 1.2],
      ];
      for (const [f, t, d] of notes) {
        scheduleNote(f, t, d, "triangle", 0.22);
      }
      scheduleNote(130.81, 0.34, 1.35, "sine", 0.26);
    } else if (kind === "finish") {
      // Regal resolving court cadence
      const notes = [
        [293.66, 0.0, 0.5],
        [349.23, 0.14, 0.55],
        [440.0, 0.28, 1.15],
        [523.25, 0.4, 1.1],
      ];
      for (const [f, t, d] of notes) {
        scheduleNote(f, t, d, "triangle", 0.18);
      }
      scheduleNote(146.83, 0.28, 1.2, "sine", 0.22);
    } else {
      // Soft neutral gavel/bell chime when host ends match
      scheduleNote(392.0, 0.0, 0.65, "sine", 0.18);
      scheduleNote(293.66, 0.18, 0.8, "sine", 0.16);
    }

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 2200);
  } catch {
    // Ignore autoplay restrictions silently
  }
}

function AwardIcon({ id }: { id: MatchAwardId }) {
  switch (id) {
    case "most_targeted":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case "most_aggressive":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19 19 5m0 0-5 .5M19 5l-.5 5" />
          <path d="M19 19 5 5m0 0 5 .5M5 5l.5 5" />
        </svg>
      );
    case "most_challenges":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" />
          <path d="M12 8v5m0 3h.01" />
        </svg>
      );
    case "most_blocks":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 7v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V7l-8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "most_bluffs":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9c0 5 3.5 9 8 9s8-4 8-9V5l-8-2-8 2v4Z" />
          <path d="M8.5 10h.01M15.5 10h.01M9 14c1 .9 2 1.2 3 1.2s2-.3 3-1.2" />
        </svg>
      );
    case "richest_peak":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10m3-7.5c0-1-1.3-1.5-3-1.5s-3 .7-3 1.8c0 2.4 6 1.2 6 3.7 0 1.2-1.3 2-3 2s-3-.8-3-1.8" />
        </svg>
      );
  }
}

export function MatchOverOverlay({
  room,
  host,
  send,
  onHide,
  onReturnHome,
}: {
  room: RoomView;
  host: boolean;
  send: (cmd: Command) => void;
  onHide: () => void;
  onReturnHome: () => void;
}) {
  const g = room.game!;
  const winner = g.winner
    ? g.players.find((p) => p.id === g.winner)
    : undefined;
  const iWon = !!winner && winner.id === room.me;
  const stats = useMemo(() => computeMatchStats(g), [g]);

  useEffect(() => {
    playMatchOverSound(winner ? (iWon ? "win" : "finish") : "ended");
  }, [winner, iWon]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onHide]);

  const placementById = useMemo(
    () => new Map((g.matchResults ?? []).map((item) => [item.id, item])),
    [g.matchResults],
  );
  const winnerPlacement = winner ? placementById.get(winner.id) : undefined;

  const title = winner
    ? iWon
      ? "Anda Menang!"
      : winner.name + " Menang!"
    : "Pertandingan Diakhiri";

  const subtitle = winner
    ? `Sisa ${winner.influence} influence · ◉ ${winner.coins} koin${
        winnerPlacement
          ? ` · +${winnerPlacement.points} poin${
              winnerPlacement.guessBonus
                ? ` (termasuk +${winnerPlacement.guessBonus} bonus tebakan)`
                : ""
            }`
          : ""
      }`
    : "Pertandingan diakhiri oleh host tanpa pemenang.";

  return (
    <div
      className="over-overlay"
      role="dialog"
      aria-label="Hasil pertandingan dan klasemen"
      onClick={(e) => {
        if (e.target === e.currentTarget) onHide();
      }}
    >
      <div className="action-backdrop" aria-hidden="true" onClick={onHide} />
      <button
        type="button"
        className="icon-btn action-peek-btn"
        aria-label="Lihat meja"
        title="Sembunyikan sementara untuk melihat meja"
        onClick={onHide}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      <div
        className="over-stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) onHide();
        }}
      >
        <header className="over-hero">
          <div className="over-crest" data-winner={!!winner || undefined} aria-hidden="true">
            {winner ? (
              <svg viewBox="0 0 48 48" fill="none">
                <path
                  d="M7 34 11 15l9 8 4-11 4 11 9-8 4 19H7Z"
                  fill="currentColor"
                  fillOpacity="0.22"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 39h30"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="24" r="16" />
                <path d="M18 18h12v12H18z" fill="currentColor" fillOpacity="0.2" />
              </svg>
            )}
          </div>
          <span className="action-context-pill">
            {winner ? "Pertandingan Selesai" : "Sesi Dihentikan"}
          </span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        <div className="over-grid">
          <section className="over-card standings">
            <div className="over-card-head">
              <h2>Klasemen Sesi</h2>
              <small>{room.seats.length} pemain</small>
            </div>
            <table className="podium-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pemain</th>
                  {winner && <th>Partai</th>}
                  <th>Menang</th>
                  <th>Poin</th>
                </tr>
              </thead>
              <tbody>
                {room.leaderboard?.map((row, idx) => {
                  const matchResult = placementById.get(row.id);
                  const earned = matchResult?.points ?? row.lastPoints;
                  return (
                    <tr
                      key={row.id}
                      data-rank={idx + 1}
                      data-winner={row.id === winner?.id || undefined}
                      data-me={row.id === room.me || undefined}
                      style={{ animationDelay: `${idx * 70}ms` }}
                    >
                      <td className="rank-cell">
                        <span className="rank-medal" data-rank={idx + 1}>
                          {idx + 1}
                        </span>
                      </td>
                      <td>
                        <b>{row.name}</b>
                        {row.id === room.me && (
                          <span className="you-tag">Anda</span>
                        )}
                        {row.id === winner?.id && (
                          <span className="win-tag">Juara</span>
                        )}
                      </td>
                      {winner && (
                        <td className="delta-cell">
                          {earned !== undefined ? (
                            <span className="delta-stack">
                              <span
                                className="points-delta"
                                data-positive={earned > 0 || undefined}
                                title={
                                  matchResult?.guessBonus
                                    ? `Termasuk +${matchResult.guessBonus} bonus tebakan benar`
                                    : undefined
                                }
                              >
                                +{earned}
                              </span>
                              {matchResult?.guessBonus ? (
                                <span
                                  className="guess-bonus-tag"
                                  title="Bonus tebakan benar One-Time Guess"
                                >
                                  +{matchResult.guessBonus} tebak
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="meta-cell">{row.wins}</td>
                      <td className="wins-cell">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="over-card match-stats">
            <div className="over-card-head">
              <h2>Statistik Partai</h2>
              <div className="stats-pills">
                <span>{stats.totalActions} aksi</span>
                <span>{stats.totalChallenges} challenge</span>
                <span>{stats.totalBlocks} blok</span>
              </div>
            </div>
            {stats.awards.length > 0 ? (
              <div className="awards-grid">
                {stats.awards.map((award, idx) => (
                  <article
                    key={award.id}
                    className="award-tile"
                    data-award={award.id}
                    style={{ animationDelay: `${idx * 65 + 80}ms` }}
                  >
                    <span className="award-icon" aria-hidden="true">
                      <AwardIcon id={award.id} />
                    </span>
                    <div className="award-copy">
                      <small>{award.title}</small>
                      <b>{award.playerName}</b>
                      <span>{award.summary}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="stats-empty">
                Belum cukup aksi tercatat untuk sorotan statistik partai ini.
              </p>
            )}
          </section>
        </div>

        <footer className="over-actions">
          {host ? (
            <>
              <button
                type="button"
                className="primary with-icon"
                onClick={() => send({ type: "again" })}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
                <span>Main lagi</span>
              </button>
              <button
                type="button"
                className="with-icon over-lobby-btn"
                onClick={() => send({ type: "rematch" })}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1v-9.5Z" />
                </svg>
                <span>Kembali ke Lobi</span>
              </button>
            </>
          ) : (
            <span className="over-waiting-pill">
              Menunggu host memulai partai berikutnya atau kembali ke lobi…
            </span>
          )}
          <button
            type="button"
            className="with-icon over-home-btn"
            onClick={onReturnHome}
          >
            <svg
              aria-hidden="true"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            <span>Halaman awal</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
