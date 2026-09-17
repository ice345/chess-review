import { normalizeToWhitePov } from "@chess-review/analysis";
import { noLegalMoveTerminalStatus } from "@chess-review/chess-core";
import type { EngineLine, PlayerColor, StockfishMoveAnalysis } from "@chess-review/shared";
import { engineCacheKey, LruCache } from "./cache";
import type { EngineDiagnostics } from "./engine-diagnostics";
import { parseBestMove, parseUciInfo } from "./protocol";

export const STOCKFISH_VERSION = "18";

export interface SearchOptions {
  depth: number;
  multiPv?: number;
  searchMoves?: string[];
  signal?: AbortSignal;
  /** Base FEN for the UCI `position` command. Defaults to `fen`. */
  startFen?: string;
  /** UCI moves from `startFen` that Stockfish must see for repetition/fifty-move. */
  moves?: string[];
  /** Caller context for the run diagnostics, e.g. the ply or stage this search belongs to. */
  tag?: string;
}

function abortError(): Error {
  const error = new Error("Stockfish analysis was cancelled.");
  error.name = "AbortError";
  return error;
}

function sideToMoveFromFen(fen: string): PlayerColor {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

export class BrowserStockfish {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private active: {
    fen: string;
    depth: number;
    lines: Map<number, EngineLine>;
    resolve: (result: StockfishMoveAnalysis) => void;
    reject: (error: Error) => void;
    removeAbortListener: () => void;
    searchMoves: string[];
  } | null = null;
  private readonly cache = new LruCache<string, StockfishMoveAnalysis>(256);
  /** Timing for the search in flight, recorded in the run diagnostics. */
  private searchStartedAt = 0;
  private reportedFirstInfo = false;

  constructor(
    private readonly workerUrl = "/engine/stockfish.js",
    /** Records this engine's own lifecycle: spawn, handshake, searches, exits. */
    private readonly diagnostics: EngineDiagnostics | null = null,
  ) {}

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker(this.workerUrl);
      this.worker = worker;
      this.diagnostics?.record("worker-spawn", { url: this.workerUrl });
      this.rejectReady = reject;
      const cleanup = (): void => {
        worker.removeEventListener("message", onReady);
        worker.removeEventListener("error", onError);
      };
      const onError = (): void => {
        this.diagnostics?.record("worker-error", { phase: "load" });
        cleanup();
        this.rejectReady = null;
        this.resetWorker();
        reject(new Error("Stockfish 18 worker failed to load."));
      };
      const onReady = (event: MessageEvent<string>) => {
        if (event.data === "uciok") {
          this.diagnostics?.record("uciok");
          worker.postMessage("isready");
        }
        if (event.data === "readyok") {
          this.diagnostics?.record("ready");
          cleanup();
          this.rejectReady = null;
          worker.addEventListener("message", this.onMessage);
          resolve();
        }
      };
      worker.addEventListener("error", onError, { once: true });
      worker.addEventListener("message", onReady);
      worker.postMessage("uci");
    });
    return this.ready;
  }

  async search(fen: string, options: SearchOptions): Promise<StockfishMoveAnalysis> {
    const multiPv = options.multiPv ?? 3;
    const searchMoves = options.searchMoves?.filter(Boolean) ?? [];
    const historyMoves = options.moves?.filter(Boolean) ?? [];
    const startFen = options.startFen ?? fen;
    const key = engineCacheKey(fen, STOCKFISH_VERSION, options.depth, multiPv, searchMoves, [startFen, ...historyMoves]);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const terminal = noLegalMoveTerminalStatus(fen);
    if (terminal) {
      const result: StockfishMoveAnalysis = {
        fen,
        score: terminal.kind === "stalemate"
          ? { kind: "cp", cp: 0 }
          : { kind: "mate", mateIn: terminal.sideToMove === "white" ? -1 : 1 },
        lines: [],
        depth: options.depth,
      };
      this.cache.set(key, result);
      return result;
    }
    if (options.signal?.aborted) throw abortError();
    const onInitializationAbort = (): void => {
      this.rejectReady?.(abortError());
      this.rejectReady = null;
      this.resetWorker();
    };
    options.signal?.addEventListener("abort", onInitializationAbort, { once: true });
    try {
      await this.init();
    } finally {
      options.signal?.removeEventListener("abort", onInitializationAbort);
    }
    if (options.signal?.aborted) {
      this.resetWorker();
      throw abortError();
    }
    if (!this.worker) throw new Error("Stockfish worker is unavailable.");
    if (this.active) throw new Error("Stockfish is already analyzing a position.");

    this.worker.postMessage(`setoption name MultiPV value ${multiPv}`);
    this.worker.postMessage("ucinewgame");
    const history = historyMoves.length > 0 ? ` moves ${historyMoves.join(" ")}` : "";
    this.worker.postMessage(`position fen ${startFen}${history}`);

    const result = await new Promise<StockfishMoveAnalysis>((resolve, reject) => {
      const onAbort = (): void => {
        const active = this.active;
        if (!active || active.fen !== fen) return;
        this.active = null;
        active.removeAbortListener();
        this.diagnostics?.record("search-cancelled", { elapsedMs: Date.now() - this.searchStartedAt });
        this.resetWorker();
        reject(abortError());
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      this.active = {
        fen,
        depth: options.depth,
        lines: new Map(),
        resolve,
        reject,
        removeAbortListener: () => options.signal?.removeEventListener("abort", onAbort),
        searchMoves,
      };
      const restriction = searchMoves.length > 0 ? ` searchmoves ${searchMoves.join(" ")}` : "";
      this.searchStartedAt = Date.now();
      this.reportedFirstInfo = false;
      this.diagnostics?.record("search-start", {
        depth: options.depth,
        multiPv,
        restricted: searchMoves.length > 0,
        ...(options.tag === undefined ? {} : { tag: options.tag }),
      });
      this.worker?.postMessage(`go depth ${options.depth}${restriction}`);
    });
    this.cache.set(key, result);
    return result;
  }

  private readonly onMessage = (event: MessageEvent<string>): void => {
    if (!this.active || typeof event.data !== "string") return;
    if (event.data.startsWith("info ")) {
      const parsed = parseUciInfo(event.data);
      if (!parsed?.score || parsed.pv.length === 0) return;
      if (!this.reportedFirstInfo) {
        this.reportedFirstInfo = true;
        this.diagnostics?.record("first-info", { elapsedMs: Date.now() - this.searchStartedAt });
      }
      const sideToMove = sideToMoveFromFen(this.active.fen);
      this.active.lines.set(parsed.multiPv, {
        rank: parsed.multiPv,
        score: normalizeToWhitePov(parsed.score, "side-to-move", sideToMove),
        depth: parsed.depth ?? this.active.depth,
        ...(parsed.nodes === undefined ? {} : { nodes: parsed.nodes }),
        pv: parsed.pv,
      });
      return;
    }
    if (event.data.startsWith("bestmove ")) {
      const active = this.active;
      this.active = null;
      active.removeAbortListener();
      this.diagnostics?.record("bestmove", { ms: Date.now() - this.searchStartedAt });
      const lines = [...active.lines.values()].sort((left, right) => left.rank - right.rank);
      const first = lines[0];
      if (!first) {
        this.diagnostics?.record("search-failed", { reason: "no-scored-pv" });
        active.reject(new Error("Stockfish returned no scored principal variation."));
        return;
      }
      const bestMove = parseBestMove(event.data);
      active.resolve({
        fen: active.fen,
        score: first.score,
        ...(bestMove === null ? {} : { bestMove }),
        ...(active.searchMoves.length === 0 ? {} : { searchMoves: active.searchMoves }),
        lines,
        depth: active.depth,
        ...(first.nodes === undefined ? {} : { nodes: first.nodes }),
      });
    }
  };

  stop(): void {
    this.worker?.postMessage("stop");
  }

  terminate(): void {
    this.active?.reject(new Error("Stockfish worker terminated."));
    this.active?.removeAbortListener();
    this.active = null;
    this.rejectReady?.(new Error("Stockfish worker terminated during initialization."));
    this.rejectReady = null;
    this.resetWorker();
  }

  private resetWorker(): void {
    if (this.worker) this.diagnostics?.record("worker-exit");
    this.worker?.postMessage("quit");
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}
