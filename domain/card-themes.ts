import type { Role } from "./model";

export const cardThemeIds = ["classic", "custom1"] as const;
export type CardThemeId = (typeof cardThemeIds)[number];

export interface CardThemeDef {
  id: CardThemeId;
  name: string;
  description: string;
  preview: readonly string[];
  /**
   * Artwork path per physical copy (0, 1, 2) for each role.
   * Any unspecified copy falls back to the classic card artwork.
   */
  variants: Partial<Record<Role, readonly (string | undefined)[]>>;
}

export const CARD_THEMES: readonly CardThemeDef[] = [
  {
    id: "classic",
    name: "Klasik",
    description: "Desain kartu ilustrasi klasik.",
    preview: [
      "/cards/duke.webp",
      "/cards/assassin.webp",
      "/cards/contessa.webp",
    ],
    variants: {},
  },
  {
    id: "custom1",
    name: "Custom 1",
    description: "Desain kartu ilustrasi edisi Custom 1.",
    preview: [
      "/cards/custom1/duke-1.webp",
      "/cards/custom1/assassin-1.webp",
      "/cards/custom1/contessa-1.webp",
    ],
    variants: {
      Duke: ["/cards/custom1/duke-1.webp"],
      Assassin: ["/cards/custom1/assassin-1.webp"],
      Captain: ["/cards/custom1/captain-1.webp"],
      Ambassador: ["/cards/custom1/ambassador-1.webp"],
      Contessa: ["/cards/custom1/contessa-1.webp"],
    },
  },
] as const;

export const CARD_THEME_MAP: Record<CardThemeId, CardThemeDef> =
  Object.fromEntries(CARD_THEMES.map((t) => [t.id, t])) as Record<
    CardThemeId,
    CardThemeDef
  >;

export function classicCardImage(role: Role): string {
  return "/cards/" + role.toLowerCase() + ".webp";
}

export function cardImage(
  role: Role,
  theme: CardThemeId = "classic",
  variant = 0,
): string {
  const custom = CARD_THEME_MAP[theme]?.variants[role]?.[variant];
  return custom ?? classicCardImage(role);
}
