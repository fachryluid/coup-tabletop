import { useState } from "react";
import type { BotObservation } from "../domain/view";
import type { GameEvent } from "../domain/model";

export function MatchHistory({ game }: { game: BotObservation }) {
  const [copied, setCopied] = useState(0);
  const [manual, setManual] = useState("");
  const name = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? id;
  const balances = (e: GameEvent) =>
    e.balances
      ?.map(
        (p) =>
          name(p.id) +
          " · " +
          p.coins +
          " koin · " +
          p.influence +
          " influence",
      )
      .join(" | ") ?? "Saldo historis belum tercatat.";
  async function copy() {
    const text = [
      "Riwayat pertandingan Coup",
      "Timer: " +
        (game.config.timer ? "30 detik" : "OFF") +
        " | One-Time Guess: " +
        (game.config.one_time_guess ? "ON" : "OFF") +
        " | Duke Blocks Tax: " +
        (game.config.duke_blocks_tax ? "ON" : "OFF"),
      ...game.log.map((e) =>
        [
          "#" + e.seq + " " + e.text,
          [
            e.phase,
            e.actionId && "aksi " + e.actionId,
            e.actorId && "pelaku " + name(e.actorId),
            e.targetId && "target " + name(e.targetId),
            e.status,
          ]
            .filter(Boolean)
            .join(" · "),
          e.speech && "Ucapan " + name(e.speech.by) + ": " + e.speech.words,
          balances(e),
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      "Kondisi terakhir: " +
        game.stage +
        (game.winner ? " · Pemenang " + name(game.winner) : "") +
        (game.paused !== null ? " · Dijeda" : ""),
      ...(game.context.eligibleResponders.length
        ? ["Menunggu: " + game.context.eligibleResponders.map(name).join(", ")]
        : []),
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(game.log.length);
      setManual("");
    } catch {
      setManual(text);
    }
  }
  return (
    <details className="table-options">
      <summary>Riwayat meja</summary>
      <section>
        <button onClick={copy} type="button">
          Salin riwayat lengkap
        </button>
        {copied === game.log.length && (
          <small role="status">Riwayat disalin.</small>
        )}
        {manual && (
          <label>
            Salin teks riwayat
            <textarea
              readOnly
              value={manual}
              onFocus={(e) => e.target.select()}
            />
          </label>
        )}
        <ol reversed className="history">
          {[...game.log].reverse().map((e) => (
            <li key={e.seq} value={e.seq}>
              <details>
                <summary>{e.text}</summary>
                <small>{balances(e)}</small>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </details>
  );
}
