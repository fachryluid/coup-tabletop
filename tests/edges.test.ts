import { it, expect, afterEach, vi } from "vitest";
import {
  record,
  deal,
  defaults,
  roles,
  type Move,
  type Difficulty,
} from "../domain/model";
import { play, legal } from "../domain/engine";
import { decide } from "../domain/bot";
import { observe, type BotObservation } from "../domain/view";
import { Tables, MemoryRooms, type Command } from "../server/rooms";
const rng = () => 0.55;
const seats = ["A", "B", "C"].map((id) => ({ id, name: id }));
afterEach(() => vi.useRealTimers());
it.each([2, 3, 4, 5, 6])("deal at %i seats conserves all copies", (size) => {
  const g = deal(
    Array.from({ length: size }, (_, i) => ({
      id: String(i),
      name: String(i),
    })),
    defaults,
    rng,
  );
  expect(g.deck.length).toBe(15 - 2 * size);
  for (const role of roles)
    expect(
      [...g.deck, ...g.players.flatMap((p) => p.hand)].filter(
        (r) => r === role,
      ),
    ).toHaveLength(3);
});
it("Guess checks living cards and reveals only one matching copy; rematch resets usage", () => {
  let g = deal(seats, { ...defaults, one_time_guess: true }, rng);
  g.players[1].hand = ["Duke", "Duke"];
  g = play(g, "A", { kind: "Guess", target: "B", role: "Duke" }, 0, rng);
  g = play(g, "B", { kind: "ConfirmGuess", answer: true }, 1, rng);
  expect(g.players[1].hand).toEqual(["Duke"]);
  expect(g.players[1].revealed).toEqual(["Duke"]);
  g.players[0].revealed = ["Assassin"];
  g.players[0].hand = ["Captain"];
  g = play(g, "B", { kind: "Guess", target: "A", role: "Assassin" }, 0, rng);
  g = play(g, "A", { kind: "ConfirmGuess", answer: false }, 1, rng);
  expect(g.loss?.id).toBe("B");
  expect(
    g.log
      .filter((entry) => entry.revealedGuess)
      .map((entry) => [entry.speech?.by, entry.revealedGuess]),
  ).toEqual([["B", "Duke"]]);
  g = play(g, "B", { kind: "Lose", role: "Duke" }, 0, rng);
  const fresh = deal(seats, g.config, rng);
  expect(fresh.players.every((p) => !p.used)).toBe(true);
});
it.each(["easy", "normal", "hard"] as Difficulty[])(
  "%s bot respects seat ownership of attacks, blocks and guesses",
  (level) => {
    let g = deal(seats, { ...defaults, one_time_guess: true }, rng);
    g.players[0].coins = 3;
    const choose = (id: string) => decide(observe(g, id), level, rng);
    g = play(g, "A", { kind: "Assassinate", target: "C" }, 0, rng);
    expect(choose("B")).toBeUndefined();
    expect(choose("C")).toBeDefined();
    g = play(g, "C", { kind: "Block", role: "Contessa" }, 2, rng);
    expect(choose("A")).toBeDefined();
    expect(choose("B")).toBeUndefined();
    expect(choose("C")).toBeUndefined();
    g = play(g, "A", { kind: "Pass" }, 3, rng);
    g = play(g, "B", { kind: "Guess", role: "Duke", target: "C" }, 4, rng);
    expect(choose("A")).toBeUndefined();
    expect(choose("B")).toBeUndefined();
    expect(choose("C")).toEqual({
      kind: "ConfirmGuess",
      answer: g.players[2].hand.includes("Duke"),
    });
    expect(() =>
      play(g, "A", { kind: "ConfirmGuess", answer: false }, 5, rng),
    ).toThrow();
    expect(
      play(g, "C", choose("C")!, 5, rng).log.find(
        (e) => e.speech?.by === "C" && e.speech.words.startsWith("Tebakan"),
      ),
    ).toBeDefined();
  },
);
it("game-ending guess takes precedence over next turn", () => {
  const g = deal(seats.slice(0, 2), { ...defaults, one_time_guess: true }, rng);
  g.players[1].hand = ["Duke"];
  const guess = play(
    g,
    "A",
    { kind: "Guess", role: "Duke", target: "B" },
    0,
    rng,
  );
  const result = play(
    guess,
    "B",
    { kind: "ConfirmGuess", answer: true },
    1,
    rng,
  );
  expect(result.winner).toBe("A");
  expect(legal(result, "A")).toEqual([]);
});
it.each(["easy", "normal", "hard"] as Difficulty[])(
  "%s can guess from history and block Tax",
  (level) => {
    let g = deal(
      seats,
      { ...defaults, one_time_guess: true, duke_blocks_tax: true },
      rng,
    );
    g.players[0].hand = ["Contessa", "Ambassador"];
    for (let i = 0; i < 5; i++)
      record(g, {
        actor: "B",
        role: "Duke",
        evidence: "claim",
        text: "B memilih Tax",
      });
    // Force the high end of the policy noise only for the tested legal option.
    function favor(view: BotObservation, desired: Move) {
      let i = 0;
      return decide(view, level, () => {
        const m = view.legal[i++];
        return m.kind === desired.kind &&
          m.role === desired.role &&
          m.target === desired.target
          ? 0.999
          : 0;
      });
    }
    // A player with two influences and multiple known non-Dukes is a credible target.
    g.players[2].hand = [];
    g.players[2].revealed = ["Captain", "Assassin"];
    const v = observe(g, "A");
    const guess: Move = { kind: "Guess", role: "Duke", target: "B" };
    expect(favor(v, guess)).toEqual(guess);
    g = play(g, "A", { kind: "Tax" }, 0, rng);
    const block: Move = { kind: "Block", role: "Duke" };
    expect(favor(observe(g, "B"), block)).toEqual(block);
  },
);
it("room with one human and five scheduled bots plays to a winner", () => {
  vi.useFakeTimers();
  const tables = new Tables(new MemoryRooms(), () => {}, 10);
  try {
    const { room: r, id } = tables.create("Human", {
      one_time_guess: true,
      duke_blocks_tax: true,
    });
    const cmd = (c: Command) =>
      tables.execute(
        r,
        id,
        r.revision,
        c,
        r.game && tables.view(r, id).game!.context,
      );
    for (let i = 0; i < 5; i++) cmd({ type: "add" });
    cmd({ type: "start" });
    for (let i = 0; i < 1200 && !r.game!.winner; i++) {
      const o = observe(r.game!, id);
      if (o.legal.length)
        cmd({ type: "play", move: decide(o, "normal", rng)! });
      else vi.advanceTimersByTime(10);
    }
    expect(r.game!.winner).toBeTruthy();
    cmd({ type: "rematch" });
    cmd({ type: "start" });
    expect(r.game!.players.every((p) => !p.used)).toBe(true);
  } finally {
    tables.dispose();
  }
});
it("a second simultaneous response cannot resolve an old window again", () => {
  const tables = new Tables(
    new MemoryRooms(),
    () => {},
    undefined,
    undefined,
    () => 0,
  );
  const { room: r, id } = tables.create("Host"),
    b = tables.admit(r, "B"),
    c = tables.admit(r, "C");
  tables.execute(r, id, r.revision, { type: "start" });
  tables.execute(
    r,
    id,
    r.revision,
    { type: "play", move: { kind: "Tax" } },
    tables.view(r, id).game!.context,
  );
  const revision = r.revision;
  tables.execute(
    r,
    b.id,
    revision,
    {
      type: "play",
      move: { kind: "Challenge" },
    },
    tables.view(r, id).game!.context,
  );
  expect(() =>
    tables.execute(r, c.id, revision, {
      type: "play",
      move: { kind: "Challenge" },
    }),
  ).toThrow();
  expect(r.game!.log.filter((e) => e.text.includes("menantang"))).toHaveLength(
    1,
  );
  tables.dispose();
});
