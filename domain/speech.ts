import type { Move } from "./model";
// Only accepted, public declarations belong in the conversation.
export function declaration(
  move: Move,
  target?: string,
  targetCards?: number,
): string {
  switch (move.kind) {
    case "Income":
      return "Saya mengambil 1 koin dari bank.";
    case "Foreign Aid":
      return "Saya meminta bantuan luar negeri sebesar 2 koin.";
    case "Tax":
      return "Saya mengaku sebagai Duke. Saya ingin memungut pajak 3 koin.";
    case "Steal":
      return (
        "Saya mengaku sebagai Captain. Saya ingin mencuri hingga 2 koin dari " +
        target +
        "."
      );
    case "Coup": {
      const cardLabel =
        targetCards === 1
          ? ""
          : move.slot === 1
            ? "kartu kanan "
            : "kartu kiri ";
      return (
        "Saya membayar 7 koin untuk melakukan Coup terhadap " +
        cardLabel +
        target +
        "."
      );
    }
    case "Assassinate":
      return (
        "Saya mengaku sebagai Assassin. Saya membayar 3 koin untuk menggugurkan satu influence " +
        target +
        "."
      );
    case "Exchange":
      return "Saya mengaku sebagai Ambassador. Saya ingin menukar kartu saya.";
    case "Guess": {
      const cardLabel =
        targetCards === 1
          ? "kartu terakhir"
          : move.slot === 1
            ? "kartu kanan"
            : "kartu kiri";
      return (
        "Saya menggunakan satu tebakan saya. Saya menebak " +
        cardLabel +
        " " +
        target +
        " adalah " +
        move.role +
        "."
      );
    }
    case "Block":
      return "Saya mengaku sebagai " + move.role + " dan memblokir aksi ini.";
    case "Prove":
      return "Ini kartu " + move.role + " saya.";
    case "Challenge":
      return "Saya menantang klaim " + target + ". Buktikan kartumu.";
    case "Pass":
      return "Saya pass. Saya melewatkan kesempatan merespons.";
    case "Keep":
      return "Saya sudah memilih kartu yang akan saya simpan.";
    case "Lose":
      return "Saya menggugurkan " + move.role + ".";
  }
}
