import type { NormalizedGame } from "@chess-review/chess-core";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { BrowserStockfish, type SearchOptions } from "./browser-engine";

export interface StockfishSearcher {
  search(fen: string, options: SearchOptions): Promise<StockfishMoveAnalysis>;
  terminate(): void;
}

export interface GameReviewProgress {
  stage: "positions" | "played-moves";
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

    try {
      const positionAnalyses = await this.runJobs(
        fens,
        (worker, fen) =>
          worker.search(fen, {
            depth: options.depth,
            multiPv,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          }),
        (completed) => options.onProgress?.({ stage: "positions", completed, total: fens.length }),
        options.signal,
      );

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
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          }),
        (completed) =>
          options.onProgress?.({ stage: "played-moves", completed, total: missing.length }),
        options.signal,
      );

      return {
        positionAnalyses,
        playedMoveAnalyses: new Map(missing.map((item, index) => [item.ply, restricted[index]!])),
      };
    } catch (error) {
      if (options.signal?.aborted) this.terminate();
      throw error;
    }
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
