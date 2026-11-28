import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan | The Ultimate Coup",
  description:
    "Syarat & Ketentuan penggunaan layanan, akun Google, username, voice chat, dan privasi di The Ultimate Coup.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell
      current="terms"
      title="Syarat & Ketentuan"
      updatedAt="28 November 2026"
    >
      <section>
        <h2>1. Penerimaan Ketentuan</h2>
        <p>
          Dengan masuk menggunakan akun Google, membuat username, atau bermain
          di <strong>The Ultimate Coup</strong> (
          <code>coup.jejakode.com</code>), Anda menyatakan telah membaca,
          memahami, dan menyetujui seluruh Syarat &amp; Ketentuan ini beserta{" "}
          <Link href="/privacy">Kebijakan Privasi</Link> kami. Jika Anda tidak
          menyetujui ketentuan ini, harap tidak menggunakan layanan.
        </p>
      </section>

      <section>
        <h2>2. Akun Google &amp; Username</h2>
        <ul>
          <li>
            <strong>Login wajib via Google:</strong> Seluruh pemain yang membuat
            maupun bergabung ke meja privat wajib masuk menggunakan akun Google
            yang terverifikasi. Kami tidak menyediakan pendaftaran atau login
            manual dengan kata sandi.
          </li>
          <li>
            <strong>Username akun:</strong> Setiap akun wajib memilih username
            (3–20 karakter huruf kecil, angka, atau underscore) sebagai
            identitas akun di layanan ini. Anda tidak diperkenankan memakai
            username yang meniru pihak lain, bersifat menghina, atau melanggar
            hukum.
          </li>
          <li>
            <strong>Keamanan akun:</strong> Anda bertanggung jawab menjaga
            keamanan akun Google Anda. Pengelola berhak menangguhkan atau
            menghapus akun yang melanggar ketentuan layanan.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Nama Panggilan di Meja &amp; Etika Bermain</h2>
        <ul>
          <li>
            Saat membuat atau bergabung ke meja privat, Anda bebas menggunakan
            nama panggilan (<em>nickname</em>) yang berbeda dari nama maupun
            username akun Google Anda.
          </li>
          <li>
            Anda bertanggung jawab penuh atas perilaku Anda di meja permainan,
            termasuk nama panggilan yang dipilih, penggunaan emote, serta
            komunikasi suara. Dilarang melakukan pelecehan, ujaran kebencian,
            spam, atau upaya memanipulasi/mengeksploitasi celah sistem, koneksi,
            maupun aturan permainan.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Fitur Voice Chat &amp; Emote</h2>
        <p>
          Meja privat menyediakan fitur voice chat opsional berbasis mikrofon
          perangkat Anda. Aliran audio hanya diteruskan secara{" "}
          <em>real-time</em> kepada pemain lain di meja yang sama yang
          mengaktifkan voice chat dan{" "}
          <strong>tidak direkam maupun disimpan</strong> di server kami.
          Indikator visual sedang berbicara ditampilkan agar interaksi meja
          lebih jelas.
        </p>
      </section>

      <section>
        <h2>5. Data Akun &amp; Privasi Dasar</h2>
        <p>
          Pengelolaan data akun Google, cookie sesi terenkripsi (
          <code>HttpOnly</code>), penyimpanan lokal browser, serta hak
          penghapusan data diatur secara rinci dalam{" "}
          <Link href="/privacy">Kebijakan Privasi</Link> kami. Data akun Anda
          tidak diperjualbelikan atau dibagikan kepada pihak ketiga untuk tujuan
          iklan.
        </p>
      </section>

      <section>
        <h2>6. Ketersediaan Layanan</h2>
        <p>
          Layanan ini disediakan sebagaimana adanya (<em>as is</em>) untuk
          kebutuhan hiburan komunitas. Data ruang permainan aktif bersifat
          sementara dan dapat direset saat pemeliharaan atau pembaruan server
          berlangsung. Kami tidak menjamin layanan bebas gangguan setiap saat.
        </p>
      </section>

      <section>
        <h2>7. Hak Kekayaan Intelektual &amp; Status Independen</h2>
        <ul>
          <li>
            <strong>Proyek independen (non-komersial):</strong> The Ultimate
            Coup adalah aplikasi permainan meja digital independen (
            <em>fan-made</em>) untuk hiburan bersama teman di ruang privat yang
            terinspirasi dari mekanisme permainan kartu klasik <em>Coup</em>{" "}
            (karya Rikki Tahta), dengan berbagai pengembangan interaksi dan
            aturan tambahan.
          </li>
          <li>
            <strong>Tidak berafiliasi:</strong> Layanan ini{" "}
            <strong>
              tidak berafiliasi dengan, tidak disponsori oleh, dan tidak
              disahkan oleh
            </strong>{" "}
            Indie Boards &amp; Cards, La Mame Games, maupun pemegang merek
            dagang resmi <em>Coup</em>. Seluruh merek dagang pihak ketiga tetap
            menjadi milik pemiliknya masing-masing.
          </li>
          <li>
            <strong>Aset orisinal pengelola:</strong> Seluruh kode sumber,
            antarmuka, logo, ilustrasi kartu, musik, efek suara, dan teks
            panduan pada situs ini dibuat secara orisinal tanpa menyalin karya
            seni maupun teks buku aturan resmi edisi komersial. Anda dilarang
            mendistribusikan ulang atau menyalahgunakan aset kami tanpa izin.
          </li>
          <li>
            <strong>Keberatan hak cipta/merek:</strong> Apabila Anda adalah
            pemegang hak kekayaan intelektual dan memiliki keberatan atau
            permintaan penyesuaian terkait konten di layanan ini, silakan
            hubungi kami melalui alamat email di bawah untuk penanganan cepat.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Perubahan Ketentuan &amp; Kontak</h2>
        <p>
          Pengelola dapat memperbarui Syarat &amp; Ketentuan ini seiring
          perkembangan fitur layanan. Perubahan akan dicantumkan pada halaman
          ini beserta tanggal pembaruannya. Untuk pertanyaan, laporan bug, atau
          permintaan penghapusan akun, hubungi pengelola di{" "}
          <a href="mailto:jejakodeindonesia@gmail.com">
            jejakodeindonesia@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
