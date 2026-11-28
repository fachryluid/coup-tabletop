"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  LeaderboardApiResponse,
  PublicLeaderboardEntry,
} from "../server/api";
import type { LeaderboardMode, LeaderboardPeriod } from "../server/db";

const PAGE_SIZE = 50;

function formatWibDateRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return "";
  try {
    const fmt = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))} WIB`;
  } catch {
    return "";
  }
}

function AvatarThumb({
  name,
  picture,
  size = 36,
}: {
  name: string;
  picture?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  if (picture && !failed) {
    return (
      <span
        className="pg-avatar"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <img
          src={picture}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span
      className="pg-avatar pg-avatar-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tier =
    rank === 1
      ? "gold"
      : rank === 2
        ? "silver"
        : rank === 3
          ? "bronze"
          : undefined;
  return (
    <span className="pg-rank-badge" data-tier={tier}>
      #{rank}
    </span>
  );
}

export function LeaderboardView() {
  const [mode, setMode] = useState<LeaderboardMode>("pvp");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<LeaderboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<0 | 401 | 403>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAuthStatus(0);
    try {
      const params = new URLSearchParams({
        mode,
        period,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/leaderboard?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setAuthStatus(res.status);
        setData(null);
        return;
      }
      const json = (await res.json()) as
        | LeaderboardApiResponse
        | { ok: false; error?: string };
      if (!res.ok || !json.ok) {
        setError(
          !json.ok && json.error ? json.error : "Gagal memuat leaderboard.",
        );
        return;
      }
      setData(json);
    } catch {
      setError("Koneksi terganggu saat memuat leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [mode, period, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  function switchMode(next: LeaderboardMode) {
    if (next === mode) return;
    setMode(next);
    setOffset(0);
  }

  function switchPeriod(next: LeaderboardPeriod) {
    if (next === period) return;
    setPeriod(next);
    setOffset(0);
  }

  if (authStatus === 401 || authStatus === 403) {
    return (
      <div className="pg-notice-box">
        <h2>
          {authStatus === 403
            ? "Selesaikan pengaturan akun dahulu"
            : "Masuk untuk melihat Leaderboard"}
        </h2>
        <p>
          {authStatus === 403
            ? "Pilih username dan setujui Syarat & Ketentuan di halaman utama untuk mengakses peringkat global."
            : "Papan peringkat Poin Global tersedia untuk pemain yang masuk dengan akun Google."}
        </p>
        <div className="pg-notice-actions">
          {authStatus === 401 ? (
            <a
              href="/api/auth/google?returnTo=%2Fleaderboard"
              className="primary pg-btn-link"
            >
              Masuk dengan Google
            </a>
          ) : (
            <Link href="/" className="primary pg-btn-link">
              Lanjutkan di Beranda
            </Link>
          )}
        </div>
      </div>
    );
  }

  const pointsLabel = mode === "pvp" ? "Poin Global (PvP)" : "Total Poin";
  const periodRange =
    period === "weekly"
      ? formatWibDateRange(data?.periodStart, data?.periodEnd)
      : "Seluruh pertandingan tersimpan";
  const entries: PublicLeaderboardEntry[] = data?.entries ?? [];
  const totalEntries = data?.totalEntries ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + entries.length < totalEntries;
  const showPodium = offset === 0 && entries.length >= 2;
  const podiumEntries = showPodium ? entries.slice(0, 3) : [];

  return (
    <div className="pg-flow">
      {/* Toolbar: Category Tabs (left) + Period Switcher (right) */}
      <div className="pg-toolbar">
        <div
          className="pg-tablist"
          role="tablist"
          aria-label="Kategori leaderboard"
        >
          <button
            type="button"
            role="tab"
            id="lb-tab-pvp"
            aria-selected={mode === "pvp"}
            className="pg-tab"
            onClick={() => switchMode("pvp")}
          >
            PvP · Semua Manusia
          </button>
          <button
            type="button"
            role="tab"
            id="lb-tab-all"
            aria-selected={mode === "all"}
            className="pg-tab"
            onClick={() => switchMode("all")}
          >
            Semua Match
          </button>
        </div>

        <div
          className="pg-segmented"
          role="group"
          aria-label="Periode waktu"
        >
          <button
            type="button"
            className="pg-seg-btn"
            aria-pressed={period === "weekly"}
            onClick={() => switchPeriod("weekly")}
          >
            Mingguan
          </button>
          <button
            type="button"
            className="pg-seg-btn"
            aria-pressed={period === "all_time"}
            onClick={() => switchPeriod("all_time")}
          >
            Sepanjang Masa
          </button>
        </div>
      </div>

      {/* Concise context strip */}
      <div className="pg-context-bar">
        <span>
          <strong>{pointsLabel}</strong> —{" "}
          {mode === "pvp"
            ? "khusus meja tanpa computer (semua pemain manusia)."
            : "gabungan PvP, meja campuran, dan solo vs computer."}
        </span>
        {periodRange && <span className="pg-period-tag">{periodRange}</span>}
      </div>

      {/* Compact Sticky "My Position" Strip */}
      {data && (
        <div
          className="pg-my-strip"
          role="region"
          aria-label="Peringkat Anda"
        >
          {data.myEntry ? (
            <>
              <div className="pg-my-strip-left">
                <span className="pg-strip-label">Posisi Kamu</span>
                <div className="pg-player-cell">
                  <RankBadge rank={data.myEntry.rank} />
                  <AvatarThumb
                    name={data.myEntry.name}
                    picture={data.myEntry.picture}
                    size={36}
                  />
                  <div className="pg-player-names">
                    <strong>{data.myEntry.name}</strong>
                    <span>@{data.myEntry.username}</span>
                  </div>
                </div>
              </div>
              <div className="pg-my-strip-stats">
                <div className="pg-strip-metric pg-strip-metric-gold">
                  <span>{pointsLabel}</span>
                  <strong>{data.myEntry.points}</strong>
                </div>
                <div className="pg-strip-metric">
                  <span>Menang / Main</span>
                  <strong>
                    {data.myEntry.wins} / {data.myEntry.matchesPlayed}
                  </strong>
                </div>
                <div className="pg-strip-metric">
                  <span>Win Rate</span>
                  <strong>{data.myEntry.winRate}%</strong>
                </div>
                <div className="pg-strip-metric">
                  <span>Rekor Streak</span>
                  <strong>{data.myEntry.bestStreak}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="pg-my-strip-empty">
              <span className="pg-strip-label">Posisi Kamu</span>
              <p>
                Belum masuk klasemen{" "}
                {mode === "pvp" ? "PvP (semua manusia) " : ""}
                {period === "weekly" ? "minggu ini" : "ini"}. Selesaikan 1
                pertandingan untuk mulai mencatat poin.
              </p>
              <Link href="/profile" className="pg-text-link">
                Profil Saya →
              </Link>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="pg-error">
          {error}
        </p>
      )}

      {loading ? (
        <div className="pg-loading-box">Memuat papan peringkat…</div>
      ) : entries.length === 0 ? (
        <div className="pg-notice-box">
          <h2>Belum ada peringkat pada kategori ini</h2>
          <p>
            {mode === "pvp"
              ? "Selesaikan pertandingan dengan minimal 2 pemain manusia (tanpa computer) untuk mulai mengumpulkan Poin Global PvP."
              : "Selesaikan pertandingan pertamamu untuk tampil di papan peringkat."}
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {showPodium && (
            <div className="pg-podium-grid" aria-label="Peringkat teratas">
              {podiumEntries.map((item) => {
                const tier =
                  item.rank === 1 ? "gold" : item.rank === 2 ? "silver" : "bronze";
                return (
                  <Link
                    key={item.username}
                    href={`/u/${encodeURIComponent(item.username)}`}
                    className="pg-podium-card"
                    data-tier={tier}
                    data-me={item.isMe || undefined}
                  >
                    <div className="pg-podium-head">
                      <RankBadge rank={item.rank} />
                      <span className="pg-podium-pts">
                        <strong>{item.points}</strong>
                        <small>poin</small>
                      </span>
                    </div>
                    <div className="pg-podium-player">
                      <AvatarThumb
                        name={item.name}
                        picture={item.picture}
                        size={42}
                      />
                      <div className="pg-player-names">
                        <strong>
                          {item.name}
                          {item.isMe ? " (Kamu)" : ""}
                        </strong>
                        <span>@{item.username}</span>
                      </div>
                    </div>
                    <div className="pg-podium-foot">
                      <span>
                        {item.wins}M / {item.matchesPlayed} main
                      </span>
                      <span>WR {item.winRate}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Structured Data Table */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="lb-table-caption"
            className="pg-table-wrapper"
          >
            <table className="pg-table pg-leaderboard-table">
              <caption id="lb-table-caption" className="sr-only">
                Leaderboard {pointsLabel}{" "}
                {period === "weekly" ? "Mingguan" : "Sepanjang Masa"}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="pg-col-rank">
                    #
                  </th>
                  <th scope="col" className="pg-col-player">
                    Pemain
                  </th>
                  <th scope="col" className="pg-col-num">
                    Poin
                  </th>
                  <th scope="col" className="pg-col-num">
                    Menang
                  </th>
                  <th scope="col" className="pg-col-num">
                    Main
                  </th>
                  <th scope="col" className="pg-col-num">
                    Win Rate
                  </th>
                  <th scope="col" className="pg-col-num">
                    Streak
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.username} data-me={row.isMe || undefined}>
                    <th scope="row" className="pg-cell-rank">
                      <RankBadge rank={row.rank} />
                      <Link
                        href={`/u/${encodeURIComponent(row.username)}`}
                        className="pg-mobile-player-link"
                      >
                        <AvatarThumb
                          name={row.name}
                          picture={row.picture}
                          size={32}
                        />
                        <span className="pg-player-names">
                          <strong>
                            {row.name}
                            {row.isMe ? " (Kamu)" : ""}
                          </strong>
                          <span>@{row.username}</span>
                        </span>
                      </Link>
                    </th>
                    <td className="pg-cell-player">
                      <Link
                        href={`/u/${encodeURIComponent(row.username)}`}
                        className="pg-player-link"
                      >
                        <AvatarThumb
                          name={row.name}
                          picture={row.picture}
                          size={34}
                        />
                        <span className="pg-player-names">
                          <strong>
                            {row.name}
                            {row.isMe ? " (Kamu)" : ""}
                          </strong>
                          <span>@{row.username}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="pg-col-num pg-cell-points" data-label="Poin">
                      <strong>{row.points}</strong>
                    </td>
                    <td className="pg-col-num" data-label="Menang">
                      {row.wins}
                    </td>
                    <td className="pg-col-num" data-label="Main">
                      {row.matchesPlayed}
                    </td>
                    <td className="pg-col-num" data-label="Win Rate">
                      {row.winRate}%
                    </td>
                    <td className="pg-col-num" data-label="Streak">
                      <span>{row.currentStreak > 0 ? row.currentStreak : "—"}</span>
                      {row.bestStreak > 0 && (
                        <small className="pg-sub-metric">
                          Rekor {row.bestStreak}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="pg-pagination">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                ← Sebelumnya
              </button>
              <span className="pg-muted">
                {offset + 1}–{offset + entries.length} dari {totalEntries} pemain
              </span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Berikutnya →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
