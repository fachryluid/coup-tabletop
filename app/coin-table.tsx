"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Entry } from "../domain/model";
import { playCoinBurst, playCoinLand } from "./sound-effects";

const PLAYER_STACK_HEIGHT = 5;
const TREASURY_STACK_HEIGHT = 10;
const TREASURY_MAX_STACKS = 5;
export const TREASURY_TOTAL = 50;

export const COIN_FLIGHT_MS = 420;
export const COIN_STAGGER_MS = 90;
export const MAX_ANIMATED_COINS = 10;

export function coinTransferDuration(amount: number): number {
  const steps = Math.min(MAX_ANIMATED_COINS, Math.max(0, Math.floor(amount)));
  if (steps === 0) return 0;
  return COIN_FLIGHT_MS + (steps - 1) * COIN_STAGGER_MS;
}

function splitStacks(
  count: number,
  maxStacks: number,
  stackHeight: number,
): number[] {
  const safe = Math.max(0, Math.floor(count));
  if (safe === 0) return [];
  const capped = Math.min(safe, maxStacks * stackHeight);
  const stacks: number[] = [];
  let left = capped;
  while (left > 0) {
    const height = Math.min(stackHeight, left);
    stacks.push(height);
    left -= height;
  }
  return stacks;
}

export function CoinStack({
  seatId,
  count,
  compact = false,
}: {
  seatId: string;
  count: number;
  compact?: boolean;
}) {
  const maxStacks = compact ? 3 : 4;
  const stacks = splitStacks(count, maxStacks, PLAYER_STACK_HEIGHT);
  const overflow = Math.max(0, count - maxStacks * PLAYER_STACK_HEIGHT);

  return (
    <div
      className={"coin-tray" + (compact ? " coin-tray-compact" : "")}
      data-coin-seat={seatId}
      data-empty={count === 0 || undefined}
      aria-hidden="true"
    >
      {stacks.length > 0 && (
        <span className="coin-stacks">
          {stacks.map((height, stackIdx) => {
            const isLastStack = stackIdx === stacks.length - 1;
            return (
              <span className="coin-pillar" key={stackIdx}>
                {Array.from({ length: height }, (_, i) => {
                  const isTop = i === height - 1;
                  return (
                    <span
                      key={i}
                      data-top-coin={isLastStack && isTop ? "" : undefined}
                      className={"coin-3d" + (isTop ? " coin-3d-top" : "")}
                      style={{ "--i": i } as CSSProperties}
                    />
                  );
                })}
              </span>
            );
          })}
          {overflow > 0 && <span className="coin-overflow">+{overflow}</span>}
        </span>
      )}
    </div>
  );
}

export function TreasuryPile({
  available,
  coinMove,
  coinMoveSeq,
  onCoinStep,
}: {
  available: number;
  coinMove?: Entry["coinMove"];
  coinMoveSeq?: number;
  onCoinStep: (seq: number, entityId: string, delta: number) => void;
}) {
  const bankRef = useRef<HTMLDivElement>(null);
  const animatedSeqs = useRef(new Set<number>());
  const stepCallback = useRef(onCoinStep);
  useEffect(() => {
    stepCallback.current = onCoinStep;
  }, [onCoinStep]);

  const stacks = splitStacks(
    available,
    TREASURY_MAX_STACKS,
    TREASURY_STACK_HEIGHT,
  );

  useEffect(() => {
    if (!coinMove || coinMoveSeq === undefined || coinMove.amount <= 0) return;
    if (animatedSeqs.current.has(coinMoveSeq)) return;
    animatedSeqs.current.add(coinMoveSeq);

    const seq = coinMoveSeq;
    const { from, to, amount } = coinMove;
    const bank = bankRef.current;
    const arena = bank?.closest(".arena");

    if (
      !bank ||
      !arena ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      stepCallback.current(seq, from, -amount);
      stepCallback.current(seq, to, amount);
      playCoinBurst(amount);
      return;
    }

    const findContainer = (id: string) =>
      id === "bank"
        ? bank
        : arena.querySelector<HTMLElement>(
            '[data-coin-seat="' + CSS.escape(id) + '"]',
          ) ??
          arena.querySelector<HTMLElement>(
            '[data-card-seat="' + CSS.escape(id) + '"]',
          );

    const fromEl = findContainer(from);
    const toEl = findContainer(to);
    if (!fromEl || !toEl) {
      stepCallback.current(seq, from, -amount);
      stepCallback.current(seq, to, amount);
      return;
    }

    const steps = Math.min(MAX_ANIMATED_COINS, amount);
    const baseChunk = Math.floor(amount / steps);
    const remainder = amount % steps;

    const abort = new AbortController();
    const spawned: HTMLElement[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < steps; i++) {
      const chunk = baseChunk + (i < remainder ? 1 : 0);
      const launch = () => {
        if (abort.signal.aborted) return;

        const arenaRect = arena.getBoundingClientRect();
        const sourceTop =
          fromEl.querySelector<HTMLElement>("[data-top-coin]") ?? fromEl;
        const targetTop =
          toEl.querySelector<HTMLElement>("[data-top-coin]") ?? toEl;

        const fromRect = sourceTop.getBoundingClientRect();
        const toRect = targetTop.getBoundingClientRect();

        const coinW = fromRect.width >= 12 && fromRect.width <= 26 ? fromRect.width : 19;
        const coinH = fromRect.height >= 8 && fromRect.height <= 20 ? fromRect.height : 13;

        const sx = fromRect.left + fromRect.width / 2 - arenaRect.left;
        const sy = fromRect.top + fromRect.height / 2 - arenaRect.top;
        const ex = toRect.left + toRect.width / 2 - arenaRect.left;
        const ey =
          toRect.top +
          toRect.height / 2 -
          arenaRect.top -
          (targetTop !== toEl ? 3 : 0);

        // Coin physically leaves the source pile right at takeoff
        stepCallback.current(seq, from, -chunk);

        const coin = document.createElement("span");
        coin.className = "travelling-coin";
        coin.setAttribute("aria-hidden", "true");
        coin.style.width = `${coinW}px`;
        coin.style.height = `${coinH}px`;
        coin.style.left = "0px";
        coin.style.top = "0px";
        arena.append(coin);
        spawned.push(coin);

        const spread = (i - (steps - 1) / 2) * 8;
        const midX = (sx + ex) / 2 + spread;
        const midY = Math.min(sy, ey) - 30 - Math.abs(spread) * 0.35;

        const anim = coin.animate(
          [
            {
              opacity: 1,
              transform: `translate(${sx - coinW / 2}px, ${sy - coinH / 2}px) scale(1)`,
            },
            {
              opacity: 1,
              offset: 0.5,
              transform: `translate(${midX - coinW / 2}px, ${midY - coinH / 2}px) scale(1.22)`,
            },
            {
              opacity: 1,
              transform: `translate(${ex - coinW / 2}px, ${ey - coinH / 2}px) scale(1)`,
            },
          ],
          {
            duration: COIN_FLIGHT_MS,
            easing: "cubic-bezier(.25,.08,.22,1)",
            fill: "both",
          },
        );

        abort.signal.addEventListener("abort", () => anim.cancel(), {
          once: true,
        });

        anim.finished
          .then(() => {
            coin.remove();
            if (!abort.signal.aborted) {
              // Coin physically arrives on the destination pile right at touchdown
              stepCallback.current(seq, to, chunk);
              playCoinLand(i);
              requestAnimationFrame(() => {
                const landed =
                  toEl.querySelector<HTMLElement>("[data-top-coin]") ?? toEl;
                landed.dataset.coinHit = "true";
                setTimeout(() => {
                  delete landed.dataset.coinHit;
                }, 260);
              });
            }
          })
          .catch(() => {
            coin.remove();
          });
      };

      if (i === 0) launch();
      else timers.push(setTimeout(launch, i * COIN_STAGGER_MS));
    }

    return () => {
      abort.abort();
      for (const t of timers) clearTimeout(t);
      for (const el of spawned) el.remove();
    };
  }, [coinMove, coinMoveSeq]);

  return (
    <div
      className="court-treasury"
      aria-label={"Kas istana, " + available + " koin"}
    >
      <div className="treasury-pile" ref={bankRef} data-coin-bank="">
        {stacks.length > 0 && (
          <span className="treasury-stacks" aria-hidden="true">
            {stacks.map((height, stackIdx) => {
              const isLastStack = stackIdx === stacks.length - 1;
              return (
                <span
                  className="coin-pillar treasury-pillar"
                  data-pillar={stackIdx}
                  key={stackIdx}
                >
                  {Array.from({ length: height }, (_, i) => {
                    const isTop = i === height - 1;
                    return (
                      <span
                        key={i}
                        data-top-coin={isLastStack && isTop ? "" : undefined}
                        className={"coin-3d" + (isTop ? " coin-3d-top" : "")}
                        style={{ "--i": i } as CSSProperties}
                      />
                    );
                  })}
                </span>
              );
            })}
          </span>
        )}
      </div>
      <small>Kas · {available} koin</small>
    </div>
  );
}
