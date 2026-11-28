import type { CardThemeId } from "../../domain/card-themes";
import type { Difficulty } from "../../domain/model";

export type DatabaseDriver = "sqlite" | "memory";

export type MatchMode = "private" | "solo" | "tournament";

export interface AccountRecord {
  id: string;
  googleSub: string;
  email: string;
  name: string;
  picture?: string;
  username?: string;
  termsAcceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountStore {
  getById(id: string): AccountRecord | undefined;
  getBySub(sub: string): AccountRecord | undefined;
  getByUsername(username: string): AccountRecord | undefined;
  listAll?(): AccountRecord[];
  upsertGoogleProfile(profile: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }): AccountRecord;
  completeOnboarding(
    id: string,
    username: string,
    acceptedAt: string,
  ): AccountRecord;
}

export interface AccountNicknameRecord {
  accountId: string;
  nickname: string;
  nicknameKey: string;
  useCount: number;
  firstUsedAt: string;
  lastUsedAt: string;
}

export interface NicknameRepository {
  recordUsage(accountId: string, nickname: string, usedAt?: string): AccountNicknameRecord | undefined;
  listForAccount(accountId: string, limit?: number): AccountNicknameRecord[];
  getLastUsed(accountId: string): AccountNicknameRecord | undefined;
  deleteForAccount(accountId: string, nicknameKey: string): boolean;
  listAll?(): AccountNicknameRecord[];
}

export type MatchEndedReason = "completed" | "host_ended";

export interface MatchParticipantInput {
  seatId: string;
  accountId?: string;
  nickname: string;
  isBot: boolean;
  botDifficulty?: Difficulty;
  isWinner: boolean;
  placementRank?: number;
  pointsEarned?: number;
  guessBonus?: number;
  finalInfluence: number;
  finalCoins: number;
  peakCoins: number;
  attacksMade: number;
  timesTargeted: number;
  challengesMade: number;
  blocksMade: number;
  bluffsMade: number;
}

export interface RecordMatchInput {
  matchId: string;
  roomCode: string;
  matchMode?: MatchMode;
  endedReason: MatchEndedReason;
  winnerAccountId?: string;
  winnerName?: string;
  winnerIsBot: boolean;
  seatCount: number;
  humanCount: number;
  botCount: number;
  timerEnabled: boolean;
  oneTimeGuess: boolean;
  dukeBlocksTax: boolean;
  cardTheme: CardThemeId;
  totalActions: number;
  totalChallenges: number;
  totalBlocks: number;
  startedAt: string;
  finishedAt: string;
  participants: MatchParticipantInput[];
}

export interface PlayerStatsRecord {
  accountId: string;
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
  updatedAt: string;
}

export type LeaderboardMode = "all" | "pvp";
export type LeaderboardPeriod = "weekly" | "all_time";

export interface LeaderboardQuery {
  mode?: LeaderboardMode;
  period?: LeaderboardPeriod;
  limit?: number;
  offset?: number;
  now?: Date;
  viewerAccountId?: string;
}

export interface LeaderboardEntry {
  rank: number;
  accountId: string;
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
}

export interface LeaderboardPageResult {
  mode: LeaderboardMode;
  period: LeaderboardPeriod;
  periodStart?: string;
  periodEnd?: string;
  totalEntries: number;
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
}

export type MatchHistoryScope = "all" | "pvp" | "non_pvp";
export type MatchHistoryResultFilter = "all" | "win" | "loss";

export interface PlayerMatchHistoryQuery {
  scope?: MatchHistoryScope;
  result?: MatchHistoryResultFilter;
  limit?: number;
  offset?: number;
}

export interface PlayerMatchSummary {
  matchId: string;
  roomCode: string;
  matchMode: MatchMode;
  endedReason: MatchEndedReason;
  nickname: string;
  isWinner: boolean;
  placementRank?: number;
  pointsEarned: number;
  guessBonus: number;
  winnerName?: string;
  seatCount: number;
  humanCount: number;
  botCount: number;
  isPurePvp: boolean;
  timerEnabled: boolean;
  oneTimeGuess: boolean;
  dukeBlocksTax: boolean;
  finalInfluence: number;
  finalCoins: number;
  peakCoins: number;
  attacksMade: number;
  challengesMade: number;
  blocksMade: number;
  bluffsMade: number;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
}

export interface PlayerMatchHistoryPage {
  items: Omit<PlayerMatchSummary, "roomCode">[];
  total: number;
  hasMore: boolean;
}

export interface MatchDetailParticipant {
  seatId: string;
  nickname: string;
  username?: string;
  name?: string;
  picture?: string;
  isBot: boolean;
  botDifficulty?: Difficulty;
  isWinner: boolean;
  placementRank?: number;
  pointsEarned: number;
  guessBonus: number;
  finalInfluence: number;
  finalCoins: number;
  peakCoins: number;
  attacksMade: number;
  timesTargeted: number;
  challengesMade: number;
  blocksMade: number;
  bluffsMade: number;
}

export interface MatchDetailRecord {
  matchId: string;
  matchMode: MatchMode;
  endedReason: MatchEndedReason;
  winnerName?: string;
  winnerUsername?: string;
  winnerIsBot: boolean;
  seatCount: number;
  humanCount: number;
  botCount: number;
  isPurePvp: boolean;
  timerEnabled: boolean;
  oneTimeGuess: boolean;
  dukeBlocksTax: boolean;
  cardTheme: string;
  totalActions: number;
  totalChallenges: number;
  totalBlocks: number;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  participants: MatchDetailParticipant[];
}

export interface MatchRecord {
  id: string;
  roomCode: string;
  matchMode: MatchMode;
  endedReason: MatchEndedReason;
  winnerAccountId?: string;
  winnerName?: string;
  winnerIsBot: boolean;
  seatCount: number;
  humanCount: number;
  botCount: number;
  timerEnabled: boolean;
  oneTimeGuess: boolean;
  dukeBlocksTax: boolean;
  cardTheme: string;
  totalActions: number;
  totalChallenges: number;
  totalBlocks: number;
  startedAt: string;
  finishedAt: string;
}

export interface MatchParticipantRecord extends MatchParticipantInput {
  id: string;
  matchId: string;
  pointsEarned: number;
  guessBonus: number;
}

export interface DatabaseExportSnapshot {
  exportedAt: string;
  driver: DatabaseDriver;
  schemaVersion: number;
  accounts: AccountRecord[];
  nicknames: AccountNicknameRecord[];
  matches: MatchRecord[];
  participants: MatchParticipantRecord[];
  playerStats: PlayerStatsRecord[];
}

export interface StatsRepository {
  recordMatch(input: RecordMatchInput): boolean;
  getPlayerStats(accountId: string): PlayerStatsRecord | undefined;
  getGlobalLeaderboard(query?: LeaderboardQuery): LeaderboardEntry[];
  getLeaderboardPage(query?: LeaderboardQuery): LeaderboardPageResult;
  getPlayerRank(
    accountId: string,
    mode: LeaderboardMode,
    period: LeaderboardPeriod,
    now?: Date,
  ): number | null;
  getRecentMatches(accountId: string, limit?: number): PlayerMatchSummary[];
  getMatchHistory(
    accountId: string,
    query?: PlayerMatchHistoryQuery,
  ): PlayerMatchHistoryPage;
  getMatchDetail(matchId: string): MatchDetailRecord | undefined;
}

export interface AppDatabase {
  readonly driver: DatabaseDriver;
  readonly schemaVersion: number;
  readonly accounts: AccountStore;
  readonly nicknames: NicknameRepository;
  readonly stats: StatsRepository;
  exportSnapshot(): DatabaseExportSnapshot;
  close(): void;
}
