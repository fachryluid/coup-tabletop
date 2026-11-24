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

it("human guesses a bot; only that bot answers and the scheduler cancels on pause", () => {
  const { tables, room, host, first, second, send } = botTable(15);
  try {
    send({
      type: "play",
      move: { kind: "Guess", target: first, role: "Duke" },
    });
    const view = (id: string) => tables.view(room, id).game!;
    expect(view(host).legal).toEqual([]);
    expect(view(second).legal).toEqual([]);
    expect(view(first).legal).toEqual([{ kind: "ConfirmGuess", answer: true }]);
    send({ type: "pause" });
    vi.advanceTimersByTime(1000);
    expect(room.game!.stage).toBe("guessAnswer");
    send({ type: "resume" });
    vi.advanceTimersByTime(25);
    expect(room.game!.players[1].revealed).toEqual(["Duke"]);
    expect(room.game!.stage).toBe("turn");
  } finally {
    tables.dispose();
  }
});

it.each([15, 22])(
  "scheduled Guess uses the target's decision; replay seed %i",
  (seed) => {
    const { tables, room, host, first, second, send } = botTable(seed);
    try {
      send({ type: "play", move: { kind: "Income" } });
      vi.advanceTimersByTime(25);
      const target = seed === 15 ? host : second;
      const pending = tables.view(room, target).game!;
      expect(pending.action).toMatchObject({ kind: "Guess", target });
      expect(pending.context).toMatchObject({
        actorId: first,
        currentResponder: target,
        eligibleResponders: [target],
      });
      expect(tables.view(room, first).game!.legal).toEqual([]);
      const rev = room.revision;
      if (target === host) {
        vi.advanceTimersByTime(10000);
        expect(room.revision).toBe(rev);
        send({ type: "play", move: pending.legal[0] });
        expect(room.game!.players[0].revealed).toEqual(["Captain"]);
      } else {
        vi.advanceTimersByTime(25);
        expect(room.game!.loss?.id).toBe(first);
        expect(room.game!.players[2].revealed).toEqual([]);
      }
      const events = room.game!.log.filter(
        (e) => e.actionId === pending.context.actionId,
      );
      expect(events.map((e) => e.seq)).toEqual(
        events.map((_, i) => events[0].seq + i),
      );
      expect(events[0].speech?.by).toBe(first);
      expect(events[1].speech?.by).toBe(target);
      expect(events[2].speech).toBeUndefined();
      expect(events[2].text).toContain(seed === 15 ? "benar" : "salah");
    } finally {
      tables.dispose();
    }
  },
);
