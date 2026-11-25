import { expect, it } from "vitest";
import { deal, defaults } from "../domain/model";
import { legal, play } from "../domain/engine";
import { MemoryRooms, Tables } from "../server/rooms";
import { observe, type RoomView } from "../domain/view";
import { initialPlayback, playback } from "../app/table-playback";

const seats = ["A", "B", "C"].map((id) => ({ id, name: id }));
const rng = () => 0.42;

it.each([true, false])(
  "resolves Guess immediately without extra target action, hit=%s",
  (hit) => {
    const start = deal(seats, { ...defaults, one_time_guess: true }, rng);
    start.players[1].hand = ["Duke", "Contessa"];
    const result = play(
      start,
      "A",
      { kind: "Guess", target: "B", slot: 0, role: hit ? "Duke" : "Captain" },
      0,
      rng,
    );
    expect(
      result.log.some(
        (e) => !e.speech && e.text.includes(hit ? "benar" : "salah"),
      ),
    ).toBe(true);
    if (hit) {
      expect(result.stage).toBe("turn");
      expect(result.players[1].revealed).toEqual(["Duke"]);
      expect(result.players[1].hand).toEqual(["Contessa"]);
    } else {
      expect(result.stage).toBe("loss");
      expect(result.loss?.id).toBe("A");
      expect(result.players[1].hand).toHaveLength(2);
      expect(result.log.some((e) => e.deckMove?.kind === "replace")).toBe(true);
    }
  },
);

it("rejects previous phase and wrong action with current revision", () => {
  const tables = new Tables(
    new MemoryRooms(),
    () => {},
    undefined,
    undefined,
    () => 0,
  );
  const { room, id } = tables.create("Host");
  const b = tables.admit(room, "B");
  tables.execute(room, id, room.revision, { type: "start" });
  const context = () => tables.view(room, id).game!.context;
  tables.execute(
    room,
    id,
    room.revision,
    { type: "play", move: { kind: "Steal", target: b.id } },
    context(),
  );
  const challenge = context();
  tables.execute(
    room,
    b.id,
    room.revision,
    { type: "play", move: { kind: "Pass" } },
    challenge,
  );
  const pass = () => ({
    type: "play" as const,
    move: { kind: "Pass" as const },
  });
  expect(() =>
    tables.execute(room, b.id, room.revision, pass(), challenge),
  ).toThrow();
  expect(() =>
    tables.execute(room, b.id, room.revision, pass(), {
      ...context(),
      actionId: "wrong",
    }),
  ).toThrow();
  expect(context().eligibleResponders).toEqual([]);
  expect(room.game!.turn).toBe(b.id);
  tables.dispose();
});

it("rejects an out-of-order event stream before updating dialogue", () => {
  const game = deal(seats, defaults, rng);
  const snapshot = (revision: number, g = game): RoomView => ({
    code: "ROOM",
    me: "A",
    host: "A",
    revision,
    matchRevision: 1,
    serverTime: 1,
    seats: [],
    config: defaults,
    game: observe(g, "A"),
  });
  const state = playback(initialPlayback, {
    type: "snapshot",
    room: snapshot(1),
    restore: true,
  });
  const next = snapshot(2, play(game, "A", { kind: "Income" }, 1, rng));
  next.game!.log[1].seq = 5;
  expect(
    playback(state, { type: "snapshot", room: next, restore: false }),
  ).toBe(state);
});

it.each(["Assassinate", "Steal"] as const)(
  "resolves %s pass, block and challenged block in order",
  (kind) => {
    const start = deal(seats, defaults, rng);
    start.players[0].coins = 3;
    start.players[0].hand = ["Assassin", "Captain"];
    start.players[1].hand = ["Contessa", "Ambassador"];
    const blockRole = kind === "Steal" ? "Ambassador" : "Contessa";
    let g = play(start, "A", { kind, target: "B" }, 0, rng);
    const actionId = observe(g, "A").context.actionId;
    const history = [g.stage];
    const step = (seat: string, move: Parameters<typeof play>[2]) => {
      expect(legal(g, "C")).toEqual([]);
      expect(observe(g, seat).context).toMatchObject({
        currentResponder: seat,
        actionId,
      });
      g = play(g, seat, move, 1, rng);
      history.push(g.stage);
    };
    step("B", { kind: "Block", role: blockRole });
    step("A", { kind: "Challenge" });
    step("B", { kind: "Prove", role: blockRole });
    step("A", { kind: "Lose", role: g.players[0].hand[0] });
    expect(history).toEqual([
      "challenge",
      "blockChallenge",
      "claimResponse",
      "loss",
      "turn",
    ]);
    expect(
      g.log.filter((e) => e.evidence === "proof").map((e) => e.actor),
    ).toEqual(["B"]);
    expect(g.log.at(-1)).toMatchObject({
      actionId,
      status: "resolved",
      actorId: "A",
      targetId: "B",
    });
    expect(observe(g, "B").context.actionId).not.toBe(actionId);
  },
);

it("global windows wait for each remaining living player, including after reconnect", () => {
  const tables = new Tables(
    new MemoryRooms(),
    () => {},
    undefined,
    undefined,
    () => 0,
  );
  try {
    const { room, id } = tables.create("Host");
    const b = tables.admit(room, "B"),
      c = tables.admit(room, "C");
    tables.execute(room, id, room.revision, { type: "start" });
    const send = (seat: string, move: Parameters<typeof play>[2]) =>
      tables.execute(
        room,
        seat,
        room.revision,
        { type: "play", move },
        tables.view(room, seat).game!.context,
      );
    send(id, { kind: "Foreign Aid" });
    const initial = tables.view(room, c.id).game!.context;
    expect(initial.eligibleResponders).toEqual([b.id]);
    expect(tables.view(room, c.id).game!.legal).toEqual([]);
    send(b.id, { kind: "Pass" });
    expect(() => send(b.id, { kind: "Pass" })).toThrow();
    const restored = tables.restore(room.code, c.token);
    const context = tables.view(restored.room, restored.id).game!.context;
    expect(context).toMatchObject({
      actionId: initial.actionId,
      currentResponder: c.id,
    });
    send(restored.id, { kind: "Pass" });
    expect(room.game!.players[0].coins).toBe(4);
    expect(room.game!.log.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
  } finally {
    tables.dispose();
  }
});

it("ignores a different game log at an already accepted revision", () => {
  const start = deal(seats, defaults, rng);
  const room: RoomView = {
    code: "ROOM",
    me: "A",
    host: "A",
    revision: 1,
    matchRevision: 1,
    serverTime: 1,
    seats: [],
    config: defaults,
    game: observe(start, "A"),
  };
  const s = playback(initialPlayback, {
    type: "snapshot",
    room,
    restore: true,
  });
  const changed = {
    ...room,
    game: observe(play(start, "A", { kind: "Income" }, 2, rng), "A"),
  };
  expect(playback(s, { type: "snapshot", room: changed, restore: false })).toBe(
    s,
  );
});

it("the opening deal is not part of the first player's action", () => {
  const start = deal(seats, defaults, rng);
  const result = play(start, "A", { kind: "Income" }, 0, rng);
  expect(
    result.log
      .filter(
        (event) => event.actionId === observe(start, "A").context.actionId,
      )
      .map((e) => e.text),
  ).toEqual(["A memilih Income"]);
});
