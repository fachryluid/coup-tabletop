import { legal, player, eligibleResponders } from "./engine";
import { phaseStamp, type Game, type Seat, type Config } from "./model";
import type { CardThemeId } from "./card-themes";
import { computeMatchPlacements, type MatchPlacement } from "./scoring";
const alignArt = (cards: unknown[], arts?: number[]) =>
  cards.map((_, i) => arts?.[i] ?? 0);
export function observe(g: Game, id: string) {
  const me = player(g, id);
  const responders = eligibleResponders(g);
  return {
    context: {
      ...phaseStamp(g),
      actorId: g.turn,
      targetId: g.action?.target,
      eligibleResponders: responders,
      currentResponder: responders.length === 1 ? responders[0] : undefined,
      status:
        g.stage === "turn"
          ? "awaitingAction"
          : g.stage === "over"
            ? "resolved"
            : "pending",
    },
    id,
    cardTheme: (g.cardTheme ?? "classic") as CardThemeId,
    deckCount: g.deck.length,
    players: g.players.map(
      ({ hand, revealed, revealedArt, id, name, coins, difficulty, used }) => ({
        id,
        name,
        coins,
        difficulty,
        used,
        influence: hand.length,
        revealed: [...revealed],
        revealedArt: alignArt(revealed, revealedArt),
      }),
    ),
    hand: [...me.hand],
    handArt: alignArt(me.hand, me.handArt),
    pool: g.stage === "exchange" && g.turn === id ? [...g.pool] : [],
    poolArt:
      g.stage === "exchange" && g.turn === id
        ? alignArt(g.pool, g.poolArt)
        : [],
    legal: legal(g, id),
    turn: g.turn,
    stage: g.stage,
    config: { ...g.config },
    action: g.action,
    blocker: g.blocker,
    pending: [...g.pending],
    deadline: g.deadline,
    paused: g.paused,
    loss: g.loss?.id,
    winner: g.winner,
    matchResults:
      g.stage === "over" && g.winner ? computeMatchPlacements(g) : undefined,
    bluffs: g.stage === "over" ? { ...(g.bluffs ?? {}) } : undefined,
    log: g.log.map((e) => ({ ...e })),
    canUndo: !!g.undo,
    canSwitch:
      g.paused === null &&
      g.stage === "turn" &&
      g.turn === id &&
      !g.switched &&
      me.hand.length === 2,
  };
}
export type BotObservation = ReturnType<typeof observe>;
export interface SessionStanding {
  id: string;
  name: string;
  points: number;
  wins: number;
  lastPoints?: number;
  lastRank?: number;
}
export type { MatchPlacement };
export interface RoomView {
  code: string;
  revision: number;
  leaderboard?: SessionStanding[];
  matchRevision?: number;
  serverTime: number;
  host: string;
  me: string;
  seats: (Seat & { online: boolean; avatar?: string })[];
  config: Config;
  cardTheme: CardThemeId;
  game?: BotObservation;
}
