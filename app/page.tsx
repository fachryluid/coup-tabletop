"use client";
import { useEffect, useState, useRef, useReducer, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { windows, type Difficulty } from "../domain/model";
import { MatchHistory } from "./match-history";
import { ExtraRules } from "./extra-rules";
import { CardThemePicker } from "./card-theme-picker";
import { CARD_THEME_MAP } from "../domain/card-themes";
import { ActionOverlay } from "./action-overlay";
import { MatchOverOverlay } from "./match-over-overlay";
import type { RoomView } from "../domain/view";
import type { Command } from "../server/rooms";

import { FullscreenButton } from "./fullscreen";
import { VoiceChat } from "./voice-chat";
import { Music } from "./music";
import { EmoteControl } from "./emote-control";
import { HowToPlay } from "./how-to-play";
import { coinTransferDuration } from "./coin-table";
import {
  playCardPlace,
  playCardSwap,
  playChallengeHit,
  playEmoteSound,
  playUiClick,
  warmUpSfx,
} from "./sound-effects";
import type { EmotePayload } from "../domain/emotes";
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
  const [coinLaunch, setCoinLaunch] = useState<{
    sceneKey: number;
    seq: number;
    move: NonNullable<Line["coinMove"]>;
  } | null>(null);
  const lineAudioKey = useRef("");
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      warmUpSfx();
      const target = e.target as HTMLElement | null;
      const control = target?.closest<HTMLElement>(
        "button:not(:disabled), summary, input[type='checkbox']:not(:disabled)",
      );
      if (!control) return;
      if (
        control.classList.contains("hand-card") ||
        control.classList.contains("emote-option")
      )
        return;
      playUiClick();
    };
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);
  useEffect(() => {
    if (!reading || reading.seq === undefined) return;
    const key = presentation.sceneKey + ":" + reading.seq;
    if (lineAudioKey.current === key) return;
    lineAudioKey.current = key;
    if (reading.cardSwap) {
      playCardSwap();
    } else if (reading.proof) {
      playCardPlace();
    } else if (
      reading.words.includes("menantang") ||
      reading.words.includes("melakukan Coup")
    ) {
      playChallengeHit();
    }
  }, [reading, presentation.sceneKey]);
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!reading || !bubble || moving) return;
    const duration = revealing
      ? 1500
      : reading.cardSwap
        ? 1100
        : Math.min(8000, Math.max(2200, reading.words.length * 65));
    const coinMove = !revealing ? reading.coinMove : undefined;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coinFlightMs =
      coinMove && !reducedMotion ? coinTransferDuration(coinMove.amount) : 0;
    const coinStartDelay =
      coinFlightMs > 0 ? Math.max(450, duration - coinFlightMs) : -1;
    const content = bubble.querySelector("blockquote") ?? bubble;
    let visible = false;
    let timer: ReturnType<typeof setTimeout>;
    let coinTimer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      clearTimeout(coinTimer);
      if (visible && !document.hidden && reading) {
        if (coinStartDelay >= 0 && coinMove && reading.seq !== undefined) {
          const seq = reading.seq;
          const sceneKey = presentation.sceneKey;
          coinTimer = setTimeout(() => {
            setCoinLaunch({ sceneKey, seq, move: coinMove });
          }, coinStartDelay);
        }
        timer = setTimeout(
          () =>
            dispatch({ type: revealing ? "reveal" : "read", line: reading }),
          coinFlightMs > 0 ? coinStartDelay + coinFlightMs + 25 : duration,
        );
      }
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
      clearTimeout(coinTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [reading, revealing, moving, presentation.sceneKey]);
  const onDelivery = useCallback(
    (line: Line) => dispatch({ type: "delivered", line }),
    [],
  );
  const dialogue = tableDialogue(presentation, dispatch, bubbleRef);
  const [online, setOnline] = useState(false),
    [busy, setBusy] = useState(false),
    [loadingLabel, setLoadingLabel] = useState(""),
    [slowBusy, setSlowBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!busy) {
      setSlowBusy(false);
      return;
    }
    const id = setTimeout(() => setSlowBusy(true), 180);
    return () => clearTimeout(id);
  }, [busy]);
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
  const [emotes, setEmotes] = useState<Record<string, EmotePayload>>({});
  const emoteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  useEffect(() => {
    const socket = io({ autoConnect: false });
    sock.current = socket;
    const timers = emoteTimers.current;
    let restore = true;
    socket.on("emote", (payload: EmotePayload) => {
      playEmoteSound(payload.emote);
      setEmotes((prev) => ({ ...prev, [payload.seatId]: payload }));
      const prevTimer = timers.get(payload.seatId);
      if (prevTimer) clearTimeout(prevTimer);
      timers.set(
        payload.seatId,
        setTimeout(() => {
          timers.delete(payload.seatId);
          setEmotes((prev) => {
            if (prev[payload.seatId]?.ts !== payload.ts) return prev;
            const copy = { ...prev };
            delete copy[payload.seatId];
            return copy;
          });
        }, 3200),
      );
    });
    socket.on("left", () => {
      localStorage.removeItem(
        "coup:" + new URLSearchParams(location.search).get("room"),
      );
      history.replaceState(null, "", "/");
      dispatch({ type: "clear" });
      setEmotes({});
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
        setLoadingLabel("Memulihkan sesi meja…");
        socket.emit(
          "enter",
          { type: "restore", code: roomCode, token },
          (r: Reply) => {
            setBusy(false);
            setLoadingLabel("");
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
      setLoadingLabel("");
    });
    socket.on("connect_error", () =>
      setError("Server belum terhubung. Mencoba kembali…"),
    );
    socket.connect();

    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
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
    if (
      (cmd.type === "play" || cmd.type === "switch") &&
      cursor !== lines.length - 1
    )
      return;
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
  function returnHome() {
    if (!room) {
      setMenu("home");
      setError("");
      return;
    }
    if (!room.game && room.me !== room.host) {
      drawer.current?.close();
      send({ type: "leave" });
      return;
    }
    const promptText = room.game
      ? "Kembali ke halaman awal? Pertandingan tetap berjalan dan Anda dapat kembali lewat tautan undangan."
      : "Kembali ke halaman awal dan tinggalkan tampilan lobi ini?";
    if (!window.confirm(promptText)) return;
    drawer.current?.close();
    history.replaceState(null, "", "/");
    dispatch({ type: "clear" });
    setEmotes({});
    setCode("");
    setError("");
    setMenu("home");
    const socket = sock.current;
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  }
  function enter(join: boolean) {
    if (!name.trim()) {
      setError("Masukkan nama pemain.");
      return;
    }
    setBusy(true);
    setLoadingLabel(join ? "Bergabung ke meja…" : "Membuat meja privat…");
    setError("");
    sock.current!.emit(
      "enter",
      join ? { type: "join", code, name } : { type: "create", name },
      (r: Reply) => {
        setBusy(false);
        setLoadingLabel("");
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
  const onTable = !!g || (!!room && frames.length > 0);
  const loaderText = !online
    ? "Menghubungkan ke meja…"
    : loadingLabel || (slowBusy ? "Memproses…" : "");
  return (
    <main
      className={onTable ? "in-match" : room ? "lobby-screen" : "start-screen"}
    >
      <header>
        <b className="mark" aria-hidden="true">
          C
        </b>
        <span>Coup Digital Tabletop</span>
        <div className="table-dock" role="group" aria-label="Kontrol tampilan">
          <FullscreenButton />
          <Music />
          {room && g && online && sock.current && (
            <EmoteControl key={"emote-" + room.code + room.me} socket={sock.current} />
          )}
          {room && online && sock.current && (
            <VoiceChat key={room.code + room.me} socket={sock.current} />
          )}
          {room && (
            <button
              type="button"
              onClick={returnHome}
              aria-label="Kembali ke halaman awal"
              title="Kembali ke halaman awal"
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1v-9.5Z" />
              </svg>
            </button>
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
      <fieldset disabled={!online || busy} data-revision={room?.revision}>
        {!room ? (
          <>
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
                      <button
                        type="button"
                        className="start-guide-btn"
                        onClick={() => {
                          document
                            .getElementById("cara-bermain")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Cara bermain <span aria-hidden="true">↓</span>
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
            {menu === "home" && (
              <HowToPlay
                onStart={() => {
                  setError("");
                  setMenu("create");
                  document
                    .querySelector(".start-stage")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            )}
          </>
        ) : !room.game && frames.length ? (
          <>
            <div className="title">
              <div>
                <small>Meja privat · {room.code}</small>
              </div>
              <small>
                {room.seats.length} pemain ·{" "}
                {(frames[0]?.room.game?.config ?? room.config).timer
                  ? "Timer 30 dtk"
                  : "Timer mati"}
                {(frames[0]?.room.game?.config ?? room.config).one_time_guess
                  ? " · One-Time Guess"
                  : ""}
                {(frames[0]?.room.game?.config ?? room.config).duke_blocks_tax
                  ? " · Duke Blocks Tax"
                  : ""}
                {(frames[0]?.room.cardTheme ?? room.cardTheme) !== "classic"
                  ? " · " +
                    CARD_THEME_MAP[
                      frames[0]?.room.cardTheme ?? room.cardTheme
                    ].name
                  : ""}
              </small>
            </div>
            <div className="arena arena-opening">
              {dialogue.bubble}
              {dialogue.controls}
            </div>
          </>
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
                  {g.cardTheme !== "classic"
                    ? " · " + CARD_THEME_MAP[g.cardTheme].name
                    : ""}
                </small>
              )}
              {!g && (
                <div className="lobby-title-actions">
                  <button
                    type="button"
                    className="with-icon lobby-home-btn"
                    onClick={returnHome}
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
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    <span>Halaman awal</span>
                  </button>
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
                </div>
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
                    activeCoinMove={
                      coinLaunch && coinLaunch.sceneKey === presentation.sceneKey
                        ? coinLaunch
                        : undefined
                    }
                    swappingSeat={reading?.cardSwap}
                    onSwitch={
                      canAct && g.canSwitch
                        ? () => send({ type: "switch" })
                        : undefined
                    }
                    emotes={emotes}
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
                  <CardThemePicker
                    value={room.cardTheme}
                    editable={host}
                    onChange={(value) => send({ type: "theme", value })}
                  />
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
          onReturnHome={returnHome}
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
          <button
            type="button"
            className="drawer-home-btn with-icon"
            onClick={returnHome}
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
              <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1v-9.5Z" />
            </svg>
            <span>Kembali ke halaman awal</span>
          </button>
        </dialog>
      )}
      {loaderText && (
        <div
          className="screen-loader"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="screen-loader-backdrop" aria-hidden="true" />
          <div className="screen-loader-card">
            <span className="screen-loader-spinner" aria-hidden="true">
              <span className="screen-loader-ring" />
              <b className="screen-loader-crest">C</b>
            </span>
            <p className="screen-loader-text">{loaderText}</p>
          </div>
        </div>
      )}
    </main>
  );
}
