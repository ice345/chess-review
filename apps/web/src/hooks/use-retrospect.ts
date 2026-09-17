"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { judgePracticeScore, practiceHumanComparison, practiceMoves, type PracticeHumanComparison } from "@chess-review/analysis";
import { replayUciLine } from "@chess-review/chess-core";
import { BrowserStockfish } from "@chess-review/stockfish";
import { formatMoveNotation, type EngineScore, type GameAnalysisV2, type MoveAnalysisV2, type PlayerColor } from "@chess-review/shared";
import { analysisScheduler } from "../lib/analysis-scheduler";
import {
  practiceAnswerOwed,
  practicePresentation,
  type PracticePresentation,
  type RetroStatus,
} from "../lib/practice-presentation";

export type { PracticePresentation, RetroStatus };

/**
 * In-place practice of a game's own mistakes, modelled on Lichess "Learn from
 * your mistakes". Result kinds, attempt identity and visible reject/rewind are
 * documented in `docs/mistake-practice.md`.
 */
export type ExerciseResultKind = "solved" | "hinted" | "revealed" | "skipped" | "unavailable";

export interface Retrospective {
  faultPly: number;
  promptPly: number;
  faultSan: string;
  faultUci: string;
  faultLabel: string;
  bestUci: string;
  bestSan: string;
  bestScore: EngineScore;
  comparison?: PracticeHumanComparison;
}

export interface PracticeTally {
  solved: number;
  hinted: number;
  revealed: number;
  skipped: number;
  unavailable: number;
  processed: number;
  /**
   * Attempted positions whose answer was already on screen before the attempt
   * started. A solve there is practice, not a first-time solve.
   */
  afterExposure: number;
}

interface AttemptOutcome {
  accepted: boolean;
  loss: number;
  reason: "near-best" | "lost-mate" | "allows-mate" | "too-costly" | "engine-unavailable" | "timeout";
  attemptedSan?: string;
}

const JUDGE_TIMEOUT_MS = 15_000;
const REJECT_HOLD_MS = 400;
const REWIND_MS = 180;

function sanForUci(fen: string, uci: string): string | null {
  try {
    return replayUciLine(fen, [uci])[0]?.san ?? null;
  } catch {
    return null;
  }
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scoreForBestMove(move: MoveAnalysisV2, bestUci: string): EngineScore | null {
  const matching = move.stockfish.lines.find((line) => line.pv[0] === bestUci);
  return matching?.score ?? move.stockfish.score ?? move.stockfish.lines[0]?.score ?? null;
}

export interface RetroRuntime {
  active: boolean;
  status: RetroStatus;
  current: Retrospective | null;
  color: PlayerColor;
  includeInaccuracies: boolean;
  setIncludeInaccuracies: (value: boolean) => void;
  currentIndex: number;
  totalCount: number;
  tally: PracticeTally;
  locked: boolean;
  evaluating: boolean;
  lastOutcome: AttemptOutcome | null;
  presentation: PracticePresentation;
  start: (color: PlayerColor) => void;
  /** Start a one-position session on a single fault ply, for a guided key moment. */
  startAt: (faultPly: number) => boolean;
  stop: () => void;
  next: () => void;
  viewSolution: () => void;
  /** Reveal which piece to move without revealing the destination. Counts as hinted, never solved. */
  useHint: () => void;
  hintSquare: string | null;
  skip: () => void;
  reset: () => void;
  retryUnsolved: () => void;
  attempt: (uci: string) => Promise<void>;
  hiddenPly: number | null;
  /** The answer for the position being solved was already shown in free analysis. */
  answerExposed: boolean;
  /** Records that the answer for this ply was available on screen. */
  noteAnswerExposed: (ply: number) => void;
}

export function useRetrospect({
  analysis,
  goToPly,
  playUci,
  onSolved,
}: {
  analysis: GameAnalysisV2 | null;
  goToPly: (ply: number) => void;
  playUci: (uci: string) => boolean;
  onSolved?: (retrospective: Retrospective) => void;
}): RetroRuntime {
  const [active, setActive] = useState(false);
  const [color, setColor] = useState<PlayerColor>("white");
  const [includeInaccuracies, setIncludeInaccuracies] = useState(false);
  const [status, setStatus] = useState<RetroStatus>("solving");
  const [queuePlies, setQueuePlies] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, ExerciseResultKind>>({});
  const [exposedAttempts, setExposedAttempts] = useState<Record<number, true>>({});
  const exposedPlies = useRef<Set<number>>(new Set());
  const [lastOutcome, setLastOutcome] = useState<AttemptOutcome | null>(null);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const engine = useRef<BrowserStockfish | null>(null);
  const abort = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const currentRef = useRef<Retrospective | null>(null);
  const sessionId = useRef(0);
  const attemptId = useRef(0);

  useEffect(() => {
    engine.current = new BrowserStockfish();
    return () => {
      abort.current?.abort();
      for (const timer of timers.current) window.clearTimeout(timer);
      engine.current?.terminate();
      engine.current = null;
    };
  }, []);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const later = useCallback((delay: number, work: () => void) => {
    const wait = reducedMotion() ? 0 : delay;
    const timer = window.setTimeout(work, wait);
    timers.current.push(timer);
  }, []);

  const candidates = useMemo(
    () => analysis ? practiceMoves(analysis.moves, color, includeInaccuracies) : [],
    [analysis, color, includeInaccuracies],
  );

  const build = useCallback((move: MoveAnalysisV2): Retrospective | null => {
    const bestUci = move.stockfish.bestMove;
    const bestScore = bestUci ? scoreForBestMove(move, bestUci) : null;
    if (!bestUci || !bestScore) return null;
    return {
      faultPly: move.ply,
      promptPly: Math.max(0, move.ply - 1),
      faultSan: move.san,
      faultUci: move.uci,
      faultLabel: formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san }),
      bestUci,
      bestSan: sanForUci(move.fenBefore, bestUci) ?? bestUci,
      bestScore,
      ...(move.human === undefined ? {} : (() => {
        const comparison = practiceHumanComparison({
          human: move.human!,
          bestMove: bestUci,
          legalMoveCount: move.classificationReason.legalMoveCount,
          isForced: move.classificationReason.isForced,
          isForcing: false,
          isSacrifice: move.classificationReason.sacrifice?.genuine === true,
          isEngineBest: move.classificationReason.isEngineBest,
          ...(move.classificationReason.secondBestGapCp === undefined ? {} : { secondBestGapCp: move.classificationReason.secondBestGapCp }),
          ...(move.classificationReason.secondBestGapWinPercent === undefined ? {} : { secondBestGapWinPercent: move.classificationReason.secondBestGapWinPercent }),
          tacticalMotifCount: move.motifs.length,
        });
        return { comparison };
      })()),
    };
  }, []);

  const recordResult = useCallback((ply: number, kind: ExerciseResultKind) => {
    setResults((previous) => previous[ply] === undefined ? { ...previous, [ply]: kind } : previous);
  }, []);

  const show = useCallback((index: number, retrospective: Retrospective, nextStatus: RetroStatus) => {
    currentRef.current = retrospective;
    setCurrentIndex(index);
    setStatus(nextStatus);
    setHintSquare(null);
    // Free analysis showed this position's facts earlier in the workspace; the
    // attempt is still valid practice, but it is not a first-time solve.
    if (exposedPlies.current.has(retrospective.faultPly)) {
      setExposedAttempts((previous) => (previous[retrospective.faultPly] ? previous : { ...previous, [retrospective.faultPly]: true }));
    }
    goToPly(retrospective.promptPly);
  }, [goToPly]);

  const noteAnswerExposed = useCallback((ply: number) => {
    if (ply > 0) exposedPlies.current.add(ply);
  }, []);

  const advanceFrom = useCallback((fromIndex: number, recorded: Record<number, ExerciseResultKind>, plies: number[]) => {
    abort.current?.abort();
    clearTimers();
    setLastOutcome(null);
    if (!analysis) return;
    const extra: Record<number, ExerciseResultKind> = {};
    for (let index = fromIndex; index < plies.length; index += 1) {
      const ply = plies[index]!;
      if (recorded[ply] !== undefined || extra[ply] !== undefined) continue;
      const move = analysis.moves[ply - 1];
      const retrospective = move ? build(move) : null;
      if (retrospective) {
        if (Object.keys(extra).length > 0) setResults((previous) => ({ ...previous, ...extra }));
        show(index, retrospective, "solving");
        return;
      }
      extra[ply] = "unavailable";
    }
    currentRef.current = null;
    if (Object.keys(extra).length > 0) setResults((previous) => ({ ...previous, ...extra }));
    setStatus("complete");
  }, [analysis, build, clearTimers, show]);

  const start = useCallback((nextColor: PlayerColor) => {
    abort.current?.abort();
    clearTimers();
    sessionId.current += 1;
    attemptId.current += 1;
    const queue = analysis ? practiceMoves(analysis.moves, nextColor, includeInaccuracies) : [];
    const plies = queue.map((move) => move.ply);
    setColor(nextColor);
    setQueuePlies(plies);
    setResults({});
    setExposedAttempts({});
    setCurrentIndex(0);
    setLastOutcome(null);
    setActive(true);
    currentRef.current = null;
    if (plies.length === 0) setStatus("complete");
    else advanceFrom(0, {}, plies);
  }, [advanceFrom, analysis, clearTimers, includeInaccuracies]);

  const stop = useCallback(() => {
    abort.current?.abort();
    clearTimers();
    sessionId.current += 1;
    setActive(false);
    currentRef.current = null;
    setLastOutcome(null);
    setHintSquare(null);
    setStatus("solving");
  }, [clearTimers]);

  /**
   * Guided review practises one key moment at a time. The session is the same
   * machinery as "Learn from your mistakes", with a one-position queue, so the
   * result states and the visible reject/rewind behave identically.
   */
  const startAt = useCallback((faultPly: number) => {
    const move = analysis?.moves[faultPly - 1];
    const retrospective = move ? build(move) : null;
    // Without canonical engine evidence there is nothing to solve against, so the
    // guided moment must not pretend to start a session.
    if (!move || !retrospective) return false;
    abort.current?.abort();
    clearTimers();
    sessionId.current += 1;
    attemptId.current += 1;
    setColor(move.color);
    setQueuePlies([faultPly]);
    setResults({});
    setExposedAttempts({});
    setCurrentIndex(0);
    setLastOutcome(null);
    setHintSquare(null);
    setActive(true);
    currentRef.current = null;
    show(0, retrospective, "solving");
    return true;
  }, [analysis, build, clearTimers, show]);

  const useHint = useCallback(() => {
    const retrospective = currentRef.current;
    if (!retrospective) return;
    if (!practiceAnswerOwed(status)) return;
    // The hint names the piece to move, never the destination, and the position
    // is recorded as hinted so it can never be counted as solved.
    recordResult(retrospective.faultPly, "hinted");
    setHintSquare(retrospective.bestUci.slice(0, 2));
  }, [recordResult, status]);

  const reset = useCallback(() => {
    abort.current?.abort();
    clearTimers();
    sessionId.current += 1;
    attemptId.current += 1;
    setResults({});
    setCurrentIndex(0);
    currentRef.current = null;
    setLastOutcome(null);
    if (queuePlies.length === 0) setStatus("complete");
    else advanceFrom(0, {}, queuePlies);
  }, [advanceFrom, clearTimers, queuePlies]);
  const retryUnsolved = useCallback(() => {
    abort.current?.abort();
    clearTimers();
    sessionId.current += 1;
    attemptId.current += 1;
    const remaining = queuePlies.filter((ply) => results[ply] !== "solved");
    setQueuePlies(remaining);
    setResults({});
    setCurrentIndex(0);
    currentRef.current = null;
    setLastOutcome(null);
    if (remaining.length === 0) setStatus("complete");
    else advanceFrom(0, {}, remaining);
  }, [advanceFrom, clearTimers, queuePlies, results]);



  const next = useCallback(() => {
    const current = currentRef.current;
    const recorded = current && results[current.faultPly] === undefined
      ? { ...results, [current.faultPly]: "skipped" as const }
      : results;
    if (current && results[current.faultPly] === undefined) recordResult(current.faultPly, "skipped");
    advanceFrom(currentIndex + 1, recorded, queuePlies);
  }, [advanceFrom, currentIndex, queuePlies, recordResult, results]);

  const viewSolution = useCallback(() => {
    const retrospective = currentRef.current;
    if (!retrospective) return;
    abort.current?.abort();
    clearTimers();
    recordResult(retrospective.faultPly, "revealed");
    goToPly(retrospective.promptPly);
    playUci(retrospective.bestUci);
    setStatus("revealed");
    onSolved?.(retrospective);
  }, [clearTimers, goToPly, onSolved, playUci, recordResult]);

  const skip = useCallback(() => {
    const retrospective = currentRef.current;
    if (!retrospective) {
      advanceFrom(currentIndex + 1, results, queuePlies);
      return;
    }
    recordResult(retrospective.faultPly, "skipped");
    advanceFrom(currentIndex + 1, { ...results, [retrospective.faultPly]: "skipped" }, queuePlies);
  }, [advanceFrom, currentIndex, queuePlies, recordResult, results]);


  const rewindToPrompt = useCallback((retrospective: Retrospective, nextStatus: RetroStatus) => {
    later(REJECT_HOLD_MS, () => {
      setStatus("rewinding");
      goToPly(retrospective.promptPly);
      later(REWIND_MS, () => setStatus(nextStatus));
    });
  }, [goToPly, later]);

  const scoreAttempt = useCallback(async (move: MoveAnalysisV2, uci: string, signal: AbortSignal): Promise<EngineScore | null> => {
    const saved = move.stockfish.lines.find((line) => line.pv[0] === uci);
    if (saved) return saved.score;
    if (!engine.current || !analysis) return null;
    try {
      const result = await analysisScheduler.run(
        "interactive-position",
        () => engine.current!.search(move.fenBefore, {
          depth: 12,
          multiPv: 1,
          searchMoves: [uci],
          startFen: analysis.game.initialFen,
          moves: analysis.moves.slice(0, move.ply - 1).map((previous) => previous.uci),
          signal,
        }),
        signal,
      );
      return result.lines[0]?.score ?? null;
    } catch {
      return null;
    }
  }, [analysis]);

  const attempt = useCallback(async (uci: string) => {
    const retrospective = currentRef.current;
    if (!retrospective || !analysis) return;
    const fault = analysis.moves[retrospective.faultPly - 1];
    if (!fault) return;
    const thisSession = sessionId.current;
    const thisAttempt = ++attemptId.current;
    const stillCurrent = () => sessionId.current === thisSession && attemptId.current === thisAttempt && currentRef.current?.faultPly === retrospective.faultPly;

    if (uci === retrospective.faultUci) {
      setLastOutcome({ accepted: false, loss: 0, reason: "too-costly", attemptedSan: fault.san });
      setStatus("rejected");
      rewindToPrompt(retrospective, "solving");
      return;
    }

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
    const attemptedSan = sanForUci(fault.fenBefore, uci) ?? uci;
    setStatus("evaluating");
    const candidateScore = await scoreAttempt(fault, uci, controller.signal);
    window.clearTimeout(timeout);
    if (!stillCurrent()) return;
    if (!candidateScore) {
      setLastOutcome({
        accepted: false,
        loss: 0,
        reason: controller.signal.aborted ? "timeout" : "engine-unavailable",
        attemptedSan,
      });
      setStatus("rejected");
      rewindToPrompt(retrospective, "solving");
      return;
    }
    const verdict = judgePracticeScore(retrospective.bestScore, candidateScore, color);
    setLastOutcome({ accepted: verdict.accepted, loss: verdict.loss, reason: verdict.reason, attemptedSan });
    if (verdict.accepted) {
      recordResult(retrospective.faultPly, "solved");
      setStatus("accepted");
      onSolved?.(retrospective);
      return;
    }
    setStatus("rejected");
    rewindToPrompt(retrospective, "solving");
  }, [analysis, color, onSolved, recordResult, rewindToPrompt, scoreAttempt]);

  const currentPly = queuePlies[currentIndex] ?? null;
  const current = useMemo(() => {
    if (currentPly === null || !analysis) return null;
    const move = analysis.moves[currentPly - 1];
    return move ? build(move) : null;
  }, [analysis, build, currentPly]);

  const tally = useMemo(() => {
    const values = Object.values(results);
    const count = (kind: ExerciseResultKind) => values.filter((item) => item === kind).length;
    return {
      solved: count("solved"),
      hinted: count("hinted"),
      revealed: count("revealed"),
      skipped: count("skipped"),
      unavailable: count("unavailable"),
      processed: values.length,
      afterExposure: Object.keys(exposedAttempts).filter((ply) => results[Number(ply)] !== undefined).length,
    };
  }, [exposedAttempts, results]);

  const presentation = practicePresentation({ active, status });
  const locked = active && practiceAnswerOwed(status);

  return {
    active,
    status,
    current,
    color,
    includeInaccuracies,
    setIncludeInaccuracies,
    currentIndex,
    totalCount: active ? queuePlies.length : candidates.length,
    tally,
    locked,
    evaluating: active && status === "evaluating",
    lastOutcome,
    presentation,
    start,
    startAt,
    stop,
    next,
    viewSolution,
    useHint,
    hintSquare,
    skip,
    reset,
    retryUnsolved,
    attempt,
    hiddenPly: locked ? current?.faultPly ?? null : null,
    answerExposed: current !== null && exposedAttempts[current.faultPly] === true,
    noteAnswerExposed,
  };
}
