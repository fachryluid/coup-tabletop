import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Difficulty } from "../../domain/model";
import { getWeeklyPeriodRange } from "../../domain/player-style";
import { normalizeUsername, validateUsername } from "../username";
import {
  calcDurationSec,
  calcWinRate,
  isLeaderboardEligibleMatch,
  isPurePvpMatch,
  MIN_LEADERBOARD_ACTIONS,
  normalizeNicknameKey,
} from "./helpers";
import { runSqliteMigrations } from "./migrations";
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
  MatchEndedReason,
  MatchMode,
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

interface AccountRow {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  picture: string | null;
  username: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NicknameRow {
  account_id: string;
  nickname: string;
  nickname_key: string;
  use_count: number;
  first_used_at: string;
  last_used_at: string;
}

interface PlayerStatsRow {
  account_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  total_points: number;
  human_matches_played: number;
  human_wins: number;
  human_points: number;
  current_streak: number;
  best_streak: number;
  total_attacks: number;
  total_targeted: number;
  total_challenges: number;
  total_blocks: number;
  total_bluffs: number;
  total_guess_hits: number;
  highest_coins: number;
  last_played_at: string | null;
  updated_at: string;
}

interface LeaderboardRow {
  account_id: string;
  username: string;
  name: string;
  picture: string | null;
  matches_played: number;
  wins: number;
  losses: number;
  points: number;
  current_streak: number;
  best_streak: number;
  total_bluffs: number;
  total_challenges: number;
  total_blocks: number;
  highest_coins: number;
  last_played_at: string | null;
}

interface MatchRow {
  id: string;
  room_code: string;
  match_mode: MatchMode;
  ended_reason: MatchEndedReason;
  winner_account_id: string | null;
  winner_name: string | null;
  winner_is_bot: number;
  seat_count: number;
  human_count: number;
  bot_count: number;
  timer_enabled: number;
  one_time_guess: number;
  duke_blocks_tax: number;
  card_theme: string;
  total_actions: number;
  total_challenges: number;
  total_blocks: number;
  started_at: string;
  finished_at: string;
}

interface ParticipantRow {
  id: string;
  match_id: string;
  seat_id: string;
  account_id: string | null;
  nickname: string;
  is_bot: number;
  bot_difficulty: Difficulty | null;
  is_winner: number;
  placement_rank: number | null;
  points_earned: number;
  guess_bonus: number;
  final_influence: number;
  final_coins: number;
  peak_coins: number;
  attacks_made: number;
  times_targeted: number;
  challenges_made: number;
  blocks_made: number;
  bluffs_made: number;
}

interface MatchDetailParticipantRow extends ParticipantRow {
  username: string | null;
  account_name: string | null;
  account_picture: string | null;
}

interface RecentMatchRow {
  match_id: string;
  room_code: string;
  match_mode: MatchMode;
  ended_reason: MatchEndedReason;
  nickname: string;
  is_winner: number;
  placement_rank: number | null;
  points_earned: number;
  guess_bonus: number;
  winner_name: string | null;
  seat_count: number;
  human_count: number;
  bot_count: number;
  timer_enabled: number;
  one_time_guess: number;
  duke_blocks_tax: number;
  final_influence: number;
  final_coins: number;
  peak_coins: number;
  attacks_made: number;
  challenges_made: number;
  blocks_made: number;
  bluffs_made: number;
  started_at: string;
  finished_at: string;
}

function mapAccount(row: AccountRow | undefined): AccountRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
    name: row.name,
    ...(row.picture ? { picture: row.picture } : {}),
    ...(row.username ? { username: row.username } : {}),
    ...(row.terms_accepted_at ? { termsAcceptedAt: row.terms_accepted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNickname(row: NicknameRow): AccountNicknameRecord {
  return {
    accountId: row.account_id,
    nickname: row.nickname,
    nicknameKey: row.nickname_key,
    useCount: row.use_count,
    firstUsedAt: row.first_used_at,
    lastUsedAt: row.last_used_at,
  };
}

function mapPlayerStats(
  row: PlayerStatsRow | undefined,
): PlayerStatsRecord | undefined {
  if (!row) return undefined;
  return {
    accountId: row.account_id,
    matchesPlayed: row.matches_played,
    wins: row.wins,
    losses: row.losses,
    winRate: calcWinRate(row.wins, row.matches_played),
    totalPoints: row.total_points,
    humanMatchesPlayed: row.human_matches_played,
    humanWins: row.human_wins,
    humanWinRate: calcWinRate(row.human_wins, row.human_matches_played),
    humanPoints: row.human_points,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    totalAttacks: row.total_attacks,
    totalTargeted: row.total_targeted,
    totalChallenges: row.total_challenges,
    totalBlocks: row.total_blocks,
    totalBluffs: row.total_bluffs,
    totalGuessHits: row.total_guess_hits ?? 0,
    highestCoins: row.highest_coins,
    ...(row.last_played_at ? { lastPlayedAt: row.last_played_at } : {}),
    updatedAt: row.updated_at,
  };
}

function mapRecentMatchRow(row: RecentMatchRow): PlayerMatchSummary {
  return {
    matchId: row.match_id,
    roomCode: row.room_code,
    matchMode: row.match_mode || "private",
    endedReason: row.ended_reason,
    nickname: row.nickname,
    isWinner: row.is_winner === 1,
    ...(row.placement_rank != null ? { placementRank: row.placement_rank } : {}),
    pointsEarned: row.points_earned,
    guessBonus: row.guess_bonus ?? 0,
    ...(row.winner_name ? { winnerName: row.winner_name } : {}),
    seatCount: row.seat_count,
    humanCount: row.human_count,
    botCount: row.bot_count,
    isPurePvp: isPurePvpMatch(row.human_count, row.bot_count),
    timerEnabled: row.timer_enabled === 1,
    oneTimeGuess: row.one_time_guess === 1,
    dukeBlocksTax: row.duke_blocks_tax === 1,
    finalInfluence: row.final_influence,
    finalCoins: row.final_coins,
    peakCoins: row.peak_coins,
    attacksMade: row.attacks_made,
    challengesMade: row.challenges_made,
    blocksMade: row.blocks_made,
    bluffsMade: row.bluffs_made,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSec: calcDurationSec(row.started_at, row.finished_at),
  };
}

function mapLeaderboardRows(rows: LeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row, idx) => ({
    rank: idx + 1,
    accountId: row.account_id,
    username: row.username,
    name: row.name,
    ...(row.picture ? { picture: row.picture } : {}),
    matchesPlayed: row.matches_played,
    wins: row.wins,
    losses: row.losses,
    winRate: calcWinRate(row.wins, row.matches_played),
    points: row.points,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    totalBluffs: row.total_bluffs,
    totalChallenges: row.total_challenges,
    totalBlocks: row.total_blocks,
    highestCoins: row.highest_coins,
    ...(row.last_played_at ? { lastPlayedAt: row.last_played_at } : {}),
  }));
}

export class SqliteAccountStore implements AccountStore {
  constructor(private readonly db: DatabaseSync) {}

  getById(id: string): AccountRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM accounts WHERE id = ?")
      .get(id) as AccountRow | undefined;
    return mapAccount(row);
  }

  getBySub(sub: string): AccountRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM accounts WHERE google_sub = ?")
      .get(sub) as AccountRow | undefined;
    return mapAccount(row);
  }

  getByUsername(username: string): AccountRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM accounts WHERE username = ?")
      .get(normalizeUsername(username)) as AccountRow | undefined;
    return mapAccount(row);
  }

  listAll(): AccountRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM accounts ORDER BY created_at ASC")
      .all() as unknown as AccountRow[];
    return rows.map((row) => mapAccount(row)!);
  }

  upsertGoogleProfile(profile: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }): AccountRecord {
    const now = new Date().toISOString();
    const email = profile.email.trim().toLowerCase();
    const existing = this.getBySub(profile.sub);
    if (existing) {
      const nextName = profile.name.trim() || existing.name;
      const nextPicture = profile.picture ?? existing.picture ?? null;
      this.db
        .prepare(
          `UPDATE accounts
           SET email = ?, name = ?, picture = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(email, nextName, nextPicture, now, existing.id);
      return this.getById(existing.id)!;
    }

    const id = randomUUID();
    const name = profile.name.trim() || email.split("@")[0] || "Pemain";
    this.db
      .prepare(
        `INSERT INTO accounts (
          id, google_sub, email, name, picture, username, terms_accepted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(id, profile.sub, email, name, profile.picture ?? null, now, now);
    return this.getById(id)!;
  }

  completeOnboarding(
    id: string,
    rawUsername: string,
    acceptedAt: string,
  ): AccountRecord {
    const current = this.getById(id);
    if (!current) throw Error("Akun tidak ditemukan.");
    const username = validateUsername(rawUsername);

    const existingOwner = this.db
      .prepare("SELECT id FROM accounts WHERE username = ?")
      .get(username) as { id: string } | undefined;
    if (existingOwner && existingOwner.id !== id) {
      throw Error("Username sudah dipakai pemain lain. Pilih username lain.");
    }

    const now = new Date().toISOString();
    try {
      this.db
        .prepare(
          `UPDATE accounts
           SET username = ?, terms_accepted_at = COALESCE(terms_accepted_at, ?), updated_at = ?
           WHERE id = ?`,
        )
        .run(username, acceptedAt, now, id);
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        throw Error("Username sudah dipakai pemain lain. Pilih username lain.");
      }
      throw error;
    }
    return this.getById(id)!;
  }
}

export class SqliteNicknameRepository implements NicknameRepository {
  constructor(private readonly db: DatabaseSync) {}

  recordUsage(
    accountId: string,
    rawNickname: string,
    usedAt = new Date().toISOString(),
  ): AccountNicknameRecord | undefined {
    const nickname = rawNickname.trim().slice(0, 32);
    const key = normalizeNicknameKey(nickname);
    if (!nickname || !key) return undefined;

    const hasAccount = this.db
      .prepare("SELECT 1 FROM accounts WHERE id = ?")
      .get(accountId);
    if (!hasAccount) return undefined;

    this.db
      .prepare(
        `INSERT INTO account_nicknames (
          account_id, nickname, nickname_key, use_count, first_used_at, last_used_at
        ) VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(account_id, nickname_key) DO UPDATE SET
          nickname = excluded.nickname,
          use_count = account_nicknames.use_count + 1,
          last_used_at = CASE
            WHEN excluded.last_used_at >= account_nicknames.last_used_at
            THEN excluded.last_used_at
            ELSE account_nicknames.last_used_at
          END`,
      )
      .run(accountId, nickname, key, usedAt, usedAt);

    const row = this.db
      .prepare(
        `SELECT * FROM account_nicknames
         WHERE account_id = ? AND nickname_key = ?`,
      )
      .get(accountId, key) as NicknameRow | undefined;
    return row ? mapNickname(row) : undefined;
  }

  listForAccount(accountId: string, limit = 30): AccountNicknameRecord[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = this.db
      .prepare(
        `SELECT * FROM account_nicknames
         WHERE account_id = ?
         ORDER BY use_count DESC, last_used_at DESC, nickname_key ASC
         LIMIT ?`,
      )
      .all(accountId, safeLimit) as unknown as NicknameRow[];
    return rows.map(mapNickname);
  }

  getLastUsed(accountId: string): AccountNicknameRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM account_nicknames
         WHERE account_id = ?
         ORDER BY last_used_at DESC, use_count DESC, nickname_key ASC
         LIMIT 1`,
      )
      .get(accountId) as NicknameRow | undefined;
    return row ? mapNickname(row) : undefined;
  }

  deleteForAccount(accountId: string, nicknameKey: string): boolean {
    const key = normalizeNicknameKey(nicknameKey);
    if (!key) return false;
    const res = this.db
      .prepare(
        `DELETE FROM account_nicknames
         WHERE account_id = ? AND nickname_key = ?`,
      )
      .run(accountId, key);
    return Number(res.changes) > 0;
  }

  listAll(): AccountNicknameRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM account_nicknames
         ORDER BY account_id ASC, use_count DESC, last_used_at DESC`,
      )
      .all() as unknown as NicknameRow[];
    return rows.map(mapNickname);
  }
}

export class SqliteStatsRepository implements StatsRepository {
  constructor(private readonly db: DatabaseSync) {}

  recordMatch(input: RecordMatchInput): boolean {
    const now = new Date().toISOString();
    const isPvp = isPurePvpMatch(input.humanCount, input.botCount);
    const eligible = isLeaderboardEligibleMatch(
      input.endedReason,
      input.totalActions,
    );
    const matchMode: MatchMode = input.matchMode ?? "private";

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const insertMatch = this.db
        .prepare(
          `INSERT OR IGNORE INTO matches (
            id, room_code, match_mode, ended_reason, winner_account_id, winner_name, winner_is_bot,
            seat_count, human_count, bot_count, timer_enabled, one_time_guess,
            duke_blocks_tax, card_theme, total_actions, total_challenges, total_blocks,
            started_at, finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.matchId,
          input.roomCode,
          matchMode,
          input.endedReason,
          input.winnerAccountId ?? null,
          input.winnerName ?? null,
          input.winnerIsBot ? 1 : 0,
          input.seatCount,
          input.humanCount,
          input.botCount,
          input.timerEnabled ? 1 : 0,
          input.oneTimeGuess ? 1 : 0,
          input.dukeBlocksTax ? 1 : 0,
          input.cardTheme,
          input.totalActions,
          input.totalChallenges,
          input.totalBlocks,
          input.startedAt,
          input.finishedAt,
        );

      // Idempotent guard: already recorded this matchId
      if (Number(insertMatch.changes) === 0) {
        this.db.exec("COMMIT");
        return false;
      }

      const insertParticipant = this.db.prepare(
        `INSERT INTO match_participants (
          id, match_id, seat_id, account_id, nickname, is_bot, bot_difficulty,
          is_winner, placement_rank, points_earned, guess_bonus, final_influence, final_coins,
          peak_coins, attacks_made, times_targeted, challenges_made, blocks_made,
          bluffs_made
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const hasAccountStmt = this.db.prepare(
        "SELECT 1 FROM accounts WHERE id = ?",
      );
      const selectStatsStmt = this.db.prepare(
        "SELECT * FROM player_stats WHERE account_id = ?",
      );
      const upsertStatsStmt = this.db.prepare(
        `INSERT INTO player_stats (
          account_id, matches_played, wins, losses, total_points,
          human_matches_played, human_wins, human_points,
          current_streak, best_streak, total_attacks, total_targeted,
          total_challenges, total_blocks, total_bluffs, total_guess_hits, highest_coins,
          last_played_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          matches_played = excluded.matches_played,
          wins = excluded.wins,
          losses = excluded.losses,
          total_points = excluded.total_points,
          human_matches_played = excluded.human_matches_played,
          human_wins = excluded.human_wins,
          human_points = excluded.human_points,
          current_streak = excluded.current_streak,
          best_streak = excluded.best_streak,
          total_attacks = excluded.total_attacks,
          total_targeted = excluded.total_targeted,
          total_challenges = excluded.total_challenges,
          total_blocks = excluded.total_blocks,
          total_bluffs = excluded.total_bluffs,
          total_guess_hits = excluded.total_guess_hits,
          highest_coins = excluded.highest_coins,
          last_played_at = excluded.last_played_at,
          updated_at = excluded.updated_at`,
      );

      for (const p of input.participants) {
        const validAccountId =
          p.accountId && hasAccountStmt.get(p.accountId) ? p.accountId : null;
        const earned =
          input.endedReason === "completed" ? Math.max(0, p.pointsEarned ?? 0) : 0;
        const guessBonus =
          input.endedReason === "completed" ? Math.max(0, p.guessBonus ?? 0) : 0;

        insertParticipant.run(
          randomUUID(),
          input.matchId,
          p.seatId,
          validAccountId,
          p.nickname,
          p.isBot ? 1 : 0,
          p.botDifficulty ?? null,
          p.isWinner ? 1 : 0,
          p.placementRank ?? null,
          earned,
          guessBonus,
          p.finalInfluence,
          p.finalCoins,
          p.peakCoins,
          p.attacksMade,
          p.timesTargeted,
          p.challengesMade,
          p.blocksMade,
          p.bluffsMade,
        );

        // Only completed matches meeting minimum action count update career/leaderboard stats
        if (!validAccountId || !eligible) continue;

        const prev = selectStatsStmt.get(validAccountId) as
          | PlayerStatsRow
          | undefined;
        const nextMatches = (prev?.matches_played ?? 0) + 1;
        const nextWins = (prev?.wins ?? 0) + (p.isWinner ? 1 : 0);
        const nextLosses = (prev?.losses ?? 0) + (p.isWinner ? 0 : 1);
        const nextTotalPoints = (prev?.total_points ?? 0) + earned;
        const nextHumanMatches =
          (prev?.human_matches_played ?? 0) + (isPvp ? 1 : 0);
        const nextHumanWins =
          (prev?.human_wins ?? 0) + (isPvp && p.isWinner ? 1 : 0);
        const nextHumanPoints =
          (prev?.human_points ?? 0) + (isPvp ? earned : 0);
        const nextStreak = p.isWinner ? (prev?.current_streak ?? 0) + 1 : 0;
        const nextBestStreak = Math.max(prev?.best_streak ?? 0, nextStreak);
        const nextGuessHits =
          (prev?.total_guess_hits ?? 0) + (guessBonus > 0 ? 1 : 0);

        upsertStatsStmt.run(
          validAccountId,
          nextMatches,
          nextWins,
          nextLosses,
          nextTotalPoints,
          nextHumanMatches,
          nextHumanWins,
          nextHumanPoints,
          nextStreak,
          nextBestStreak,
          (prev?.total_attacks ?? 0) + p.attacksMade,
          (prev?.total_targeted ?? 0) + p.timesTargeted,
          (prev?.total_challenges ?? 0) + p.challengesMade,
          (prev?.total_blocks ?? 0) + p.blocksMade,
          (prev?.total_bluffs ?? 0) + p.bluffsMade,
          nextGuessHits,
          Math.max(prev?.highest_coins ?? 0, p.peakCoins),
          input.finishedAt,
          now,
        );
      }

      this.db.exec("COMMIT");
      return true;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getPlayerStats(accountId: string): PlayerStatsRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM player_stats WHERE account_id = ?")
      .get(accountId) as PlayerStatsRow | undefined;
    return mapPlayerStats(row);
  }

  private queryAllLeaderboardEntries(
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
      const pvpFilter =
        mode === "pvp" ? "AND m.human_count >= 2 AND m.bot_count = 0" : "";
      const rows = this.db
        .prepare(
          `SELECT
             a.id AS account_id,
             a.username,
             a.name,
             a.picture,
             COUNT(*) AS matches_played,
             SUM(CASE WHEN mp.is_winner = 1 THEN 1 ELSE 0 END) AS wins,
             SUM(CASE WHEN mp.is_winner = 0 THEN 1 ELSE 0 END) AS losses,
             SUM(mp.points_earned) AS points,
             COALESCE(ps.current_streak, 0) AS current_streak,
             COALESCE(ps.best_streak, 0) AS best_streak,
             SUM(mp.bluffs_made) AS total_bluffs,
             SUM(mp.challenges_made) AS total_challenges,
             SUM(mp.blocks_made) AS total_blocks,
             MAX(mp.peak_coins) AS highest_coins,
             MAX(m.finished_at) AS last_played_at
           FROM match_participants mp
           INNER JOIN matches m ON m.id = mp.match_id
           INNER JOIN accounts a ON a.id = mp.account_id
           LEFT JOIN player_stats ps ON ps.account_id = a.id
           WHERE a.username IS NOT NULL
             AND mp.account_id IS NOT NULL
             AND mp.is_bot = 0
             AND m.ended_reason = 'completed'
             AND m.total_actions >= ?
             AND m.finished_at >= ?
             AND m.finished_at < ?
             ${pvpFilter}
           GROUP BY a.id
           HAVING COUNT(*) > 0
           ORDER BY
             points DESC,
             wins DESC,
             CAST(wins AS REAL) / COUNT(*) DESC,
             matches_played DESC,
             best_streak DESC,
             a.username ASC`,
        )
        .all(
          MIN_LEADERBOARD_ACTIONS,
          range.startIso,
          range.exclusiveEndIso,
        ) as unknown as LeaderboardRow[];
      return {
        entries: mapLeaderboardRows(rows),
        periodStart: range.startIso,
        periodEnd: range.endIso,
      };
    }

    const sql =
      mode === "pvp"
        ? `SELECT
             ps.account_id,
             a.username,
             a.name,
             a.picture,
             ps.human_matches_played AS matches_played,
             ps.human_wins AS wins,
             (ps.human_matches_played - ps.human_wins) AS losses,
             ps.human_points AS points,
             ps.current_streak,
             ps.best_streak,
             ps.total_bluffs,
             ps.total_challenges,
             ps.total_blocks,
             ps.highest_coins,
             ps.last_played_at
           FROM player_stats ps
           INNER JOIN accounts a ON a.id = ps.account_id
           WHERE a.username IS NOT NULL AND ps.human_matches_played > 0
           ORDER BY
             ps.human_points DESC,
             ps.human_wins DESC,
             CAST(ps.human_wins AS REAL) / ps.human_matches_played DESC,
             ps.human_matches_played DESC,
             ps.best_streak DESC,
             a.username ASC`
        : `SELECT
             ps.account_id,
             a.username,
             a.name,
             a.picture,
             ps.matches_played,
             ps.wins,
             ps.losses,
             ps.total_points AS points,
             ps.current_streak,
             ps.best_streak,
             ps.total_bluffs,
             ps.total_challenges,
             ps.total_blocks,
             ps.highest_coins,
             ps.last_played_at
           FROM player_stats ps
           INNER JOIN accounts a ON a.id = ps.account_id
           WHERE a.username IS NOT NULL AND ps.matches_played > 0
           ORDER BY
             ps.total_points DESC,
             ps.wins DESC,
             CAST(ps.wins AS REAL) / ps.matches_played DESC,
             ps.matches_played DESC,
             ps.best_streak DESC,
             a.username ASC`;

    const rows = this.db.prepare(sql).all() as unknown as LeaderboardRow[];
    return { entries: mapLeaderboardRows(rows) };
  }

  getLeaderboardPage(query: LeaderboardQuery = {}): LeaderboardPageResult {
    const mode: LeaderboardMode = query.mode ?? "all";
    const period: LeaderboardPeriod = query.period ?? "all_time";
    const limit = Math.max(1, Math.min(200, Math.floor(query.limit ?? 50)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));

    const { entries: all, periodStart, periodEnd } =
      this.queryAllLeaderboardEntries(mode, period, query.now);
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

  getRecentMatches(accountId: string, limit = 20): PlayerMatchSummary[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = this.db
      .prepare(
        `SELECT
           m.id AS match_id,
           m.room_code,
           m.match_mode,
           m.ended_reason,
           mp.nickname,
           mp.is_winner,
           mp.placement_rank,
           mp.points_earned,
           mp.guess_bonus,
           m.winner_name,
           m.seat_count,
           m.human_count,
           m.bot_count,
           m.timer_enabled,
           m.one_time_guess,
           m.duke_blocks_tax,
           mp.final_influence,
           mp.final_coins,
           mp.peak_coins,
           mp.attacks_made,
           mp.challenges_made,
           mp.blocks_made,
           mp.bluffs_made,
           m.started_at,
           m.finished_at
         FROM match_participants mp
         INNER JOIN matches m ON m.id = mp.match_id
         WHERE mp.account_id = ?
         ORDER BY m.finished_at DESC
         LIMIT ?`,
      )
      .all(accountId, safeLimit) as unknown as RecentMatchRow[];

    return rows.map(mapRecentMatchRow);
  }

  getMatchHistory(
    accountId: string,
    query: PlayerMatchHistoryQuery = {},
  ): PlayerMatchHistoryPage {
    const scope = query.scope ?? "all";
    const result = query.result ?? "all";
    const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 20)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));

    const where: string[] = ["mp.account_id = ?"];
    if (scope === "pvp") {
      where.push("m.human_count >= 2 AND m.bot_count = 0");
    } else if (scope === "non_pvp") {
      where.push("(m.bot_count > 0 OR m.human_count < 2)");
    }
    if (result === "win") {
      where.push("m.ended_reason = 'completed' AND mp.is_winner = 1");
    } else if (result === "loss") {
      where.push("m.ended_reason = 'completed' AND mp.is_winner = 0");
    }

    const whereSql = where.join(" AND ");
    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM match_participants mp
         INNER JOIN matches m ON m.id = mp.match_id
         WHERE ${whereSql}`,
      )
      .get(accountId) as { total: number };
    const total = Number(countRow?.total ?? 0);

    const rows = this.db
      .prepare(
        `SELECT
           m.id AS match_id,
           m.room_code,
           m.match_mode,
           m.ended_reason,
           mp.nickname,
           mp.is_winner,
           mp.placement_rank,
           mp.points_earned,
           mp.guess_bonus,
           m.winner_name,
           m.seat_count,
           m.human_count,
           m.bot_count,
           m.timer_enabled,
           m.one_time_guess,
           m.duke_blocks_tax,
           mp.final_influence,
           mp.final_coins,
           mp.peak_coins,
           mp.attacks_made,
           mp.challenges_made,
           mp.blocks_made,
           mp.bluffs_made,
           m.started_at,
           m.finished_at
         FROM match_participants mp
         INNER JOIN matches m ON m.id = mp.match_id
         WHERE ${whereSql}
         ORDER BY m.finished_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(accountId, limit, offset) as unknown as RecentMatchRow[];

    const items = rows.map((row) => {
      const full = mapRecentMatchRow(row);
      const { roomCode: _omitted, ...publicSummary } = full;
      void _omitted;
      return publicSummary;
    });

    return {
      items,
      total,
      hasMore: offset + items.length < total,
    };
  }

  getMatchDetail(matchId: string): MatchDetailRecord | undefined {
    const matchRow = this.db
      .prepare("SELECT * FROM matches WHERE id = ?")
      .get(matchId) as MatchRow | undefined;
    if (!matchRow) return undefined;

    const participantRows = this.db
      .prepare(
        `SELECT
           mp.*,
           a.username,
           a.name AS account_name,
           a.picture AS account_picture
         FROM match_participants mp
         LEFT JOIN accounts a ON a.id = mp.account_id
         WHERE mp.match_id = ?
         ORDER BY
           CASE WHEN mp.placement_rank IS NULL THEN 999 ELSE mp.placement_rank END ASC,
           mp.is_winner DESC,
           mp.points_earned DESC,
           mp.nickname ASC`,
      )
      .all(matchId) as unknown as MatchDetailParticipantRow[];

    const participants: MatchDetailParticipant[] = participantRows.map((row) => ({
      seatId: row.seat_id,
      nickname: row.nickname,
      ...(row.username ? { username: row.username } : {}),
      ...(row.account_name ? { name: row.account_name } : {}),
      ...(row.account_picture ? { picture: row.account_picture } : {}),
      isBot: row.is_bot === 1,
      ...(row.bot_difficulty ? { botDifficulty: row.bot_difficulty } : {}),
      isWinner: row.is_winner === 1,
      ...(row.placement_rank != null ? { placementRank: row.placement_rank } : {}),
      pointsEarned: row.points_earned,
      guessBonus: row.guess_bonus ?? 0,
      finalInfluence: row.final_influence,
      finalCoins: row.final_coins,
      peakCoins: row.peak_coins,
      attacksMade: row.attacks_made,
      timesTargeted: row.times_targeted,
      challengesMade: row.challenges_made,
      blocksMade: row.blocks_made,
      bluffsMade: row.bluffs_made,
    }));

    const winnerParticipant = participants.find((p) => p.isWinner);

    return {
      matchId: matchRow.id,
      matchMode: matchRow.match_mode || "private",
      endedReason: matchRow.ended_reason,
      ...(matchRow.winner_name ? { winnerName: matchRow.winner_name } : {}),
      ...(winnerParticipant?.username
        ? { winnerUsername: winnerParticipant.username }
        : {}),
      winnerIsBot: matchRow.winner_is_bot === 1,
      seatCount: matchRow.seat_count,
      humanCount: matchRow.human_count,
      botCount: matchRow.bot_count,
      isPurePvp: isPurePvpMatch(matchRow.human_count, matchRow.bot_count),
      timerEnabled: matchRow.timer_enabled === 1,
      oneTimeGuess: matchRow.one_time_guess === 1,
      dukeBlocksTax: matchRow.duke_blocks_tax === 1,
      cardTheme: matchRow.card_theme,
      totalActions: matchRow.total_actions,
      totalChallenges: matchRow.total_challenges,
      totalBlocks: matchRow.total_blocks,
      startedAt: matchRow.started_at,
      finishedAt: matchRow.finished_at,
      durationSec: calcDurationSec(matchRow.started_at, matchRow.finished_at),
      participants,
    };
  }
}

function importLegacyAccountsJson(db: DatabaseSync, legacyFile: string): number {
  if (!existsSync(legacyFile)) return 0;
  try {
    const raw = readFileSync(legacyFile, "utf8");
    const parsed = JSON.parse(raw) as AccountRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return 0;

    const stmt = db.prepare(
      `INSERT OR IGNORE INTO accounts (
        id, google_sub, email, name, picture, username, terms_accepted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    let imported = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const rec of parsed) {
        if (!rec?.id || !rec.googleSub || !rec.email) continue;
        const now = new Date().toISOString();
        const res = stmt.run(
          rec.id,
          rec.googleSub,
          rec.email.trim().toLowerCase(),
          rec.name?.trim() || rec.email.split("@")[0] || "Pemain",
          rec.picture ?? null,
          rec.username ? normalizeUsername(rec.username) : null,
          rec.termsAcceptedAt ?? null,
          rec.createdAt || now,
          rec.updatedAt || now,
        );
        imported += Number(res.changes);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return imported;
  } catch (error) {
    console.error("Gagal mengimpor legacy accounts.json ke SQLite:", error);
    return 0;
  }
}

export function createSqliteDatabase(
  dbPath: string,
  options?: { legacyAccountsFile?: string },
): AppDatabase {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
  }
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  const schemaVersion = runSqliteMigrations(db);

  const legacyPath =
    options?.legacyAccountsFile ??
    (dbPath !== ":memory:" ? join(dirname(dbPath), "accounts.json") : undefined);
  if (legacyPath) {
    importLegacyAccountsJson(db, legacyPath);
  }

  const accounts = new SqliteAccountStore(db);
  const nicknames = new SqliteNicknameRepository(db);
  const stats = new SqliteStatsRepository(db);

  return {
    driver: "sqlite",
    schemaVersion,
    accounts,
    nicknames,
    stats,
    exportSnapshot(): DatabaseExportSnapshot {
      const matchRows = db
        .prepare("SELECT * FROM matches ORDER BY finished_at ASC")
        .all() as unknown as MatchRow[];
      const participantRows = db
        .prepare("SELECT * FROM match_participants ORDER BY match_id ASC")
        .all() as unknown as ParticipantRow[];
      const statsRows = db
        .prepare("SELECT * FROM player_stats ORDER BY account_id ASC")
        .all() as unknown as PlayerStatsRow[];

      const matches: MatchRecord[] = matchRows.map((row) => ({
        id: row.id,
        roomCode: row.room_code,
        matchMode: row.match_mode || "private",
        endedReason: row.ended_reason,
        ...(row.winner_account_id
          ? { winnerAccountId: row.winner_account_id }
          : {}),
        ...(row.winner_name ? { winnerName: row.winner_name } : {}),
        winnerIsBot: row.winner_is_bot === 1,
        seatCount: row.seat_count,
        humanCount: row.human_count,
        botCount: row.bot_count,
        timerEnabled: row.timer_enabled === 1,
        oneTimeGuess: row.one_time_guess === 1,
        dukeBlocksTax: row.duke_blocks_tax === 1,
        cardTheme: row.card_theme,
        totalActions: row.total_actions,
        totalChallenges: row.total_challenges,
        totalBlocks: row.total_blocks,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      }));

      const participants: MatchParticipantRecord[] = participantRows.map(
        (row) => ({
          id: row.id,
          matchId: row.match_id,
          seatId: row.seat_id,
          ...(row.account_id ? { accountId: row.account_id } : {}),
          nickname: row.nickname,
          isBot: row.is_bot === 1,
          ...(row.bot_difficulty ? { botDifficulty: row.bot_difficulty } : {}),
          isWinner: row.is_winner === 1,
          ...(row.placement_rank != null
            ? { placementRank: row.placement_rank }
            : {}),
          pointsEarned: row.points_earned,
          guessBonus: row.guess_bonus ?? 0,
          finalInfluence: row.final_influence,
          finalCoins: row.final_coins,
          peakCoins: row.peak_coins,
          attacksMade: row.attacks_made,
          timesTargeted: row.times_targeted,
          challengesMade: row.challenges_made,
          blocksMade: row.blocks_made,
          bluffsMade: row.bluffs_made,
        }),
      );

      return {
        exportedAt: new Date().toISOString(),
        driver: "sqlite",
        schemaVersion,
        accounts: accounts.listAll(),
        nicknames: nicknames.listAll(),
        matches,
        participants,
        playerStats: statsRows.map((row) => mapPlayerStats(row)!),
      };
    },
    close() {
      db.close();
    },
  };
}
