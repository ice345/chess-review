import { noLegalMoveTerminalStatus, type NormalizedGame } from "@chess-review/chess-core";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { BrowserStockfish, type SearchOptions } from "./browser-engine";

export interface StockfishSearcher {
  search(fen: string, options: SearchOptions): Promise<StockfishMoveAnalysis>;
  terminate(): void;
}

export interface GameReviewProgress {
  stage: "positions" | "played-moves" | "verification";
  completed: number;
  total: number;
}

export interface GameReviewOptions {
  depth: number;
  multiPv?: number;
  signal?: AbortSignal;
  onProgress?: (progress: GameReviewProgress) => void;
}

export interface GameReviewResult {
  positionAnalyses: StockfishMoveAnalysis[];
  playedMoveAnalyses: Map<number, StockfishMoveAnalysis>;
}

export interface GameVerificationOptions {
  depth: number;
  multiPv: number;
  plies: readonly number[];
  signal?: AbortSignal;
  onProgress?: (progress: GameReviewProgress) => void;
}

export interface GameVerificationResult {
  /** Deeper analyses keyed by zero-based position index. */
  positionAnalyses: Map<number, StockfishMoveAnalysis>;
  /** Deeper restricted root searches keyed by one-based played ply. */
  playedMoveAnalyses: Map<number, StockfishMoveAnalysis>;
}

type SearcherFactory = () => StockfishSearcher;

function defaultPoolSize(): number {
  const concurrency = typeof navigator === "undefined" ? 2 : navigator.hardwareConcurrency;
  return Math.max(1, Math.min(2, Math.floor((concurrency || 2) / 2)));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("Full-game Stockfish analysis was cancelled.");
  error.name = "AbortError";
  throw error;
}

/**
 * A deliberately small worker pool. Full-game review is CPU-heavy, so browser
 * analysis is bounded to two Stockfish workers even on high-core machines.
 */
export class BrowserStockfishPool {
  private readonly workers: StockfishSearcher[];

  constructor(size = defaultPoolSize(), factory: SearcherFactory = () => new BrowserStockfish()) {
    if (!Number.isInteger(size) || size < 1) throw new Error("Stockfish pool size must be positive.");
    this.workers = Array.from({ length: Math.min(2, size) }, factory);
  }

  async analyzeGame(game: NormalizedGame, options: GameReviewOptions): Promise<GameReviewResult> {
    const multiPv = options.multiPv ?? 3;
    const fens = [game.initialFen, ...game.plies.map((ply) => ply.fenAfter)];
    const indexedPositions = fens.map((fen, index) => ({
      fen,
      index,
      terminal: noLegalMoveTerminalStatus(fen),
    }));
    const terminalPositions = indexedPositions.flatMap((position) => (
      position.terminal ? [{ ...position, terminal: position.terminal }] : []
    ));
    const searchablePositions = indexedPositions.filter((position) => position.terminal === null);

    try {
      const searched = await this.runJobs(
        searchablePositions,
        (worker, position) =>
          worker.search(position.fen, {
            depth: options.depth,
            multiPv,
            startFen: game.initialFen,
            moves: game.plies.slice(0, position.index).map((ply) => ply.uci),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          }),
        (completed) => options.onProgress?.({
          stage: "positions",
          completed: completed + terminalPositions.length,
          total: fens.length,
        }),
        options.signal,
      );
      const positionAnalyses: Array<StockfishMoveAnalysis | undefined> = new Array(fens.length);
      searchablePositions.forEach((position, index) => {
        positionAnalyses[position.index] = searched[index];
      });

      const missing = game.plies.flatMap((ply, index) =>
        positionAnalyses[index]?.lines.some((line) => line.pv[0] === ply.uci)
          ? []
          : [{ ply: ply.ply, fen: ply.fenBefore, uci: ply.uci }],
      );

      const restricted = await this.runJobs(
        missing,
        (worker, item) =>
          worker.search(item.fen, {
            depth: options.depth,
            multiPv: 1,
            searchMoves: [item.uci],
            startFen: game.initialFen,
            moves: game.plies.slice(0, item.ply - 1).map((ply) => ply.uci),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          }),
        (completed) =>
          options.onProgress?.({ stage: "played-moves", completed, total: missing.length }),
        options.signal,
      );

      const playedMoveAnalyses = new Map(missing.map((item, index) => [item.ply, restricted[index]!]));
      for (const terminalPosition of terminalPositions) {
        const precedingMove = game.plies[terminalPosition.index - 1];
        const precedingRoot = positionAnalyses[terminalPosition.index - 1];
        const playedLine = precedingMove
          ? precedingRoot?.lines.find((line) => line.pv[0] === precedingMove.uci)
            ?? playedMoveAnalyses.get(precedingMove.ply)?.lines[0]
          : undefined;
        const score = playedLine?.score
          ?? (terminalPosition.terminal.kind === "stalemate"
            ? { kind: "cp" as const, cp: 0 }
            : { kind: "mate" as const, mateIn: terminalPosition.terminal.sideToMove === "white" ? -1 : 1 });
        positionAnalyses[terminalPosition.index] = {
          fen: terminalPosition.fen,
          score,
          lines: [],
          depth: options.depth,
        };
      }
      const completedPositions = positionAnalyses.map((analysis, index) => {
        if (!analysis) throw new Error(`Missing Stockfish position analysis at index ${index}.`);
        return analysis;
      });
      return { positionAnalyses: completedPositions, playedMoveAnalyses };
    } catch (error) {
      if (options.signal?.aborted) this.terminate();
      throw error;
    }
  }

  /**
   * Re-searches a bounded set of move roots and resulting positions at a
   * stronger configuration. The caller selects plies from deterministic
   * baseline evidence; this transport remains unaware of classification.
   */
  async verifyMoves(game: NormalizedGame, options: GameVerificationOptions): Promise<GameVerificationResult> {
    const plies = [...new Set(options.plies)].sort((left, right) => left - right);
    for (const ply of plies) {
      if (!Number.isInteger(ply) || ply < 1 || ply > game.plies.length) {
        throw new Error(`Verification ply ${ply} is outside the normalized game.`);
      }
    }
    const positionIndexes = [...new Set(plies.flatMap((ply) => [ply - 1, ply]))]
      .filter((index) => noLegalMoveTerminalStatus(index === 0 ? game.initialFen : game.plies[index - 1]!.fenAfter) === null);
    const positions = positionIndexes.map((index) => ({
      index,
      fen: index === 0 ? game.initialFen : game.plies[index - 1]!.fenAfter,
    }));
    let completed = 0;
    const report = (total: number) => options.onProgress?.({ stage: "verification", completed, total });
    const searched = await this.runJobs(
      positions,
      (worker, position) => worker.search(position.fen, {
        depth: options.depth,
        multiPv: options.multiPv,
        startFen: game.initialFen,
        moves: game.plies.slice(0, position.index).map((ply) => ply.uci),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }),
      (positionCompleted) => {
        completed = positionCompleted;
        report(positions.length);
      },
      options.signal,
    );
    const positionAnalyses = new Map(positions.map((position, index) => [position.index, searched[index]!]));
    // A re-searched root replaces shared evidence: the resulting position of a
    // planned ply is also the ROOT of the following, unplanned ply. Recompute
    // restricted evidence against the FINAL roots instead of only the requested
    // plies, otherwise the merged baseline/replacement state can hand
    // buildGameAnalysis a root whose played move is outside MultiPV without any
    // restricted override.
    const missing = positionIndexes.flatMap((index) => {
      const move = game.plies[index];
      if (!move) return [];
      return positionAnalyses.get(index)?.lines.some((line) => line.pv[0] === move.uci)
        ? []
        : [{ ply: index + 1, fen: move.fenBefore, uci: move.uci }];
    });
    const total = positions.length + missing.length;
    const restricted = await this.runJobs(
      missing,
      (worker, item) => worker.search(item.fen, {
        depth: options.depth,
        multiPv: 1,
        searchMoves: [item.uci],
        startFen: game.initialFen,
        moves: game.plies.slice(0, item.ply - 1).map((ply) => ply.uci),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }),
      (restrictedCompleted) => {
        completed = positions.length + restrictedCompleted;
        report(total);
      },
      options.signal,
    );
    return {
      positionAnalyses,
      playedMoveAnalyses: new Map(missing.map((item, index) => [item.ply, restricted[index]!])),
    };
  }

  terminate(): void {
    for (const worker of this.workers) worker.terminate();
  }

  private async runJobs<T, R>(
    items: readonly T[],
    job: (worker: StockfishSearcher, item: T, index: number) => Promise<R>,
    onProgress: (completed: number) => void,
    signal?: AbortSignal,
  ): Promise<R[]> {
    if (items.length === 0) {
      onProgress(0);
      return [];
    }
    const results = new Array<R>(items.length);
    let cursor = 0;
    let completed = 0;
    const run = async (worker: StockfishSearcher): Promise<void> => {
      while (cursor < items.length) {
        throwIfAborted(signal);
        const index = cursor++;
        results[index] = await job(worker, items[index]!, index);
        completed += 1;
        onProgress(completed);
      }
    };
    await Promise.all(this.workers.slice(0, items.length).map(run));
    return results;
  }
}
