import { useRef, useState, useEffect } from "react";
export function Music() {
  const player = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    const audio = player.current!;
    audio.volume = 0.24;
    // Restore where autoplay is allowed. Otherwise the switch starts playback on tap.
    if (localStorage.getItem("coup:music") === "on")
      audio.play().catch(() => {});
    return () => audio.pause();
  }, []);
  async function toggle() {
    const audio = player.current!;
    if (!audio.paused) {
      audio.pause();
      localStorage.setItem("coup:music", "off");
      return;
    }
    try {
      setError(false);
      await audio.play();
      localStorage.setItem("coup:music", "on");
    } catch {
      setError(true);
    }
  }
  return (
    <div className="music-control">
      <audio
        ref={player}
        loop
        preload="none"
        src="/audio/meja-senja.mp3"
        onPlaying={() => setOn(true)}
        onPause={() => setOn(false)}
      />
      <button
        aria-label="Musik latar"
        aria-pressed={on}
        title={on ? "Matikan musik latar" : "Nyalakan musik latar"}
        onClick={toggle}
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
          {on ? (
            <path d="M15 8q4 4 0 8m3-11q7 7 0 14" />
          ) : (
            <path d="m16 9 5 6m0-6-5 6" />
          )}
        </svg>
      </button>
      {error && <small role="alert">Musik gagal diputar. Coba lagi.</small>}
    </div>
  );
}
