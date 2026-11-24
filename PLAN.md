# COUP Digital Tabletop — Product & Implementation Plan

> Status: **MVP v1.2 — siap dieksekusi secara bertahap**  
> Bahasa: Indonesia  
> Tujuan: sumber perencanaan utama yang menjadi instruksi eksekusi untuk AI coding agent.

## 1. Ringkasan Produk

Bangun web game multiplayer **Coup Digital Tabletop** untuk dimainkan bersama teman dari perangkat masing-masing. Pengalaman yang diutamakan adalah **meja permainan digital**, bukan adaptasi Coup yang sepenuhnya mengotomasi keputusan sosial. Sistem membantu penanganan kartu, koin, giliran, sinkronisasi, dan pencatatan aksi, sementara pemain tetap mengambil keputusan dalam bluff, challenge, block, dan interaksi sosial.

**Pembeda utama:** aturan tongkrongan (*house rules*) akan diimplementasikan **langsung di dalam kode/game engine** sebagai modul bawaan. Host dapat mengaktifkan/menonaktifkan **setiap aturan secara individual** sebelum permainan dimulai. **Bukan** rule builder yang dapat membuat aturan baru melalui UI.

## 2. Keputusan yang Sudah Disepakati

- Platform utama: **web**, mendukung HP dan PC.
- Multiplayer: **private room only**, tanpa public room, matchmaking, atau lobby publik.
- **Jumlah peserta: 2–6 slot per pertandingan (Classic), keputusan final.** Slot boleh ditempati manusia maupun computer/bot. Room tidak dapat memulai permainan dengan kurang dari 2 atau lebih dari 6 peserta total.
- Alur akses: buat room atau join via kode/link, cukup nickname, tanpa wajib registrasi.
- Setiap pemain manusia bermain dari perangkat masing-masing secara real-time. **Computer/bot tidak perlu perangkat atau sesi browser tersendiri.**
- Reconnect dengan identitas sesi yang aman agar kartu dan posisi permainan tetap sama setelah putus koneksi.
- Mode: **multiplayer digital tabletop**.
- Dasar gameplay: Coup klasik.
- Aturan tongkrongan: **built-in**, spesifikasi rinci **akan diberikan kemudian**.
- Setiap aturan tongkrongan: **toggle ON/OFF** saat membuat meja, terpisah dari timer respons.
- Default house rules: **OFF** (sementara, sesuai diskusi terakhir).
- Konfigurasi house rules dikunci selama satu pertandingan; boleh diubah untuk pertandingan berikutnya.
- **Mode permainan diputuskan: A — Semi-automated tabletop.** Pemain memilih aksi dan keputusan sosial; sistem otomatis mengelola koin, kartu, giliran, challenge/block, dan konsekuensi berdasarkan aturan aktif.
- **Host Controls: B — Moderate (final).** Host dapat mengelola room, memulai pertandingan, mengakhiri fase respons saat timer OFF, pause/resume, mengoreksi jumlah koin, dan membatalkan aksi terakhir **hanya jika aman**. Host tidak dapat melihat/mengganti kartu rahasia, mengubah influence atau giliran secara bebas.
- **Visual: D — Hybrid (Classic Tabletop + Modern UI), final.** Nuansa meja/kartu/koin Coup klasik, dengan navigasi modern, jelas dan responsif untuk HP/PC.
- **Add Computer: masuk cakupan MVP, final.** Host bisa menambahkan bot ke private room agar dapat bermain solo melawan computer, atau manusia dan bot dalam satu room. Kapasitas total tetap 2–6. Bot mengikuti aturan dan house rules aktif. Kebijakan bot telah diputuskan: **Strategic Bot (B)** dengan tingkat kesulitan, bluff, estimasi probabilitas, dan adaptasi pada riwayat aksi. **Tingkat kesulitan final: Easy / Normal / Hard**, dipilih per bot di lobby sebelum game dimulai (default awal: Normal).
- **Challenge & Block: C — Hybrid.** Host dapat mengaktifkan/menonaktifkan timer respons melalui Room Settings. Saat timer OFF, fase respons menunggu semua pemain yang berhak merespons atau host mengakhiri fase secara manual. Saat timer ON, fase berakhir berdasarkan respons yang valid atau saat timer habis; pemain yang belum merespons dianggap **Pass**. **Default timer OFF; jika ON, durasi 30 detik per response window (final).**

## 3. Batasan Scope

### MVP (siap dieksekusi)

1. Buat/join **private room only** dengan kode/link undangan; pemain menggunakan nickname tanpa wajib registrasi. Room tidak ditampilkan dalam direktori publik.
2. Host mengelola slot peserta (manusia + computer) dan memulai pertandingan dengan **2–6 peserta total**; room menolak slot ketujuh.
3. Kartu rahasia, deck, influence, koin, dan giliran tersinkronisasi antar pemain.
4. Semua aksi klasik Coup: Income, Foreign Aid, Coup, Tax, Assassinate, Steal, Exchange.
5. Dukungan challenge, block, reveal, lose influence, eliminasi, dan deteksi pemenang.
6. Sistem built-in house rules ON/OFF; implementasikan **One-Time Guess** dan **Duke Blocks Tax** sebagai modul yang bisa diaktifkan terpisah.
7. Event log yang jelas bagi seluruh pemain, tanpa membocorkan informasi privat.
8. UI responsif untuk HP dan PC, dengan tampilan meja permainan digital.
9. Penanganan disconnect/reconnect dan double action dasar.
10. **Add Computer** di lobby oleh host; computer dapat menjalankan giliran, challenge, block, pemilihan kartu yang hilang, dan keputusan lain yang diperlukan secara otomatis. Solo play: 1 manusia + minimal 1 bot.

### Di luar MVP, kecuali diputuskan lain

- Public room, matchmaking publik, direktori room, leaderboard publik, ranking global, akun wajib, bot berbasis LLM eksternal, monetisasi, dan fitur spectator publik.
- Visual 3D atau animasi berat.
- Editor aturan bebas dari UI.

## 4. Prinsip Gameplay

**Keputusan terkunci: Semi-automated digital tabletop (Opsi A).** Sistem menjalankan aturan dan perubahan state normal secara otomatis, tetapi tidak mengambil keputusan bluff/challenge/block atas nama pemain. Intervensi manual host hanya jalur pengecualian, bukan jalur utama.


- **Server-authoritative:** kebenaran kartu, deck, koin, giliran, dan urutan aksi berada di server, bukan browser klien.
- **Digital tabletop:** interaksi sosial tetap menjadi keputusan pemain; aplikasi tidak menggantikan proses menggertak, mengklaim, atau memutuskan untuk menantang.
- **No information leak:** hanya pemilik kartu yang bisa melihat kartunya; host juga tidak mendapat akses otomatis ke kartu rahasia pemain lain.
- **Deterministic rule handling:** semua perubahan state berjalan lewat command yang tervalidasi dan menghasilkan event.
- **Rules extensibility:** aturan tongkrongan ditambahkan sebagai modul terdaftar, bukan hardcode tersebar di komponen UI.
- **Visible rule set:** semua pemain dapat membaca daftar house rules yang aktif sebelum dan selama pertandingan.

## 5. Aturan Coup Klasik (Baseline untuk Diverifikasi)

- **Kapasitas resmi game: 2–6 pemain**, dengan 5 karakter (Duke, Assassin, Captain, Ambassador, Contessa), masing-masing 3 kartu (**total deck 15 kartu**).
- Jumlah kartu dibagikan = `jumlah pemain × 2`; sisanya menjadi draw deck. Pada 6 pemain, 12 kartu dibagikan dan 3 kartu tersisa.
- **Permainan 2 pemain:** dukung kapasitas 2, tetapi detail setup/varian 2 pemain harus ditentukan dalam spesifikasi rules sebelum implementasi final; jangan mengarang variasi aturan.
- Setiap pemain mulai dengan 2 kartu influence tertutup dan 2 koin.
- Income: +1 koin, tidak bisa diblokir.
- Foreign Aid: +2 koin, dapat diblokir oleh klaim Duke.
- Coup: bayar 7 koin, target kehilangan 1 influence; bila mengawali giliran dengan >=10 koin wajib Coup.
- Tax (klaim Duke): +3 koin.
- Assassinate (klaim Assassin): bayar 3 koin untuk menargetkan kehilangan 1 influence; dapat diblokir klaim Contessa.
- Steal (klaim Captain): curi hingga 2 koin dari target; dapat diblokir klaim Captain/Ambassador.
- Exchange (klaim Ambassador): ambil 2 kartu dari deck lalu kembalikan 2 kartu agar jumlah influence tidak berubah, dengan detail sesuai aturan dasar.
- Klaim karakter dapat di-challenge; resolusi challenge menentukan siapa yang kehilangan influence.
- Pemain tereliminasi saat seluruh influence hilang; pemain terakhir yang tersisa menang.

> **Catatan implementasi:** detail timing, prioritas challenge/block, replacement kartu setelah klaim yang benar, aturan pembatalan aksi saat target tersingkir, dan edge cases harus dirumuskan sebagai state machine dan diuji sebelum MVP dinyatakan selesai. Jangan mengandalkan asumsi implisit.

## 6. Desain House Rules Built-in

Representasi konseptual:

```ts
interface HouseRuleDefinition {
  id: string;                // stabil, unik
  name: string;
  description: string;
  defaultEnabled: boolean;
  conflictsWith?: string[];
}

type RoomRuleConfig = Record<string, boolean>;
```

Syarat teknis:

1. **Registry** berisi definisi setiap rule.
2. **Rule engine** menerima konfigurasi aktif per pertandingan dan menerapkannya pada validasi command / state transition.
3. Toggle OFF berarti aturan tidak memengaruhi gameplay.
4. Setiap rule memiliki unit test mode ON dan OFF serta test interaksi dengan rule lain.
5. Perubahan rule antar versi tidak boleh diam-diam mengubah pertandingan yang sudah berjalan.
6. Rule yang memerlukan keputusan bersama harus punya alur resolusi manual yang eksplisit dan terekam.
7. Jangan membuat aturan tongkrongan tambahan di luar dua rule yang sudah diberikan; tulis asumsi implementasi untuk detail yang belum eksplisit.

### House Rule 01 — One-Time Guess (`one_time_guess`)

**Sumber aturan pengguna:** Setiap pemain memiliki **tepat satu kesempatan** menebak kartu milik **pemain lain** sepanjang satu pertandingan. Jika tebakan benar, **satu kartu/influence hidup** target yang cocok dengan karakter tebakan mati; jika salah, **satu kartu/influence hidup penebak** mati. Tebakan tidak mengharuskan target mengungkap seluruh tangannya.

**Kontrak implementasi:**
- Aktif hanya saat `one_time_guess = true`; default OFF. Kesempatan dipakai maksimal **sekali per pemain per match**, bukan sekali per giliran, dan tidak di-reset saat reconnect; di-reset saat rematch.
- Semua 5 karakter klasik dapat dipilih sebagai tebakan; target harus pemain **lain yang masih hidup**. Pemeriksaan cocok berdasarkan **kartu influence yang masih hidup**, bukan kartu yang sudah terbuka/hilang.
- Kebenaran tebakan dan pemilihan kartu yang gugur ditentukan oleh server, bukan klaim pemain. Jika benar, gugurkan **satu** kartu target dengan karakter yang ditebak; jika salah, penebak memilih **satu** kartu miliknya yang masih hidup untuk digugurkan (bot memilih sesuai policy).
- Gunakan fase `GUESS_RESOLUTION` / `INFLUENCE_SELECTION` sesuai perlu; catat actor, target, guessed role, outcome, influence yang terbuka, dan sisa kesempatan. Pastikan informasi kartu lain tidak bocor.
- **Asumsi sementara untuk menghindari blocking development:** tebakan adalah **aksi pada giliran penebak** yang menggantikan aksi Coup biasa; tidak memerlukan koin, tidak dapat di-Challenge atau di-Block. Konsumsi kesempatan terjadi saat command valid diterima secara atomik, termasuk jika tebakan salah. Detail ini dapat diperbarui jika pemilik aturan tongkrongan mengklarifikasi.
- Saat OFF, tidak muncul tombol Guess dan engine menolak command Guess; tidak ada kesempatan tebak di pertandingan tersebut.

### House Rule 02 — Duke Blocks Tax (`duke_blocks_tax`)

**Sumber aturan pengguna:** Ketika pemain menyatakan **Tax (klaim Duke, +3 koin)**, **pemain lain boleh mengklaim Duke untuk membatalkan Tax**, mirip Duke memblokir Foreign Aid. Klaim Duke oleh pemblokir **dapat di-Challenge** menurut mekanisme challenge standar.

**Kontrak implementasi:**
- Aktif hanya jika `duke_blocks_tax = true`; default OFF. Pemain yang mengklaim Tax dapat di-Challenge seperti biasa.
- Saat Tax diumumkan, semua lawan hidup mendapat pilihan Challenge, Block dengan klaim Duke, atau Pass dalam satu jendela. Challenge atau Block pertama yang diterima server menutup jendela tersebut. Jika semua Pass, pelaku menerima 3 koin. Jika klaim Tax ditantang dan terbukti, selesaikan kehilangan influence penantang lalu akhiri aksi tanpa memberikan koin Tax.
- Pemblokiran tersebut membuka kesempatan Challenge terhadap **klaim Duke pemblokir**. Jika blok sah dan tidak berhasil ditantang, Tax dibatalkan sehingga **tidak ada +3 koin**. Jika klaim blok terbukti bluff, pemblokir kehilangan influence dan Tax tetap batal. Hanya pelaku Tax dapat menantang blok. Jika ia Pass, kesempatan aksi giliran itu terpakai dan giliran berpindah. Jika klaim Tax awal terbukti bluff, pelaku kehilangan influence dan Tax batal.
- Jalankan sesuai sistem Hybrid response window (default timer OFF; 30 detik bila ON), serialisasi jika lebih dari satu pemain ingin block/challenge agar hanya satu hasil final yang berlaku.
- Bila `duke_blocks_tax = false`, Tax kembali ke aturan klasik: dapat di-Challenge namun **tidak dapat diblokir**.

**Interaksi antar-rule:** Keduanya bisa ON bersama, dan masing-masing harus bisa OFF secara independen. Bot Easy/Normal/Hard harus dapat menggunakan kesempatan Guess secara legal dan memutuskan kapan akan blok/challenge Tax tanpa melihat kartu tersembunyi pemain lain.

## 7. Alur Pengalaman Pengguna (Rancangan Awal)

Saat pertandingan, meja dapat dibuka dalam layar penuh. Dalam tampilan biasa, tombol layar penuh, musik, dan menu meja berada di header. Tombol tampilan memakai ikon. Saat layar penuh, setiap ikon berdiri sendiri dalam satu kolom di pojok kanan atas meja. Ucapan sendiri tampil di tengah, ucapan lawan dalam balon komik di kursinya. Sisakan jeda baca untuk aksi berurutan. Gerakan dek mengikuti Exchange dan penggantian kartu sesudah pembuktian klaim. Menu memuat pengaturan, riwayat, dan kontrol khusus host. Riwayat lengkap dapat disalin secara kronologis beserta fase, ID aksi, serta koin dan jumlah influence hidup setiap kursi pada setiap event.

Tinggi minimum permukaan meja adalah 90% viewport. Menu pengaturan berupa drawer di tepi kanan dengan lebar responsif sesuai isi panel dengan latar gelap transparan. Drawer menjadi satu-satunya area gulir untuk seluruh isinya.

Menu awal menawarkan buat meja atau masuk dengan kode. Tautan undangan langsung membuka form gabung. Kartu menampilkan ilustrasi tanpa caption tambahan. Kartu yang gugur tetap terlihat dalam skala abu-abu. Status tengah merangkum aksi dan pihak yang ditunggu dalam satu kalimat. Setiap pembaruan gameplay harus menampilkan dialog lebih dahulu, termasuk aksi bot, hasil Guess, perubahan koin, kartu gugur, Exchange, pembagian kartu, dan kontrol host. Satu perangkat menerapkan proyeksi privat per revisi setelah dialog terakhir untuk revisi itu terbaca. Asumsi tempo otomatis: 2,2–8 detik per dialog, mengikuti panjang kalimat. Jeda baca dihitung ketika dialog terlihat pada tab aktif. Saat klaim terbukti atau kartu gugur, balik kartu di tangan pemilik sambil menampilkan ucapannya. Dialog pemain hanya berisi teks. Pembagian dimulai dengan kursi kosong dan setiap kartu terlihat saat tiba. Setelah kartu bukti kembali dan kartu pengganti tiba, barulah penantang memilih kartu yang gugur. Exchange juga menunggu gerakan dek selesai sebelum tangan, pilihan dan jumlah dek diperbarui. Membaca ulang dialog lama tidak mengulang efek. Saat koneksi pulih pada halaman yang masih terbuka, antrean dialog pertandingan yang sama dilanjutkan. Saat halaman dimuat ulang, tampilan mulai dari kondisi resmi terkini. Timer respons tetap berjalan di server.

1. **Private lobby:** host membuat room privat, memperoleh kode/link; pemain manusia bergabung dari perangkat masing-masing dan memilih nickname tanpa login. Host dapat menekan **Add Computer** untuk mengisi slot bot.
2. **Room setup:** host menentukan pengaturan pertandingan dan mengaktifkan house rules yang diinginkan. Hanya pemain dengan undangan/kode valid yang dapat masuk. Kapasitas maksimum 6 peserta termasuk host dan semua bot.
3. **Ready/start:** seluruh pemain dapat melihat konfigurasi yang berlaku; host hanya dapat memulai game ketika ada 2–6 peserta terdaftar (manusia + bot). Satu host manusia dapat memulai dengan bot tanpa pemain manusia lain.
4. **Deal:** sistem mengocok deck dan membagi kartu privat.
5. **Turn:** pemain aktif memilih aksi dan target bila relevan.
6. **Response windows:** pemain yang berhak menantang/memblokir diberi kesempatan merespons; UI menunjukkan siapa sedang ditunggu.
7. **Resolution:** sistem mengubah kartu/koin/state setelah resolusi atau keputusan manual yang sah.
8. **Round end:** tentukan pemenang, tampilkan ringkasan, tampilkan klasemen kemenangan sesi meja. Host dapat langsung main lagi dengan konfigurasi yang sama atau kembali ke lobi. Pembuka partai pertama diacak server. Pemenang terakhir membuka partai berikutnya jika masih duduk di meja.

Saat Steal atau Assassinate, hanya target yang dapat menantang atau memblokir. Setiap klaim blok hanya dapat ditantang oleh pemilik aksi awal. Challenge, semua Block yang sah, dan Pass tersedia bersamaan. Pass menutup kesempatan pemain itu untuk memblokir. Saat ditantang, hanya pemilik klaim aksi atau blok memilih untuk menunjukkan kartu hidup yang cocok dan menggantinya, atau menggugurkan satu kartu hidup pilihannya. Mengalah tidak membuka kartu lain. Setiap Challenge terhadap klaim aksi maupun blok membatalkan aksi asal. Jika klaim dilepas, pemilik klaim kehilangan satu influence. Jika klaim dibuktikan, penantang kehilangan satu influence. Biaya deklarasi yang telah dibayar tetap terpakai.

Bentara Istana adalah narator sistem dengan potret dan popup sendiri. Pada Guess benar, satu kartu yang cocok ditunjukkan lebih dahulu, lalu pemilik kartu mengakui tebakan sebelum kartu gugur. Pada Guess salah, identitas kartu target tetap privat. Hanya target menerima pilihan Benar atau Salah. Manusia dan bot mengirim nilai jawaban melalui command yang sama. Jawaban yang tidak sesuai kartu hidup ditolak dan target tetap dapat menjawab. Bentara menyampaikan hasil terverifikasi sebelum pengumuman kehilangan influence. Server menentukan benar atau salah berdasarkan kartu hidup saat konfirmasi.

## 8. Challenge & Block — Hybrid (Keputusan Final Model Interaksi)

**Keputusan:** mode **Hybrid (C)**. **Default Response Timer OFF**; jika host memilih **ON**, batas waktunya **30 detik untuk setiap response window**. Host memilih **Response Timer ON/OFF** sebelum memulai pertandingan. Pilihan dikunci selama pertandingan dan terlihat oleh semua pemain. Timer merupakan **pengaturan gameplay**, bukan house rule khusus.

Untuk Challenge terhadap aksi Steal atau Assassinate, hanya target hidup yang masuk daftar respons. Pemain lain tidak harus Pass. Tax dan Exchange tetap membuka Challenge bagi lawan hidup. Challenge terhadap klaim blok adalah jendela tersendiri dengan peserta sesuai aturan blok yang sudah berlaku.

### Timer ON

1. Saat muncul kesempatan challenge/block, server membuka *response window* **30 detik** untuk **pemain yang memang berhak** merespons, dan klien menampilkan aksi, pihak terkait, serta hitung mundur berdasarkan waktu server. Setiap window baru mendapatkan tenggat 30 detik sendiri, bukan melanjutkan hitungan window sebelumnya.
2. Pemain berhak memilih **Challenge**, **Block** (hanya bila aksi dan perannya memungkinkan), atau **Pass**, sesuai fase yang sedang aktif. Jangan tampilkan tombol yang tidak sah pada fase tersebut.
3. Jika semua respons yang dibutuhkan sudah masuk atau sebuah respons valid menentukan perpindahan fase, server melanjutkan sesuai prioritas state machine; jika waktu habis, semua yang belum merespons dianggap **Pass** secara otomatis.
4. Timer harus dijalankan dan divalidasi **di server**. Paket terlambat, duplikat, dan respons setelah fase ditutup ditolak; klien tersinkronisasi ke state resmi.

### Timer OFF

1. Tidak ada hitung mundur dan **tidak ada auto-pass** karena waktu.
2. Fase menunggu semua pemain yang berhak merespons **Pass** atau keputusan valid yang mengakhiri/mengubah fase sesuai aturan.
3. Host memiliki kontrol khusus **Akhiri fase respons** untuk memperlakukan pemain yang belum merespons sebagai **Pass**; setiap penggunaan dicatat dalam event log/audit dan hanya dapat digunakan pada fase respons yang memang sedang terbuka.
4. UI memperlihatkan siapa yang belum memberikan respons, termasuk pemain terputus, agar host bisa menyelesaikan fase secara sadar.

### Ketentuan fairness dan implementasi

- **Challenge dan Block berbeda fase untuk aksi klasik** (pengecualian Tax dengan Duke Blocks Tax aktif ada di §6): engine harus menghitung siapa yang eligible, urutan respons, kemungkinan challenge terhadap block, dan prioritas resolusi untuk setiap aksi klasik; jangan menganggap semua pemain selalu bisa melakukan block.
- Jika beberapa respons bersamaan, backend memproses command **secara atomik dan berurutan**. Respons pertama yang sah diproses menurut aturan fase dan sisanya divalidasi ulang terhadap state terbaru; tidak boleh ada dua hasil kontradiktif.
- Pengakhiran manual oleh host **bukan** hak untuk memaksakan challenge/block atau mengetahui kartu tersembunyi.
- State respons harus bertahan selama reconnect; pemain yang kembali melihat sisa waktu resmi jika timer ON, atau daftar pending jika OFF.
- **Konfigurasi final:** timer **OFF secara default**; jika **ON**, durasi **30 detik per response window**. Tampilkan konfigurasi di lobby dan snapshot saat start; perubahan hanya untuk match berikutnya.
- **Disconnect:** kebijakan khusus saat pemain disconnect masih terbuka; jangan mengarang auto-pass tambahan saat timer OFF. Untuk timer ON, deadline server tetap berlaku kecuali game dipause; detail kebijakan tambahan perlu diputuskan.

### Acceptance test khusus

- [ ] Lobby baru menggunakan default timer OFF; mengaktifkan ON menetapkan durasi tepat 30 detik untuk tiap response window.
- [ ] Timer OFF: fase tidak pernah lanjut hanya karena waktu berlalu.
- [ ] Timer OFF: semua eligible Pass membuat fase berlanjut tanpa intervensi host.
- [ ] Timer OFF: host dapat mengakhiri fase; remaining pending dicatat sebagai Pass dengan audit jelas.
- [ ] Timer ON: deadline 30 detik dihitung di server untuk setiap window; kedaluwarsa waktu memicu Pass otomatis hanya untuk eligible yang belum merespons.
- [ ] Challenge/block yang valid mengalihkan fase tepat sekali, termasuk ketika respons datang hampir bersamaan.
- [ ] Client tidak dapat memanipulasi deadline atau memberikan respons setelah window ditutup.
- [ ] Reconnect menampilkan phase, eligibility, dan timer/pending terbaru secara konsisten.

## 9. Host Controls — Moderate (Keputusan Final)

**Cakupan izin host saat pertandingan:**

1. **Basic:** kelola lobby, konfigurasi room sebelum game dimulai, mulai pertandingan, dan akhiri fase respons ketika timer OFF (pending eligible dianggap Pass dan diaudit).
2. **Pause/Resume:** host dapat menghentikan sementara kemajuan game. Saat pause, command gameplay biasa ditolak; jendela waktu yang aktif dibekukan dan dilanjutkan dengan sisa durasi yang sama ketika resume. Semua klien menerima status pause secara real-time.
3. **Coin correction:** host dapat memperbaiki jumlah koin seorang pemain dengan memasukkan nilai akhir nonnegatif dan alasan singkat; command divalidasi di server serta dicatat dalam audit log bersama nilai sebelum/sesudah dan identitas host. Koreksi bukan aksi Coup biasa.
4. **Safe undo (last action only):** host hanya boleh membatalkan **aksi terakhir yang telah selesai** jika belum ada aksi/keputusan lanjutan dan pembatalan tidak mengungkap, mengganti, mengocok, atau mengubah pengetahuan tentang informasi rahasia. Implementasi wajib memakai *reversible event/checkpoint* atau kompensasi yang tervalidasi, bukan rollback database tanpa pemeriksaan. Bila kelayakan undo meragukan, **tolak undo** dengan penjelasan. Contoh calon undo aman: Income yang baru diselesaikan tanpa respons/aksi lanjutan. Contoh tidak aman: Exchange yang sudah melihat kartu deck, reveal kartu akibat Challenge, Assassination yang membuka kartu, atau penggantian kartu setelah challenge.
5. **Akhiri pertandingan:** host dapat mengakhiri partai aktif atau dijeda tanpa pemenang. Server menghentikan timer dan bot, mencatat keputusan host dan mempertahankan klasemen sesi. Host dapat main lagi atau kembali ke lobi.
6. **Tidak diizinkan:** melihat kartu rahasia pemain, mengubah kartu/deck, memulihkan/menghapus influence sesuka hati, memaksa hasil challenge, memindahkan giliran secara arbitrer, atau undo multi-aksi. Untuk kasus di luar ini, penyelesaian sosial di luar sistem atau rematch; jangan memberi superuser bypass.

**Validasi dan audit:**

- Setiap host command memiliki tipe eksplisit, hanya diterima dari sesi host resmi, dan diuji dengan permissions di backend.
- Event log publik menunjukkan jenis intervensi, target, dan alasan bila sesuai; jangan membocorkan state privat.
- Perintah host harus idempotent, menolak state basi/race condition, dan di-broadcast agar semua pemain sinkron.
- Jika host terputus, tidak ada pemain lain yang otomatis memperoleh host privilege tanpa proses transfer aman (kebijakan transfer host belum diputuskan).

### Acceptance tests Host Controls

- [ ] Non-host tidak dapat memanggil pause/resume, koreksi koin, host-close, atau undo lewat API/socket langsung.
- [ ] Pause menghentikan clock response ON; resume melanjutkan waktu tersisa tanpa auto-pass tidak sengaja.
- [ ] Coin correction disimpan beserta nilai awal, nilai baru, host, dan alasan; nilai negatif ditolak.
- [ ] Safe undo berhasil untuk Income terakhir tanpa perkembangan lanjutan; event tercatat.
- [ ] Undo ditolak jika sudah ada reveal/Exchange atau informasi privat lain terpapar, maupun bila aksi lain sudah diproses.
- [ ] Host tidak memperoleh akses ke kartu privat ataupun kendali arbitrary influence/turn.

## 10. Add Computer — Bot Players (Fitur Final, Spesifikasi Awal)

**Tujuan:** pengguna bisa membuat private room sendiri, menambah satu atau lebih **Computer**, lalu bermain meski tidak ada teman online. Room yang sama juga bisa berisi kombinasi pemain manusia dan bot.

### Perilaku lobby & slot

1. Tombol **Add Computer** hanya tersedia bagi host sebelum game dimulai; setiap klik menambah **satu slot bot** hingga batas 6 peserta total.
2. Host dapat **Remove Computer** dari lobby sebelum game dimulai. Pemain manusia yang bergabung juga memakan satu slot; slot yang penuh tidak boleh dilewati.
3. Bot ditampilkan sebagai participant biasa dengan label eksplisit **Computer** (contoh: `Computer 1`), tidak menyamar sebagai manusia.
4. **Minimum start: 2 peserta total**, termasuk host manusia. Contoh sah: 1 manusia + 1 bot; 1 manusia + 5 bot; 3 manusia + 3 bot. Minimal harus ada satu pemain manusia yang menjadi host ketika room dibuat.
5. Bot tidak memiliki login, socket klien, token reconnect, atau akses panel host. Bot sepenuhnya dikendalikan server.
6. Pengaturan jumlah bot dikunci saat pertandingan dimulai; tidak ada add/remove bot di tengah permainan pada MVP.

### Bot gameplay & fairness

1. Bot merupakan **aktor gameplay** pada game engine yang sama, bukan cheat atau host command. Semua aksi bot melewati validasi command dan state machine yang sama seperti aksi pemain manusia.
2. Bot harus bisa memilih aksi/target, membuat klaim (termasuk kemungkinan bluff), merespons challenge/block, memilih influence yang hilang, menukar kartu saat Exchange, dan bertindak saat eligible untuk challenge terhadap block.
3. Bot hanya boleh memanfaatkan informasi yang sah: kartunya sendiri, kartu yang telah terbuka, jumlah koin publik, event log publik, aksi/reaksi terdahulu, dan konfigurasi house rules aktif. **Tidak boleh membaca tangan lawan atau urutan deck tersembunyi sebagai input strategi**, meski backend memegang data itu.
4. **Bot policy** harus independen dari game engine dan diberi `BotObservation` tersanitasi. Output berupa command biasa; invalid command tidak boleh mengunci room (gunakan validasi dan fallback legal yang aman).
5. Bot **menggunakan strategi heuristik/probabilistik dengan unsur acak yang terkendali**; dapat melakukan bluff, memperkirakan klaim/kartu lawan dari informasi publik, dan mengadaptasi keputusan berdasarkan riwayat aksi. **LLM/API eksternal bukan syarat MVP**. Dilarang menjadikan layanan AI berbayar atau koneksi internet AI sebagai ketergantungan wajib.
6. Jika bot sedang ditunggu dalam response window, sistem membuat keputusan/respons otomatis sesuai aturan prioritas. Bot wajib menghormati timer ON (deadline server) maupun OFF (tidak menyebabkan deadlock). Reaksi bot memakai penjadwalan yang dapat dibatalkan saat pause, phase change, atau game selesai.
7. Host pause/resume memengaruhi bot juga; tidak boleh ada tindakan bot ketika pause. Semua aksi bot tampil di event log dengan atribusi yang jelas.
8. Jika house rule aktif, bot wajib patuh pada rule tersebut; bila ada house rule baru yang menambah pilihan/aksi, policy bot harus ditinjau agar tetap bisa menyelesaikan game. Jangan mengarang aturan yang belum diberikan pengguna.
9. Strategic Bot (B) dengan **tiga level Easy / Normal / Hard** adalah keputusan final. Setiap bot punya difficulty independen, dapat diatur oleh host di lobby sebelum start; default awal **Normal**. Parameter numerik dan kecepatan respons masih **open decision**; jangan mengunci angka arbitrer sebagai keputusan produk.

### Acceptance tests bot

- [ ] Host solo bisa menambah bot dan start saat total peserta minimal 2.
- [ ] Room menolak total peserta ketujuh untuk kombinasi manusia + bot mana pun.
- [ ] Add/Remove Computer hanya di lobby dan hanya oleh host.
- [ ] Bot dapat menyelesaikan permainan penuh dengan setidaknya satu pemain manusia, termasuk challenge, block, reveal, Exchange, dan eliminasi.
- [ ] Bot mengikuti aturan koin, Coup wajib >=10, serta validasi aksi yang sama dengan manusia.
- [ ] Bot tidak membaca hidden cards lawan/deck pada observation strategy.
- [ ] Bot dapat merespons pada timer OFF dan tidak bertindak saat pause atau setelah phase change.
- [ ] Room dengan 1 manusia + 5 bot tidak mengalami deadlock dan menghasilkan pemenang.

## 10A. Strategic Bot — Keputusan Final dan Kontrak Implementasi

**Keputusan final:** **B — Strategic Bot** dengan **Easy / Normal / Hard**. Bot harus memiliki **tiga tingkat kesulitan**, mampu **bluff**, mempertimbangkan **probabilitas kepemilikan kartu/kebenaran klaim**, dan menyesuaikan strategi dari **riwayat aksi yang dapat diamati secara sah**. Tidak perlu LLM, koneksi AI eksternal, atau biaya per aksi.

### Arsitektur policy

- Pisahkan `BotPolicy` dari rules engine. Engine mengirim `BotObservation` yang hanya memuat data publik, kartu sendiri yang masih hidup, daftar aksi legal serta data probabilistik yang dihitung dari informasi legal.
- `BotObservation` **tidak boleh** memuat deck tersembunyi, kartu tersembunyi lawan, random seed shuffle, ataupun state privat lawan, bahkan jika berjalan dalam proses server yang sama.
- Bot memilih dari `legalActions` dan `legalResponses`; output harus melewati validator authoritative yang identik dengan pemain manusia.
- Simpan **belief state** per bot berbasis riwayat publik: klaim yang sering dilakukan, challenge yang terbukti, kartu terbuka, riwayat pengeluaran koin, respons block, dan kecenderungan bluff. Belief adalah *perkiraan*, bukan akses ke keadaan kartu sesungguhnya.
- Dalam Coup, aksi yang diklaim **tidak membuktikan** kartu dimiliki; jangan memakai probabilitas seolah klaim itu fakta. Pertimbangkan kartu bot sendiri, kartu yang telah terbuka, dan konsistensi riwayat klaim.
- Bot memilih target secara strategis berdasarkan ancaman, koin, influence aktif, dan histori interaksi; jangan mengarang pengetahuan kartu tersembunyi.
- Support kebijakan kesulitan yang benar-benar berbeda dalam evaluasi risiko, frekuensi bluff, pertimbangan target, dan pemanfaatan riwayat. Level harus memengaruhi kualitas keputusan, **bukan** memberikan informasi rahasia atau melanggar aturan.
- Gunakan RNG yang dapat di-seed untuk tests; simulasikan banyak pertandingan dengan seed berbeda untuk menghindari bot yang selalu melakukan hal sama.
- Seluruh keputusan bot, termasuk respons pada timer OFF, harus terjadwal, dapat dibatalkan dan tidak melanggar pause/resume atau transisi fase. Jadwal harus aman terhadap command duplikat.
- Bila opsi legal berubah saat bot bertindak, engine melakukan revalidasi dan memilih fallback legal dengan log internal; bot tidak boleh membuat room terjebak.
- House rules nanti harus diintegrasikan dengan generator aksi legal, observation, evaluation, dan testing bot. Rule baru yang tidak didukung bot harus menghalangi start room berisi bot atau menyediakan policy yang sah—tidak boleh silent fail.

### Difficulty presets (final v0.9)

- **Easy:** mengutamakan aksi legal sederhana; kadang bluff, challenge dan block secara masuk akal namun tidak optimal; pemilihan target dan penggunaan histori masih terbatas. Bukan bot yang selalu bergerak random.
- **Normal:** seimbang antara pengumpulan koin, bluff, challenge, dan risiko; memakai informasi publik terkini serta riwayat klaim dan respons untuk memilih target dan aksi.
- **Hard:** analisis informasi publik dan belief state lebih mendalam; pemilihan target, estimasi risiko, dan penyesuaian strategi lebih kuat. Tidak memiliki pengetahuan privat tambahan atau hak istimewa.
- **Konfigurasi lobby:** host dapat menetapkan `difficulty: easy | normal | hard` **per bot** sebelum game dimulai, dengan default `normal`; tunjukkan level di baris bot; perubahan terkunci saat match dimulai. Bot yang berbeda boleh memakai level berbeda dalam satu room.
- **Kontrak data:** simpan difficulty bersama seat bot dalam konfigurasi room/match snapshot; engine mengirim observation sama bentuknya untuk semua level, dan policy memakai difficulty untuk memilih heuristik. Jangan menyandikan difficulty melalui akses tersembunyi atau menonaktifkan legal validation.
- **Tuning:** ambang probabilitas, bias bluff, frekuensi reaksi, dan jeda keputusan adalah nilai implementasi awal yang dapat diuji/dituning, **bukan** nilai produk yang sudah disepakati. Perbedaan level harus konsisten secara statistik tanpa mewajibkan Hard selalu menang.

### Pengujian khusus Strategic Bot

- [ ] **Easy, Normal, dan Hard** dapat menyelesaikan game penuh tanpa deadlock pada 2–6 peserta.
- [ ] Host dapat menetapkan level berbeda pada setiap bot; default Normal; konfigurasi terkunci setelah start dan dipertahankan dalam snapshot/reconnect.
- [ ] Perubahan difficulty memengaruhi strategi pada uji simulasi multi-seed tanpa membocorkan informasi privat, tanpa mengharuskan Hard menang setiap permainan.
- [ ] Dalam skenario terkontrol bot dapat memilih bluff dan dapat melakukan challenge/block yang sah.
- [ ] Belief berubah setelah informasi publik baru (reveal/challenge/riwayat klaim) tetapi tidak berubah karena perubahan kartu lawan yang masih tersembunyi.
- [ ] Mengganti hidden deck/opponent cards sambil menjaga observation identik tidak mengubah keputusan untuk RNG seed yang sama (**information-leak test**).
- [ ] Profil kesulitan benar-benar mengubah decision policy; semua kesulitan tetap mematuhi validasi game.
- [ ] Bot tidak beraksi setelah phase change, pause, eliminasi, atau game over.
- [ ] Stress test turn dan simultaneous responses bot+manusia tidak menghasilkan double resolution.

## 11. State Machine (Perlu Dirinci Saat Desain Teknis)

Contoh fase yang diusulkan:

`LOBBY -> DEALING -> TURN_ACTION -> CHALLENGE_WINDOW -> BLOCK_WINDOW -> BLOCK_CHALLENGE_WINDOW -> RESOLUTION -> INFLUENCE_SELECTION -> TURN_END -> GAME_OVER`

Fase tidak selalu dilewati semuanya; urutan tergantung aksi yang dipilih. Semua command harus memvalidasi fase, actor, target, saldo koin, dan status pemain. Event harus memisahkan payload publik dari payload privat.

## 12. Rekomendasi Teknologi (Belum Disetujui)

- UI: Next.js + TypeScript + Tailwind CSS.
- Realtime/backend: Node.js + Socket.IO, atau stack setara yang memungkinkan server-authoritative game loop.
- Penyimpanan: in-memory untuk prototipe lokal; Redis untuk room aktif saat production; database relasional hanya jika perlu histori dan akun.
- Testing: unit tests untuk aturan dan state machine, integration tests untuk room/reconnect/replay.
- Delivery: Docker Compose untuk hosting mandiri.

> Agent tidak boleh memperlakukan pilihan teknologi ini sebagai keputusan final sebelum dikonfirmasi.

## 13. Non-Functional Requirements

- Responsif: antarmuka dapat dioperasikan dengan nyaman lewat layar sentuh dan desktop.
- Konsistensi realtime: command idempotent; cegah race condition saat challenge/block bersamaan.
- Reconnect: pemain dapat kembali ke room dengan token sesi privat yang persisten tanpa membuka informasi rahasia pemain lain; nickname atau kode room saja tidak boleh dipakai untuk mengambil alih kursi pemain.
- Private room security: kode undangan acak sulit ditebak, validasi kapasitas dan keanggotaan, opsi host menutup akses join saat game dimulai.
- Keamanan: server memvalidasi semua aksi; room code sulit ditebak; tidak mempercayai state yang dikirim klien.
- Aksesibilitas: informasi penting tidak disampaikan hanya lewat warna atau animasi.
- Observability: log kesalahan server terpisah dari event log yang dapat dilihat pemain.

## 14. Rencana Tahapan Implementasi untuk AI Agent

**Phase 0 — Lock specification**
- Kunci daftar house rules, detail varian 2 pemain, dan teknologi. **Kapasitas 2–6 sudah final.**
- Uraikan seluruh state transition beserta contoh dan edge case.
- Susun acceptance criteria dan fixture pengujian tiap aksi.

**Phase 1 — Rules engine**
- Bangun domain model, command validation, state machine, event model, dan tests tanpa UI kompleks.
- Terapkan Coup klasik dengan test challenge/block/resolution.
- Implementasikan registry house rules dan dua modul yang sudah diberikan (`one_time_guess`, `duke_blocks_tax`) beserta pengujian ON/OFF; jangan mengarang rule tambahan.

**Phase 2 — Multiplayer foundation + Strategic Bots**
- Implementasi lobby, room code, player session, host settings, deal privat, reconnect, realtime event broadcasting.
- Implementasikan Add/Remove Computer dan **Strategic Bot** server-side melalui command/state machine yang sama; uji solo-vs-bot, mixed room, berbagai tingkat kesulitan, bluff/challenge, observation sanitization, dan timer ON/OFF.

**Phase 3 — Hybrid Classic Tabletop + Modern UI**
- Buat table layout bernuansa permainan fisik Coup, kartu dan koin terbaca jelas, action controls modern, target picker, response prompts, log, indikator giliran, dan mobile layout.
- Tambahkan Add Computer / Remove Computer pada lobby dan penanda Computer yang jelas pada meja; prioritaskan performa, aksesibilitas, dan ukuran sentuh di ponsel.

**Phase 4 — Tongkrongan rules**
- Integrasikan, uji, dan poles kedua modul yang telah diberikan: One-Time Guess dan Duke Blocks Tax (jika belum selesai di Phase 1).
- Uji aturan ON, OFF, dan konflik antarrule.

**Phase 5 — QA & deployment**
- Jalankan pengujian skenario multipemain dan edge cases.
- Siapkan Docker dan panduan konfigurasi/deployment.

## 15. Acceptance Criteria Awal

- [ ] Pemain dapat membuat dan bergabung **room privat** menggunakan kode/link dari perangkat berbeda tanpa login.
- [ ] Tidak ada katalog room publik atau matchmaking.
- [ ] Room menolak peserta ketujuh (manusia atau bot); reconnect pemain manusia sah tidak dihitung sebagai pemain baru.
- [ ] Start game ditolak bila peserta total kurang dari 2; berhasil dengan 2 hingga 6 peserta termasuk bot, dan 1 manusia + bot sah.
- [ ] Deck tepat 15 kartu (3 per karakter), masing-masing pemain memperoleh 2 kartu tanpa duplikasi kartu fisik; sisa deck benar untuk setiap kapasitas.
- [ ] Setelah pemain/bot keluar atau dihapus sebelum start, slot bisa dipakai peserta baru; setelah start, kebijakan penggantian kursi harus ditetapkan dan tidak boleh mengambil alih sesi pemain lain.
- [ ] Pemain yang tidak memiliki kode/link valid tidak dapat masuk room.
- [ ] Hanya pemain pemilik yang dapat membaca kartu rahasianya.
- [ ] Sistem menolak aksi dari pemain yang bukan gilirannya.
- [ ] Challenge dan block tidak dapat menghasilkan perubahan state ganda.
- [ ] Pengaturan timer respons Hybrid default OFF dan 30 detik per window saat ON, dengan host-close auditable saat OFF.
- [ ] Kontrol Moderate berjalan aman: pause/resume, koreksi koin, safe undo yang dibatasi, dengan permission check dan audit log.
- [ ] Semua aksi inti Coup lulus unit/integration tests.
- [ ] Semua pemain melihat konfigurasi aturan yang sama.
- [ ] Toggle house rule OFF mengembalikan perilaku dasar untuk bagian aturan tersebut.
- [ ] `one_time_guess` ON: setiap pemain (termasuk bot) punya satu percobaan sepanjang pertandingan; benar menghilangkan satu influence target yang cocok, salah menghilangkan satu influence penebak; pemakaian kedua ditolak dan tidak membocorkan kartu tersembunyi.
- [ ] `one_time_guess` OFF: Guess tidak muncul/tidak valid; rematch mereset kesempatan saat ON.
- [ ] `duke_blocks_tax` ON: Tax dapat diblokir klaim Duke lain; klaim pemblokir dapat di-Challenge; block valid mencegah penambahan 3 koin, block bluff mengikuti konsekuensi challenge dan Tax tetap batal.
- [ ] `duke_blocks_tax` OFF: Tax tidak dapat diblokir, tetapi klaim Duke pengambil Tax tetap dapat di-Challenge.
- [ ] Kombinasi kedua rule ON berjalan baik untuk manusia/bot, timer ON/OFF, reconnect, serta fase challenge dan resolusi simultan.
- [ ] Pemain yang reconnect memperoleh state terbaru tanpa bocor private data.
- [ ] Game mendeteksi pemenang dan dapat memulai rematch.
- [ ] Aplikasi dapat digunakan pada viewport ponsel dan desktop dengan visual **Hybrid: Classic Tabletop + Modern UI**.
- [ ] Host dapat add/remove computer sebelum start, slot bot dihitung pada limit 6, dan solo-vs-bot dapat dimainkan hingga selesai.
- [ ] Bot tunduk pada rules engine yang sama, tidak mengakses rahasia lawan untuk strategi, bekerja di timer ON/OFF, dan mendukung bluff, evaluasi risiko serta kesulitan yang berbeda.

## 16. Deferred Decisions — Tidak Menghalangi Eksekusi MVP

1. **House rules:** dua aturan sudah tersedia dan wajib diimplementasikan. Rincian kapan Guess boleh dipakai masih menggunakan asumsi eksplisit (sebagai aksi giliran tanpa biaya, tidak dapat diblokir/challenge) sampai ada koreksi dari pengguna.
2. **Host governance:** mekanisme transfer host saat terputus dan kebijakan permintaan koreksi dari pemain lain belum diputuskan. Scope Moderate telah final.
3. **Multiplayer:** private room dan perangkat masing-masing sudah diputuskan. Dukungan hot-seat/satu layar bersama **di luar MVP** kecuali diminta kemudian.
4. **Response timing:** mode Hybrid, **default OFF** dan **30 detik per window saat ON** sudah final. Kebijakan disconnect **Hybrid** telah final; rincian grace period adalah parameter implementasi.
5. **Jumlah pemain:** sudah final **2–6**; detail setup khusus 2 pemain masih harus ditentukan.
6. **Visual theme & UX:** opsi **D Hybrid** final; rincian ilustrasi original, animasi/sound, dan referensi visual masih perlu disepakati.
7. **Hosting:** target VPS Jejakode, domain `coup.jejakode.com`, di belakang nginx-proxy/ACME lewat `shared-network`. Kapasitas aktual perlu diverifikasi saat rollout.
8. **Bot policy:** Strategic Bot (B) dengan **Easy / Normal / Hard**, per-bot difficulty, dan default Normal sudah final; parameter heuristik, tempo respons, dan detail gaya masih terbuka. Heuristik/probabilistik tanpa LLM berbayar menjadi baseline implementasi.

## 17. Guardrails untuk AI Coding Agent

- **Mulai implementasi MVP sekarang secara bertahap.** Jangan menunggu seluruh keputusan kosmetik/non-esensial. Implementasikan dua house rules yang sudah diberikan; jangan mengarang aturan baru.
- Jangan membuat atau menebak house rules sebelum diterima spesifikasi eksplisit.
- Pisahkan aturan domain dari UI dan network transport.
- Mulai dari rule engine yang dapat diuji; jangan mendahulukan efek visual dibanding konsistensi aturan.
- Setiap fase harus menghasilkan artefak yang dapat diuji sebelum melanjutkan.
- Untuk hal non-esensial yang belum final, pilih default yang aman dan dokumentasikan sebagai asumsi implementasi; hanya eskalasi jika berisiko mengubah inti aturan atau membocorkan informasi rahasia.
- **Desain visual dan konten:** gunakan lima ilustrasi kartu yang diberikan pengguna untuk wajah peran, dan buat aset lainnya secara orisinal; jangan menyalin karya seni, ikon, layout kartu, atau materi berhak cipta dari edisi komersial tanpa hak penggunaan.


## 18. Keputusan Final: Hybrid Disconnect & Eksekusi MVP (v1.2)

- Putus koneksi **tidak otomatis pause** seluruh permainan. Kursi, kartu, influence, dan koin pemain offline tetap tersimpan; status offline terlihat oleh peserta.
- Host boleh **pause/resume**. Saat pause, waktu respons dan pekerjaan bot ditangguhkan serta tidak boleh diam-diam ter-resolve.
- **Timer ON:** response window 30 detik terus berjalan saat pemain offline kecuali host pause. Respons yang belum diberikan pada deadline dianggap Pass.
- **Timer OFF:** tidak ada auto-pass untuk pemain manusia offline. Fase menunggu respons; host boleh menutup fase sesuai hak Moderate Host Controls, tetapi tidak boleh memalsukan challenge/block atas nama pemain.
- **Giliran pemain offline:** jangan otomatis memilih aksi, kehilangan influence, atau mengeliminasi pemain; tampilkan status menunggu dan berikan host kendali pause. Reconnect sah melanjutkan kursi yang sama.
- **Host offline:** state room tetap berjalan; kontrol host unavailable sampai reconnect. Tidak ada transfer host otomatis dalam MVP.
- Pemain yang offline tidak boleh digantikan bot di tengah pertandingan pada MVP. Jika gangguan tidak terselesaikan, host dapat menyepakati berhenti dan membuat match baru.
- Reconnect menggunakan token sesi privat yang tervalidasi server; jangan mengizinkan takeover hanya dengan nickname/kode room.

### Instruksi mulai coding sekarang

1. Buat proyek TypeScript dengan **Next.js (frontend), Node.js/Socket.IO (realtime), engine murni TypeScript**, dan test runner Vitest. Jika repo yang ada sudah memiliki stack kompatibel, pertahankan stack yang ada. Gunakan penyimpanan in-memory untuk pengembangan lokal; abstraksikan repository agar dapat diganti Redis nantinya.
2. Implementasikan rules engine Coup klasik, termasuk aturan setup 2 pemain sebagai **varian yang perlu divalidasi**: untuk MVP boleh gunakan deal acak 2 influence dari deck standar sambil mencatat bahwa ini simplifikasi, bukan mengklaim aturan resmi dua pemain.
3. Lanjutkan lobby private, sesi reconnect, challenge/block Hybrid, host controls, bot Easy/Normal/Hard, kemudian UI responsif.
4. House rule registry wajib memuat tepat dua modul yang telah ditentukan; jangan tambahkan rule fiktif. Jangan membuat house rules fiktif.
5. Sediakan cara run lokal, tes automated untuk aturan/kartu rahasia/reconnect, dan demo minimal 1 manusia vs 1 bot hingga game selesai.
6. Prioritaskan gameplay yang berfungsi di atas ilustrasi/animasi. Tidak perlu diskusi tambahan kecuali aturan inti tidak dapat diputuskan secara aman.

### Voice chat meja (final)
Pemain dapat bergabung lewat tombol mikrofon di deretan kontrol kanan atas dan mengizinkan mikrofon untuk berbicara dengan peserta voice di room yang sama. Mikrofon awalnya mati. Mute tetap memungkinkan mendengar pemain lain. Keluar atau terputus menghentikan mikrofon. Suara diteruskan langsung tanpa disimpan dalam riwayat.
