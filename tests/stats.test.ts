import { expect, it } from "vitest";
import { deal, defaults } from "../domain/model";
import { endMatch, play } from "../domain/engine";
import { observe } from "../domain/view";
import { computeMatchStats } from "../domain/match-stats";

const seats = ["A", "B", "C"].map((id) => ({ id, name: id }));
const rng = () => 0.45;

it("computes public match awards and internal Pembohong Handal bluffs without mid-match leaks", () => {
  let g = deal(seats, { ...defaults, duke_blocks_tax: true }, rng);
  g.players[0].hand = ["Duke", "Captain"];
  g.players[1].hand = ["Duke", "Contessa"];
  g.players[2].hand = ["Ambassador", "Assassin"];
  g.players[0].coins = 7;

  // A honestly steals with Captain (NOT a bluff); B challenges & loses Contessa
  g = play(g, "A", { kind: "Steal", target: "B" }, 1, rng);
  g = play(g, "B", { kind: "Challenge" }, 2, rng);
  g = play(g, "A", { kind: "Prove", role: "Captain" }, 3, rng);
  g = play(g, "B", { kind: "Lose", role: "Contessa" }, 4, rng);

  // B honestly declares Tax with Duke (NOT a bluff); C bluffs Block with Duke (bluff #1 for C)
  g = play(g, "B", { kind: "Tax" }, 5, rng);
  g = play(g, "C", { kind: "Block", role: "Duke" }, 6, rng);
  g = play(g, "B", { kind: "Pass" }, 7, rng);

  // Mid-match privacy: bluffs must NEVER be projected before stage === "over"
  expect(observe(g, "A").bluffs).toBeUndefined();
  expect(observe(g, "C").bluffs).toBeUndefined();
  expect(
    computeMatchStats(observe(g, "A")).awards.some((a) => a.id === "most_bluffs"),
  ).toBe(false);

  // C bluffs Tax without holding Duke (bluff #2 for C), unchallenged
  g = play(g, "C", { kind: "Tax" }, 8, rng);
  g = play(g, "A", { kind: "Pass" }, 9, rng);
  g = play(g, "B", { kind: "Pass" }, 10, rng);

  // A coups B (B only has 1 card left -> auto-eliminated), then host ends match
  g = play(g, "A", { kind: "Coup", target: "B", slot: 0 }, 11, rng);
  expect(g.players[1].hand).toEqual([]);
  g = endMatch(g, "A");

  const finalView = observe(g, "A");
  expect(finalView.bluffs).toEqual({ C: 2 });

  const stats = computeMatchStats(finalView);
  expect(stats.totalChallenges).toBe(1);
  expect(stats.totalBlocks).toBe(1);
  expect(stats.awards).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "most_targeted",
        playerId: "B",
        value: 2,
      }),
      expect.objectContaining({
        id: "most_aggressive",
        playerId: "A",
        value: 2,
      }),
      expect.objectContaining({
        id: "most_challenges",
        playerId: "B",
        value: 1,
      }),
      expect.objectContaining({
        id: "most_blocks",
        playerId: "C",
        value: 1,
      }),
      expect.objectContaining({
        id: "most_bluffs",
        title: "Pembohong Handal",
        playerId: "C",
        value: 2,
        summary: "2× bluff",
      }),
      expect.objectContaining({
        id: "richest_peak",
        playerId: "A",
        value: 7,
      }),
    ]),
  );
});
