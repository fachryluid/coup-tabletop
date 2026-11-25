"use client";
import { useRef, useState, useEffect, useCallback } from "react";

type SynthTrackId =
  | "balairung-malam"
  | "ruang-rahasia"
  | "intrik-istana"
  | "santai-meja";

export type TrackId = "meja-senja" | SynthTrackId;

type Track = {
  id: TrackId;
  name: string;
  vibe: string;
  src?: string;
};

export const MUSIC_TRACKS: Track[] = [
  {
    id: "meja-senja",
    name: "Meja Senja",
    vibe: "Akustik hangat klasik",
    src: "/audio/meja-senja.mp3",
  },
  {
    id: "balairung-malam",
    name: "Balairung Malam",
    vibe: "Arpeggio istana barok",
  },
  {
    id: "ruang-rahasia",
    name: "Ruang Rahasia",
    vibe: "Lounge noir tenang",
  },
  {
    id: "intrik-istana",
    name: "Intrik Istana",
    vibe: "Nuansa misteri & bluff",
  },
  {
    id: "santai-meja",
    name: "Santai Meja",
    vibe: "Lo-fi hangat & rileks",
  },
];

type SynthSpec = {
  tempoMs: number;
  wave: OscillatorType;
  bassWave: OscillatorType;
  cutoff: number;
  chords: number[][];
  melody: (number | null)[];
  attack: number;
  release: number;
};

const SYNTH_SPECS: Record<SynthTrackId, SynthSpec> = {
  "balairung-malam": {
    tempoMs: 520,
    wave: "triangle",
    bassWave: "sine",
    cutoff: 1350,
    chords: [
      [146.83, 220.0, 293.66, 349.23], // Dm
      [116.54, 174.61, 233.08, 293.66], // Bb
      [130.81, 196.0, 261.63, 329.63], // C
      [110.0, 164.81, 220.0, 277.18], // A
    ],
    melody: [
      440, 523.25, 587.33, 523.25, 466.16, 440, 349.23, null, 392, 440, 523.25,
      440, 440, 349.23, 329.63, null,
    ],
    attack: 0.03,
    release: 0.45,
  },
  "ruang-rahasia": {
    tempoMs: 680,
    wave: "sine",
    bassWave: "triangle",
    cutoff: 920,
    chords: [
      [130.81, 196.0, 233.08, 293.66], // Cm9
      [116.54, 174.61, 207.65, 261.63], // Bbm9
      [103.83, 155.56, 196.0, 246.94], // Abmaj7
      [98.0, 146.83, 185.0, 246.94], // G7
    ],
    melody: [
      392, null, 349.23, 311.13, 349.23, null, 293.66, null, 311.13, 392,
      466.16, 392, 349.23, null, 293.66, null,
    ],
    attack: 0.08,
    release: 0.62,
  },
  "intrik-istana": {
    tempoMs: 780,
    wave: "sine",
    bassWave: "sine",
    cutoff: 760,
    chords: [
      [110.0, 164.81, 220.0, 261.63], // Am
      [116.54, 164.81, 220.0, 293.66], // Bb/A tension
      [98.0, 146.83, 196.0, 246.94], // G
      [82.41, 123.47, 164.81, 207.65], // E
    ],
    melody: [
      null, 523.25, null, 493.88, 440, null, 392, null, null, 440, 493.88, null,
      415.3, null, 329.63, null,
    ],
    attack: 0.14,
    release: 0.72,
  },
  "santai-meja": {
    tempoMs: 560,
    wave: "triangle",
    bassWave: "sine",
    cutoff: 1100,
    chords: [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 196.0, 246.94, 329.63], // Cmaj7
    ],
    melody: [
      329.63, 392, 440, null, 392, 329.63, 293.66, null, 261.63, 329.63, 392,
      329.63, 293.66, null, 261.63, null,
    ],
    attack: 0.05,
    release: 0.5,
  },
};

function isValidTrack(value: string | null): value is TrackId {
  return MUSIC_TRACKS.some((t) => t.id === value);
}

export function Music() {
  const player = useRef<HTMLAudioElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const synthTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);

  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [track, setTrack] = useState<TrackId>("meja-senja");
  const [volume, setVolume] = useState(0.35);

  const stopSynth = useCallback(() => {
    if (synthTimer.current !== null) {
      clearInterval(synthTimer.current);
      synthTimer.current = null;
    }
  }, []);

  const ensureSynthContext = useCallback(
    (vol: number) => {
      if (!ctxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        const master = ctx.createGain();
        master.gain.value = vol * 0.45;
        master.connect(ctx.destination);
        ctxRef.current = ctx;
        masterRef.current = master;
      }
      return { ctx: ctxRef.current, master: masterRef.current! };
    },
    [],
  );

  const startSynth = useCallback(
    async (id: SynthTrackId, vol: number) => {
      stopSynth();
      const { ctx, master } = ensureSynthContext(vol);
      if (ctx.state === "suspended") await ctx.resume();
      master.gain.setTargetAtTime(vol * 0.45, ctx.currentTime, 0.03);
      const spec = SYNTH_SPECS[id];
      stepRef.current = 0;

      const triggerNote = (
        freq: number,
        type: OscillatorType,
        gainPeak: number,
        duration: number,
        delay = 0,
      ) => {
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(spec.cutoff, now);

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(gainPeak, now + spec.attack);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(filter);
        filter.connect(env);
        env.connect(master);

        osc.start(now);
        osc.stop(now + duration + 0.05);
      };

      const tick = () => {
        const step = stepRef.current++;
        const chordIndex = Math.floor(step / 4) % spec.chords.length;
        const chord = spec.chords[chordIndex];
        const beat = step % 4;

        if (beat === 0) {
          // Warm bass root + soft chord pad
          triggerNote(
            chord[0],
            spec.bassWave,
            0.28,
            (spec.tempoMs * 3.6) / 1000,
          );
          chord.slice(1).forEach((note, idx) => {
            triggerNote(
              note,
              spec.wave,
              0.1,
              (spec.tempoMs * 3.2) / 1000,
              idx * 0.04,
            );
          });
        } else if (beat === 2) {
          // Gentle harmonic arpeggio accent
          const arpNote = chord[1 + (step % (chord.length - 1))];
          triggerNote(arpNote, spec.wave, 0.11, spec.release);
        }

        const melodyNote = spec.melody[step % spec.melody.length];
        if (melodyNote) {
          triggerNote(melodyNote, spec.wave, 0.14, spec.release + 0.15, 0.02);
        }
      };

      tick();
      synthTimer.current = setInterval(tick, spec.tempoMs);
    },
    [ensureSynthContext, stopSynth],
  );

  const stopAll = useCallback(() => {
    stopSynth();
    const audio = player.current;
    if (audio && !audio.paused) audio.pause();
    setOn(false);
  }, [stopSynth]);

  const startTrack = useCallback(
    async (id: TrackId, vol: number) => {
      setError(false);
      if (id === "meja-senja") {
        stopSynth();
        const audio = player.current!;
        audio.volume = vol;
        await audio.play();
        setOn(true);
      } else {
        const audio = player.current;
        if (audio && !audio.paused) audio.pause();
        await startSynth(id, vol);
        setOn(true);
      }
    },
    [startSynth, stopSynth],
  );

  useEffect(() => {
    const savedTrack = localStorage.getItem("coup:music-track");
    const initialTrack: TrackId = isValidTrack(savedTrack)
      ? savedTrack
      : "meja-senja";
    const savedVol = Number(localStorage.getItem("coup:music-volume"));
    const initialVol =
      Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1
        ? savedVol
        : 0.35;

    setTrack(initialTrack);
    setVolume(initialVol);
    if (player.current) player.current.volume = initialVol;

    // Restore where autoplay is allowed. Otherwise the switch starts playback on tap.
    if (localStorage.getItem("coup:music") === "on") {
      startTrack(initialTrack, initialVol).catch(() => {});
    }
    return () => {
      stopSynth();
      player.current?.pause();
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      masterRef.current = null;
    };
  }, [startTrack, stopSynth]);

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

  async function togglePlayback() {
    if (on) {
      stopAll();
      localStorage.setItem("coup:music", "off");
      return;
    }
    try {
      await startTrack(track, volume);
      localStorage.setItem("coup:music", "on");
    } catch {
      setError(true);
    }
  }

  async function selectTrack(next: TrackId) {
    setTrack(next);
    localStorage.setItem("coup:music-track", next);
    try {
      await startTrack(next, volume);
      localStorage.setItem("coup:music", "on");
    } catch {
      setError(true);
    }
  }

  function changeVolume(next: number) {
    const clamped = Math.max(0, Math.min(1, next));
    setVolume(clamped);
    localStorage.setItem("coup:music-volume", String(clamped));
    if (player.current) player.current.volume = clamped;
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(
        clamped * 0.45,
        ctxRef.current.currentTime,
        0.03,
      );
    }
  }

  const currentTrack =
    MUSIC_TRACKS.find((t) => t.id === track) ?? MUSIC_TRACKS[0];

  return (
    <div className="music-control" ref={wrap}>
      <audio
        ref={player}
        loop
        preload="none"
        src="/audio/meja-senja.mp3"
        onPlaying={() => {
          if (track === "meja-senja") setOn(true);
        }}
        onPause={() => {
          if (track === "meja-senja") setOn(false);
        }}
      />
      <button
        type="button"
        aria-label="Musik latar"
        aria-expanded={open}
        aria-pressed={on}
        title={
          on
            ? `Musik: ${currentTrack.name} (${Math.round(volume * 100)}%)`
            : "Pengaturan musik latar"
        }
        onClick={() => setOpen((v) => !v)}
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
          <path d="M3 9h4l5-4v14l-5-4H3z" />
          {on && volume > 0 ? (
            <path d="M15 8q4 4 0 8m3-11q7 7 0 14" />
          ) : (
            <path d="m16 9 5 6m0-6-5 6" />
          )}
        </svg>
      </button>
      {open && (
        <div
          className="music-popover"
          role="region"
          aria-label="Kontrol musik latar"
        >
          <div className="music-popover-head">
            <b>Musik latar</b>
            <button
              type="button"
              className="music-toggle-btn"
              aria-pressed={on}
              onClick={togglePlayback}
            >
              {on ? "Matikan" : "Putar"}
            </button>
          </div>
          <label className="music-volume">
            <span>
              Volume <small>{Math.round(volume * 100)}%</small>
            </span>
            <input
              type="range"
              aria-label="Volume musik"
              min="0"
              max="100"
              step="1"
              value={Math.round(volume * 100)}
              onChange={(e) => changeVolume(Number(e.target.value) / 100)}
            />
          </label>
          <div className="music-tracks" role="radiogroup" aria-label="Pilih musik">
            {MUSIC_TRACKS.map((item) => {
              const selected = item.id === track;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="music-track-item"
                  data-selected={selected || undefined}
                  onClick={() => selectTrack(item.id)}
                >
                  <span>
                    <b>{item.name}</b>
                    <small>{item.vibe}</small>
                  </span>
                  {selected && (
                    <span className="music-active-dot" aria-hidden="true">
                      {on ? "♪" : "•"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {error && (
            <small role="alert">Musik gagal diputar. Coba lagi.</small>
          )}
        </div>
      )}
    </div>
  );
}
