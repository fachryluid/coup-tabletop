import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";
import { SettingsPanel } from "../settings-panel";

export const metadata: Metadata = {
  title: "Pengaturan | The Ultimate Coup",
  description:
    "Atur musik latar, volume audio, dan efek suara permainan The Ultimate Coup.",
  alternates: { canonical: "/settings" },
};

export default function SettingsPage() {
  return (
    <LegalShell
      current="settings"
      pill="Preferensi"
      title="Pengaturan"
      updatedAt="Tersimpan otomatis di perangkat ini"
    >
      <SettingsPanel />
    </LegalShell>
  );
}
