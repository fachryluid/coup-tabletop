import type { Dispatch, RefObject } from "react";
import { playback, type TablePlayback } from "./table-playback";
export function tableDialogue(
  state: TablePlayback,
  dispatch: Dispatch<Parameters<typeof playback>[1]>,
  bubbleRef: RefObject<HTMLDivElement | null>,
) {
  const current = state.lines[state.cursor];
  const room = state.room;
  const speaker = room?.seats.find((s) => s.id === current?.by);
  const title = speaker
    ? speaker.name + (speaker.id === room?.me ? " (Anda)" : "")
    : "Bentara Istana";
  const activeProof =
    state.cursor === state.completed + 1 && !state.moving
      ? current?.proof
      : undefined;
  const bubble = current && (
    <div
      ref={bubbleRef}
      data-event-seq={current.seq}
      data-action-id={current.actionId}
      className={speaker ? "seat-bubble" : "herald-popup"}
      aria-label={"Ucapan " + title}
    >
      {!speaker && (
        <svg className="herald-portrait" aria-hidden="true" viewBox="0 0 64 76">
          <path
            fill="#283b40"
            stroke="#cfa967"
            d="M2 2h60v48Q58 65 32 74 6 65 2 50Z"
          />
          <path fill="#964c43" d="M7 58q6-12 20-14h10q14 2 20 14L32 71Z" />
          <path fill="#d0a876" d="M20 29q0-15 12-15t12 15l-2 10-10 9-10-9Z" />
          <path fill="#384852" d="m15 28 6-14 16-5 13 15-9 4-7-4-11 7Z" />
          <path
            fill="#e7c47d"
            d="M35 19Q42 2 54 5q-3 12-19 14ZM18 27l26-7 2 3-27 7Z"
          />
          <path
            fill="#3a3935"
            d="m24 33 5 1-4 2Zm11 1 5-2-1 4Zm-8 7 5-3 5 2-4 2Z"
          />
          <path fill="#f0d69d" d="m20 46 12 6 12-6-4 12-8-4-8 4Z" />
        </svg>
      )}
      <b>{title}</b>
      {(!current.guessed || !activeProof || state.revealed === current) && (
        <blockquote aria-live="polite">“{current.words}”</blockquote>
      )}
    </div>
  );
  const controls = state.lines.length > 0 && (
    <div className="speech-nav">
      <small>
        Dialog {state.cursor + 1}/{state.lines.length}
      </small>
      <button
        aria-label="← Sebelumnya"
        title="Dialog sebelumnya"
        disabled={!!state.moving || state.cursor <= 0}
        onClick={() => dispatch({ type: "back" })}
      >
        ←
      </button>
      <button
        aria-label="Berikutnya →"
        title="Dialog berikutnya"
        disabled={
          !!state.moving ||
          state.cursor > state.completed ||
          state.cursor >= state.lines.length - 1
        }
        onClick={() => dispatch({ type: "next" })}
      >
        →
      </button>
      <button
        aria-pressed={state.manual}
        onClick={() => dispatch({ type: "toggle" })}
      >
        {state.manual ? "Putar otomatis" : "Tahan dialog"}
      </button>
    </div>
  );
  return {
    speakerId: current?.by,
    proofSeat:
      activeProof || state.moving?.proof ? current.by : state.exposed?.by,
    proofSlot:
      activeProof || state.moving?.proof
        ? current.proofSlot
        : state.exposed?.proofSlot,
    activeProofArt:
      activeProof || state.moving?.proof
        ? current.proofArt
        : state.exposed?.proofArt,
    activeProof: activeProof ?? state.moving?.proof ?? state.exposed?.proof,
    proofStatus: activeProof
      ? (current.move?.kind === "replace" ? "Pembuktian " : "Membuka ") +
        activeProof
      : undefined,
    bubble,
    controls,
  };
}
