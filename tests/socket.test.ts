import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { expect, it } from "vitest";
import { attach } from "../server/socket";
import type { RoomView } from "../domain/view";
import type { Command } from "../server/rooms";
it.each([false, true])(
  "reconnect restores a response window and private Exchange choices (timer %s)",
  async (timer) => {
    const http = createServer(),
      { io, tables } = attach(http, undefined, () => 0);
    await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
    const url = "http://127.0.0.1:" + (http.address() as AddressInfo).port;
    const sockets: Socket[] = [];
    function client() {
      const socket = connect(url, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
      });
      sockets.push(socket);
      let view: RoomView;
      socket.on("state", (state: RoomView) => {
        view = state;
      });
      return {
        socket,
        state: () => view,
        send: (event: string, data: unknown) =>
          socket.timeout(3000).emitWithAck(event, data),
        cmd: (command: Command) =>
          socket.timeout(3000).emitWithAck("command", {
            revision: view.revision,
            context: view.game?.context,
            command,
          }),
      };
    }
    try {
      let a = client();
      const b = client();
      const host = await a.send("enter", {
        type: "create",
        name: "A",
        houseRules: { one_time_guess: true },
      });
      const guest = await b.send("enter", {
        type: "join",
        code: host.code,
        name: "B",
      });
      expect(guest.ok).toBe(true);
      expect(b.state().config.one_time_guess).toBe(true);
      await viWait(() => a.state().seats.length === 2);
      expect(
        (await a.cmd({ type: "setting", key: "timer", value: timer })).ok,
      ).toBe(true);
      const changeRules = () =>
        a.send("command", {
          revision: a.state().revision,
          context: a.state().game?.context,
          command: { type: "setting", key: "one_time_guess", value: false },
        });
      expect((await changeRules()).ok).toBe(false);
      expect((await a.cmd({ type: "start" })).ok).toBe(true);
      expect((await changeRules()).ok).toBe(false);
      expect(a.state().game!.config.one_time_guess).toBe(true);
      expect((await a.cmd({ type: "play", move: { kind: "Income" } })).ok).toBe(
        true,
      );
      await viWait(() => b.state().game?.turn === b.state().me);
      expect(
        (await b.cmd({ type: "play", move: { kind: "Exchange" } })).ok,
      ).toBe(true);
      await viWait(() => a.state().game?.stage === "challenge");
      const window = a.state().game!;
      a.socket.disconnect();
      await viWait(() =>
        b.state().seats.some((s) => s.id === b.state().host && !s.online),
      );
      a = client();
      expect(
        (
          await a.send("enter", {
            type: "restore",
            code: host.code,
            token: host.token,
          })
        ).ok,
      ).toBe(true);
      expect(a.state().game!.context).toEqual(window.context);
      expect(a.state().game!.deadline).toEqual(window.deadline);
      const stale = await a.send("command", {
        revision: a.state().revision,
        context: { ...window.context, phase: "block" },
        command: { type: "play", move: { kind: "Pass" } },
      });
      expect(stale.ok).toBe(false);
      expect((await a.cmd({ type: "play", move: { kind: "Pass" } })).ok).toBe(
        true,
      );
      await viWait(() => b.state().game?.stage === "exchange");
      const before = b.state();
      expect(before.game!.pool.length).toBe(4);
      expect(a.state().game!.pool).toEqual([]);
      b.socket.disconnect();
      await viWait(() =>
        a.state().seats.some((p) => p.id === before.me && !p.online),
      );
      expect(a.state().game!.stage).toBe("exchange");
      expect(a.state().game!.paused).toBe(null);
      const restored = client();
      expect(
        (
          await restored.send("enter", {
            type: "restore",
            code: host.code,
            token: guest.token,
          })
        ).ok,
      ).toBe(true);
      expect(restored.state().me).toBe(before.me);
      expect(restored.state().game).toEqual(before.game);
      expect(
        (
          await restored.cmd({
            type: "play",
            move: restored.state().game!.legal[0],
          })
        ).ok,
      ).toBe(true);
      await viWait(() => a.state().game?.stage === "turn");
      expect(JSON.stringify(a.state())).not.toContain(guest.token);
    } finally {
      for (const socket of sockets) socket.disconnect();
      tables.dispose();
      await io.close();
    }
  },
);
async function viWait(condition: () => boolean) {
  await expect.poll(condition, { interval: 10, timeout: 3000 }).toBe(true);
}

it("relays voice only between subscribed seats in the same room and resets on reconnect", async () => {
  const http = createServer();
  const { io, tables } = attach(http);
  await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
  const url = "http://127.0.0.1:" + (http.address() as AddressInfo).port;
  const sockets: Socket[] = [];
  function client() {
    const socket = connect(url, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    const packets: number[] = [];
    socket.on("voice:audio", (_id, packet: Buffer) => packets.push(packet[0]));
    return {
      socket,
      packets,
      send: (event: string, data = {}) =>
        socket.timeout(3000).emitWithAck(event, data),
    };
  }
  try {
    const host = client(),
      peer = client(),
      other = client();
    expect((await host.send("voice:join")).ok).toBe(false);
    const room = await host.send("enter", { type: "create", name: "Host" });
    const auth = await peer.send("enter", {
      type: "join",
      code: room.code,
      name: "Peer",
    });
    await other.send("enter", { type: "create", name: "Other" });
    await other.send("voice:join");
    await host.send("voice:join");
    const frame = (value: number, size = 1280) =>
      host.socket.emit("voice:audio", Buffer.alloc(size, value));
    frame(1);
    await host.send("voice:join");
    await peer.send("voice:join");
    frame(2, 12);
    frame(3);
    await viWait(() => peer.packets.includes(3));
    expect(peer.packets).toEqual([3]);
    peer.socket.emit("voice:leave");
    await peer.send("enter", {});
    frame(4);
    await host.send("voice:join");
    expect(peer.packets).toEqual([3]);
    peer.socket.disconnect();
    const restored = client();
    expect(
      (
        await restored.send("enter", {
          type: "restore",
          code: room.code,
          token: auth.token,
        })
      ).ok,
    ).toBe(true);
    frame(5);
    await host.send("voice:join");
    await restored.send("voice:join");
    frame(6);
    await viWait(() => restored.packets.includes(6));
    expect(restored.packets).toEqual([6]);
    expect(other.packets).toEqual([]);
    expect(host.packets).toEqual([]);
  } finally {
    for (const socket of sockets) socket.disconnect();
    tables.dispose();
    await io.close();
  }
});
