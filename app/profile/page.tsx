import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";
import { ProfileView } from "../profile-view";

export const metadata: Metadata = {
  title: "Profil Saya | The Ultimate Coup",
  description:
    "Lihat statistik karir, Poin Global, nama panggilan tersimpan, dan riwayat pertandingan Anda di The Ultimate Coup.",
  alternates: { canonical: "/profile" },
};

export default function MyProfilePage() {
  return (
    <LegalShell
      current="profile"
      pill="Profil Pemain"
      title="Profil Saya"
      updatedAt="Statistik diperbarui otomatis setelah setiap pertandingan"
    >
      <ProfileView mode="me" />
    </LegalShell>
  );
}
