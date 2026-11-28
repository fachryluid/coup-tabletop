export interface PlayerStyleInput {
  matchesPlayed: number;
  wins: number;
  winRate: number;
  totalBluffs: number;
  totalChallenges: number;
  totalBlocks: number;
  totalAttacks: number;
  highestCoins: number;
  totalGuessHits?: number;
}

export type PlayerStyleId =
  | "newcomer"
  | "bluffer"
  | "challenger"
  | "blocker"
  | "executioner"
  | "ruler"
  | "tycoon"
  | "strategist";

export interface PlayerStyleBadge {
  id: PlayerStyleId;
  title: string;
  description: string;
}

export interface PlayerStyleCatalogEntry extends PlayerStyleBadge {
  criteria: string;
}

export const PLAYER_STYLE_CATALOG: readonly PlayerStyleCatalogEntry[] = [
  {
    id: "bluffer",
    title: "Sang Penggertak",
    description: "Sering mengklaim peran tanpa ragu dan membuat lawan bimbang.",
    criteria: "Dominan dalam menggertak (rata-rata ≥ 1,2 bluff per pertandingan).",
  },
  {
    id: "challenger",
    title: "Detektif Istana",
    description: "Tajam membaca kebohongan dan berani menantang klaim lawan.",
    criteria: "Dominan dalam menantang (rata-rata ≥ 1,1 challenge per pertandingan).",
  },
  {
    id: "blocker",
    title: "Tembok Istana",
    description: "Tangguh menahan serangan dan menjaga pengaruh tetap utuh.",
    criteria: "Dominan dalam memblokir (rata-rata ≥ 1,0 block per pertandingan).",
  },
  {
    id: "executioner",
    title: "Algojo Meja",
    description: "Agresif menekan lawan lewat Coup, Assassinate, Steal, dan Guess.",
    criteria: "Dominan dalam menyerang (rata-rata ≥ 2,2 serangan per pertandingan).",
  },
  {
    id: "ruler",
    title: "Penguasa Tahta",
    description: "Konsisten mendominasi meja dan menjaga rasio kemenangan tinggi.",
    criteria: "Win rate ≥ 55% dari minimal 5 pertandingan dengan gaya seimbang.",
  },
  {
    id: "tycoon",
    title: "Sultan Meja",
    description: "Lihai menumpuk perbendaharaan koin untuk mengendalikan tempo.",
    criteria: "Pernah mencapai puncak ≥ 10 koin dalam satu pertandingan.",
  },
  {
    id: "strategist",
    title: "Ahli Strategi",
    description: "Gaya bermain seimbang antara ekonomi, pertahanan, dan tekanan.",
    criteria: "Gaya bermain seimbang setelah menyelesaikan minimal 3 pertandingan.",
  },
  {
    id: "newcomer",
    title: "Pendatang Baru Istana",
    description: "Mainkan minimal 3 pertandingan selesai untuk memetakan gaya bermain.",
    criteria: "Kurang dari 3 pertandingan selesai tercatat.",
  },
];

const BY_ID: Record<PlayerStyleId, PlayerStyleBadge> = Object.fromEntries(
  PLAYER_STYLE_CATALOG.map(({ id, title, description }) => [
    id,
    { id, title, description },
  ]),
) as Record<PlayerStyleId, PlayerStyleBadge>;

/**
 * Derive a deterministic playstyle title from aggregated career statistics.
 */
export function derivePlayerStyle(stats?: PlayerStyleInput | null): PlayerStyleBadge {
  if (!stats || stats.matchesPlayed < 3) {
    return BY_ID.newcomer;
  }

  const m = Math.max(1, stats.matchesPlayed);
  const bluffRate = stats.totalBluffs / m;
  const challengeRate = stats.totalChallenges / m;
  const blockRate = stats.totalBlocks / m;
  const attackRate = stats.totalAttacks / m;

  const candidates: Array<{
    score: number;
    badge: PlayerStyleBadge;
  }> = [
    {
      score: bluffRate >= 1.2 ? bluffRate * 1.15 : 0,
      badge: BY_ID.bluffer,
    },
    {
      score: challengeRate >= 1.1 ? challengeRate * 1.15 : 0,
      badge: BY_ID.challenger,
    },
    {
      score: blockRate >= 1.0 ? blockRate * 1.1 : 0,
      badge: BY_ID.blocker,
    },
    {
      score: attackRate >= 2.2 ? attackRate * 0.75 : 0,
      badge: BY_ID.executioner,
    },
  ];

  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0] && candidates[0].score > 0) {
    return candidates[0].badge;
  }

  if (stats.matchesPlayed >= 5 && stats.winRate >= 55) {
    return BY_ID.ruler;
  }

  if (stats.highestCoins >= 10) {
    return BY_ID.tycoon;
  }

  return BY_ID.strategist;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeeklyPeriodRange {
  /** Inclusive UTC ISO timestamp corresponding to Monday 00:00:00.000 WIB */
  startIso: string;
  /** Inclusive UTC ISO timestamp corresponding to Sunday 23:59:59.999 WIB */
  endIso: string;
  /** Exclusive UTC ISO timestamp corresponding to next Monday 00:00:00.000 WIB */
  exclusiveEndIso: string;
}

/**
 * Computes the active weekly leaderboard window in WIB (UTC+7):
 * Monday 00:00:00 WIB through Sunday 23:59:59.999 WIB.
 */
export function getWeeklyPeriodRange(now: Date = new Date()): WeeklyPeriodRange {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const daysSinceMonday = (wib.getUTCDay() + 6) % 7;
  const startWibAsUtc = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0,
  );
  const startUtcMs = startWibAsUtc - WIB_OFFSET_MS;
  const exclusiveEndUtcMs = startUtcMs + 7 * DAY_MS;
  const endUtcMs = exclusiveEndUtcMs - 1;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
    exclusiveEndIso: new Date(exclusiveEndUtcMs).toISOString(),
  };
}
