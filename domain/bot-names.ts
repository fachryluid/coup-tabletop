import rawBotNames from "./bot-names.json";

export const BOT_NAMES: readonly string[] = rawBotNames;

/**
 * Pick a random unique bot name from `domain/bot-names.json` that does not
 * collide (case-insensitively) with any seat name already present in the room.
 */
export function pickUniqueBotName(
  usedNames: Iterable<string>,
  rng: () => number = Math.random,
): string {
  const taken = new Set<string>();
  for (const name of usedNames) {
    taken.add(name.trim().toLowerCase());
  }

  const available = BOT_NAMES.filter((name) => !taken.has(name.toLowerCase()));
  if (available.length > 0) {
    const idx = Math.floor(
      Math.min(0.999999999, Math.max(0, rng())) * available.length,
    );
    return available[idx];
  }

  // Fallback only if every curated name is somehow already taken in the room.
  let n = 1;
  while (taken.has(`bot ${n}`)) n++;
  return `Bot ${n}`;
}
