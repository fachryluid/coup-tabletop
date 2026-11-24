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
  const guess = play(
    start,
    "A",
    { kind: "Guess", target: "B", role: start.players[1].hand[0] },
    0,
    rng,
  );
  const final = play(
    guess,
    "B",
    { kind: "ConfirmGuess", answer: true },
    1,
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
