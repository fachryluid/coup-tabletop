import { declaration } from "./speech";
import {
  record,
  claims,
  shuffle,
  windows,
  type Game,
  type Move,
  type Role,
  type Stage,
  type Continuation,
} from "./model";
import { oneTimeGuess } from "./house-rules";
export const player = (g: Game, id: string) =>
  g.players.find((p) => p.id === id)!;
const living = (g: Game) => g.players.filter((p) => p.hand.length);
const target = (g: Game) =>
  g.action?.target ? player(g, g.action.target) : undefined;
function blockRoles(g: Game): Role[] {
  switch (g.action?.kind) {
    case "Foreign Aid":
      return ["Duke"];
    case "Assassinate":
      return ["Contessa"];
    case "Steal":
      return ["Ambassador", "Captain"];
    default:
      return [];
  }
}
export function eligibleResponders(g: Game): string[] {
  if (g.paused !== null) return [];
  switch (g.stage) {
    case "loss":
      return [g.loss!.id];
    case "guessAnswer":
      return [g.action!.target!];
    case "exchange":
      return [g.turn];
    default:
      return [...g.pending];
  }
}
export function legal(g: Game, id: string): Move[] {
  const p = player(g, id);
  if (!p?.hand.length || g.paused !== null) return [];
  if (g.stage !== "turn" && !eligibleResponders(g).includes(id)) return [];
  if (g.stage === "loss" || g.stage === "claimResponse") {
    const moves: Move[] = [...new Set(p.hand)].map((role) => ({
      kind: "Lose",
      role,
    }));
    if (g.stage === "claimResponse") {
      const role =
        g.blocker?.role ?? claims[g.action!.kind as keyof typeof claims]!;
      if (p.hand.includes(role)) moves.unshift({ kind: "Prove", role });
    }
    return moves;
  }
  if (g.stage === "guessAnswer")
    return [
      {
        kind: "ConfirmGuess",
        answer: oneTimeGuess.matches(p, g.action!.role!),
      },
    ];
  if (g.stage === "exchange") {
    return g.pool.flatMap((_, i) =>
      p.hand.length === 1
        ? [{ kind: "Keep" as const, indices: [i] }]
        : g.pool.slice(i + 1).map((_, j) => ({
            kind: "Keep" as const,
            indices: [i, i + j + 1],
          })),
    );
  }
  if (windows.includes(g.stage)) {
    if (g.stage === "taxResponse")
      return [
        { kind: "Pass" },
        { kind: "Challenge" },
        { kind: "Block", role: "Duke" },
      ];
    const responses: Move[] = [{ kind: "Pass" }];
    if (g.stage !== "block") responses.push({ kind: "Challenge" });
    if (g.stage !== "blockChallenge")
      responses.push(
        ...blockRoles(g).map((role) => ({ kind: "Block" as const, role })),
      );
    return responses;
  }
  if (g.stage !== "turn" || g.turn !== id) return [];
  const others = living(g).filter((q) => q.id !== id);
  const coups: Move[] = others.map((q) => ({ kind: "Coup", target: q.id }));
  if (p.coins >= 10) return coups;
  const moves: Move[] = [
    { kind: "Income" },
    { kind: "Foreign Aid" },
    { kind: "Tax" },
    { kind: "Exchange" },
  ];
  if (p.coins >= 7) moves.push(...coups);
  for (const q of others) {
    moves.push({ kind: "Steal", target: q.id });
    if (p.coins >= 3) moves.push({ kind: "Assassinate", target: q.id });
    moves.push(...oneTimeGuess.moves(g.config, p, q));
  }
  return moves;
}
function finish(g: Game) {
  g.log[g.log.length - 1].status = "resolved";
  g.actionNumber++;
  const index = g.players.findIndex((p) => p.id === g.turn);
  for (let i = 1; i <= g.players.length; i++) {
    const next = g.players[(index + i) % g.players.length];
    if (next.hand.length) {
      g.turn = next.id;
      break;
    }
  }
  Object.assign(g, {
    stage: "turn",
    action: undefined,
    blocker: undefined,
    pending: [],
    deadline: null,
    loss: undefined,
  });
}
function open(g: Game, stage: Stage, ids: string[], now: number) {
  Object.assign(g, {
    stage,
    pending: ids,
    deadline: g.config.timer ? now + 30000 : null,
  });
}
function reveal(g: Game, id: string, role: Role, spoken = false) {
  const p = player(g, id);
  p.hand.splice(p.hand.indexOf(role), 1);
  p.revealed.push(role);
  record(g, {
    ...(spoken
      ? {
          discarded: role,
          speech: {
            by: id,
            words:
              declaration({ kind: "Lose", role }) +
              (p.hand.length ? "" : " Saya tereliminasi."),
          },
        }
      : {}),
    text:
      p.name +
      " kehilangan " +
      role +
      (p.hand.length ? "." : " dan tereliminasi."),
  });
  const survivors = living(g);
  if (survivors.length === 1) {
    Object.assign(g, {
      stage: "over",
      winner: survivors[0].id,
      pending: [],
      deadline: null,
      loss: undefined,
    });
    record(g, { text: survivors[0].name + " menang." });
    g.log[g.log.length - 1].status = "resolved";
    return true;
  }
  return false;
}
function lose(g: Game, id: string, next: Continuation) {
  Object.assign(g, {
    stage: "loss",
    loss: { id, next },
    deadline: null,
    pending: [],
  });
}
function advance(g: Game, next: Continuation) {
  const actor = player(g, g.turn),
    victim = target(g);
  if (next === "finish" || (victim && !victim.hand.length)) return finish(g);
  switch (g.action!.kind) {
    case "Tax":
      actor.coins += 3;
      record(g, { text: actor.name + " menerima 3 koin dari Tax." });
      break;
    case "Foreign Aid":
      actor.coins += 2;
      record(g, { text: actor.name + " menerima 2 koin dari Foreign Aid." });
      break;
    case "Steal": {
      const n = Math.min(2, victim!.coins);
      victim!.coins -= n;
      actor.coins += n;
      record(g, {
        text:
          actor.name + " mengambil " + n + " koin dari " + victim!.name + ".",
      });
      break;
    }
    case "Assassinate":
    case "Coup":
      return lose(g, victim!.id, "finish");
    case "Exchange":
      g.stage = "exchange";
      g.pool = [...actor.hand, ...g.deck.splice(0, 2)];
      record(g, {
        text: actor.name + " mengambil dua kartu untuk Exchange.",
        deckMove: { seat: actor.id, kind: "drawTwo" },
      });
      return;
  }
  finish(g);
}
function close(g: Game) {
  const next = g.stage === "blockChallenge" ? "finish" : "resolve";
  if (g.stage === "blockChallenge")
    record(g, { text: "Blok diterima. Aksi dibatalkan." });
  g.pending = [];
  g.deadline = null;
  advance(g, next);
}
export function endMatch(state: Game, host: string): Game {
  if (state.stage === "over") throw Error("Pertandingan telah selesai.");
  const g = structuredClone(state);
  record(g, { text: host + " mengakhiri pertandingan tanpa pemenang." });
  if (g.action) g.log[g.log.length - 1].status = "resolved";
  if (g.stage === "exchange") {
    g.deck.push(...g.pool.slice(player(g, g.turn).hand.length));
  }
  Object.assign(g, {
    stage: "over",
    paused: null,
    deadline: null,
    pending: [],
    action: undefined,
    blocker: undefined,
    loss: undefined,
    undo: undefined,
    pool: [],
  });
  return g;
}
export function closeWindow(state: Game, now: number, host?: string) {
  if (
    !windows.includes(state.stage) ||
    state.paused !== null ||
    (host
      ? state.config.timer
      : state.deadline === null || now < state.deadline)
  )
    throw Error("Fase tidak bisa ditutup.");
  const g = structuredClone(state);
  record(g, {
    text:
      (host ?? "Timer") +
      " menutup fase. Pass: " +
      g.pending.map((id) => player(g, id).name).join(", "),
  });
  close(g);
  return g;
}
export function play(
  state: Game,
  id: string,
  request: Move,
  now: number,
  rng: () => number,
): Game {
  if (state.deadline !== null && now >= state.deadline)
    throw Error("Waktu respons habis.");
  const m = legal(state, id).find(
    (x) =>
      x.kind === request.kind &&
      x.answer === request.answer &&
      x.role === request.role &&
      x.target === request.target &&
      JSON.stringify(x.indices) === JSON.stringify(request.indices),
  );
  if (!m) throw Error("Pilihan tidak sah untuk fase ini.");
  const g = structuredClone(state),
    p = player(g, id);
  g.undo = undefined;
  if (g.stage === "guessAnswer") {
    const guessed = g.action!.role!;
    const hit = oneTimeGuess.matches(p, guessed);
    const guesser = player(g, g.turn);
    const words = hit
      ? "Tebakan " + guesser.name + " benar. Saya memegang " + guessed + "."
      : "Tebakan " +
        guesser.name +
        " salah. Saya tidak memegang " +
        guessed +
        ".";
    record(g, {
      text: p.name + ": " + words,
      speech: { by: id, words },
      revealedGuess: hit ? guessed : undefined,
    });
    record(g, {
      text: "Tebakan " + guesser.name + (hit ? " benar." : " salah."),
    });
    if (!hit) lose(g, g.turn, "finish");
    else if (!reveal(g, id, guessed)) finish(g);
  } else if (g.stage === "loss") {
    const next = g.loss!.next;
    g.loss = undefined;
    if (!reveal(g, id, m.role!, true)) advance(g, next);
  } else if (g.stage === "exchange") {
    p.hand = g.pool.filter((_, i) => m.indices!.includes(i));
    g.deck = shuffle(
      [...g.deck, ...g.pool.filter((_, i) => !m.indices!.includes(i))],
      rng,
    );
    g.pool = [];
    record(g, {
      text: p.name + " selesai memilih kartu Exchange.",
      deckMove: { seat: id, kind: "returnTwo" },
      speech: { by: id, words: declaration(m) },
    });
    finish(g);
  } else if (m.kind === "Pass") {
    record(g, {
      text: p.name + " pass.",
      speech: { by: id, words: declaration(m) },
    });
    g.pending = g.pending.filter((x) => x !== id);
    if (!g.pending.length) close(g);
  } else if (m.kind === "Block") {
    g.blocker = { id, role: m.role! };
    record(g, {
      speech: { by: id, words: declaration(m) },
      text: p.name + " memblokir dengan " + m.role,
      blockedAction: g.action!.kind as keyof typeof claims,
      actor: id,
      role: m.role,
      evidence: "claim",
    });
    open(g, "blockChallenge", [g.turn], now);
  } else if (m.kind === "Challenge") {
    const blocking = g.stage === "blockChallenge";
    const claimant = player(g, blocking ? g.blocker!.id : g.turn);
    const role = blocking
      ? g.blocker!.role
      : claims[g.action!.kind as keyof typeof claims]!;

    record(g, {
      speech: {
        by: id,
        words: declaration(m, claimant.name) + " Tunjukkan " + role + ".",
      },
      text: p.name + " menantang " + claimant.name + ".",
    });
    g.stage = "claimResponse";
    g.pending = [claimant.id];
    g.challenger = id;
    g.deadline = null;
  } else if (g.stage === "claimResponse") {
    const challenger = player(g, g.challenger!);
    g.challenger = undefined;
    g.pending = [];
    if (m.kind === "Prove") {
      const role = m.role!;
      const slot = p.hand.indexOf(role);
      g.deck.push(role);
      shuffle(g.deck, rng);
      p.hand[slot] = g.deck.pop()!;
      record(g, {
        text:
          "Klaim " +
          role +
          " oleh " +
          p.name +
          " terbukti. " +
          g.action!.kind +
          " dibatalkan.",
        speech: {
          by: id,
          words:
            "Ini kartu " +
            role +
            " saya. Tantangan " +
            challenger.name +
            " gagal. " +
            g.action!.kind +
            " dibatalkan.",
        },
        actor: id,
        role,
        evidence: "proof",
        deckMove: { seat: id, kind: "replace" },
      });
      lose(g, challenger.id, "finish");
    } else {
      record(g, {
        text:
          p.name +
          " memilih tidak membuktikan klaim. " +
          g.action!.kind +
          " dibatalkan.",
      });
      if (!reveal(g, id, m.role!, true)) finish(g);
    }
  } else {
    g.action = m;
    if (m.kind === "Income") {
      g.undo = { id, coins: p.coins };
      p.coins++;
    }
    if (m.kind === "Coup") p.coins -= 7;
    if (m.kind === "Assassinate") p.coins -= 3;
    const role = claims[m.kind as keyof typeof claims];
    record(g, {
      speech: {
        by: id,
        words: declaration(m, m.target ? player(g, m.target).name : undefined),
      },
      text:
        p.name +
        " memilih " +
        m.kind +
        (m.target ? " → " + player(g, m.target).name : "") +
        (m.role ? " (" + m.role + ")" : ""),
      actor: id,
      role,
      evidence: role ? "claim" : undefined,
    });
    if (m.kind === "Income") {
      finish(g);
    } else if (m.kind === "Guess") {
      p.used = true;
      g.stage = "guessAnswer";
    } else {
      if (role)
        open(
          g,
          m.kind === "Tax" && g.config.duke_blocks_tax
            ? "taxResponse"
            : "challenge",
          m.target
            ? [m.target]
            : living(g)
                .filter((q) => q.id !== id)
                .map((q) => q.id),
          now,
        );
      else if (m.kind === "Foreign Aid")
        open(
          g,
          "block",
          living(g)
            .filter((q) => q.id !== id)
            .map((q) => q.id),
          now,
        );
      else advance(g, "resolve");
    }
  }
  return g;
}
