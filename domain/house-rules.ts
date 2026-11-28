import { roles, type Config, type Player, type Move, type Role } from "./model";
export const oneTimeGuess = {
  id: "one_time_guess",
  name: "One-Time Guess",
  shortDescription:
    "Tebak peran kartu kiri atau kanan lawan, sekali per pertandingan.",
  description:
    "Sekali per pertandingan, tebak peran kartu spesifik (kiri/kanan) lawan. Jika benar kartu itu gugur dan Anda mendapat bonus +1 poin; jika salah kartu lawan diganti dari dek dan Anda kehilangan satu influence.",
  details: [
    "Setiap pemain memiliki tepat 1 kesempatan menebak sepanjang satu pertandingan (di-reset saat rematch).",
    "Dilakukan pada giliran sendiri sebagai aksi utama, gratis (0 koin), dan tidak dapat di-Challenge atau di-Block.",
    "Penebak memilih lawan hidup, posisi kartu spesifik (kiri atau kanan), dan 1 dari 5 peran.",
    "Tidak ada aksi konfirmasi dari target; kartu yang ditebak langsung dibuka untuk membuktikan tebakan.",
    "Jika tebakan benar, kartu target pada posisi tersebut langsung gugur dan penebak memperoleh bonus +1 poin di akhir pertandingan.",
    "Jika tebakan salah, kartu target yang dibuka diganti dari kocokan dek, lalu penebak memilih 1 kartu hidup miliknya untuk gugur.",
  ],
  defaultEnabled: false,
  conflictsWith: [],
  moves(config: Config, actor: Player, target: Player): Move[] {
    if (!config.one_time_guess || actor.used) return [];
    const list: Move[] = [];
    for (let slot = 0; slot < target.hand.length; slot++) {
      for (const role of roles) {
        list.push({ kind: "Guess", target: target.id, slot, role });
      }
    }
    return list;
  },
  matches(target: Player, slot: number, role: Role) {
    return target.hand[slot] === role;
  },
} as const;
export const dukeBlocksTax = {
  id: "duke_blocks_tax",
  name: "Duke Blocks Tax",
  shortDescription:
    "Lawan dapat mengklaim Duke untuk memblokir aksi Tax (+3 koin).",
  description:
    "Saat Tax diumumkan, lawan dapat menantang klaim Duke, memblokir dengan klaim Duke, atau Pass. Hanya pelaku Tax yang dapat menantang blok.",
  details: [
    "Saat pemain mengumumkan Tax (klaim Duke), semua lawan hidup dapat memilih Challenge, Block dengan klaim Duke, atau Pass dalam satu jendela respons.",
    "Jika ada lawan yang memblokir dengan klaim Duke, hanya pelaku Tax yang berhak menantang blok tersebut.",
    "Jika blok diterima atau terbukti sah, aksi Tax dibatalkan sehingga pelaku tidak menerima +3 koin.",
    "Jika klaim blok terbukti bluff, pemblokir kehilangan 1 influence dan Tax tetap dibatalkan.",
  ],
  defaultEnabled: false,
  conflictsWith: [],
} as const;
export const rules = {
  one_time_guess: oneTimeGuess,
  duke_blocks_tax: dukeBlocksTax,
};
