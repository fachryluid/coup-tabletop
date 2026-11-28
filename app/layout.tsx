import type { Metadata } from "next";
import "./style.css";
import "./tabletop.css";
const title = "The Ultimate Coup | Main Coup Online Bersama Teman";
const description =
  "Gertak lawan, tantang klaimnya, dan pertahankan kartu terakhirmu di The Ultimate Coup. Main di browser untuk 2–6 pemain — undang teman ke meja privat atau lawan bot.";
const preview = {
  url: "/the-ultimate-coup.jpg",
  width: 1200,
  height: 630,
  alt: "The Ultimate Coup dengan logo mahkota emas serta kartu Assassin, Contessa, dan Duke",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://coup.jejakode.com"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "The Ultimate Coup",
    url: "/",
    title,
    description,
    images: [preview],
  },
  twitter: { card: "summary_large_image", title, description, images: [preview] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
