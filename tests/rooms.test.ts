import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Tables, MemoryRooms, type Command } from "../server/rooms";
let tables: Tables;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  tables = new Tables(
    new MemoryRooms(),
    () => {},
    undefined,
    undefined,
    () => 0,
  );
});
afterEach(() => {
  tables.dispose();
  vi.useRealTimers();
});
function room() {
  const a = tables.create("A"),
    r = a.room,
    b = tables.admit(r, "B");
  const cmd = (c: Command, id = a.id) =>
    tables.execute(
      r,
      id,
      r.revision,
      c,
      r.game && tables.view(r, id).game!.context,
    );
  return { a, b, r, cmd };
}
it("checks capacity, level per seat, start and session binding", () => {
  const { r, a, b, cmd } = room();
  for (let i = 0; i < 4; i++) cmd({ type: "add" });
  expect(() => cmd({ type: "add" })).toThrow();
  expect(() => tables.admit(r, "C")).toThrow();
  const bot = r.seats[2];
  expect(bot.difficulty).toBe("normal");
  cmd({ type: "level", id: bot.id, value: "hard" });
  cmd({ type: "start" });
  expect(r.game!.players[2].difficulty).toBe("hard");
  expect(() => cmd({ type: "level", id: bot.id, value: "easy" })).toThrow();
  expect(() => tables.restore(r.code, b.id)).toThrow();
  expect(tables.restore(r.code, a.token).id).toBe(a.id);
  expect(() =>
    tables.restore(tables.create("Other").room.code, a.token),
  ).toThrow();
  const view = tables.view(r, b.id);
  expect(view.game!.players.every((p) => !("hand" in p))).toBe(true);
  for (const secret of [a.token, b.token, '"deck"'])
    expect(JSON.stringify(view)).not.toContain(secret);
});
it("rejects all non-host controls, duplicate revision and unsafe undo", () => {
  const { b, a, r, cmd } = room();
  cmd({ type: "start" });
  for (const type of ["pause", "resume", "close", "undo", "rematch"] as const)
    expect(() => cmd({ type }, b.id)).toThrow("host");
  expect(() =>
    cmd({ type: "coins", id: a.id, value: 4, reason: "x" }, b.id),
  ).toThrow("host");
  const revision = r.revision;
  cmd({ type: "play", move: { kind: "Income" } });
  expect(() =>
    tables.execute(r, a.id, revision, {
      type: "play",
      move: { kind: "Income" },
    }),
  ).toThrow();
  cmd({ type: "undo" });
  expect(r.game!.players[0].coins).toBe(2);
  expect(r.game!.turn).toBe(a.id);
  cmd({ type: "coins", id: a.id, value: 7, reason: "Kesepakatan meja" });
  expect(r.game!.log.at(-1)!.text).toContain("dari 2 menjadi 7");
  cmd({ type: "play", move: { kind: "Coup", target: b.id } });
  cmd(
    { type: "play", move: { kind: "Lose", role: r.game!.players[1].hand[0] } },
    b.id,
  );
  expect(() => cmd({ type: "undo" })).toThrow();
});
it.each([false, true])(
  "offline player and paused window honor timer %s",
  (timer) => {
    const { r, cmd, b } = room();
    cmd({ type: "setting", key: "timer", value: timer });
    cmd({ type: "start" });
    cmd({ type: "play", move: { kind: "Tax" } });
    vi.advanceTimersByTime(12000);
    cmd({ type: "pause" });
    vi.advanceTimersByTime(90000);
    expect(r.game!.stage).toBe("challenge");
    cmd({ type: "resume" });
    vi.advanceTimersByTime(17999);
    expect(r.game!.stage).toBe("challenge");
    vi.advanceTimersByTime(1);
    if (!timer) {
      expect(r.game!.pending).toContain(b.id);
      cmd({ type: "close" });
      expect(
        r.game!.log.some((e) => e.text.includes("A menutup fase. Pass: B")),
      ).toBe(true);
    }
    expect(r.game!.turn).toBe(b.id);
    vi.advanceTimersByTime(100000);
    expect(r.game!.turn).toBe(b.id);
  },
);
it("suspends bot tasks on pause and waits for offline human decisions", () => {
  const { r, cmd, b } = room();
  cmd({ type: "add" });
  cmd({ type: "start" });
  cmd({ type: "play", move: { kind: "Tax" } });
  // Clockwise: human B responds first; bot waits until B passes
  const beforePass = r.revision;
  vi.advanceTimersByTime(10000);
  expect(r.revision).toBe(beforePass);
  cmd({ type: "play", move: { kind: "Pass" } }, b.id);
  cmd({ type: "pause" });
  const rev = r.revision;
  vi.advanceTimersByTime(10000);
  expect(r.revision).toBe(rev);
  cmd({ type: "resume" });
  vi.advanceTimersByTime(5000);
  expect(r.revision).toBeGreaterThan(rev + 1);
  expect(
    r.game!.turn === b.id || r.game!.stage === "claimResponse",
  ).toBe(true);
});

it("draws the opening seat and credits a win once before a direct rematch", () => {
  const tables = new Tables(
    new MemoryRooms(),
    () => {},
    100,
    undefined,
    (size) => size - 1,
  );
  const { room, id: host } = tables.create("A", { one_time_guess: true });
  const { id: guest, token } = tables.admit(room, "B");
  const cmd = (id: string, c: Command) =>
    tables.execute(
      room,
      id,
      room.revision,
      c,
      tables.view(room, id).game?.context,
    );
  try {
    cmd(host, { type: "start" });
    expect(room.game!.turn).toBe(guest);
    cmd(guest, { type: "play", move: { kind: "Income" } });
    const target = room.game!.players[1];
    target.revealed.push(target.hand.pop()!);
    cmd(host, {
      type: "play",
      move: { kind: "Guess", target: guest, slot: 0, role: target.hand[0] },
    });
    expect(room.game!.winner).toBe(host);
    const firstMatch = room.matchRevision;
    cmd(host, { type: "again" });
    expect(room.matchRevision).not.toBe(firstMatch);
    expect(room.game!.turn).toBe(host);
    expect(
      room.game!.players.every(
        (p) => !p.used && p.hand.length === 2 && p.coins === 2,
      ),
    ).toBe(true);
    const restored = tables.restore(room.code, token);
    expect(
      tables
        .view(restored.room, guest)
        .leaderboard?.map((p) => [p.name, p.wins]),
    ).toEqual([
      ["A", 1],
      ["B", 0],
    ]);
    expect(() => cmd(host, { type: "again" })).toThrow();
  } finally {
    tables.dispose();
  }
});

it.each([false, true])(
  "host ends a pending match with paused=%s and scheduled work stops",
  (paused) => {
    const { a, b, r, cmd } = room();
    cmd({ type: "add" });
    cmd({ type: "setting", key: "timer", value: true });
    cmd({ type: "start" });
    cmd({ type: "play", move: { kind: "Tax" } });
    if (paused) cmd({ type: "pause" });
    const before = tables.view(r, b.id);
    expect(() => cmd({ type: "endMatch" }, b.id)).toThrow("host");
    cmd({ type: "endMatch" });
    const after = tables.view(r, b.id);
    expect(after.game).toMatchObject({
      stage: "over",
      deadline: null,
      paused: null,
      legal: [],
      pending: [],
    });
    expect(after.game!.winner).toBeUndefined();
    expect(after.game!.log.at(-1)?.text).toBe(
      "A mengakhiri pertandingan tanpa pemenang.",
    );
    expect(after.leaderboard).toEqual(before.leaderboard);
    expect(() =>
      tables.execute(
        r,
        b.id,
        before.revision,
        { type: "play", move: { kind: "Pass" } },
        before.game!.context,
      ),
    ).toThrow();
    expect(() => cmd({ type: "endMatch" })).toThrow();
    vi.advanceTimersByTime(60000);
    expect(r.revision).toBe(after.revision);
    expect(
      tables.view(tables.restore(r.code, a.token).room, a.id).game!.stage,
    ).toBe("over");
    cmd({ type: "again" });
    expect(r.game!.stage).toBe("turn");
  },
);

it("host can toggle extra rules ON/OFF in lobby, non-host cannot, and rules lock during match", () => {
  const { b, r, cmd } = room();
  expect(r.config).toEqual({
    timer: false,
    one_time_guess: false,
    duke_blocks_tax: false,
  });
  expect(() =>
    cmd({ type: "setting", key: "one_time_guess", value: true }, b.id),
  ).toThrow("host");
  cmd({ type: "setting", key: "one_time_guess", value: true });
  cmd({ type: "setting", key: "duke_blocks_tax", value: true });
  expect(r.config.one_time_guess).toBe(true);
  expect(r.config.duke_blocks_tax).toBe(true);
  cmd({ type: "setting", key: "duke_blocks_tax", value: false });
  expect(r.config.duke_blocks_tax).toBe(false);
  expect(() =>
    cmd(
      {
        type: "rules",
        values: { one_time_guess: true, duke_blocks_tax: true },
      },
      b.id,
    ),
  ).toThrow("host");
  cmd({
    type: "rules",
    values: { one_time_guess: true, duke_blocks_tax: false },
  });
  expect(r.config.one_time_guess).toBe(true);
  expect(r.config.duke_blocks_tax).toBe(false);
  cmd({ type: "start" });
  expect(() =>
    cmd({
      type: "rules",
      values: { one_time_guess: false, duke_blocks_tax: false },
    }),
  ).toThrow("terkunci");
  expect(() =>
    cmd({ type: "setting", key: "one_time_guess", value: false }),
  ).toThrow("terkunci");
  expect(r.game!.config.one_time_guess).toBe(true);
  expect(r.game!.config.duke_blocks_tax).toBe(false);
  cmd({ type: "endMatch" });
  cmd({ type: "rematch" });
  cmd({ type: "setting", key: "one_time_guess", value: false });
  expect(r.config.one_time_guess).toBe(false);
});

it("players can rename themselves in lobby with uniqueness check and match lock", () => {
  const { a, b, r, cmd } = room();
  cmd({ type: "rename", name: "Host Baru" });
  expect(r.seats.find((s) => s.id === a.id)?.name).toBe("Host Baru");
  cmd({ type: "rename", name: "Tamu Baru" }, b.id);
  expect(r.seats.find((s) => s.id === b.id)?.name).toBe("Tamu Baru");
  // Duplicate name (case-insensitive) against another seat is rejected
  expect(() => cmd({ type: "rename", name: "tamu baru" })).toThrow("digunakan");
  // Changing own casing is allowed
  cmd({ type: "rename", name: "host baru" });
  expect(r.seats.find((s) => s.id === a.id)?.name).toBe("host baru");
  // Locked once match starts
  cmd({ type: "start" });
  expect(() => cmd({ type: "rename", name: "Terkunci" })).toThrow(
    "berlangsung",
  );
  // Editable again after returning to lobby
  cmd({ type: "endMatch" });
  cmd({ type: "rematch" });
  cmd({ type: "rename", name: "Host Lagi" });
  expect(r.seats.find((s) => s.id === a.id)?.name).toBe("Host Lagi");
});
