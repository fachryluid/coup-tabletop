import { legal, player, eligibleResponders } from "./engine";
import { phaseStamp, type Game, type Seat, type Config } from "./model";
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
    deckCount: g.deck.length,
    players: g.players.map(
      ({ hand, revealed, id, name, coins, difficulty, used }) => ({
        id,
        name,
        coins,
        difficulty,
        used,
        influence: hand.length,
        revealed: [...revealed],
      }),
    ),
    hand: [...me.hand],
    pool: g.stage === "exchange" && g.turn === id ? [...g.pool] : [],
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
    log: g.log.map((e) => ({ ...e })),
    canUndo: !!g.undo,
  };
}
export type BotObservation = ReturnType<typeof observe>;
export interface RoomView {
  code: string;
  revision: number;
  leaderboard?: { id: string; name: string; wins: number }[];
  matchRevision?: number;
  serverTime: number;
  host: string;
  me: string;
  seats: (Seat & { online: boolean })[];
  config: Config;
  game?: BotObservation;
}
