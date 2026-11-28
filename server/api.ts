import type { IncomingMessage, ServerResponse } from "node:http";
import { derivePlayerStyle, type PlayerStyleBadge } from "../domain/player-style";
import type { AuthService } from "./auth";
import type {
  AccountNicknameRecord,
  AccountRecord,
  AppDatabase,
  LeaderboardEntry,
  LeaderboardMode,
  LeaderboardPeriod,
  MatchDetailRecord,
  MatchHistoryResultFilter,
  MatchHistoryScope,
  PlayerMatchHistoryPage,
  PlayerStatsRecord,
} from "./db";

export interface PublicPlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  humanMatchesPlayed: number;
  humanWins: number;
  humanWinRate: number;
  humanPoints: number;
  currentStreak: number;
  bestStreak: number;
  totalAttacks: number;
  totalTargeted: number;
  totalChallenges: number;
  totalBlocks: number;
  totalBluffs: number;
  totalGuessHits: number;
  highestCoins: number;
  lastPlayedAt?: string;
}

export interface PlayerRanksSummary {
  pvpWeekly: number | null;
  pvpAllTime: number | null;
  allWeekly: number | null;
  allAllTime: number | null;
}

export interface PublicPlayerProfile {
  username: string;
  name: string;
  picture?: string;
  createdAt: string;
  stats: PublicPlayerStats;
  ranks: PlayerRanksSummary;
  style: PlayerStyleBadge;
}

export interface NicknameSuggestionItem {
  nickname: string;
  nicknameKey: string;
  useCount: number;
  lastUsedAt: string;
}

export interface NicknamesPayload {
  lastUsed: string | null;
  suggestions: NicknameSuggestionItem[];
}

export interface MyProfileResponse {
  ok: true;
  profile: PublicPlayerProfile & { email: string };
  nicknames: NicknamesPayload;
}

export interface PublicPlayerProfileResponse {
  ok: true;
  isMe: boolean;
  profile: PublicPlayerProfile;
}

export interface PublicLeaderboardEntry {
  rank: number;
  username: string;
  name: string;
  picture?: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  points: number;
  currentStreak: number;
  bestStreak: number;
  totalBluffs: number;
  totalChallenges: number;
  totalBlocks: number;
  highestCoins: number;
  lastPlayedAt?: string;
  isMe: boolean;
}

export interface LeaderboardApiResponse {
  ok: true;
  mode: LeaderboardMode;
  period: LeaderboardPeriod;
  periodStart?: string;
  periodEnd?: string;
  totalEntries: number;
  entries: PublicLeaderboardEntry[];
  myEntry: PublicLeaderboardEntry | null;
}

export interface MatchHistoryApiResponse extends PlayerMatchHistoryPage {
  ok: true;
  username: string;
}

export interface MatchDetailApiResponse {
  ok: true;
  match: MatchDetailRecord;
}

function sendJson(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function emptyStats(): PublicPlayerStats {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalPoints: 0,
    humanMatchesPlayed: 0,
    humanWins: 0,
    humanWinRate: 0,
    humanPoints: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalAttacks: 0,
    totalTargeted: 0,
    totalChallenges: 0,
    totalBlocks: 0,
    totalBluffs: 0,
    totalGuessHits: 0,
    highestCoins: 0,
  };
}

function toPublicStats(rec?: PlayerStatsRecord): PublicPlayerStats {
  if (!rec) return emptyStats();
  return {
    matchesPlayed: rec.matchesPlayed,
    wins: rec.wins,
    losses: rec.losses,
    winRate: rec.winRate,
    totalPoints: rec.totalPoints,
    humanMatchesPlayed: rec.humanMatchesPlayed,
    humanWins: rec.humanWins,
    humanWinRate: rec.humanWinRate,
    humanPoints: rec.humanPoints,
    currentStreak: rec.currentStreak,
    bestStreak: rec.bestStreak,
    totalAttacks: rec.totalAttacks,
    totalTargeted: rec.totalTargeted,
    totalChallenges: rec.totalChallenges,
    totalBlocks: rec.totalBlocks,
    totalBluffs: rec.totalBluffs,
    totalGuessHits: rec.totalGuessHits,
    highestCoins: rec.highestCoins,
    ...(rec.lastPlayedAt ? { lastPlayedAt: rec.lastPlayedAt } : {}),
  };
}

function toPublicLeaderboardEntry(
  entry: LeaderboardEntry,
  viewerAccountId?: string,
): PublicLeaderboardEntry {
  return {
    rank: entry.rank,
    username: entry.username,
    name: entry.name,
    ...(entry.picture ? { picture: entry.picture } : {}),
    matchesPlayed: entry.matchesPlayed,
    wins: entry.wins,
    losses: entry.losses,
    winRate: entry.winRate,
    points: entry.points,
    currentStreak: entry.currentStreak,
    bestStreak: entry.bestStreak,
    totalBluffs: entry.totalBluffs,
    totalChallenges: entry.totalChallenges,
    totalBlocks: entry.totalBlocks,
    highestCoins: entry.highestCoins,
    ...(entry.lastPlayedAt ? { lastPlayedAt: entry.lastPlayedAt } : {}),
    isMe: Boolean(viewerAccountId && entry.accountId === viewerAccountId),
  };
}

function toNicknameItem(rec: AccountNicknameRecord): NicknameSuggestionItem {
  return {
    nickname: rec.nickname,
    nicknameKey: rec.nicknameKey,
    useCount: rec.useCount,
    lastUsedAt: rec.lastUsedAt,
  };
}

function parseIntParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export class ApiService {
  constructor(
    private readonly auth: AuthService,
    private readonly db: AppDatabase,
    private readonly nowFn: () => Date = () => new Date(),
  ) {}

  private authorize(
    req: IncomingMessage,
    res: ServerResponse,
    requireAccount: boolean,
  ): { allowed: true; account: AccountRecord | null } | { allowed: false } {
    const account = this.auth.authenticateCookieHeader(req.headers.cookie);
    if (this.auth.isEnabled()) {
      if (!account) {
        sendJson(res, 401, {
          ok: false,
          error: "Silakan masuk dengan Google terlebih dahulu.",
        });
        return { allowed: false };
      }
      if (!this.auth.isReadyToPlay(account)) {
        sendJson(res, 403, {
          ok: false,
          error: "Selesaikan pengaturan username terlebih dahulu.",
        });
        return { allowed: false };
      }
      return { allowed: true, account };
    }

    if (requireAccount) {
      if (!account) {
        sendJson(res, 401, {
          ok: false,
          error: "Silakan masuk dengan Google terlebih dahulu.",
        });
        return { allowed: false };
      }
      if (!this.auth.isReadyToPlay(account)) {
        sendJson(res, 403, {
          ok: false,
          error: "Selesaikan pengaturan username terlebih dahulu.",
        });
        return { allowed: false };
      }
    }

    return { allowed: true, account };
  }

  private buildPublicProfile(account: AccountRecord): PublicPlayerProfile {
    const now = this.nowFn();
    const stats = toPublicStats(this.db.stats.getPlayerStats(account.id));
    const ranks: PlayerRanksSummary = {
      pvpWeekly: this.db.stats.getPlayerRank(account.id, "pvp", "weekly", now),
      pvpAllTime: this.db.stats.getPlayerRank(
        account.id,
        "pvp",
        "all_time",
        now,
      ),
      allWeekly: this.db.stats.getPlayerRank(account.id, "all", "weekly", now),
      allAllTime: this.db.stats.getPlayerRank(
        account.id,
        "all",
        "all_time",
        now,
      ),
    };
    return {
      username: account.username ?? "",
      name: account.name,
      ...(account.picture ? { picture: account.picture } : {}),
      createdAt: account.createdAt,
      stats,
      ranks,
      style: derivePlayerStyle(stats),
    };
  }

  private buildNicknamesPayload(accountId: string): NicknamesPayload {
    const lastUsed = this.db.nicknames.getLastUsed(accountId);
    const list = this.db.nicknames.listForAccount(accountId, 30);
    return {
      lastUsed: lastUsed?.nickname ?? null,
      suggestions: list.map(toNicknameItem),
    };
  }

  async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    const isManaged =
      pathname === "/api/leaderboard" ||
      pathname.startsWith("/api/me/") ||
      pathname.startsWith("/api/players/") ||
      pathname.startsWith("/api/matches/");
    if (!isManaged) return false;

    const method = (req.method ?? "GET").toUpperCase();

    // GET /api/me/profile
    if (pathname === "/api/me/profile" && method === "GET") {
      const check = this.authorize(req, res, true);
      if (!check.allowed || !check.account) return true;
      const profile = this.buildPublicProfile(check.account);
      const body: MyProfileResponse = {
        ok: true,
        profile: { ...profile, email: check.account.email },
        nicknames: this.buildNicknamesPayload(check.account.id),
      };
      sendJson(res, 200, body);
      return true;
    }

    // GET /api/me/nicknames
    if (pathname === "/api/me/nicknames" && method === "GET") {
      const check = this.authorize(req, res, true);
      if (!check.allowed || !check.account) return true;
      sendJson(res, 200, {
        ok: true,
        ...this.buildNicknamesPayload(check.account.id),
      });
      return true;
    }

    // DELETE /api/me/nicknames/:key
    const delNickMatch = pathname.match(/^\/api\/me\/nicknames\/([^/]+)$/);
    if (delNickMatch && method === "DELETE") {
      const check = this.authorize(req, res, true);
      if (!check.allowed || !check.account) return true;
      let key: string;
      try {
        key = decodeURIComponent(delNickMatch[1]);
      } catch {
        sendJson(res, 400, { ok: false, error: "Format nama tidak sah." });
        return true;
      }
      const deleted = this.db.nicknames.deleteForAccount(check.account.id, key);
      sendJson(res, 200, {
        ok: true,
        deleted,
        ...this.buildNicknamesPayload(check.account.id),
      });
      return true;
    }

    // GET /api/leaderboard
    if (pathname === "/api/leaderboard" && method === "GET") {
      const check = this.authorize(req, res, false);
      if (!check.allowed) return true;

      const rawMode = url.searchParams.get("mode");
      const mode: LeaderboardMode = rawMode === "all" ? "all" : "pvp";
      const rawPeriod = url.searchParams.get("period");
      const period: LeaderboardPeriod =
        rawPeriod === "all_time" ? "all_time" : "weekly";
      const limit = parseIntParam(url.searchParams.get("limit"), 50, 1, 100);
      const offset = parseIntParam(
        url.searchParams.get("offset"),
        0,
        0,
        10_000,
      );

      const page = this.db.stats.getLeaderboardPage({
        mode,
        period,
        limit,
        offset,
        now: this.nowFn(),
        viewerAccountId: check.account?.id,
      });

      const body: LeaderboardApiResponse = {
        ok: true,
        mode: page.mode,
        period: page.period,
        ...(page.periodStart ? { periodStart: page.periodStart } : {}),
        ...(page.periodEnd ? { periodEnd: page.periodEnd } : {}),
        totalEntries: page.totalEntries,
        entries: page.entries.map((entry) =>
          toPublicLeaderboardEntry(entry, check.account?.id),
        ),
        myEntry: page.myEntry
          ? toPublicLeaderboardEntry(page.myEntry, check.account?.id)
          : null,
      };
      sendJson(res, 200, body);
      return true;
    }

    // GET /api/players/:username/matches
    const playerMatchesMatch = pathname.match(
      /^\/api\/players\/([^/]+)\/matches$/,
    );
    if (playerMatchesMatch && method === "GET") {
      const check = this.authorize(req, res, false);
      if (!check.allowed) return true;

      let username: string;
      try {
        username = decodeURIComponent(playerMatchesMatch[1]);
      } catch {
        sendJson(res, 400, { ok: false, error: "Username tidak sah." });
        return true;
      }
      const target = this.db.accounts.getByUsername(username);
      if (!target?.username) {
        sendJson(res, 404, { ok: false, error: "Pemain tidak ditemukan." });
        return true;
      }

      const rawScope = url.searchParams.get("scope");
      const scope: MatchHistoryScope =
        rawScope === "pvp" || rawScope === "non_pvp" ? rawScope : "all";
      const rawResult = url.searchParams.get("result");
      const result: MatchHistoryResultFilter =
        rawResult === "win" || rawResult === "loss" ? rawResult : "all";
      const limit = parseIntParam(url.searchParams.get("limit"), 20, 1, 50);
      const offset = parseIntParam(
        url.searchParams.get("offset"),
        0,
        0,
        10_000,
      );

      const history = this.db.stats.getMatchHistory(target.id, {
        scope,
        result,
        limit,
        offset,
      });
      const body: MatchHistoryApiResponse = {
        ok: true,
        username: target.username,
        ...history,
      };
      sendJson(res, 200, body);
      return true;
    }

    // GET /api/players/:username
    const playerProfileMatch = pathname.match(/^\/api\/players\/([^/]+)$/);
    if (playerProfileMatch && method === "GET") {
      const check = this.authorize(req, res, false);
      if (!check.allowed) return true;

      let username: string;
      try {
        username = decodeURIComponent(playerProfileMatch[1]);
      } catch {
        sendJson(res, 400, { ok: false, error: "Username tidak sah." });
        return true;
      }
      const target = this.db.accounts.getByUsername(username);
      if (!target?.username) {
        sendJson(res, 404, { ok: false, error: "Pemain tidak ditemukan." });
        return true;
      }

      const body: PublicPlayerProfileResponse = {
        ok: true,
        isMe: Boolean(check.account && check.account.id === target.id),
        profile: this.buildPublicProfile(target),
      };
      sendJson(res, 200, body);
      return true;
    }

    // GET /api/matches/:matchId
    const matchDetailMatch = pathname.match(/^\/api\/matches\/([^/]+)$/);
    if (matchDetailMatch && method === "GET") {
      const check = this.authorize(req, res, false);
      if (!check.allowed) return true;

      let matchId: string;
      try {
        matchId = decodeURIComponent(matchDetailMatch[1]);
      } catch {
        sendJson(res, 400, { ok: false, error: "ID pertandingan tidak sah." });
        return true;
      }
      const detail = this.db.stats.getMatchDetail(matchId);
      if (!detail) {
        sendJson(res, 404, {
          ok: false,
          error: "Pertandingan tidak ditemukan.",
        });
        return true;
      }

      const body: MatchDetailApiResponse = {
        ok: true,
        match: detail,
      };
      sendJson(res, 200, body);
      return true;
    }

    sendJson(res, 404, { ok: false, error: "Endpoint API tidak ditemukan." });
    return true;
  }
}
