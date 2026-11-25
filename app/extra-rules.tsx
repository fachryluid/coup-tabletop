"use client";
import { useRef, useState } from "react";
import { rules } from "../domain/house-rules";

export type ExtraRuleId = keyof typeof rules;
export type ExtraRuleValues = Record<ExtraRuleId, boolean>;

const allRules = Object.values(rules);

function toValues(input: Partial<ExtraRuleValues>): ExtraRuleValues {
  return {
    one_time_guess: !!input.one_time_guess,
    duke_blocks_tax: !!input.duke_blocks_tax,
  };
}

export function ExtraRules({
  values,
  editable,
  onSave,
}: {
  values: Partial<ExtraRuleValues>;
  editable: boolean;
  onSave?: (next: ExtraRuleValues) => void;
}) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ExtraRuleValues>(() => toValues(values));
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<ExtraRuleId | null>(null);

  const activeRules = allRules.filter((r) => !!values[r.id]);
  const draftCount = allRules.filter((r) => draft[r.id]).length;
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? allRules.filter(
        (r) =>
          r.name.toLowerCase().includes(normalized) ||
          r.shortDescription.toLowerCase().includes(normalized) ||
          r.description.toLowerCase().includes(normalized),
      )
    : allRules;

  function openModal() {
    setDraft(toValues(values));
    setQuery("");
    setDetailId(null);
    modalRef.current?.showModal();
  }

  function closeModal() {
    modalRef.current?.close();
  }

  function save() {
    onSave?.(draft);
    closeModal();
  }

  return (
    <div className="extra-rules">
      <div className="extra-rules-header">
        <h2>Aturan lainnya</h2>
        <span
          className="rules-badge"
          data-active={activeRules.length > 0 || undefined}
        >
          {activeRules.length > 0 ? activeRules.length + " aktif" : "Klasik"}
        </span>
      </div>

      {activeRules.length > 0 ? (
        <ul className="active-rules-chips" aria-label="Aturan aktif">
          {activeRules.map((rule) => (
            <li key={rule.id} className="active-rule-chip">
              <b>{rule.name}</b>
              <small>{rule.shortDescription}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rules-empty">
          Mode klasik aktif. Belum ada aturan tambahan yang dipilih.
        </p>
      )}

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
          {editable ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8M8 12h8" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4m0-4h.01" />
            </>
          )}
        </svg>
        <span>
          {editable ? "Tambahkan aturan lainnya" : "Lihat aturan lainnya"}
        </span>
      </button>

      <dialog
        ref={modalRef}
        className="rules-modal"
        aria-label="Pilih aturan lainnya"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="rules-modal-head">
          <div className="rules-modal-title-group">
            <div className="rules-modal-title-row">
              <h2>Aturan lainnya</h2>
              <span
                className="rules-badge"
                data-active={draftCount > 0 || undefined}
              >
                {draftCount > 0 ? draftCount + " dipilih" : "Klasik"}
              </span>
            </div>
            <small>
              {editable
                ? "Pilih satu atau lebih aturan tambahan untuk pertandingan ini."
                : "Daftar aturan tambahan yang tersedia di meja ini."}
            </small>
          </div>
          <button
            type="button"
            className="icon-btn rules-close-btn"
            aria-label="Tutup modal aturan"
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

        {allRules.length > 4 && (
          <input
            type="search"
            className="rules-search"
            placeholder="Cari aturan lainnya…"
            aria-label="Cari aturan lainnya"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}

        <div className="rules-modal-list" role="list">
          {visible.map((rule) => {
            const checked = editable ? draft[rule.id] : !!values[rule.id];
            const showingDetail = detailId === rule.id;
            return (
              <div
                key={rule.id}
                className="rule-card"
                data-enabled={checked || undefined}
                data-readonly={!editable || undefined}
                role="listitem"
              >
                <div className="rule-row">
                  <label className="rule-select">
                    <span className="toggle-pill" data-checked={checked || undefined}>
                      <input
                        type="checkbox"
                        className="rule-switch"
                        checked={checked}
                        disabled={!editable}
                        onChange={(e) =>
                          setDraft({ ...draft, [rule.id]: e.target.checked })
                        }
                      />
                      <span className="toggle-track" aria-hidden="true">
                        <span className="toggle-thumb" />
                      </span>
                    </span>
                    <span className="rule-copy">
                      <span className="rule-heading">
                        <b>{rule.name}</b>
                      </span>
                      <small>{rule.shortDescription}</small>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="rule-detail-btn with-icon"
                    aria-expanded={showingDetail}
                    onClick={() =>
                      setDetailId(showingDetail ? null : rule.id)
                    }
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 16v-4m0-4h.01" />
                    </svg>
                    <span>{showingDetail ? "Tutup" : "Detail"}</span>
                  </button>
                </div>
                {showingDetail && (
                  <div className="rule-detail-box">
                    <p>{rule.description}</p>
                    <ul>
                      {rule.details.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="rules-empty">Tidak ada aturan yang cocok.</p>
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
              <span>Simpan aturan</span>
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
