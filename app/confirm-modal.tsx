"use client";
import { useEffect, useId, useRef } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
}

export function ConfirmModal({
  config,
  onClose,
}: {
  config: ConfirmOptions | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (config) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [config]);

  if (!config) return null;

  const isDanger = (config.tone ?? "danger") === "danger";

  function handleConfirm() {
    const action = config!.onConfirm;
    onClose();
    action();
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="confirm-modal-head">
        <h2 id={titleId}>{config.title}</h2>
        <button
          type="button"
          className="icon-btn rules-close-btn"
          aria-label="Tutup konfirmasi"
          title="Batal"
          onClick={onClose}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p id={descId} className="confirm-modal-body">
        {config.message}
      </p>
      <div className="confirm-modal-foot">
        <button
          type="button"
          className="confirm-cancel-btn"
          onClick={onClose}
        >
          {config.cancelLabel ?? "Batal"}
        </button>
        <button
          type="button"
          className={isDanger ? "confirm-danger-btn" : "primary"}
          onClick={handleConfirm}
        >
          {config.confirmLabel ?? "Ya, lanjutkan"}
        </button>
      </div>
    </dialog>
  );
}
