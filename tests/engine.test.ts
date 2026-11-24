import { describe, it, expect } from "vitest";
import { deal, defaults, type Move, type Config } from "../domain/model";
import { legal, play, closeWindow } from "../domain/engine";
const rng = () => 0.45;
export function fixture(config: Partial<Config> = {}) {
  const g = deal(
    ["A", "B", "C"].map((id) => ({ id, name: id })),
    { ...defaults, ...config },
    rng,
  );
  g.players[0].hand = ["Duke", "Assassin"];
  g.players[1].hand = ["Duke", "Contessa"];
  g.players[2].hand = ["Captain", "Ambassador"];
  g.deck = [
    "Duke",
    "Assassin",
    "Assassin",
    "Contessa",
    "Contessa",
    "Captain",
    "Captain",
    "Ambassador",
    "Ambassador",
  ];
  return g;
}
function table(config: Partial<Config> = {}) {
  let g = fixture(config);
  return {
    get g() {
      return g;
    },
    move(id: string, kind: Move["kind"], extra: Partial<Move> = {}, now = 100) {
      g = play(g, id, { kind, ...extra }, now, rng);
    },
    close(now = 101) {
      g = closeWindow(g, now, "Host");
    },
  };
}
describe("aturan klasik dan modul tongkrongan", () => {
  it.each(["Steal", "Assassinate"] as const)(
    "only the target can challenge %s",
    (kind) => {
      const g = fixture();
      g.players[0].coins = 3;
      const active = play(g, "A", { kind, target: "B" }, 0, rng);
      expect(active.pending).toEqual(["B"]);
      expect(legal(active, "B")).toContainEqual({ kind: "Challenge" });
      expect(legal(active, "C")).toEqual([]);
      expect(() => play(active, "C", { kind: "Challenge" }, 1, rng)).toThrow();
      const passed = play(active, "B", { kind: "Pass" }, 1, rng);
      expect(passed.stage).toBe(kind === "Steal" ? "turn" : "loss");
      if (kind === "Steal")
        expect(passed.players.map((p) => p.coins)).toEqual([5, 0, 2]);
      expect(() =>
        play(passed, "B", { kind: "Block", role: "Captain" }, 2, rng),
      ).toThrow();
      const blocked = play(
        active,
        "B",
        { kind: "Block", role: kind === "Steal" ? "Captain" : "Contessa" },
        2,
        rng,
      );
      expect(blocked.pending).toEqual(["A"]);
      expect(() => play(blocked, "C", { kind: "Challenge" }, 3, rng)).toThrow();
      expect(play(blocked, "A", { kind: "Pass" }, 3, rng).stage).toBe("turn");
    },
  );
  it("only real deck transfers produce anonymous card movements", () => {
    const t = table();
    t.move("A", "Tax");
    t.move("C", "Challenge");
    t.move("A", "Prove", { role: "Duke" });
    expect(t.g.log.flatMap((e) => (e.deckMove ? [e.deckMove] : []))).toEqual([
      { seat: "A", kind: "replace" },
    ]);
    const guess = table({ one_time_guess: true });
    guess.move("A", "Guess", { target: "B", role: "Captain" });
    expect(guess.g.log.every((e) => !e.deckMove)).toBe(true);
  });
  it.each([false, true])(
    "One-Time Guess independen dengan Duke Blocks Tax %s",
    (tax) => {
      for (const hit of [false, true]) {
        const t = table({ one_time_guess: true, duke_blocks_tax: tax });
        t.move("A", "Guess", { target: "B", role: hit ? "Duke" : "Captain" });
        expect(legal(t.g, "C")).toEqual([]);
        t.move("B", "ConfirmGuess", { answer: hit });
        expect(
          t.g.log.find((e) => e.speech?.words.includes(hit ? "benar" : "salah"))
            ?.speech?.by,
        ).toBe("B");
        if (!hit) t.move("A", "Lose", { role: "Assassin" });
        expect(t.g.players[hit ? 1 : 0].hand.length).toBe(1);
        t.move("B", "Income");
        t.move("C", "Income");
        expect(legal(t.g, "A").some((m) => m.kind === "Guess")).toBe(false);
      }
      expect(
        legal(fixture({ duke_blocks_tax: tax }), "A").some(
          (m) => m.kind === "Guess",
        ),
      ).toBe(false);
    },
  );
  it.each([false, true])(
    "Tax dan challenge terhadap blok, guess=%s",
    (guess) => {
      for (const blocker of ["B", "C"]) {
        const t = table({ one_time_guess: guess, duke_blocks_tax: true });
        t.move("A", "Tax");
        for (const id of ["B", "C"])
          expect(legal(t.g, id)).toEqual(
            expect.arrayContaining([
              { kind: "Pass" },
              { kind: "Challenge" },
              { kind: "Block", role: "Duke" },
            ]),
          );
        expect(legal(t.g, "A")).toEqual([]);
        t.move(blocker, "Block", { role: "Duke" });
        expect(t.g.pending).toEqual(["A"]);
        expect(() =>
          t.move(blocker === "B" ? "C" : "B", "Challenge"),
        ).toThrow();
        t.move("A", "Challenge");
        if (blocker === "B") {
          t.move("B", "Prove", { role: "Duke" });
          t.move("A", "Lose", { role: "Assassin" });
        } else t.move("C", "Lose", { role: "Ambassador" });
        expect(t.g.players[0].coins).toBe(2);
      }
      const t = table({ one_time_guess: guess });
      t.move("A", "Tax");
      expect(() => t.move("B", "Block", { role: "Duke" })).toThrow();
      t.close();
      expect(t.g.players[0].coins).toBe(5);
    },
  );
  it("a proven Tax or all passes settle Tax without another block window", () => {
    for (const challenge of [true, false]) {
      const t = table({ duke_blocks_tax: true });
      t.move("A", "Tax");
      if (challenge) {
        t.move("C", "Challenge");
        expect(() => t.move("B", "Block", { role: "Duke" })).toThrow();
        t.move("A", "Prove", { role: "Duke" });
        t.move("C", "Lose", { role: "Captain" });
      } else {
        t.move("C", "Pass");
        t.move("B", "Pass");
      }
      expect(t.g.turn).toBe("B");
      expect(t.g.stage).toBe("turn");
      expect(t.g.players[0].coins).toBe(challenge ? 2 : 5);
    }
  });
  it("Tax bluff cancels before block and unchallenged block cancels aid", () => {
    const t = table({ duke_blocks_tax: true });
    t.move("A", "Income");
    t.move("B", "Income");
    t.move("C", "Tax");
    t.move("A", "Challenge");
    t.move("C", "Lose", { role: "Captain" });
    expect(t.g.players[2].coins).toBe(2);
    t.move("A", "Foreign Aid");
    t.move("B", "Block", { role: "Duke" });
    t.close();
    expect(t.g.players[0].coins).toBe(3);
  });
  it("server deadlines are fresh and duplicate or late responses fail", () => {
    const t = table({ timer: true, duke_blocks_tax: true });
    t.move("A", "Tax");
    expect(t.g.deadline).toBe(30100);
    t.move("B", "Pass");
    expect(() => t.move("B", "Pass")).toThrow();
    expect(() => t.move("C", "Challenge", {}, 30100)).toThrow();
    const next = closeWindow(t.g, 30100);
    expect(next.stage).toBe("turn");
    expect(next.players[0].coins).toBe(5);
    t.move("C", "Block", { role: "Duke" }, 30099);
    expect(t.g.deadline).toBe(60099);
    t.move("A", "Pass", {}, 30101);
    expect(t.g.turn).toBe("B");
    expect(t.g.players[0].coins).toBe(2);
    expect(t.g.players[0].hand).toHaveLength(2);
  });
  it("resolves steal, assassination, exchange, aid and mandatory coup", () => {
    const t = table();
    t.move("A", "Foreign Aid");
    t.close();
    t.move("B", "Steal", { target: "A" });
    t.close();
    expect(t.g.players.map((p) => p.coins)).toEqual([2, 4, 2]);
    t.move("C", "Exchange");
    t.close();
    expect(t.g.pool).toHaveLength(4);
    t.move("C", "Keep", { indices: [2, 3] });
    expect(t.g.deck).toHaveLength(9);
    t.move("A", "Income");
    t.move("B", "Assassinate", { target: "C" });
    t.close();
    t.move("C", "Lose", { role: t.g.players[2].hand[0] });
    expect(t.g.players[1].coins).toBe(1);
    t.g.players[2].coins = 10;
    expect(legal(t.g, "C").every((m) => m.kind === "Coup")).toBe(true);
    t.move("C", "Coup", { target: "A" });
    t.move("A", "Lose", { role: "Duke" });
    expect(t.g.players[2].coins).toBe(3);
  });
});

it("records one assassination payment and only the failed challenge loss", () => {
  const t = table();
  t.move("A", "Income");
  t.move("B", "Income");
  t.move("C", "Income");
  t.move("A", "Assassinate", { target: "B" });
  t.move("B", "Challenge");
  t.move("A", "Prove", { role: "Assassin" });
  t.move("B", "Lose", { role: "Duke" });
  expect(t.g.stage).toBe("turn");
  expect(t.g.turn).toBe("B");
  const events = t.g.log.slice(4);
  expect(new Set(events.map((e) => e.actionId)).size).toBe(1);
  expect(events.every((e) => e.balances[0].coins === 0)).toBe(true);
  expect(events.filter((e) => e.discarded).map((e) => e.balances[1])).toEqual([
    { id: "B", coins: 3, influence: 1 },
  ]);
  expect(t.g.log[0].balances[0]).toEqual({ id: "A", coins: 2, influence: 2 });
  expect(t.g.log[1].balances[0].coins).toBe(3);
});

it.each(["Tax", "Exchange", "Steal"] as const)(
  "failed challenge cancels %s",
  (kind) => {
    const g = fixture();
    g.players[0].hand = ["Duke", kind === "Steal" ? "Captain" : "Ambassador"];
    let current = play(
      g,
      "A",
      { kind, ...(kind === "Steal" ? { target: "B" } : {}) },
      1,
      rng,
    );
    current = play(current, "B", { kind: "Challenge" }, 2, rng);
    current = play(
      current,
      "A",
      {
        kind: "Prove",
        role:
          kind === "Tax" ? "Duke" : kind === "Steal" ? "Captain" : "Ambassador",
      },
      2,
      rng,
    );
    current = play(current, "B", { kind: "Lose", role: "Duke" }, 3, rng);
    expect(current.stage).toBe("turn");
    expect(current.turn).toBe("B");
    expect(current.players.map((p) => p.coins)).toEqual([2, 2, 2]);
    expect(current.pool).toEqual([]);
    expect(current.deck.length).toBe(g.deck.length);
  },
);

it.each([false, true])(
  "claimant can keep a real Duke by conceding an action or block (block=%s)",
  (block) => {
    const t = table({ timer: true });
    t.move("A", block ? "Foreign Aid" : "Tax");
    const claimant = block ? "B" : "A";
    if (block) t.move("B", "Block", { role: "Duke" });
    t.move(block ? "A" : "B", "Challenge");
    expect(t.g.stage).toBe("claimResponse");
    expect(t.g.deadline).toBeNull();
    expect(legal(t.g, "C")).toEqual([]);
    expect(legal(t.g, claimant)).toContainEqual({
      kind: "Prove",
      role: "Duke",
    });
    expect(() => t.move(claimant, "Prove", { role: "Assassin" })).toThrow();
    const deck = [...t.g.deck];
    t.move(claimant, "Lose", { role: block ? "Contessa" : "Assassin" });
    expect(t.g.players.find((p) => p.id === claimant)?.hand).toEqual(["Duke"]);
    expect(t.g.deck).toEqual(deck);
    expect(
      t.g.log.some(
        (e) => e.deckMove || e.evidence === "bluff" || e.evidence === "proof",
      ),
    ).toBe(false);
    expect(t.g.players[0].coins).toBe(2);
    expect(t.g.turn).toBe("B");
  },
);

it.each([
  ["Steal", "Captain"],
  ["Steal", "Ambassador"],
  ["Assassinate", "Contessa"],
  ["Foreign Aid", "Duke"],
  ["Tax", "Duke"],
] as const)(
  "a challenged %s block with %s ends the action even when conceded",
  (kind, role) => {
    const g = fixture({ duke_blocks_tax: true });
    g.players[0].coins = 5;
    const targeted = kind === "Steal" || kind === "Assassinate";
    const declared = play(
      g,
      "A",
      { kind, ...(targeted && { target: "B" }) },
      1,
      rng,
    );
    const blocked = play(declared, "B", { kind: "Block", role }, 2, rng);
    const challenged = play(blocked, "A", { kind: "Challenge" }, 3, rng);
    const ended = play(
      challenged,
      "B",
      { kind: "Lose", role: "Contessa" },
      4,
      rng,
    );
    expect(ended.players.map((p) => p.coins)).toEqual([
      kind === "Assassinate" ? 2 : 5,
      2,
      2,
    ]);
    expect(ended.players.map((p) => p.hand.length)).toEqual([2, 1, 2]);
    expect(ended.stage).toBe("turn");
    expect(ended.turn).toBe("B");
    expect(ended.log.at(-1)).toMatchObject({
      discarded: "Contessa",
      status: "resolved",
    });
  },
);
