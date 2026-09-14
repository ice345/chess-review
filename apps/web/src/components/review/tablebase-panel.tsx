"use client";

import { useEffect, useState } from "react";
import { TABLEBASE_MAX_PIECES, type TablebaseCategory, type TablebasePositionV1 } from "@chess-review/tablebase";
import { loadTablebasePosition, tablebaseCoverage, type TablebaseResult } from "../../lib/tablebase";
import { useReviewStore } from "../../store/review-store";
import { describeFetchAge } from "../../lib/review-format";

const CATEGORY_LABEL: Record<TablebaseCategory, string> = {
  win: "White wins",
  "maybe-win": "Probably won",
  "cursed-win": "Win, but the fifty-move rule may save it",
  draw: "Draw",
  "blessed-loss": "Lost, but the fifty-move rule may save it",
  "maybe-loss": "Probably lost",
  loss: "Black wins",
  unknown: "Unknown",
};

/** The side the result favours, from the tablebase's own categories. */
function outcome(category: TablebaseCategory): "white" | "black" | "draw" | null {
  if (["win", "maybe-win", "cursed-win"].includes(category)) return "white";
  if (["loss", "maybe-loss", "blessed-loss"].includes(category)) return "black";
  if (category === "draw") return "draw";
  return null;
}

type TablebaseState =
  | { status: "loading" }
  | { status: "ready"; result: TablebaseResult }
  | { status: "error"; message: string }
  | { status: "uncovered"; pieceCount: number };

/**
 * Tablebase panel.
 *
 * This is correctness, not parity: a tablebase-proven result is a different kind
 * of claim from an engine evaluation, and the panel only exists when the tables
 * actually cover the position. Below the coverage limit it never guesses.
 */
export function TablebasePanel({ fen }: { fen: string }) {
  const [state, setState] = useState<TablebaseState>({ status: "loading" });
  const [playError, setPlayError] = useState<string | null>(null);
  const coverage = tablebaseCoverage(fen);

  useEffect(() => {
    if (coverage) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadTablebasePosition(fen, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setState({ status: "ready", result }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "The tablebase is unavailable." });
      });
    return () => controller.abort();
  }, [fen, coverage]);

  function playMove(uci: string) {
    const promotion = uci[4];
    const played = useReviewStore.getState().playAnalysisMove(
      uci.slice(0, 2),
      uci.slice(2, 4),
      promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
    );
    setPlayError(played ? null : "That move could not be played on this position.");
  }

  if (coverage?.status === "invalid") {
    return <section className="tablebase-panel" aria-label="Tablebase"><p className="error" role="alert">This position cannot be read.</p></section>;
  }
  if (coverage?.status === "uncovered") {
    return (
      <section className="tablebase-panel" aria-label="Tablebase">
        <p className="utility-empty">
          Tablebase results cover positions with at most {TABLEBASE_MAX_PIECES} pieces. This position has {coverage.pieceCount},
          so Stockfish evaluation is the only evidence available here — it is not a theoretical result.
        </p>
      </section>
    );
  }

  return (
    <section className="tablebase-panel" aria-label="Tablebase">
      <small className="tablebase-privacy">
        Sends this position to the public Syzygy tablebase through this site&rsquo;s server. Only the position leaves this
        machine; the answer is cached in this browser.
      </small>
      {state.status === "loading" && <p className="utility-empty" role="status">Looking up the tables…</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      {playError && <p className="error" role="alert">{playError}</p>}
      {state.status === "ready" && <TablebaseResultView result={state.result} onPlay={playMove} />}
    </section>
  );
}

function TablebaseResultView({ result, onPlay }: { result: TablebaseResult; onPlay: (uci: string) => void }) {
  const position: TablebasePositionV1 = result.position;
  const favoured = outcome(position.category);
  return (
    <>
      <div className={`tablebase-verdict${favoured ? ` ${favoured}` : ""}`}>
        <strong>{position.checkmate ? "Checkmate" : position.stalemate ? "Stalemate" : CATEGORY_LABEL[position.category]}</strong>
        <span>
          {position.dtz === undefined ? "No distance to zeroing reported" : `DTZ ${position.dtz}`}
          {position.dtm === undefined ? "" : ` · DTM ${position.dtm}`}
          {" · "}{position.pieceCount} pieces · Syzygy
        </span>
        <small className={result.stale ? "tablebase-stale" : undefined}>
          {result.stale ? "Cached answer · " : ""}fetched {describeFetchAge(result.fetchedAt)}
        </small>
      </div>

      {position.checkmate || position.stalemate ? (
        <p className="utility-empty">The position is over, so there are no continuations to group by result.</p>
      ) : (
        <>
          <ul className="tablebase-moves">
            {position.moves.map((move) => (
              <li key={move.uci}>
                <button type="button" onClick={() => onPlay(move.uci)} aria-label={`Play ${move.san}, ${CATEGORY_LABEL[move.category]}`}>
                  <strong>{move.san}</strong>
                  <span className={`tablebase-category ${outcome(move.category) ?? "unknown"}`}>{CATEGORY_LABEL[move.category]}</span>
                  <span className="tablebase-distance">{move.dtz === undefined ? "—" : `DTZ ${move.dtz}`}</span>
                </button>
              </li>
            ))}
          </ul>
          <small className="tablebase-note">
            Every legal move is grouped by its proven result. A move marked as a conversion reaches a position the tables do
            not carry, so it needs the engine from there.
          </small>
        </>
      )}
    </>
  );
}

