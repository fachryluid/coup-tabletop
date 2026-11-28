import type { Game } from "./model";

export const CORRECT_GUESS_BONUS = 1;

export interface MatchPlacement {
  id: string;
  name: string;
  rank: number;
  points: number;
  guessBonus?: number;
}

/**
 * Dynamic placement scoring based on table size N (2..6):
 * - Rank 1 (Winner): +N points (max points equals number of players)
 * - Rank 2..N: +(N - rank) points, stepping down by 1 to 0 for last place.
 * - One-Time Guess bonus: when `one_time_guess` is enabled, any player whose
 *   guess was correct receives an extra +1 point on top of placement points.
 *
 * Examples (without guess bonus):
 * - 2 players: #1 = +2, #2 = 0
 * - 3 players: #1 = +3, #2 = +1, #3 = 0
 * - 4 players: #1 = +4, #2 = +2, #3 = +1, #4 = 0
 * - 5 players: #1 = +5, #2 = +3, #3 = +2, #4 = +1, #5 = 0
 * - 6 players: #1 = +6, #2 = +4, #3 = +3, #4 = +2, #5 = +1, #6 = 0
 */
export function calculatePlacementPoints(
  rank: number,
  totalPlayers: number,
): number {
  if (totalPlayers < 2 || rank < 1 || rank > totalPlayers) return 0;
  if (rank === 1) return totalPlayers;
  return Math.max(0, totalPlayers - rank);
}

/**
 * Compute final placements and dynamic points for a completed match.
 * Returns an empty array when the match ended without a winner (e.g. host ended).
 */
export function computeMatchPlacements(
  g: Pick<Game, "players" | "winner" | "eliminatedOrder"> & {
    config?: Pick<Game["config"], "one_time_guess">;
  },
): MatchPlacement[] {
  if (!g.winner) return [];
  const total = g.players.length;
  const byId = new Map(g.players.map((p) => [p.id, p]));
  if (!byId.has(g.winner)) return [];
  const guessRuleOn = Boolean(g.config?.one_time_guess);

  const eliminated: string[] = [];
  const seen = new Set<string>([g.winner]);

  for (const id of g.eliminatedOrder ?? []) {
    if (!seen.has(id) && byId.has(id)) {
      seen.add(id);
      eliminated.push(id);
    }
  }
  // Safety fallback if a test fixture mutated hand directly without reveal().
  for (const p of g.players) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      eliminated.push(p.id);
    }
  }

  // Last eliminated gets rank 2; first eliminated gets rank N (last place).
  const orderedIds = [g.winner, ...eliminated.reverse()];
  return orderedIds.map((id, idx) => {
    const rank = idx + 1;
    const player = byId.get(id)!;
    const guessBonus =
      guessRuleOn && player.guessHit ? CORRECT_GUESS_BONUS : 0;
    const points = calculatePlacementPoints(rank, total) + guessBonus;
    return {
      id,
      name: player.name,
      rank,
      points,
      ...(guessBonus > 0 ? { guessBonus } : {}),
    };
  });
}
