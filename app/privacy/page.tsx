import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | The Ultimate Coup",
  description:
    "Kebijakan Privasi mengenai data akun Google, sesi login, voice chat, penyimpanan lokal, dan hak privasi pengguna di The Ultimate Coup.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell current="privacy" title="Kebijakan Privasi">
      <section>
        <h2>1. Ringkasan Komitmen Privasi</h2>
        <p>
          Kebijakan Privasi ini menjelaskan bagaimana{" "}
          <strong>The Ultimate Coup</strong> (<code>coup.jejakode.com</code>)
          mengumpulkan, menggunakan, menyimpan, dan melindungi informasi Anda
          saat mengakses dan bermain di layanan kami. Kami hanya mengumpulkan
          data seminimal mungkin yang benar-benar diperlukan untuk menjalankan
          akun dan meja permainan privat.
        </p>
      </section>

      <section>
        <h2>2. Data yang Kami Kumpulkan</h2>
        <ul>
          <li>
            <strong>Informasi Akun Google:</strong> Saat Anda masuk dengan
            Google OAuth, kami menerima dan menyimpan ID akun Google (
            <code>sub</code>), alamat email terverifikasi, nama tampilan profil,
            serta tautan foto profil (jika tersedia). Kami tidak pernah meminta
            atau menyimpan kata sandi akun Google Anda.
          </li>
          <li>
            <strong>Username &amp; Persetujuan:</strong> Kami menyimpan username
            yang Anda pilih untuk akun The Ultimate Coup beserta catatan waktu
            persetujuan{" "}
            <Link href="/terms">Syarat &amp; Ketentuan</Link>.
          </li>
          <li>
            <strong>Nama Panggilan di Meja:</strong> Nama panggilan (
            <em>nickname</em>) yang Anda masukkan saat membuat atau bergabung ke
            meja privat hanya digunakan sementara selama ruang permainan aktif
            berjalan.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Cara Kami Menggunakan Data</h2>
        <ul>
          <li>
            Mengautentikasi akun Anda dan menjaga sesi login tetap aman agar
            Anda dapat membuat atau bergabung ke meja privat.
          </li>
          <li>
            Menjaga keunikan identitas username akun dan mencegah penyalahgunaan
            layanan atau spam.
          </li>
          <li>
            Menangani dukungan teknis, laporan bug, atau permintaan penghapusan
            akun yang Anda kirimkan kepada pengelola.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Cookie &amp; Penyimpanan Lokal Browser</h2>
        <ul>
          <li>
            <strong>Cookie Sesi Terenkripsi:</strong> Kami menggunakan cookie{" "}
            <code>HttpOnly</code> (<code>coup_session</code> dan cookie status
            OAuth sementara <code>coup_oauth</code>) untuk menjaga autentikasi
            secara aman. Cookie ini bukan cookie pelacakan iklan.
          </li>
          <li>
            <strong>Local Storage Browser:</strong> Browser Anda menyimpan token
            reconnect sementara per kode meja (agar kursi dan kartu tetap
            terjaga saat refresh atau putus koneksi) serta preferensi audio
            lokal (volume musik dan efek suara).
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Voice Chat, Emote &amp; Data Permainan Sementara</h2>
        <ul>
          <li>
            <strong>Voice Chat Real-Time:</strong> Jika Anda mengaktifkan
            mikrofon untuk voice chat, aliran audio hanya diteruskan secara
            langsung (<em>real-time</em>) kepada peserta lain di meja yang sama
            dan <strong>tidak direkam maupun disimpan</strong> di server kami.
          </li>
          <li>
            <strong>State Meja di Memori:</strong> Data kartu, koin, riwayat
            pertandingan, dan klasemen sesi disimpan sementara di memori server
            selama ruang aktif dan terhapus saat ruang berakhir atau server
            dimulai ulang. Kartu rahasia Anda tidak pernah dikirim ke pemain
            lain.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Berbagi Data dengan Pihak Ketiga</h2>
        <p>
          Kami <strong>tidak menjual, menyewakan, atau membagikan</strong> data
          pribadi Anda kepada pihak ketiga untuk keperluan pemasaran, analitik
          iklan, atau profil komersial. Autentikasi Google hanya digunakan untuk
          verifikasi identitas masuk sesuai standar OAuth 2.0.
        </p>
      </section>

      <section>
        <h2>7. Penyimpanan, Keamanan &amp; Hak Anda</h2>
        <ul>
          <li>
            Akses akun dilindungi dengan sesi bertanda tangan kriptografis serta
            koneksi terenkripsi HTTPS pada lingkungan produksi.
          </li>
          <li>
            Anda berhak meminta informasi mengenai data akun Anda maupun meminta
            penghapusan akun beserta seluruh data terkait kapan saja dengan
            menghubungi pengelola melalui email di bawah.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Perubahan Kebijakan &amp; Kontak</h2>
        <p>
          Kebijakan Privasi ini dapat diperbarui sewaktu-waktu mengikuti
          pembaruan fitur layanan, dengan tanggal pembaruan terbaru tertera di
          bagian atas halaman ini. Jika ada pertanyaan atau permintaan terkait
          privasi, hubungi kami di{" "}
          <a href="mailto:jejakodeindonesia@gmail.com">
            jejakodeindonesia@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
