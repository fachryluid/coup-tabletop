"use client";
import { useEffect, useRef, useState } from "react";

export function FullscreenButton() {
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const table = button.current?.closest("main");

    const sync = () => {
      const nativeActive = document.fullscreenElement !== null;
      const fallbackActive = root.hasAttribute("data-screen-fit");
      const active = nativeActive || fallbackActive;
      if (table) {
        if (active) table.dataset.screenFit = "true";
        else delete table.dataset.screenFit;
      }
      setExpanded(active);
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.hasAttribute("data-screen-fit")) {
        delete root.dataset.screenFit;
        sync();
      }
    };

    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  async function toggle() {
    const root = document.documentElement;
    const table = button.current?.closest("main");
    if (document.fullscreenElement !== null) {
      delete root.dataset.screenFit;
      await document.exitFullscreen();
    } else if (root.hasAttribute("data-screen-fit")) {
      delete root.dataset.screenFit;
      if (table) delete table.dataset.screenFit;
      setExpanded(false);
    } else {
      try {
        await root.requestFullscreen();
      } catch {
        // Some mobile browsers only allow native fullscreen for video.
        root.dataset.screenFit = "true";
        if (table) table.dataset.screenFit = "true";
        setExpanded(true);
      }
      if (table) table.scrollTop = 0;
    }
  }

  const label = expanded ? "Keluar layar penuh" : "Layar penuh";
  return (
    <button
      ref={button}
      type="button"
      onClick={toggle}
      aria-pressed={expanded}
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d={
            expanded
              ? "M3 9h6V3m6 0v6h6M3 15h6v6m6 0v-6h6"
              : "M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"
          }
        />
      </svg>
    </button>
  );
}
