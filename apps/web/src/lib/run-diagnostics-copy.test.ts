import { describe, expect, it } from "vitest";
import { runDiagnosticsLine, runDiagnosticsText } from "./run-diagnostics-copy";

const summary = {
  durationMs: 12_400,
  searches: 21,
  workerSpawns: 3,
  cancelled: 0,
  failures: 0,
  firstSearchMs: 1_800,
  slowestSearchMs: 6_100,
};

describe("run diagnostics copy", () => {
  it("states what the run did, including that nothing completed", () => {
    expect(runDiagnosticsLine(summary, "en")).toBe("21 searches · 1.8 s to the first · slowest 6.1 s · 3 engines started · over 12.4 s");
    expect(runDiagnosticsLine({ durationMs: 40_000, searches: 0, workerSpawns: 1, cancelled: 1, failures: 0 }, "en")).toBe("0 searches · no completed search · cancelled · over 40.0 s");
    expect(runDiagnosticsLine({ durationMs: 900, searches: 1, workerSpawns: 1, cancelled: 0, failures: 0, firstSearchMs: 800 }, "en")).toBe("1 search · 0.8 s to the first · over 0.9 s");
  });

  it("keeps the timeline readable as text, with the dropped count stated", () => {
    const text = runDiagnosticsText({
      startedAt: "2026-09-16T00:00:00.000Z",
      dropped: 4,
      events: [
        { at: 0, kind: "review-start", detail: { positions: 21 } },
        { at: 1_800, kind: "bestmove", worker: 0, detail: { ms: 1_800 } },
      ],
    }, summary, "en");

    expect(text).toContain("Analysis run started 2026-09-16T00:00:00.000Z");
    expect(text).toContain("4 earlier event(s) dropped by the bound");
    expect(text).toContain('     0 ms review-start {"positions":21}');
    expect(text).toContain('  1800 ms bestmove [engine 0] {"ms":1800}');
  });
});
