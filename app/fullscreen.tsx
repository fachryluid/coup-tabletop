import { useEffect, useRef, useState } from "react";

export function FullscreenButton() {
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const table = button.current!.closest("main")!;
    const sync = () =>
      setExpanded(
        document.fullscreenElement === table ||
          table.classList.contains("screen-fit"),
      );
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && table.classList.contains("screen-fit")) {
        table.classList.remove("screen-fit");
        sync();
      }
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", escape);
      table.classList.remove("screen-fit");
      if (document.fullscreenElement === table)
        void document.exitFullscreen().catch(() => {});
    };
  }, []);
  async function toggle() {
    const table = button.current!.closest("main")!;
    if (document.fullscreenElement === table) {
      await document.exitFullscreen();
    } else if (table.classList.contains("screen-fit")) {
      table.classList.remove("screen-fit");
      setExpanded(false);
    } else {
      try {
        await table.requestFullscreen();
      } catch {
        // Some mobile browsers only allow native fullscreen for video.
        table.classList.add("screen-fit");
        setExpanded(true);
      }
      table.scrollTop = 0;
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
