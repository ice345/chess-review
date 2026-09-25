import type { GamePhase, UiLanguage } from "@chess-review/shared";

/**
 * The names of the three game phases, per interface language.
 *
 * Phases come from the Divider port (docs/game-phases.md), not from move numbers.
 * Their names appear on the evaluation graph, the phase-accuracy breakdown and the
 * completion sentence, so - like the classification names - they live in one table
 * in the package that owns the review's visual language, not in each screen.
 */
export const PHASE_LABELS: Record<UiLanguage, Record<GamePhase, string>> = {
  en: { opening: "Opening", middlegame: "Middlegame", endgame: "Endgame" },
  "zh-CN": { opening: "开局", middlegame: "中局", endgame: "残局" },
};

export function phaseLabel(phase: GamePhase, language: UiLanguage): string {
  return PHASE_LABELS[language][phase];
}
