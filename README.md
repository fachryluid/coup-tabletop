# The Ultimate Coup

Permainan **The Ultimate Coup** untuk 2–6 kursi dalam room privat. Setiap peserta manusia memakai browser sendiri. Host bisa mengisi kursi dengan computer Easy, Normal, atau Hard.

## Bermain lokal

Gunakan Node.js 22.22 atau lebih baru pada seri 22 dan npm. Dari direktori proyek jalankan:

```sh
npm ci
npm run dev
```

Buka http://localhost:3000. Untuk bermain dari HP di Wi-Fi yang sama, buka alamat IP LAN komputer server pada port 3000. Buat room dari alamat LAN itu agar tautan undangan dapat dibuka peserta lain. Port dapat diganti melalui variabel lingkungan `PORT`.

Setelah memperbarui kode aturan di `domain/` atau server di `server/`, selesaikan pertandingan aktif lalu mulai ulang `npm run dev`. Room dan klasemen disimpan di memori proses.

**Demo solo:** isi nama, pilih **Buat room → Tambah computer → Mulai pertandingan**. Setiap keputusan yang sah muncul di meja Anda. Ketika perlu memilih target, pilih aksi dahulu lalu target. Pertandingan selesai saat satu kursi masih memiliki influence. Host dapat memilih Main lagi atau kembali ke lobi untuk mengatur kursi dan timer.

**House rules:** One-Time Guess dan Duke Blocks Tax dipilih melalui daftar aturan saat host membuat meja. Keduanya mulai OFF. Timer merupakan pengaturan terpisah yang juga mulai OFF. Pengaturan dikunci ketika kartu dibagikan. Log publik mencatat respons dan intervensi host.

Saat Steal diumumkan, target langsung memilih Pass, Challenge, Block dengan Ambassador, atau Block dengan Captain. Pass mengizinkan pengambilan hingga dua koin. Untuk Assassinate, target dapat memilih Pass, Challenge, atau Block dengan Contessa. Setiap Challenge terhadap aksi atau blok membatalkan aksi asal. Pihak yang kalah kehilangan satu influence. Biaya deklarasi tetap terpakai. Pada One-Time Guess yang tepat, satu kartu target dibuka, target mengakui tebakan, lalu kartunya gugur. Pengumuman sistem disampaikan oleh Bentara Istana.

## Server dan penyimpanan

Next.js dan Socket.IO berjalan pada satu proses Node. Jalankan `npm run build` lalu `npm start` untuk memakai build produksi. Konfigurasi Docker produksi dan prosedur rollout ada di bagian berikut.

- **Database persisten (`server/db/`)**: memakai **SQLite bawaan Node 22 (`node:sqlite`, WAL mode)** di `data/coup.db` (di-mount ke `./data:/app/data` di Docker). Skema bermigrasi otomatis (`schema_migrations`) mencakup tabel `accounts`, `matches`, `match_participants`, dan `player_stats` untuk fondasi akun, statistik permanen, dan leaderboard global. Jika ada file legacy `data/accounts.json`, datanya diimpor otomatis saat startup pertama.
- **Siap migrasi ke PostgreSQL / MySQL**: seluruh akses data dibungkus di balik interface `AppDatabase` (`AccountStore` + `StatsRepository`) dengan DDL standar ANSI-SQL dan ID UUID. Ekspor snapshot JSON portabel kapan saja lewat `npm run db:export -- --out backup.json`.
- **Room aktif (in-memory)**: state meja yang sedang berjalan tetap berada di RAM proses Node (1 replika) untuk latensi real-time rendah. Refresh dan putus koneksi mempertahankan kursi selama proses server hidup; hasil pertandingan yang selesai langsung dicatat ke SQLite.

## Docker produksi

Target produksi adalah **coup.jejakode.com** di VPS Jejakode. Satu container Coup menjalankan Next.js dan Socket.IO. Proxy bersama meneruskan HTTPS dan WebSocket ke port internal 3000 melalui jaringan Docker eksternal `shared-network`. Hanya proxy yang menerbitkan port ke host. Room game berada di RAM, sehingga instalasi ini hanya membutuhkan satu replika dan tidak memerlukan database MySQL atau migrasi.

Sebagai perkiraan awal untuk beberapa meja privat, sisakan sekitar 1 vCPU dan RAM 1 GB untuk runtime. Jika build dilakukan di VPS, sediakan sekitar 2 vCPU dan RAM 4 GB saat build. Kapasitas aktual perlu diukur bersama beban layanan Jejakode lainnya.

| Sumber | Fakta deployment |
| --- | --- |
| USER-CONFIRMED | Domain tujuan adalah `coup.jejakode.com` di VPS Jejakode. |
| DOCUMENTED-DEFAULT | Playbook Jejakode mencantumkan `nginx-proxy`, `nginx-proxy-acme`, dan jaringan eksternal `shared-network`. |
| REPO-VERIFIED | Compose mengekspos port internal 3000 dan meneruskan domain ke proxy serta ACME. |

### Instalasi pertama

1. Siapkan DNS record A untuk `coup` di zona `jejakode.com` ke alamat IPv4 VPS. Jika ada record AAAA, pastikan IPv6 juga mengarah ke VPS dan dapat menerima HTTPS.
2. Periksa `dig +short coup.jejakode.com`, `docker network inspect shared-network`, dan status container `nginx-proxy` serta `nginx-proxy-acme` sebelum menjalankan aplikasi. Kedua dokumen operasional Jejakode menjelaskan topologi ini; status aktual diperiksa di VPS.
3. Pada direktori rilis, salin `.env.production.example` menjadi `.env.production` saat instalasi pertama, jalankan `chmod 600 .env.production`, dan isi `ACME_EMAIL` dengan email pengelola sertifikat. `COUP_DOMAIN` digunakan bersama untuk routing dan nama sertifikat.
4. Jalankan `bash redeploy.sh rilis-001`. Skrip hanya mengelola proyek Compose `coup-tabletop`. Development lokal tetap menggunakan `npm run dev`.

### Rilis berikutnya dan pemulihan

Selesaikan pertandingan lebih dahulu dan jadwalkan jeda singkat. Gunakan sumber rilis yang sudah dipilih (commit atau arsip) dan pertahankan `.env.production` di VPS. Simpan salinan konfigurasi itu di lokasi privat. Tidak ada migrasi, data unggahan, atau backup room yang dapat dipulihkan pada versi in-memory ini. Untuk layanan yang wajib mempertahankan permainan lintas restart, implementasikan penyimpanan state dan pemulihan timer sebelum rollout.

Panggil skrip dengan tag baru, misalnya `bash redeploy.sh rilis-002`. Skrip memvalidasi Compose, menandai image sebelumnya, membangun dari file yang sudah disiapkan, mengganti service `tabletop`, menunggu healthcheck, lalu memeriksa handshake Socket.IO. Ia tidak menarik perubahan Git. Setelah itu cek dari luar VPS:

```bash
curl -fsS https://coup.jejakode.com/healthz
curl -fsS 'https://coup.jejakode.com/socket.io/?EIO=4&transport=polling'
```

Respons pertama adalah `ok`; respons kedua dimulai dengan `0{`. Buka dua browser melalui HTTPS, bergabung ke satu room, dan pastikan aksi tersinkron serta koneksi WebSocket memperoleh status 101 di Network. Jika healthcheck atau jalur bermain gagal setelah penggantian, periksa log service dan gunakan tag cadangan yang dicetak skrip. Contoh rollback rilis di atas:

```bash
COUP_RELEASE=before-rilis-002 docker compose -p coup-tabletop --env-file .env.production \
  -f compose.yaml up -d --no-deps --no-build --pull never --wait tabletop
```

Jika konfigurasi Compose ikut berubah, gunakan juga file konfigurasi rilis sebelumnya. Rollback mengembalikan aplikasi; room dari proses lama sudah berakhir.

## Pembagian kode

- `domain/engine.ts` menghasilkan pilihan legal dan menerapkan satu transisi pada salinan state. Resolusi langsung berlangsung dalam command yang sama. Fase yang memerlukan keputusan menyimpan kelanjutan aksinya.
- `domain/house-rules.ts` mendefinisikan kedua modul. `domain/view.ts` memproyeksikan state untuk satu kursi. Bot dan manusia menerima batas informasi yang sama.
- `domain/bot.ts` menghitung estimasi peran dari kartu yang diketahui dan klaim publik, menilai opsi legal, serta menerapkan bobot per tingkat kesulitan.
- `server/rooms.ts` mengelola repository, revisi, timer dan tugas bot. `server/socket.ts` memvalidasi payload, mengikat socket ke kursi, dan mengirim proyeksi individual. Command lama atau ulangan ditolak berdasarkan revisi. Antarmuka memperoleh state resmi setiap kali revisi berubah.
- `app/` berisi lobi dan meja responsif berbahasa Indonesia. `tests/` dan `e2e/` memuat tes domain, server dan browser.

## Asumsi implementasi v1.2

1. Sesuai PLAN.md §6 dan §18, dua pemain mendapat masing-masing dua influence acak dan dua koin dari deck standar. Server mengundi kursi pembuka partai pertama. Pada partai berikutnya, pemenang sebelumnya membuka jika masih duduk. Urutan selanjutnya mengikuti kursi. Klasemen menghitung kemenangan selama sesi room masih tersimpan di server. Varian resmi dua pemain masih terbuka.
2. Guess menggunakan giliran, gratis, dan langsung diselesaikan. Kewajiban Coup pada saldo awal minimal 10 tetap berlaku. Kesempatan habis saat tebakan diterima, termasuk saat salah.
3. Assassinate dan Coup membayar saat diumumkan. Biaya tetap terpakai jika aksi kemudian gagal. Bila target tereliminasi saat challenge, efek terhadapnya berakhir. Game over didahulukan begitu hanya satu pemain bertahan.
4. Pada challenge yang benar-benar membuktikan peran, server mengembalikan satu kartu itu ke deck, mengocok, lalu mengambil pengganti. Pemilik bisa mendapat peran yang sama. Exchange mengocok kartu yang dikembalikan bersama sisa deck.
5. Host dapat undo Income yang baru selesai. Pilihan pemain berikutnya, jeda, atau koreksi koin membatalkan kelayakan. Pemakaian undo, host-close, pause/resume, serta koreksi tercatat di riwayat.
6. Tempo awal memberi jeda 5 detik untuk bot dan hingga 3,5 detik sebelum pilihan berikutnya di browser. Dialog mendapat minimal 8 detik sebelum berganti otomatis dan dapat ditahan. Saat timer respons aktif, jeda tombol dipersingkat bila perlu agar pemain masih dapat merespons sebelum tenggat server. Angka ini merupakan tuning awal. Pekerjaan bot dibatalkan dan dihitung ulang saat revisi berubah. Pemindahan host dan penggantian pemain setelah start masih di luar implementasi sesuai §16–18.

## Verifikasi

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run e2e
```

Playwright menjalankan build produksi pada port 3176 (ubah dengan `COUP_TEST_PORT`). Skenario ponsel dan desktop meliputi dua browser dalam satu room, challenge terhadap blok, kehilangan influence, serta solo melawan computer sampai game over dan kembali ke lobi. Simulasi Vitest memakai 120 pertandingan ber-seed untuk tiga tingkat kesulitan dan 2–6 kursi.
