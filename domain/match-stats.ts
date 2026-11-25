import type { BotObservation } from "./view";

export type MatchAwardId =
  | "most_targeted"
  | "most_aggressive"
  | "most_challenges"
  | "most_blocks"
  | "richest_peak"
  | "most_claims";

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

const ATTACK_RE = / memilih (Coup|Assassinate|Steal|Guess) → /;

export function computeMatchStats(game: BotObservation): MatchStats {
  const nameOf = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? id;

  const targeted = new Map<string, number>();
  const attacked = new Map<string, number>();
  const challenged = new Map<string, number>();
  const blocked = new Map<string, number>();
  const claimed = new Map<string, number>();
  const peakCoins = new Map<string, number>();

  const actionIds = new Set<string>();
  let totalChallenges = 0;
  let totalBlocks = 0;

  const inc = (map: Map<string, number>, id?: string) => {
    if (!id) return;
    map.set(id, (map.get(id) ?? 0) + 1);
  };

  for (const event of game.log) {
    if (event.actionId) actionIds.add(event.actionId);

    for (const b of event.balances) {
      const prev = peakCoins.get(b.id) ?? 0;
      if (b.coins > prev) peakCoins.set(b.id, b.coins);
    }

    if (ATTACK_RE.test(event.text)) {
      inc(attacked, event.actorId ?? event.actor);
      inc(targeted, event.targetId);
    }

    if (event.speech?.by && event.text.includes(" menantang ")) {
      totalChallenges++;
      inc(challenged, event.speech.by);
    }

    if (event.blockedAction && event.actor) {
      totalBlocks++;
      inc(blocked, event.actor);
    }

    if (event.evidence === "claim" && event.actor) {
      inc(claimed, event.actor);
    }
  }

  function topOf(map: Map<string, number>, minValue = 1) {
    let bestId: string | undefined;
    let bestVal = 0;
    for (const [id, val] of map) {
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

  const targetKing = topOf(targeted);
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

  const attackerKing = topOf(attacked);
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

  const challengeKing = topOf(challenged);
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

  const blockKing = topOf(blocked);
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

  const claimKing = topOf(claimed);
  if (claimKing) {
    awards.push({
      id: "most_claims",
      title: "Raja Klaim",
      playerId: claimKing.id,
      playerName: nameOf(claimKing.id),
      value: claimKing.value,
      summary: `${claimKing.value}× klaim peran`,
    });
  }

  const coinKing = topOf(peakCoins, 3);
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
    totalActions: actionIds.size,
    totalChallenges,
    totalBlocks,
    awards,
  };
}
