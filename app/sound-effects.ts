"use client";
import type { EmoteId } from "../domain/emotes";

const SFX_STORAGE_KEY = "coup:sfx";
const VOLUME_STORAGE_KEY = "coup:music-volume";

type SfxKey =
  | "click"
  | "card-slide"
  | "card-place"
  | "card-swap"
  | "card-shuffle"
  | "coin-clink"
  | "challenge-hit"
  | `emote-${EmoteId}`;

const SFX_URLS: Record<SfxKey, string> = {
  click: "/audio/sfx/click.mp3",
  "card-slide": "/audio/sfx/card-slide.mp3",
  "card-place": "/audio/sfx/card-place.mp3",
  "card-swap": "/audio/sfx/card-swap.mp3",
  "card-shuffle": "/audio/sfx/card-shuffle.mp3",
  "coin-clink": "/audio/sfx/coin-clink.mp3",
  "challenge-hit": "/audio/sfx/challenge-hit.mp3",
  "emote-clap": "/audio/sfx/emote-clap.mp3",
  "emote-laugh": "/audio/sfx/emote-laugh.mp3",
  "emote-shock": "/audio/sfx/emote-shock.mp3",
  "emote-sus": "/audio/sfx/emote-sus.mp3",
  "emote-bluff": "/audio/sfx/emote-bluff.mp3",
  "emote-sweat": "/audio/sfx/emote-sweat.mp3",
  "emote-fire": "/audio/sfx/emote-fire.mp3",
  "emote-crown": "/audio/sfx/emote-crown.mp3",
};

const CORE_PRELOAD: SfxKey[] = [
  "click",
  "card-slide",
  "card-place",
  "card-swap",
  "card-shuffle",
  "coin-clink",
  "challenge-hit",
];

let sharedCtx: AudioContext | null = null;
const bufferCache = new Map<SfxKey, AudioBuffer>();
const inflightLoads = new Map<SfxKey, Promise<AudioBuffer | null>>();
let warmedUp = false;

export function isSfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SFX_STORAGE_KEY) !== "off";
}

export function setSfxEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SFX_STORAGE_KEY, enabled ? "on" : "off");
}

function getSfxVolume(): number {
  if (typeof window === "undefined" || !isSfxEnabled()) return 0;
  const saved = Number(localStorage.getItem(VOLUME_STORAGE_KEY));
  const base =
    Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.45;
  if (base <= 0.005) return 0;
  return Math.max(0.28, Math.min(1, base * 1.2));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AudioCtx();
    }
    if (sharedCtx.state === "suspended") {
      void sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

async function loadBuffer(
  ctx: AudioContext,
  key: SfxKey,
): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const existing = inflightLoads.get(key);
  if (existing) return existing;

  const task = fetch(SFX_URLS[key])
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
    .then((arr) => ctx.decodeAudioData(arr))
    .then((decoded) => {
      bufferCache.set(key, decoded);
      inflightLoads.delete(key);
      return decoded;
    })
    .catch(() => {
      inflightLoads.delete(key);
      return null;
    });

  inflightLoads.set(key, task);
  return task;
}

export function warmUpSfx(): void {
  if (warmedUp || typeof window === "undefined" || !isSfxEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  warmedUp = true;
  for (const key of CORE_PRELOAD) {
    void loadBuffer(ctx, key);
  }
}

function playSample(
  key: SfxKey,
  opts: { gain?: number; rate?: number; jitter?: number } = {},
): void {
  const vol = getSfxVolume();
  if (vol <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const gainScale = opts.gain ?? 1;
  const jitter = opts.jitter ? (Math.random() * 2 - 1) * opts.jitter : 0;
  const rate = Math.max(0.65, Math.min(1.5, (opts.rate ?? 1) + jitter));

  const playDecoded = (buf: AudioBuffer) => {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = Math.min(1.4, vol * gainScale);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore playback errors silently
    }
  };

  const cached = bufferCache.get(key);
  if (cached) {
    playDecoded(cached);
    return;
  }

  void loadBuffer(ctx, key).then((buf) => {
    if (buf) playDecoded(buf);
  });
}

/** Subtle crisp click sound for UI buttons and controls. */
export function playUiClick(): void {
  playSample("click", { gain: 0.42, rate: 1.0, jitter: 0.04 });
}

/** Authentic deck shuffle sound at the start of dealing. */
export function playCardShuffle(): void {
  playSample("card-shuffle", { gain: 0.72, rate: 1.02 });
}

/** Authentic playing-card flick/slide as a card leaves the deck. */
export function playCardDeal(index = 0): void {
  const rate = 0.96 + (index % 4) * 0.035;
  playSample("card-slide", { gain: 0.75, rate, jitter: 0.03 });
}

/** Crisp card snap/place when flipping, revealing, or inspecting a card. */
export function playCardPlace(): void {
  playSample("card-place", { gain: 0.72, rate: 1.0, jitter: 0.04 });
}

/** Real sliding card sound when swapping left/right cards (Switch). */
export function playCardSwap(): void {
  playSample("card-swap", { gain: 0.85, rate: 1.04, jitter: 0.03 });
}

/** Exactly one crisp real metallic coin clink per coin landing on a pile. */
export function playCoinLand(index = 0): void {
  const rate = 0.97 + Math.min(index, 9) * 0.024;
  playSample("coin-clink", { gain: 0.9, rate, jitter: 0.025 });
}

/** Plays N crisp individual coin clinks matching the exact coin count (reduced motion). */
export function playCoinBurst(amount: number): void {
  const count = Math.min(10, Math.max(1, Math.floor(amount)));
  for (let i = 0; i < count; i++) {
    if (i === 0) playCoinLand(0);
    else setTimeout(() => playCoinLand(i), i * 95);
  }
}

/** Dramatic tabletop impact for Challenge or Coup declarations. */
export function playChallengeHit(): void {
  playSample("challenge-hit", { gain: 0.62, rate: 1.02 });
}

/** Real recorded human/foley reaction sound for each of the 8 emotes. */
export function playEmoteSound(emote: EmoteId): void {
  playSample(`emote-${emote}`, { gain: 0.95, rate: 1.0 });
}
