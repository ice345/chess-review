import type { EngineDiagnosticsSnapshot, EngineDiagnosticsSummary } from "@chess-review/stockfish";

/**
 * What one analysis run did, in one line, for the Engine Lab.
 *
 * The failure this answers is "did the engine do anything at all?": a progress
 * counter cannot tell that apart from a slow machine, so the line states the completed
 * searches, the cold-start figure, the slowest search and whether the run was cancelled
 * or hit failures — never a claim the record does not support.
 */
export function runDiagnosticsLine(summary: EngineDiagnosticsSummary): string {
  const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
  const parts = [
    `${summary.searches} search${summary.searches === 1 ? "" : "es"}`,
    summary.firstSearchMs === undefined ? "no completed search" : `${seconds(summary.firstSearchMs)} to the first`,
    summary.slowestSearchMs === undefined ? null : `slowest ${seconds(summary.slowestSearchMs)}`,
    summary.workerSpawns > 1 ? `${summary.workerSpawns} engines started` : null,
    summary.cancelled > 0 ? "cancelled" : null,
    summary.failures > 0 ? `${summary.failures} failure${summary.failures === 1 ? "" : "s"}` : null,
    // A truncated timeline says so rather than looking complete.
    summary.durationMs > 0 ? `over ${seconds(summary.durationMs)}` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ");
}

/** The record as text, so it can leave the page without a download step. */
export function runDiagnosticsText(snapshot: EngineDiagnosticsSnapshot, summary: EngineDiagnosticsSummary): string {
  const lines = [
    `Analysis run started ${snapshot.startedAt}`,
    runDiagnosticsLine(summary),
    snapshot.dropped > 0 ? `${snapshot.dropped} earlier event(s) dropped by the bound` : "",
    "",
    ...snapshot.events.map((event) => {
      const detail = event.detail === undefined ? "" : ` ${JSON.stringify(event.detail)}`;
      return `${String(event.at).padStart(6, " ")} ms ${event.kind}${event.worker === undefined ? "" : ` [engine ${event.worker}]`}${detail}`;
    }),
  ];
  return lines.filter((line, index) => line !== "" || index === 3).join("\n");
}
