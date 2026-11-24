import { roles, type Config, type Player, type Move, type Role } from "./model";
export const oneTimeGuess = {
  id: "one_time_guess",
  name: "One-Time Guess",
  description:
    "Sekali per pertandingan, tebak satu peran lawan. Jika salah, Anda kehilangan satu influence.",
  defaultEnabled: false,
  conflictsWith: [],
  moves(config: Config, actor: Player, target: Player): Move[] {
    return config.one_time_guess && !actor.used
      ? roles.map((role) => ({ kind: "Guess", target: target.id, role }))
      : [];
  },
  matches(target: Player, role: Role) {
    return target.hand.includes(role);
  },
} as const;
export const dukeBlocksTax = {
  id: "duke_blocks_tax",
  name: "Duke Blocks Tax",
  description:
    "Saat Tax diumumkan, lawan dapat menantang klaim Duke, memblokir dengan klaim Duke, atau Pass. Hanya pelaku Tax yang dapat menantang blok.",
  defaultEnabled: false,
  conflictsWith: [],
} as const;
export const rules = {
  one_time_guess: oneTimeGuess,
  duke_blocks_tax: dukeBlocksTax,
};
