import { describe, it, expect } from "vitest";
import { deal, defaults, roles, type Move, type Config } from "../domain/model";
import { cardImage } from "../domain/card-themes";
import { legal, play, switchCards, closeWindow } from "../domain/engine";
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
    t.move("B", "Pass");
    t.move("C", "Challenge");
    t.move("A", "Prove", { role: "Duke" });
    expect(t.g.log.flatMap((e) => (e.deckMove ? [e.deckMove] : []))).toEqual([
      { seat: "A", kind: "replace", slot: 0 },
    ]);
    const guessHit = table({ one_time_guess: true });
    guessHit.move("A", "Guess", { target: "B", slot: 0, role: "Duke" });
    expect(guessHit.g.log.every((e) => !e.deckMove)).toBe(true);
    const guessMiss = table({ one_time_guess: true });
    guessMiss.move("A", "Guess", { target: "B", slot: 1, role: "Captain" });
    expect(
      guessMiss.g.log.flatMap((e) => (e.deckMove ? [e.deckMove] : [])),
    ).toEqual([{ seat: "B", kind: "replace", slot: 1 }]);
  });
  it.each([false, true])(
    "One-Time Guess independen dengan Duke Blocks Tax %s",
    (tax) => {
      for (const hit of [false, true]) {
        const t = table({ one_time_guess: true, duke_blocks_tax: tax });
        // B holds ["Duke", "Contessa"] in fixture
        t.move("A", "Guess", {
          target: "B",
          slot: 0,
          role: hit ? "Duke" : "Captain",
        });
        expect(legal(t.g, "C")).toEqual([]);
        expect(legal(t.g, "B")).toEqual(hit ? expect.any(Array) : []);
        expect(
          t.g.log.find((e) => e.speech?.words.includes(hit ? "benar" : "salah"))
            ?.speech?.by,
        ).toBe("B");
        if (!hit) {
          expect(t.g.stage).toBe("loss");
          expect(t.g.loss?.id).toBe("A");
          t.move("A", "Lose", { role: "Assassin" });
        }
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
  it("One-Time Guess harus cocok posisi kartu kiri/kanan; salah mengganti kartu yang ditebak dari dek", () => {
    const t = table({ one_time_guess: true });
    // B holds ["Duke", "Contessa"]: guessing Duke on slot 1 (kanan) MUST be wrong!
    const beforeDeck = t.g.deck.length;
    t.move("A", "Guess", { target: "B", slot: 1, role: "Duke" });
    expect(t.g.stage).toBe("loss");
    expect(t.g.loss?.id).toBe("A");
    expect(t.g.players[1].hand[0]).toBe("Duke");
    expect(t.g.players[1].hand).toHaveLength(2);
    expect(t.g.deck).toHaveLength(beforeDeck);
    const proof = t.g.log.find((e) => e.evidence === "proof");
    expect(proof).toMatchObject({
      actor: "B",
      role: "Contessa",
      proofSlot: 1,
      deckMove: { seat: "B", kind: "replace", slot: 1 },
    });
    // Guessing slot 1 when target only has 1 card is rejected
    const t2 = table({ one_time_guess: true });
    t2.g.players[1].revealed.push(t2.g.players[1].hand.pop()!);
    expect(() =>
      t2.move("A", "Guess", { target: "B", slot: 1, role: "Duke" }),
    ).toThrow();
    t2.move("A", "Guess", { target: "B", slot: 0, role: "Duke" });
    expect(t2.g.players[1].hand).toHaveLength(0);
    expect(t2.g.players[1].revealed).toHaveLength(2);
  });
  it.each([false, true])(
    "Tax dan challenge terhadap blok, guess=%s",
    (guess) => {
      for (const blocker of ["B", "C"]) {
        const t = table({ one_time_guess: guess, duke_blocks_tax: true });
        t.move("A", "Tax");
        // Clockwise order: B responds first, C waits until B passes
        expect(legal(t.g, "B")).toEqual(
          expect.arrayContaining([
            { kind: "Pass" },
            { kind: "Challenge" },
            { kind: "Block", role: "Duke" },
          ]),
        );
        expect(legal(t.g, "C")).toEqual([]);
        expect(legal(t.g, "A")).toEqual([]);
        if (blocker === "C") {
          t.move("B", "Pass");
          expect(legal(t.g, "C")).toEqual(
            expect.arrayContaining([
              { kind: "Pass" },
              { kind: "Challenge" },
              { kind: "Block", role: "Duke" },
            ]),
          );
          expect(legal(t.g, "B")).toEqual([]);
        }
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
      t.move("B", "Pass");
      if (challenge) {
        t.move("C", "Challenge");
        expect(() => t.move("B", "Block", { role: "Duke" })).toThrow();
        t.move("A", "Prove", { role: "Duke" });
        t.move("C", "Lose", { role: "Captain" });
      } else {
        t.move("C", "Pass");
      }
      expect(t.g.turn).toBe("B");
      expect(t.g.stage).toBe("turn");
      expect(t.g.players[0].coins).toBe(challenge ? 2 : 5);
    }
  });
  it("intervensi publik selalu mengikuti urutan searah jarum jam", () => {
    const t = table({ duke_blocks_tax: true });
    t.move("A", "Income");
    // B acts: clockwise response order must be C -> A
    t.move("B", "Tax");
    expect(t.g.pending).toEqual(["C", "A"]);
    expect(legal(t.g, "A")).toEqual([]);
    expect(() => t.move("A", "Pass")).toThrow();
    t.move("C", "Pass");
    expect(t.g.pending).toEqual(["A"]);
    expect(legal(t.g, "A").length).toBeGreaterThan(0);
    t.move("A", "Pass");
    expect(t.g.turn).toBe("C");
    expect(t.g.players[1].coins).toBe(5);
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
    // B passes at t=150 -> C gets a fresh 30s deadline (30150)
    t.move("B", "Pass", {}, 150);
    expect(t.g.deadline).toBe(30150);
    expect(() => t.move("B", "Pass", {}, 151)).toThrow();
    expect(() => t.move("C", "Challenge", {}, 30150)).toThrow();
    const next = closeWindow(t.g, 30150);
    expect(next.stage).toBe("turn");
    expect(next.players[0].coins).toBe(5);
    t.move("C", "Block", { role: "Duke" }, 30149);
    expect(t.g.deadline).toBe(60149);
    t.move("A", "Pass", {}, 30151);
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
    t.move("C", "Coup", { target: "A", slot: 0 });
    expect(t.g.stage).toBe("turn");
    expect(t.g.players[0].revealed).toEqual(["Duke"]);
    expect(t.g.players[0].hand).toEqual(["Assassin"]);
    expect(t.g.players[2].coins).toBe(3);
  });
  it("Coup memilih kartu kiri atau kanan bagi target dengan 2 kartu dan langsung menggugurkannya", () => {
    // Target B has ["Duke", "Contessa"]; Coup slot 1 (kanan) eliminates Contessa directly
    const t = table();
    t.g.players[0].coins = 7;
    expect(legal(t.g, "A")).toEqual(
      expect.arrayContaining([
        { kind: "Coup", target: "B", slot: 0 },
        { kind: "Coup", target: "B", slot: 1 },
      ]),
    );
    expect(() => t.move("A", "Coup", { target: "B" })).toThrow();
    t.move("A", "Coup", { target: "B", slot: 1 });
    expect(t.g.stage).toBe("turn");
    expect(t.g.turn).toBe("B");
    expect(t.g.players[0].coins).toBe(0);
    expect(t.g.players[1].hand).toEqual(["Duke"]);
    expect(t.g.players[1].revealed).toEqual(["Contessa"]);
    expect(t.g.log.some((e) => e.proofSlot === 1 && e.discarded === "Contessa")).toBe(
      true,
    );
    expect(
      t.g.log.some(
        (e) =>
          e.coinMove?.from === "A" &&
          e.coinMove?.to === "bank" &&
          e.coinMove?.amount === 7,
      ),
    ).toBe(true);

    // Target with 1 card rejects slot 1 and accepts slot 0
    const t2 = table();
    t2.g.players[0].coins = 7;
    t2.g.players[1].revealed.push(t2.g.players[1].hand.pop()!);
    expect(() => t2.move("A", "Coup", { target: "B", slot: 1 })).toThrow();
    t2.move("A", "Coup", { target: "B", slot: 0 });
    expect(t2.g.players[1].hand).toEqual([]);
    expect(t2.g.players[1].revealed).toEqual(["Contessa", "Duke"]);
  });
  it("mencatat perpindahan koin pada Income, Foreign Aid, Tax, Steal, Assassinate, dan Coup", () => {
    const t = table();
    t.move("A", "Income");
    expect(t.g.log.at(-1)?.coinMove).toEqual({ from: "bank", to: "A", amount: 1 });
    t.move("B", "Foreign Aid");
    t.close();
    expect(t.g.log.at(-1)?.coinMove).toEqual({ from: "bank", to: "B", amount: 2 });
    t.move("C", "Tax");
    t.close();
    expect(t.g.log.at(-1)?.coinMove).toEqual({ from: "bank", to: "C", amount: 3 });
    t.move("A", "Steal", { target: "C" });
    t.close();
    expect(t.g.log.at(-1)?.coinMove).toEqual({ from: "C", to: "A", amount: 2 });
    t.move("B", "Assassinate", { target: "A" });
    expect(t.g.log.at(-1)?.coinMove).toEqual({ from: "B", to: "bank", amount: 3 });
  });
  it("Switch menukar kartu kiri/kanan maksimal 1x per giliran tanpa memengaruhi aksi lain", () => {
    let g = fixture({ one_time_guess: true });
    // A holds ["Duke", "Assassin"]
    expect(g.players[0].hand).toEqual(["Duke", "Assassin"]);
    // Non-turn player cannot switch
    expect(() => switchCards(g, "B")).toThrow();

    // First switch on A's turn succeeds and keeps A's turn + legal moves intact
    g = switchCards(g, "A");
    expect(g.players[0].hand).toEqual(["Assassin", "Duke"]);
    expect(g.turn).toBe("A");
    expect(g.stage).toBe("turn");
    expect(g.switched).toBe(true);
    expect(g.log.at(-1)).toMatchObject({
      text: "A menukar posisi kartunya.",
      cardSwap: "A",
    });
    expect(g.log.at(-1)?.text).not.toMatch(/Duke|Assassin/);

    // Second switch on the same turn is rejected
    expect(() => switchCards(g, "A")).toThrow();

    // A still takes normal turn action
    g = play(g, "A", { kind: "Income" }, 10, rng);
    expect(g.turn).toBe("B");
    expect(g.switched).toBe(false);

    // After A switched, slot 0 is now Assassin (was Duke) -> Guess Duke on slot 0 misses!
    g = play(g, "B", { kind: "Guess", target: "A", slot: 0, role: "Duke" }, 20, rng);
    expect(g.stage).toBe("loss");
    expect(g.loss?.id).toBe("B");
    g = play(g, "B", { kind: "Lose", role: "Contessa" }, 21, rng);

    // C takes Income -> back to A's turn: A can switch again even when coins >= 10 (mandatory Coup)
    g = play(g, "C", { kind: "Income" }, 30, rng);
    g.players[0].coins = 10;
    expect(legal(g, "A").every((m) => m.kind === "Coup")).toBe(true);
    g = switchCards(g, "A");
    expect(g.turn).toBe("A");
    expect(legal(g, "A").every((m) => m.kind === "Coup")).toBe(true);
    g = play(g, "A", { kind: "Coup", target: "C", slot: 0 }, 40, rng);

    // B only has 1 card left -> cannot switch on B's turn
    expect(g.turn).toBe("B");
    expect(g.players[1].hand).toHaveLength(1);
    expect(() => switchCards(g, "B")).toThrow();
  });
  it("setiap 3 copy peran memiliki varian art unik (0, 1, 2) dan Custom 1 memakai 1 desain kustom + 2 klasik", () => {
    const g = deal(
      ["A", "B", "C"].map((id) => ({ id, name: id })),
      defaults,
      rng,
      "theme-test",
      "custom1",
    );
    expect(g.cardTheme).toBe("custom1");
    // Collect all 15 physical (role, art) pairs across deck + players
    const all = [
      ...g.deck.map((role, i) => ({ role, art: g.deckArt![i] })),
      ...g.players.flatMap((p) =>
        p.hand.map((role, i) => ({ role, art: p.handArt![i] })),
      ),
    ];
    expect(all).toHaveLength(15);
    for (const role of roles) {
      const variants = all
        .filter((c) => c.role === role)
        .map((c) => c.art)
        .sort();
      expect(variants).toEqual([0, 1, 2]);
      // Variant 0 uses Custom 1 art; variants 1 and 2 fall back to classic art
      expect(cardImage(role, "custom1", 0)).toBe(
        `/cards/custom1/${role.toLowerCase()}-1.webp`,
      );
      expect(cardImage(role, "custom1", 1)).toBe(
        `/cards/${role.toLowerCase()}.webp`,
      );
      expect(cardImage(role, "custom1", 2)).toBe(
        `/cards/${role.toLowerCase()}.webp`,
      );
      // Classic theme uses classic art for all 3 copies
      for (const v of [0, 1, 2]) {
        expect(cardImage(role, "classic", v)).toBe(
          `/cards/${role.toLowerCase()}.webp`,
        );
      }
    }
    // Switching preserves art variants alongside swapped roles
    const [r0, r1] = g.players[0].hand;
    const [a0, a1] = g.players[0].handArt!;
    const swapped = switchCards(g, "A");
    expect(swapped.players[0].hand).toEqual([r1, r0]);
    expect(swapped.players[0].handArt).toEqual([a1, a0]);
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
    const concededRole = role === "Contessa" ? "Duke" : "Contessa";
    const ended = play(
      challenged,
      "B",
      { kind: "Lose", role: concededRole },
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
      discarded: concededRole,
      status: "resolved",
    });
  },
);

it("otomatis menggugurkan kartu terakhir tanpa menunggu pilihan saat kartu tinggal satu", () => {
  // 1. Coup on 1-card player eliminates immediately
  const t1 = table();
  t1.g.players[0].coins = 7;
  t1.g.players[1].revealed.push(t1.g.players[1].hand.pop()!);
  t1.move("A", "Coup", { target: "B", slot: 0 });
  expect(t1.g.stage).toBe("turn");
  expect(t1.g.players[1].hand).toEqual([]);
  expect(t1.g.players[1].revealed).toHaveLength(2);

  // 2. Bluffing with 1 non-matching card auto-eliminates on Challenge without claimResponse
  const t2 = table();
  t2.g.players[2].hand = ["Captain"];
  t2.g.players[2].revealed = ["Ambassador"];
  t2.move("A", "Income");
  t2.move("B", "Income");
  t2.move("C", "Tax"); // claims Duke, only holds Captain
  t2.move("A", "Challenge");
  expect(t2.g.stage).toBe("turn");
  expect(t2.g.players[2].hand).toEqual([]);
  expect(t2.g.players[2].revealed).toEqual(["Ambassador", "Captain"]);

  // 3. Matching 1-card claimant STILL gets claimResponse to Prove (no instant timing tell)
  const t3 = table();
  t3.g.players[0].hand = ["Duke"];
  t3.g.players[0].revealed = ["Assassin"];
  t3.move("A", "Tax");
  t3.move("B", "Challenge");
  expect(t3.g.stage).toBe("claimResponse");
  expect(legal(t3.g, "A")).toEqual([{ kind: "Prove", role: "Duke" }]);

  // 4. Claimant with [Duke, Assassin] challenged on Duke cannot uselessly Lose Duke, only Prove Duke or Lose Assassin
  const t4 = table();
  t4.move("A", "Tax");
  t4.move("B", "Challenge");
  expect(legal(t4.g, "A")).toEqual([
    { kind: "Prove", role: "Duke" },
    { kind: "Lose", role: "Assassin" },
  ]);
  expect(() => t4.move("A", "Lose", { role: "Duke" })).toThrow();

  // 5. Claimant with two identical matching cards [Duke, Duke] stays in claimResponse (no auto-prove tell)
  const t5 = table();
  t5.g.players[0].hand = ["Duke", "Duke"];
  t5.move("A", "Tax");
  t5.move("B", "Challenge");
  expect(t5.g.stage).toBe("claimResponse");
  expect(legal(t5.g, "A")).toEqual([{ kind: "Prove", role: "Duke" }]);
});
