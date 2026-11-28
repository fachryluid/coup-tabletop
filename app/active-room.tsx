"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const ACTIVE_ROOM_KEY = "coup:active-room";

export function saveActiveRoom(code: string) {
  if (typeof window === "undefined" || !code) return;
  try {
    localStorage.setItem(ACTIVE_ROOM_KEY, code.toUpperCase());
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearActiveRoom(code?: string) {
  if (typeof window === "undefined") return;
  try {
    if (!code) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      return;
    }
    const current = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!current || current === code.toUpperCase()) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getActiveRoomSession(): { code: string; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const code = localStorage.getItem(ACTIVE_ROOM_KEY)?.trim().toUpperCase();
    if (!code) return null;
    const token = localStorage.getItem("coup:" + code);
    if (!token) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      return null;
    }
    return { code, token };
  } catch {
    return null;
  }
}

export function ActiveRoomReturnButton({
  onReturn,
}: {
  onReturn?: (code: string) => void;
}) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function verify() {
      controller?.abort();
      const session = getActiveRoomSession();
      if (!session) {
        if (active) setCode(null);
        return;
      }
      const nextController = new AbortController();
      controller = nextController;
      try {
        const res = await fetch("/api/room/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(session),
          cache: "no-store",
          signal: nextController.signal,
        });
        if (!res.ok) {
          if (active) setCode(null);
          return;
        }
        const data = (await res.json()) as { active?: boolean };
        if (!active || nextController.signal.aborted) return;
        if (data.active) {
          setCode(session.code);
        } else {
          // Room no longer exists on server or token expired — clear stale entry.
          try {
            localStorage.removeItem("coup:" + session.code);
          } catch {
            // Ignore storage errors
          }
          clearActiveRoom(session.code);
          setCode(null);
        }
      } catch {
        if (active && !nextController.signal.aborted) {
          setCode(null);
        }
      }
    }

    const trigger = () => {
      void verify();
    };
    trigger();
    window.addEventListener("storage", trigger);
    window.addEventListener("focus", trigger);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("storage", trigger);
      window.removeEventListener("focus", trigger);
    };
  }, []);

  if (!code) return null;

  const icon = (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );

  if (onReturn) {
    return (
      <button
        type="button"
        className="active-room-return-btn"
        title={`Kembali ke meja ${code}`}
        onClick={() => onReturn(code)}
      >
        {icon}
        <span>Kembali ke game</span>
      </button>
    );
  }

  return (
    <Link
      href={"/?room=" + encodeURIComponent(code)}
      className="active-room-return-btn"
      title={`Kembali ke meja ${code}`}
    >
      {icon}
      <span>Kembali ke game</span>
    </Link>
  );
}
