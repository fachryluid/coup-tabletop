import { claims, type Difficulty, type Role, type Move } from "./model";
import type { BotObservation } from "./view";
import type { rules } from "./house-rules";
// A newly registered rule must have an explicit compatibility decision.
export const supportedRules: Record<keyof typeof rules, boolean> = {
  one_time_guess: true,
  duke_blocks_tax: true,
};
const presets = {
  easy: { memory: 0.15, noise: 3, risk: 1.4 },
  normal: { memory: 0.65, noise: 2.2, risk: 1.8 },
  hard: { memory: 1, noise: 1.7, risk: 2.2 },
};
export function belief(
  o: BotObservation,
  id: string,
  role: Role,
  level: Difficulty,
) {
  const seen = [...o.hand, ...o.players.flatMap((p) => p.revealed)];
  const copies = 3 - seen.filter((r) => r === role).length;
  if (!copies) return 0;
  const slots = o.players.find((p) => p.id === id)!.influence;
  const unknown = 15 - seen.length;
  let miss = 1;
  for (let i = 0; i < slots; i++)
    miss *= Math.max(0, unknown - copies - i) / (unknown - i);
  let adjustment = 0;
  for (const e of o.log) {
    if (e.actor !== id || e.role !== role) continue;
    if (e.evidence === "proof") adjustment = 0; // proven card was replaced
    if (e.evidence === "bluff") adjustment = -0.25;
    if (e.evidence === "claim") adjustment = Math.min(0.45, adjustment + 0.12);
  }
  return Math.max(
    0.02,
    Math.min(0.95, 1 - miss + adjustment * presets[level].memory),
  );
}
const value: Record<Role, number> = {
  Duke: 3,
  Captain: 2.7,
  Assassin: 2.5,
  Contessa: 1.8,
  Ambassador: 1.5,
};
function score(o: BotObservation, m: Move, level: Difficulty) {
  const cfg = presets[level],
    opponent = o.players.find((p) => p.id === m.target);
  const threat = opponent
    ? cfg.memory * (Math.min(opponent.coins, 10) / 12 + opponent.influence / 5)
    : 0;
  const role = claims[m.kind as keyof typeof claims];
  const honesty = role && !o.hand.includes(role) ? -cfg.risk : 0;
  switch (m.kind) {
    case "Coup":
      return 10 + threat;
    case "Income":
      return 2;
    case "Exchange":
      return 1.6 + honesty + (new Set(o.hand).size < o.hand.length ? 1 : 0);
    case "Foreign Aid":
    case "Tax": {
      const recentBlock =
        o.config.duke_blocks_tax &&
        o.log
          .slice(-24)
          .some(
            (e) =>
              (e.blockedAction === "Tax" ||
                e.blockedAction === "Foreign Aid") &&
              e.actor !== o.id &&
              o.players.some((p) => p.id === e.actor && p.influence > 0),
          );
      const value = m.kind === "Tax" ? 3.8 + honesty : 2.2;
      return value - (recentBlock ? 3 * cfg.memory : 0);
    }
    case "Steal":
    case "Assassinate": {
      const recentDefense = o.log
        .slice(-24)
        .some((e) => e.blockedAction === m.kind && e.actor === m.target);
      const benefit =
        m.kind === "Steal" ? Math.min(2, opponent!.coins) * 1.55 : 4.3;
      return benefit + honesty + threat - (recentDefense ? 3 * cfg.memory : 0);
    }
    case "Guess":
      return 7 * belief(o, m.target!, m.role!, level) - 1.4 + threat;
    case "ConfirmGuess":
      return 1;
    case "Pass":
      return 2;
    case "Block":
      return o.hand.includes(m.role!) ? 4.7 : 1.3;
    case "Challenge": {
      const block = o.stage === "blockChallenge" ? o.blocker : undefined;
      const role =
        block?.role ?? claims[o.action!.kind as keyof typeof claims]!;
      return 3.1 - 4 * belief(o, block?.id ?? o.turn, role, level);
    }
    case "Prove":
      return 8;
    case "Lose":
      return 4 - value[m.role!] + (o.hand[0] === o.hand[1] ? 1 : 0);
    case "Keep": {
      const hand = m.indices!.map((i) => o.pool[i]);
      return hand.reduce((n, r) => n + value[r], 0) + new Set(hand).size;
    }
  }
}
export function decide(
  o: BotObservation,
  level: Difficulty,
  rng: () => number,
) {
  let best: Move | undefined,
    highest = -Infinity;
  for (const move of o.legal) {
    const n = score(o, move, level) + presets[level].noise * rng();
    if (n > highest) {
      highest = n;
      best = move;
    }
  }
  return best;
}
