"use client";
import { useEffect, useRef, useState } from "react";
import {
  MUSIC_TRACKS,
  notifyAudioSettings,
  type TrackId,
} from "./music";
import {
  isSfxEnabled,
  playCardPlace,
  playCardSwap,
  playChallengeHit,
  playCoinLand,
  setSfxEnabled,
  warmUpSfx,
} from "./sound-effects";

function SpeakerIcon({
  level,
  size = 20,
}: {
  level: "off" | "low" | "mid" | "high";
  size?: number;
}) {
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
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {level === "off" && <path d="m16 9 5 6m0-6-5 6" />}
      {level === "low" && <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />}
      {level === "mid" && (
        <>
          <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18.2 7a7 7 0 0 1 0 10" />
        </>
      )}
      {level === "high" && (
        <>
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M17.8 7a7 7 0 0 1 0 10" />
          <path d="M20.5 4.8a10 10 0 0 1 0 14.4" />
        </>
      )}
    </svg>
  );
}

function TrackIcon({ id }: { id: TrackId }) {
  switch (id) {
    case "meja-senja":
      return (
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v2m-7 9h14M6.3 7.3l1.4 1.4m10-1.4-1.4 1.4" />
          <path d="M8 14a4 4 0 0 1 8 0" />
          <path d="M3 18h18" />
        </svg>
      );
    case "balairung-malam":
      return (
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 18h18l-1.5-10-4 4-3.5-6-3.5 6-4-4L3 18Z" />
          <path d="M5 21h14" />
        </svg>
      );
    case "ruang-rahasia":
      return (
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
          <path d="M16 4v3m-1.5-1.5h3" />
        </svg>
      );
    case "intrik-istana":
      return (
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      );
    case "santai-meja":
      return (
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 11h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-4Z" />
          <path d="M16 12h2a2.5 2.5 0 0 1 0 5h-2" />
          <path d="M7 7c0-1.5 1-1.5 1-3m4 3c0-1.5 1-1.5 1-3" />
        </svg>
      );
  }
}

export function SettingsPanel() {
  const [musicOn, setMusicOn] = useState(false);
  const [track, setTrack] = useState<TrackId>("meja-senja");
  const [volume, setVolume] = useState(0.45);
  const [sfx, setSfx] = useState(true);
  const [ready, setReady] = useState(false);
  const lastAudibleVolume = useRef(0.45);

  useEffect(() => {
    try {
      setMusicOn(localStorage.getItem("coup:music") === "on");
      const savedTrack = localStorage.getItem("coup:music-track");
      if (savedTrack && MUSIC_TRACKS.some((t) => t.id === savedTrack)) {
        setTrack(savedTrack as TrackId);
      }
      const rawVol = localStorage.getItem("coup:music-volume");
      if (rawVol !== null && rawVol.trim() !== "") {
        const savedVol = Number(rawVol);
        if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) {
          setVolume(savedVol);
          if (savedVol > 0.05) lastAudibleVolume.current = savedVol;
        }
      }
      setSfx(isSfxEnabled());
    } catch {
      // Ignore storage access errors
    }
    setReady(true);
  }, []);

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    try {
      localStorage.setItem("coup:music", next ? "on" : "off");
    } catch {
      // Ignore
    }
    notifyAudioSettings({ kind: "music", enabled: next, track, volume });
  }

  function selectTrack(next: TrackId) {
    setTrack(next);
    setMusicOn(true);
    try {
      localStorage.setItem("coup:music-track", next);
      localStorage.setItem("coup:music", "on");
    } catch {
      // Ignore
    }
    notifyAudioSettings({ kind: "track", track: next, enabled: true, volume });
  }

  function changeVolume(next: number) {
    const clamped = Math.max(0, Math.min(1, next));
    if (clamped > 0.05) lastAudibleVolume.current = clamped;
    setVolume(clamped);
    try {
      localStorage.setItem("coup:music-volume", String(clamped));
    } catch {
      // Ignore
    }
    notifyAudioSettings({ kind: "volume", volume: clamped });
  }

  function toggleMuteVolume() {
    if (volume > 0.005) {
      changeVolume(0);
    } else {
      changeVolume(lastAudibleVolume.current || 0.45);
    }
  }

  function toggleSfx() {
    const next = !sfx;
    setSfx(next);
    setSfxEnabled(next);
    notifyAudioSettings({ kind: "sfx", enabled: next });
    if (next) {
      warmUpSfx();
      playCoinLand(0);
    }
  }

  function testSfxAll() {
    warmUpSfx();
    playCardPlace();
    setTimeout(() => playCoinLand(1), 140);
  }

  const volPercent = Math.round(volume * 100);
  const volLevel: "off" | "low" | "mid" | "high" =
    volPercent <= 0
      ? "off"
      : volPercent <= 35
        ? "low"
        : volPercent <= 70
          ? "mid"
          : "high";
  const sfxAudible = sfx && volume > 0.005;

  return (
    <div className="settings-stack" data-ready={ready || undefined}>
      <section className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-lead">
            <span
              className="settings-icon-emblem"
              data-active={(musicOn && volPercent > 0) || undefined}
              aria-hidden="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </span>
            <div>
              <h2>Musik Latar</h2>
              <p className="settings-desc">
                Musik suasana meja The Ultimate Coup — langsung aktif atau mati
                seketika saat diubah.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="settings-toggle-btn"
            aria-pressed={musicOn}
            onClick={toggleMusic}
          >
            <SpeakerIcon level={musicOn ? (volLevel === "off" ? "low" : volLevel) : "off"} size={17} />
            <span>{musicOn ? "Aktif" : "Nonaktif"}</span>
          </button>
        </div>

        <div className="settings-volume-row">
          <div className="settings-volume-label">
            <span className="settings-volume-title">
              <SpeakerIcon level={volLevel} size={17} />
              <span>Volume audio</span>
            </span>
            <strong>{volPercent}%</strong>
          </div>
          <div className="settings-slider-wrap">
            <button
              type="button"
              className="settings-mute-btn"
              onClick={toggleMuteVolume}
              aria-label={volPercent > 0 ? "Bisukan audio" : "Pulihkan volume"}
              title={volPercent > 0 ? "Bisukan (0%)" : "Pulihkan volume"}
            >
              <SpeakerIcon level={volLevel} size={18} />
            </button>
            <input
              type="range"
              aria-label="Volume audio"
              min="0"
              max="100"
              step="1"
              value={volPercent}
              onChange={(e) => changeVolume(Number(e.target.value) / 100)}
            />
            <span className="settings-vol-max-icon" aria-hidden="true">
              <SpeakerIcon level="high" size={18} />
            </span>
          </div>
        </div>

        <div className="settings-tracks-wrap">
          <span className="settings-sublabel">
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
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
            <span>Pilihan musik latar</span>
          </span>
          <div
            className="settings-tracks-grid"
            role="radiogroup"
            aria-label="Pilihan musik latar"
          >
            {MUSIC_TRACKS.map((item) => {
              const active = track === item.id;
              const playing = active && musicOn && volPercent > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className="settings-track-card"
                  data-active={active || undefined}
                  data-playing={playing || undefined}
                  onClick={() => selectTrack(item.id)}
                >
                  <span className="settings-track-icon" aria-hidden="true">
                    <TrackIcon id={item.id} />
                  </span>
                  <span className="settings-track-body">
                    <span className="settings-track-top">
                      <b>{item.name}</b>
                      {active && (
                        <span className="settings-track-badge">
                          {playing ? (
                            <>
                              <span
                                className="settings-eq-bars"
                                aria-hidden="true"
                              >
                                <i />
                                <i />
                                <i />
                              </span>
                              <span>Diputar</span>
                            </>
                          ) : (
                            <span>Dipilih</span>
                          )}
                        </span>
                      )}
                    </span>
                    <small>{item.vibe}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-lead">
            <span
              className="settings-icon-emblem"
              data-active={sfxAudible || undefined}
              aria-hidden="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4m0 12v4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.6-8.6 2.8-2.8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <div>
              <h2>Efek Suara (SFX)</h2>
              <p className="settings-desc">
                Suara kartu, koin, klik tombol, challenge, dan reaksi emote di
                meja.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="settings-toggle-btn"
            aria-pressed={sfx}
            onClick={toggleSfx}
          >
            {sfx ? (
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
                <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                <path d="m2 2 20 20" />
              </svg>
            )}
            <span>{sfx ? "Aktif" : "Nonaktif"}</span>
          </button>
        </div>

        <div className="settings-sfx-grid" role="group" aria-label="Pratinjau efek suara">
          <button
            type="button"
            className="settings-sfx-chip"
            disabled={!sfxAudible}
            onClick={() => {
              warmUpSfx();
              playCardSwap();
            }}
          >
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
              <rect x="6" y="3" width="12" height="18" rx="2" />
              <path d="M10 8h4m-4 4h4" />
            </svg>
            <span>Kartu</span>
          </button>

          <button
            type="button"
            className="settings-sfx-chip"
            disabled={!sfxAudible}
            onClick={() => {
              warmUpSfx();
              playCoinLand(0);
              setTimeout(() => playCoinLand(2), 110);
            }}
          >
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
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span>Koin</span>
          </button>

          <button
            type="button"
            className="settings-sfx-chip"
            disabled={!sfxAudible}
            onClick={() => {
              warmUpSfx();
              playChallengeHit();
            }}
          >
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
              <path d="M12 3 4 7v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7l-8-4Z" />
              <path d="m9.5 12 2 2 3.5-4" />
            </svg>
            <span>Tantangan</span>
          </button>

          <button
            type="button"
            className="settings-test-btn"
            disabled={!sfxAudible}
            onClick={testSfxAll}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 5.5v13l11-6.5-11-6.5Z" />
            </svg>
            <span>Tes efek suara</span>
          </button>
        </div>

        <small className="settings-hint">
          {sfx && volPercent === 0
            ? "Volume audio sedang 0% — geser volume ke atas untuk mendengar efek suara."
            : "Preferensi tersimpan otomatis di browser Anda dan langsung berlaku di lobi maupun pertandingan."}
        </small>
      </section>
    </div>
  );
}
