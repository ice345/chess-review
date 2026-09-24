"use client";

import type {
  HistoryAnalysisJobV1,
  StudyWeaknessKind,
  SyncedGame,
} from "@chess-review/shared";
import type { StudyReportFiltersV2 } from "@chess-review/analysis";

export type StudyTab = "overview" | "ratings" | "openings" | "middlegame" | "endgame" | "mistakes" | "highlights" | "plan" | "coverage";

export const NAV_GROUPS: Array<{ id: string; label?: string; tabs: Array<{ id: StudyTab; label: string }> }> = [
  { id: "overview", tabs: [{ id: "overview", label: "Overview" }] },
  { id: "analysis", label: "Analysis", tabs: [
    { id: "ratings", label: "Rating" },
    { id: "openings", label: "Openings" },
    { id: "middlegame", label: "Middlegame" },
    { id: "endgame", label: "Endgame" },
  ] },
  { id: "improvement", label: "Improvement", tabs: [
    { id: "mistakes", label: "Mistakes" },
    { id: "highlights", label: "Highlights" },
    { id: "plan", label: "Plan" },
  ] },
  { id: "data", label: "Data", tabs: [{ id: "coverage", label: "Coverage" }] },
];

export const WEAKNESS_COPY: Record<StudyWeaknessKind, { title: string; description: string }> = {
  "opening-decisions": { title: "Opening decisions", description: "Repeated objective errors in opening positions." },
  "middlegame-decisions": { title: "Middlegame decisions", description: "Repeated objective errors in middlegame positions." },
  "endgame-decisions": { title: "Endgame decisions", description: "Repeated objective errors after the structural endgame boundary." },
  "missed-opportunities": { title: "Missed opportunities", description: "Repeated verified missed-win or missed-mate evidence." },
};

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

export function liveAnalysisStatus(jobs: readonly HistoryAnalysisJobV1[]): string | null {
  const live = jobs.find((job) => !job.supersededBy && ["running", "queued", "paused"].includes(job.status));
  if (!live) return null;
  const counts = detailedJobCounts(live);
  const excluded = live.excludedItems?.length ?? 0;
  const phase = live.status === "running" ? "analysis running" : live.status === "paused" ? "paused" : "waiting to start";
  return `${counts.done} / ${counts.total} games analyzed · ${phase}${excluded > 0 ? ` · ${excluded} excluded` : ""}`;
}

export function gameLabel(gameId: string, games: readonly SyncedGame[]): string {
  const game = games.find((item) => item.id === gameId);
  if (!game) return `Game ${gameId.slice(0, 12)}`;
  return `${game.white.username} vs ${game.black.username} · ${new Date(game.playedAt).toLocaleDateString()}`;
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

export function explainHistoryAnalysisError(error: string): string | null {
  if (/outside MultiPV/i.test(error)) {
    return "This game is legal, but Stockfish did not return a complete line for the played move. Retry to retrieve the missing objective evidence.";
  }
  if (/no scored principal variation|completed line|worker exited/i.test(error)) {
    return "The game passed rules validation, but the engine returned no complete evaluation line. Retry after other browser analysis has stopped.";
  }
  return null;
}

export function scopeLabel(filters: StudyReportFiltersV2, gameCount: number): string {
  const provider = filters.providers.length === 0
    ? "All platforms"
    : filters.providers.map((value) => value === "chesscom" ? "Chess.com" : "Lichess").join(" + ");
  const time = filters.timeClasses.length === 0 ? "All time controls" : filters.timeClasses.join(" + ");
  const color = filters.playerColors.length === 0
    ? "Both colors"
    : filters.playerColors.map((value) => value === "white" ? "White" : "Black").join(" + ");
  const rated = filters.rated === "all" ? "All games" : filters.rated === "rated" ? "Rated" : "Casual";
  const dates = filters.dateFrom || filters.dateTo ? " · Date range" : "";
  return provider + " · " + time + " · " + rated + " · " + color + dates + " · " + gameCount + " games";
}

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
