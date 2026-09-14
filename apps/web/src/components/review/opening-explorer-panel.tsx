"use client";

import { useEffect, useState } from "react";
import { EXPLORER_SOURCES, type ExplorerSource } from "@chess-review/openings";
import { loadExplorerPosition, type ExplorerResult } from "../../lib/opening-explorer";
import { useReviewStore } from "../../store/review-store";
import { describeFetchAge } from "../../lib/review-format";

const SOURCE_LABEL: Record<ExplorerSource, string> = {
  lichess: "All players",
  masters: "Masters",
};

type ExplorerState =
  | { status: "loading" }
  | { status: "ready"; result: ExplorerResult }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Opening Explorer.
 *
 * Answers "what is played from here", which is a different question from opening
 * recognition, and it is third-party data — so it states its source, its age and
 * what leaves the machine, and it is never fed into the objective analysis.
 */
export function OpeningExplorerPanel({ fen }: { fen: string }) {
  const [source, setSource] = useState<ExplorerSource>("lichess");
  const [state, setState] = useState<ExplorerState>({ status: "loading" });
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadExplorerPosition(fen, source, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState(result.position.totalGames === 0 ? { status: "empty" } : { status: "ready", result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "The opening explorer is unavailable." });
      });
    return () => controller.abort();
  }, [fen, source]);

  function playMove(uci: string) {
    const promotion = uci[4];
    const played = useReviewStore.getState().playAnalysisMove(
      uci.slice(0, 2),
      uci.slice(2, 4),
      promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
    );
    setPlayError(played ? null : "That move could not be played on this position.");
  }

  return (
    <section className="explorer-panel" aria-label="Opening explorer">
      <div className="explorer-sources" role="group" aria-label="Explorer database">
        {EXPLORER_SOURCES.map((value) => (
          <button type="button" key={value} className={source === value ? "active" : ""} aria-pressed={source === value} onClick={() => setSource(value)}>
            {SOURCE_LABEL[value]}
          </button>
        ))}
      </div>

      <small className="explorer-privacy">
        This panel sends the current position to lichess.org&rsquo;s public opening explorer through this site&rsquo;s
        server, and caches the answer in this browser. Nothing from your library, games or account is sent.
      </small>

      {state.status === "loading" && <p className="utility-empty" role="status">Looking up this position…</p>}
      {state.status === "empty" && <p className="utility-empty">No games in this database reached this position.</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      {playError && <p className="error" role="alert">{playError}</p>}

      {state.status === "ready" && (
        <>
          <div className="explorer-summary">
            <strong>{state.result.position.totalGames.toLocaleString()}</strong>
            <span>
              {SOURCE_LABEL[state.result.position.source]} games · W {state.result.position.whitePercent}% ·
              D {state.result.position.drawPercent}% · B {state.result.position.blackPercent}%
            </span>
            {state.result.position.opening && <small>{state.result.position.opening.eco} · {state.result.position.opening.name}</small>}
            <small className={state.result.stale ? "explorer-stale" : undefined}>
              {state.result.stale ? "Cached answer · " : ""}fetched {describeFetchAge(state.result.fetchedAt)}
            </small>
          </div>
          <ul className="explorer-moves">
            {state.result.position.moves.map((move) => (
              <li key={move.uci}>
                <button type="button" onClick={() => playMove(move.uci)} aria-label={`Play ${move.san}, ${move.games} games`}>
                  <strong>{move.san}</strong>
                  <span className="explorer-bar" aria-hidden="true">
                    <i style={{ width: `${move.whitePercent}%` }} />
                    <i style={{ width: `${move.drawPercent}%` }} />
                    <i style={{ width: `${move.blackPercent}%` }} />
                  </span>
                  <span className="explorer-numbers">
                    {move.games.toLocaleString()} · W {move.whitePercent}% D {move.drawPercent}% B {move.blackPercent}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <small className="explorer-note">Select a move to explore it on the board. Frequencies are other players&rsquo; games, not an evaluation — Stockfish still decides what is best.</small>
        </>
      )}
    </section>
  );
}

