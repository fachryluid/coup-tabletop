"use client";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { EMOTES, EMOTE_MAP, type EmoteId, type EmotePayload } from "../domain/emotes";

export function EmoteControl({ socket }: { socket: Socket }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [feedback, setFeedback] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function sendEmote(emote: EmoteId) {
    if (cooldown) return;
    setFeedback("");
    setCooldown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCooldown(false), 1300);

    socket.emit(
      "emote",
      { emote },
      (reply?: { ok: boolean; error?: string }) => {
        if (reply && !reply.ok && reply.error) {
          setFeedback(reply.error);
        } else {
          setOpen(false);
        }
      },
    );
  }

  return (
    <div className="emote-control" ref={wrap}>
      <button
        type="button"
        aria-label="Kirim emote"
        aria-expanded={open}
        title="Kirim emote ke meja"
        onClick={() => {
          setFeedback("");
          setOpen((v) => !v);
        }}
      >
        <svg
          aria-hidden="true"
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 10h.01M15.5 10h.01" strokeWidth="2.4" />
          <path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2" />
        </svg>
      </button>
      {open && (
        <div
          className="emote-popover"
          role="region"
          aria-label="Pilih emote"
        >
          <div className="emote-popover-head">
            <b>Emote Meja</b>
            {cooldown && <small>Tunggu…</small>}
          </div>
          <div className="emote-grid">
            {EMOTES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="emote-option"
                disabled={cooldown}
                aria-label={item.label}
                onClick={() => sendEmote(item.id)}
              >
                <span className="emote-emoji" aria-hidden="true">
                  {item.emoji}
                </span>
                <span className="emote-label">{item.label}</span>
              </button>
            ))}
          </div>
          {feedback && <small role="alert">{feedback}</small>}
        </div>
      )}
    </div>
  );
}

export function EmoteBadge({ active }: { active?: EmotePayload }) {
  if (!active) return null;
  const def = EMOTE_MAP[active.emote];
  if (!def) return null;
  return (
    <div
      key={active.ts}
      className="seat-emote-burst"
      data-emote={def.id}
      role="status"
      aria-live="polite"
    >
      <span className="seat-emote-emoji" aria-hidden="true">
        {def.emoji}
      </span>
      <span className="seat-emote-text">{def.label}</span>
    </div>
  );
}
