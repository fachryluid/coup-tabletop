import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { z } from "zod";
import {
  phaseStamp,
  record,
  type PhaseStamp,
  deal,
  defaults,
  roles,
  type Config,
  type Game,
  type Seat,
} from "../domain/model";
import {
  play,
  switchCards,
  endMatch,
  closeWindow,
  player,
  legal,
} from "../domain/engine";
import { observe, type RoomView } from "../domain/view";
import { decide, supportedRules } from "../domain/bot";
import { rules } from "../domain/house-rules";
import { cardThemeIds, type CardThemeId } from "../domain/card-themes";

export const nick = z.string().trim().min(1).max(32);
const move = z
  .object({
    kind: z.enum([
      "Income",
      "Foreign Aid",
      "Tax",
      "Coup",
      "Assassinate",
      "Steal",
      "Exchange",
      "Guess",
      "Pass",
      "Challenge",
      "Prove",
      "Block",
      "Lose",
      "Keep",
    ]),
    role: z.enum(roles).optional(),
    target: z.string().optional(),
    slot: z.number().int().min(0).max(1).optional(),
    indices: z.array(z.number().int()).max(2).optional(),
  })
  .strict();
export const command = z.discriminatedUnion("type", [
  z.object({
    type: z.enum([
      "start",
      "rematch",
      "again",
      "endMatch",
      "add",
      "pause",
      "resume",
      "undo",
      "close",
      "leave",
      "switch",
    ]),
  }),
  z.object({ type: z.literal("remove"), id: z.string() }),
  z.object({ type: z.literal("rename"), name: nick }),
  z.object({
    type: z.literal("level"),
    id: z.string(),
    value: z.enum(["easy", "normal", "hard"]),
  }),
  z.object({
    type: z.literal("theme"),
    value: z.enum(cardThemeIds),
  }),
  z.object({
    type: z.literal("setting"),
    key: z.enum(["timer", "one_time_guess", "duke_blocks_tax"]),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal("rules"),
    values: z
      .object({
        one_time_guess: z.boolean(),
        duke_blocks_tax: z.boolean(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("coins"),
    id: z.string(),
    value: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 10),
    reason: z.string().trim().min(1).max(160),
  }),
  z.object({ type: z.literal("play"), move }),
]);
export type Command = z.infer<typeof command>;
export interface Room {
  code: string;
  host: string;
  seats: Seat[];
  tokens: Map<string, string>;
  online: Map<string, string>;
  config: Config;
  cardTheme: CardThemeId;
  revision: number;
  game?: Game;
  matchRevision?: number;
  wins: Map<string, { id: string; name: string; wins: number }>;
  previousWinner?: string;
  botNumber: number;
}
export interface RoomRepository {
  get(code: string): Room | undefined;
  save(room: Room): void;
}
export class MemoryRooms implements RoomRepository {
  private rooms = new Map<string, Room>();
  get(code: string) {
    return this.rooms.get(code);
  }
  save(room: Room) {
    this.rooms.set(room.code, room);
  }
}
const random = () => randomInt(0x100000000) / 0x100000000;
export class Tables {
  private jobs = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private repo: RoomRepository,
    private notify: (room: Room) => void,
    private delay = 5000,
    private rng = random,
    private firstSeat: (size: number) => number = randomInt,
  ) {}
  create(name: string, houseRules: Partial<Omit<Config, "timer">> = {}) {
    let code: string;
    do {
      code = randomBytes(5).toString("hex").toUpperCase();
    } while (this.repo.get(code));
    const host = randomUUID();
    const room: Room = {
      code,
      host,
      seats: [],
      tokens: new Map(),
      online: new Map(),
      config: { ...defaults, ...houseRules },
      cardTheme: "classic",
      wins: new Map(),
      revision: 0,
      botNumber: 0,
    };
    return this.admit(room, name, host);
  }
  find(code: string) {
    const room = this.repo.get(code);
    if (!room) throw Error("Room tidak ditemukan.");
    return room;
  }
  admit(room: Room, name: string, id: string = randomUUID()) {
    name = nick.parse(name);
    if (room.game || room.seats.length >= 6)
      throw Error("Room sudah bermain atau penuh.");
    if (room.seats.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw Error("Nama ini sudah digunakan.");
    const token = randomBytes(32).toString("base64url");
    room.seats.push({ name, id });
    room.tokens.set(token, id);
    room.revision++;
    this.repo.save(room);
    return { room, id, token };
  }
  restore(code: string, token: string) {
    const room = this.find(code),
      id = room.tokens.get(token);
    if (!id) throw Error("Sesi tidak berlaku.");
    this.expire(room);
    return { room, id, token };
  }
  view(room: Room, id: string): RoomView {
    return {
      code: room.code,
      me: id,
      host: room.host,
      revision: room.revision,
      serverTime: Date.now(),
      config: { ...room.config },
      cardTheme: room.cardTheme,
      seats: room.seats.map((p) => ({
        ...p,
        online: !!p.difficulty || room.online.has(p.id),
      })),
      leaderboard: [
        ...new Map([
          ...room.seats.map(
            (s) => [s.id, { id: s.id, name: s.name, wins: 0 }] as const,
          ),
          ...room.wins,
        ]).values(),
      ].sort((a, b) => b.wins - a.wins),
      matchRevision: room.matchRevision,
      game: room.game ? observe(room.game, id) : undefined,
    };
  }
  private startMatch(room: Room) {
    const game = deal(
      room.seats,
      room.config,
      this.rng,
      randomUUID(),
      room.cardTheme,
    );
    game.turn =
      room.seats.find((s) => s.id === room.previousWinner)?.id ??
      room.seats[this.firstSeat(room.seats.length)].id;
    game.log[0].text +=
      " " + player(game, game.turn).name + " mendapat giliran pertama.";
    room.game = game;
    room.matchRevision = room.revision + 1;
  }
  private changed(room: Room) {
    room.revision++;
    this.repo.save(room);
    this.schedule(room);
    this.notify(room);
  }
  private expire(room: Room) {
    const g = room.game,
      now = Date.now();
    if (g && g.deadline !== null && g.paused === null && now >= g.deadline) {
      room.game = closeWindow(g, now);
      this.changed(room);
      return true;
    }
    return false;
  }
  execute(
    room: Room,
    id: string,
    revision: number,
    cmd: Command,
    context?: PhaseStamp,
  ) {
    this.expire(room);
    if (revision !== room.revision)
      throw Error("Meja sudah berubah. Pilih kembali.");
    const g = room.game,
      now = Date.now();
    if (!room.seats.some((s) => s.id === id))
      throw Error("Kursi tidak tersedia.");
    if (
      g &&
      (!context ||
        context.phase !== g.stage ||
        context.actionId !== phaseStamp(g).actionId)
    )
      throw Error("Aksi atau fase sudah berubah.");
    if (cmd.type === "leave") {
      if (g || id === room.host) throw Error("Kursi ini terkunci.");
      room.seats = room.seats.filter((s) => s.id !== id);
      for (const [token, seat] of room.tokens)
        if (seat === id) room.tokens.delete(token);
    } else if (cmd.type === "rename") {
      if (g) throw Error("Nama tidak dapat diubah saat pertandingan berlangsung.");
      const next = nick.parse(cmd.name);
      if (
        room.seats.some(
          (s) => s.id !== id && s.name.toLowerCase() === next.toLowerCase(),
        )
      )
        throw Error("Nama ini sudah digunakan.");
      const me = room.seats.find((s) => s.id === id)!;
      me.name = next;
      const recordWin = room.wins.get(id);
      if (recordWin) recordWin.name = next;
    } else if (cmd.type === "switch") {
      if (!g) throw Error("Pertandingan belum dimulai.");
      room.game = switchCards(g, id);
    } else if (cmd.type === "play") {
      if (!g) throw Error("Pertandingan belum dimulai.");
      room.game = play(g, id, cmd.move, now, this.rng);
      const winner = room.game.winner;
      if (winner) {
        room.previousWinner = winner;
        room.wins.set(winner, {
          id: winner,
          name: player(g, winner).name,
          wins: (room.wins.get(winner)?.wins ?? 0) + 1,
        });
      }
    } else {
      if (id !== room.host) throw Error("Kontrol ini khusus host.");
      if (!g) {
        switch (cmd.type) {
          case "setting":
            room.config = { ...room.config, [cmd.key]: cmd.value };
            break;
          case "theme":
            room.cardTheme = cmd.value;
            break;
          case "rules":
            room.config = { ...room.config, ...cmd.values };
            break;
          case "add": {
            if (room.seats.length >= 6) throw Error("Room penuh.");
            let name: string;
            do {
              name = "Computer " + ++room.botNumber;
            } while (
              room.seats.some(
                (s) => s.name.toLowerCase() === name.toLowerCase(),
              )
            );
            room.seats.push({ id: randomUUID(), name, difficulty: "normal" });
            break;
          }
          case "level":
          case "remove": {
            const bot = room.seats.find((s) => s.id === cmd.id && s.difficulty);
            if (!bot) throw Error("Pilih kursi computer.");
            if (cmd.type === "level") bot.difficulty = cmd.value;
            else room.seats = room.seats.filter((s) => s !== bot);
            break;
          }
          case "start":
            if (
              room.seats.some((s) => s.difficulty) &&
              Object.values(rules).some(
                (rule) => room.config[rule.id] && !supportedRules[rule.id],
              )
            )
              throw Error("Computer belum mendukung aturan aktif.");
            this.startMatch(room);
            break;
          default:
            throw Error("Kontrol belum tersedia.");
        }
      } else if (g.stage === "over") {
        if (cmd.type === "again") this.startMatch(room);
        else if (cmd.type === "rematch") {
          room.game = undefined;
          room.matchRevision = undefined;
        } else throw Error("Pertandingan telah selesai.");
      } else {
        const host = player(g, id).name;
        switch (cmd.type) {
          case "endMatch":
            room.game = endMatch(g, host);
            break;
          case "close":
            room.game = closeWindow(g, now, host);
            break;
          case "pause":
            if (g.paused !== null) throw Error("Sudah dijeda.");
            g.paused = now;
            g.undo = undefined;
            record(g, { text: host + " menjeda permainan." });
            break;
          case "resume":
            if (g.paused === null) throw Error("Permainan sedang berjalan.");
            if (g.deadline !== null) g.deadline += now - g.paused;
            g.paused = null;
            record(g, { text: host + " melanjutkan permainan." });
            break;
          case "coins": {
            const p = player(g, cmd.id);
            if (!p) throw Error("Kursi tidak tersedia.");
            const previous = p.coins;
            p.coins = cmd.value;
            const delta = cmd.value - previous;
            record(g, {
              text:
                host +
                " mengoreksi koin " +
                p.name +
                " dari " +
                previous +
                " menjadi " +
                cmd.value +
                ". Alasan: " +
                cmd.reason,
              ...(delta !== 0
                ? {
                    coinMove:
                      delta > 0
                        ? { from: "bank", to: p.id, amount: delta }
                        : { from: p.id, to: "bank", amount: -delta },
                  }
                : {}),
            });
            g.undo = undefined;
            break;
          }
          case "undo": {
            if (!g.undo || g.stage !== "turn")
              throw Error(
                "Undo hanya tersedia sesudah Income tanpa keputusan lanjutan.",
              );
            const p = player(g, g.undo.id);
            p.coins = g.undo.coins;
            g.actionNumber++;
            g.turn = p.id;
            g.undo = undefined;
            g.switched = false;
            record(g, {
              text: host + " membatalkan Income " + p.name + ".",
              coinMove: { from: p.id, to: "bank", amount: 1 },
            });
            break;
          }
          default:
            throw Error("Pengaturan terkunci selama pertandingan.");
        }
      }
    }
    this.changed(room);
  }
  private schedule(room: Room) {
    clearTimeout(this.jobs.get(room.code));
    this.jobs.delete(room.code);
    const g = room.game;
    if (!g || g.paused !== null || g.stage === "over") return;
    const bot = room.seats.find((p) => p.difficulty && legal(g, p.id).length);
    const revision = room.revision;
    const wait = Math.min(
      bot ? this.delay : Infinity,
      g.deadline === null ? Infinity : Math.max(0, g.deadline - Date.now()),
    );
    if (!Number.isFinite(wait)) return;
    this.jobs.set(
      room.code,
      setTimeout(() => {
        if (room.revision !== revision || this.expire(room)) return;
        if (bot) {
          const o = observe(g, bot.id);
          const threatToSlot =
            o.canSwitch &&
            (o.config.one_time_guess ||
              o.players.some(
                (p) => p.id !== bot.id && p.influence > 0 && p.coins >= 7,
              ));
          const switchChance =
            bot.difficulty === "hard"
              ? 0.32
              : bot.difficulty === "normal"
                ? 0.2
                : 0.1;
          if (threatToSlot && this.rng() < switchChance) {
            try {
              this.execute(
                room,
                bot.id,
                revision,
                { type: "switch" },
                o.context,
              );
              return;
            } catch {
              // Fall through to normal move selection if switch was rejected.
            }
          }
          const choice = decide(o, bot.difficulty!, this.rng) ?? o.legal[0];
          try {
            this.execute(
              room,
              bot.id,
              revision,
              {
                type: "play",
                move: choice,
              },
              o.context,
            );
          } catch (error) {
            if (room.revision === revision) {
              console.error(
                "Bot decision rejected",
                error instanceof Error ? error.message : "invalid",
              );
              const fallback = legal(g, bot.id)[0];
              if (fallback)
                this.execute(
                  room,
                  bot.id,
                  revision,
                  {
                    type: "play",
                    move: fallback,
                  },
                  o.context,
                );
            }
          }
        } else this.schedule(room);
      }, wait),
    );
  }
  dispose() {
    for (const job of this.jobs.values()) clearTimeout(job);
    this.jobs.clear();
  }
}
