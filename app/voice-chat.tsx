import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export function VoiceSpeakingBadge({
  showLabel = false,
}: {
  showLabel?: boolean;
}) {
  return (
    <span
      className="voice-indicator"
      role="status"
      aria-label="Sedang berbicara"
      title="Sedang berbicara"
    >
      <span className="voice-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {showLabel && <span className="voice-indicator-text">Berbicara</span>}
    </span>
  );
}

export function VoiceChat({ socket }: { socket: Socket }) {
  const [state, setState] = useState<"off" | "joining" | "live" | "muted">(
    "off",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const session = useRef<AbortController | null>(null);
  const mic = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const stop = () => {
      session.current?.abort();
      session.current = null;
      setMenuOpen(false);
      setState("off");
    };
    socket.on("disconnect", stop);
    return () => {
      socket.off("disconnect", stop);
      stop();
    };
  }, [socket]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function join() {
    if (session.current) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Mikrofon memerlukan HTTPS atau localhost.");
      return;
    }
    const token = new AbortController();
    session.current = token;
    const { signal } = token;
    setState("joining");
    let failure = "Browser gagal mengaktifkan audio.";
    try {
      const audio = new AudioContext();
      signal.addEventListener(
        "abort",
        () => {
          void audio.close();
        },
        { once: true },
      );
      await audio.resume();
      if (signal.aborted) return;
      failure = "Mikrofon gagal dibuka. Periksa perangkat masukan di browser.";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const release = () => stream.getTracks().forEach((track) => track.stop());
      if (signal.aborted) {
        release();
        return;
      }
      signal.addEventListener("abort", release, { once: true });
      const track = stream.getAudioTracks()[0];
      mic.current = track;
      track.onended = () => {
        leave();
        setError("Mikrofon terputus.");
      };
      failure = "Modul audio gagal dimuat. Muat ulang halaman lalu coba lagi.";
      await audio.audioWorklet.addModule("/voice-capture.js");
      if (signal.aborted) return;
      const capture = new AudioWorkletNode(audio, "voice-capture");
      const source = audio.createMediaStreamSource(stream);
      const next = new Map<string, number>();
      function receive(id: string, data: ArrayBuffer) {
        if (
          signal.aborted ||
          audio.state !== "running" ||
          !(data instanceof ArrayBuffer) ||
          data.byteLength !== 1280
        )
          return;
        const at = Math.max(audio.currentTime + 0.012, next.get(id) ?? 0);
        if (at - audio.currentTime > 0.24) return;
        const samples = new Int16Array(data);
        const buffer = audio.createBuffer(1, samples.length, 16000);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          channel[i] = samples[i] / 32768;
        const player = audio.createBufferSource();
        player.buffer = buffer;
        player.connect(audio.destination);
        player.start(at);
        next.set(id, at + buffer.duration);
      }
      socket.on("voice:audio", receive);
      signal.addEventListener(
        "abort",
        () => {
          socket.off("voice:audio", receive);
          if (socket.connected) socket.emit("voice:leave");
          capture.port.close();
          source.disconnect();
          capture.disconnect();
          mic.current = null;
        },
        { once: true },
      );
      failure =
        "Server meja tidak menjawab permintaan voice chat. Periksa koneksi dan pastikan server sudah menjalankan versi dengan fitur voice.";
      const result = await socket.timeout(5000).emitWithAck("voice:join", {});
      if (signal.aborted) return;
      if (!result.ok) {
        failure = result.error || "Server menolak permintaan voice chat.";
        throw Error(failure);
      }
      failure = "Browser gagal menyambungkan aliran audio.";
      capture.port.onmessage = (e) => {
        if (!signal.aborted && track.enabled && socket.connected)
          socket.volatile.emit("voice:audio", e.data);
      };
      source.connect(capture);
      capture.connect(audio.destination);
      setState("live");
    } catch (e) {
      if (signal.aborted) return;
      leave();
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Izinkan mikrofon di browser untuk bergabung."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "Mikrofon tidak ditemukan. Sambungkan atau pilih mikrofon di browser."
            : failure,
      );
    }
  }

  function leave() {
    session.current?.abort();
    session.current = null;
    setMenuOpen(false);
    setState("off");
  }

  function toggleMute() {
    if (mic.current) {
      mic.current.enabled = !mic.current.enabled;
      if (!mic.current.enabled && socket.connected) socket.emit("voice:mute");
      setState(mic.current.enabled ? "live" : "muted");
    }
    setMenuOpen(false);
  }

  const connected = state === "live" || state === "muted";
  const label = {
    off: "Gabung voice chat",
    joining: "Batalkan sambungan voice chat",
    live: "Kontrol voice chat (aktif)",
    muted: "Kontrol voice chat (dibisukan)",
  }[state];

  function handleTriggerClick() {
    if (state === "off") {
      void join();
    } else if (state === "joining") {
      leave();
    } else {
      setMenuOpen((v) => !v);
    }
  }

  return (
    <div className="voice-control" ref={wrapRef}>
      <button
        type="button"
        className="voice-trigger-btn"
        data-voice-state={state}
        aria-label={label}
        title={label}
        aria-pressed={state === "live"}
        aria-expanded={connected ? menuOpen : undefined}
        aria-haspopup={connected ? "menu" : undefined}
        onClick={handleTriggerClick}
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
        >
          {state === "joining" ? (
            <path d="M5 12h.1m6.9 0h.1m6.9 0h.1" strokeWidth="3" />
          ) : (
            <>
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
              {state !== "live" && <path d="m3 3 18 18" />}
            </>
          )}
        </svg>
      </button>
      {connected && menuOpen && (
        <div
          className="voice-popover"
          role="menu"
          aria-label="Menu voice chat"
        >
          <div className="voice-popover-head">
            <b>Voice Chat</b>
            <span
              className="voice-status-pill"
              data-live={state === "live" || undefined}
            >
              {state === "live" ? "Aktif" : "Dibisukan"}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="voice-menu-item"
            onClick={toggleMute}
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
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
              {state === "live" && <path d="m3 3 18 18" />}
            </svg>
            <span>
              {state === "live" ? "Bisukan mikrofon" : "Aktifkan mikrofon"}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="voice-menu-item voice-menu-leave"
            onClick={leave}
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
            <span>Keluar dari voice chat</span>
          </button>
        </div>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
