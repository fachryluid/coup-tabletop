import { useState, useCallback } from "react";
import type { Line } from "./table-playback";
import { CourtDeck } from "./court-deck";
import type { RoomView } from "../domain/view";
import type { tableDialogue } from "./table-dialogue";
import { Face, Back, Hand } from "./cards";
function turnStatus(room: RoomView, clock: number) {
  const g = room.game!;
  function name(id?: string) {
    const s = room.seats.find((s) => s.id === id);
    return s ? s.name + (s.online ? "" : " (offline)") : "";
  }
  if (g.paused !== null) return "Permainan dijeda";
  if (g.stage === "over")
    return g.winner
      ? name(g.winner) + " menang"
      : "Pertandingan diakhiri oleh host";
  if (g.stage === "turn")
    return g.turn === room.me
      ? g.legal.length > 0 && g.legal.every((m) => m.kind === "Coup")
        ? "Anda wajib melakukan Coup"
        : "Anda memilih aksi"
      : "Giliran " + name(g.turn);
  if (g.stage === "guessAnswer")
    return (
      (g.action?.target === room.me ? "Anda" : name(g.action?.target)) +
      " menjawab tebakan " +
      name(g.turn)
    );
  if (g.stage === "claimResponse")
    return (
      (g.pending.includes(room.me) ? "Anda" : name(g.pending[0])) +
      " memilih jawaban atas tantangan"
    );
  if (g.stage === "loss")
    return (
      (g.loss === room.me ? "Anda" : name(g.loss)) + " memilih kartu yang gugur"
    );
  if (g.stage === "exchange")
    return (
      (g.turn === room.me ? "Anda" : name(g.turn)) + " memilih kartu Exchange"
    );
  const who = g.pending.includes(room.me)
    ? "Anda"
    : g.pending.map(name).join(", ");
  const action =
    g.action?.kind +
    " " +
    name(g.turn) +
    (g.action?.target ? " → " + name(g.action.target) : "");
  const until =
    g.deadline === null
      ? ""
      : " · " + Math.max(0, Math.ceil((g.deadline - clock) / 1000)) + " dtk";
  if (g.stage === "blockChallenge")
    return (
      "Blok " +
      g.blocker?.role +
      " oleh " +
      name(g.blocker?.id) +
      " — " +
      who +
      " bisa Challenge atau Pass" +
      until
    );
  return (
    action +
    " — " +
    who +
    (g.stage === "block"
      ? " bisa memblokir atau Pass"
      : g.stage === "taxResponse"
        ? " bisa Challenge, Block dengan Duke, atau Pass"
        : g.stage === "challenge" && g.action?.target
          ? " bisa Challenge, Block, atau Pass"
          : " bisa Challenge atau Pass") +
    until
  );
}
export function TableScene({
  room,
  showDeal,
  clock,
  dialogue,
  moving,
  onDelivery,
  children,
}: {
  room: RoomView;
  showDeal: boolean;
  clock: number;
  moving?: Line;
  onDelivery: (line: Line) => void;
  dialogue: ReturnType<typeof tableDialogue>;
  children: React.ReactNode;
}) {
  const g = room.game!,
    me = g.players.find((p) => p.id === room.me)!;

  const [dealing, setDealing] = useState(showDeal);
  const finishDeal = useCallback(() => setDealing(false), []);
  function exchangeCards(id: string) {
    if (
      !(moving?.move?.seat === id && moving.move.kind === "drawTwo") &&
      !(g.stage === "exchange" && g.turn === id)
    )
      return null;
    return (
      <span className="exchange-draw" aria-label="Kartu Exchange">
        {[0, 1].map((i) => (
          <span
            key={i}
            data-exchange-slot=""
            style={{
              visibility: g.stage === "exchange" ? undefined : "hidden",
            }}
          >
            <Back />
          </span>
        ))}
      </span>
    );
  }
  const status = (id: string) =>
    room.seats.find((s) => s.id === id)?.online ? "" : " (offline)";

  return (
    <>
      <div className="arena" data-dealing={dealing || undefined}>
        <div className="opponents">
          {g.players
            .filter((p) => p.id !== room.me)
            .map((p) => (
              <div
                key={p.id}
                data-card-seat={p.id}
                data-speaking={dialogue.speakerId === p.id}
                data-turn={g.turn === p.id && g.stage !== "over"}
                className={"opponent" + (!p.influence ? " eliminated" : "")}
              >
                <div className="fan">
                  {Array.from({ length: p.influence }, (_, i) => (
                    <span
                      key={i}
                      data-live-card=""
                      data-proof={
                        i === 0 &&
                        dialogue.proofSeat === p.id &&
                        dialogue.activeProof
                          ? true
                          : undefined
                      }
                    >
                      {i === 0 &&
                      dialogue.proofSeat === p.id &&
                      dialogue.activeProof ? (
                        <Face role={dialogue.activeProof} />
                      ) : (
                        <Back />
                      )}
                    </span>
                  ))}
                  {exchangeCards(p.id)}
                  {p.revealed.map((r, i) => (
                    <span key={i} className="fallen" title={"Gugur · " + r}>
                      <Face role={r} />
                    </span>
                  ))}
                </div>
                <b>
                  {p.name}
                  {status(p.id)}
                </b>
                <small>
                  {p.difficulty ? "Computer · " + p.difficulty : "Pemain"}
                  {g.turn === p.id && g.stage !== "over" ? " · Giliran" : ""}
                </small>
                <span className="balance" key={p.coins}>
                  ◉ {p.coins} koin
                </span>
                {g.config.one_time_guess && (
                  <small>{p.used ? "Tebakan terpakai" : "1 tebakan"}</small>
                )}
                {dialogue.speakerId === p.id && dialogue.bubble}
              </div>
            ))}
        </div>
        <div className="court-center">
          <CourtDeck
            count={g.deckCount}
            moving={moving}
            showDeal={showDeal}
            onDeal={finishDeal}
            onDelivery={onDelivery}
          />
          <div className={"live-turn" + (g.legal.length ? " needs-you" : "")}>
            <h1 className="turn-guide" aria-live="polite">
              {moving?.move?.kind === "replace"
                ? "Mengganti kartu bukti dari dek"
                : (dialogue.proofStatus ?? turnStatus(room, clock))}
            </h1>
          </div>

          {!dialogue.speakerId && dialogue.bubble}
          {dialogue.speakerId === room.me && (
            <div className="my-dialogue">{dialogue.bubble}</div>
          )}
        </div>
        <div
          data-card-seat={room.me}
          className="player-area"
          data-speaking={dialogue.speakerId === room.me}
        >
          <div className="hand-info">
            <h2>Kartu Anda</h2>
            <b>{me.name}</b>
            <span className="balance" key={me.coins}>
              ◉ {me.coins} koin
            </span>
            {g.config.one_time_guess && (
              <small>{me.used ? "Tebakan terpakai" : "1 tebakan"}</small>
            )}
          </div>
          <Hand
            key={g.hand.join("-")}
            roles={g.hand}
            fallen={me.revealed}
            proof={
              dialogue.proofSeat === room.me ? dialogue.activeProof : undefined
            }
          />
        </div>
        {moving?.move?.kind === "drawTwo" && moving.move.seat === room.me && (
          <section className="action-rail">
            <h2>Anda mengambil dua kartu Exchange</h2>
            <div
              className="exchange-cards exchange-preview"
              data-draw-seat={room.me}
            >
              {g.hand.map((role, i) => (
                <span key={i}>
                  <Face role={role} />
                </span>
              ))}
              {[0, 1].map((i) => (
                <span
                  key={"draw" + i}
                  data-exchange-slot=""
                  style={{ visibility: "hidden" }}
                >
                  <Back />
                </span>
              ))}
            </div>
          </section>
        )}
        {!dealing && children}
        {dialogue.controls}
      </div>
    </>
  );
}
