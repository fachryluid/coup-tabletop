import { useState, useCallback } from "react";
import type { Line } from "./table-playback";
import { CourtDeck } from "./court-deck";
import { CoinStack, TreasuryPile, TREASURY_TOTAL } from "./coin-table";
import { EmoteBadge } from "./emote-control";
import { VoiceSpeakingBadge } from "./voice-chat";
import type { EmotePayload } from "../domain/emotes";
import type { Entry } from "../domain/model";
import type { RoomView } from "../domain/view";
import type { tableDialogue } from "./table-dialogue";
import { Face, Back, Hand } from "./cards";

type CoinLedger = Record<number, Record<string, number>>;

function pendingCoinDelta(
  ledger: CoinLedger,
  committedSeq: number,
  entityId: string,
): number {
  let total = 0;
  for (const [seqStr, deltas] of Object.entries(ledger)) {
    if (Number(seqStr) > committedSeq) {
      total += deltas[entityId] ?? 0;
    }
  }
  return total;
}
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
  const active = g.pending[0];
  const who = active === room.me ? "Anda" : name(active);
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
  activeCoinMove,
  swappingSeat,
  onSwitch,
  emotes,
  voiceSpeaking,
  onDelivery,
  children,
}: {
  room: RoomView;
  showDeal: boolean;
  clock: number;
  moving?: Line;
  activeCoinMove?: { move: NonNullable<Entry["coinMove"]>; seq: number };
  swappingSeat?: string;
  onSwitch?: () => void;
  emotes: Record<string, EmotePayload>;
  voiceSpeaking?: Record<string, boolean>;
  onDelivery: (line: Line) => void;
  dialogue: ReturnType<typeof tableDialogue>;
  children: React.ReactNode;
}) {
  const g = room.game!,
    me = g.players.find((p) => p.id === room.me)!;
  const committedSeq = g.log.at(-1)?.seq ?? 0;
  const [coinLedger, setCoinLedger] = useState<CoinLedger>({});

  const onCoinStep = useCallback(
    (seq: number, entityId: string, delta: number) => {
      setCoinLedger((prev) => {
        const entry = prev[seq] ?? {};
        return {
          ...prev,
          [seq]: {
            ...entry,
            [entityId]: (entry[entityId] ?? 0) + delta,
          },
        };
      });
    },
    [],
  );

  const displayedCoins = (seatId: string, base: number) =>
    Math.max(0, base + pendingCoinDelta(coinLedger, committedSeq, seatId));

  const totalBasePlayerCoins = g.players.reduce((sum, p) => sum + p.coins, 0);
  const displayedBank = Math.max(
    0,
    TREASURY_TOTAL -
      totalBasePlayerCoins +
      pendingCoinDelta(coinLedger, committedSeq, "bank"),
  );
  const myCoins = displayedCoins(me.id, me.coins);

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
                data-voice-speaking={!!voiceSpeaking?.[p.id] || undefined}
                data-turn={g.turn === p.id && g.stage !== "over"}
                className={"opponent" + (!p.influence ? " eliminated" : "")}
              >
                <div
                  className="fan"
                  data-swapping={swappingSeat === p.id || undefined}
                >
                  {Array.from({ length: p.influence }, (_, i) => {
                    const proofIndex = dialogue.proofSlot ?? 0;
                    const isProof =
                      i === proofIndex &&
                      dialogue.proofSeat === p.id &&
                      !!dialogue.activeProof;
                    return (
                      <span
                        key={i}
                        data-live-card=""
                        data-proof={isProof || undefined}
                      >
                        {isProof && dialogue.activeProof ? (
                          <Face
                            role={dialogue.activeProof}
                            theme={g.cardTheme}
                            variant={dialogue.activeProofArt ?? 0}
                          />
                        ) : (
                          <Back />
                        )}
                      </span>
                    );
                  })}
                  {exchangeCards(p.id)}
                  {p.revealed.map((r, i) => (
                    <span key={i} className="fallen" title={"Gugur · " + r}>
                      <Face
                        role={r}
                        theme={g.cardTheme}
                        variant={p.revealedArt?.[i] ?? 0}
                      />
                    </span>
                  ))}
                </div>
                <span className="table-name-row">
                  {voiceSpeaking?.[p.id] && <VoiceSpeakingBadge />}
                  <b>
                    {p.name}
                    {status(p.id)}
                  </b>
                </span>
                <small>
                  {p.difficulty ? "Computer · " + p.difficulty : "Pemain"}
                  {g.turn === p.id && g.stage !== "over" ? " · Giliran" : ""}
                </small>
                <div className="seat-coins-row">
                  <CoinStack
                    seatId={p.id}
                    count={displayedCoins(p.id, p.coins)}
                    compact
                  />
                  <span className="balance">
                    {displayedCoins(p.id, p.coins)} koin
                  </span>
                </div>
                {g.config.one_time_guess && (
                  <small>{p.used ? "Tebakan terpakai" : "1 tebakan"}</small>
                )}
                <EmoteBadge active={emotes[p.id]} />
                {dialogue.speakerId === p.id && dialogue.bubble}
              </div>
            ))}
        </div>
        <div className="court-center">
          <div className="court-supplies">
            <CourtDeck
              count={g.deckCount}
              cardTheme={g.cardTheme}
              moving={moving}
              showDeal={showDeal}
              onDeal={finishDeal}
              onDelivery={onDelivery}
            />
            <TreasuryPile
              available={displayedBank}
              coinMove={activeCoinMove?.move}
              coinMoveSeq={activeCoinMove?.seq}
              onCoinStep={onCoinStep}
            />
          </div>
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
          data-voice-speaking={!!voiceSpeaking?.[me.id] || undefined}
        >
          <EmoteBadge active={emotes[me.id]} />
          <div className="hand-info">
            <h2>Kartu Anda</h2>
            <span className="table-name-row player-name-row">
              {voiceSpeaking?.[me.id] && <VoiceSpeakingBadge />}
              <b>{me.name}</b>
            </span>
            <div className="seat-coins-row player-coins-row">
              <CoinStack seatId={me.id} count={myCoins} />
              <span className="balance">{myCoins} koin</span>
            </div>
            {g.config.one_time_guess && (
              <small>{me.used ? "Tebakan terpakai" : "1 tebakan"}</small>
            )}
            {onSwitch && (
              <button
                type="button"
                className="table-switch-btn with-icon"
                title="Tukar posisi kartu kiri dan kanan (1× giliran ini)"
                onClick={onSwitch}
              >
                <svg
                  aria-hidden="true"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m7 16-4-4 4-4M3 12h18m-4-4 4 4-4 4" />
                </svg>
                <span>Tukar kartu</span>
              </button>
            )}
          </div>
          <Hand
            key={g.hand.join("-") + ":" + (g.handArt?.join("-") ?? "")}
            roles={g.hand}
            handArt={g.handArt}
            fallen={me.revealed}
            fallenArt={me.revealedArt}
            theme={g.cardTheme}
            swapping={swappingSeat === me.id}
            proof={
              dialogue.proofSeat === room.me ? dialogue.activeProof : undefined
            }
            proofSlot={
              dialogue.proofSeat === room.me ? dialogue.proofSlot : undefined
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
                  <Face
                    role={role}
                    theme={g.cardTheme}
                    variant={g.handArt?.[i] ?? 0}
                  />
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
