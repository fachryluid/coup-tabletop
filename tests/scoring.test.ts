import { describe, expect, it } from "vitest";
import { BOT_NAMES, pickUniqueBotName } from "../domain/bot-names";
import { deal, defaults, phaseStamp, roles } from "../domain/model";
import { play } from "../domain/engine";
import {
  calculatePlacementPoints,
  computeMatchPlacements,
} from "../domain/scoring";
import { MemoryRooms, Tables } from "../server/rooms";
import type { RecordMatchInput } from "../server/db";

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("dynamic placement scoring", () => {
  it("computes points for every table size from 2 to 6 players", () => {
    expect([1, 2].map((r) => calculatePlacementPoints(r, 2))).toEqual([2, 0]);
    expect([1, 2, 3].map((r) => calculatePlacementPoints(r, 3))).toEqual([
      3, 1, 0,
    ]);
    expect([1, 2, 3, 4].map((r) => calculatePlacementPoints(r, 4))).toEqual([
      4, 2, 1, 0,
    ]);
    expect(
      [1, 2, 3, 4, 5].map((r) => calculatePlacementPoints(r, 5)),
    ).toEqual([5, 3, 2, 1, 0]);
    expect(
      [1, 2, 3, 4, 5, 6].map((r) => calculatePlacementPoints(r, 6)),
    ).toEqual([6, 4, 3, 2, 1, 0]);
  });

  it("tracks exact elimination order in a 4-player match and awards +4, +2, +1, 0", () => {
    const seats = [
      { id: "p1", name: "Ayu" },
      { id: "p2", name: "Bima" },
      { id: "p3", name: "Citra" },
      { id: "p4", name: "Dina" },
    ];
    let g = deal(seats, defaults, seeded(42), "m-4p");
    // Give Ayu plenty of coins and leave others with 1 card each so we control elimination order:
    // Dina eliminated 1st (rank 4 -> 0), Citra 2nd (rank 3 -> +1), Bima 3rd (rank 2 -> +2), Ayu wins (rank 1 -> +4).
    g.players[0].coins = 25;
    for (let i = 1; i < 4; i++) {
      g.players[i].revealed.push(g.players[i].hand.pop()!);
    }

    // Turn 1: Ayu Coups Dina -> Dina eliminated first
    g = play(g, "p1", { kind: "Coup", target: "p4", slot: 0 }, 1000, seeded(1));
    expect(g.eliminatedOrder).toEqual(["p4"]);
    // Bima & Citra take Income
    g = play(g, "p2", { kind: "Income" }, 1001, seeded(2));
    g = play(g, "p3", { kind: "Income" }, 1002, seeded(3));

    // Turn 2: Ayu Coups Citra -> Citra eliminated second
    g = play(g, "p1", { kind: "Coup", target: "p3", slot: 0 }, 1003, seeded(4));
    expect(g.eliminatedOrder).toEqual(["p4", "p3"]);
    g = play(g, "p2", { kind: "Income" }, 1004, seeded(5));

    // Turn 3: Ayu Coups Bima -> Bima eliminated third, Ayu wins
    g = play(g, "p1", { kind: "Coup", target: "p2", slot: 0 }, 1005, seeded(6));
    expect(g.stage).toBe("over");
    expect(g.winner).toBe("p1");
    expect(g.eliminatedOrder).toEqual(["p4", "p3", "p2"]);

    expect(computeMatchPlacements(g)).toEqual([
      { id: "p1", name: "Ayu", rank: 1, points: 4 },
      { id: "p2", name: "Bima", rank: 2, points: 2 },
      { id: "p3", name: "Citra", rank: 3, points: 1 },
      { id: "p4", name: "Dina", rank: 4, points: 0 },
    ]);
  });

  it("awards 0 placements when match ended without a winner", () => {
    const g = deal(
      [
        { id: "p1", name: "Ayu" },
        { id: "p2", name: "Bima" },
      ],
      defaults,
      seeded(7),
      "m-ended",
    );
    g.stage = "over";
    expect(computeMatchPlacements(g)).toEqual([]);
  });

  it("awards +1 bonus point for each player whose One-Time Guess was correct (including non-winners), and +0 on wrong guess", () => {
    const seats = [
      { id: "p1", name: "Ayu" },
      { id: "p2", name: "Bima" },
      { id: "p3", name: "Citra" },
    ];
    let g = deal(
      seats,
      { ...defaults, one_time_guess: true },
      seeded(202),
      "m-guess-bonus",
    );
    const bimaSlot0 = g.players[1].hand[0];
    const ayuSlot0 = g.players[0].hand[0];

    // Turn 1: Ayu guesses Bima[0] CORRECTLY -> Bima down to 1 card, Ayu earns +1 bonus
    g = play(
      g,
      "p1",
      { kind: "Guess", target: "p2", slot: 0, role: bimaSlot0 },
      3000,
      seeded(1),
    );
    expect(g.players[0].guessHit).toBe(true);
    // Turn 2: Bima takes Income
    g = play(g, "p2", { kind: "Income" }, 3001, seeded(2));
    // Turn 3: Citra guesses Ayu[0] CORRECTLY -> Ayu down to 1 card, Citra earns +1 bonus
    g = play(
      g,
      "p3",
      { kind: "Guess", target: "p1", slot: 0, role: ayuSlot0 },
      3002,
      seeded(3),
    );
    expect(g.players[2].guessHit).toBe(true);

    // Give Ayu enough coins for two Coups to control elimination order (Citra 1st, then Bima 2nd)
    g.players[0].coins = 14;
    // Turn 4: Ayu Coups Citra (slot 0) -> Citra down to 1 card
    g = play(g, "p1", { kind: "Coup", target: "p3", slot: 0 }, 3003, seeded(4));
    // Turn 5: Bima takes Income
    g = play(g, "p2", { kind: "Income" }, 3004, seeded(5));
    // Turn 6: Citra takes Income
    g = play(g, "p3", { kind: "Income" }, 3005, seeded(6));
    // Turn 7: Ayu Coups Citra (slot 0) -> Citra eliminated 1st (rank 3: 0 + 1 bonus = +1)
    g = play(g, "p1", { kind: "Coup", target: "p3", slot: 0 }, 3006, seeded(7));
    expect(g.eliminatedOrder).toEqual(["p3"]);

    // Turn 8: Bima guesses Ayu[0] WRONGLY -> loses his only remaining card automatically -> eliminated 2nd (rank 2: +1 + 0 = +1)
    const ayuRemaining = g.players[0].hand[0];
    const wrongForAyu = roles.find((r) => r !== ayuRemaining)!;
    g = play(
      g,
      "p2",
      { kind: "Guess", target: "p1", slot: 0, role: wrongForAyu },
      3007,
      seeded(8),
    );
    expect(g.players[1].guessHit).toBe(false);

    expect(g.stage).toBe("over");
    expect(g.winner).toBe("p1");
    expect(g.eliminatedOrder).toEqual(["p3", "p2"]);

    expect(computeMatchPlacements(g)).toEqual([
      { id: "p1", name: "Ayu", rank: 1, points: 4, guessBonus: 1 },
      { id: "p2", name: "Bima", rank: 2, points: 1 },
      { id: "p3", name: "Citra", rank: 3, points: 1, guessBonus: 1 },
    ]);
  });

  it("persists One-Time Guess +1 bonus to session leaderboard and DB payload, and resets on rematch", () => {
    const recorded: RecordMatchInput[] = [];
    const tables = new Tables(
      new MemoryRooms(),
      () => {},
      5000,
      seeded(42),
      () => 0,
      (payload) => recorded.push(payload),
    );
    try {
      const { room, id: host } = tables.create("Ayu", {}, "acc-ayu");
      const { id: guest } = tables.admit(room, "Bima", undefined, "acc-bima");
      tables.execute(room, host, room.revision, {
        type: "setting",
        key: "one_time_guess",
        value: true,
      });
      tables.execute(room, host, room.revision, { type: "start" });

      const g = room.game!;
      const starter = g.turn;
      const other = starter === host ? guest : host;
      const otherPlayer = g.players.find((p) => p.id === other)!;
      // Leave target with 1 card so a correct guess ends the 2-player match immediately.
      otherPlayer.revealed.push(otherPlayer.hand.pop()!);
      const targetRole = otherPlayer.hand[0];

      tables.execute(
        room,
        starter,
        room.revision,
        {
          type: "play",
          move: { kind: "Guess", target: other, slot: 0, role: targetRole },
        },
        phaseStamp(g),
      );

      expect(room.game!.stage).toBe("over");
      expect(room.game!.winner).toBe(starter);

      // 2-player win (+2) + correct guess bonus (+1) = +3 points
      const view = tables.view(room, host);
      const winnerRow = view.leaderboard!.find((r) => r.id === starter)!;
      expect(winnerRow.points).toBe(3);
      expect(winnerRow.lastPoints).toBe(3);
      expect(view.game!.matchResults).toEqual([
        {
          id: starter,
          name: starter === host ? "Ayu" : "Bima",
          rank: 1,
          points: 3,
          guessBonus: 1,
        },
        {
          id: other,
          name: other === host ? "Ayu" : "Bima",
          rank: 2,
          points: 0,
        },
      ]);

      expect(recorded).toHaveLength(1);
      const dbWinner = recorded[0].participants.find((p) => p.seatId === starter)!;
      expect(dbWinner.pointsEarned).toBe(3);

      // Rematch resets guessHit so the next match does not inherit the bonus
      tables.execute(
        room,
        host,
        room.revision,
        { type: "again" },
        phaseStamp(room.game!),
      );
      expect(room.game!.players.every((p) => !p.used && !p.guessHit)).toBe(true);
    } finally {
      tables.dispose();
    }
  });

  it("does not award One-Time Guess bonus if host ends the match without a winner", () => {
    const seats = [
      { id: "p1", name: "Ayu" },
      { id: "p2", name: "Bima" },
    ];
    let g = deal(
      seats,
      { ...defaults, one_time_guess: true },
      seeded(55),
      "m-host-ended-guess",
    );
    const bimaCard0 = g.players[1].hand[0];
    g = play(
      g,
      "p1",
      { kind: "Guess", target: "p2", slot: 0, role: bimaCard0 },
      1000,
      seeded(1),
    );
    expect(g.players[0].guessHit).toBe(true);
    g.stage = "over";
    g.winner = undefined;
    expect(computeMatchPlacements(g)).toEqual([]);
  });
});

describe("unique random bot names", () => {
  it("has a curated JSON pool of at least 50 unique, valid bot names", () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(50);
    const lower = new Set(BOT_NAMES.map((n) => n.trim().toLowerCase()));
    expect(lower.size).toBe(BOT_NAMES.length);
    for (const name of BOT_NAMES) {
      expect(name.trim().length).toBeGreaterThanOrEqual(2);
      expect(name.trim().length).toBeLessThanOrEqual(32);
    }
  });

  it("picks unique random names from the JSON pool without colliding with existing seats", () => {
    const tables = new Tables(
      new MemoryRooms(),
      () => {},
      5000,
      seeded(12345),
      () => 0,
    );
    try {
      const { room, id: host } = tables.create(
        BOT_NAMES[0],
        {},
        "acc-host",
        "https://lh3.googleusercontent.com/host-pic",
      );
      for (let i = 0; i < 5; i++) {
        tables.execute(room, host, room.revision, { type: "add" });
      }
      const names = room.seats.map((s) => s.name);
      expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(6);
      const botNames = room.seats
        .filter((s) => s.difficulty)
        .map((s) => s.name);
      for (const bn of botNames) {
        expect(BOT_NAMES).toContain(bn);
        expect(bn).not.toMatch(/^Computer \d+$/);
      }

      // Host Google avatar is projected in RoomView and preserved/refreshed on restore
      const view = tables.view(room, host);
      expect(view.seats[0].avatar).toBe(
        "https://lh3.googleusercontent.com/host-pic",
      );
      const hostToken = [...room.tokens.entries()].find(
        ([, sid]) => sid === host,
      )![0];
      tables.restore(
        room.code,
        hostToken,
        "acc-host",
        "https://lh3.googleusercontent.com/host-pic-updated",
      );
      expect(tables.view(room, host).seats[0].avatar).toBe(
        "https://lh3.googleusercontent.com/host-pic-updated",
      );
    } finally {
      tables.dispose();
    }
  });

  it("falls back safely if every name in the JSON pool is already taken", () => {
    const fallback = pickUniqueBotName(BOT_NAMES, () => 0.5);
    expect(fallback).toBe("Bot 1");
  });
});
