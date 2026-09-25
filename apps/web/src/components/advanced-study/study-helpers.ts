"use client";

import type {
  HistoryAnalysisJobV1,
  UiLanguage,
} from "@chess-review/shared";
import type { StudyReportFiltersV2 } from "@chess-review/analysis";

export type StudyTab = "overview" | "ratings" | "openings" | "middlegame" | "endgame" | "mistakes" | "highlights" | "plan" | "coverage";

export const NAV_GROUPS: Array<{ id: string; tabs: Array<{ id: StudyTab }> }> = [
  { id: "overview", tabs: [{ id: "overview" }] },
  { id: "analysis", tabs: [
    { id: "ratings" },
    { id: "openings" },
    { id: "middlegame" },
    { id: "endgame" },
  ] },
  { id: "improvement", tabs: [
    { id: "mistakes" },
    { id: "highlights" },
    { id: "plan" },
  ] },
  { id: "data", tabs: [{ id: "coverage" }] },
];

export const DEFAULT_FILTERS: StudyReportFiltersV2 = {
  providers: [],
  timeClasses: [],
  rated: "all",
  playerColors: [],
  openingKeys: [],
  minimumSampleSize: 1,
};

export function formatted(value: number | undefined, suffix = ""): string {
  return value === undefined ? "—" : `${value.toFixed(1)}${suffix}`;
}

export function detailedJobCounts(job: HistoryAnalysisJobV1) {
  const cached = job.items.filter((item) => item.status === "cached").length;
  const completed = job.items.filter((item) => item.status === "completed").length;
  const failed = job.items.filter((item) => item.status === "failed").length;
  const pending = job.items.filter((item) => item.status === "queued" || item.status === "running").length;
  return { cached, completed, failed, pending, done: cached + completed, total: job.items.length };
}

type StatusCopy = {
  running: string;
  paused: string;
  waiting: string;
  line: (done: number, total: number, phase: string, excluded: number) => string;
};

const STATUS_COPY: Record<UiLanguage, StatusCopy> = {
  en: {
    running: "analysis running",
    paused: "paused",
    waiting: "waiting to start",
    line: (done, total, phase, excluded) => `${done} / ${total} games analyzed · ${phase}${excluded > 0 ? ` · ${excluded} excluded` : ""}`,
  },
  "zh-CN": {
    running: "分析进行中",
    paused: "已暂停",
    waiting: "等待开始",
    line: (done, total, phase, excluded) => `${done} / ${total} 盘已分析 · ${phase}${excluded > 0 ? ` · ${excluded} 盘已排除` : ""}`,
  },
};

export function liveAnalysisStatus(jobs: readonly HistoryAnalysisJobV1[], language: UiLanguage = "en"): string | null {
  const live = jobs.find((job) => !job.supersededBy && ["running", "queued", "paused"].includes(job.status));
  if (!live) return null;
  const counts = detailedJobCounts(live);
  const excluded = live.excludedItems?.length ?? 0;
  const copy = STATUS_COPY[language];
  const phase = live.status === "running" ? copy.running : live.status === "paused" ? copy.paused : copy.waiting;
  return copy.line(counts.done, counts.total, phase, excluded);
}

export function historyJobSignature(job: HistoryAnalysisJobV1): string {
  return JSON.stringify({
    scope: job.scope,
    depth: job.depth,
    objectiveAlgorithmVersion: job.objectiveAlgorithmVersion,
    classificationMultiPv: job.classificationMultiPv,
    games: job.items.map((item) => item.gameId).sort(),
  });
}

export function collapseHistoryJobs(jobs: readonly HistoryAnalysisJobV1[]): Array<{ job: HistoryAnalysisJobV1; duplicateCount: number }> {
  const groups = new Map<string, { job: HistoryAnalysisJobV1; duplicateCount: number }>();
  for (const job of jobs) {
    const key = historyJobSignature(job);
    const existing = groups.get(key);
    if (existing) existing.duplicateCount += 1;
    else groups.set(key, { job, duplicateCount: 0 });
  }
  return [...groups.values()];
}

export type HistoryJobAction = "pause" | "resume" | "cancel" | "retry";

export function historyJobPresentation(groups: Array<{ job: HistoryAnalysisJobV1; duplicateCount: number }>) {
  const current = groups.filter(({ job }) => !job.supersededBy);
  const active = current.filter(({ job }) => ["running", "queued", "paused"].includes(job.status));
  const errors = current.filter(({ job }) => job.status === "failed");
  const latestFinished = current.find(({ job }) => job.status === "completed" || job.status === "cancelled");
  const prominentIds = new Set([
    ...active.map(({ job }) => job.id),
    ...errors.map(({ job }) => job.id),
    ...(latestFinished ? [latestFinished.job.id] : []),
  ]);
  return {
    prominent: current.filter(({ job }) => prominentIds.has(job.id)),
    past: groups.filter(({ job }) => !prominentIds.has(job.id)),
  };
}
