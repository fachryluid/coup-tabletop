export type ChangeCategory = "baru" | "peningkatan" | "perbaikan";

export interface PatchChange {
  category: ChangeCategory;
  text: string;
}

export interface PatchRelease {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly PatchChange[];
}

export const CHANGE_CATEGORY_LABEL: Record<ChangeCategory, string> = {
  baru: "Baru",
  peningkatan: "Peningkatan",
  perbaikan: "Perbaikan",
};

export const PATCH_NOTES: readonly PatchRelease[] = [
  {
    version: "1.3.0",
    date: "28 November 2026",
    title:
      "The Ultimate Coup, Akun Google, Profil & Leaderboard Poin Global",
    summary:
      "Identitas baru The Ultimate Coup dengan login Google, profil pemain beserta Julukan Gaya Bermain, leaderboard Poin Global PvP Murni & Mingguan, riwayat match lengkap, saran nama panggilan otomatis, halaman Pengaturan audio berikon, serta penyempurnaan meja dan layar penuh.",
    changes: [
      {
        category: "baru",
        text: "Rebranding resmi menjadi The Ultimate Coup beserta logo emblem mahkota emas, favicon browser, belakang kartu baru, dan pratinjau tautan media sosial.",
      },
      {
        category: "baru",
        text: "Login akun Google dengan username akun (nama panggilan di meja tetap bebas), avatar foto profil Google di header dan kursi lobi, serta menu profil yang tetap tampil saat belum login dengan tombol Masuk dengan Google.",
      },
      {
        category: "baru",
        text: "Halaman Leaderboard Poin Global (/leaderboard) dengan kategori PvP (Semua Manusia) dan Semua Match, filter periode Mingguan (reset Senin 00:00 WIB) dan Sepanjang Masa, podium Top 3, serta strip Posisi Kamu.",
      },
      {
        category: "baru",
        text: "Halaman Profil Saya (/profile) dan Profil Publik (/u/[username]) berisi statistik karir, Julukan Gaya Bermain otomatis beserta modal penjelasan 8 julukan, serta Riwayat Pertandingan dengan filter dan detail seluruh peserta.",
      },
      {
        category: "baru",
        text: "Riwayat & Saran Nama Panggilan otomatis saat membuat meja, bergabung, atau mengganti nama di lobi — mendukung isi otomatis nama terakhir, chip saran tersering, filter ketik, serta hapus saran di halaman profil.",
      },
      {
        category: "baru",
        text: "Sistem perolehan poin dinamis berdasarkan jumlah pemain (2–6 pemain) serta bonus +1 poin tambahan untuk pemain yang tebakannya benar pada aturan One-Time Guess.",
      },
      {
        category: "baru",
        text: "Halaman Pengaturan Audio (/settings) dengan ikon tematik tiap trek musik, indikator equalizer aktif, tombol bisukan cepat, dan pratinjau efek suara per kategori (Kartu, Koin, Tantangan), ditambah halaman Catatan Pembaruan (/updates), Syarat & Ketentuan (/terms), dan Kebijakan Privasi (/privacy).",
      },
      {
        category: "baru",
        text: "Nama Computer/bot dipilih acak unik dari 60 nama terkurasi tanpa bentrok di satu meja, serta tombol Kembali ke game di header ketika membuka halaman lain saat masih berada di room.",
      },
      {
        category: "peningkatan",
        text: "Tata letak desktop Profil, Leaderboard, dan Pengaturan memakai sidebar navigasi kiri dan kartu konten kanan; header seluruh halaman kini seragam (full-width dan sejajar); menu meja menggunakan modal terpusat dengan konfirmasi kustom.",
      },
      {
        category: "peningkatan",
        text: "Kontrol mikrofon Voice Chat diringkas menjadi satu ikon dengan menu Bisukan mikrofon serta Keluar dari voice chat.",
      },
      {
        category: "perbaikan",
        text: "Pengaturan suara kini langsung aktif/berhenti seketika tanpa perlu refresh halaman, dan mode Layar Penuh (Fullscreen) tetap bertahan saat berpindah antar halaman di dalam aplikasi.",
      },
      {
        category: "perbaikan",
        text: "Indikator berbicara Voice Chat in-game tidak lagi menggeser nama pemain, serta perbaikan tampilan onboarding @username dan halaman dokumen legal.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "25 November 2026",
    title: "Aturan Tambahan, Tipe Kartu, Voice Chat & Statistik Partai",
    summary:
      "Penambahan aturan tongkrongan bawaan, pilihan desain kartu, komunikasi suara meja, emote interaktif, serta ringkasan statistik akhir partai.",
    changes: [
      {
        category: "baru",
        text: "Dua aturan tambahan bawaan di lobi: One-Time Guess (tebak kartu kiri/kanan lawan sekali per pertandingan) dan Duke Blocks Tax.",
      },
      {
        category: "baru",
        text: "Aksi Switch untuk menukar posisi kartu kiri ↔ kanan maksimal sekali per giliran tanpa menghabiskan giliran, serta pemilihan kartu kiri/kanan saat Coup.",
      },
      {
        category: "baru",
        text: "Pemilih Tipe Kartu di lobi (Klasik dan Custom 1) lengkap dengan pratinjau galeri 5 karakter.",
      },
      {
        category: "baru",
        text: "Voice Chat meja real-time dengan indikator berbicara, Emote in-game, efek suara (SFX), dan kontrol musik latar.",
      },
      {
        category: "baru",
        text: "Layar akhir pertandingan dengan Klasemen Sesi serta Statistik & Penghargaan Partai otomatis.",
      },
      {
        category: "peningkatan",
        text: "Tampilan tumpukan koin 3D yang menyatu dengan meja, kas istana 1:1 di dekat dek, dan panduan Cara Bermain di halaman awal.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "20 November 2026",
    title: "Bot Strategis, Timer Hybrid & Kontrol Host",
    summary:
      "Dukungan bermain solo atau campuran melawan Computer berstrategi, timer respons opsional, serta kendali moderat untuk host.",
    changes: [
      {
        category: "baru",
        text: "Fitur Tambah Computer di lobi (hingga 6 peserta total) dengan tingkat kesulitan Easy, Normal, dan Hard yang dapat diatur per bot.",
      },
      {
        category: "baru",
        text: "Mode Response Timer Hybrid: mati secara default, atau batas 30 detik per jendela respons yang dihitung otoritatif di server saat diaktifkan.",
      },
      {
        category: "baru",
        text: "Kontrol Host moderat: jeda/lanjutkan pertandingan, akhiri fase respons manual (saat timer mati), koreksi koin beralasan, undo aman untuk Income, dan akhiri partai.",
      },
      {
        category: "baru",
        text: "Narator Bentara Istana serta riwayat pertandingan kronologis lengkap yang dapat disalin.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "15 November 2026",
    title: "Rilis Awal Meja Privat",
    summary:
      "Fondasi permainan meja digital Coup klasik untuk 2–6 pemain melalui browser tanpa instalasi.",
    changes: [
      {
        category: "baru",
        text: "Pembuatan dan gabung meja privat dengan kode atau tautan undangan untuk 2–6 pemain.",
      },
      {
        category: "baru",
        text: "Mesin aturan Coup klasik di server: Income, Foreign Aid, Coup, Tax, Assassinate, Steal, Exchange, Challenge, Block, reveal, dan eliminasi.",
      },
      {
        category: "baru",
        text: "Sinkronisasi real-time via Socket.IO, pemulihan sesi (reconnect) aman per kursi, dan tata letak responsif untuk HP maupun desktop.",
      },
    ],
  },
] as const;

export const LATEST_PATCH = PATCH_NOTES[0];
