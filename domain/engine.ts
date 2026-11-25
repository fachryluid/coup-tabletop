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
function clockwiseOthers(g: Game, fromId: string): string[] {
  const start = g.players.findIndex((p) => p.id === fromId);
  const ids: string[] = [];
  for (let i = 1; i < g.players.length; i++) {
    const q = g.players[(start + i) % g.players.length];
    if (q.hand.length) ids.push(q.id);
  }
  return ids;
}
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
    case "exchange":
      return [g.turn];
    default:
      return windows.includes(g.stage) ? g.pending.slice(0, 1) : [...g.pending];
  }
}
export function legal(g: Game, id: string): Move[] {
  const p = player(g, id);
  if (!p?.hand.length || g.paused !== null) return [];
  if (g.stage !== "turn" && !eligibleResponders(g).includes(id)) return [];
  if (g.stage === "loss" || g.stage === "claimResponse") {
    const claimed =
      g.stage === "claimResponse"
        ? (g.blocker?.role ?? claims[g.action!.kind as keyof typeof claims]!)
        : undefined;
    const moves: Move[] = [...new Set(p.hand)]
      .filter((role) => role !== claimed)
      .map((role) => ({
        kind: "Lose",
        role,
      }));
    if (claimed && p.hand.includes(claimed))
      moves.unshift({ kind: "Prove", role: claimed });
    return moves;
  }
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
  const coups: Move[] = others.flatMap((q) =>
    Array.from({ length: q.hand.length }, (_, slot) => ({
      kind: "Coup" as const,
      target: q.id,
      slot,
    })),
  );
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
function alignArt(cards: Role[], arts?: number[]): number[] {
  return cards.map((_, i) => arts?.[i] ?? 0);
}
function shuffleDeckWithArt(
  deck: Role[],
  deckArt: number[] | undefined,
  extra: { role: Role; art: number }[],
  rng: () => number,
) {
  const pairs = [
    ...deck.map((role, i) => ({ role, art: deckArt?.[i] ?? 0 })),
    ...extra,
  ];
  shuffle(pairs, rng);
  return {
    deck: pairs.map((c) => c.role),
    deckArt: pairs.map((c) => c.art),
  };
}
function cloneGame(state: Game): Game {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      handArt: alignArt(p.hand, p.handArt),
      revealed: [...p.revealed],
      revealedArt: alignArt(p.revealed, p.revealedArt),
    })),
    deck: [...state.deck],
    deckArt: alignArt(state.deck, state.deckArt),
    config: { ...state.config },
    action: state.action
      ? {
          ...state.action,
          ...(state.action.indices ? { indices: [...state.action.indices] } : {}),
        }
      : undefined,
    blocker: state.blocker ? { ...state.blocker } : undefined,
    pending: [...state.pending],
    loss: state.loss ? { ...state.loss } : undefined,
    pool: [...state.pool],
    poolArt: alignArt(state.pool, state.poolArt),
    log: [...state.log],
    undo: state.undo ? { ...state.undo } : undefined,
  };
}
function markResolved(g: Game) {
  const last = g.log.length - 1;
  if (last >= 0) g.log[last] = { ...g.log[last], status: "resolved" };
}
function finish(g: Game) {
  markResolved(g);
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
    switched: false,
  });
}
export function switchCards(state: Game, id: string): Game {
  if (state.paused !== null) throw Error("Permainan sedang dijeda.");
  if (state.stage !== "turn" || state.turn !== id)
    throw Error(
      "Menukar posisi kartu hanya bisa dilakukan pada giliran Anda sebelum memilih aksi.",
    );
  const current = player(state, id);
  if (!current || current.hand.length !== 2)
    throw Error(
      "Menukar posisi kartu hanya tersedia jika Anda masih memiliki 2 kartu.",
    );
  if (state.switched)
    throw Error("Anda sudah menukar posisi kartu pada giliran ini.");
  const g = cloneGame(state);
  const p = player(g, id);
  p.hand = [p.hand[1], p.hand[0]];
  const arts = alignArt(p.hand, p.handArt);
  p.handArt = [arts[1], arts[0]];
  g.switched = true;
  g.undo = undefined;
  record(g, {
    text: p.name + " menukar posisi kartunya.",
    cardSwap: id,
  });
  return g;
}
function open(g: Game, stage: Stage, ids: string[], now: number) {
  Object.assign(g, {
    stage,
    pending: ids,
    deadline: g.config.timer ? now + 30000 : null,
  });
}
function reveal(
  g: Game,
  id: string,
  role: Role,
  spoken = false,
  slot?: number,
) {
  const p = player(g, id);
  const index =
    slot !== undefined && p.hand[slot] === role ? slot : p.hand.indexOf(role);
  const handArt = alignArt(p.hand, p.handArt);
  const revealedArt = alignArt(p.revealed, p.revealedArt);
  const art = handArt.splice(index, 1)[0] ?? 0;
  p.hand.splice(index, 1);
  p.handArt = handArt;
  p.revealed.push(role);
  revealedArt.push(art);
  p.revealedArt = revealedArt;
  record(g, {
    ...(spoken
      ? {
          discarded: role,
          proofArt: art,
          ...(slot !== undefined ? { proofSlot: slot } : {}),
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
    markResolved(g);
    return true;
  }
  return false;
}
function lose(g: Game, id: string, next: Continuation) {
  const p = player(g, id);
  if (p.hand.length === 1) {
    if (!reveal(g, id, p.hand[0], true)) advance(g, next);
    return;
  }
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
      record(g, {
        text: actor.name + " menerima 3 koin dari Tax.",
        coinMove: { from: "bank", to: actor.id, amount: 3 },
      });
      break;
    case "Foreign Aid":
      actor.coins += 2;
      record(g, {
        text: actor.name + " menerima 2 koin dari Foreign Aid.",
        coinMove: { from: "bank", to: actor.id, amount: 2 },
      });
      break;
    case "Steal": {
      const n = Math.min(2, victim!.coins);
      victim!.coins -= n;
      actor.coins += n;
      record(g, {
        text:
          actor.name + " mengambil " + n + " koin dari " + victim!.name + ".",
        ...(n > 0
          ? { coinMove: { from: victim!.id, to: actor.id, amount: n } }
          : {}),
      });
      break;
    }
    case "Assassinate":
      return lose(g, victim!.id, "finish");
    case "Coup": {
      const slot = g.action!.slot ?? 0;
      const role = victim!.hand[slot];
      if (!reveal(g, victim!.id, role, true, slot)) finish(g);
      return;
    }
    case "Exchange": {
      g.stage = "exchange";
      const drawnArts = alignArt(g.deck, g.deckArt).splice(0, 2);
      const drawnRoles = g.deck.splice(0, 2);
      g.deckArt = alignArt(g.deck, g.deckArt?.slice(2));
      g.pool = [...actor.hand, ...drawnRoles];
      g.poolArt = [...alignArt(actor.hand, actor.handArt), ...drawnArts];
      record(g, {
        text: actor.name + " mengambil dua kartu untuk Exchange.",
        deckMove: { seat: actor.id, kind: "drawTwo" },
      });
      return;
    }
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
  const g = cloneGame(state);
  record(g, { text: host + " mengakhiri pertandingan tanpa pemenang." });
  if (g.action) markResolved(g);
  if (g.stage === "exchange") {
    const keepCount = player(g, g.turn).hand.length;
    g.deck.push(...g.pool.slice(keepCount));
    g.deckArt = [
      ...alignArt(g.deck.slice(0, g.deck.length - (g.pool.length - keepCount)), g.deckArt),
      ...alignArt(g.pool, g.poolArt).slice(keepCount),
    ];
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
    poolArt: [],
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
  const g = cloneGame(state);
  if (host) {
    record(g, {
      text:
        host +
        " menutup fase. Pass: " +
        g.pending.map((id) => player(g, id).name).join(", "),
    });
    close(g);
  } else {
    const timedOut = g.pending.shift()!;
    record(g, {
      text: "Timer menutup fase. Pass: " + player(g, timedOut).name,
    });
    if (!g.pending.length) close(g);
    else g.deadline = now + 30000;
  }
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
      x.role === request.role &&
      x.target === request.target &&
      x.slot === request.slot &&
      JSON.stringify(x.indices) === JSON.stringify(request.indices),
  );
  if (!m) throw Error("Pilihan tidak sah untuk fase ini.");
  const g = cloneGame(state),
    p = player(g, id);
  g.undo = undefined;
  if (g.stage === "loss") {
    const next = g.loss!.next;
    g.loss = undefined;
    if (!reveal(g, id, m.role!, true)) advance(g, next);
  } else if (g.stage === "exchange") {
    const poolArt = alignArt(g.pool, g.poolArt);
    p.hand = g.pool.filter((_, i) => m.indices!.includes(i));
    p.handArt = poolArt.filter((_, i) => m.indices!.includes(i));
    const returned = g.pool
      .map((role, i) => ({ role, art: poolArt[i] }))
      .filter((_, i) => !m.indices!.includes(i));
    const mixed = shuffleDeckWithArt(g.deck, g.deckArt, returned, rng);
    g.deck = mixed.deck;
    g.deckArt = mixed.deckArt;
    g.pool = [];
    g.poolArt = [];
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
      silent: true,
    });
    g.pending = g.pending.filter((x) => x !== id);
    if (!g.pending.length) close(g);
    else if (g.config.timer) g.deadline = now + 30000;
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
    if (claimant.hand.length === 1 && !claimant.hand.includes(role)) {
      record(g, {
        text:
          claimant.name +
          " gagal membuktikan klaim. " +
          g.action!.kind +
          " dibatalkan.",
      });
      if (!reveal(g, claimant.id, claimant.hand[0], true)) finish(g);
    } else {
      g.stage = "claimResponse";
      g.pending = [claimant.id];
      g.challenger = id;
      g.deadline = null;
    }
  } else if (g.stage === "claimResponse") {
    const challenger = player(g, g.challenger!);
    g.challenger = undefined;
    g.pending = [];
    if (m.kind === "Prove") {
      const role = m.role!;
      const slot = p.hand.indexOf(role);
      const handArt = alignArt(p.hand, p.handArt);
      const provenArt = handArt[slot] ?? 0;
      const mixed = shuffleDeckWithArt(
        g.deck,
        g.deckArt,
        [{ role, art: provenArt }],
        rng,
      );
      g.deck = mixed.deck;
      g.deckArt = mixed.deckArt;
      p.hand[slot] = g.deck.pop()!;
      handArt[slot] = g.deckArt.pop() ?? 0;
      p.handArt = handArt;
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
        proofSlot: slot,
        proofArt: provenArt,
        deckMove: { seat: id, kind: "replace", slot },
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
    const targetPlayer = m.target ? player(g, m.target) : undefined;
    const coinMove =
      m.kind === "Income"
        ? { from: "bank", to: id, amount: 1 }
        : m.kind === "Coup"
          ? { from: id, to: "bank", amount: 7 }
          : m.kind === "Assassinate"
            ? { from: id, to: "bank", amount: 3 }
            : undefined;
    const slotTag =
      targetPlayer && (m.kind === "Guess" || (m.kind === "Coup" && targetPlayer.hand.length > 1))
        ? " [" +
          (targetPlayer.hand.length === 1
            ? "kartu terakhir"
            : m.slot === 1
              ? "kanan"
              : "kiri") +
          "]"
        : "";
    record(g, {
      speech: {
        by: id,
        words: declaration(m, targetPlayer?.name, targetPlayer?.hand.length),
      },
      text:
        p.name +
        " memilih " +
        m.kind +
        (targetPlayer ? " → " + targetPlayer.name : "") +
        slotTag +
        (m.role ? " (" + m.role + ")" : ""),
      actor: id,
      role,
      evidence: role ? "claim" : undefined,
      ...(coinMove ? { coinMove } : {}),
    });
    if (m.kind === "Income") {
      finish(g);
    } else if (m.kind === "Guess") {
      p.used = true;
      const victim = targetPlayer!;
      const slot = m.slot!;
      const actual = victim.hand[slot];
      const victimArt = alignArt(victim.hand, victim.handArt);
      const actualArt = victimArt[slot] ?? 0;
      const hit = oneTimeGuess.matches(victim, slot, m.role!);
      if (hit) {
        const words =
          "Tebakan " + p.name + " benar. Kartu ini memang " + actual + ".";
        record(g, {
          text:
            victim.name +
            " membuka " +
            actual +
            ". Tebakan " +
            p.name +
            " benar.",
          speech: { by: victim.id, words },
          revealedGuess: actual,
          proofSlot: slot,
          proofArt: actualArt,
        });
        record(g, {
          text: "Tebakan " + p.name + " benar.",
        });
        if (!reveal(g, victim.id, actual, false, slot)) finish(g);
      } else {
        const mixed = shuffleDeckWithArt(
          g.deck,
          g.deckArt,
          [{ role: actual, art: actualArt }],
          rng,
        );
        g.deck = mixed.deck;
        g.deckArt = mixed.deckArt;
        victim.hand[slot] = g.deck.pop()!;
        victimArt[slot] = g.deckArt.pop() ?? 0;
        victim.handArt = victimArt;
        const words =
          "Tebakan " +
          p.name +
          " salah. Kartu ini " +
          actual +
          ", bukan " +
          m.role +
          ".";
        record(g, {
          text:
            victim.name +
            " membuka " +
            actual +
            " lalu menggantinya dari dek. Tebakan " +
            p.name +
            " salah.",
          speech: { by: victim.id, words },
          actor: victim.id,
          role: actual,
          evidence: "proof",
          proofSlot: slot,
          proofArt: actualArt,
          deckMove: { seat: victim.id, kind: "replace", slot },
        });
        record(g, {
          text: "Tebakan " + p.name + " salah.",
        });
        lose(g, p.id, "finish");
      }
    } else {
      if (role)
        open(
          g,
          m.kind === "Tax" && g.config.duke_blocks_tax
            ? "taxResponse"
            : "challenge",
          m.target ? [m.target] : clockwiseOthers(g, id),
          now,
        );
      else if (m.kind === "Foreign Aid")
        open(g, "block", clockwiseOthers(g, id), now);
      else advance(g, "resolve");
    }
  }
  return g;
}
