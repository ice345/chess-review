import { describe, expect, it } from "vitest";
import { createEngineDiagnostics, ENGINE_DIAGNOSTIC_LIMIT, summarizeEngineDiagnostics } from "./engine-diagnostics";

function clock(start = 0) {
  let current = start;
  return { now: () => current, advance: (ms: number) => { current += ms; } };
}

describe("engine run diagnostics", () => {
  it("records a timeline in elapsed milliseconds", () => {
    const time = clock(1_000);
    const diagnostics = createEngineDiagnostics(time.now);

    diagnostics.record("review-start", { depth: 10, positions: 21 });
    time.advance(1_200);
    diagnostics.forWorker(0).record("worker-spawn", { url: "/engine/stockfish.js" });
    time.advance(300);
    diagnostics.forWorker(0).record("uciok");
    time.advance(150);
    diagnostics.forWorker(0).record("ready");
    time.advance(400);
    diagnostics.forWorker(0).record("search-start", { depth: 10, tag: "position 0" });
    time.advance(900);
    diagnostics.forWorker(0).record("first-info", { elapsedMs: 900 });
    time.advance(200);
    diagnostics.forWorker(0).record("bestmove", { ms: 1_100 });

    const snapshot = diagnostics.snapshot();

    expect(snapshot.startedAt).toBe(new Date(1_000).toISOString());
    expect(snapshot.dropped).toBe(0);
    expect(snapshot.events.map(({ at, kind }) => [at, kind])).toEqual([
      [0, "review-start"],
      [1_200, "worker-spawn"],
      [1_500, "uciok"],
      [1_650, "ready"],
      [2_050, "search-start"],
      [2_950, "first-info"],
      [3_150, "bestmove"],
    ]);
    // Every engine event names the worker that produced it; the run's own do not.
    expect(snapshot.events[0]?.worker).toBeUndefined();
    expect(snapshot.events[1]?.worker).toBe(0);
  });

  it("summarizes the figures a surface states without the timeline", () => {
    const time = clock();
    const diagnostics = createEngineDiagnostics(time.now);
    diagnostics.record("review-start", { positions: 3 });
    time.advance(1_000);
    diagnostics.forWorker(0).record("worker-spawn");
    // A cold first search, then a warm one, on one engine.
    diagnostics.forWorker(0).record("search-start", { tag: "position 0" });
    time.advance(6_000);
    diagnostics.forWorker(0).record("bestmove", { ms: 6_000 });
    diagnostics.forWorker(0).record("search-start", { tag: "position 1" });
    time.advance(1_500);
    diagnostics.forWorker(0).record("bestmove", { ms: 1_500 });
    diagnostics.forWorker(0).record("search-cancelled", { elapsedMs: 200 });

    const summary = summarizeEngineDiagnostics(diagnostics.snapshot());

    expect(summary).toMatchObject({
      searches: 2,
      workerSpawns: 1,
      cancelled: 1,
      failures: 0,
      firstSearchMs: 7_000,
      slowestSearchMs: 6_000,
    });
    expect(summary.durationMs).toBe(8_500);
  });

  it("counts what the bounded buffer drops instead of hiding the truncation", () => {
    const diagnostics = createEngineDiagnostics(() => 0);
    for (let index = 0; index < ENGINE_DIAGNOSTIC_LIMIT + 5; index += 1) diagnostics.record("first-info", { index });

    const snapshot = diagnostics.snapshot();

    expect(snapshot.events).toHaveLength(ENGINE_DIAGNOSTIC_LIMIT);
    expect(snapshot.dropped).toBe(5);
    // The newest events are the ones kept.
    expect(snapshot.events.at(-1)?.detail?.index).toBe(ENGINE_DIAGNOSTIC_LIMIT + 4);
  });

  it("counts failures separately from cancellations", () => {
    const diagnostics = createEngineDiagnostics(() => 0);
    diagnostics.forWorker(1).record("search-failed", { reason: "no-scored-pv" });
    diagnostics.record("review-failed", { message: "worker failed to load" });

    expect(summarizeEngineDiagnostics(diagnostics.snapshot())).toMatchObject({ failures: 2, cancelled: 0 });
  });
});
