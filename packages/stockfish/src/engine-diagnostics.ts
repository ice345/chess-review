/**
 * Run diagnostics: what one analysis run did, kept as a bounded timeline.
 *
 * Whole-game review runs up to four Stockfish workers at once, and the failure
 * this exists for is the one nobody can reproduce: a run that stays "running"
 * with no engine traffic. A progress counter cannot tell that apart from a slow
 * machine, so the run records its own lifecycle — worker spawn and exit, UCI
 * handshake, each search's start and result, cancellations and failures, with
 * elapsed milliseconds — and keeps the record where the run itself is stored.
 *
 * The buffer is bounded: diagnostics are evidence for the last run, not an
 * unbounded log. Oldest events are dropped and counted.
 */

export type EngineDiagnosticKind =
  | "worker-spawn"
  | "worker-exit"
  | "worker-error"
  | "uciok"
  | "ready"
  | "search-start"
  | "first-info"
  | "bestmove"
  | "search-cancelled"
  | "search-failed"
  | "review-start"
  | "review-complete"
  | "review-cancelled"
  | "review-failed";

export interface EngineDiagnosticEvent {
  /** Milliseconds since this recorder started. */
  at: number;
  kind: EngineDiagnosticKind;
  /** Which engine produced the event, when it belongs to one. */
  worker?: number;
  /** Machine-readable context: depth, MultiPV, stage, ply, elapsed search time. */
  detail?: Record<string, string | number | boolean>;
}

export interface EngineDiagnosticsSnapshot {
  startedAt: string;
  events: EngineDiagnosticEvent[];
  /** Events the bounded buffer dropped, so a truncation is visible rather than silent. */
  dropped: number;
}

export interface EngineDiagnosticsSummary {
  durationMs: number;
  /** Searches that returned a best move. */
  searches: number;
  workerSpawns: number;
  cancelled: number;
  failures: number;
  /** Time from the run's start to its first completed search — the cold-start figure. */
  firstSearchMs?: number;
  /** The slowest single search, measured from its own start. */
  slowestSearchMs?: number;
}

export const ENGINE_DIAGNOSTIC_LIMIT = 240;

export interface EngineDiagnostics {
  record(kind: EngineDiagnosticKind, detail?: Record<string, string | number | boolean>): void;
  /** The same timeline, stamping every event with the engine that produced it. */
  forWorker(worker: number): EngineDiagnostics;
  snapshot(): EngineDiagnosticsSnapshot;
}

/** `now` is injectable so a test can assert the timeline instead of the wall clock. */
export function createEngineDiagnostics(now: () => number = () => Date.now()): EngineDiagnostics {
  const startedAt = new Date(now()).toISOString();
  const started = now();
  const events: EngineDiagnosticEvent[] = [];
  let dropped = 0;

  const record = (kind: EngineDiagnosticKind, worker?: number, detail?: Record<string, string | number | boolean>): void => {
    while (events.length >= ENGINE_DIAGNOSTIC_LIMIT) {
      events.shift();
      dropped += 1;
    }
    events.push({
      at: now() - started,
      kind,
      ...(worker === undefined ? {} : { worker }),
      ...(detail === undefined ? {} : { detail }),
    });
  };

  const root: EngineDiagnostics = {
    record: (kind, detail) => record(kind, undefined, detail),
    forWorker: (worker) => ({
      record: (kind, detail) => record(kind, worker, detail),
      forWorker: () => root.forWorker(worker),
      snapshot: () => root.snapshot(),
    }),
    snapshot: () => ({ startedAt, events: [...events], dropped }),
  };
  return root;
}

/** The figures a surface can state without making the visitor read the timeline. */
export function summarizeEngineDiagnostics(snapshot: EngineDiagnosticsSnapshot): EngineDiagnosticsSummary {
  const searchStarts = new Map<number, number>();
  let searches = 0;
  let workerSpawns = 0;
  let cancelled = 0;
  let failures = 0;
  let firstSearchMs: number | undefined;
  let slowestSearchMs: number | undefined;
  let durationMs = 0;
  for (const event of snapshot.events) {
    durationMs = Math.max(durationMs, event.at);
    const worker = event.worker ?? 0;
    if (event.kind === "worker-spawn") workerSpawns += 1;
    else if (event.kind === "search-start") searchStarts.set(worker, event.at);
    else if (event.kind === "bestmove") {
      searches += 1;
      if (firstSearchMs === undefined) firstSearchMs = event.at;
      const startedAt = searchStarts.get(worker);
      const elapsed = event.detail?.ms;
      const measured = typeof elapsed === "number" ? elapsed : startedAt === undefined ? undefined : event.at - startedAt;
      if (measured !== undefined && (slowestSearchMs === undefined || measured > slowestSearchMs)) slowestSearchMs = measured;
    } else if (event.kind === "search-cancelled" || event.kind === "review-cancelled") cancelled += 1;
    else if (event.kind === "search-failed" || event.kind === "review-failed" || event.kind === "worker-error") failures += 1;
  }
  return {
    durationMs,
    searches,
    workerSpawns,
    cancelled,
    failures,
    ...(firstSearchMs === undefined ? {} : { firstSearchMs }),
    ...(slowestSearchMs === undefined ? {} : { slowestSearchMs }),
  };
}
