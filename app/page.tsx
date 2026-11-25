"use client";
import { useEffect, useState, useRef, useReducer, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { windows, type Difficulty } from "../domain/model";
import { MatchHistory } from "./match-history";
import { ExtraRules } from "./extra-rules";
import { ActionOverlay } from "./action-overlay";
import { MatchOverOverlay } from "./match-over-overlay";
import type { RoomView } from "../domain/view";
import type { Command } from "../server/rooms";

import { FullscreenButton } from "./fullscreen";
import { VoiceChat } from "./voice-chat";
import { Music } from "./music";
import { initialPlayback, playback, type Line } from "./table-playback";
import { tableDialogue } from "./table-dialogue";
import { TableScene } from "./table-scene";
type Reply = { ok: boolean; error?: string; code?: string; token?: string };
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
  const [renaming, setRenaming] = useState(false),
    [nextName, setNextName] = useState("");
  const [hiddenRevision, setHiddenRevision] = useState<number | null>(null);
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
        else if (cmd.type === "rename") setRenaming(false);
      },
    );
  }
  const drawer = useRef<HTMLDialogElement>(null);
  function enter(join: boolean) {
    if (!name.trim()) {
      setError("Masukkan nama pemain.");
      return;
    }
    setBusy(true);
    setError("");
    sock.current!.emit(
      "enter",
      join ? { type: "join", code, name } : { type: "create", name },
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
  const canAct =
    !!room &&
    !!g &&
    g.legal.length > 0 &&
    ((!frames.length && cursor === lines.length - 1) ||
      (g.stage === "exchange" && g.turn === room.me));
  const isMatchOver =
    !!room &&
    !!g &&
    g.stage === "over" &&
    !frames.length &&
    cursor === lines.length - 1;
  const actionHidden = !!room && hiddenRevision === room.revision;
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
          <FullscreenButton />
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
                  type="button"
                  className="icon-btn invite-copy-btn"
                  data-copied={copied || undefined}
                  aria-label={copied ? "Tautan disalin" : "Salin undangan"}
                  title={copied ? "Tautan disalin" : "Salin tautan undangan"}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2400);
                    } catch {
                      setError(
                        "Salin alamat halaman ini untuk mengundang teman.",
                      );
                    }
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {copied ? (
                      <path d="M20 6 9 17l-5-5" />
                    ) : (
                      <>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </>
                    )}
                  </svg>
                  {copied && <span className="copy-toast">Disalin</span>}
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
                    {canAct && actionHidden && (
                      <div className="action-minimized-dock">
                        <button
                          type="button"
                          className="primary action-reopen-btn"
                          onClick={() => setHiddenRevision(null)}
                        >
                          <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          <span>Pilih Aksi</span>
                        </button>
                      </div>
                    )}
                    {isMatchOver && actionHidden && (
                      <div className="action-minimized-dock">
                        <button
                          type="button"
                          className="primary action-reopen-btn"
                          onClick={() => setHiddenRevision(null)}
                        >
                          <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8 21h8m-4-4v4m-6-9a6 6 0 0 0 12 0V5H6v7Z" />
                          </svg>
                          <span>Lihat Klasemen</span>
                        </button>
                      </div>
                    )}
                  </TableScene>
                )}
                {!g && (
                  <section>
                    <h2>
                      Kursi <small>{room.seats.length} / 6</small>
                    </h2>
                    {room.seats.map((s) => {
                      const isMe = s.id === room.me;
                      return (
                        <div className="seat" key={s.id}>
                          <div className="seat-identity">
                            {isMe && renaming ? (
                              <form
                                id="rename-seat-form"
                                className="rename-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const trimmed = nextName.trim();
                                  if (!trimmed) {
                                    setError("Masukkan nama pemain.");
                                    return;
                                  }
                                  if (trimmed === s.name) {
                                    setRenaming(false);
                                    return;
                                  }
                                  send({ type: "rename", name: trimmed });
                                }}
                              >
                                <input
                                  aria-label="Nama baru"
                                  className="rename-field"
                                  placeholder="Nama panggilan baru"
                                  autoFocus
                                  required
                                  maxLength={32}
                                  value={nextName}
                                  onChange={(e) => setNextName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      setRenaming(false);
                                      setError("");
                                    }
                                  }}
                                />
                              </form>
                            ) : (
                              <>
                                <b>{s.name}</b>
                                <small>
                                  {[
                                    isMe ? "Anda" : "",
                                    s.id === room.host ? "Host" : "",
                                    s.difficulty
                                      ? "Computer · " + s.difficulty
                                      : "",
                                    !s.online ? "Offline" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </small>
                              </>
                            )}
                          </div>
                          {isMe && !g && (
                            <div className="seat-actions">
                              {renaming ? (
                                <>
                                  <button
                                    key="rename-save"
                                    type="submit"
                                    form="rename-seat-form"
                                    className="icon-btn rename-save-btn"
                                    aria-label="Simpan"
                                    title="Simpan nama"
                                  >
                                    <svg
                                      aria-hidden="true"
                                      width="17"
                                      height="17"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                  </button>
                                  <button
                                    key="rename-cancel"
                                    type="button"
                                    className="icon-btn"
                                    aria-label="Batal"
                                    title="Batal ganti nama"
                                    onClick={() => {
                                      setRenaming(false);
                                      setError("");
                                    }}
                                  >
                                    <svg
                                      aria-hidden="true"
                                      width="17"
                                      height="17"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                    >
                                      <path d="M18 6 6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  key="rename-open"
                                  type="button"
                                  className="icon-btn"
                                  aria-label="Ganti nama"
                                  title="Ganti nama"
                                  onClick={() => {
                                    setError("");
                                    setNextName(s.name);
                                    setRenaming(true);
                                  }}
                                >
                                  <svg
                                    aria-hidden="true"
                                    width="17"
                                    height="17"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                          {host && !g && s.difficulty && (
                            <div className="seat-actions">
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
                                type="button"
                                className="icon-btn danger-icon-btn"
                                aria-label="Hapus"
                                title={"Hapus " + s.name}
                                onClick={() =>
                                  send({ type: "remove", id: s.id })
                                }
                              >
                                <svg
                                  aria-hidden="true"
                                  width="17"
                                  height="17"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4h8v2" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6m4-6v6" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!g && host && (
                      <button
                        type="button"
                        className="with-icon lobby-add-bot-btn"
                        disabled={room.seats.length === 6}
                        onClick={() => send({ type: "add" })}
                      >
                        <svg
                          aria-hidden="true"
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="4" y="8" width="16" height="12" rx="2" />
                          <path d="M12 4v4M9 13h.01M15 13h.01M9 17h6" />
                        </svg>
                        <span>Tambah computer</span>
                      </button>
                    )}
                    {!g && !host && (
                      <button
                        type="button"
                        className="with-icon"
                        onClick={() => send({ type: "leave" })}
                      >
                        <svg
                          aria-hidden="true"
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <path d="m16 17 5-5-5-5M21 12H9" />
                        </svg>
                        <span>Tinggalkan kursi</span>
                      </button>
                    )}
                  </section>
                )}
              </div>
              {!g && (
                <section className="lobby-rules-section">
                  <ExtraRules
                    values={room.config}
                    editable={host}
                    onSave={(values) => send({ type: "rules", values })}
                  />
                  {host ? (
                    <button
                      className="primary lobby-start-btn"
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
      {canAct && !actionHidden && (
        <ActionOverlay
          key={room.revision}
          room={room}
          clock={clock}
          send={send}
          onHide={() => setHiddenRevision(room.revision)}
          inert={
            !online || busy || !!frames.length || cursor !== lines.length - 1
          }
        />
      )}
      {isMatchOver && !actionHidden && (
        <MatchOverOverlay
          key={"over-" + room.matchRevision + "-" + room.revision}
          room={room}
          host={host}
          send={send}
          onHide={() => setHiddenRevision(room.revision)}
        />
      )}
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
