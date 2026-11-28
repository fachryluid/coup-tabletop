"use client";

const CHARACTER_GUIDE = [
  {
    role: "Duke",
    image: "/cards/duke.webp",
    action: "Tax (+3 koin)",
    block: "Blokir Foreign Aid (dan Tax bila aturan tambahan aktif)",
    summary: "Mengumpulkan kekayaan paling cepat dari kas istana.",
  },
  {
    role: "Assassin",
    image: "/cards/assassin.webp",
    action: "Assassinate (bayar 3 koin)",
    block: "—",
    summary: "Menyingkirkan satu kartu pengaruh milik lawan secara murah.",
  },
  {
    role: "Captain",
    image: "/cards/captain.webp",
    action: "Steal (curi hingga 2 koin)",
    block: "Blokir Steal",
    summary: "Merampas koin lawan sekaligus menghambat rencana Coup mereka.",
  },
  {
    role: "Ambassador",
    image: "/cards/ambassador.webp",
    action: "Exchange (tukar kartu dek)",
    block: "Blokir Steal",
    summary: "Menarik 2 kartu dari dek dan memilih kombinasi terbaik di tangan.",
  },
  {
    role: "Contessa",
    image: "/cards/contessa.webp",
    action: "—",
    block: "Blokir Assassinate",
    summary: "Pelindung utama untuk menggagalkan serangan Assassin lawan.",
  },
] as const;

export function HowToPlay({ onStart }: { onStart: () => void }) {
  return (
    <section
      id="cara-bermain"
      className="how-to-play"
      aria-labelledby="how-to-play-heading"
    >
      <div className="htp-hero">
        <span className="htp-kicker">Panduan Singkat</span>
        <h2 id="how-to-play-heading">
          Apa itu The Ultimate Coup &amp; Cara Bermain
        </h2>
        <p className="htp-lead">
          <strong>The Ultimate Coup</strong> adalah permainan kartu deduksi,
          strategi, dan gertakan (<em>bluffing</em>) untuk{" "}
          <strong>2–6 pemain</strong>. Setiap pemain memegang{" "}
          <strong>2 kartu pengaruh</strong> tertutup dan{" "}
          <strong>2 koin</strong>. Kamu bebas mengklaim karakter apa pun—baik
          sungguhan maupun menggertak—untuk menyingkirkan lawan hingga tinggal{" "}
          <strong>satu pemain terakhir yang bertahan</strong>.
        </p>
      </div>

      <div className="htp-steps" aria-label="Alur permainan">
        <article className="htp-step">
          <span className="htp-step-num" aria-hidden="true">
            1
          </span>
          <h3>Persiapan Meja</h3>
          <p>
            Dek berisi 15 kartu (3 lembar untuk tiap 5 karakter). Setiap pemain
            memulai dengan 2 kartu tertutup dan 2 koin. Hanya kamu yang bisa
            melihat kartumu sendiri.
          </p>
        </article>
        <article className="htp-step">
          <span className="htp-step-num" aria-hidden="true">
            2
          </span>
          <h3>Ambil Aksi di Giliranmu</h3>
          <p>
            Pilih aksi umum atau klaim aksi karakter. Kamu boleh menggertak
            mengaku memiliki karakter yang tidak ada di tanganmu, serta{" "}
            <strong>menukar posisi kartu kiri ↔ kanan</strong> sekali per
            giliran (bila masih punya 2 kartu) tanpa menghabiskan giliran. Jika
            memulai giliran dengan <strong>10 koin atau lebih</strong>, wajib
            melakukan <strong>Coup</strong>.
          </p>
        </article>
        <article className="htp-step">
          <span className="htp-step-num" aria-hidden="true">
            3
          </span>
          <h3>Challenge &amp; Block</h3>
          <p>
            Lawan dapat <strong>Challenge</strong> (meminta bukti kartu) atau{" "}
            <strong>Block</strong> (memblokir dengan peran tertentu). Jika
            tantangan gagal, kartu bukti ditukar dari dek dan penantang gugur 1
            kartu; jika bluff tertangkap, pengklaim gugur 1 kartu.
          </p>
        </article>
        <article className="htp-step">
          <span className="htp-step-num" aria-hidden="true">
            4
          </span>
          <h3>Bertahan Sampai Akhir</h3>
          <p>
            Kartu yang gugur dibuka ke meja. Jika kedua kartumu gugur, kamu
            tereliminasi. Pemain terakhir yang masih memiliki kartu pengaruh
            memenangkan pertandingan!
          </p>
        </article>
      </div>

      <div className="htp-block">
        <h3>Aksi Umum (Tanpa Klaim Peran)</h3>
        <div className="htp-actions-grid">
          <article className="htp-action-card">
            <div className="htp-action-top">
              <b>Income</b>
              <span className="htp-tag">+1 koin</span>
            </div>
            <p>
              Ambil 1 koin dari kas istana. Aman—tidak dapat di-Challenge maupun
              di-Block.
            </p>
          </article>
          <article className="htp-action-card">
            <div className="htp-action-top">
              <b>Foreign Aid</b>
              <span className="htp-tag">+2 koin</span>
            </div>
            <p>
              Ambil 2 koin dari kas istana. Tidak perlu klaim peran, tetapi
              dapat diblokir oleh lawan yang mengklaim <strong>Duke</strong>.
            </p>
          </article>
          <article className="htp-action-card htp-action-coup">
            <div className="htp-action-top">
              <b>Coup</b>
              <span className="htp-tag htp-tag-danger">Bayar 7 koin</span>
            </div>
            <p>
              Gugurkan langsung 1 kartu lawan tanpa bisa diblokir atau
              ditantang. Jika target masih punya 2 kartu, kamu{" "}
              <strong>memilih kartu kiri atau kanan</strong> miliknya. Wajib
              dilakukan jika koin ≥ 10.
            </p>
          </article>
        </div>
      </div>

      <div className="htp-block">
        <h3>5 Karakter Istana</h3>
        <div className="htp-roles-grid">
          {CHARACTER_GUIDE.map((char) => (
            <article key={char.role} className="htp-role-card">
              <img
                src={char.image}
                alt={"Kartu " + char.role}
                width={150}
                height={220}
                loading="lazy"
                draggable={false}
              />
              <div className="htp-role-copy">
                <h4>{char.role}</h4>
                <dl>
                  <div>
                    <dt>Aksi</dt>
                    <dd>{char.action}</dd>
                  </div>
                  <div>
                    <dt>Blokir</dt>
                    <dd>{char.block}</dd>
                  </div>
                </dl>
                <p>{char.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="htp-block htp-extras">
        <h3>Aturan Tambahan (Opsional di Lobi)</h3>
        <div className="htp-extras-grid">
          <article className="htp-extra-card">
            <b>One-Time Guess</b>
            <p>
              Sekali per pertandingan, kamu dapat menebak peran kartu kiri atau
              kanan milik lawan secara gratis. Jika benar, kartu tersebut
              langsung gugur dan kamu mendapat <strong>bonus +1 poin</strong>;
              jika salah, kartu lawan diganti dari dek dan kamu kehilangan 1
              kartu.
            </p>
          </article>
          <article className="htp-extra-card">
            <b>Duke Blocks Tax</b>
            <p>
              Saat lawan mengambil Tax (+3 koin), pemain lain boleh mengklaim
              Duke untuk memblokirnya. Pelaku Tax dapat menantang klaim blok
              tersebut.
            </p>
          </article>
        </div>
      </div>

      <div className="htp-foot">
        <button type="button" className="primary" onClick={onStart}>
          Mulai bermain sekarang <span aria-hidden="true">↑</span>
        </button>
      </div>
    </section>
  );
}
