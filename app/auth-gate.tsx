"use client";
import Link from "next/link";
import { useState } from "react";
import type { AuthStatePayload } from "../server/auth";
import { BrandHeroLogo } from "./brand-logo";

const AUTH_ERRORS: Record<string, string> = {
  oauth_not_configured:
    "Login Google belum dikonfigurasi di server. Hubungi pengelola.",
  google_cancelled: "Proses masuk dengan Google dibatalkan.",
  invalid_state: "Sesi login Google kedaluwarsa. Silakan coba masuk lagi.",
  token_exchange_failed: "Gagal memverifikasi akun Google. Coba lagi.",
  userinfo_failed: "Gagal membaca profil Google Anda. Coba lagi.",
  email_unverified: "Email akun Google Anda belum terverifikasi.",
  oauth_failed: "Terjadi kendala saat masuk dengan Google. Coba lagi.",
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.25-.96 2.3-2.04 3.01l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.47 0-.72-.07-1.41-.19-2.08H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.75 0 5.06-.91 6.75-2.46l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.66 0-4.91-1.8-5.71-4.21H2.88v2.64A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M6.29 13.75A6 6 0 0 1 5.98 12c0-.61.11-1.2.31-1.75V7.61H2.88A10 10 0 0 0 2 12c0 1.61.39 3.13 1.08 4.39l3.21-2.64Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.04c1.5 0 2.84.51 3.9 1.52l2.92-2.92C17.05 2.99 14.74 2 12 2a10 10 0 0 0-9.12 5.61l3.41 2.64C7.09 7.84 9.34 6.04 12 6.04Z"
      />
    </svg>
  );
}

export function AuthGate({
  auth,
  authErrorCode,
  onUpdated,
  onLogout,
}: {
  auth: AuthStatePayload;
  authErrorCode?: string;
  onUpdated: (next: AuthStatePayload) => void;
  onLogout: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const user = auth.user;
  const queryReturnTo =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";
  const googleHref =
    "/api/auth/google?returnTo=" + encodeURIComponent(queryReturnTo);

  const bannerError =
    localError || (authErrorCode ? AUTH_ERRORS[authErrorCode] ?? "" : "");

  async function handleOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");
    if (!acceptTerms) {
      setLocalError("Centang persetujuan Syarat & Ketentuan terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, acceptTerms }),
      });
      const data = (await res.json()) as Partial<AuthStatePayload> & {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setLocalError(data.error ?? "Gagal menyimpan username.");
        return;
      }
      onUpdated({
        authRequired: data.authRequired ?? auth.authRequired,
        user: data.user ?? auth.user,
      });
    } catch {
      setLocalError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-panel">
        <BrandHeroLogo />
        <p>
          Masuk dengan akun Google untuk membuat atau bergabung ke meja privat
          The Ultimate Coup.
        </p>
        {bannerError && (
          <p className="auth-inline-error" role="alert">
            {bannerError}
          </p>
        )}
        <div className="start-commands">
          <a href={googleHref} className="google-login-btn">
            <GoogleMark />
            <span>Masuk dengan Google</span>
          </a>
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
        <p className="auth-terms-note">
          Dengan masuk, Anda menyetujui{" "}
          <Link href="/terms">Syarat &amp; Ketentuan</Link> dan{" "}
          <Link href="/privacy">Kebijakan Privasi</Link> layanan ini.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-panel auth-card-box">
      <h1>Buat username</h1>
      <p className="auth-desc">
        Masuk sebagai <b>{user.email}</b>. Pilih username untuk akun The
        Ultimate Coup Anda — saat bermain di meja, Anda tetap bebas memakai nama
        panggilan lain.
      </p>
      {bannerError && (
        <p className="auth-inline-error" role="alert">
          {bannerError}
        </p>
      )}
      <form className="auth-form" onSubmit={handleOnboarding}>
        <div className="auth-field">
          <label htmlFor="onboarding-username">Username</label>
          <div className="username-input-wrap">
            <span className="username-prefix" aria-hidden="true">
              @
            </span>
            <input
              id="onboarding-username"
              type="text"
              className="username-field"
              required
              autoFocus
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9_]{3,20}"
              placeholder="contoh: fachry_99"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
              }
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <small className="auth-field-hint">
            3–20 karakter: huruf kecil (a–z), angka, atau underscore (_).
          </small>
        </div>
        <label className="terms-check-row">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>
            Saya telah membaca dan menyetujui{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              Syarat &amp; Ketentuan
            </Link>{" "}
            serta{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              Kebijakan Privasi
            </Link>
            .
          </span>
        </label>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Menyimpan…" : "Simpan & mulai bermain →"}
        </button>
      </form>
      <div className="auth-actions-row">
        <button
          type="button"
          className="auth-secondary-btn"
          onClick={() => void onLogout()}
        >
          Keluar / Ganti akun
        </button>
      </div>
    </div>
  );
}
