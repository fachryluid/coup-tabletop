import type { Metadata } from "next";
import { LegalShell } from "../../legal-shell";
import { ProfileView } from "../../profile-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `@${decoded} | The Ultimate Coup`,
    description: `Profil publik, Poin Global, dan riwayat pertandingan @${decoded} di The Ultimate Coup.`,
  };
}

export default async function PublicPlayerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return (
    <LegalShell
      current="public_profile"
      pill="Profil Publik"
      title={`@${decoded}`}
      updatedAt="Statistik diperbarui otomatis setelah setiap pertandingan"
    >
      <ProfileView mode="public" username={decoded} />
    </LegalShell>
  );
}
