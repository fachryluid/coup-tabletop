import { useEffect, useRef, useState } from "react";
import type { Entry } from "../domain/model";
import { cardImage, type CardThemeId } from "../domain/card-themes";
import type { Line } from "./table-playback";
import { Back } from "./cards";
import {
  playCardDeal,
  playCardPlace,
  playCardShuffle,
} from "./sound-effects";

async function animateCards(
  deck: HTMLDivElement,
  moves: NonNullable<Entry["deckMove"]>[],
  dealing: boolean,
  signal: AbortSignal,
  proof?: Line["proof"],
  arrived?: () => void,
  cardTheme: CardThemeId = "classic",
  proofArt = 0,
) {
  const arena = deck.closest(".arena");
  if (!arena || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (dealing) playCardShuffle();
  let cardStep = 0;
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
      // Size the flying card at full target dimensions and scale down at the deck
      // so the vector/image artwork stays razor-sharp with zero blurry upscaling.
      const cardW = Math.max(source.width, target.width);
      const cardH = Math.max(source.height, target.height);
      const deckSx = source.width / cardW;
      const deckSy = source.height / cardH;
      const seatSx = target.width / cardW;
      const seatSy = target.height / cardH;
      const home = `translate(-50%,-50%) rotate(-6deg) scale(${deckSx},${deckSy})`;
      const away = `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${seatSx},${seatSy})`;
      if (returning) slot.dataset.travelling = "";
      const card = document.createElement("span");
      card.className = "travelling-card card-back";
      card.setAttribute("aria-hidden", "true");
      card.dataset.motion = deckMove.kind;
      card.style.width = `${cardW}px`;
      card.style.height = `${cardH}px`;
      if (replacement && returning && proof) {
        card.style.backgroundImage = `url(${cardImage(proof, cardTheme, proofArt)})`;
      }
      const ownFace =
        returning &&
        slot.closest(".exchange-cards") &&
        slot.querySelector("img");
      if (ownFace) card.style.backgroundImage = `url("${ownFace.src}")`;
      deck.append(card);
      playCardDeal(cardStep++);
      const animation = card.animate(
        [
          { opacity: 1, transform: returning ? away : home },
          {
            opacity: 1,
            offset: 0.52,
            transform: `translate(calc(-50% + ${x * 0.52}px),calc(-50% + ${y * 0.52 - 14}px)) rotate(${returning ? 7 : -7}deg) scale(${(deckSx + seatSx) / 2},${(deckSy + seatSy) / 2})`,
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
      let keepOverlay = false;
      try {
        await animation.finished;
        if (signal.aborted) return;
        if (!dealing) playCardPlace();
        if (dealing) {
          slot.dataset.arrived = "";
          arrived?.();
        } else if (!returning && !replacement) {
          slot.style.visibility = "visible";
        } else if (replacement && !returning) {
          keepOverlay = true;
        }
      } catch (error) {
        if (!signal.aborted) throw error;
      } finally {
        if (!keepOverlay) card.remove();
        signal.removeEventListener("abort", cancel);
      }
    }
  }
}
export function CourtDeck({
  count,
  cardTheme = "classic",
  showDeal,
  moving,
  onDelivery,
  onDeal,
}: {
  onDeal: () => void;
  count: number;
  cardTheme?: CardThemeId;
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
      undefined,
      cardTheme,
      moving.proofArt ?? 0,
    ).then(() => {
      if (!abort.signal.aborted) onDelivery(moving);
    });
    const deck = pile.current;
    const arena = deck.closest(".arena");
    return () => {
      abort.abort();
      deck
        .querySelectorAll<HTMLElement>(".travelling-card")
        .forEach((el) => el.remove());
      arena
        ?.querySelectorAll<HTMLElement>("[data-travelling]")
        .forEach((slot) => delete slot.dataset.travelling);
    };
  }, [moving, onDelivery, cardTheme]);
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
