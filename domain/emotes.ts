export const emoteIds = [
  "clap",
  "sus",
  "sweat",
  "laugh",
  "bluff",
  "shock",
  "crown",
  "fire",
] as const;

export type EmoteId = (typeof emoteIds)[number];

export interface EmoteDef {
  id: EmoteId;
  emoji: string;
  label: string;
}

export const EMOTES: readonly EmoteDef[] = [
  { id: "clap", emoji: "👏", label: "Mantap!" },
  { id: "sus", emoji: "🤨", label: "Mencurigakan..." },
  { id: "bluff", emoji: "😏", label: "Yakin?" },
  { id: "sweat", emoji: "😅", label: "Deg-degan" },
  { id: "laugh", emoji: "😂", label: "Hahaha!" },
  { id: "shock", emoji: "😱", label: "Waduh!" },
  { id: "fire", emoji: "🔥", label: "Panas!" },
  { id: "crown", emoji: "👑", label: "GG!" },
] as const;

export const EMOTE_MAP: Record<EmoteId, EmoteDef> = Object.fromEntries(
  EMOTES.map((e) => [e.id, e]),
) as Record<EmoteId, EmoteDef>;

export interface EmotePayload {
  seatId: string;
  emote: EmoteId;
  ts: number;
}
