import { useState } from "react";
import type { Role } from "../domain/model";
import { cardImage, type CardThemeId } from "../domain/card-themes";
import { playCardPlace } from "./sound-effects";
const captions: Record<Role, string> = {
  Duke: "Tax",
  Assassin: "Assassinate",
  Captain: "Steal",
  Ambassador: "Exchange",
  Contessa: "Blok Assassinate",
};
export function Face({
  role,
  theme = "classic",
  variant = 0,
}: {
  role: Role;
  theme?: CardThemeId;
  variant?: number;
}) {
  return (
    <img
      className={"influence illustrated " + role.toLowerCase()}
      src={cardImage(role, theme, variant)}
      width={150}
      height={220}
      alt={role + " · " + captions[role]}
      draggable={false}
    />
  );
}
export function Back() {
  return <span className="card-back" aria-hidden="true" />;
}

export function Hand({
  roles,
  handArt,
  fallen,
  fallenArt,
  theme = "classic",
  proof,
  proofSlot,
  swapping,
}: {
  roles: Role[];
  handArt?: number[];
  fallen: Role[];
  fallenArt?: number[];
  theme?: CardThemeId;
  proof?: Role;
  proofSlot?: number;
  swapping?: boolean;
}) {
  const [open, select] = useState<number | null>(null);
  return (
    <div className="private-hand" data-swapping={swapping || undefined}>
      {roles.map((role, i) => (
        <button
          key={role + "-" + (handArt?.[i] ?? 0) + "-" + i}
          data-live-card=""
          data-proof={
            (proof !== undefined &&
              (proofSlot !== undefined
                ? i === proofSlot
                : role === proof && roles.indexOf(role) === i)) ||
            undefined
          }
          className="hand-card"
          aria-expanded={open === i}
          aria-label={(open === i ? "Perkecil " : "Perbesar ") + role}
          title={role + " · " + captions[role]}
          onClick={() => {
            playCardPlace();
            select(open === i ? null : i);
          }}
        >
          <Face role={role} theme={theme} variant={handArt?.[i] ?? 0} />
        </button>
      ))}
      {fallen.map((role, i) => (
        <div
          key={"lost" + i}
          className="lost-hand-card"
          title={role + " · gugur"}
          aria-label={role + " · gugur"}
        >
          <Face role={role} theme={theme} variant={fallenArt?.[i] ?? 0} />
        </div>
      ))}
    </div>
  );
}
