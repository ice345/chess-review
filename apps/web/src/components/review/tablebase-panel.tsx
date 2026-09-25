"use client";

import { useEffect, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { TABLEBASE_MAX_PIECES, type TablebaseCategory, type TablebasePositionV1 } from "@chess-review/tablebase";
import { loadTablebasePosition, tablebaseCoverage, type TablebaseResult } from "../../lib/tablebase";
import { useReviewStore } from "../../store/review-store";
import { describeFetchAge } from "../../lib/review-format";
import { useUiLanguage } from "../../hooks/use-ui-language";

type TablebaseCopy = {
  categories: Record<TablebaseCategory, string>;
  unavailable: string;
  couldNotPlay: string;
  aria: string;
  cannotRead: string;
  uncovered: (maxPieces: number, pieceCount: number) => string;
  privacy: string;
  lookingUp: string;
  checkmate: string;
  stalemate: string;
  noDtz: string;
  dtz: (value: number) => string;
  dtm: (value: number) => string;
  piecesSyzygy: (count: number) => string;
  cachedPrefix: string;
  fetched: (age: string) => string;
  over: string;
  playMove: (san: string, category: string) => string;
  note: string;
};

const COPY: Record<UiLanguage, TablebaseCopy> = {
  en: {
    categories: {
      win: "White wins",
      "maybe-win": "Probably won",
      "cursed-win": "Win, but the fifty-move rule may save it",
      draw: "Draw",
      "blessed-loss": "Lost, but the fifty-move rule may save it",
      "maybe-loss": "Probably lost",
      loss: "Black wins",
      unknown: "Unknown",
    },
    unavailable: "The tablebase is unavailable.",
    couldNotPlay: "That move could not be played on this position.",
    aria: "Tablebase",
    cannotRead: "This position cannot be read.",
    uncovered: (maxPieces, pieceCount) => `Tablebase results cover positions with at most ${maxPieces} pieces. This position has ${pieceCount}, so Stockfish evaluation is the only evidence available here \u2014 it is not a theoretical result.`,
    privacy: "Sends this position to the public Syzygy tablebase through this site\u2019s server. Only the position leaves this machine; the answer is cached in this browser.",
    lookingUp: "Looking up the tables\u2026",
    checkmate: "Checkmate",
    stalemate: "Stalemate",
    noDtz: "No distance to zeroing reported",
    dtz: (value) => `DTZ ${value}`,
    dtm: (value) => ` \u00b7 DTM ${value}`,
    piecesSyzygy: (count) => ` \u00b7 ${count} pieces \u00b7 Syzygy`,
    cachedPrefix: "Cached answer \u00b7 ",
    fetched: (age) => `fetched ${age}`,
    over: "The position is over, so there are no continuations to group by result.",
    playMove: (san, category) => `Play ${san}, ${category}`,
    note: "Every legal move is grouped by its proven result. A move marked as a conversion reaches a position the tables do not carry, so it needs the engine from there.",
  },
  "zh-CN": {
    categories: {
      win: "白方胜",
      "maybe-win": "大概赢",
      "cursed-win": "赢，但五十步规则可能救回",
      draw: "和棋",
      "blessed-loss": "输，但五十步规则可能救回",
      "maybe-loss": "大概输",
      loss: "黑方胜",
      unknown: "未知",
    },
    unavailable: "残局库不可用。",
    couldNotPlay: "这一步无法在此局面走出。",
    aria: "残局库",
    cannotRead: "无法读取此局面。",
    uncovered: (maxPieces, pieceCount) => `残局库覆盖至多 ${maxPieces} 个棋子的局面。此局面有 ${pieceCount} 个棋子，因此这里只有 Stockfish 评分可作为证据——这不是理论结果。`,
    privacy: "会把此局面经本网站服务器发往公开的 Syzygy 残局表。只有局面会离开本机；答案缓存在这个浏览器里。",
    lookingUp: "正在查询残局表…",
    checkmate: "将杀",
    stalemate: "逼和",
    noDtz: "未报告归零距离",
    dtz: (value) => `DTZ ${value}`,
    dtm: (value) => ` · DTM ${value}`,
    piecesSyzygy: (count) => ` · ${count} 个棋子 · Syzygy`,
    cachedPrefix: "缓存结果 · ",
    fetched: (age) => `获取于 ${age}`,
    over: "局面已结束，没有可按结果分组的后续着法。",
    playMove: (san, category) => `走 ${san}，${category}`,
    note: "每步合法着法按其已证明结果分组。标为兑换的着法会走到残局表未收录的局面，此后需要引擎。",
  },
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
  const copy = COPY[useUiLanguage()];
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
        setState({ status: "error", message: error instanceof Error ? error.message : copy.unavailable });
      });
    return () => controller.abort();
  }, [fen, coverage, copy.unavailable]);

  function playMove(uci: string) {
    const promotion = uci[4];
    const played = useReviewStore.getState().playAnalysisMove(
      uci.slice(0, 2),
      uci.slice(2, 4),
      promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
    );
    setPlayError(played ? null : copy.couldNotPlay);
  }

  if (coverage?.status === "invalid") {
    return <section className="tablebase-panel" aria-label={copy.aria}><p className="error" role="alert">{copy.cannotRead}</p></section>;
  }
  if (coverage?.status === "uncovered") {
    return (
      <section className="tablebase-panel" aria-label={copy.aria}>
        <p className="utility-empty">
          {copy.uncovered(TABLEBASE_MAX_PIECES, coverage.pieceCount)}
        </p>
      </section>
    );
  }

  return (
    <section className="tablebase-panel" aria-label={copy.aria}>
      <small className="tablebase-privacy">
        {copy.privacy}
      </small>
      {state.status === "loading" && <p className="utility-note" role="status">{copy.lookingUp}</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      {playError && <p className="error" role="alert">{playError}</p>}
      {state.status === "ready" && <TablebaseResultView result={state.result} onPlay={playMove} />}
    </section>
  );
}

function TablebaseResultView({ result, onPlay }: { result: TablebaseResult; onPlay: (uci: string) => void }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const position: TablebasePositionV1 = result.position;
  const favoured = outcome(position.category);
  return (
    <>
      <div className={`tablebase-verdict${favoured ? ` ${favoured}` : ""}`}>
        <strong>{position.checkmate ? copy.checkmate : position.stalemate ? copy.stalemate : copy.categories[position.category]}</strong>
        <span>
          {position.dtz === undefined ? copy.noDtz : copy.dtz(position.dtz)}
          {position.dtm === undefined ? "" : copy.dtm(position.dtm)}
          {copy.piecesSyzygy(position.pieceCount)}
        </span>
        <small className={result.stale ? "tablebase-stale" : undefined}>
          {result.stale ? copy.cachedPrefix : ""}{copy.fetched(describeFetchAge(result.fetchedAt, language))}
        </small>
      </div>

      {position.checkmate || position.stalemate ? (
        <p className="utility-empty">{copy.over}</p>
      ) : (
        <>
          <ul className="tablebase-moves">
            {position.moves.map((move) => (
              <li key={move.uci}>
                <button type="button" onClick={() => onPlay(move.uci)} aria-label={copy.playMove(move.san, copy.categories[move.category])}>
                  <strong>{move.san}</strong>
                  <span className={`tablebase-category ${outcome(move.category) ?? "unknown"}`}>{copy.categories[move.category]}</span>
                  <span className="tablebase-distance">{move.dtz === undefined ? "—" : copy.dtz(move.dtz)}</span>
                </button>
              </li>
            ))}
          </ul>
          <small className="tablebase-note">
            {copy.note}
          </small>
        </>
      )}
    </>
  );
}
