"use client";

import { practiceChapterProgress } from "../lib/practice-chapter";
import { todaysTrainingTask } from "../lib/training-queue";
import { useAdvancedStudyCore } from "./use-advanced-study-core";

/**
 * Practice hub view-model: chapter progress, today task, rehearsal entry.
 * Does not build Stats report furniture (tabs, phase cards, highlights).
 */
export function usePracticeStudy() {
  const core = useAdvancedStudyCore();
  const {
    focusedTaskId,
    player,
    playerKey,
    queue,
    report,
    summaries,
    todayState,
    sourcesFailed,
    availableGames,
  } = core;

  const focusedTask = focusedTaskId === "" ? undefined : queue.find((item) => item.id === focusedTaskId);
  const todayTask = focusedTask && focusedTask.status !== "completed" ? focusedTask : todaysTrainingTask(queue);
  const importedGameCount = summaries?.find((summary) => summary.key === playerKey)?.gameCount
    ?? (player?.games.length ?? 0);
  const analyzedGameCount = player?.games.length ?? 0;
  const mistakeCount = report?.mistakes.length ?? 0;
  const weaknessCount = report?.weaknesses.length ?? 0;
  const chapter = practiceChapterProgress({
    importedGameCount,
    analyzedGameCount,
    mistakeCount,
    weaknessCount,
    queue,
    hasTodayTask: Boolean(todayTask),
    queueState: todayState,
    sourcesFailed,
  });
  const lastAnalyzedReviewHref = player?.games.at(-1)
    ? `/review/${player.games.at(-1)!.gameId}`
    : undefined;
  // Practice opens when there is a today task or enough analyzed games to train.
  const showStudyReport = Boolean(todayTask) || availableGames >= 5;

  return {
    ...core,
    focusedTask,
    todayTask,
    importedGameCount,
    analyzedGameCount,
    mistakeCount,
    weaknessCount,
    chapter,
    lastAnalyzedReviewHref,
    showStudyReport,
    surface: "practice" as const,
  } as const;
}

export type PracticeStudyModel = ReturnType<typeof usePracticeStudy>;
