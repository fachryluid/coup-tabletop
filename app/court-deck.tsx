import { useEffect, useRef, useState } from "react";
import type { Entry } from "../domain/model";
import type { Line } from "./table-playback";
import { Back } from "./cards";

async function animateCards(
  deck: HTMLDivElement,
  moves: NonNullable<Entry["deckMove"]>[],
  dealing: boolean,
  signal: AbortSignal,
  proof?: Line["proof"],
  arrived?: () => void,
) {
  const arena = deck.closest(".arena");
  if (!arena || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 2; i++) {
    for (const deckMove of moves) {
      if (signal.aborted) return;
      const seat = arena.querySelector(
        '[data-card-seat="' + CSS.escape(deckMove.seat) + '"]',
      );
      if (!seat) continue;
      const live = seat.querySelectorAll<HTMLElement>("[data-live-card]");
      const preview = arena.querySelector(
        '[data-draw-seat="' + CSS.escape(deckMove.seat) + '"]',
      );
      const extras = (preview ?? seat).querySelectorAll<HTMLElement>(
        "[data-exchange-slot]",
      );
      const returns = (deck.closest("main") ?? arena).querySelectorAll<HTMLElement>(
        ".exchange-cards [aria-pressed=false]",
      );
      const replacement = deckMove.kind === "replace";
      const source = deck.getBoundingClientRect();

      const returning =
        deckMove.kind === "returnTwo" || (replacement && i === 0);
      const slot = dealing
        ? live[i]
        : replacement
          ? (seat.querySelector<HTMLElement>("[data-proof]") ??
            live[deckMove.slot ?? 0] ??
            live[0])
          : ((returning ? returns[i] : undefined) ?? extras[i]);
      if (!slot) continue;
      const target = slot.getBoundingClientRect();
      const x = target.left + target.width / 2 - source.left - source.width / 2;
      const y = target.top + target.height / 2 - source.top - source.height / 2;
      const home = "translate(-50%,-50%) rotate(-6deg)";
      const away = `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${target.width / 30},${target.height / 42})`;
      if (returning) slot.dataset.travelling = "";
      const card = document.createElement("i");
      card.className = "travelling-card card-back";
      card.setAttribute("aria-hidden", "true");
      card.dataset.motion = deckMove.kind;
      if (replacement && returning && proof) {
        card.style.background =
          "center / cover url(/cards/" + proof.toLowerCase() + ".webp)";
      }
      const ownFace =
        returning &&
        slot.closest(".exchange-cards") &&
        slot.querySelector("img");
      if (ownFace)
        card.style.background = `center / cover url("${ownFace.src}")`;
      deck.append(card);
      const animation = card.animate(
        [
          { opacity: 1, transform: returning ? away : home },
          {
            opacity: 1,
            offset: 0.52,
            transform: `translate(calc(-50% + ${x * 0.52}px),calc(-50% + ${y * 0.52 - 14}px)) rotate(${returning ? 7 : -7}deg) scale(${(1 + target.width / 30) / 2},${(1 + target.height / 42) / 2})`,
          },
          { opacity: 1, transform: returning ? home : away },
        ],
        {
          duration: dealing ? 330 : 680,
          easing: "cubic-bezier(.32,.06,.24,1)",
          fill: "both",
        },
      );
      const cancel = () => animation.cancel();
      signal.addEventListener("abort", cancel, { once: true });
      try {
        await animation.finished;
        if (signal.aborted) return;
        if (dealing) {
          slot.dataset.arrived = "";
          arrived?.();
        } else if (!returning && !replacement) {
          slot.style.visibility = "visible";
        }
      } catch (error) {
        if (!signal.aborted) throw error;
      } finally {
        card.remove();
        signal.removeEventListener("abort", cancel);
      }
    }
  }
}
export function CourtDeck({
  count,
  showDeal,
  moving,
  onDelivery,
  onDeal,
}: {
  onDeal: () => void;
  count: number;
  showDeal: boolean;
  moving?: Line;
  onDelivery: (line: Line) => void;
}) {
  const [openingCount, setOpeningCount] = useState<number | null>(
    showDeal ? 15 : null,
  );
  const visibleCount = openingCount ?? count;
  const pile = useRef<HTMLDivElement>(null);
  const opening = useRef(showDeal);
  useEffect(() => {
    const deck = pile.current;
    if (!deck || !opening.current) return;
    const abort = new AbortController();
    const seats = deck
      .closest(".arena")!
      .querySelectorAll<HTMLElement>("[data-card-seat]");
    void animateCards(
      deck,
      Array.from(seats, (el) => ({
        seat: el.dataset.cardSeat!,
        kind: "drawTwo",
      })),
      true,
      abort.signal,
      undefined,
      () => setOpeningCount((n) => (n === null ? null : n - 1)),
    ).then(() => {
      if (!abort.signal.aborted) {
        setOpeningCount(null);
        onDeal();
      }
    });
    return () => abort.abort();
  }, [onDeal]);
  useEffect(() => {
    if (!moving?.move || !pile.current) return;
    const abort = new AbortController();
    void animateCards(
      pile.current,
      [moving.move],
      false,
      abort.signal,
      moving.proof,
    ).then(() => {
      if (!abort.signal.aborted) onDelivery(moving);
    });
    const arena = pile.current.closest(".arena");
    return () => {
      abort.abort();
      arena
        ?.querySelectorAll<HTMLElement>("[data-travelling]")
        .forEach((slot) => delete slot.dataset.travelling);
    };
  }, [moving, onDelivery]);
  return (
    <div
      className="court-deck"
      aria-label={"Tumpukan istana, " + visibleCount + " kartu"}
    >
      <div className="deck-pile" ref={pile}>
        <Back />
      </div>
      <small>Dek · {visibleCount} kartu</small>
    </div>
  );
}
