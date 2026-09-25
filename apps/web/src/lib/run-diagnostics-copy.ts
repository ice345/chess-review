import type { UiLanguage } from "@chess-review/shared";
import type { EngineDiagnosticsSnapshot, EngineDiagnosticsSummary } from "@chess-review/stockfish";

type DiagnosticsCopy = {
  searches: (count: number) => string;
  noCompletedSearch: string;
  toTheFirst: (seconds: string) => string;
  slowest: (seconds: string) => string;
  enginesStarted: (count: number) => string;
  cancelled: string;
  failures: (count: number) => string;
  over: (seconds: string) => string;
  started: (at: string) => string;
  dropped: (count: number) => string;
  engineWorker: (worker: number) => string;
};

const COPY: Record<UiLanguage, DiagnosticsCopy> = {
  en: {
    searches: (count) => `${count} search${count === 1 ? "" : "es"}`,
    noCompletedSearch: "no completed search",
    toTheFirst: (seconds) => `${seconds} to the first`,
    slowest: (seconds) => `slowest ${seconds}`,
    enginesStarted: (count) => `${count} engines started`,
    cancelled: "cancelled",
    failures: (count) => `${count} failure${count === 1 ? "" : "s"}`,
    over: (seconds) => `over ${seconds}`,
    started: (at) => `Analysis run started ${at}`,
    dropped: (count) => `${count} earlier event(s) dropped by the bound`,
    engineWorker: (worker) => ` [engine ${worker}]`,
  },
  "zh-CN": {
    searches: (count) => `${count} 次搜索`,
    noCompletedSearch: "没有完成的搜索",
    toTheFirst: (seconds) => `首次用时 ${seconds}`,
    slowest: (seconds) => `最慢 ${seconds}`,
    enginesStarted: (count) => `启动了 ${count} 个引擎`,
    cancelled: "已取消",
    failures: (count) => `${count} 次失败`,
    over: (seconds) => `历时 ${seconds}`,
    started: (at) => `分析运行开始于 ${at}`,
    dropped: (count) => `${count} 条更早的事件因上限被丢弃`,
    engineWorker: (worker) => ` [引擎 ${worker}]`,
  },
};

/**
 * What one analysis run did, in one line, for the Engine Lab.
 *
 * The failure this answers is "did the engine do anything at all?": a progress
 * counter cannot tell that apart from a slow machine, so the line states the completed
 * searches, the cold-start figure, the slowest search and whether the run was cancelled
 * or hit failures — never a claim the record does not support.
 */
export function runDiagnosticsLine(summary: EngineDiagnosticsSummary, language: UiLanguage): string {
  const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
  const copy = COPY[language];
  const parts = [
    copy.searches(summary.searches),
    summary.firstSearchMs === undefined ? copy.noCompletedSearch : copy.toTheFirst(seconds(summary.firstSearchMs)),
    summary.slowestSearchMs === undefined ? null : copy.slowest(seconds(summary.slowestSearchMs)),
    summary.workerSpawns > 1 ? copy.enginesStarted(summary.workerSpawns) : null,
    summary.cancelled > 0 ? copy.cancelled : null,
    summary.failures > 0 ? copy.failures(summary.failures) : null,
    // A truncated timeline says so rather than looking complete.
    summary.durationMs > 0 ? copy.over(seconds(summary.durationMs)) : null,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ");
}

/** The record as text, so it can leave the page without a download step. */
export function runDiagnosticsText(snapshot: EngineDiagnosticsSnapshot, summary: EngineDiagnosticsSummary, language: UiLanguage): string {
  const copy = COPY[language];
  const lines = [
    copy.started(snapshot.startedAt),
    runDiagnosticsLine(summary, language),
    snapshot.dropped > 0 ? copy.dropped(snapshot.dropped) : "",
    "",
    ...snapshot.events.map((event) => {
      const detail = event.detail === undefined ? "" : ` ${JSON.stringify(event.detail)}`;
      return `${String(event.at).padStart(6, " ")} ms ${event.kind}${event.worker === undefined ? "" : copy.engineWorker(event.worker)}${detail}`;
    }),
  ];
  return lines.filter((line, index) => line !== "" || index === 3).join("\n");
}
