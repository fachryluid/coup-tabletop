"use client";
import { useRef, useState } from "react";
import { roles } from "../domain/model";
import {
  CARD_THEMES,
  CARD_THEME_MAP,
  cardImage,
  type CardThemeId,
} from "../domain/card-themes";

export function CardThemePicker({
  value,
  editable,
  onChange,
}: {
  value: CardThemeId;
  editable: boolean;
  onChange: (next: CardThemeId) => void;
}) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CardThemeId>(value);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<CardThemeId | null>(null);

  const active = CARD_THEME_MAP[value] ?? CARD_THEMES[0];
  const draftTheme = CARD_THEME_MAP[draft] ?? CARD_THEMES[0];
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? CARD_THEMES.filter(
        (t) =>
          t.name.toLowerCase().includes(normalized) ||
          t.description.toLowerCase().includes(normalized),
      )
    : CARD_THEMES;

  function openModal() {
    setDraft(value);
    setQuery("");
    setPreviewId(null);
    modalRef.current?.showModal();
  }

  function closeModal() {
    modalRef.current?.close();
  }

  function save() {
    if (draft !== value) onChange(draft);
    closeModal();
  }

  return (
    <div className="card-theme-picker">
      <div className="extra-rules-header">
        <h2>Tipe kartu</h2>
        <span
          className="rules-badge"
          data-active={value !== "classic" || undefined}
        >
          {active.name}
        </span>
      </div>

      <div className="active-theme-summary">
        <span className="theme-preview-fan" aria-hidden="true">
          {active.preview.map((src, idx) => (
            <img
              key={src + idx}
              src={src}
              alt=""
              width={34}
              height={50}
              draggable={false}
            />
          ))}
        </span>
        <span className="theme-copy">
          <b>{active.name}</b>
          <small>{active.description}</small>
        </span>
      </div>

      <button
        type="button"
        className="rules-open-btn with-icon"
        onClick={openModal}
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
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="11" height="15" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h9a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1h-1" />
        </svg>
        <span>{editable ? "Pilih tipe kartu" : "Lihat tipe kartu"}</span>
      </button>

      <dialog
        ref={modalRef}
        className="rules-modal theme-modal"
        aria-label="Pilih tipe kartu"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="rules-modal-head">
          <div className="rules-modal-title-group">
            <div className="rules-modal-title-row">
              <h2>Tipe kartu</h2>
              <span
                className="rules-badge"
                data-active={
                  (editable ? draft : value) !== "classic" || undefined
                }
              >
                {editable ? draftTheme.name : active.name}
              </span>
            </div>
            <small>
              {editable
                ? "Pilih desain kartu untuk pertandingan ini."
                : "Daftar desain kartu yang tersedia di meja ini."}
            </small>
          </div>
          <button
            type="button"
            className="icon-btn rules-close-btn"
            aria-label="Tutup modal tipe kartu"
            title="Tutup"
            onClick={closeModal}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
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

        {CARD_THEMES.length > 4 && (
          <input
            type="search"
            className="rules-search"
            placeholder="Cari tipe kartu…"
            aria-label="Cari tipe kartu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}

        <div
          className="rules-modal-list"
          role="radiogroup"
          aria-label="Daftar tipe kartu"
        >
          {visible.map((theme) => {
            const selected = (editable ? draft : value) === theme.id;
            const showingPreview = previewId === theme.id;
            return (
              <div
                key={theme.id}
                className="rule-card theme-option-card"
                data-enabled={selected || undefined}
                data-readonly={!editable || undefined}
              >
                <div className="theme-option-row">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!editable && !selected}
                    className="theme-option-select"
                    onClick={() => {
                      if (editable) setDraft(theme.id);
                    }}
                  >
                    <span className="theme-preview-fan" aria-hidden="true">
                      {theme.preview.map((src, idx) => (
                        <img
                          key={src + idx}
                          src={src}
                          alt=""
                          width={34}
                          height={50}
                          draggable={false}
                        />
                      ))}
                    </span>
                    <span className="theme-copy">
                      <span className="theme-title-row">
                        <b>{theme.name}</b>
                        {selected && (
                          <span className="theme-check" aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </span>
                      <small>{theme.description}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rule-detail-btn with-icon"
                    aria-expanded={showingPreview}
                    onClick={() =>
                      setPreviewId(showingPreview ? null : theme.id)
                    }
                  >
                    <span>{showingPreview ? "Tutup" : "Lihat"}</span>
                  </button>
                </div>
                {showingPreview && (
                  <div className="theme-gallery" aria-label={"Pratinjau " + theme.name}>
                    {roles.map((role) => (
                      <figure key={role} className="theme-gallery-item">
                        <img
                          src={cardImage(role, theme.id, 0)}
                          alt={role}
                          width={100}
                          height={146}
                          draggable={false}
                        />
                        <figcaption>{role}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="rules-empty">Tidak ada tipe kartu yang cocok.</p>
          )}
        </div>

        {editable && (
          <div className="rules-modal-foot">
            <button type="button" className="primary with-icon" onClick={save}>
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>Simpan tipe kartu</span>
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
