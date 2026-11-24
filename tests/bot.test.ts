import { expect, it } from "vitest";
import { record, deal, defaults, type Difficulty } from "../domain/model";
import { legal, play } from "../domain/engine";
import { observe } from "../domain/view";
import { belief, decide } from "../domain/bot";
function seeded(seed: number) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const levels: Difficulty[] = ["easy", "normal", "hard"];
it.each(levels)(
  "%s completes 40 seeded games across 2–6 seats and toggle combinations",
  (level) => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seeded(seed),
        seats = Array.from({ length: 2 + (seed % 5) }, (_, i) => ({
          id: String(i),
          name: "Seat " + i,
        }));
      let g = deal(
        seats,
        {
          timer: !!(seed & 4),
          duke_blocks_tax: !!(seed & 2),
          one_time_guess: !!(seed & 1),
        },
        rng,
      );
      let count = 0;
      while (!g.winner && count++ < 900) {
        const actor = seats.find((s) => legal(g, s.id).length)!;
        const o = observe(g, actor.id),
          decision = decide(o, level, rng)!;
        const firstEvent = g.log.length;
        const replay = level + " seed " + seed + " decision " + count;
        if (g.stage !== "turn")
          expect(o.context.eligibleResponders, replay).toContain(actor.id);
        g = play(g, actor.id, decision, count, rng);
        const emitted = g.log.slice(firstEvent);
        expect(emitted.length, replay).toBeGreaterThan(0);
        expect(
          emitted.every(
            (e, i) =>
              e.actionId === o.context.actionId &&
              e.actorId === o.turn &&
              e.seq === firstEvent + i + 1,
          ),
          replay,
        ).toBe(true);
        expect(emitted.at(-1)!.status, replay).toBe(
          g.stage === "turn" || g.stage === "over" ? "resolved" : "pending",
        );

        expect(
          g.deck.length +
            g.players.reduce(
              (n, p) => n + p.hand.length + p.revealed.length,
              0,
            ) +
            (g.stage === "exchange" ? 2 : 0),
        ).toBe(15);
      }
      expect(g.winner, level + " seed " + seed).toBeTruthy();
    }
  },
);
it("policy and projection ignore hidden changes; public claims update belief", () => {
  const g = deal(
    ["x", "y"].map((id) => ({ id, name: id })),
    defaults,
    seeded(1),
  );
  const before = observe(g, "x");
  [g.deck[0], g.players[1].hand[0]] = [g.players[1].hand[0], g.deck[0]];
  expect(observe(g, "x")).toEqual(before);
  expect(decide(observe(g, "x"), "hard", seeded(13))).toEqual(
    decide(before, "hard", seeded(13)),
  );
  const prior = belief(before, "y", "Duke", "hard");
  record(g, { text: "Tax", actor: "y", role: "Duke", evidence: "claim" });
  expect(belief(observe(g, "x"), "y", "Duke", "hard")).toBeGreaterThan(prior);
});
it("difficulty changes bluff frequency across independent deals", () => {
  const bluffs = levels.map((level) => {
    let count = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const rng = seeded(seed),
        g = deal(
          ["x", "y"].map((id) => ({ id, name: id })),
          defaults,
          rng,
        );
      if (
        !g.players[0].hand.includes("Duke") &&
        decide(observe(g, "x"), level, rng)?.kind === "Tax"
      )
        count++;
    }
    return count;
  });
  expect(bluffs[0]).toBeGreaterThan(bluffs[2] + 10);
});
