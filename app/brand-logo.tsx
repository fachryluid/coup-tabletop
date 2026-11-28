"use client";
import { useId } from "react";

export function BrandMark({
  className = "brand-mark-svg",
  size = 38,
}: {
  className?: string;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const goldId = `tuc-g-${uid}`;
  const brightId = `tuc-b-${uid}`;
  const fieldId = `tuc-f-${uid}`;
  const glowId = `tuc-w-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={goldId} x1="12%" y1="6%" x2="88%" y2="94%">
          <stop offset="0%" stopColor="#fff2c6" />
          <stop offset="32%" stopColor="#ecc77d" />
          <stop offset="68%" stopColor="#c49449" />
          <stop offset="100%" stopColor="#8b6229" />
        </linearGradient>
        <linearGradient id={brightId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff7da" />
          <stop offset="50%" stopColor="#f0cb82" />
          <stop offset="100%" stopColor="#b9873d" />
        </linearGradient>
        <radialGradient id={fieldId} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#642628" />
          <stop offset="52%" stopColor="#361619" />
          <stop offset="100%" stopColor="#141e20" />
        </radialGradient>
        <radialGradient id={glowId} cx="50%" cy="42%" r="48%">
          <stop offset="0%" stopColor="#f7d894" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f7d894" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        d="M64 5 L112 25 L118 68 C116 96 93 114 64 123 C35 114 12 96 10 68 L16 25 Z"
        fill={`url(#${fieldId})`}
        stroke={`url(#${goldId})`}
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      <path
        d="M64 12.5 L105.5 29.8 L110.5 67.5 C108.8 91.5 89 107.2 64 115.2 C39 107.2 19.2 91.5 17.5 67.5 L22.5 29.8 Z"
        fill={`url(#${glowId})`}
        stroke={`url(#${goldId})`}
        strokeOpacity="0.65"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M64 17 L66.5 20 L64 23 L61.5 20 Z" fill="#fff0be" />
      <g
        fill={`url(#${brightId})`}
        stroke="#4c2c12"
        strokeWidth="0.8"
        strokeLinejoin="round"
      >
        <path d="M38 49 L34.5 34.5 L45 42 L51.5 31.5 L58 39.5 L64 26.5 L70 39.5 L76.5 31.5 L83 42 L93.5 34.5 L90 49 Z" />
        <rect x="39" y="51" width="50" height="4.2" rx="2" />
        <circle cx="34.5" cy="31.8" r="2.1" />
        <circle cx="51.5" cy="28.8" r="2.2" />
        <circle cx="64" cy="23.4" r="2.7" />
        <circle cx="76.5" cy="28.8" r="2.2" />
        <circle cx="93.5" cy="31.8" r="2.1" />
      </g>
      <path
        d="M84.5 64.5 C79.2 61.2 72.5 59.6 65.5 59.6 C49.8 59.6 39.5 69.8 39.5 83.6 C39.5 97.6 49.8 107.6 65.4 107.6 C73.1 107.6 80.1 105.3 85.4 100.7 L82.2 95.8 C77.8 99.6 72.4 101.6 66.2 101.6 C55.9 101.6 49.6 94.3 49.6 83.6 C49.6 72.8 55.9 65.6 65.8 65.6 C72.2 65.6 77.5 68.1 81.2 73.2 L85.4 72.2 Z"
        fill={`url(#${brightId})`}
        stroke="#341812"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path d="M64 69.6 L66.6 72.2 L64 74.8 L61.4 72.2 Z" fill="#fff2c4" />
      <path
        d="M56.2 77.6 L64 75.4 L71.8 77.6 L64 79.8 Z"
        fill="#fff3c9"
        stroke="#4a2812"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M64 78.6 L67.2 80.6 L64 98.2 L60.8 80.6 Z"
        fill={`url(#${goldId})`}
        stroke="#3e2010"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M64 79.8 L64 96.4"
        stroke="#fff7dc"
        strokeWidth="0.9"
        strokeOpacity="0.75"
      />
    </svg>
  );
}

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brand-lockup brand-lockup-compact" : "brand-lockup"}>
      <BrandMark size={compact ? 32 : 36} />
      <span className="brand-lockup-text">
        <span className="brand-lockup-super">The Ultimate</span>
        <span className="brand-lockup-main">Coup</span>
      </span>
    </span>
  );
}

export function BrandHeroLogo() {
  return (
    <div className="brand-hero">
      <span className="brand-hero-eyebrow" aria-hidden="true">
        <span>The Ultimate</span>
        <span className="brand-hero-rule" />
      </span>
      <h1 className="game-title">
        <span className="sr-only">The Ultimate </span>Coup
      </h1>
    </div>
  );
}
