import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePgn } from "@chess-review/chess-core";
import { createEngineDiagnostics, summarizeEngineDiagnostics, type EngineDiagnostics } from "./engine-diagnostics";
import { BrowserStockfishPool, defaultSearcherFactory } from "./game-review";

type Behaviour = "answer" | "silent" | "silent-search" | "fail";

/** This package targets ES2022, where `Promise.withResolvers` is not available. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => { resolve = settle; });
  return { promise, resolve };
}

/**
 * A scripted engine worker: the pool's diagnostics can only be asserted against a
 * worker whose behaviour the test controls, and the behaviour that matters most is the
 * one a stalled run shows — nothing at all.
 *
 * The test awaits the signal it needs (`whenUci`, `whenGo`) instead of sleeping, so a
 * cancellation happens exactly when the handshake or the search has started.
 */
class ScriptedWorker {
  static instances: ScriptedWorker[] = [];
  static behaviour: Behaviour = "answer";
  private static uciSignal = deferred();
  private static goSignal = deferred();
  private listeners = new Map<string, Array<(event: unknown) => void>>();
  readonly posted: string[] = [];

  constructor(readonly url: string) {
    ScriptedWorker.instances.push(this);
  }

  static whenUci(): Promise<void> {
    return ScriptedWorker.uciSignal.promise;
  }

  static whenGo(): Promise<void> {
    return ScriptedWorker.goSignal.promise;
  }

  static reset(): void {
    ScriptedWorker.instances = [];
    ScriptedWorker.behaviour = "answer";
    ScriptedWorker.uciSignal = deferred();
    ScriptedWorker.goSignal = deferred();
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(): void {}

  postMessage(message: string): void {
    this.posted.push(message);
    if (message === "uci") {
      ScriptedWorker.uciSignal.resolve();
      if (ScriptedWorker.behaviour === "fail") {
        queueMicrotask(() => this.emit("error", { message: "worker failed to load" }));
        return;
      }
      if (ScriptedWorker.behaviour !== "silent") queueMicrotask(() => this.emit("message", { data: "uciok" }));
      return;
    }
    if (message === "isready" && ScriptedWorker.behaviour !== "silent") {
      queueMicrotask(() => this.emit("message", { data: "readyok" }));
      return;
    }
    if (message.startsWith("go ")) {
      ScriptedWorker.goSignal.resolve();
      if (ScriptedWorker.behaviour === "silent" || ScriptedWorker.behaviour === "silent-search") return;
      queueMicrotask(() => this.emit("message", { data: "info depth 10 multipv 1 score cp 20 pv e2e4 e7e5" }));
      queueMicrotask(() => this.emit("message", { data: "bestmove e2e4" }));
    }
  }

  terminate(): void {}

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const GAME = "1. e4 e5 2. Nf3 *";

afterEach(() => {
  ScriptedWorker.reset();
  vi.unstubAllGlobals();
});

function poolWith(diagnostics: EngineDiagnostics): BrowserStockfishPool {
  vi.stubGlobal("Worker", ScriptedWorker);
  return new BrowserStockfishPool(1, defaultSearcherFactory, diagnostics);
}

describe("run diagnostics from the engine path", () => {
  it("records the handshake, each search and the run's own boundaries", async () => {
    const diagnostics = createEngineDiagnostics();
    const pool = poolWith(diagnostics);

    await pool.analyzeGame(parsePgn(GAME), { depth: 10, diagnostics });

    const kinds = diagnostics.snapshot().events.map((event) => event.kind);
    expect(kinds).toContain("review-start");
    expect(kinds).toContain("worker-spawn");
    expect(kinds).toContain("uciok");
    expect(kinds).toContain("ready");
    expect(kinds).toContain("search-start");
    expect(kinds).toContain("bestmove");
    expect(kinds).toContain("review-complete");
    // A search names the position it belongs to, so a slow stage is identifiable.
    const firstSearch = diagnostics.snapshot().events.find((event) => event.kind === "search-start");
    expect(typeof firstSearch?.detail?.tag).toBe("string");
    expect(summarizeEngineDiagnostics(diagnostics.snapshot()).searches).toBeGreaterThan(0);
  });

  it("leaves a record of an engine that never answers the handshake", async () => {
    ScriptedWorker.behaviour = "silent";
    const diagnostics = createEngineDiagnostics();
    const pool = poolWith(diagnostics);
    const controller = new AbortController();

    const run = pool.analyzeGame(parsePgn(GAME), { depth: 10, diagnostics, signal: controller.signal });
    // Exactly the shape of the stall this exists for: engines started, nothing after.
    await ScriptedWorker.whenUci();
    controller.abort();
    await expect(run).rejects.toThrow();

    const snapshot = diagnostics.snapshot();
    const kinds = snapshot.events.map((event) => event.kind);
    expect(kinds.filter((kind) => kind === "worker-spawn").length).toBeGreaterThan(0);
    expect(kinds).not.toContain("uciok");
    expect(kinds).not.toContain("bestmove");
    expect(kinds).toContain("review-cancelled");
    expect(summarizeEngineDiagnostics(snapshot)).toMatchObject({ searches: 0, cancelled: 1 });
    expect(summarizeEngineDiagnostics(snapshot).firstSearchMs).toBeUndefined();
  });

  it("records a worker that fails to load as a failure, not a cancel", async () => {
    ScriptedWorker.behaviour = "fail";
    const diagnostics = createEngineDiagnostics();
    const pool = poolWith(diagnostics);

    await expect(pool.analyzeGame(parsePgn(GAME), { depth: 10, diagnostics })).rejects.toThrow(/failed to load/);

    const snapshot = diagnostics.snapshot();
    expect(snapshot.events.map((event) => event.kind)).toContain("worker-error");
    expect(summarizeEngineDiagnostics(snapshot).failures).toBeGreaterThan(0);
    expect(summarizeEngineDiagnostics(snapshot).cancelled).toBe(0);
  });

  it("records a cancellation during a search, on the engine that was stopped", async () => {
    // The handshake completes and the search starts, then the engine answers nothing:
    // a cancelled search is a different record from a worker that never loaded.
    ScriptedWorker.behaviour = "silent-search";
    const diagnostics = createEngineDiagnostics();
    const pool = poolWith(diagnostics);
    const controller = new AbortController();

    const run = pool.analyzeGame(parsePgn(GAME), { depth: 10, diagnostics, signal: controller.signal });
    await ScriptedWorker.whenGo();
    controller.abort();
    await expect(run).rejects.toThrow();

    const kinds = diagnostics.snapshot().events.map((event) => event.kind);
    expect(kinds).toContain("ready");
    expect(kinds).toContain("search-start");
    expect(kinds).toContain("search-cancelled");
    expect(summarizeEngineDiagnostics(diagnostics.snapshot()).cancelled).toBeGreaterThan(0);
  });
});
