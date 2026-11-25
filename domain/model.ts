import type { CardThemeId } from "./card-themes";
export const roles = [
  "Duke",
  "Assassin",
  "Captain",
  "Ambassador",
  "Contessa",
] as const;
export type Role = (typeof roles)[number];
export type Difficulty = "easy" | "normal" | "hard";
export const defaults = {
  timer: false,
  one_time_guess: false,
  duke_blocks_tax: false,
};
export type Config = typeof defaults;
export type Seat = { id: string; name: string; difficulty?: Difficulty };
export type Player = Seat & {
  coins: number;
  hand: Role[];
  handArt?: number[];
  revealed: Role[];
  revealedArt?: number[];
  used: boolean;
};
export type Action =
  | "Income"
  | "Foreign Aid"
  | "Tax"
  | "Coup"
  | "Assassinate"
  | "Steal"
  | "Exchange"
  | "Guess";
export const claims: Partial<Record<Action, Role>> = {
  Tax: "Duke",
  Assassinate: "Assassin",
  Steal: "Captain",
  Exchange: "Ambassador",
};
export type Move = {
  kind:
    | Action
    | "Prove"
    | "Pass"
    | "Challenge"
    | "Block"
    | "Lose"
    | "Keep";
  target?: string;
  role?: Role;
  slot?: number;
  indices?: number[];
};
export const stages = [
  "turn",
  "challenge",
  "taxResponse",
  "block",
  "blockChallenge",
  "claimResponse",
  "loss",
  "exchange",
  "over",
] as const;
export type PhaseStamp = { actionId: string; phase: Stage };
export type Stage = (typeof stages)[number];
export type Continuation = "finish" | "resolve";
export type Entry = {
  revealedGuess?: Role;
  proofSlot?: number;
  proofArt?: number;
  discarded?: Role;
  blockedAction?: Action;
  deckMove?: {
    seat: string;
    kind: "drawTwo" | "returnTwo" | "replace";
    slot?: number;
  };
  coinMove?: {
    from: string;
    to: string;
    amount: number;
  };
  cardSwap?: string;
  silent?: boolean;
  speech?: { by: string; words: string };
  text: string;
  actor?: string;
  role?: Role;
  evidence?: "claim" | "bluff" | "proof";
};
export type GameEvent = Entry & {
  balances: { id: string; coins: number; influence: number }[];
  phase: Stage;
  actionId?: string;
  seq: number;
  actorId?: string;
  targetId?: string;
  status?: "pending" | "resolved";
};
export interface Game {
  matchId: string;
  actionNumber: number;
  players: Player[];
  deck: Role[];
  deckArt?: number[];
  config: Config;
  cardTheme?: CardThemeId;
  turn: string;
  stage: Stage;
  action?: Move;
  blocker?: { id: string; role: Role };
  challenger?: string;
  pending: string[];
  deadline: number | null;
  loss?: { id: string; next: Continuation };
  pool: Role[];
  poolArt?: number[];
  winner?: string;
  log: GameEvent[];
  paused: number | null;
  undo?: { id: string; coins: number };
  switched?: boolean;
}
export function phaseStamp(g: Game): PhaseStamp {
  return { actionId: g.matchId + "/" + g.actionNumber, phase: g.stage };
}
export function record(g: Game, entry: Entry) {
  g.log.push({
    ...entry,
    balances: g.players.map((p) => ({
      id: p.id,
      coins: p.coins,
      influence: p.hand.length,
    })),
    phase: g.stage,
    seq: g.log.length + 1,
    ...(g.action && {
      actionId: phaseStamp(g).actionId,
      actorId: g.turn,
      targetId: g.action.target,
      status: "pending" as const,
    }),
  });
}
export const windows: Stage[] = [
  "challenge",
  "taxResponse",
  "block",
  "blockChallenge",
];
export function shuffle<T>(items: T[], rng: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function deal(
  seats: Seat[],
  config: Config,
  rng: () => number,
  matchId = "fixture",
  cardTheme: CardThemeId = "classic",
): Game {
  if (
    seats.length < 2 ||
    seats.length > 6 ||
    new Set(seats.map((s) => s.id)).size !== seats.length
  )
    throw Error("Jumlah kursi tidak sah.");
  // Each of the 5 roles has 3 physical copies with distinct art indices (0, 1, 2).
  const cards = shuffle(
    [0, 1, 2].flatMap((art) => roles.map((role) => ({ role, art }))),
    rng,
  );
  const game: Game = {
    matchId,
    actionNumber: 1,
    players: seats.map((s) => {
      const dealt = cards.splice(0, 2);
      return {
        ...s,
        coins: 2,
        hand: dealt.map((c) => c.role),
        handArt: dealt.map((c) => c.art),
        revealed: [],
        revealedArt: [],
        used: false,
      };
    }),
    deck: cards.map((c) => c.role),
    deckArt: cards.map((c) => c.art),
    config: { ...config },
    cardTheme,
    turn: seats[0].id,
    stage: "turn",
    pending: [],
    deadline: null,
    pool: [],
    poolArt: [],
    paused: null,
    switched: false,
    log: [],
  };
  record(game, { text: "Kartu dibagikan. Pertandingan dimulai." });
  return game;
}
