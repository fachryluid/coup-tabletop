"use client";
import { useEffect, useState, useRef, useReducer, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { windows, type Move, type Difficulty } from "../domain/model";
import { MatchHistory } from "./match-history";
import { rules } from "../domain/house-rules";
import type { RoomView } from "../domain/view";
import type { Command } from "../server/rooms";

import { FullscreenButton } from "./fullscreen";
import { VoiceChat } from "./voice-chat";
import { Music } from "./music";
import { initialPlayback, playback, type Line } from "./table-playback";
import { tableDialogue } from "./table-dialogue";
import { TableScene } from "./table-scene";
import { Face } from "./cards";
const explains: Record<string, string> = {
  Income: "+1 koin",
  "Foreign Aid": "+2 koin · bisa diblokir Duke",
  Tax: "+3 koin · klaim Duke",
  Exchange: "Tukar kartu · klaim Ambassador",
  Coup: "7 koin · gugurkan satu influence",
  Assassinate: "3 koin · klaim Assassin",
  Steal: "Ambil hingga 2 koin · klaim Captain",
  Guess: "Tebak peran · sekali per match",
};
type Reply = { ok: boolean; error?: string; code?: string; token?: string };
function Moves({
  room,
  send,
}: {
  room: RoomView;
  send: (cmd: Command) => void;
}) {
  const g = room.game!,
    [chosen, choose] = useState(""),
    [target, setTarget] = useState(""),
    [kept, setKept] = useState<number[]>([]);
  const moves = g.legal.filter((m) => m.kind === chosen);
  const name = (id?: string) => room.seats.find((s) => s.id === id)?.name;
  function label(m: Move) {
    return [
      m.kind === "Lose" ? "Gugurkan" : m.kind === "Prove" ? "Buktikan" : m.kind,
      m.target && name(m.target),
      m.role,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const initialSteal = g.action?.kind === "Steal" && g.stage === "challenge";
  const kinds = [...new Set(g.legal.map((m) => m.kind))];
  if (!kinds.length) return null;
  if (g.stage === "guessAnswer") {
    return (
      <section className="action-rail">
        <div className="choices">
          {[true, false].map((answer) => (
            <button
              key={String(answer)}
              onClick={() =>
                send({ type: "play", move: { kind: "ConfirmGuess", answer } })
              }
            >
              {answer ? "Jawab benar" : "Jawab salah"}
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (kinds.includes("Keep")) {
    const options = g.legal.filter((m) => m.kind === "Keep");
    const count = options[0].indices!.length;
    const selected = options.find(
      (m) =>
        m.indices!.length === kept.length &&
        m.indices!.every((i) => kept.includes(i)),
    );
    return (
      <section className="action-rail">
        <h2>Pilih {count} kartu untuk disimpan</h2>
        <div className="exchange-cards">
          {g.pool.map((role, i) => (
            <button
              key={i}
              aria-label={role + ", kartu " + (i + 1)}
              aria-pressed={kept.includes(i)}
              disabled={!kept.includes(i) && kept.length >= count}
              onClick={() =>
                setKept(
                  kept.includes(i) ? kept.filter((n) => n !== i) : [...kept, i],
                )
              }
            >
              <Face role={role} />
              {kept.includes(i) && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        <button
          className="primary"
          disabled={!selected}
          onClick={() => selected && send({ type: "play", move: selected })}
        >
          Simpan kartu ({kept.length}/{count})
        </button>
      </section>
    );
  }
  if (chosen === "Guess") {
    return (
      <section className="action-rail">
        <h2>
          {target ? "Tebak peran " + name(target) : "Pilih lawan untuk Guess"}
        </h2>
        <div className="choices">
          {target
            ? moves
                .filter((m) => m.target === target)
                .map((m) => (
                  <button
                    key={m.role}
                    onClick={() => send({ type: "play", move: m })}
                  >
                    {m.role}
                  </button>
                ))
            : [...new Set(moves.map((m) => m.target!))].map((id) => (
                <button key={id} onClick={() => setTarget(id)}>
                  {name(id)}
                </button>
              ))}
        </div>
        <button onClick={() => (target ? setTarget("") : choose(""))}>
          Kembali
        </button>
      </section>
    );
  }
  return (
    <section className="action-rail">
      <h2>
        {moves.length
          ? "Pilih target · " + chosen
          : g.stage === "turn"
            ? "Pilih aksi Anda"
            : g.stage === "claimResponse"
              ? "Buktikan klaim atau gugurkan satu kartu Anda"
              : g.stage === "loss"
                ? "Pilih kartu Anda yang gugur"
                : g.stage === "block"
                  ? "Blok aksi atau pilih Pass"
                  : g.stage === "taxResponse"
                    ? "Tantang Tax, blok dengan Duke, atau pilih Pass"
                    : kinds.includes("Block")
                      ? "Tantang, blok aksi, atau pilih Pass"
                      : "Tantang klaim atau pilih Pass"}
      </h2>
      <div className="choices">
        {g.stage === "turn" && !moves.length
          ? kinds.map((kind) => {
              const group = g.legal.filter((m) => m.kind === kind);
              return (
                <button
                  key={kind}
                  onClick={() =>
                    group[0].target
                      ? choose(kind)
                      : send({ type: "play", move: group[0] })
                  }
                >
                  <b>{kind}</b>
                  <small>{explains[kind]}</small>
                </button>
              );
            })
          : (moves.length ? moves : g.legal).map((m, i) => (
              <button
                aria-label={label(m)}
                data-kind={m.kind}
                key={i}
                onClick={() => send({ type: "play", move: m })}
              >
                <b>{label(m)}</b>
                {m.kind === "Pass" && (
                  <small>
                    {initialSteal
                      ? "Biarkan lawan mengambil hingga 2 koin"
                      : "Lewati kesempatan ini"}
                  </small>
                )}
                {m.kind === "Challenge" && (
                  <small>
                    {initialSteal
                      ? "Minta bukti kartu Captain"
                      : "Minta bukti kartu"}
                  </small>
                )}
                {m.kind === "Block" && (
                  <small>
                    {initialSteal
                      ? "Saya mengaku sebagai " + m.role
                      : "Coba batalkan aksi"}
                  </small>
                )}
              </button>
            ))}
      </div>
      {moves.length > 0 && (
        <button onClick={() => choose("")}>Kembali ke aksi</button>
      )}
    </section>
  );
}
export default function Table() {
  const sock = useRef<Socket | null>(null);
  const [presentation, dispatch] = useReducer(playback, initialPlayback);
  const { room, latest, frames, lines, cursor, completed } = presentation;
  const reading = cursor === completed + 1 ? lines[cursor] : undefined;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const revealing = !!reading?.proof && presentation.revealed !== reading;
  const moving = presentation.moving;
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!reading || !bubble || moving) return;
    const duration = revealing
      ? 1500
      : Math.min(8000, Math.max(2200, reading.words.length * 65));
    const content = bubble.querySelector("blockquote") ?? bubble;
    let visible = false;
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      if (visible && !document.hidden && reading)
        timer = setTimeout(
          () =>
            dispatch({ type: revealing ? "reveal" : "read", line: reading }),
          duration,
        );
    }
    content.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.intersectionRatio >= 0.5;
        schedule();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(content);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [reading, revealing, moving]);
  const onDelivery = useCallback(
    (line: Line) => dispatch({ type: "delivered", line }),
    [],
  );
  const dialogue = tableDialogue(presentation, dispatch, bubbleRef);
  const [online, setOnline] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [clock, setClock] = useState(0);
  const [menu, setMenu] = useState<"home" | "create" | "join">("home");
  const offset = useRef(0);

  const [adjust, setAdjust] = useState(""),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const socket = io({ autoConnect: false });
    sock.current = socket;
    let restore = true;
    socket.on("left", () => {
      localStorage.removeItem(
        "coup:" + new URLSearchParams(location.search).get("room"),
      );
      history.replaceState(null, "", "/");
      dispatch({ type: "clear" });
      setCode("");
      setMenu("home");
    });
    socket.on("state", (v: RoomView) => {
      offset.current = v.serverTime - Date.now();
      setClock(v.serverTime);
      dispatch({ type: "snapshot", room: v, restore });
      restore = false;
    });
    socket.on("connect", () => {
      restore = true;
      setOnline(true);
      setError("");
      const roomCode =
        new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";
      if (roomCode) {
        setCode(roomCode);
        setMenu("join");
      }
      const token = roomCode && localStorage.getItem("coup:" + roomCode);
      if (token) {
        setBusy(true);
        socket.emit(
          "enter",
          { type: "restore", code: roomCode, token },
          (r: Reply) => {
            setBusy(false);
            if (!r.ok) {
              setError(r.error ?? "Sesi berakhir.");
              dispatch({ type: "clear" });
              localStorage.removeItem("coup:" + roomCode);
            }
          },
        );
      }
    });
    socket.on("disconnect", () => {
      setOnline(false);
      setBusy(false);
    });
    socket.on("connect_error", () =>
      setError("Server belum terhubung. Mencoba kembali…"),
    );
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);
  const deadline = room?.game?.deadline,
    paused = room?.game?.paused;
  useEffect(() => {
    if (deadline == null || paused != null) return;
    const tick = setInterval(() => setClock(Date.now() + offset.current), 250);
    return () => clearInterval(tick);
  }, [deadline, paused]);
  const inMatch = !!room?.game;
  useEffect(() => {
    if (inMatch) window.scrollTo(0, 0);
  }, [inMatch]);
  function send(cmd: Command) {
    if (!room || !latest || !online || busy) return;
    // The host can stop the server clock even while this browser is narrating.
    const liveControl = cmd.type === "pause" || cmd.type === "endMatch";
    if (liveControl && latest.matchRevision !== room.matchRevision) return;
    if (frames.length && !liveControl) return;
    if (cmd.type === "play" && cursor !== lines.length - 1) return;
    setBusy(true);
    setError("");
    sock.current!.emit(
      "command",
      {
        revision: liveControl ? latest.revision : room.revision,
        context: (liveControl ? latest : room).game?.context,
        command: cmd,
      },
      (r: Reply) => {
        setBusy(false);
        if (!r.ok) setError(r.error!);
        else if (cmd.type === "endMatch") drawer.current?.close();
      },
    );
  }
  const drawer = useRef<HTMLDialogElement>(null);
  const [houseRules, setHouseRules] = useState<Record<string, boolean>>({});
  function enter(join: boolean) {
    if (!name.trim()) {
      setError("Masukkan nama pemain.");
      return;
    }
    setBusy(true);
    setError("");
    sock.current!.emit(
      "enter",
      join
        ? { type: "join", code, name }
        : { type: "create", name, houseRules },
      (r: Reply) => {
        setBusy(false);
        if (!r.ok) {
          setError(r.error!);
          return;
        }
        localStorage.setItem("coup:" + r.code, r.token!);
        history.replaceState(null, "", "?room=" + r.code);
      },
    );
  }
  const host = room?.me === room?.host,
    g = room?.game;
  const standings = room && (
    <section className="standings">
      <h2>Klasemen sesi</h2>
      <table>
        <thead>
          <tr>
            <th>Pemain</th>
            <th>Menang</th>
          </tr>
        </thead>
        <tbody>
          {room.leaderboard?.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  const tableTools = room && (
    <aside>
      <details
        className="table-options"
        key={g ? "locked" : "lobby"}
        open={g ? undefined : true}
      >
        <summary>Pengaturan meja</summary>
        <section>
          <label className="setting">
            <span>
              Timer respons<small>30 detik untuk setiap jendela respons.</small>
            </span>
            <input
              type="checkbox"
              checked={room.config.timer}
              disabled={!!g || !host}
              onChange={(e) =>
                send({ type: "setting", key: "timer", value: e.target.checked })
              }
            />
          </label>
        </section>
      </details>
      {g && host && g.stage !== "over" && (
        <details className="table-options">
          <summary>Kontrol host</summary>
          <section>
            <button
              disabled={
                !!frames.length &&
                (g.paused !== null ||
                  latest?.game?.paused !== null ||
                  latest.game.stage === "over")
              }
              onClick={() =>
                send({ type: g.paused === null ? "pause" : "resume" })
              }
            >
              {g.paused === null ? "Jeda" : "Lanjutkan"}
            </button>
            {!g.config.timer &&
              windows.includes(g.stage) &&
              g.paused === null && (
                <button
                  disabled={!!frames.length}
                  onClick={() => send({ type: "close" })}
                >
                  Akhiri fase respons
                </button>
              )}
            <button
              disabled={!g.canUndo || !!frames.length}
              onClick={() => send({ type: "undo" })}
            >
              Undo Income
            </button>
            <details>
              <summary>Koreksi koin</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send({
                    type: "coins",
                    id: adjust || room.me,
                    value: Number(amount),
                    reason,
                  });
                }}
              >
                <label>
                  Pemain
                  <select
                    value={adjust || room.me}
                    onChange={(e) => setAdjust(e.target.value)}
                  >
                    {room.seats.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Saldo akhir
                  <input
                    className="coin-field"
                    required
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Alasan
                  <input
                    required
                    placeholder="Jelaskan koreksinya"
                    maxLength={160}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button disabled={!!frames.length}>Simpan koreksi</button>
              </form>
            </details>
            <button
              className="end-match"
              type="button"
              disabled={
                !latest?.game ||
                latest.game.stage === "over" ||
                latest.matchRevision !== room.matchRevision
              }
              onClick={() => {
                if (
                  window.confirm(
                    "Akhiri pertandingan ini tanpa pemenang? Skor sesi tetap sama.",
                  )
                )
                  send({ type: "endMatch" });
              }}
            >
              Akhiri pertandingan
            </button>
          </section>
        </details>
      )}
      {standings}
      {g && (
        <MatchHistory
          key={room.matchRevision}
          game={
            latest?.matchRevision === room.matchRevision && latest?.game
              ? latest.game
              : g
          }
        />
      )}
    </aside>
  );
  return (
    <main className={g ? "in-match" : room ? "lobby-screen" : "start-screen"}>
      <header>
        <b className="mark" aria-hidden="true">
          C
        </b>
        <span>Coup Digital Tabletop</span>
        <div className="table-dock" role="group" aria-label="Kontrol tampilan">
          {g && <FullscreenButton />}
          <Music />
          {room && online && sock.current && (
            <VoiceChat key={room.code + room.me} socket={sock.current} />
          )}
          {room && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => drawer.current?.showModal()}
              aria-label="Menu meja"
              title="Menu meja"
            >
              <svg
                aria-hidden="true"
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 7h8m4 0h6M3 17h2m4 0h12" />
                <circle cx="13" cy="7" r="2" />
                <circle cx="7" cy="17" r="2" />
              </svg>
            </button>
          )}
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {!online && <p role="status">Menghubungkan ke meja…</p>}
      <fieldset disabled={!online || busy} data-revision={room?.revision}>
        {!room ? (
          <article className="start-stage">
            <div
              className="start-art"
              aria-hidden="true"
              data-playing={menu === "home"}
            >
              {["contessa", "captain", "duke", "assassin", "ambassador"].map(
                (role, index, slides) => (
                  <span
                    key={role}
                    className="start-slide"
                    style={{
                      backgroundImage: "url(/cards/" + role + ".webp)",
                      animationDelay:
                        -((slides.length - index) % slides.length) * 6 + "s",
                    }}
                  />
                ),
              )}
            </div>
            <div className="start-content">
              {menu === "home" ? (
                <>
                  <h1 className="game-title">Coup</h1>
                  <p>Meja privat · 2–6 pemain</p>
                  <div className="start-commands">
                    <button
                      className="primary"
                      onClick={() => {
                        setError("");
                        setMenu("create");
                      }}
                    >
                      Buat meja privat <span aria-hidden="true">→</span>
                    </button>
                    <button
                      onClick={() => {
                        setError("");
                        setMenu("join");
                      }}
                    >
                      Masuk dengan kode <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : (
                <form
                  className="setup-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    enter(menu === "join");
                  }}
                >
                  <button
                    className="menu-back"
                    type="button"
                    onClick={() => {
                      setMenu("home");
                      setError("");
                    }}
                  >
                    ← Menu awal
                  </button>
                  <h1>{menu === "create" ? "Buat meja" : "Gabung meja"}</h1>
                  <label>
                    Nama pemain
                    <input
                      className="nickname-field"
                      placeholder="Nama panggilan"
                      autoFocus
                      required
                      maxLength={32}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="nickname"
                    />
                  </label>
                  {menu === "create" && (
                    <details className="house-options" open>
                      <summary>Aturan tongkrongan</summary>
                      <div className="rule-list">
                        {Object.values(rules).map((rule) => (
                          <label key={rule.id} className="setting">
                            <span>
                              {rule.name}
                              <small>{rule.description}</small>
                            </span>
                            <input
                              type="checkbox"
                              checked={!!houseRules[rule.id]}
                              onChange={(e) =>
                                setHouseRules({
                                  ...houseRules,
                                  [rule.id]: e.target.checked,
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                  {menu === "join" && (
                    <label>
                      Kode undangan
                      <input
                        required
                        className="invite-field"
                        placeholder="Kode dari host"
                        maxLength={10}
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.trim().toUpperCase())
                        }
                        autoCapitalize="characters"
                        spellCheck={false}
                      />
                    </label>
                  )}
                  <button className="primary" type="submit">
                    {menu === "create" ? "Buat room" : "Gabung room"}{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              )}
            </div>
          </article>
        ) : !room.game && frames.length ? (
          <div className="arena">
            {dialogue.bubble}
            {dialogue.controls}
          </div>
        ) : (
          <>
            <div className="title">
              <div>
                <small>Meja privat · {room.code}</small>
                {!g && <h1>Lobi permainan</h1>}
              </div>
              {g && (
                <small>
                  {room.seats.length} pemain ·{" "}
                  {g.config.timer ? "Timer 30 dtk" : "Timer mati"}
                  {g.config.one_time_guess ? " · One-Time Guess" : ""}
                  {g.config.duke_blocks_tax ? " · Duke Blocks Tax" : ""}
                </small>
              )}
              {!g && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(location.href);
                      setCopied(true);
                    } catch {
                      setError(
                        "Salin alamat halaman ini untuk mengundang teman.",
                      );
                    }
                  }}
                >
                  {copied ? "Tautan disalin" : "Salin undangan"}
                </button>
              )}
            </div>
            <div className="columns">
              <div>
                {g && (
                  <TableScene
                    key={presentation.sceneKey}
                    room={room}
                    clock={clock}
                    showDeal={presentation.deal}
                    dialogue={dialogue}
                    moving={moving}
                    onDelivery={onDelivery}
                  >
                    <div
                      id="pilihan-meja"
                      tabIndex={-1}
                      inert={!!frames.length || cursor !== lines.length - 1}
                    >
                      {((!frames.length && cursor === lines.length - 1) ||
                        (g.stage === "exchange" && g.turn === room.me)) && (
                        <Moves key={room.revision} room={room} send={send} />
                      )}
                    </div>
                    {g.stage === "over" && standings}
                    {g.stage === "over" && host && !frames.length && (
                      <button
                        className="primary"
                        onClick={() => send({ type: "again" })}
                      >
                        Main lagi
                      </button>
                    )}
                    {g.stage === "over" && host && !frames.length && (
                      <button
                        className="primary"
                        onClick={() => send({ type: "rematch" })}
                      >
                        Kembali ke lobi untuk rematch
                      </button>
                    )}
                  </TableScene>
                )}
                {!g && (
                  <section>
                    <h2>
                      Kursi <small>{room.seats.length} / 6</small>
                    </h2>
                    {room.seats.map((s) => {
                      return (
                        <div className="seat" key={s.id}>
                          <div>
                            <b>{s.name}</b>
                            <small>
                              {[
                                s.id === room.me ? "Anda" : "",
                                s.id === room.host ? "Host" : "",
                                s.difficulty
                                  ? "Computer · " + s.difficulty
                                  : "",
                                !s.online ? "Offline" : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </div>
                          {host && !g && s.difficulty && (
                            <div>
                              <select
                                aria-label={"Level " + s.name}
                                value={s.difficulty}
                                onChange={(e) =>
                                  send({
                                    type: "level",
                                    id: s.id,
                                    value: e.target.value as Difficulty,
                                  })
                                }
                              >
                                {["Easy", "Normal", "Hard"].map((x) => (
                                  <option key={x} value={x.toLowerCase()}>
                                    {x}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() =>
                                  send({ type: "remove", id: s.id })
                                }
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!g && host && (
                      <button
                        disabled={room.seats.length === 6}
                        onClick={() => send({ type: "add" })}
                      >
                        Tambah computer
                      </button>
                    )}
                    {!g && !host && (
                      <button onClick={() => send({ type: "leave" })}>
                        Tinggalkan kursi
                      </button>
                    )}
                  </section>
                )}
              </div>
              {!g && (
                <section>
                  <h2>Aturan tongkrongan</h2>
                  <p>
                    {Object.values(rules)
                      .filter((rule) => room.config[rule.id])
                      .map((rule) => rule.name)
                      .join(" · ") || "Aturan klasik"}
                  </p>
                  {host ? (
                    <button
                      className="primary"
                      disabled={room.seats.length < 2}
                      onClick={() => send({ type: "start" })}
                    >
                      Mulai pertandingan
                    </button>
                  ) : (
                    <p>Menunggu host memulai pertandingan.</p>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </fieldset>
      {room && (
        <dialog
          ref={drawer}
          className="table-menu"
          aria-label="Menu meja"
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              e.clientX < e.currentTarget.getBoundingClientRect().left
            )
              drawer.current?.close();
          }}
        >
          <div className="drawer-title">
            <h2>Menu meja</h2>
            <button type="button" onClick={() => drawer.current?.close()}>
              Tutup
            </button>
          </div>
          <fieldset disabled={!online || busy}>{tableTools}</fieldset>
          <a href="/">Meja lain</a>
        </dialog>
      )}
    </main>
  );
}
