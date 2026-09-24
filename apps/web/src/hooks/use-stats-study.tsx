"use client";

import { useEffect, useState } from "react";
import type { StudyTab } from "../components/advanced-study/study-helpers";
import { useAdvancedStudyCore } from "./use-advanced-study-core";

/**
 * Stats Growth view-model: report tabs, phase/highlight furniture, coverage controls.
 * Practice chapter / today-task furniture stays on usePracticeStudy.
 */
export function useStatsStudy() {
  const core = useAdvancedStudyCore();
  const { report, availableGames } = core;
  const [activeTab, setActiveTab] = useState<StudyTab>("overview");
  const [listLimit, setListLimit] = useState(12);

  useEffect(() => {
    setListLimit(12);
  }, [activeTab]);

  function selectView(tab: StudyTab) {
    setActiveTab(tab);
  }

  const primaryRating = report?.ratings.slice().sort((left, right) => right.sampleSize - left.sampleSize)[0];
  const phaseEntries = report
    ? (["opening", "middlegame", "endgame"] as const).map((phase) => ({ phase, profile: report.phases[phase] }))
    : [];
  const observedPhases = phaseEntries.filter(({ profile }) => profile.moveCount > 0);
  const strongestPhase = observedPhases.slice().sort((left, right) => (right.profile.averageAccuracy ?? 0) - (left.profile.averageAccuracy ?? 0))[0];
  const needsWorkPhase = observedPhases.slice().sort((left, right) => right.profile.errorRate - left.profile.errorRate || (left.profile.averageAccuracy ?? 0) - (right.profile.averageAccuracy ?? 0))[0];
  const highlightCounts = report ? {
    brilliant: report.specialMoves.filter((item) => item.annotations.includes("brilliant")).length,
    critical: report.specialMoves.filter((item) => item.annotations.includes("critical")).length,
    comebacks: report.gameHighlights.filter((item) => item.kind === "comeback").length,
    saves: report.gameHighlights.filter((item) => item.kind === "save").length,
    conversions: report.gameHighlights.filter((item) => item.kind === "clean-conversion").length,
  } : null;
  const brilliantMoves = report?.specialMoves.filter((item) => item.annotations.includes("brilliant")) ?? [];
  const criticalMoves = report?.specialMoves.filter((item) => item.annotations.includes("critical")) ?? [];
  // Stats shows the report whenever the player population has any analyzed games.
  const showStudyReport = availableGames > 0;

  return {
    ...core,
    activeTab,
    selectView,
    listLimit,
    setListLimit,
    primaryRating,
    phaseEntries,
    observedPhases,
    strongestPhase,
    needsWorkPhase,
    highlightCounts,
    brilliantMoves,
    criticalMoves,
    showStudyReport,
    surface: "stats" as const,
  } as const;
}

export type StatsStudyModel = ReturnType<typeof useStatsStudy>;
