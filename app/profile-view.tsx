"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYER_STYLE_CATALOG } from "../domain/player-style";
import type {
  MatchDetailApiResponse,
  MatchHistoryApiResponse,
  MyProfileResponse,
  NicknameSuggestionItem,
  PublicPlayerProfile,
  PublicPlayerProfileResponse,
} from "../server/api";
import type {
  MatchDetailRecord,
  MatchHistoryResultFilter,
  MatchHistoryScope,
  PlayerMatchSummary,
} from "../server/db";

const HISTORY_PAGE_SIZE = 20;

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(sec: number): string {
  if (!sec || sec < 1) return "< 1 mnt";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} dtk`;
  return s > 0 ? `${m} mnt ${s} dtk` : `${m} mnt`;
}

function ProfileAvatar({
  name,
  picture,
}: {
  name: string;
  picture?: string;
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
      <span className="pg-profile-avatar" aria-hidden="true">
        <img
          src={picture}
          alt=""
          width={68}
          height={68}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className="pg-profile-avatar pg-avatar-fallback" aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

export function ProfileView({
  mode,
  username,
}: {
  mode: "me" | "public";
  username?: string;
}) {
  const [profile, setProfile] = useState<
    (PublicPlayerProfile & { email?: string }) | null
  >(null);
  const [nicknames, setNicknames] = useState<NicknameSuggestionItem[]>([]);
  const [lastUsedNick, setLastUsedNick] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<0 | 401 | 403 | 404>(0);

  const [statsTab, setStatsTab] = useState<"pvp" | "all">("pvp");

  const [scope, setScope] = useState<MatchHistoryScope>("all");
  const [resultFilter, setResultFilter] =
    useState<MatchHistoryResultFilter>("all");
  const [matches, setMatches] = useState<Omit<PlayerMatchSummary, "roomCode">[]>(
    [],
  );
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [matchesHasMore, setMatchesHasMore] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, MatchDetailRecord>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const styleDialogRef = useRef<HTMLDialogElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    setAuthStatus(0);
    try {
      const endpoint =
        mode === "me"
          ? "/api/me/profile"
          : `/api/players/${encodeURIComponent(username ?? "")}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setAuthStatus(res.status);
        setProfile(null);
        return;
      }
      if (!res.ok) {
        setError("Gagal memuat profil pemain.");
        return;
      }
      if (mode === "me") {
        const json = (await res.json()) as MyProfileResponse;
        setProfile(json.profile);
        setNicknames(json.nicknames.suggestions);
        setLastUsedNick(json.nicknames.lastUsed);
      } else {
        const json = (await res.json()) as PublicPlayerProfileResponse;
        setProfile(json.profile);
      }
    } catch {
      setError("Koneksi terganggu saat memuat profil.");
    } finally {
      setLoading(false);
    }
  }, [mode, username]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const activeUsername = profile?.username;

  const loadMatches = useCallback(
    async (offset: number, append: boolean) => {
      if (!activeUsername) return;
      setMatchesLoading(true);
      try {
        const params = new URLSearchParams({
          scope,
          result: resultFilter,
          limit: String(HISTORY_PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(
          `/api/players/${encodeURIComponent(activeUsername)}/matches?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as MatchHistoryApiResponse;
        setMatches((prev) => (append ? [...prev, ...json.items] : json.items));
        setMatchesTotal(json.total);
        setMatchesHasMore(json.hasMore);
      } catch {
        // Keep current list on transient error
      } finally {
        setMatchesLoading(false);
      }
    },
    [activeUsername, scope, resultFilter],
  );

  useEffect(() => {
    if (!activeUsername) return;
    void loadMatches(0, false);
  }, [activeUsername, loadMatches]);

  async function toggleMatchDetail(matchId: string) {
    if (expandedId === matchId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(matchId);
    if (details[matchId]) return;
    setDetailLoadingId(matchId);
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as MatchDetailApiResponse;
      if (json.ok && json.match) {
        setDetails((prev) => ({ ...prev, [matchId]: json.match }));
      }
    } finally {
      setDetailLoadingId((cur) => (cur === matchId ? null : cur));
    }
  }

  async function removeNickname(nicknameKey: string) {
    if (deletingKey) return;
    setDeletingKey(nicknameKey);
    try {
      const res = await fetch(
        `/api/me/nicknames/${encodeURIComponent(nicknameKey)}`,
        { method: "DELETE" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        ok?: boolean;
        lastUsed?: string | null;
        suggestions?: NicknameSuggestionItem[];
      };
      if (json.ok) {
        setNicknames(json.suggestions ?? []);
        setLastUsedNick(json.lastUsed ?? null);
      }
    } finally {
      setDeletingKey(null);
    }
  }

  if (authStatus === 401 || authStatus === 403) {
    const returnPath =
      mode === "me"
        ? "/profile"
        : `/u/${encodeURIComponent(username ?? "")}`;
    return (
      <div className="pg-notice-box">
        <h2>
          {authStatus === 403
            ? "Selesaikan pengaturan akun dahulu"
            : "Masuk untuk melihat profil pemain"}
        </h2>
        <p>
          {authStatus === 403
            ? "Pilih username dan setujui Syarat & Ketentuan di beranda untuk membuka halaman profil."
            : "Masuk dengan akun Google untuk melihat profil, statistik karir, dan riwayat pertandingan."}
        </p>
        <div className="pg-notice-actions">
          {authStatus === 401 ? (
            <a
              href={`/api/auth/google?returnTo=${encodeURIComponent(returnPath)}`}
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

  if (authStatus === 404) {
    return (
      <div className="pg-notice-box">
        <h2>Pemain tidak ditemukan</h2>
        <p>
          Akun dengan username <strong>@{username}</strong> belum terdaftar.
        </p>
        <div className="pg-notice-actions">
          <Link href="/leaderboard" className="primary pg-btn-link">
            Lihat Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="pg-loading-box">Memuat profil pemain…</div>;
  }

  if (error || !profile) {
    return (
      <p role="alert" className="pg-error">
        {error || "Profil tidak dapat dimuat."}
      </p>
    );
  }

  const st = profile.stats;
  const shownPoints = statsTab === "pvp" ? st.humanPoints : st.totalPoints;
  const shownMatches =
    statsTab === "pvp" ? st.humanMatchesPlayed : st.matchesPlayed;
  const shownWins = statsTab === "pvp" ? st.humanWins : st.wins;
  const shownWinRate = statsTab === "pvp" ? st.humanWinRate : st.winRate;

  return (
    <div className="pg-flow">
      {/* 1. Identity Band: Left = Avatar + Identity + Playstyle, Right = Rank Summary */}
      <div className="pg-identity-band">
        <div className="pg-identity-main">
          <ProfileAvatar name={profile.name} picture={profile.picture} />
          <div className="pg-identity-text">
            <div className="pg-identity-name-row">
              <h2>{profile.name}</h2>
            </div>
            <div className="pg-identity-meta">
              <span className="pg-handle">@{profile.username}</span>
              <span aria-hidden="true">·</span>
              <span>Bergabung {formatDate(profile.createdAt)}</span>
              {st.lastPlayedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Aktif {formatDate(st.lastPlayedAt)}</span>
                </>
              )}
            </div>
            <div className="pg-style-row" title={profile.style.description}>
              <span className="pg-style-pill">
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2Z" />
                </svg>
                <span>{profile.style.title}</span>
              </span>
              <button
                type="button"
                className="pg-style-help-btn"
                aria-label="Penjelasan Julukan Gaya Bermain"
                aria-haspopup="dialog"
                title="Apa itu Julukan Gaya Bermain?"
                onClick={() => styleDialogRef.current?.showModal()}
              >
                <span aria-hidden="true">?</span>
              </button>
              <span className="pg-style-desc">{profile.style.description}</span>
            </div>
          </div>
        </div>

        <div className="pg-rank-box" aria-label="Peringkat Global">
          <div className="pg-rank-box-grid">
            <div className="pg-rank-cell">
              <span>PvP Mingguan</span>
              <strong>
                {profile.ranks.pvpWeekly ? `#${profile.ranks.pvpWeekly}` : "—"}
              </strong>
            </div>
            <div className="pg-rank-cell">
              <span>PvP All-Time</span>
              <strong>
                {profile.ranks.pvpAllTime ? `#${profile.ranks.pvpAllTime}` : "—"}
              </strong>
            </div>
            <div className="pg-rank-cell">
              <span>Semua Mingguan</span>
              <strong>
                {profile.ranks.allWeekly ? `#${profile.ranks.allWeekly}` : "—"}
              </strong>
            </div>
          </div>
          <Link href="/leaderboard" className="pg-text-link">
            Buka Leaderboard →
          </Link>
        </div>
      </div>

      {/* 2. Career Stats Block */}
      <div className="pg-block" role="region" aria-labelledby="profile-stats-h">
        <div className="pg-block-head">
          <div>
            <h2 id="profile-stats-h">Ringkasan Statistik</h2>
            <p className="pg-block-sub">
              {statsTab === "pvp"
                ? "Khusus pertandingan dengan semua peserta manusia (tanpa computer)."
                : "Total gabungan pertandingan PvP, meja campuran, dan solo vs computer."}
            </p>
          </div>
          <div
            className="pg-segmented"
            role="tablist"
            aria-label="Filter statistik"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statsTab === "pvp"}
              className="pg-seg-btn"
              onClick={() => setStatsTab("pvp")}
            >
              PvP · Manusia
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statsTab === "all"}
              className="pg-seg-btn"
              onClick={() => setStatsTab("all")}
            >
              Semua Match
            </button>
          </div>
        </div>

        {/* Tier 1: 4 Primary KPIs */}
        <div className="pg-kpi-grid">
          <div className="pg-kpi-card pg-kpi-primary">
            <span className="pg-kpi-label">
              {statsTab === "pvp" ? "Poin Global (PvP)" : "Total Poin"}
            </span>
            <strong className="pg-kpi-value">{shownPoints}</strong>
            <small className="pg-kpi-foot">Akumulasi poin dinamis</small>
          </div>

          <div className="pg-kpi-card">
            <span className="pg-kpi-label">Menang / Main</span>
            <strong className="pg-kpi-value">
              {shownWins} <span className="pg-kpi-sep">/</span> {shownMatches}
            </strong>
            <small className="pg-kpi-foot">
              {Math.max(0, shownMatches - shownWins)} kalah
            </small>
          </div>

          <div className="pg-kpi-card">
            <span className="pg-kpi-label">Win Rate</span>
            <strong className="pg-kpi-value">{shownWinRate}%</strong>
            <div className="pg-winrate-track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, shownWinRate)}%` }} />
            </div>
          </div>

          <div className="pg-kpi-card">
            <span className="pg-kpi-label">Win Streak</span>
            <strong className="pg-kpi-value">{st.currentStreak}</strong>
            <small className="pg-kpi-foot">
              Rekor terbaik: {st.bestStreak}
            </small>
          </div>
        </div>

        {/* Tier 2: 6 Playstyle Counters */}
        <div className="pg-counters-grid" aria-label="Metrik gaya bermain">
          <div className="pg-counter-tile">
            <span>Bluff</span>
            <strong>{st.totalBluffs}</strong>
          </div>
          <div className="pg-counter-tile">
            <span>Challenge</span>
            <strong>{st.totalChallenges}</strong>
          </div>
          <div className="pg-counter-tile">
            <span>Block</span>
            <strong>{st.totalBlocks}</strong>
          </div>
          <div className="pg-counter-tile">
            <span>Serangan</span>
            <strong>{st.totalAttacks}</strong>
          </div>
          <div className="pg-counter-tile">
            <span>Puncak Koin</span>
            <strong>{st.highestCoins}</strong>
          </div>
          <div className="pg-counter-tile">
            <span>Tebakan Benar</span>
            <strong>{st.totalGuessHits}</strong>
          </div>
        </div>
      </div>

      {/* 3. Saved Nicknames (Owner Only) */}
      {mode === "me" && (
        <div
          className="pg-block"
          role="region"
          aria-labelledby="profile-nicks-h"
        >
          <div className="pg-block-head">
            <div>
              <h2 id="profile-nicks-h">Nama Panggilan Tersimpan</h2>
              <p className="pg-block-sub">
                Privat · otomatis muncul sebagai saran cepat saat membuat atau
                bergabung ke meja.
              </p>
            </div>
          </div>

          {nicknames.length === 0 ? (
            <p className="pg-muted">
              Belum ada nama panggilan tersimpan. Nama yang kamu pakai di meja
              akan otomatis dicatat di sini.
            </p>
          ) : (
            <ul className="pg-nick-list">
              {nicknames.map((item) => {
                const isLast =
                  lastUsedNick &&
                  item.nickname.toLowerCase() === lastUsedNick.toLowerCase();
                return (
                  <li key={item.nicknameKey} className="pg-nick-pill">
                    <span className="pg-nick-text">{item.nickname}</span>
                    <span className="pg-nick-count">
                      {item.useCount}×{isLast ? " · terbaru" : ""}
                    </span>
                    <button
                      type="button"
                      className="pg-nick-del"
                      disabled={deletingKey === item.nicknameKey}
                      aria-label={`Hapus saran nama ${item.nickname}`}
                      title="Hapus dari daftar saran"
                      onClick={() => void removeNickname(item.nicknameKey)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 4. Match History */}
      <div
        className="pg-block"
        role="region"
        aria-labelledby="profile-history-h"
      >
        <div className="pg-block-head">
          <div>
            <h2 id="profile-history-h">
              Riwayat Pertandingan{" "}
              <span className="pg-heading-count">{matchesTotal}</span>
            </h2>
            <p className="pg-block-sub">
              Klik salah satu pertandingan untuk melihat klasemen dan statistik
              seluruh peserta.
            </p>
          </div>

          <div className="pg-filters-bar">
            <div
              className="pg-segmented"
              role="group"
              aria-label="Filter jenis meja"
            >
              <button
                type="button"
                className="pg-seg-btn"
                aria-pressed={scope === "all"}
                onClick={() => setScope("all")}
              >
                Semua
              </button>
              <button
                type="button"
                className="pg-seg-btn"
                aria-pressed={scope === "pvp"}
                onClick={() => setScope("pvp")}
              >
                PvP
              </button>
              <button
                type="button"
                className="pg-seg-btn"
                aria-pressed={scope === "non_pvp"}
                onClick={() => setScope("non_pvp")}
              >
                Bot &amp; Campur
              </button>
            </div>

            <div
              className="pg-segmented"
              role="group"
              aria-label="Filter hasil"
            >
              <button
                type="button"
                className="pg-seg-btn"
                aria-pressed={resultFilter === "all"}
                onClick={() => setResultFilter("all")}
              >
                Semua
              </button>
              <button
                type="button"
                className="pg-seg-btn"
                aria-pressed={resultFilter === "win"}
                onClick={() => setResultFilter("win")}
              >
                Menang
              </button>
              <button
                type="button"
                className="pg-seg-btn"
                aria-pressed={resultFilter === "loss"}
                onClick={() => setResultFilter("loss")}
              >
                Kalah
              </button>
            </div>
          </div>
        </div>

        {matchesLoading && matches.length === 0 ? (
          <div className="pg-loading-box">Memuat riwayat pertandingan…</div>
        ) : matches.length === 0 ? (
          <p className="pg-muted">
            Belum ada pertandingan yang sesuai dengan filter ini.
          </p>
        ) : (
          <>
            <ul className="pg-match-list">
              {matches.map((m) => {
                const isExpanded = expandedId === m.matchId;
                const detail = details[m.matchId];
                const outcomeKind =
                  m.endedReason === "host_ended"
                    ? "ended"
                    : m.isWinner
                      ? "win"
                      : "loss";
                const outcomeText =
                  m.endedReason === "host_ended"
                    ? "Diakhiri Host"
                    : m.isWinner
                      ? "#1 Menang"
                      : m.placementRank
                        ? `Peringkat #${m.placementRank}`
                        : "Kalah";

                return (
                  <li
                    key={m.matchId}
                    className="pg-match-card"
                    data-outcome={outcomeKind}
                  >
                    <button
                      type="button"
                      className="pg-match-trigger"
                      aria-expanded={isExpanded}
                      onClick={() => void toggleMatchDetail(m.matchId)}
                    >
                      {/* Zone 1: Outcome & Points */}
                      <div className="pg-match-zone-outcome">
                        <span
                          className="pg-outcome-badge"
                          data-kind={outcomeKind}
                        >
                          {outcomeText}
                        </span>
                        <div className="pg-match-pts-row">
                          <span className="pg-points-text">
                            {m.pointsEarned > 0
                              ? `+${m.pointsEarned} poin`
                              : "0 poin"}
                          </span>
                          {m.guessBonus > 0 && (
                            <span className="pg-bonus-tag">
                              +{m.guessBonus} Guess
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Zone 2: Table & Nickname Info */}
                      <div className="pg-match-zone-info">
                        <div className="pg-match-title-line">
                          <span className="pg-match-nick">
                            <span className="pg-muted">Sebagai</span>{" "}
                            <strong>{m.nickname}</strong>
                          </span>
                          <span
                            className="pg-mode-tag"
                            data-pvp={m.isPurePvp || undefined}
                          >
                            {m.isPurePvp
                              ? "PvP"
                              : m.humanCount === 1
                                ? "Solo vs Bot"
                                : "Campur"}
                          </span>
                        </div>
                        <div className="pg-match-sub-line">
                          <span>
                            {m.seatCount} kursi ({m.humanCount} manusia
                            {m.botCount > 0 ? `, ${m.botCount} bot` : ""})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDuration(m.durationSec)}</span>
                          {m.timerEnabled && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Timer 30d</span>
                            </>
                          )}
                          {m.oneTimeGuess && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>One-Time Guess</span>
                            </>
                          )}
                          {m.dukeBlocksTax && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Duke Blocks Tax</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Zone 3: Timestamp & Expand */}
                      <div className="pg-match-zone-time">
                        <time dateTime={m.finishedAt}>
                          {formatDateTime(m.finishedAt)}
                        </time>
                        <span className="pg-detail-cue">
                          {isExpanded ? "Tutup ▲" : "Detail ▼"}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="pg-match-detail">
                        {detailLoadingId === m.matchId && !detail ? (
                          <p className="pg-muted">Memuat detail peserta…</p>
                        ) : detail ? (
                          <div
                            tabIndex={0}
                            role="region"
                            aria-label="Detail peserta pertandingan"
                            className="pg-table-wrapper"
                          >
                            <table className="pg-table pg-detail-table">
                              <thead>
                                <tr>
                                  <th scope="col" className="pg-col-rank">
                                    #
                                  </th>
                                  <th scope="col">Peserta</th>
                                  <th scope="col" className="pg-col-num">
                                    Poin
                                  </th>
                                  <th scope="col" className="pg-col-num">
                                    Sisa Kartu
                                  </th>
                                  <th scope="col" className="pg-col-num">
                                    Koin Puncak
                                  </th>
                                  <th scope="col" className="pg-col-num">
                                    Serang / Bluff / Tantang / Blok
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.participants.map((p) => (
                                  <tr
                                    key={p.seatId}
                                    data-winner={p.isWinner || undefined}
                                  >
                                    <th scope="row" className="pg-col-rank">
                                      {p.placementRank
                                        ? `#${p.placementRank}`
                                        : "—"}
                                    </th>
                                    <td data-label="Peserta">
                                      <span className="pg-detail-seat">
                                        <strong>{p.nickname}</strong>
                                        {p.isBot ? (
                                          <span className="pg-bot-pill">
                                            Computer ·{" "}
                                            {p.botDifficulty ?? "normal"}
                                          </span>
                                        ) : p.username ? (
                                          <Link
                                            href={`/u/${encodeURIComponent(p.username)}`}
                                            className="pg-text-link"
                                          >
                                            @{p.username}
                                          </Link>
                                        ) : null}
                                      </span>
                                    </td>
                                    <td
                                      className="pg-col-num pg-cell-points"
                                      data-label="Poin"
                                    >
                                      <strong>+{p.pointsEarned}</strong>
                                      {p.guessBonus > 0 && (
                                        <small className="pg-sub-metric">
                                          +{p.guessBonus} Guess
                                        </small>
                                      )}
                                    </td>
                                    <td
                                      className="pg-col-num"
                                      data-label="Sisa Kartu"
                                    >
                                      {p.finalInfluence}
                                    </td>
                                    <td
                                      className="pg-col-num"
                                      data-label="Koin Puncak"
                                    >
                                      {p.peakCoins}
                                    </td>
                                    <td
                                      className="pg-col-num"
                                      data-label="Aksi"
                                    >
                                      {p.attacksMade} / {p.bluffsMade} /{" "}
                                      {p.challengesMade} / {p.blocksMade}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="pg-muted">Detail tidak tersedia.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {matchesHasMore && (
              <div className="pg-pagination">
                <button
                  type="button"
                  disabled={matchesLoading}
                  onClick={() => void loadMatches(matches.length, true)}
                >
                  {matchesLoading ? "Memuat…" : "Muat lebih banyak"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <dialog
        ref={styleDialogRef}
        className="pg-style-modal"
        aria-labelledby="pg-style-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="pg-style-modal-head">
          <div>
            <h2 id="pg-style-modal-title">Julukan Gaya Bermain</h2>
            <p className="pg-style-modal-sub">
              Ditentukan otomatis dari statistik karir dan diperbarui seiring
              cara bermainmu.
            </p>
          </div>
          <button
            type="button"
            className="pg-style-close-btn"
            aria-label="Tutup penjelasan julukan"
            onClick={() => styleDialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="pg-style-modal-body">
          <ul className="pg-style-catalog">
            {PLAYER_STYLE_CATALOG.map((item) => {
              const active = item.id === profile.style.id;
              return (
                <li
                  key={item.id}
                  className="pg-style-catalog-item"
                  data-active={active || undefined}
                >
                  <div className="pg-style-catalog-top">
                    <strong>{item.title}</strong>
                    {active && (
                      <span className="pg-style-active-tag">Saat ini</span>
                    )}
                  </div>
                  <p className="pg-style-catalog-desc">{item.description}</p>
                  <small className="pg-style-catalog-criteria">
                    {item.criteria}
                  </small>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="pg-style-modal-foot">
          <button
            type="button"
            className="primary"
            onClick={() => styleDialogRef.current?.close()}
          >
            Mengerti
          </button>
        </div>
      </dialog>
    </div>
  );
}
