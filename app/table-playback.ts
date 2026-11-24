import type { Entry, GameEvent, Role } from "../domain/model";
import type { RoomView } from "../domain/view";

export type Line = {
  seq?: number;
  actionId?: string;
  by?: string;
  words: string;
  proof?: Role;
  guessed?: boolean;
  move?: Entry["deckMove"];
};
function narrate(entries: GameEvent[]): Line[] {
  return entries.map((entry) => ({
    seq: entry.seq,
    actionId: entry.actionId,
    ...(entry.speech ?? { words: entry.text }),
    proof:
      entry.discarded ??
      entry.revealedGuess ??
      (entry.evidence === "proof" ? entry.role : undefined),
    guessed: !!entry.revealedGuess,
    move: entry.deckMove,
  }));
}

type Frame = { end: number; room: RoomView; deal: boolean };
export const initialPlayback = {
  room: undefined as RoomView | undefined,
  latest: undefined as RoomView | undefined,
  lines: [] as Line[],
  frames: [] as Frame[],
  sceneKey: 0,
  cursor: -1,
  completed: -1,
  manual: false,
  deal: false,
  revealed: undefined as Line | undefined,
  moving: undefined as Line | undefined,
  exposed: undefined as Line | undefined,
};
type Playback = typeof initialPlayback;
type Event =
  | { type: "snapshot"; room: RoomView; restore: boolean }
  | { type: "clear" | "back" | "next" | "toggle" }
  | { type: "read" | "reveal" | "delivered"; line: Line };

function receive(state: Playback, room: RoomView, restore: boolean): Playback {
  const last = state.latest;
  if (
    last?.code === room.code &&
    last.me === room.me &&
    room.revision < last.revision
  )
    return state;
  if (
    last?.code === room.code &&
    last.me === room.me &&
    room.revision === last.revision
  ) {
    // Joining, disconnecting and restoring a socket may publish presence at the same revision.
    if (
      last.matchRevision !== room.matchRevision ||
      last.game?.log.length !== room.game?.log.length
    )
      return state;
    room = { ...last, seats: room.seats, serverTime: room.serverTime };
  }
  if (room.game?.log.some((event, index) => event.seq !== index + 1))
    return state;
  const sameMatch =
    last?.game &&
    room.game &&
    last.matchRevision !== undefined &&
    last.matchRevision === room.matchRevision;
  if (
    (restore && !sameMatch) ||
    !last ||
    last.code !== room.code ||
    last.me !== room.me ||
    (!room.game && !last.game && !state.frames.length)
  ) {
    const lines = narrate(room.game?.log ?? []);
    return {
      ...initialPlayback,
      room,
      latest: room,
      sceneKey: state.sceneKey + 1,
      lines,
      cursor: lines.length - 1,
      completed: lines.length - 1,
    };
  }
  if (sameMatch && room.game!.log.length < last.game!.log.length) return state;
  const deal =
    !!room.game && (!last.game || room.matchRevision !== last.matchRevision);
  const fresh = room.game
    ? narrate(room.game.log.slice(deal ? 0 : (last.game?.log.at(-1)?.seq ?? 0)))
    : last.game
      ? [{ words: "Pertandingan selesai. Kembali ke lobi." }]
      : [];
  if (!fresh.length) {
    // Presence packets can share a revision. Keep the queued game snapshot intact.
    const frames = state.frames.slice();
    if (frames.length)
      frames[frames.length - 1] = { ...frames[frames.length - 1], room };
    return {
      ...state,
      latest: room,
      frames,
      room:
        frames.length && state.room
          ? { ...state.room, seats: room.seats }
          : room,
    };
  }
  const base =
    deal && !state.frames.length
      ? { ...initialPlayback, room: state.room, sceneKey: state.sceneKey }
      : state;
  const lines = [...base.lines, ...fresh];
  const cursor =
    !base.manual && base.completed === base.lines.length - 1
      ? base.lines.length
      : base.cursor;
  return {
    ...base,
    latest: room,
    lines,
    cursor,
    frames: [...base.frames, { end: lines.length - 1, room, deal }],
  };
}

function complete(state: Playback): Playback {
  if (state.cursor !== state.completed + 1) return state;
  const frame = state.frames[0];
  return frame?.end === state.cursor
    ? {
        ...state,
        completed: state.cursor,
        room: frame.room,
        exposed: undefined,
        sceneKey: state.sceneKey + (frame.deal ? 1 : 0),
        deal: frame.deal,
        frames: state.frames.slice(1),
      }
    : { ...state, completed: state.cursor };
}
export function playback(state: Playback, event: Event): Playback {
  switch (event.type) {
    case "clear":
      return initialPlayback;
    case "snapshot":
      return receive(state, event.room, event.restore);
    case "back":
      if (state.moving) return state;
      return { ...state, manual: true, cursor: Math.max(0, state.cursor - 1) };
    case "next":
      if (
        state.moving ||
        state.cursor > state.completed ||
        state.cursor >= state.lines.length - 1
      )
        return state;
      return { ...state, manual: true, cursor: state.cursor + 1 };
    case "toggle":
      return {
        ...state,
        manual: !state.manual,
        cursor: state.manual
          ? Math.min(state.lines.length - 1, state.completed + 1)
          : state.cursor,
      };
    case "reveal":
      return state.lines[state.cursor] === event.line &&
        state.cursor === state.completed + 1
        ? { ...state, revealed: event.line }
        : state;
    case "delivered":
    case "read": {
      if (
        state.lines[state.cursor] !== event.line ||
        state.cursor !== state.completed + 1
      )
        return state;
      if (event.type === "delivered" && state.moving !== event.line)
        return state;
      if (event.type === "read") {
        if (state.moving || (event.line.proof && state.revealed !== event.line))
          return state;
        if (event.line.move) return { ...state, moving: event.line };
      }
      const next = complete({
        ...state,
        moving: undefined,
        revealed: undefined,
        exposed:
          event.line.proof && !event.line.move ? event.line : state.exposed,
      });
      return !next.manual && next.cursor < next.lines.length - 1
        ? { ...next, cursor: next.cursor + 1 }
        : next;
    }
  }
}
export type TablePlayback = Playback;
