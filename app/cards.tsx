import { useState } from "react";
import type { Role } from "../domain/model";
const captions: Record<Role, string> = {
  Duke: "Tax",
  Assassin: "Assassinate",
  Captain: "Steal",
  Ambassador: "Exchange",
  Contessa: "Blok Assassinate",
};
export function Face({ role }: { role: Role }) {
  return (
    <img
      className={"influence illustrated " + role.toLowerCase()}
      src={"/cards/" + role.toLowerCase() + ".webp"}
      width={150}
      height={220}
      alt={role + " · " + captions[role]}
      draggable={false}
    />
  );
}
export function Back() {
  return (
    <span className="card-back" aria-hidden="true">
      <i>◆</i>
    </span>
  );
}

export function Hand({
  roles,
  fallen,
  proof,
}: {
  roles: Role[];
  fallen: Role[];
  proof?: Role;
}) {
  const [open, select] = useState<number | null>(null);
  return (
    <div className="private-hand">
      {roles.map((role, i) => (
        <button
          key={role + i}
          data-live-card=""
          data-proof={
            (role === proof && roles.indexOf(role) === i) || undefined
          }
          className="hand-card"
          aria-expanded={open === i}
          aria-label={(open === i ? "Perkecil " : "Perbesar ") + role}
          title={role + " · " + captions[role]}
          onClick={() => select(open === i ? null : i)}
        >
          <Face role={role} />
        </button>
      ))}
      {fallen.map((role, i) => (
        <div
          key={"lost" + i}
          className="lost-hand-card"
          title={role + " · gugur"}
          aria-label={role + " · gugur"}
        >
          <Face role={role} />
        </div>
      ))}
    </div>
  );
}
