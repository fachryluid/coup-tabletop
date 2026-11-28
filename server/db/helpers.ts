import type { MatchEndedReason } from "./types";

export const MIN_LEADERBOARD_ACTIONS = 2;

/**
 * Pure PvP requires at least 2 human players and ZERO bots at the table.
 */
export function isPurePvpMatch(humanCount: number, botCount: number): boolean {
  return humanCount >= 2 && botCount === 0;
}

/**
 * Matches count toward leaderboard/career points only when finished with a winner
 * and containing at least MIN_LEADERBOARD_ACTIONS actions.
 */
export function isLeaderboardEligibleMatch(
  endedReason: MatchEndedReason,
  totalActions: number,
): boolean {
  return endedReason === "completed" && totalActions >= MIN_LEADERBOARD_ACTIONS;
}

export function normalizeNicknameKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function calcWinRate(wins: number, matches: number): number {
  if (matches <= 0) return 0;
  return Math.round((wins / matches) * 1000) / 10;
}

export function calcDurationSec(startedAt: string, finishedAt: string): number {
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.max(0, Math.round((end - start) / 1000));
}
