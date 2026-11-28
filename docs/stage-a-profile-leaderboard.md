# Spesifikasi Tahap A — Profil Pemain, Riwayat Match, Leaderboard & Saran Nama

> **Status:** Final — Siap Diimplementasikan  
> **Produk:** The Ultimate Coup  
> **Referensi Utama:** `PLAN.md` (§2, §18, §19)  
> **Posisi Roadmap:** Tahap A (Profil, Riwayat, Leaderboard, Saran Nama) → Tahap B (Solo Berlevel) → Tahap C (Pertemanan & Direct Invite) → Tahap D (Turnamen Harian/Mingguan)

---

## 1. Tujuan & Ruang Lingkup

Memanfaatkan sistem autentikasi Google + `@username` dan penyimpanan persisten SQLite yang sudah ada untuk menghadirkan:

1. **Profil Pemain** (`/profile` dan `/u/[username]`) beserta julukan gaya bermain otomatis dan statistik karir.
2. **Riwayat Pertandingan** (*Match History*) dengan filter, pagination, dan detail klasemen seluruh peserta.
3. **Leaderboard Global** (`/leaderboard`) berbasis **Poin Global** dengan kategori **PvP Murni** dan **Semua Match**, serta periode **Mingguan** dan **Sepanjang Masa**.
4. **Riwayat & Saran Nama Panggilan** (*Nickname History & Suggestions*) agar pemain yang bebas memakai nama panggilan berbeda di tiap meja dapat memilih nama yang sering/terakhir dipakai dalam satu klik.

---

## 2. Terminologi & Aturan Penilaian (Final)

### 2.1 Istilah Poin
- **Poin Sesi**: Akumulasi poin sementara di dalam satu room privat (berlaku selama sesi meja berlangsung).
- **Poin Global**: Akumulasi poin lintas pertandingan yang tersimpan permanen pada akun pemain.
  - Pada tab **PvP (Semua Manusia)** ditampilkan sebagai **Poin Global (PvP)**.
  - Pada tab **Semua Match** ditampilkan sebagai **Total Poin**.
- **Poin Turnamen** *(cadangan untuk Tahap D)*: Akumulasi poin khusus event turnamen.

### 2.2 Rumus Poin Dinamis (Konsisten dengan `domain/scoring.ts`)
Untuk pertandingan selesai dengan pemenang pada meja berukuran $N \in [2..6]$:
- Peringkat 1 (Pemenang): `+N` poin.
- Peringkat $r \in [2..N]$: `+(N - r)` poin (turun 1 per peringkat hingga `0` untuk peringkat terakhir).
- Bonus **One-Time Guess**: bila aturan `one_time_guess` aktif dan tebakan pemain benar, pemain memperoleh tambahan **`+1` poin** (berlaku untuk pemenang maupun non-pemenang).
- Pertandingan yang diakhiri host tanpa pemenang (`ended_reason = 'host_ended'`): `0` poin, `0` bonus, tidak menambah jumlah menang/kalah/streak.

### 2.3 Definisi PvP Murni (Keputusan Final)
- Sebuah pertandingan dihitung sebagai **PvP** **hanya apabila seluruh kursi diisi pemain manusia**:
  - `human_count >= 2` **dan** `bot_count = 0`.
- Meja campuran (manusia + computer) maupun solo melawan computer tetap tersimpan dalam riwayat match dan masuk kategori **Semua Match**, namun **tidak** masuk klasemen maupun statistik **PvP**.
- **Validitas Leaderboard**:
  - Match dihitung pada agregasi leaderboard hanya bila `ended_reason = 'completed'` dan `total_actions >= 2` (mencegah anomali teknis/match kosong).
  - Match yang gagal memenuhi syarat tersebut tetap tercatat dalam riwayat pertandingan.
- **Migrasi Data Lama**:
  - Migrasi skema `003` secara otomatis menghitung ulang `human_matches_played`, `human_wins`, dan `human_points` di tabel `player_stats` berdasarkan tabel `matches` dan `match_participants` agar seluruh data historis konsisten dengan aturan PvP Murni (`bot_count = 0`).

### 2.4 Periode Mingguan
- Periode **Mingguan** dihitung berdasarkan waktu Indonesia Barat (**WIB / UTC+7**), dimulai setiap **Senin pukul 00:00:00 WIB** hingga **Minggu pukul 23:59:59 WIB**.
- Perhitungan batas waktu minggu berjalan dilakukan secara deterministik di server (UTC timestamp dari awal minggu WIB) dan dikembalikan di respons API (`periodStart`, `periodEnd`) agar UI dapat menampilkan rentang tanggal yang jelas.

### 2.5 Aturan Pengurutan Leaderboard (Tie-Breaker)
Urutan peringkat dari atas ke bawah:
1. `points DESC` (**Poin Global**)
2. `wins DESC` (Jumlah menang)
3. `winRate DESC` (Rasio menang `wins / matches_played`)
4. `matchesPlayed DESC` (Total match selesai)
5. `bestStreak DESC` (Win streak terbaik — untuk All-Time; pada Mingguan fallback ke `points`, `wins`, `winRate`, `matchesPlayed`, `username`)
6. `username ASC`

---

## 3. Skema Database — Migrasi `003_profiles_and_nicknames`

Menggunakan ANSI-SQL di `server/db/migrations.ts` agar tetap portabel ke PostgreSQL/MySQL:

### 3.1 Tabel Baru: `account_nicknames`
```sql
CREATE TABLE IF NOT EXISTS account_nicknames (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  nickname_key TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count >= 1),
  first_used_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  PRIMARY KEY (account_id, nickname_key)
);

CREATE INDEX IF NOT EXISTS idx_account_nicknames_rank
  ON account_nicknames (account_id, use_count DESC, last_used_at DESC);
```
- `nickname_key`: `nickname.trim().toLowerCase().replace(/\s+/g, " ")` untuk mencegah duplikasi karena perbedaan kapitalisasi atau spasi berlebih.
- `nickname`: menyimpan versi kapitalisasi terakhir yang dipilih pemain.
- **Backfill otomatis saat migrasi**: menyalin riwayat nama dari `match_participants` (di mana `account_id IS NOT NULL AND is_bot = 0`) dengan `COUNT(*)`, `MIN(finished_at)`, dan `MAX(finished_at)`.

### 3.2 Perubahan Kolom Eksisting
- `matches`:
  - `match_mode TEXT NOT NULL DEFAULT 'private'` — nilai siap pakai: `'private' | 'solo' | 'tournament'`.
  - Index baru: `idx_matches_leaderboard_period ON matches (ended_reason, bot_count, human_count, finished_at DESC)`.
- `match_participants`:
  - `guess_bonus INTEGER NOT NULL DEFAULT 0` — mencatat bonus `+1` dari *One-Time Guess* yang benar.
- `player_stats`:
  - `total_guess_hits INTEGER NOT NULL DEFAULT 0` — total tebakan *One-Time Guess* benar sepanjang karir.
  - Rekalkulasi kolom `human_matches_played`, `human_wins`, `human_points` agar hanya menghitung match dengan `ended_reason = 'completed' AND human_count >= 2 AND bot_count = 0 AND total_actions >= 2`.

### 3.3 Waktu Pencatatan Nama Panggilan
- Saat socket `enter` (`create` atau `join`) berhasil untuk akun terautentikasi: panggil `recordNicknameUsage(accountId, name)`.
- Saat socket `command` (`rename`) berhasil di lobi untuk akun terautentikasi: panggil `recordNicknameUsage(accountId, nextName)`.
- Tidak mencatat ulang saat `restore` (reconnect) atau saat match selesai agar satu sesi masuk meja tidak dihitung ganda.

---

## 4. Kontrak API HTTP (`server/api.ts`)

Seluruh endpoint mengembalikan JSON dengan `Cache-Control: no-store`.

### 4.1 Kebijakan Autentikasi
- Ketika `authService.isEnabled()` bernilai `true`:
  - Semua endpoint `/api/me/*`, `/api/players/*`, `/api/matches/*`, dan `/api/leaderboard` **wajib** memiliki sesi login Google aktif yang telah menyelesaikan onboarding (`401 Unauthorized` bila belum login, `403 Forbidden` bila belum onboarding).
- Ketika `authService.isEnabled()` bernilai `false` (mode pengembangan lokal tanpa OAuth):
  - Endpoint publik (`/api/leaderboard`, `/api/players/:username`, `/api/matches/:matchId`) dapat diakses; endpoint `/api/me/*` tetap memeriksa cookie sesi bila ada (atau mengembalikan `401` bila tidak ada akun aktif).

### 4.2 Daftar Endpoint

| Method & Path | Fungsi | Catatan Privasi |
| :--- | :--- | :--- |
| `GET /api/me/profile` | Profil akun sendiri, statistik `all` & `pvp`, peringkat global saat ini (PvP & Semua, Mingguan & All-Time), julukan gaya main, serta daftar `nicknames`. | Hanya pemilik akun; `email` boleh tampil, `googleSub` tidak pernah dikirim. |
| `GET /api/me/nicknames` | Daftar saran nama panggilan milik akun (`lastUsed`, `suggestions[]` diurutkan oleh `useCount DESC, lastUsedAt DESC`). | Privat, hanya pemilik akun. |
| `DELETE /api/me/nicknames/:key` | Menghapus 1 saran nama panggilan berdasarkan `nicknameKey` (URL-encoded). | Hanya pemilik akun. |
| `GET /api/players/:username` | Profil publik pemain berdasarkan `@username`: identitas publik (`username`, `name`, `picture`, `createdAt`), statistik `all` & `pvp`, peringkat global, dan julukan gaya main. | **Tanpa** `email`, **tanpa** `googleSub`, **tanpa** daftar saran nickname. |
| `GET /api/players/:username/matches` | Riwayat match terpaginasi. Query: `scope=all\|pvp\|non_pvp`, `result=all\|win\|loss`, `limit` (1–50, default 20), `offset` (>=0). Mengembalikan `{ items, total, hasMore }`. | **Tanpa** `roomCode`, **tanpa** kartu rahasia. |
| `GET /api/matches/:matchId` | Detail 1 pertandingan: metadata meja (aturan aktif, jumlah pemain/bot, durasi, waktu selesai, pemenang) dan daftar peserta lengkap (peringkat, nickname, `@username` jika ada, `isBot`, `botDifficulty`, poin, `guessBonus`, metrik gaya main). | **Tanpa** `roomCode`, **tanpa** kartu rahasia/deck/email. |
| `GET /api/leaderboard` | Papan peringkat Poin Global. Query: `mode=pvp\|all` (default `pvp`), `period=weekly\|all_time` (default `weekly`), `limit` (1–100, default 50), `offset` (>=0). Mengembalikan `{ mode, period, periodStart, periodEnd, totalEntries, entries, myEntry }`. | **Tanpa** `email`, **tanpa** `googleSub`. |

---

## 5. Spesifikasi UI & Pengalaman Pengguna

### 5.1 Julukan Gaya Bermain Otomatis
Diturunkan secara deterministik (fungsi murni di `domain/player-style.ts`) dari statistik selesai:
- Belum cukup data (`matchesPlayed < 3`): **Pendatang Baru Istana**
- Rasio bluff dominan: **Sang Penggertak**
- Rasio challenge dominan: **Detektif Istana**
- Rasio block dominan: **Tembok Istana**
- Rasio serangan dominan: **Algojo Meja**
- Win rate tinggi (`>= 55%` dengan minimal 5 match): **Penguasa Tahta**
- Puncak koin tinggi (`>= 10`): **Sultan Meja**
- Default seimbang: **Ahli Strategi**

### 5.2 Halaman Leaderboard (`/leaderboard`)
- Menggunakan shell halaman konsisten dengan tema tabletop gelap-emas (*The Ultimate Coup*), lengkap dengan tombol `ActiveRoomReturnButton` dan `AccountMenu`.
- **Tab Kategori** (`role="tablist"` dengan indikator bentuk garis bawah + warna sesuai WCAG 1.4.1):
  - **PvP (Semua Manusia)** *(default)*
  - **Semua Match**
- **Toggle Periode**:
  - **Mingguan** *(default, menampilkan rentang tanggal WIB)*
  - **Sepanjang Masa**
- **Kartu Peringkat Saya** (*sticky* / sorotan teratas untuk user login): menampilkan peringkat saat ini, Poin Global, Menang/Main, Win Rate, atau pesan motivasi bila belum memiliki match kualifikasi pada periode/kategori tersebut.
- **Tabel Responsif**:
  - Menggunakan semantik `<table>` dengan `@container` query agar pada layar HP otomatis beralih menjadi layout kartu bertumpuk yang rapi dan terbaca tanpa scroll horizontal yang membingungkan.
  - Kolom: `#` (Peringkat), `Pemain` (Avatar + Nama + `@username` dapat diklik ke `/u/[username]`), `Poin`, `Menang`, `Main`, `Win Rate`, `Streak`.
  - Penanda visual khusus untuk Top 3 (medali emas/perak/perunggu) dan sorotan baris akun sendiri.

### 5.3 Halaman Profil (`/profile` & `/u/[username]`)
- **Header Identitas**: Avatar besar, Nama, `@username`, tanggal bergabung, badge **Julukan Gaya Main**, serta ringkasan peringkat global (PvP Mingguan & All-Time).
- **Panel Statistik** dengan toggle tab **PvP (Semua Manusia)** vs **Semua Match**:
  - 4 kartu angka utama: **Poin Global**, **Menang / Main**, **Win Rate**, **Win Streak (Aktif / Terbaik)**.
  - Grid statistik gaya main: **Bluff**, **Challenge**, **Block**, **Serangan**, **Puncak Koin**, **Tebakan Benar** (`One-Time Guess`).
- **Panel Nama Panggilan Tersimpan** *(khusus `/profile`)*:
  - Menampilkan daftar nama panggilan yang pernah digunakan beserta jumlah pemakaian (`12×`) dan tombol hapus (`×`) untuk membersihkan typo/saran yang tidak diinginkan.
- **Panel Riwayat Pertandingan**:
  - Filter jenis meja (**Semua** / **PvP** / **Bot & Campur**) dan hasil (**Semua** / **Menang** / **Kalah**).
  - Daftar match dengan badge peringkat (`#1 Menang`, `#2`, dst. atau `Diakhiri Host`), poin (`+4 poin`, `+1 Guess`), nama panggilan saat itu, komposisi meja, aturan aktif, dan durasi.
  - Klik baris match membuka detail klasemen seluruh kursi di match tersebut, dengan link langsung ke `/u/[username]` tiap lawan manusia.

### 5.4 Komponen Saran Nama (`NicknameInput`)
- Dipasang di:
  1. Form **Buat Meja** (`app/page.tsx`)
  2. Form **Gabung Meja** (`app/page.tsx`)
  3. Form **Ubah Nama di Lobi** (`app/page.tsx`)
- Perilaku:
  - Saat form Buat/Gabung dibuka dan input masih kosong, otomatis mengisi (**prefill**) dengan nama panggilan terakhir yang digunakan akun (jika ada).
  - Menampilkan maksimal 6 chip saran nama paling sering/baru dipakai tepat di bawah input; klik chip langsung mengisi input.
  - Saat mengetik, chip saran menyaring nama yang cocok secara real-time.

### 5.5 Titik Masuk Navigasi & Tata Letak Halaman
- **Header seragam dengan halaman awal**: Seluruh halaman sekunder (`/profile`, `/u/[username]`, `/leaderboard`, `/settings`, `/updates`, `/terms`, `/privacy`) memakai header bersih yang sama dengan halaman awal (logo brand di kiri, tombol `Kembali ke game` bila aktif + layar penuh + avatar akun di kanan, tanpa deretan link teks di header).
- **Dropdown `AccountMenu`**: hanya memuat menu akun inti (**Profil Saya**, **Leaderboard**, **Pengaturan**, dan **Keluar akun**), tanpa link Catatan Pembaruan, Syarat & Ketentuan, atau Kebijakan Privasi (tetap tersedia di footer halaman).
- **Tata letak Sidebar + Konten (Desktop)**: Halaman **Profil** (`/profile`, `/u/[username]`), **Leaderboard** (`/leaderboard`), dan **Pengaturan** (`/settings`) menampilkan **sidebar navigasi di sebelah kiri** (`Profil Saya`, `Leaderboard`, `Pengaturan`, dan `Beranda`) dan **kartu konten utama di sebelah kanan**. Pada layar sempit/mobile (`<= 860px`), sidebar berubah menjadi bilah navigasi horizontal yang ringkas di atas kartu konten.
- **Halaman Awal (`/`)**: menyediakan akses cepat **Leaderboard Poin Global** dan **Profil & Riwayat** saat user sudah login.

---

## 6. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Match dengan `human_count >= 2 && bot_count === 0 && ended_reason === 'completed' && total_actions >= 2` masuk ke statistik & leaderboard **PvP** dan **Semua**.
- [ ] Match campuran (`human_count >= 2 && bot_count >= 1`) maupun solo (`human_count === 1 && bot_count >= 1`) **tidak** masuk statistik/leaderboard **PvP**, tetapi masuk **Semua** dan riwayat match.
- [ ] Migrasi DB `003` idempoten, mem-backfill `account_nicknames` dari `match_participants` lama, dan mengoreksi `human_matches_played`/`human_wins`/`human_points` di `player_stats` agar konsisten dengan definisi PvP Murni.
- [ ] Leaderboard Mingguan menghitung rentang Senin 00:00 WIB – Minggu 23:59 WIB secara akurat dan menyertakan `myEntry` bahkan saat pemain di luar Top 50.
- [ ] Profil publik (`/api/players/:username`), Leaderboard (`/api/leaderboard`), dan Detail Match (`/api/matches/:matchId`) **tidak pernah** membocorkan `email`, `googleSub`, `roomCode`, kartu rahasia, ataupun daftar saran nickname pribadi.
- [ ] Penggunaan nama saat `create`, `join`, dan `rename` tercatat ke `account_nicknames` (case-insensitive, menyimpan kapitalisasi terakhir), muncul sebagai saran & prefill, dan dapat dihapus oleh pemilik akun.
- [ ] Saat `authRequired = true`, seluruh endpoint baru menolak permintaan tanpa sesi valid (`401`/`403`).
- [ ] UI responsif dan nyaman digunakan di layar ponsel maupun desktop; lulus `typecheck`, `lint`, `vitest`, dan `next build`.
