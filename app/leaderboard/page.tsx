import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";
import { LeaderboardView } from "../leaderboard-view";

export const metadata: Metadata = {
  title: "Leaderboard Poin Global | The Ultimate Coup",
  description:
    "Papan peringkat Poin Global pemain The Ultimate Coup untuk mode PvP semua manusia dan semua pertandingan.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage() {
  return (
    <LegalShell
      current="leaderboard"
      pill="Peringkat Global"
      title="Leaderboard"
      updatedAt="Diperbarui otomatis setiap pertandingan selesai"
    >
      <LeaderboardView />
    </LegalShell>
  );
}
