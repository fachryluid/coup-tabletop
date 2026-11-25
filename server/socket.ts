import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { stages } from "../domain/model";
import { emoteIds } from "../domain/emotes";
import { z } from "zod";
import { Tables, MemoryRooms, command, nick, type Room } from "./rooms";
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
) {
  const io = new Server(http, { maxHttpBufferSize: 8192 });
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
      const msg = entry.parse(raw);
      const auth =
        msg.type === "restore"
          ? tables.restore(msg.code, msg.token)
          : msg.type === "create"
            ? tables.create(msg.name, msg.houseRules)
            : tables.admit(tables.find(msg.code), msg.name);
      const { room, id, token } = auth,
        old = room.online.get(id);
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
    socket.on("voice:leave", () => voiceSockets.delete(socket.id));
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
      if (msg.command.type === "leave") {
        voiceSockets.delete(socket.id);
        seat = undefined;
      }
      return {};
    });
    socket.on("disconnect", () => {
      voiceSockets.delete(socket.id);
      if (seat?.room.online.get(seat.id) === socket.id) {
        seat.room.online.delete(seat.id);
        publish(seat.room);
      }
    });
  });
  return { io, tables };
}
