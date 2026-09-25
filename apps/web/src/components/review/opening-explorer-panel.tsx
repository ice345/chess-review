"use client";

import { useEffect, useRef, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
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
import { useUiLanguage } from "../../hooks/use-ui-language";

/** Speed presets, so the control stays one select instead of a checkbox wall. */
const SPEED_PRESETS: Record<string, ExplorerSpeed[]> = {
  club: ["blitz", "rapid", "classical"],
  all: [],
  blitz: ["blitz"],
  rapid: ["rapid"],
  bullet: ["bullet"],
};

type ExplorerCopy = {
  sources: Record<ExplorerSource, string>;
  mastersSample: string;
  aria: string;
  databaseAria: string;
  rating: string;
  ratingAria: string;
  allRatings: string;
  speed: string;
  speedAria: string;
  speedClub: string;
  speedAll: string;
  speedBlitz: string;
  speedRapid: string;
  speedBullet: string;
  privacy: string;
  databaseSample: (database: string, sample: string) => string;
  position: (fen: string) => string;
  gamesLine: (source: string, white: number, draw: number, black: number) => string;
  cachedFailed: string;
  fetched: (age: string) => string;
  staleNote: (database: string) => string;
  freshNote: (database: string) => string;
  lookingUp: string;
  empty: (database: string) => string;
  couldNotPlay: string;
  playMove: (san: string, games: number) => string;
  numbers: (games: string, white: number, draw: number, black: number) => string;
  note: string;
  retry: string;
  unavailable: string;
  unconfigured: string;
  offline: (database: string) => string;
  rateLimited: (database: string) => string;
  failed: (database: string) => string;
};

const COPY: Record<UiLanguage, ExplorerCopy> = {
  en: {
    sources: { lichess: "All players", masters: "Masters" },
    mastersSample: "human master games",
    aria: "Opening explorer",
    databaseAria: "Explorer database",
    rating: "Rating",
    ratingAria: "Explorer rating filter",
    allRatings: "All ratings",
    speed: "Speed",
    speedAria: "Explorer speed filter",
    speedClub: "Blitz, rapid, classical",
    speedAll: "All speeds",
    speedBlitz: "Blitz only",
    speedRapid: "Rapid only",
    speedBullet: "Bullet only",
    privacy: "This panel sends the current position to lichess.org\u2019s public opening explorer through this site\u2019s server, and caches the answer in this browser. Nothing from your library, games or account is sent.",
    databaseSample: (database, sample) => `${database} database \u00b7 ${sample}`,
    position: (fen) => `Position ${fen}`,
    gamesLine: (source, white, draw, black) => `${source} games \u00b7 W ${white}% \u00b7 D ${draw}% \u00b7 B ${black}%`,
    cachedFailed: "Cached answer \u00b7 this refresh failed \u00b7 ",
    fetched: (age) => `fetched ${age}`,
    staleNote: (database) => `These are human frequencies from the ${database} sample, not a best-move ranking.`,
    freshNote: (database) => `Frequencies of other players' games in the ${database} sample \u2014 not an evaluation.`,
    lookingUp: "Looking up this position\u2026",
    empty: (database) => `No games in this database reached this position. Nobody in the ${database} sample has played it.`,
    couldNotPlay: "That move could not be played on this position.",
    playMove: (san, games) => `Play ${san}, ${games} games`,
    numbers: (games, white, draw, black) => `${games} \u00b7 W ${white}% D ${draw}% B ${black}%`,
    note: "Select a move to explore it on the board. Frequencies are other players\u2019 games, not an evaluation \u2014 Stockfish still decides what is best, and this panel does not change Maia or the game analysis.",
    retry: "Retry explorer",
    unavailable: "The opening explorer is unavailable.",
    unconfigured: "This deployment has no Lichess explorer token, so the lookup cannot run.",
    offline: (database) => `This site could not reach the ${database} lookup.`,
    rateLimited: (database) => `The ${database} lookup is rate-limited right now.`,
    failed: (database) => `The ${database} lookup failed.`,
  },
  "zh-CN": {
    sources: { lichess: "所有棋手", masters: "大师" },
    mastersSample: "人类大师对局",
    aria: "开局浏览器",
    databaseAria: "浏览器数据库",
    rating: "等级分",
    ratingAria: "浏览器等级分筛选",
    allRatings: "全部等级分",
    speed: "速度",
    speedAria: "浏览器速度筛选",
    speedClub: "闪棋、快棋、经典",
    speedAll: "全部速度",
    speedBlitz: "仅闪棋",
    speedRapid: "仅快棋",
    speedBullet: "仅超快棋",
    privacy: "本面板会把当前局面经本网站服务器发往 lichess.org 的公开开局浏览器，并把答案缓存在这个浏览器里。不会发送你的棋库、对局或账户中的任何内容。",
    databaseSample: (database, sample) => `${database} 数据库 · ${sample}`,
    position: (fen) => `局面 ${fen}`,
    gamesLine: (source, white, draw, black) => `${source} 对局 · 胜 ${white}% · 和 ${draw}% · 负 ${black}%`,
    cachedFailed: "缓存结果 · 此次刷新失败 · ",
    fetched: (age) => `获取于 ${age}`,
    staleNote: (database) => `这些是 ${database} 样本中的人类出现频率，不是最佳着法排名。`,
    freshNote: (database) => `${database} 样本中其他棋手对局的出现频率——不是评分。`,
    lookingUp: "正在查询此局面…",
    empty: (database) => `此数据库中没有对局走到这个局面。${database} 样本里还没有人走过。`,
    couldNotPlay: "这一步无法在此局面走出。",
    playMove: (san, games) => `走 ${san}，${games} 盘`,
    numbers: (games, white, draw, black) => `${games} · 胜 ${white}% 和 ${draw}% 负 ${black}%`,
    note: "选择一步在棋盘上探索。频率来自其他棋手的对局，不是评分——仍由 Stockfish 决定什么是最佳，本面板不会改变 Maia 或对局分析。",
    retry: "重试开局浏览器",
    unavailable: "开局浏览器不可用。",
    unconfigured: "此部署没有 Lichess 开局浏览器令牌，因此无法查询。",
    offline: (database) => `本网站无法连接 ${database} 查询。`,
    rateLimited: (database) => `${database} 查询目前受到速率限制。`,
    failed: (database) => `${database} 查询失败。`,
  },
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
  const language = useUiLanguage();
  const copy = COPY[language];
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
        setEntry({ key: requestKey, state: failureState(error, copy.unavailable) });
      });
    return () => controller.abort();
  }, [fen, source, population, rerunToken, requestKey, copy.unavailable]);

  function playMove(uci: string) {
    const promotion = uci[4];
    const played = useReviewStore.getState().playAnalysisMove(
      uci.slice(0, 2),
      uci.slice(2, 4),
      promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
    );
    setPlayError(played ? null : copy.couldNotPlay);
  }

  // The position the numbers describe, so they can never be read as belonging to
  // a different position on the board.
  const database = copy.sources[source];
  // The numbers name their own population: "blitz among 1600+" and "every speed at
  // every rating" are different censuses of different games.
  const sample = source === "masters" ? copy.mastersSample : explorerPopulationLabel(population, language);
  const retryButton = <ExplorerRetry onRetry={() => setRerunToken((token) => token + 1)} />;
  const tracked = "result" in state ? state.result : null;
  const usable = tracked && (state.status === "fresh" || state.status === "stale") ? tracked : null;

  return (
    <section
      className="explorer-panel"
      aria-label={copy.aria}
      data-state={state.status}
      aria-busy={state.status === "loading"}
    >
      <div className="explorer-sources" role="group" aria-label={copy.databaseAria}>
        {EXPLORER_SOURCES.map((value) => (
          <button type="button" key={value} className={source === value ? "active" : ""} aria-pressed={source === value} onClick={() => setSource(value)}>
            {copy.sources[value]}
          </button>
        ))}
      </div>

      <div className="explorer-population">
        {source === "lichess" && (
          <label>
            <span>{copy.rating}</span>
            <select
              aria-label={copy.ratingAria}
              value={population.ratingFloor === null ? "all" : String(population.ratingFloor)}
              onChange={(event) => setPopulation({
                ...population,
                ratingFloor: event.target.value === "all" ? null : Number(event.target.value) as typeof EXPLORER_RATING_FLOORS[number],
              })}
            >
              {EXPLORER_RATING_FLOORS.map((floor) => <option key={floor} value={floor}>{floor}+</option>)}
              <option value="all">{copy.allRatings}</option>
            </select>
          </label>
        )}
        <label>
          <span>{copy.speed}</span>
          <select
            aria-label={copy.speedAria}
            value={speedPreset(population.speeds)}
            onChange={(event) => setPopulation({ ...population, speeds: [...SPEED_PRESETS[event.target.value] ?? SPEED_PRESETS.club!] })}
          >
            <option value="club">{copy.speedClub}</option>
            <option value="all">{copy.speedAll}</option>
            <option value="blitz">{copy.speedBlitz}</option>
            <option value="rapid">{copy.speedRapid}</option>
            <option value="bullet">{copy.speedBullet}</option>
          </select>
        </label>
      </div>

      <small className="explorer-privacy">
        {copy.privacy}
      </small>

      <div className="explorer-summary">
        <small>{copy.databaseSample(database, sample)}</small>
        <small style={{ overflowWrap: "anywhere" }}>{copy.position(fen)}</small>
        {usable && <>
          <strong>{usable.position.totalGames.toLocaleString()}</strong>
          <span>
            {copy.gamesLine(copy.sources[usable.position.source], usable.position.whitePercent, usable.position.drawPercent, usable.position.blackPercent)}
          </span>
          {usable.position.opening && <small>{usable.position.opening.eco} · {usable.position.opening.name}</small>}
          <small className={usable.stale ? "explorer-stale" : undefined}>
            {usable.stale ? copy.cachedFailed : ""}{copy.fetched(describeFetchAge(usable.fetchedAt, language))}
            {usable.stale ? <> {retryButton}</> : null}
          </small>
          <small>
            {usable.stale
              ? copy.staleNote(database)
              : copy.freshNote(database)}
          </small>
        </>}
      </div>

      {state.status === "loading" && <p className="utility-note" role="status">{copy.lookingUp}</p>}

      {state.status === "empty" && (
        <p className="utility-empty" role="status">
          {copy.empty(database)} {retryButton}
        </p>
      )}

      {isFailure(state) && (
        <p className="error" role="alert">
          {failureCaption(state.status, database, copy)} {state.message} {retryButton}
        </p>
      )}

      {playError && <p className="error" role="alert">{playError}</p>}

      {usable && (
        <>
          <ul className="explorer-moves">
            {usable.position.moves.map((move) => (
              <li key={move.uci}>
                <button type="button" onClick={() => playMove(move.uci)} aria-label={copy.playMove(move.san, move.games)}>
                  <strong>{move.san}</strong>
                  <span className="explorer-bar" aria-hidden="true">
                    <i style={{ width: `${move.whitePercent}%` }} />
                    <i style={{ width: `${move.drawPercent}%` }} />
                    <i style={{ width: `${move.blackPercent}%` }} />
                  </span>
                  <span className="explorer-numbers">
                    {copy.numbers(move.games.toLocaleString(), move.whitePercent, move.drawPercent, move.blackPercent)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <small className="explorer-note">{copy.note}</small>
        </>
      )}
    </section>
  );
}

/** The panel's own retry: it re-issues this request and nothing else. */
function ExplorerRetry({ onRetry }: { onRetry: () => void }) {
  const copy = COPY[useUiLanguage()];
  return (
    <button type="button" className="text-button" onClick={onRetry}>
      {copy.retry}
    </button>
  );
}

function failureState(error: unknown, unavailable: string): ExplorerState {
  if (error instanceof ExplorerRequestError) return { status: error.kind, message: error.message };
  if (error instanceof Error) return { status: "failed", message: error.message };
  return { status: "failed", message: unavailable };
}

function isFailure(state: ExplorerState): state is { status: "offline" | "rate-limited" | "failed" | "unconfigured"; message: string } {
  return state.status === "offline" || state.status === "rate-limited" || state.status === "failed" || state.status === "unconfigured";
}

function failureCaption(status: "offline" | "rate-limited" | "failed" | "unconfigured", database: string, copy: ExplorerCopy): string {
  // The explorer has required an API token since 2026-03-03, so this is deployment
  // configuration rather than a visitor error, and it says so.
  if (status === "unconfigured") return copy.unconfigured;
  if (status === "offline") return copy.offline(database);
  if (status === "rate-limited") return copy.rateLimited(database);
  return copy.failed(database);
}
