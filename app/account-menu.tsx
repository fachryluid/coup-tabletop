"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { AuthStatePayload, PublicAccount } from "../server/auth";

function getInitials(user: PublicAccount): string {
  const source = (user.name || user.username || user.email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function GuestUserIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function AccountMenu({
  user: controlledUser,
  onLogout,
}: {
  user?: PublicAccount | null;
  onLogout?: () => Promise<void> | void;
}) {
  const isControlled = controlledUser !== undefined;
  const [fetchedUser, setFetchedUser] = useState<PublicAccount | null>(null);
  const [open, setOpen] = useState(false);
  const [failedPicture, setFailedPicture] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();

  const user = isControlled ? controlledUser : fetchedUser;

  useEffect(() => {
    setReturnTo(window.location.pathname + window.location.search);
  }, [open]);

  useEffect(() => {
    if (isControlled) return;
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<AuthStatePayload>) : null))
      .then((data) => {
        if (active && data) setFetchedUser(data.user ?? null);
      })
      .catch(() => {
        // Ignore silent auth check failures on public pages
      });
    return () => {
      active = false;
    };
  }, [isControlled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const showImg = Boolean(user?.picture) && failedPicture !== user?.picture;
  const initials = user ? getInitials(user) : "";
  const triggerLabel = user
    ? user.username
      ? `Menu akun @${user.username}`
      : `Menu akun ${user.name || user.email}`
    : "Menu akun";
  const triggerTitle = user
    ? user.username
      ? `@${user.username} · ${user.email}`
      : user.email
    : "Masuk dengan Google";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
        setFetchedUser(null);
      }
    } catch {
      // Ignore network error on logout
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="account-menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-avatar-btn"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popupId : undefined}
        title={triggerTitle}
        onClick={() => setOpen((v) => !v)}
      >
        {user ? (
          showImg && user.picture ? (
            <img
              src={user.picture}
              alt=""
              width={34}
              height={34}
              referrerPolicy="no-referrer"
              onError={() => setFailedPicture(user.picture ?? null)}
            />
          ) : (
            <span className="account-avatar-fallback" aria-hidden="true">
              {initials}
            </span>
          )
        ) : (
          <span className="account-avatar-fallback" aria-hidden="true">
            <GuestUserIcon size={18} />
          </span>
        )}
      </button>

      {open && (
        <div
          id={popupId}
          className="account-popup"
          role="dialog"
          aria-label="Informasi akun"
        >
          {user ? (
            <>
              <div className="account-popup-head">
                <span className="account-popup-avatar" aria-hidden="true">
                  {showImg && user.picture ? (
                    <img
                      src={user.picture}
                      alt=""
                      width={44}
                      height={44}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedPicture(user.picture ?? null)}
                    />
                  ) : (
                    <span className="account-avatar-fallback">{initials}</span>
                  )}
                </span>
                <div className="account-popup-identity">
                  <strong className="account-popup-name">
                    {user.name || user.username || "Pemain"}
                  </strong>
                  {user.username && (
                    <span className="account-popup-handle">
                      @{user.username}
                    </span>
                  )}
                  <small className="account-popup-email">{user.email}</small>
                </div>
              </div>

              <hr className="account-popup-divider" />

              <div className="account-popup-links">
                <Link href="/profile" onClick={() => setOpen(false)}>
                  Profil Saya
                </Link>
                <Link href="/leaderboard" onClick={() => setOpen(false)}>
                  Leaderboard
                </Link>
                <Link href="/settings" onClick={() => setOpen(false)}>
                  Pengaturan
                </Link>
              </div>

              <hr className="account-popup-divider" />

              <button
                type="button"
                className="account-popup-logout"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
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
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
                <span>{loggingOut ? "Keluar…" : "Keluar akun"}</span>
              </button>
            </>
          ) : (
            <div className="account-popup-guest">
              <div className="account-popup-head">
                <span className="account-popup-avatar" aria-hidden="true">
                  <span className="account-avatar-fallback">
                    <GuestUserIcon size={20} />
                  </span>
                </span>
                <div className="account-popup-identity">
                  <strong className="account-popup-name">Belum masuk</strong>
                  <small className="account-popup-note">
                    Masuk untuk membuka profil, leaderboard, dan riwayat match.
                  </small>
                </div>
              </div>

              <hr className="account-popup-divider" />

              <a
                href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
                className="account-popup-login"
                onClick={() => setOpen(false)}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5H1.2v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.2 14.2a7.2 7.2 0 0 1 0-4.4V6.7H1.2a12 12 0 0 0 0 10.6l4-3.1Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l4 3.1c.9-2.9 3.6-5 6.8-5Z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
