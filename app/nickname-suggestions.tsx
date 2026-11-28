"use client";
import { useCallback, useEffect, useState } from "react";
import type {
  NicknameSuggestionItem,
  NicknamesPayload,
} from "../server/api";

export function useNicknameSuggestions(enabled: boolean) {
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NicknameSuggestionItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLastUsed(null);
      setSuggestions([]);
      setLoaded(false);
      return;
    }
    try {
      const res = await fetch("/api/me/nicknames", { cache: "no-store" });
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as { ok?: boolean } & NicknamesPayload;
      if (data.ok) {
        setLastUsed(data.lastUsed ?? null);
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      }
    } catch {
      // Non-blocking enhancement
    } finally {
      setLoaded(true);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { lastUsed, suggestions, loaded, refresh };
}

export function NicknameSuggestions({
  suggestions,
  lastUsed,
  currentValue,
  onPick,
  compact = false,
}: {
  suggestions: readonly NicknameSuggestionItem[];
  lastUsed?: string | null;
  currentValue: string;
  onPick: (nickname: string) => void;
  compact?: boolean;
}) {
  if (!suggestions.length) return null;

  const query = currentValue.trim().toLowerCase();
  const ordered = [...suggestions];
  if (lastUsed) {
    const idx = ordered.findIndex(
      (item) => item.nickname.toLowerCase() === lastUsed.toLowerCase(),
    );
    if (idx > 0) {
      const [recent] = ordered.splice(idx, 1);
      ordered.unshift(recent);
    }
  }

  const filtered = query
    ? ordered.filter(
        (item) =>
          item.nickname.toLowerCase().includes(query) &&
          item.nickname.toLowerCase() !== query,
      )
    : ordered;

  const visible = filtered.slice(0, compact ? 4 : 6);
  if (!visible.length) return null;

  return (
    <div
      className={
        compact
          ? "nickname-suggestions nickname-suggestions-compact"
          : "nickname-suggestions"
      }
      role="group"
      aria-label="Saran nama panggilan"
    >
      <span className="nickname-suggestions-label">
        {query ? "Cocok:" : "Sering dipakai:"}
      </span>
      <div className="nickname-suggestions-chips">
        {visible.map((item) => {
          const selected =
            item.nickname.toLowerCase() === currentValue.trim().toLowerCase();
          return (
            <button
              key={item.nicknameKey}
              type="button"
              className="nickname-chip"
              data-selected={selected || undefined}
              onClick={() => onPick(item.nickname)}
              title={`Dipakai ${item.useCount}×`}
            >
              <span>{item.nickname}</span>
              {!compact && item.useCount > 1 && (
                <small className="nickname-chip-count">{item.useCount}×</small>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
