import { expect, it } from "vitest";
import { deal, defaults } from "../domain/model";
import { play } from "../domain/engine";
import { observe } from "../domain/view";
import { computeMatchStats } from "../domain/match-stats";

const seats = ["A", "B", "C"].map((id) => ({ id, name: id }));
const rng = () => 0.45;

it("computes public match awards accurately without leaking hidden cards", () => {
  let g = deal(seats, { ...defaults, duke_blocks_tax: true }, rng);
  g.players[0].hand = ["Duke", "Captain"];
  g.players[1].hand = ["Duke", "Contessa"];
  g.players[2].hand = ["Ambassador", "Assassin"];
  g.players[0].coins = 7;

  // A steals from B, B blocks with Ambassador/Captain? B challenges instead
  g = play(g, "A", { kind: "Steal", target: "B" }, 1, rng);
  g = play(g, "B", { kind: "Challenge" }, 2, rng);
  g = play(g, "A", { kind: "Prove", role: "Captain" }, 3, rng);
  g = play(g, "B", { kind: "Lose", role: "Contessa" }, 4, rng);

  // B declares Tax, C blocks with Duke, B passes
  g = play(g, "B", { kind: "Tax" }, 5, rng);
  g = play(g, "C", { kind: "Block", role: "Duke" }, 6, rng);
  g = play(g, "B", { kind: "Pass" }, 7, rng);

  // C takes Income, A coups B (B only has 1 card left -> auto-eliminated)
  g = play(g, "C", { kind: "Income" }, 8, rng);
  g = play(g, "A", { kind: "Coup", target: "B", slot: 0 }, 9, rng);
  expect(g.players[1].hand).toEqual([]);

  const stats = computeMatchStats(observe(g, "A"));
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
        id: "richest_peak",
        playerId: "A",
        value: 7,
      }),
    ]),
  );
});
