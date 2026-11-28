import type { GameEvent } from "./model";
import type { BotObservation } from "./view";

export type MatchAwardId =
  | "most_targeted"
  | "most_aggressive"
  | "most_challenges"
  | "most_blocks"
  | "richest_peak"
  | "most_bluffs";

export interface MatchAward {
  id: MatchAwardId;
  title: string;
  playerId: string;
  playerName: string;
  value: number;
  summary: string;
}

export interface MatchStats {
  totalActions: number;
  totalChallenges: number;
  totalBlocks: number;
  awards: MatchAward[];
}

export interface SeatMatchMetrics {
  attacksMade: number;
  timesTargeted: number;
  challengesMade: number;
  blocksMade: number;
  bluffsMade: number;
  peakCoins: number;
}

export interface DetailedMatchMetrics {
  totalActions: number;
  totalChallenges: number;
  totalBlocks: number;
  bySeat: Map<string, SeatMatchMetrics>;
}

const ATTACK_RE = / memilih (Coup|Assassinate|Steal|Guess) → /;

export function computeDetailedMatchMetrics(
  log: readonly GameEvent[],
  bluffs: Readonly<Record<string, number>> = {},
  seatIds: readonly string[] = [],
): DetailedMatchMetrics {
  const bySeat = new Map<string, SeatMatchMetrics>();
  const ensure = (id: string): SeatMatchMetrics => {
    let cur = bySeat.get(id);
    if (!cur) {
      cur = {
        attacksMade: 0,
        timesTargeted: 0,
        challengesMade: 0,
        blocksMade: 0,
        bluffsMade: 0,
        peakCoins: 0,
      };
      bySeat.set(id, cur);
    }
    return cur;
  };

  for (const id of seatIds) ensure(id);

  const actionIds = new Set<string>();
  let totalChallenges = 0;
  let totalBlocks = 0;

  for (const event of log) {
    if (event.actionId) actionIds.add(event.actionId);

    for (const b of event.balances) {
      const m = ensure(b.id);
      if (b.coins > m.peakCoins) m.peakCoins = b.coins;
    }

    if (ATTACK_RE.test(event.text)) {
      const attacker = event.actorId ?? event.actor;
      if (attacker) ensure(attacker).attacksMade++;
      if (event.targetId) ensure(event.targetId).timesTargeted++;
    }

    if (event.speech?.by && event.text.includes(" menantang ")) {
      totalChallenges++;
      ensure(event.speech.by).challengesMade++;
    }

    if (event.blockedAction && event.actor) {
      totalBlocks++;
      ensure(event.actor).blocksMade++;
    }
  }

  for (const [id, count] of Object.entries(bluffs)) {
    if (count > 0) ensure(id).bluffsMade = count;
  }

  return {
    totalActions: actionIds.size,
    totalChallenges,
    totalBlocks,
    bySeat,
  };
}

export function computeMatchStats(game: BotObservation): MatchStats {
  const nameOf = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? id;

  const detailed = computeDetailedMatchMetrics(
    game.log,
    game.bluffs ?? {},
    game.players.map((p) => p.id),
  );

  function topBy(
    pick: (m: SeatMatchMetrics) => number,
    minValue = 1,
  ): { id: string; value: number } | undefined {
    let bestId: string | undefined;
    let bestVal = 0;
    for (const [id, metrics] of detailed.bySeat) {
      const val = pick(metrics);
      if (val > bestVal) {
        bestVal = val;
        bestId = id;
      }
    }
    return bestId && bestVal >= minValue
      ? { id: bestId, value: bestVal }
      : undefined;
  }

  const awards: MatchAward[] = [];

  const targetKing = topBy((m) => m.timesTargeted);
  if (targetKing) {
    awards.push({
      id: "most_targeted",
      title: "Target Utama",
      playerId: targetKing.id,
      playerName: nameOf(targetKing.id),
      value: targetKing.value,
      summary: `${targetKing.value}× diserang`,
    });
  }

  const attackerKing = topBy((m) => m.attacksMade);
  if (attackerKing) {
    awards.push({
      id: "most_aggressive",
      title: "Algojo Meja",
      playerId: attackerKing.id,
      playerName: nameOf(attackerKing.id),
      value: attackerKing.value,
      summary: `${attackerKing.value}× menyerang`,
    });
  }

  const challengeKing = topBy((m) => m.challengesMade);
  if (challengeKing) {
    awards.push({
      id: "most_challenges",
      title: "Penantang Ulung",
      playerId: challengeKing.id,
      playerName: nameOf(challengeKing.id),
      value: challengeKing.value,
      summary: `${challengeKing.value}× menantang`,
    });
  }

  const blockKing = topBy((m) => m.blocksMade);
  if (blockKing) {
    awards.push({
      id: "most_blocks",
      title: "Tembok Istana",
      playerId: blockKing.id,
      playerName: nameOf(blockKing.id),
      value: blockKing.value,
      summary: `${blockKing.value}× memblokir`,
    });
  }

  const bluffKing = topBy((m) => m.bluffsMade);
  if (bluffKing) {
    awards.push({
      id: "most_bluffs",
      title: "Pembohong Handal",
      playerId: bluffKing.id,
      playerName: nameOf(bluffKing.id),
      value: bluffKing.value,
      summary: `${bluffKing.value}× bluff`,
    });
  }

  const coinKing = topBy((m) => m.peakCoins, 3);
  if (coinKing) {
    awards.push({
      id: "richest_peak",
      title: "Sultan Meja",
      playerId: coinKing.id,
      playerName: nameOf(coinKing.id),
      value: coinKing.value,
      summary: `Puncak ${coinKing.value} koin`,
    });
  }

  return {
    totalActions: detailed.totalActions,
    totalChallenges: detailed.totalChallenges,
    totalBlocks: detailed.totalBlocks,
    awards,
  };
}
