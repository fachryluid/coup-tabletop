"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHANGE_CATEGORY_LABEL, LATEST_PATCH } from "../domain/changelog";

const SEEN_PATCH_KEY = "coup:seen-patch";
const HIGHLIGHT_LIMIT = 4;

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_PATCH_KEY);
      if (seen === LATEST_PATCH.version) return;
      // Record immediately once displayed so it only appears once per version.
      localStorage.setItem(SEEN_PATCH_KEY, LATEST_PATCH.version);
      setVisible(true);
    } catch {
      // Ignore storage errors in restricted browsing modes
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!visible || !dialog) return;
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Fallback if already open or unsupported
      }
    }
  }, [visible]);

  if (!visible) return null;

  const highlights = LATEST_PATCH.changes.slice(0, HIGHLIGHT_LIMIT);
  const remaining = Math.max(0, LATEST_PATCH.changes.length - highlights.length);

  function closeModal() {
    dialogRef.current?.close();
    setVisible(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className="update-banner"
      aria-labelledby="update-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        closeModal();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="update-modal-head">
        <div className="update-modal-heading">
          <div className="update-modal-meta">
            <span className="update-banner-badge">v{LATEST_PATCH.version}</span>
            <time className="update-modal-date">{LATEST_PATCH.date}</time>
          </div>
          <h2 id="update-modal-title">
            Update terbaru versi {LATEST_PATCH.version}
          </h2>
          <p className="update-modal-subtitle">{LATEST_PATCH.title}</p>
        </div>
        <button
          type="button"
          className="update-banner-close"
          aria-label="Tutup pemberitahuan update"
          title="Tutup"
          onClick={closeModal}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="update-modal-body">
        <p className="update-modal-summary">{LATEST_PATCH.summary}</p>
        <ul className="update-modal-list">
          {highlights.map((item, idx) => (
            <li key={idx} className="update-modal-item">
              <span className="patch-cat-tag" data-cat={item.category}>
                {CHANGE_CATEGORY_LABEL[item.category]}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        {remaining > 0 && (
          <p className="update-modal-more">
            + {remaining} pembaruan dan perbaikan lainnya tersedia di halaman
            Catatan Pembaruan.
          </p>
        )}
      </div>

      <div className="update-modal-foot">
        <button
          type="button"
          className="update-modal-dismiss"
          onClick={closeModal}
        >
          Mengerti
        </button>
        <Link
          href="/updates"
          className="update-banner-link"
          onClick={closeModal}
        >
          <span>Lihat detail</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </dialog>
  );
}
