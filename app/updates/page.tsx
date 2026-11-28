import type { Metadata } from "next";
import {
  CHANGE_CATEGORY_LABEL,
  LATEST_PATCH,
  PATCH_NOTES,
} from "../../domain/changelog";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = {
  title: "Catatan Pembaruan | The Ultimate Coup",
  description: `Riwayat pembaruan dan rincian patch The Ultimate Coup dari versi awal hingga versi terbaru v${LATEST_PATCH.version}.`,
  alternates: { canonical: "/updates" },
};

export default function UpdatesPage() {
  return (
    <LegalShell
      current="updates"
      pill="Riwayat Patch"
      title="Catatan Pembaruan"
      updatedAt={`${LATEST_PATCH.date} · Versi terbaru v${LATEST_PATCH.version}`}
    >
      <div className="patch-timeline">
        {PATCH_NOTES.map((release, idx) => {
          const isLatest = idx === 0;
          return (
            <section
              key={release.version}
              id={`v${release.version}`}
              className={
                isLatest ? "patch-entry patch-entry-latest" : "patch-entry"
              }
            >
              <div className="patch-entry-head">
                <div className="patch-version-row">
                  <span className="patch-version-tag">v{release.version}</span>
                  {isLatest && (
                    <span className="patch-latest-tag">Terbaru</span>
                  )}
                  <time className="patch-date">{release.date}</time>
                </div>
                <h2>{release.title}</h2>
                <p className="patch-summary">{release.summary}</p>
              </div>
              <ul className="patch-change-list">
                {release.changes.map((item, changeIdx) => (
                  <li key={changeIdx} className="patch-change-item">
                    <span
                      className="patch-cat-tag"
                      data-cat={item.category}
                    >
                      {CHANGE_CATEGORY_LABEL[item.category]}
                    </span>
                    <span className="patch-change-text">{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </LegalShell>
  );
}
