import { expect, it } from "vitest";
import { initialPlayback, playback } from "../app/table-playback";
import { deal, defaults, type Game } from "../domain/model";
import { observe, type RoomView } from "../domain/view";
import { play } from "../domain/engine";
const seats = ["A", "B"].map((id) => ({ id, name: id, online: true }));
const rng = () => 0.5;
function snapshot(game: Game, revision: number): RoomView {
  return {
    game: observe(game, "B"),
    revision,
    code: "ROOM",
    me: "B",
    host: "A",
    seats,
    config: game.config,
    cardTheme: game.cardTheme ?? "classic",
    serverTime: 100,
  };
}
const receive = (s: typeof initialPlayback, room: RoomView, restore = false) =>
  playback(s, { type: "snapshot", room, restore });
function read(s: typeof initialPlayback) {
  return playback(s, { type: "read", line: s.lines[s.cursor] });
}
it("keeps queued projections in order across burst packets, presence, and dialogue review", () => {
  const start = deal(seats, defaults, rng);
  const first = play(start, "A", { kind: "Income" }, 100, rng);
  const second = play(first, "B", { kind: "Income" }, 200, rng);
  let s = receive(initialPlayback, snapshot(start, 1), true);
  s = receive(s, snapshot(first, 2));
  s = receive(s, snapshot(second, 3));
  s = receive(s, snapshot(second, 3));
  expect(s.room?.revision).toBe(1);
  expect(s.lines[s.cursor].by).toBe("A");
  s = read(s);
  expect(s.room?.revision).toBe(2);
  expect(s.lines[s.cursor].by).toBe("B");
  s = playback(s, { type: "back" });
  s = read(s);
  expect(s.room?.revision).toBe(2);
  s = playback(s, { type: "next" });
  s = read(s);
  expect(s.room?.revision).toBe(3);
  expect(s.frames).toHaveLength(0);
});
it("keeps the last influence alive through Guess, result, reveal, and winner announcements", () => {
  const start = deal(seats, { ...defaults, one_time_guess: true }, rng);
  const discarded = start.players[1].hand.pop()!;
  start.players[1].revealed.push(discarded);
  const final = play(
    start,
    "A",
    { kind: "Guess", target: "B", slot: 0, role: start.players[1].hand[0] },
    0,
    rng,
  );
  let s = receive(initialPlayback, snapshot(start, 1), true);
  s = receive(s, snapshot(final, 2));
  const oldLine = s.lines[s.cursor];
  const restored = receive(s, snapshot(final, 2), true);
  expect(restored.frames).toHaveLength(0);
  expect(restored.room?.game?.winner).toBe("A");
  expect(restored.sceneKey).not.toBe(s.sceneKey);
  expect(playback(restored, { type: "read", line: oldLine })).toBe(restored);
  for (const phrase of [
    "menebak",
    "benar",
    "Tebakan A benar.",
    "tereliminasi",
    "menang",
  ]) {
    expect(s.lines[s.cursor].words).toContain(phrase);
    expect(s.room?.game?.winner).toBeUndefined();
    expect(s.room?.game?.hand).toHaveLength(1);
    if (phrase === "benar") {
      const line = s.lines[s.cursor];
      expect(line.by).toBe("B");
      expect(line.proof).toBe(start.players[1].hand[0]);
      expect(read(s)).toBe(s);
      s = playback(s, { type: "reveal", line });
    }
    s = read(s);
  }
  expect(s.room?.game?.hand).toHaveLength(0);
  expect(s.room?.game?.winner).toBe("A");
});
it("reveals a proven role, reads confirmation and waits for delivery even through a reconnect", () => {
  const start = deal(seats, defaults, rng);
  start.players[0].hand = ["Duke", "Captain"];
  const tax = play(start, "A", { kind: "Tax" }, 0, rng);
  const challenged = play(tax, "B", { kind: "Challenge" }, 10, rng);
  const before = { ...snapshot(tax, 2), matchRevision: 1 };
  const after = {
    ...snapshot(
      play(challenged, "A", { kind: "Prove", role: "Duke" }, 11, rng),
      4,
    ),
    matchRevision: 1,
  };
  let s = receive(initialPlayback, before, true);
  s = receive(s, after);
  s = read(s);
  const line = s.lines[s.cursor];
  expect(line.proof).toBe("Duke");
  expect(read(s)).toBe(s);
  s = playback(s, { type: "reveal", line });
  expect(s.room?.game?.stage).toBe("challenge");
  s = read(s);
  expect(s.moving).toBe(line);
  s = receive(s, after, true);
  expect(s.moving).toBe(line);
  expect(s.room?.game?.stage).toBe("challenge");
  expect(playback(s, { type: "next" })).toBe(s);
  expect(playback(s, { type: "delivered", line: { ...line } })).toBe(s);
  s = playback(s, { type: "delivered", line });
  expect(s.room?.game?.stage).toBe("loss");
  expect(s.room?.game?.legal[0].kind).toBe("Lose");
});

it("keeps Pass recorded in game.log without creating a table dialogue bubble", () => {
  const threeSeats = ["A", "B", "C"].map((id) => ({
    id,
    name: id,
    online: true,
  }));
  const snap3 = (game: Game, revision: number): RoomView => ({
    game: observe(game, "C"),
    revision,
    code: "ROOM",
    me: "C",
    host: "A",
    seats: threeSeats,
    config: game.config,
    cardTheme: game.cardTheme ?? "classic",
    serverTime: 100,
  });

  const start = deal(threeSeats, defaults, rng);
  const tax = play(start, "A", { kind: "Tax" }, 10, rng);
  const passB = play(tax, "B", { kind: "Pass" }, 20, rng);
  const passC = play(passB, "C", { kind: "Pass" }, 30, rng);

  // Start -> Tax played & read
  let s = receive(initialPlayback, snap3(start, 1), true);
  s = receive(s, snap3(tax, 2));
  s = read(s);
  expect(s.frames).toHaveLength(0);
  const linesBeforePass = s.lines.length;

  // B passes while C is still pending: recorded in log, no dialogue bubble, C immediately gets legal moves
  s = receive(s, snap3(passB, 3));
  expect(s.lines).toHaveLength(linesBeforePass);
  expect(s.frames).toHaveLength(0);
  expect(s.room?.revision).toBe(3);
  expect(s.room?.game?.log.some((e) => e.text === "B pass.")).toBe(true);
  expect(s.room?.game?.legal.some((m) => m.kind === "Pass")).toBe(true);

  // C passes to resolve Tax: C's Pass stays in log, dialogue jumps straight to "+3 koin dari Tax"
  s = receive(s, snap3(passC, 4));
  expect(s.lines).toHaveLength(linesBeforePass + 1);
  expect(s.lines[s.cursor].words).toContain("menerima 3 koin dari Tax");
  expect(s.lines.some((l) => l.words.includes("Saya pass"))).toBe(false);
  expect(s.latest?.game?.log.some((e) => e.text === "C pass.")).toBe(true);
});

it("immediately updates the prover's replaced hand on delivery even when challenger auto-eliminates in the same frame", () => {
  const snapA = (game: Game, revision: number): RoomView => ({
    game: observe(game, "A"),
    revision,
    code: "ROOM",
    me: "A",
    host: "A",
    seats,
    config: game.config,
    cardTheme: game.cardTheme ?? "classic",
    serverTime: 100,
  });

  const start = deal(seats, defaults, rng);
  start.players[0].hand = ["Duke", "Captain"];
  start.players[0].handArt = [0, 1];
  // B only has 1 live card left, so failed Challenge will emit Prove + B eliminated + A wins in ONE frame
  const dropped = start.players[1].hand.pop()!;
  start.players[1].handArt?.pop();
  start.players[1].revealed.push(dropped);
  start.players[1].revealedArt?.push(0);
  // Make sure deck has a different role on top after shuffle by filling deck with Contessa
  start.deck = start.deck.map(() => "Contessa");
  start.deckArt = start.deck.map((_, i) => i % 3);

  const tax = play(start, "A", { kind: "Tax" }, 10, rng);
  const challenged = play(tax, "B", { kind: "Challenge" }, 20, rng);
  const proved = play(challenged, "A", { kind: "Prove", role: "Duke" }, 30, rng);
  // Ensure rng picked Contessa (not Duke) so replacement actually changed slot 0
  expect(proved.players[0].hand[0]).toBe("Contessa");

  let s = receive(initialPlayback, snapA(challenged, 3), true);
  s = receive(s, snapA(proved, 4));
  // Frame contains Prove + B eliminated + A wins -> cursor < frame.end
  expect(s.frames).toHaveLength(1);
  expect(s.frames[0].end).toBeGreaterThan(s.cursor);

  const proveLine = s.lines[s.cursor];
  expect(proveLine.move?.kind).toBe("replace");
  expect(s.room?.game?.hand).toEqual(["Duke", "Captain"]);

  // Reveal proof -> read -> start deck replacement flight
  s = playback(s, { type: "reveal", line: proveLine });
  s = playback(s, { type: "read", line: proveLine });
  expect(s.moving).toBe(proveLine);

  // Delivery finishes while B's elimination & winner lines are still queued:
  // A's hand MUST already be Contessa (never revert to Duke!), while winner stays hidden until final line.
  s = playback(s, { type: "delivered", line: proveLine });
  expect(s.moving).toBeUndefined();
  expect(s.frames).toHaveLength(1);
  expect(s.room?.game?.hand).toEqual(["Contessa", "Captain"]);
  expect(s.room?.game?.winner).toBeUndefined();

  // Finish reading B's elimination + winner
  const elimLine = s.lines[s.cursor];
  s = playback(s, { type: "reveal", line: elimLine });
  s = playback(s, { type: "read", line: elimLine });
  s = playback(s, { type: "read", line: s.lines[s.cursor] });
  expect(s.frames).toHaveLength(0);
  expect(s.room?.game?.winner).toBe("A");
  expect(s.room?.game?.hand).toEqual(["Contessa", "Captain"]);
});
