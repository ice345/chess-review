"use client";

import { useEffect, useRef, useState } from "react";
import {
  EXPLORER_DEFAULT_POPULATION,
  EXPLORER_RATING_FLOORS,
  EXPLORER_SOURCES,
  explorerPopulationKey,
  explorerPopulationLabel,
  type ExplorerPopulationV1,
  type ExplorerSource,
  type ExplorerSpeed,
} from "@chess-review/openings";
import { ExplorerRequestError, loadExplorerPosition, type ExplorerResult } from "../../lib/opening-explorer";
import { useReviewStore } from "../../store/review-store";
import { describeFetchAge } from "../../lib/review-format";

const SOURCE_LABEL: Record<ExplorerSource, string> = {
  lichess: "All players",
  masters: "Masters",
};

/** The masters database is one elite cohort; the players database takes both filters. */
const MASTERS_SAMPLE = "human master games";

/** Speed presets, so the control stays one select instead of a checkbox wall. */
const SPEED_PRESETS: Record<string, ExplorerSpeed[]> = {
  club: ["blitz", "rapid", "classical"],
  all: [],
  blitz: ["blitz"],
  rapid: ["rapid"],
  bullet: ["bullet"],
};

function speedPreset(speeds: ExplorerSpeed[]): string {
  const match = Object.entries(SPEED_PRESETS).find(([, value]) => value.length === speeds.length && value.every((speed) => speeds.includes(speed)));
  return match?.[0] ?? "club";
}

/** Loading, empty, unreachable, rate-limited, stale-but-usable and fresh are distinct states. */
type ExplorerState =
  | { status: "loading" }
  | { status: "fresh"; result: ExplorerResult }
  | { status: "stale"; result: ExplorerResult }
  | { status: "empty"; result: ExplorerResult }
  | { status: "offline"; message: string }
  | { status: "rate-limited"; message: string }
  | { status: "failed"; message: string }
  | { status: "unconfigured"; message: string };

/**
 * Opening Explorer.
 *
 * Answers "what is played from here", which is a different question from opening
 * recognition, and it is third-party data — so it states its database, its
 * sample, the position it is showing and what leaves the machine. Frequencies are
 * other players' games: never an evaluation, never a substitute for a Maia
 * probability or a Stockfish evaluation, and never fed into the objective analysis.
 *
 * A failure, a rate limit or a lost connection is only this panel's state. It
 * offers a retry that re-issues this panel's request alone, so the board, the
 * loaded analysis and the rest of Review keep working.
 */
export function OpeningExplorerPanel({ fen }: { fen: string }) {
  const [source, setSource] = useState<ExplorerSource>("lichess");
  const [population, setPopulation] = useState<ExplorerPopulationV1>(EXPLORER_DEFAULT_POPULATION);
  // A retry is a one-shot intent, not part of the position's identity: it is
  // consumed by the lookup it triggers, so returning to a position the visitor
  // once retried cannot start skipping that position's cache.
  const [rerunToken, setRerunToken] = useState(0);
  const [entry, setEntry] = useState<{ key: string; state: ExplorerState }>({ key: "", state: { status: "loading" } });
  const [playError, setPlayError] = useState<string | null>(null);
  const consumedToken = useRef(0);

  // A result is shown only while it still answers the request on screen. The key
  // carries the position and the database, so a late answer can never be labelled
  // as the position now displayed; the run id additionally makes sure only the
  // newest lookup may write, even when the visitor returns to a position whose
  // earlier request is still in flight.
  const requestKey = `${source}\u0000${explorerPopulationKey(population)}\u0000${fen}`;
  const latestRun = useRef(0);
  const state: ExplorerState = entry.key === requestKey ? entry.state : { status: "loading" };

  useEffect(() => {
    const controller = new AbortController();
    const run = ++latestRun.current;
    // A retry asks again instead of reusing a still-fresh cached census, and only
    // the lookup that consumed the retry treats it as a forced refresh.
    const forceRefresh = rerunToken !== consumedToken.current;
    consumedToken.current = rerunToken;
    setEntry({ key: requestKey, state: { status: "loading" } });
    void loadExplorerPosition(fen, source, population, controller.signal, { forceRefresh })
      .then((result) => {
        if (controller.signal.aborted || latestRun.current !== run) return;
        setEntry({
          key: requestKey,
          state: result.position.totalGames === 0
            ? { status: "empty", result }
            : { status: result.stale ? "stale" : "fresh", result },
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || latestRun.current !== run) return;
        setEntry({ key: requestKey, state: failureState(error) });
      });
    return () => controller.abort();
  }, [fen, source, population, rerunToken, requestKey]);

  function playMove(uci: string) {
    const promotion = uci[4];
    const played = useReviewStore.getState().playAnalysisMove(
      uci.slice(0, 2),
      uci.slice(2, 4),
      promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
    );
    setPlayError(played ? null : "That move could not be played on this position.");
  }

  // The position the numbers describe, so they can never be read as belonging to
  // a different position on the board.
  const database = SOURCE_LABEL[source];
  // The numbers name their own population: "blitz among 1600+" and "every speed at
  // every rating" are different censuses of different games.
  const sample = source === "masters" ? MASTERS_SAMPLE : explorerPopulationLabel(population);
  const retryButton = <ExplorerRetry onRetry={() => setRerunToken((token) => token + 1)} />;
  const tracked = "result" in state ? state.result : null;
  const usable = tracked && (state.status === "fresh" || state.status === "stale") ? tracked : null;

  return (
    <section
      className="explorer-panel"
      aria-label="Opening explorer"
      data-state={state.status}
      aria-busy={state.status === "loading"}
    >
      <div className="explorer-sources" role="group" aria-label="Explorer database">
        {EXPLORER_SOURCES.map((value) => (
          <button type="button" key={value} className={source === value ? "active" : ""} aria-pressed={source === value} onClick={() => setSource(value)}>
            {SOURCE_LABEL[value]}
          </button>
        ))}
      </div>

      <div className="explorer-population">
        {source === "lichess" && (
          <label>
            <span>Rating</span>
            <select
              aria-label="Explorer rating filter"
              value={population.ratingFloor === null ? "all" : String(population.ratingFloor)}
              onChange={(event) => setPopulation({
                ...population,
                ratingFloor: event.target.value === "all" ? null : Number(event.target.value) as typeof EXPLORER_RATING_FLOORS[number],
              })}
            >
              {EXPLORER_RATING_FLOORS.map((floor) => <option key={floor} value={floor}>{floor}+</option>)}
              <option value="all">All ratings</option>
            </select>
          </label>
        )}
        <label>
          <span>Speed</span>
          <select
            aria-label="Explorer speed filter"
            value={speedPreset(population.speeds)}
            onChange={(event) => setPopulation({ ...population, speeds: [...SPEED_PRESETS[event.target.value] ?? SPEED_PRESETS.club!] })}
          >
            <option value="club">Blitz, rapid, classical</option>
            <option value="all">All speeds</option>
            <option value="blitz">Blitz only</option>
            <option value="rapid">Rapid only</option>
            <option value="bullet">Bullet only</option>
          </select>
        </label>
      </div>

      <small className="explorer-privacy">
        This panel sends the current position to lichess.org&rsquo;s public opening explorer through this site&rsquo;s
        server, and caches the answer in this browser. Nothing from your library, games or account is sent.
      </small>

      <div className="explorer-summary">
        <small>{database} database · {sample}</small>
        <small style={{ overflowWrap: "anywhere" }}>Position {fen}</small>
        {usable && <>
          <strong>{usable.position.totalGames.toLocaleString()}</strong>
          <span>
            {SOURCE_LABEL[usable.position.source]} games · W {usable.position.whitePercent}% ·
            D {usable.position.drawPercent}% · B {usable.position.blackPercent}%
          </span>
          {usable.position.opening && <small>{usable.position.opening.eco} · {usable.position.opening.name}</small>}
          <small className={usable.stale ? "explorer-stale" : undefined}>
            {usable.stale ? "Cached answer · this refresh failed · " : ""}fetched {describeFetchAge(usable.fetchedAt)}
            {usable.stale ? <> {retryButton}</> : null}
          </small>
          <small>
            {usable.stale
              ? `These are human frequencies from the ${database} sample, not a best-move ranking.`
              : `Frequencies of other players' games in the ${database} sample — not an evaluation.`}
          </small>
        </>}
      </div>

      {state.status === "loading" && <p className="utility-note" role="status">Looking up this position…</p>}

      {state.status === "empty" && (
        <p className="utility-empty" role="status">
          No games in this database reached this position. Nobody in the {database} sample has played it. {retryButton}
        </p>
      )}

      {isFailure(state) && (
        <p className="error" role="alert">
          {failureCaption(state.status, database)} {state.message} {retryButton}
        </p>
      )}

      {playError && <p className="error" role="alert">{playError}</p>}

      {usable && (
        <>
          <ul className="explorer-moves">
            {usable.position.moves.map((move) => (
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
          <small className="explorer-note">Select a move to explore it on the board. Frequencies are other players&rsquo; games, not an evaluation — Stockfish still decides what is best, and this panel does not change Maia or the game analysis.</small>
        </>
      )}
    </section>
  );
}

/** The panel's own retry: it re-issues this request and nothing else. */
function ExplorerRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" className="text-button" onClick={onRetry}>
      Retry explorer
    </button>
  );
}

function failureState(error: unknown): ExplorerState {
  if (error instanceof ExplorerRequestError) return { status: error.kind, message: error.message };
  if (error instanceof Error) return { status: "failed", message: error.message };
  return { status: "failed", message: "The opening explorer is unavailable." };
}

function isFailure(state: ExplorerState): state is { status: "offline" | "rate-limited" | "failed" | "unconfigured"; message: string } {
  return state.status === "offline" || state.status === "rate-limited" || state.status === "failed" || state.status === "unconfigured";
}

function failureCaption(status: "offline" | "rate-limited" | "failed" | "unconfigured", database: string): string {
  // The explorer has required an API token since 2026-03-03, so this is deployment
  // configuration rather than a visitor error, and it says so.
  if (status === "unconfigured") return "This deployment has no Lichess explorer token, so the lookup cannot run.";
  if (status === "offline") return `This site could not reach the ${database} lookup.`;
  if (status === "rate-limited") return `The ${database} lookup is rate-limited right now.`;
  return `The ${database} lookup failed.`;
}
