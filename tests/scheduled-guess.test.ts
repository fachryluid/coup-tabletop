import { afterEach, expect, it, vi } from "vitest";
import { MemoryRooms, Tables, type Command } from "../server/rooms";
import { phaseStamp } from "../domain/model";

function botTable(seed: number) {
  vi.useFakeTimers();
  const rng = () =>
    (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  const tables = new Tables(
    new MemoryRooms(),
    () => {},
    25,
    rng,
    () => 0,
  );
  const { room, id } = tables.create("Host", { one_time_guess: true });
  function send(command: Command) {
    tables.execute(
      room,
      id,
      room.revision,
      command,
      room.game && phaseStamp(room.game),
    );
  }
  send({ type: "add" });
  send({ type: "add" });
  send({ type: "start" });
  return {
    tables,
    room,
    host: id,
    first: room.seats[1].id,
    second: room.seats[2].id,
    send,
  };
}
afterEach(() => vi.useRealTimers());

it("human guesses a bot's specific card; resolves immediately without waiting for target confirmation", () => {
  const { tables, room, first, send } = botTable(15);
  try {
    const targetCard = room.game!.players[1].hand[0];
    send({
      type: "play",
      move: { kind: "Guess", target: first, slot: 0, role: targetCard },
    });
    expect(room.game!.players[1].revealed).toEqual([targetCard]);
    expect(room.game!.stage).toBe("turn");
    expect(room.game!.turn).toBe(first);
  } finally {
    tables.dispose();
  }
});

it("wrong guess reveals and replaces the target's card while guesser chooses card to lose; pause suspends bot", () => {
  const { tables, room, host, first, send } = botTable(22);
  try {
    const actual = room.game!.players[1].hand[1];
    const wrong = actual === "Duke" ? "Captain" : "Duke";
    send({
      type: "play",
      move: { kind: "Guess", target: first, slot: 1, role: wrong },
    });
    expect(room.game!.stage).toBe("loss");
    expect(room.game!.loss?.id).toBe(host);
    expect(room.game!.players[1].hand).toHaveLength(2);
    expect(
      room.game!.log.some(
        (e) =>
          e.actor === first &&
          e.evidence === "proof" &&
          e.proofSlot === 1 &&
          e.deckMove?.kind === "replace",
      ),
    ).toBe(true);
    send({
      type: "play",
      move: { kind: "Lose", role: room.game!.players[0].hand[0] },
    });
    expect(room.game!.players[0].revealed).toHaveLength(1);
    expect(room.game!.stage).toBe("turn");
    expect(room.game!.turn).toBe(first);
    send({ type: "pause" });
    const rev = room.revision;
    vi.advanceTimersByTime(1000);
    expect(room.revision).toBe(rev);
  } finally {
    tables.dispose();
  }
});
