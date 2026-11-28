import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { stages } from "../domain/model";
import { emoteIds } from "../domain/emotes";
import { z } from "zod";
import { Tables, MemoryRooms, command, nick, type Room } from "./rooms";
import type { AuthService } from "./auth";
import type { NicknameRepository, StatsRepository } from "./db";
const VOICE_SPEAK_RMS = 0.015;
const VOICE_SPEAK_HOLD_MS = 450;
function pcmRms(packet: Buffer): number {
  let sumSq = 0;
  const samples = packet.length >> 1;
  for (let i = 0; i < packet.length; i += 2) {
    const sample = packet.readInt16LE(i) / 32768;
    sumSq += sample * sample;
  }
  return samples ? Math.sqrt(sumSq / samples) : 0;
}
const emoteRequest = z.object({ emote: z.enum(emoteIds) }).strict();
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-F0-9]{10}$/);
const entry = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create"),
    name: nick,
    houseRules: z
      .object({
        one_time_guess: z.boolean().optional(),
        duke_blocks_tax: z.boolean().optional(),
      })
      .strict()
      .optional(),
  }),
  z.object({ type: z.literal("join"), name: nick, code }),
  z.object({ type: z.literal("restore"), code, token: z.string().max(100) }),
]);
export function attach(
  http: HttpServer,
  delay?: number,
  firstSeat?: (size: number) => number,
  authService?: AuthService,
  statsRepo?: StatsRepository,
  nicknameRepo?: NicknameRepository,
) {
  const io = new Server(http, { maxHttpBufferSize: 8192 });
  io.use((socket, next) => {
    const account = authService?.authenticateCookieHeader(
      socket.handshake.headers.cookie,
    );
    if (authService?.isEnabled()) {
      if (!account) {
        next(Error("AUTH_REQUIRED"));
        return;
      }
      if (!authService.isReadyToPlay(account)) {
        next(Error("ONBOARDING_REQUIRED"));
        return;
      }
    }
    if (account) {
      socket.data.accountId = account.id;
    }
    next();
  });
  function publish(room: Room) {
    for (const [id, sid] of room.online) {
      if (room.seats.some((s) => s.id === id))
        io.to(sid).emit("state", tables.view(room, id));
      else {
        io.to(sid).emit("left");
        room.online.delete(id);
      }
    }
  }
  const tables = new Tables(
    new MemoryRooms(),
    publish,
    delay,
    undefined,
    firstSeat,
    statsRepo ? (rec) => statsRepo.recordMatch(rec) : undefined,
  );
  const voiceSockets = new Set<string>();
  io.on("connection", (socket) => {
    let seat: { room: Room; id: string } | undefined;
    function listen(event: string, fn: (raw: unknown) => object) {
      socket.on(event, (raw, reply) => {
        if (typeof reply !== "function") return;
        try {
          reply({ ok: true, ...fn(raw) });
        } catch (e) {
          reply({
            ok: false,
            error:
              e instanceof z.ZodError
                ? "Format permintaan tidak sah."
                : e instanceof Error
                  ? e.message
                  : "Permintaan gagal.",
          });
        }
      });
    }
    listen("enter", (raw) => {
      if (seat) throw Error("Sesi sudah terhubung.");
      if (authService?.isEnabled()) {
        const account =
          typeof socket.data.accountId === "string"
            ? authService.getStore().getById(socket.data.accountId)
            : undefined;
        if (!account || !authService.isReadyToPlay(account)) {
          throw Error("Akun Google Anda tidak aktif. Silakan masuk ulang.");
        }
      }
      const msg = entry.parse(raw);
      const cookieAccount = authService?.authenticateCookieHeader(
        socket.handshake.headers.cookie,
      );
      const accountId =
        typeof socket.data.accountId === "string"
          ? socket.data.accountId
          : cookieAccount?.id;
      const accountRecord = accountId
        ? authService?.getStore().getById(accountId) ?? cookieAccount
        : undefined;
      const avatar = accountRecord?.picture;
      const auth =
        msg.type === "restore"
          ? tables.restore(msg.code, msg.token, accountId, avatar)
          : msg.type === "create"
            ? tables.create(msg.name, msg.houseRules, accountId, avatar)
            : tables.admit(
                tables.find(msg.code),
                msg.name,
                undefined,
                accountId,
                avatar,
              );
      const { room, id, token } = auth,
        old = room.online.get(id);
      if (accountId && (msg.type === "create" || msg.type === "join")) {
        try {
          nicknameRepo?.recordUsage(accountId, msg.name);
        } catch (error) {
          console.error("Gagal mencatat riwayat nama panggilan:", error);
        }
      }
      seat = { room, id };
      room.online.set(id, socket.id);
      if (old && old !== socket.id)
        io.sockets.sockets.get(old)?.disconnect(true);
      publish(room);
      return { code: room.code, token };
    });
    const activeSeat = (current: typeof seat) =>
      current &&
      current.room.online.get(current.id) === socket.id &&
      current.room.seats.some((s) => s.id === current.id);
    listen("voice:join", () => {
      if (!activeSeat(seat)) throw Error("Sesi tidak aktif.");
      voiceSockets.add(socket.id);
      return {};
    });
    let lastEmote = 0;
    listen("emote", (raw) => {
      if (!seat || !activeSeat(seat)) throw Error("Sesi tidak aktif.");
      if (!seat.room.game) throw Error("Emote hanya tersedia saat pertandingan.");
      const msg = emoteRequest.parse(raw);
      const now = Date.now();
      if (now - lastEmote < 1200)
        throw Error("Tunggu sebentar sebelum mengirim emote lagi.");
      lastEmote = now;
      const payload = { seatId: seat.id, emote: msg.emote, ts: now };
      for (const sid of seat.room.online.values()) {
        io.to(sid).emit("emote", payload);
      }
      return {};
    });
    let speaking = false;
    let speakTimer: ReturnType<typeof setTimeout> | undefined;
    function setSpeaking(active: boolean) {
      if (active === speaking) return;
      speaking = active;
      if (!seat || !activeSeat(seat)) return;
      const payload = { seatId: seat.id, speaking: active };
      for (const sid of seat.room.online.values()) {
        io.to(sid).emit("voice:speaking", payload);
      }
    }
    function stopSpeaking() {
      if (speakTimer) {
        clearTimeout(speakTimer);
        speakTimer = undefined;
      }
      setSpeaking(false);
    }
    socket.on("voice:leave", () => {
      voiceSockets.delete(socket.id);
      stopSpeaking();
    });
    socket.on("voice:mute", () => stopSpeaking());
    let allowance = 10,
      lastPacket = Date.now();
    socket.on("voice:audio", (packet: unknown) => {
      if (
        !seat ||
        !activeSeat(seat) ||
        !voiceSockets.has(socket.id) ||
        !Buffer.isBuffer(packet) ||
        packet.length !== 1280
      )
        return;
      const now = Date.now();
      allowance = Math.min(
        10,
        allowance + Math.max(0, now - lastPacket) * 0.026,
      );
      lastPacket = now;
      if (allowance < 1) return;
      allowance--;
      for (const sid of seat.room.online.values()) {
        if (sid !== socket.id && voiceSockets.has(sid))
          io.to(sid).volatile.emit("voice:audio", seat.id, packet);
      }
      if (pcmRms(packet) >= VOICE_SPEAK_RMS) {
        setSpeaking(true);
        if (speakTimer) clearTimeout(speakTimer);
        speakTimer = setTimeout(() => {
          speakTimer = undefined;
          setSpeaking(false);
        }, VOICE_SPEAK_HOLD_MS);
      }
    });
    listen("command", (raw) => {
      if (!seat || seat.room.online.get(seat.id) !== socket.id)
        throw Error("Sesi tidak aktif.");
      const msg = z
        .object({
          revision: z.number().int().nonnegative(),
          context: z
            .object({ actionId: z.string(), phase: z.enum(stages) })
            .optional(),
          command,
        })
        .parse(raw);
      tables.execute(
        seat.room,
        seat.id,
        msg.revision,
        msg.command,
        msg.context,
      );
      if (msg.command.type === "rename") {
        const renameAccountId = seat.room.seatAccounts.get(seat.id);
        if (renameAccountId) {
          try {
            nicknameRepo?.recordUsage(renameAccountId, msg.command.name);
          } catch (error) {
            console.error("Gagal mencatat riwayat nama panggilan:", error);
          }
        }
      }
      if (msg.command.type === "leave") {
        stopSpeaking();
        voiceSockets.delete(socket.id);
        seat = undefined;
      }
      return {};
    });
    socket.on("disconnect", () => {
      stopSpeaking();
      voiceSockets.delete(socket.id);
      if (seat?.room.online.get(seat.id) === socket.id) {
        seat.room.online.delete(seat.id);
        publish(seat.room);
      }
    });
  });
  return { io, tables };
}
