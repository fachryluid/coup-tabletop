"use client";
import { useEffect, useState } from "react";
import { claims, windows, type Action, type Move, type Role } from "../domain/model";
import type { RoomView } from "../domain/view";
import type { Command } from "../server/rooms";
import { Face, Back } from "./cards";

const explains: Record<string, string> = {
  Income: "+1 koin",
  "Foreign Aid": "+2 koin · blok Duke",
  Tax: "+3 koin · Duke",
  Exchange: "Tukar kartu · Ambassador",
  Coup: "7 koin · gugurkan 1 kartu",
  Assassinate: "3 koin · Assassin",
  Steal: "Curi 2 koin · Captain",
  Guess: "Tebak kartu · 1× / match",
};

function ActionEmblem({ kind }: { kind: Action }) {
  const claimed = claims[kind];
  if (claimed) {
    return (
      <span className="action-art-thumb" aria-hidden="true">
        <img
          src={"/cards/" + claimed.toLowerCase() + ".webp"}
          alt=""
          width={56}
          height={82}
          draggable={false}
        />
      </span>
    );
  }
  if (kind === "Income") {
    return (
      <span className="action-emblem emblem-coin" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="18" cy="18" r="9" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
          <text
            x="18"
            y="22"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
            fontWeight="700"
            fontFamily="Georgia, serif"
          >
            +1
          </text>
        </svg>
      </span>
    );
  }
  if (kind === "Foreign Aid") {
    return (
      <span className="action-emblem emblem-aid" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <circle cx="14" cy="19" r="9.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="22.5" cy="16" r="9.5" fill="#1e2b27" stroke="currentColor" strokeWidth="2" />
          <text
            x="22.5"
            y="20"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10.5"
            fontWeight="700"
            fontFamily="Georgia, serif"
          >
            +2
          </text>
        </svg>
      </span>
    );
  }
  if (kind === "Coup") {
    return (
      <span className="action-emblem emblem-coup" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 28 27 9m0 0-6 1m6-1-1 6" />
          <path d="M28 28 9 9m0 0 6 1M9 9l1 6" />
          <path d="M12 24l4 4m8-4-4 4" opacity="0.7" />
        </svg>
      </span>
    );
  }
  // Guess
  return (
    <span className="action-emblem emblem-guess" aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <rect
          x="8"
          y="4"
          width="20"
          height="28"
          rx="3"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="11"
          y="7"
          width="14"
          height="22"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.55"
        />
        <text
          x="18"
          y="23"
          textAnchor="middle"
          fill="currentColor"
          fontSize="15"
          fontWeight="700"
          fontFamily="Georgia, serif"
        >
          ?
        </text>
      </svg>
    </span>
  );
}

function MysteryCardArt({ side }: { side: number }) {
  return (
    <span className="mystery-card-face" data-side={side} aria-hidden="true">
      <span className="mystery-corner top-left">◆</span>
      <span className="mystery-corner bottom-right">◆</span>
      <span className="mystery-medallion">
        <svg viewBox="0 0 64 64" fill="none">
          <circle
            cx="32"
            cy="32"
            r="27"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
            opacity="0.7"
          />
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.6" />
          <text
            x="32"
            y="41"
            textAnchor="middle"
            fill="currentColor"
            fontSize="30"
            fontWeight="700"
            fontFamily="Georgia, serif"
          >
            ?
          </text>
        </svg>
      </span>
    </span>
  );
}

export function ActionOverlay({
  room,
  clock,
  send,
  onHide,
  inert,
}: {
  room: RoomView;
  clock: number;
  send: (cmd: Command) => void;
  onHide: () => void;
  inert?: boolean;
}) {
  const g = room.game!;
  const [chosen, choose] = useState("");
  const [target, setTarget] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [kept, setKept] = useState<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onHide]);

  const kinds = [...new Set(g.legal.map((m) => m.kind))];
  if (!kinds.length) return null;

  const me = g.players.find((p) => p.id === room.me)!;
  const moves = g.legal.filter((m) => m.kind === chosen);
  const name = (id?: string) => room.seats.find((s) => s.id === id)?.name ?? "";
  const isWindow = windows.includes(g.stage);
  const initialSteal = g.action?.kind === "Steal" && g.stage === "challenge";
  const remainingSec =
    g.deadline !== null
      ? Math.max(0, Math.ceil((g.deadline - clock) / 1000))
      : null;

  function label(m: Move) {
    return [
      m.kind === "Lose" ? "Gugurkan" : m.kind === "Prove" ? "Buktikan" : m.kind,
      m.target && name(m.target),
      m.role,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function contextBadge() {
    if (g.stage === "turn") {
      return `Giliran Anda · ◉ ${me.coins} koin`;
    }
    if (g.stage === "blockChallenge" && g.blocker) {
      return `${name(g.blocker.id)} memblokir dengan ${g.blocker.role}`;
    }
    if (isWindow && g.action) {
      const claimRole = claims[g.action.kind as keyof typeof claims];
      return (
        `${name(g.turn)} · ${g.action.kind}` +
        (claimRole ? ` (${claimRole})` : "") +
        (g.action.target ? ` → ${name(g.action.target)}` : "")
      );
    }
    if (g.stage === "claimResponse") {
      return "Klaim Anda ditantang";
    }
    if (g.stage === "loss") {
      return "Kehilangan 1 influence";
    }
    if (g.stage === "exchange") {
      return "Exchange · Ambassador";
    }
    return "";
  }

  let heading = "Pilih aksi Anda";
  let content: React.ReactNode = null;
  let backAction: (() => void) | null = null;

  if (kinds.includes("Keep")) {
    const options = g.legal.filter((m) => m.kind === "Keep");
    const count = options[0].indices!.length;
    const selected = options.find(
      (m) =>
        m.indices!.length === kept.length &&
        m.indices!.every((i) => kept.includes(i)),
    );
    heading = `Pilih ${count} kartu untuk disimpan`;
    content = (
      <div className="overlay-exchange">
        <div className="exchange-cards">
          {g.pool.map((role, i) => (
            <button
              key={i}
              type="button"
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
          type="button"
          className="primary overlay-confirm-btn"
          disabled={!selected}
          onClick={() => selected && send({ type: "play", move: selected })}
        >
          Simpan kartu ({kept.length}/{count})
        </button>
      </div>
    );
  } else if (chosen === "Guess") {
    const targetMoves = target ? moves.filter((m) => m.target === target) : [];
    const targetSlots = [
      ...new Set(targetMoves.map((m) => m.slot ?? 0)),
    ].sort((a, b) => a - b);
    const activeSlot =
      slot !== null ? slot : targetSlots.length === 1 ? targetSlots[0] : null;

    if (!target) {
      heading = "Pilih pemain yang ingin ditebak";
      backAction = () => choose("");
      const targetIds = [...new Set(moves.map((m) => m.target!))];
      content = (
        <div className="choices target-grid">
          {targetIds.map((id) => {
            const seat = g.players.find((p) => p.id === id)!;
            return (
              <button
                key={id}
                type="button"
                className="target-card"
                aria-label={seat.name}
                onClick={() => {
                  const slots = [
                    ...new Set(
                      moves
                        .filter((m) => m.target === id)
                        .map((m) => m.slot ?? 0),
                    ),
                  ];
                  setTarget(id);
                  setSlot(slots.length === 1 ? slots[0] : null);
                }}
              >
                <span className="target-cards-mini" aria-hidden="true">
                  {Array.from({ length: seat.influence }, (_, idx) => (
                    <Back key={idx} />
                  ))}
                  {seat.revealed.map((r, idx) => (
                    <span key={"f" + idx} className="mini-fallen">
                      <Face role={r} />
                    </span>
                  ))}
                </span>
                <b aria-hidden="true">{seat.name}</b>
                <small aria-hidden="true">◉ {seat.coins} koin</small>
              </button>
            );
          })}
        </div>
      );
    } else if (activeSlot === null) {
      heading = `Pilih kartu ${name(target)} yang ditebak`;
      backAction = () => {
        setTarget("");
        setSlot(null);
      };
      content = (
        <div className="choices mystery-cards">
          {targetSlots.map((s) => (
            <button
              key={s}
              type="button"
              className="mystery-card-btn"
              aria-label={s === 0 ? "Kartu kiri" : "Kartu kanan"}
              onClick={() => setSlot(s)}
            >
              <MysteryCardArt side={s} />
            </button>
          ))}
        </div>
      );
    } else {
      heading = `Tebak peran kartu ${name(target)}`;
      backAction = () => {
        if (targetSlots.length > 1) setSlot(null);
        else {
          setTarget("");
          setSlot(null);
        }
      };
      content = (
        <div className="choices role-picker-grid">
          {targetMoves
            .filter((m) => (m.slot ?? 0) === activeSlot)
            .map((m) => (
              <button
                key={m.role}
                type="button"
                className="role-card-btn"
                aria-label={m.role}
                onClick={() => send({ type: "play", move: m })}
              >
                <Face role={m.role!} />
              </button>
            ))}
        </div>
      );
    }
  } else if (g.stage === "turn" && !moves.length) {
    heading =
      kinds.length === 1 && kinds[0] === "Coup"
        ? "Koin ≥ 10 · Wajib melakukan Coup"
        : "Pilih aksi Anda";
    content = (
      <div className="choices action-grid">
        {kinds.map((kind) => {
          const group = g.legal.filter((m) => m.kind === kind);
          return (
            <button
              key={kind}
              type="button"
              className="action-tile"
              data-kind={kind}
              onClick={() =>
                group[0].target
                  ? choose(kind)
                  : send({ type: "play", move: group[0] })
              }
            >
              <ActionEmblem kind={kind as Action} />
              <span className="action-tile-copy">
                <b>{kind}</b>
                <small>{explains[kind]}</small>
              </span>
            </button>
          );
        })}
      </div>
    );
  } else if (moves.length) {
    // Target selection for Coup, Assassinate, Steal
    heading = `Pilih target · ${chosen}`;
    backAction = () => choose("");
    content = (
      <div className="choices target-grid">
        {moves.map((m, i) => {
          const seat = g.players.find((p) => p.id === m.target)!;
          return (
            <button
              key={i}
              type="button"
              className="target-card"
              aria-label={label(m)}
              data-kind={m.kind}
              onClick={() => send({ type: "play", move: m })}
            >
              <span className="target-cards-mini" aria-hidden="true">
                {Array.from({ length: seat.influence }, (_, idx) => (
                  <Back key={idx} />
                ))}
                {seat.revealed.map((r, idx) => (
                  <span key={"f" + idx} className="mini-fallen">
                    <Face role={r} />
                  </span>
                ))}
              </span>
              <span className="sr-only">{label(m)}</span>
              <b aria-hidden="true">{seat.name}</b>
              <small aria-hidden="true">◉ {seat.coins} koin</small>
            </button>
          );
        })}
      </div>
    );
  } else if (g.stage === "loss" || g.stage === "claimResponse") {
    heading =
      g.stage === "claimResponse"
        ? "Buktikan klaim atau gugurkan satu kartu"
        : "Pilih kartu Anda yang gugur";
    content = (
      <div className="choices card-decision-grid">
        {g.legal.map((m, i) => (
          <button
            key={i}
            type="button"
            className="card-decision-btn"
            aria-label={label(m)}
            data-kind={m.kind}
            onClick={() => send({ type: "play", move: m })}
          >
            <Face role={m.role as Role} />
            {g.stage === "claimResponse" && (
              <span className="decision-tag" aria-hidden="true">
                {m.kind === "Prove" ? "Buktikan" : "Gugurkan"}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  } else {
    // Public response windows: Pass, Challenge, Block
    heading =
      g.stage === "block"
        ? "Blok aksi atau Pass"
        : g.stage === "taxResponse"
          ? "Tantang Tax, blok dengan Duke, atau Pass"
          : kinds.includes("Block")
            ? "Tantang, blok aksi, atau Pass"
            : "Tantang klaim atau Pass";
    content = (
      <div className="choices response-grid">
        {g.legal.map((m, i) => (
          <button
            key={i}
            type="button"
            className="response-tile"
            aria-label={label(m)}
            data-kind={m.kind}
            onClick={() => send({ type: "play", move: m })}
          >
            {m.kind === "Block" && m.role ? (
              <span className="action-art-thumb" aria-hidden="true">
                <img
                  src={"/cards/" + m.role.toLowerCase() + ".webp"}
                  alt=""
                  width={52}
                  height={76}
                  draggable={false}
                />
              </span>
            ) : m.kind === "Challenge" ? (
              <span className="action-emblem emblem-challenge" aria-hidden="true">
                <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 5 7 10v8c0 6.5 4.7 11.7 11 13 6.3-1.3 11-6.5 11-13v-8L18 5Z" />
                  <path d="M18 12v6m0 4h.01" />
                </svg>
              </span>
            ) : (
              <span className="action-emblem emblem-pass" aria-hidden="true">
                <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m11 11 7 7-7 7m8-14 7 7-7 7" />
                </svg>
              </span>
            )}
            <span className="action-tile-copy">
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
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div id="pilihan-meja" tabIndex={-1} inert={inert}>
      <div
        className="action-overlay"
        role="dialog"
        aria-label={heading}
        onClick={(e) => {
          if (e.target === e.currentTarget) onHide();
        }}
      >
        <div
          className="action-backdrop"
          aria-hidden="true"
          onClick={onHide}
        />
        <button
          type="button"
          className="icon-btn action-peek-btn"
          aria-label="Lihat meja"
          title="Sembunyikan sementara untuk melihat meja"
          onClick={onHide}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <div
          className="action-stage"
          onClick={(e) => {
            if (e.target === e.currentTarget) onHide();
          }}
        >
          <div className="action-stage-head">
            <span className="action-context-pill">
              {contextBadge()}
              {remainingSec !== null ? ` · ${remainingSec} dtk` : ""}
            </span>
            <h2>{heading}</h2>
          </div>

          <div className="action-stage-body">{content}</div>

          {backAction && (
            <div className="action-stage-foot">
              <button
                type="button"
                className="action-back-btn"
                onClick={backAction}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Kembali
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
