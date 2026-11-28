import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { ActiveRoomReturnButton } from "./active-room";
import { BrandHeader } from "./brand-logo";
import { FullscreenButton } from "./fullscreen";
import { Music } from "./music";

export type PublicDocKind =
  | "terms"
  | "privacy"
  | "updates"
  | "settings"
  | "leaderboard"
  | "profile"
  | "public_profile";

const SIDEBAR_ITEMS = [
  {
    key: "profile" as const,
    href: "/profile",
    label: "Profil Saya",
    icon: (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
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
    ),
  },
  {
    key: "leaderboard" as const,
    href: "/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 21h8m-4-4v4m-6-9a6 6 0 0 0 12 0V5H6v7Z" />
        <path d="M6 7H3v2a3 3 0 0 0 3 3m12-5h3v2a3 3 0 0 1-3 3" />
      </svg>
    ),
  },
  {
    key: "settings" as const,
    href: "/settings",
    label: "Pengaturan",
    icon: (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7h8m4 0h6M3 17h2m4 0h12" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="7" cy="17" r="2" />
      </svg>
    ),
  },
];

export function LegalShell({
  current,
  updatedAt = "27 November 2026",
  title,
  children,
}: {
  current: PublicDocKind;
  pill?: string;
  updatedAt?: string;
  title: string;
  children: React.ReactNode;
}) {
  const hasSidebar =
    current === "profile" ||
    current === "public_profile" ||
    current === "leaderboard" ||
    current === "settings";

  const altLink =
    current === "terms"
      ? { href: "/privacy", label: "Baca Kebijakan Privasi" }
      : current === "privacy"
        ? { href: "/terms", label: "Baca Syarat & Ketentuan" }
        : current === "leaderboard"
          ? { href: "/profile", label: "Lihat Profil Saya" }
          : current === "profile" || current === "public_profile"
            ? { href: "/leaderboard", label: "Lihat Leaderboard" }
            : current === "settings"
              ? { href: "/profile", label: "Lihat Profil Saya" }
              : { href: "/terms", label: "Baca Syarat & Ketentuan" };

  const card = (
    <article className="legal-card">
      <div className="legal-head">
        <h1>{title}</h1>
        <p className="legal-updated">
          {hasSidebar ? updatedAt : `Terakhir diperbarui: ${updatedAt}`}
        </p>
      </div>

      <div className="legal-sections">{children}</div>

      <footer className="legal-foot">
        <Link href="/" className="primary legal-cta">
          <span aria-hidden="true">←</span>
          <span>Kembali ke The Ultimate Coup</span>
        </Link>
        <Link href={altLink.href} className="legal-alt-link">
          <span>{altLink.label}</span>
          <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </article>
  );

  return (
    <main className="start-screen legal-screen">
      <header>
        <Link href="/" className="header-brand-link">
          <BrandHeader />
        </Link>
        <div className="table-dock" role="group" aria-label="Kontrol tampilan">
          <ActiveRoomReturnButton />
          <FullscreenButton />
          <Music hiddenTrigger />
          <AccountMenu />
        </div>
      </header>

      <div className="legal-bar">
        <nav className="legal-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Beranda</Link>
            </li>
            <li aria-hidden="true" className="legal-breadcrumb-sep">
              /
            </li>
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
        <Link href="/" className="legal-back-btn">
          <span aria-hidden="true">←</span>
          <span>Kembali</span>
        </Link>
      </div>

      {hasSidebar ? (
        <div className="app-workspace">
          <aside className="app-sidebar" aria-label="Menu halaman">
            <span className="app-sidebar-title">Menu Akun</span>
            <nav className="app-sidebar-nav" aria-label="Navigasi utama">
              {SIDEBAR_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="app-sidebar-link"
                  aria-current={current === item.key ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <hr className="app-sidebar-divider" />
            <Link href="/" className="app-sidebar-link app-sidebar-home">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 10.5 9-7.5 9 7.5" />
                <path d="M5 9.5V20h14V9.5" />
              </svg>
              <span>Beranda</span>
            </Link>
          </aside>
          <div className="app-workspace-content">{card}</div>
        </div>
      ) : (
        card
      )}

      <footer className="site-legal-foot">
        <small>The Ultimate Coup</small>
        <span aria-hidden="true">·</span>
        <Link href="/updates">Catatan Pembaruan</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">Syarat &amp; Ketentuan</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">Kebijakan Privasi</Link>
      </footer>
    </main>
  );
}
