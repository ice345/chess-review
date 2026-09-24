"use client";

import { PracticeStudyPanel } from "./advanced-study/practice-study-panel";
import { StatsStudyPanel } from "./advanced-study/stats-study-panel";

/**
 * Thin dual-role wrapper kept for existing imports.
 * Routes should compose PracticeStudyPanel or StatsStudyPanel directly.
 */
export function AdvancedStudyPage({ surface = "practice" }: { surface?: "practice" | "stats" } = {}) {
  if (surface === "stats") return <StatsStudyPanel />;
  return <PracticeStudyPanel />;
}

export { PracticeStudyPanel } from "./advanced-study/practice-study-panel";
export { StatsStudyPanel } from "./advanced-study/stats-study-panel";
