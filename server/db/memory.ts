import { randomUUID } from "node:crypto";
import { getWeeklyPeriodRange } from "../../domain/player-style";
import { normalizeUsername, validateUsername } from "../username";
import {
  calcDurationSec,
  calcWinRate,
  isLeaderboardEligibleMatch,
  isPurePvpMatch,
  normalizeNicknameKey,
} from "./helpers";
import { LATEST_SCHEMA_VERSION } from "./migrations";
import type {
  AccountNicknameRecord,
  AccountRecord,
  AccountStore,
  AppDatabase,
  DatabaseExportSnapshot,
  LeaderboardEntry,
  LeaderboardMode,
  LeaderboardPageResult,
  LeaderboardPeriod,
  LeaderboardQuery,
  MatchDetailParticipant,
  MatchDetailRecord,
  MatchParticipantRecord,
  MatchRecord,
  NicknameRepository,
  PlayerMatchHistoryPage,
  PlayerMatchHistoryQuery,
  PlayerMatchSummary,
  PlayerStatsRecord,
  RecordMatchInput,
  StatsRepository,
} from "./types";

function sortLeaderboardEntries(entries: Omit<LeaderboardEntry, "rank">[]): LeaderboardEntry[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.matchesPlayed - a.matchesPlayed ||
        b.bestStreak - a.bestStreak ||
        a.username.localeCompare(b.username),
    )
    .map((e, idx) => ({
      ...e,
      rank: idx + 1,
    }));
}

export class MemoryAccountStore implements AccountStore {
  protected byId = new Map<string, AccountRecord>();
  protected bySub = new Map<string, string>();
  protected byUsername = new Map<string, string>();

  getById(id: string): AccountRecord | undefined {
    const rec = this.byId.get(id);
    return rec ? { ...rec } : undefined;
  }

  getBySub(sub: string): AccountRecord | undefined {
    const id = this.bySub.get(sub);
    return id ? this.getById(id) : undefined;
  }

  getByUsername(username: string): AccountRecord | undefined {
    const id = this.byUsername.get(normalizeUsername(username));
    return id ? this.getById(id) : undefined;
  }

  listAll(): AccountRecord[] {
    return Array.from(this.byId.values()).map((r) => ({ ...r }));
  }

  upsertGoogleProfile(profile: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }): AccountRecord {
    const now = new Date().toISOString();
    const email = profile.email.trim().toLowerCase();
    const existingId = this.bySub.get(profile.sub);
    if (existingId) {
      const current = this.byId.get(existingId)!;
      const updated: AccountRecord = {
        ...current,
        email,
        name: profile.name.trim() || current.name,
        picture: profile.picture || current.picture,
        updatedAt: now,
      };
      this.byId.set(existingId, updated);
      this.persist();
      return { ...updated };
    }
    const created: AccountRecord = {
      id: randomUUID(),
      googleSub: profile.sub,
      email,
      name: profile.name.trim() || email.split("@")[0] || "Pemain",
      picture: profile.picture,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(created.id, created);
    this.bySub.set(created.googleSub, created.id);
    this.persist();
    return { ...created };
  }

  completeOnboarding(
    id: string,
    rawUsername: string,
    acceptedAt: string,
  ): AccountRecord {
    const current = this.byId.get(id);
    if (!current) throw Error("Akun tidak ditemukan.");
    const username = validateUsername(rawUsername);
    const owner = this.byUsername.get(username);
    if (owner && owner !== id) {
      throw Error("Username sudah dipakai pemain lain. Pilih username lain.");
    }
    if (current.username && current.username !== username) {
      this.byUsername.delete(current.username);
    }
    const updated: AccountRecord = {
      ...current,
      username,
      termsAcceptedAt: current.termsAcceptedAt ?? acceptedAt,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(id, updated);
    this.byUsername.set(username, id);
    this.persist();
    return { ...updated };
  }

  protected persist(): void {
    // No-op in memory
  }
}

export class MemoryNicknameRepository implements NicknameRepository {
  private entries = new Map<string, Map<string, AccountNicknameRecord>>();

  constructor(private readonly accounts: AccountStore) {}

  recordUsage(
    accountId: string,
    rawNickname: string,
    usedAt = new Date().toISOString(),
  ): AccountNicknameRecord | undefined {
    const nickname = rawNickname.trim().slice(0, 32);
    const key = normalizeNicknameKey(nickname);
    if (!nickname || !key) return undefined;
    if (!this.accounts.getById(accountId)) return undefined;

    let bucket = this.entries.get(accountId);
    if (!bucket) {
      bucket = new Map();
      this.entries.set(accountId, bucket);
    }
    const prev = bucket.get(key);
    const next: AccountNicknameRecord = prev
      ? {
          accountId,
          nickname,
          nicknameKey: key,
          useCount: prev.useCount + 1,
          firstUsedAt: prev.firstUsedAt,
          lastUsedAt: usedAt >= prev.lastUsedAt ? usedAt : prev.lastUsedAt,
        }
      : {
          accountId,
          nickname,
          nicknameKey: key,
          useCount: 1,
          firstUsedAt: usedAt,
          lastUsedAt: usedAt,
        };
    bucket.set(key, next);
    return { ...next };
  }

  listForAccount(accountId: string, limit = 30): AccountNicknameRecord[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const bucket = this.entries.get(accountId);
    if (!bucket) return [];
    return Array.from(bucket.values())
      .sort(
        (a, b) =>
          b.useCount - a.useCount ||
          b.lastUsedAt.localeCompare(a.lastUsedAt) ||
          a.nicknameKey.localeCompare(b.nicknameKey),
      )
      .slice(0, safeLimit)
      .map((r) => ({ ...r }));
  }

  getLastUsed(accountId: string): AccountNicknameRecord | undefined {
    const bucket = this.entries.get(accountId);
    if (!bucket || bucket.size === 0) return undefined;
    const sorted = Array.from(bucket.values()).sort(
      (a, b) =>
        b.lastUsedAt.localeCompare(a.lastUsedAt) ||
        b.useCount - a.useCount ||
        a.nicknameKey.localeCompare(b.nicknameKey),
    );
    return sorted[0] ? { ...sorted[0] } : undefined;
  }

  deleteForAccount(accountId: string, nicknameKey: string): boolean {
    const key = normalizeNicknameKey(nicknameKey);
    if (!key) return false;
    return this.entries.get(accountId)?.delete(key) ?? false;
  }

  listAll(): AccountNicknameRecord[] {
    const out: AccountNicknameRecord[] = [];
    for (const bucket of this.entries.values()) {
      for (const rec of bucket.values()) out.push({ ...rec });
    }
    return out;
  }
}

export class MemoryStatsRepository implements StatsRepository {
  private matches = new Map<string, MatchRecord>();
  private participants: MatchParticipantRecord[] = [];
  private stats = new Map<string, PlayerStatsRecord>();

  constructor(private readonly accounts: AccountStore) {}

  recordMatch(input: RecordMatchInput): boolean {
    if (this.matches.has(input.matchId)) return false;
    const now = new Date().toISOString();
    const isPvp = isPurePvpMatch(input.humanCount, input.botCount);
    const eligible = isLeaderboardEligibleMatch(
      input.endedReason,
      input.totalActions,
    );

    this.matches.set(input.matchId, {
      id: input.matchId,
      roomCode: input.roomCode,
      matchMode: input.matchMode ?? "private",
      endedReason: input.endedReason,
      winnerAccountId: input.winnerAccountId,
      winnerName: input.winnerName,
      winnerIsBot: input.winnerIsBot,
      seatCount: input.seatCount,
      humanCount: input.humanCount,
      botCount: input.botCount,
      timerEnabled: input.timerEnabled,
      oneTimeGuess: input.oneTimeGuess,
      dukeBlocksTax: input.dukeBlocksTax,
      cardTheme: input.cardTheme,
      totalActions: input.totalActions,
      totalChallenges: input.totalChallenges,
      totalBlocks: input.totalBlocks,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    });

    for (const p of input.participants) {
      const validAccountId =
        p.accountId && this.accounts.getById(p.accountId)
          ? p.accountId
          : undefined;
      const earned =
        input.endedReason === "completed" ? Math.max(0, p.pointsEarned ?? 0) : 0;
      const guessBonus =
        input.endedReason === "completed" ? Math.max(0, p.guessBonus ?? 0) : 0;
      this.participants.push({
        ...p,
        id: randomUUID(),
        matchId: input.matchId,
        accountId: validAccountId,
        pointsEarned: earned,
        guessBonus,
      });

      if (!validAccountId || !eligible) continue;
      const prev = this.stats.get(validAccountId);
      const matchesPlayed = (prev?.matchesPlayed ?? 0) + 1;
      const wins = (prev?.wins ?? 0) + (p.isWinner ? 1 : 0);
      const losses = (prev?.losses ?? 0) + (p.isWinner ? 0 : 1);
      const totalPoints = (prev?.totalPoints ?? 0) + earned;
      const humanMatchesPlayed =
        (prev?.humanMatchesPlayed ?? 0) + (isPvp ? 1 : 0);
      const humanWins = (prev?.humanWins ?? 0) + (isPvp && p.isWinner ? 1 : 0);
      const humanPoints = (prev?.humanPoints ?? 0) + (isPvp ? earned : 0);
      const currentStreak = p.isWinner ? (prev?.currentStreak ?? 0) + 1 : 0;
      const bestStreak = Math.max(prev?.bestStreak ?? 0, currentStreak);

      this.stats.set(validAccountId, {
        accountId: validAccountId,
        matchesPlayed,
        wins,
        losses,
        winRate: calcWinRate(wins, matchesPlayed),
        totalPoints,
        humanMatchesPlayed,
        humanWins,
        humanWinRate: calcWinRate(humanWins, humanMatchesPlayed),
        humanPoints,
        currentStreak,
        bestStreak,
        totalAttacks: (prev?.totalAttacks ?? 0) + p.attacksMade,
        totalTargeted: (prev?.totalTargeted ?? 0) + p.timesTargeted,
        totalChallenges: (prev?.totalChallenges ?? 0) + p.challengesMade,
        totalBlocks: (prev?.totalBlocks ?? 0) + p.blocksMade,
        totalBluffs: (prev?.totalBluffs ?? 0) + p.bluffsMade,
        totalGuessHits: (prev?.totalGuessHits ?? 0) + (guessBonus > 0 ? 1 : 0),
        highestCoins: Math.max(prev?.highestCoins ?? 0, p.peakCoins),
        lastPlayedAt: input.finishedAt,
        updatedAt: now,
      });
    }
    return true;
  }

  getPlayerStats(accountId: string): PlayerStatsRecord | undefined {
    const rec = this.stats.get(accountId);
    return rec ? { ...rec } : undefined;
  }

  private buildAllLeaderboardEntries(
    mode: LeaderboardMode,
    period: LeaderboardPeriod,
    now?: Date,
  ): {
    entries: LeaderboardEntry[];
    periodStart?: string;
    periodEnd?: string;
  } {
    if (period === "weekly") {
      const range = getWeeklyPeriodRange(now);
      const grouped = new Map<
        string,
        {
          matchesPlayed: number;
          wins: number;
          losses: number;
          points: number;
          totalBluffs: number;
          totalChallenges: number;
          totalBlocks: number;
          highestCoins: number;
          lastPlayedAt: string;
        }
      >();

      for (const p of this.participants) {
        if (!p.accountId || p.isBot) continue;
        const m = this.matches.get(p.matchId);
        if (!m) continue;
        if (!isLeaderboardEligibleMatch(m.endedReason, m.totalActions)) continue;
        if (m.finishedAt < range.startIso || m.finishedAt >= range.exclusiveEndIso) {
          continue;
        }
        if (mode === "pvp" && !isPurePvpMatch(m.humanCount, m.botCount)) continue;

        const prev = grouped.get(p.accountId) ?? {
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          points: 0,
          totalBluffs: 0,
          totalChallenges: 0,
          totalBlocks: 0,
          highestCoins: 0,
          lastPlayedAt: m.finishedAt,
        };
        prev.matchesPlayed += 1;
        prev.wins += p.isWinner ? 1 : 0;
        prev.losses += p.isWinner ? 0 : 1;
        prev.points += p.pointsEarned;
        prev.totalBluffs += p.bluffsMade;
        prev.totalChallenges += p.challengesMade;
        prev.totalBlocks += p.blocksMade;
        prev.highestCoins = Math.max(prev.highestCoins, p.peakCoins);
        if (m.finishedAt > prev.lastPlayedAt) prev.lastPlayedAt = m.finishedAt;
        grouped.set(p.accountId, prev);
      }

      const raw: Omit<LeaderboardEntry, "rank">[] = [];
      for (const [accountId, agg] of grouped) {
        const account = this.accounts.getById(accountId);
        if (!account?.username) continue;
        const st = this.stats.get(accountId);
        raw.push({
          accountId,
          username: account.username,
          name: account.name,
          ...(account.picture ? { picture: account.picture } : {}),
          matchesPlayed: agg.matchesPlayed,
          wins: agg.wins,
          losses: agg.losses,
          winRate: calcWinRate(agg.wins, agg.matchesPlayed),
          points: agg.points,
          currentStreak: st?.currentStreak ?? 0,
          bestStreak: st?.bestStreak ?? 0,
          totalBluffs: agg.totalBluffs,
          totalChallenges: agg.totalChallenges,
          totalBlocks: agg.totalBlocks,
          highestCoins: agg.highestCoins,
          lastPlayedAt: agg.lastPlayedAt,
        });
      }

      return {
        entries: sortLeaderboardEntries(raw),
        periodStart: range.startIso,
        periodEnd: range.endIso,
      };
    }

    const entries: Omit<LeaderboardEntry, "rank">[] = [];
    for (const st of this.stats.values()) {
      const account = this.accounts.getById(st.accountId);
      if (!account?.username) continue;
      const matchesPlayed =
        mode === "pvp" ? st.humanMatchesPlayed : st.matchesPlayed;
      const wins = mode === "pvp" ? st.humanWins : st.wins;
      const points = mode === "pvp" ? st.humanPoints : st.totalPoints;
      if (matchesPlayed <= 0) continue;
      entries.push({
        accountId: st.accountId,
        username: account.username,
        name: account.name,
        ...(account.picture ? { picture: account.picture } : {}),
        matchesPlayed,
        wins,
        losses: matchesPlayed - wins,
        winRate: calcWinRate(wins, matchesPlayed),
        points,
        currentStreak: st.currentStreak,
        bestStreak: st.bestStreak,
        totalBluffs: st.totalBluffs,
        totalChallenges: st.totalChallenges,
        totalBlocks: st.totalBlocks,
        highestCoins: st.highestCoins,
        lastPlayedAt: st.lastPlayedAt,
      });
    }

    return { entries: sortLeaderboardEntries(entries) };
  }

  getLeaderboardPage(query: LeaderboardQuery = {}): LeaderboardPageResult {
    const mode: LeaderboardMode = query.mode ?? "all";
    const period: LeaderboardPeriod = query.period ?? "all_time";
    const limit = Math.max(1, Math.min(200, Math.floor(query.limit ?? 50)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));

    const { entries: all, periodStart, periodEnd } =
      this.buildAllLeaderboardEntries(mode, period, query.now);
    const myEntry = query.viewerAccountId
      ? all.find((e) => e.accountId === query.viewerAccountId) ?? null
      : null;

    return {
      mode,
      period,
      ...(periodStart ? { periodStart } : {}),
      ...(periodEnd ? { periodEnd } : {}),
      totalEntries: all.length,
      entries: all.slice(offset, offset + limit),
      myEntry,
    };
  }

  getGlobalLeaderboard(query: LeaderboardQuery = {}): LeaderboardEntry[] {
    return this.getLeaderboardPage(query).entries;
  }

  getPlayerRank(
    accountId: string,
    mode: LeaderboardMode,
    period: LeaderboardPeriod,
    now?: Date,
  ): number | null {
    const page = this.getLeaderboardPage({
      mode,
      period,
      limit: 1,
      offset: 0,
      now,
      viewerAccountId: accountId,
    });
    return page.myEntry?.rank ?? null;
  }

  private buildSummaries(accountId: string): PlayerMatchSummary[] {
    return this.participants
      .filter((p) => p.accountId === accountId)
      .map((p) => {
        const m = this.matches.get(p.matchId)!;
        return {
          matchId: m.id,
          roomCode: m.roomCode,
          matchMode: m.matchMode,
          endedReason: m.endedReason,
          nickname: p.nickname,
          isWinner: p.isWinner,
          placementRank: p.placementRank,
          pointsEarned: p.pointsEarned,
          guessBonus: p.guessBonus,
          winnerName: m.winnerName,
          seatCount: m.seatCount,
          humanCount: m.humanCount,
          botCount: m.botCount,
          isPurePvp: isPurePvpMatch(m.humanCount, m.botCount),
          timerEnabled: m.timerEnabled,
          oneTimeGuess: m.oneTimeGuess,
          dukeBlocksTax: m.dukeBlocksTax,
          finalInfluence: p.finalInfluence,
          finalCoins: p.finalCoins,
          peakCoins: p.peakCoins,
          attacksMade: p.attacksMade,
          challengesMade: p.challengesMade,
          blocksMade: p.blocksMade,
          bluffsMade: p.bluffsMade,
          startedAt: m.startedAt,
          finishedAt: m.finishedAt,
          durationSec: calcDurationSec(m.startedAt, m.finishedAt),
        };
      })
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  }

  getRecentMatches(accountId: string, limit = 20): PlayerMatchSummary[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    return this.buildSummaries(accountId).slice(0, safeLimit);
  }

  getMatchHistory(
    accountId: string,
    query: PlayerMatchHistoryQuery = {},
  ): PlayerMatchHistoryPage {
    const scope = query.scope ?? "all";
    const result = query.result ?? "all";
    const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 20)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));

    const filtered = this.buildSummaries(accountId).filter((m) => {
      if (scope === "pvp" && !m.isPurePvp) return false;
      if (scope === "non_pvp" && m.isPurePvp) return false;
      if (result === "win" && (m.endedReason !== "completed" || !m.isWinner)) {
        return false;
      }
      if (result === "loss" && (m.endedReason !== "completed" || m.isWinner)) {
        return false;
      }
      return true;
    });

    const items = filtered.slice(offset, offset + limit).map((full) => {
      const { roomCode: _omitted, ...publicSummary } = full;
      void _omitted;
      return publicSummary;
    });

    return {
      items,
      total: filtered.length,
      hasMore: offset + items.length < filtered.length,
    };
  }

  getMatchDetail(matchId: string): MatchDetailRecord | undefined {
    const m = this.matches.get(matchId);
    if (!m) return undefined;

    const participants: MatchDetailParticipant[] = this.participants
      .filter((p) => p.matchId === matchId)
      .sort(
        (a, b) =>
          (a.placementRank ?? 999) - (b.placementRank ?? 999) ||
          Number(b.isWinner) - Number(a.isWinner) ||
          b.pointsEarned - a.pointsEarned ||
          a.nickname.localeCompare(b.nickname),
      )
      .map((p) => {
        const account = p.accountId ? this.accounts.getById(p.accountId) : undefined;
        return {
          seatId: p.seatId,
          nickname: p.nickname,
          ...(account?.username ? { username: account.username } : {}),
          ...(account?.name ? { name: account.name } : {}),
          ...(account?.picture ? { picture: account.picture } : {}),
          isBot: p.isBot,
          ...(p.botDifficulty ? { botDifficulty: p.botDifficulty } : {}),
          isWinner: p.isWinner,
          ...(p.placementRank != null ? { placementRank: p.placementRank } : {}),
          pointsEarned: p.pointsEarned,
          guessBonus: p.guessBonus,
          finalInfluence: p.finalInfluence,
          finalCoins: p.finalCoins,
          peakCoins: p.peakCoins,
          attacksMade: p.attacksMade,
          timesTargeted: p.timesTargeted,
          challengesMade: p.challengesMade,
          blocksMade: p.blocksMade,
          bluffsMade: p.bluffsMade,
        };
      });

    const winnerParticipant = participants.find((p) => p.isWinner);

    return {
      matchId: m.id,
      matchMode: m.matchMode,
      endedReason: m.endedReason,
      ...(m.winnerName ? { winnerName: m.winnerName } : {}),
      ...(winnerParticipant?.username
        ? { winnerUsername: winnerParticipant.username }
        : {}),
      winnerIsBot: m.winnerIsBot,
      seatCount: m.seatCount,
      humanCount: m.humanCount,
      botCount: m.botCount,
      isPurePvp: isPurePvpMatch(m.humanCount, m.botCount),
      timerEnabled: m.timerEnabled,
      oneTimeGuess: m.oneTimeGuess,
      dukeBlocksTax: m.dukeBlocksTax,
      cardTheme: m.cardTheme,
      totalActions: m.totalActions,
      totalChallenges: m.totalChallenges,
      totalBlocks: m.totalBlocks,
      startedAt: m.startedAt,
      finishedAt: m.finishedAt,
      durationSec: calcDurationSec(m.startedAt, m.finishedAt),
      participants,
    };
  }

  snapshot() {
    return {
      matches: Array.from(this.matches.values()).map((m) => ({ ...m })),
      participants: this.participants.map((p) => ({ ...p })),
      playerStats: Array.from(this.stats.values()).map((s) => ({ ...s })),
    };
  }
}

export function createMemoryDatabase(): AppDatabase {
  const accounts = new MemoryAccountStore();
  const nicknames = new MemoryNicknameRepository(accounts);
  const stats = new MemoryStatsRepository(accounts);

  return {
    driver: "memory",
    schemaVersion: LATEST_SCHEMA_VERSION,
    accounts,
    nicknames,
    stats,
    exportSnapshot(): DatabaseExportSnapshot {
      const snap = stats.snapshot();
      return {
        exportedAt: new Date().toISOString(),
        driver: "memory",
        schemaVersion: LATEST_SCHEMA_VERSION,
        accounts: accounts.listAll(),
        nicknames: nicknames.listAll(),
        matches: snap.matches,
        participants: snap.participants,
        playerStats: snap.playerStats,
      };
    },
    close() {
      // Nothing to close
    },
  };
}
