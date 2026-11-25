import type { Metadata } from "next";
import "./style.css";
import "./tabletop.css";
const title = "Coup Digital Tabletop | Main Coup Online Bersama Teman";
const description =
  "Gertak lawan, tantang klaimnya, dan pertahankan kartu terakhirmu. Main Coup di browser untuk 2–6 pemain. Undang teman ke meja privat atau lawan bot.";
const preview = {
  url: "/coup-tabletop.jpg",
  width: 1200,
  height: 630,
  alt: "Coup Digital Tabletop dengan kartu Assassin, Contessa, dan Duke",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://coup.jejakode.com"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Coup Digital Tabletop",
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
