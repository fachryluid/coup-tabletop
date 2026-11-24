import "./style.css";
import "./tabletop.css";
export const metadata = {
  title: "Coup · Meja privat",
  description: "Main Coup bersama teman dan computer di meja privat.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
