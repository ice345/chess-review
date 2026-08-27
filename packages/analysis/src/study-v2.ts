import type {
  ExternalPlatform,
  GameAnalysisV2,
  GamePhase,
  MoveAnalysisV2,
  MoveAnnotation,
  MoveQuality,
  PlayerColor,
  TrainingEvidenceReference,
} from "@chess-review/shared";
import { buildAdvancedStudyReport, type RecurringWeakness, type StudyGameInput, type StudyGameResult } from "./study";

export const STUDY_ALGORITHM_V2 = "advanced-study-v2";

export interface StudyGameInputV2 extends Omit<StudyGameInput, "analysis"> {
  analysis: GameAnalysisV2;
}

export interface StudyReportFiltersV2 {
  providers: ExternalPlatform[];
  timeClasses: string[];
  rated: "all" | "rated" | "casual";
  playerColors: PlayerColor[];
  openingKeys: string[];
  minimumSampleSize: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface StudyOpeningFilterOptionV2 {
  key: string;
  label: string;
}

export interface StudyCoverageV2 {
  eligibleGames: number;
  analyzedGames: number;
  staleGames: number;
  failedGames: number;
  excludedGames: number;
  approximateCacheBytes?: number;
  providers?: Array<{
    provider: ExternalPlatform;
    eligibleGames: number;
    analyzedGames: number;
    staleGames: number;
    failedGames: number;
  }>;
}

export interface RatingBandV2 {
  key: string;
  provider: ExternalPlatform;
  timeClass: string;
  sampleSize: number;
  currentRating?: number;
  recentRange?: { low: number; high: number };
  scoreRate?: number;
  performanceRating?: number;
  /** Number of games with both an opponent rating and a known result. */
  performanceSampleSize: number;
  confidence: "low" | "medium" | "high";
  /** The nearest 100-point milestone when the current rating is close to it. */
  stabilizeTarget?: number;
  nextTarget?: number;
}

export interface OpeningProfileV2 {
  key: string;
  eco: string;
  name: string;
  variation?: string;
  color: PlayerColor;
  gameCount: number;
  share: number;
  wins: number;
  draws: number;
  losses: number;
  scoreRate?: number;
  averageAccuracy?: number;
  averageWinPercentLoss: number;
  recentScoreRate?: number;
  recentAccuracy?: number;
  errorRate: number;
  representativeGames: string[];
  problemPositions: TrainingEvidenceReference[];
}

export interface PhaseProfileV2 {
  phase: GamePhase;
  moveCount: number;
  errorCount: number;
  errorRate: number;
  averageAccuracy?: number;
  averageWinPercentLoss: number;
  recentAccuracy?: number;
  advantageOpportunities: number;
  advantagePreserved: number;
  defensivePositions: number;
  defensiveHolds: number;
  missedOpportunities: number;
}

export interface StudyMoveEvidenceV2 extends TrainingEvidenceReference {
  quality: MoveQuality;
  annotations: MoveAnnotation[];
  playedAt: string;
}

export interface StudyGameHighlightV2 {
  gameId: string;
  title: string;
  playedAt: string;
  kind: "best-game" | "comeback" | "save" | "clean-conversion";
  accuracy?: number;
  referencePly?: number;
}

export interface WeaknessProfileV2 extends RecurringWeakness {
  sampleSize: number;
  frequency: number;
  confidence: "low" | "medium" | "high";
  trend: "improving" | "stable" | "worsening";
}

export interface TrainingRecommendationV2 {
  rank: number;
  weaknessKind: RecurringWeakness["kind"];
  title: string;
  rationale: string;
  targetPositionCount: number;
  evidence: TrainingEvidenceReference[];
}

export interface AdvancedStudyReportV2 {
  version: 2;
  algorithmVersion: typeof STUDY_ALGORITHM_V2;
  objectiveAlgorithmVersion: string;
  generatedAt: string;
  filters: StudyReportFiltersV2;
  coverage: StudyCoverageV2 & { coverageRate: number; partial: boolean };
  overview: ReturnType<typeof buildAdvancedStudyReport>["trends"] & {
    scoreRate?: number;
    errorRate: number;
    platformDistribution: Array<{ key: ExternalPlatform; gameCount: number; share: number }>;
    timeControlDistribution: Array<{ key: string; gameCount: number; share: number }>;
  };
  ratings: RatingBandV2[];
  openings: OpeningProfileV2[];
  phases: Record<GamePhase, PhaseProfileV2>;
  mistakes: StudyMoveEvidenceV2[];
  specialMoves: StudyMoveEvidenceV2[];
  gameHighlights: StudyGameHighlightV2[];
  weaknesses: WeaknessProfileV2[];
  trainingPlan: TrainingRecommendationV2[];
  engineConfigurations: ReturnType<typeof buildAdvancedStudyReport>["engineConfigurations"];
}

const PHASES: GamePhase[] = ["opening", "middlegame", "endgame"];
const ERROR_QUALITIES = new Set<MoveQuality>(["inaccuracy", "mistake", "blunder"]);
const MISSED_ANNOTATIONS = new Set<MoveAnnotation>(["missed_win", "missed_mate"]);

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | undefined {
  return values.length === 0 ? undefined : rounded(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function score(result: StudyGameResult): number | undefined {
  if (result === "win") return 1;
  if (result === "draw") return 0.5;
  if (result === "loss") return 0;
  return undefined;
}

function confidence(sampleSize: number): "low" | "medium" | "high" {
  if (sampleSize >= 15) return "high";
  if (sampleSize >= 5) return "medium";
  return "low";
}

/**
 * Invert the standard Elo expected-score curve for a matched sample. The
 * result is deliberately bounded: a small streak must not manufacture an
 * extreme performance rating from a 0%/100% score.
 */
export function performanceRatingFromSample(
  opponentRatings: readonly number[],
  scoreRate: number,
): number | undefined {
  if (opponentRatings.length < 5 || !Number.isFinite(scoreRate) || !opponentRatings.every(Number.isFinite)) return undefined;
  const averageOpponent = opponentRatings.reduce((sum, value) => sum + value, 0) / opponentRatings.length;
  const probability = Math.max(0.05, Math.min(0.95, scoreRate / 100));
  const delta = 400 * Math.log10(probability / (1 - probability));
  return Math.round(averageOpponent + Math.max(-400, Math.min(400, delta)));
}

export function ratingTargets(currentRating: number): { stabilizeTarget?: number; nextTarget: number } {
  const milestone = Math.floor(currentRating / 100) * 100 + 100;
  if (milestone - currentRating <= 25) {
    return { stabilizeTarget: milestone, nextTarget: milestone + 100 };
  }
  return { nextTarget: milestone };
}

export function studyGameMatchesFilters(game: StudyGameInputV2, filters: StudyReportFiltersV2): boolean {
  if (filters.providers.length > 0 && (!game.source || !filters.providers.includes(game.source.provider))) return false;
  if (filters.timeClasses.length > 0 && (!game.source?.timeClass || !filters.timeClasses.includes(game.source.timeClass))) return false;
  if (filters.rated === "rated" && game.source?.rated !== true) return false;
  if (filters.rated === "casual" && game.source?.rated !== false) return false;
  if (filters.playerColors.length > 0 && !filters.playerColors.includes(game.playerColor)) return false;
  const openingKey = studyOpeningKeyV2(game);
  if (filters.openingKeys.length > 0 && (!openingKey || !filters.openingKeys.includes(openingKey))) return false;
  if (filters.dateFrom && game.playedAt < filters.dateFrom) return false;
  if (filters.dateTo && game.playedAt > filters.dateTo) return false;
  return true;
}

export function studyOpeningKeyV2(game: StudyGameInputV2): string | null {
  const opening = game.analysis.opening;
  return opening
    ? [game.playerColor, opening.eco, opening.name, opening.variation ?? ""].join("|")
    : null;
}

export function listStudyOpeningFilterOptionsV2(
  games: readonly StudyGameInputV2[],
): StudyOpeningFilterOptionV2[] {
  const options = new Map<string, string>();
  for (const game of games) {
    const key = studyOpeningKeyV2(game);
    const opening = game.analysis.opening;
    if (!key || !opening) continue;
    options.set(key, `${game.playerColor === "white" ? "White" : "Black"} · ${opening.eco} · ${opening.name}${opening.variation ? ` · ${opening.variation}` : ""}`);
  }
  return [...options.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function playerMoves(game: StudyGameInputV2): MoveAnalysisV2[] {
  return game.analysis.moves.filter((move) => move.color === game.playerColor);
}

function evidence(game: StudyGameInputV2, move: MoveAnalysisV2): StudyMoveEvidenceV2 {
  return {
    gameId: game.gameId,
    ply: move.ply,
    san: move.san,
    phase: move.phase,
    classification: move.classification,
    winPercentLoss: move.classificationReason.winPercentLoss,
    quality: move.quality,
    annotations: move.annotations,
    playedAt: game.playedAt,
  };
}

function ratingBands(games: StudyGameInputV2[], minimumSampleSize: number): RatingBandV2[] {
  const grouped = new Map<string, StudyGameInputV2[]>();
  for (const game of games) {
    if (!game.source?.timeClass) continue;
    const key = `${game.source.provider}:${game.source.timeClass}`;
    const group = grouped.get(key) ?? [];
    group.push(game);
    grouped.set(key, group);
  }
  return [...grouped.entries()].filter(([, group]) => group.length >= minimumSampleSize).map(([key, group]) => {
    const ordered = [...group].sort((left, right) => left.playedAt.localeCompare(right.playedAt));
    const rated = ordered.filter((game) => game.source?.playerRating !== undefined);
    const recentRatings = rated.slice(-10).map((game) => game.source!.playerRating!);
    const outcomes = ordered.map((game) => score(game.result)).filter((value): value is number => value !== undefined);
    const scoreRate = outcomes.length === 0 ? undefined : rounded(outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length * 100);
    // Performance must use one and the same population for the opponent Elo
    // and the result. A missing result or opponent rating excludes that game
    // from both sides of the estimate.
    const performanceGames = ordered.filter((game) => (
      score(game.result) !== undefined
      && game.source?.opponentRating !== undefined
      && Number.isFinite(game.source.opponentRating)
    ));
    const performanceOutcomes = performanceGames
      .map((game) => score(game.result))
      .filter((value): value is number => value !== undefined);
    const performanceScoreRate = performanceOutcomes.length === 0
      ? undefined
      : rounded(performanceOutcomes.reduce((sum, value) => sum + value, 0) / performanceOutcomes.length * 100);
    const opponentRatings = performanceGames.map((game) => game.source!.opponentRating!);
    const performanceRating = performanceScoreRate === undefined
      ? undefined
      : performanceRatingFromSample(opponentRatings, performanceScoreRate);
    const currentRating = rated.at(-1)?.source?.playerRating;
    const bandConfidence = confidence(Math.min(ordered.length, rated.length));
    const targets = currentRating === undefined || bandConfidence === "low" ? undefined : ratingTargets(currentRating);
    return {
      key,
      provider: ordered[0]!.source!.provider,
      timeClass: ordered[0]!.source!.timeClass!,
      sampleSize: ordered.length,
      ...(currentRating === undefined ? {} : { currentRating }),
      ...(recentRatings.length === 0 ? {} : { recentRange: { low: Math.min(...recentRatings), high: Math.max(...recentRatings) } }),
      ...(scoreRate === undefined ? {} : { scoreRate }),
      ...(performanceRating === undefined ? {} : { performanceRating }),
      performanceSampleSize: performanceGames.length,
      confidence: bandConfidence,
      ...(targets === undefined ? {} : targets),
    };
  }).sort((left, right) => left.provider.localeCompare(right.provider) || left.timeClass.localeCompare(right.timeClass));
}

function openingProfiles(games: StudyGameInputV2[], minimumSampleSize: number): OpeningProfileV2[] {
  const grouped = new Map<string, StudyGameInputV2[]>();
  for (const game of games) {
    const opening = game.analysis.opening;
    if (!opening) continue;
    const key = studyOpeningKeyV2(game)!;
    const group = grouped.get(key) ?? [];
    group.push(game);
    grouped.set(key, group);
  }
  return [...grouped.entries()].filter(([, group]) => group.length >= minimumSampleSize).map(([key, group]) => {
    const first = group[0]!;
    const opening = first.analysis.opening!;
    const outcomes = group.map((game) => score(game.result)).filter((value): value is number => value !== undefined);
    const moves = group.flatMap(playerMoves).filter((move) => move.phase === "opening");
    const errors = moves.filter((move) => ERROR_QUALITIES.has(move.quality));
    const recent = [...group].sort((left, right) => left.playedAt.localeCompare(right.playedAt)).slice(-5);
    const recentOutcomes = recent.map((game) => score(game.result)).filter((value): value is number => value !== undefined);
    return {
      key,
      eco: opening.eco,
      name: opening.name,
      ...(opening.variation === undefined ? {} : { variation: opening.variation }),
      color: first.playerColor,
      gameCount: group.length,
      share: rounded(group.length / games.length * 100),
      wins: group.filter((game) => game.result === "win").length,
      draws: group.filter((game) => game.result === "draw").length,
      losses: group.filter((game) => game.result === "loss").length,
      ...(outcomes.length === 0 ? {} : { scoreRate: rounded(outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length * 100) }),
      ...(average(group.flatMap((game) => game.analysis[game.playerColor].accuracy ?? [])) === undefined
        ? {}
        : { averageAccuracy: average(group.flatMap((game) => game.analysis[game.playerColor].accuracy ?? []))! }),
      averageWinPercentLoss: average(moves.map((move) => move.classificationReason.winPercentLoss)) ?? 0,
      ...(recentOutcomes.length === 0 ? {} : { recentScoreRate: rounded(recentOutcomes.reduce((sum, value) => sum + value, 0) / recentOutcomes.length * 100) }),
      ...(average(recent.flatMap((game) => game.analysis[game.playerColor].accuracy ?? [])) === undefined
        ? {}
        : { recentAccuracy: average(recent.flatMap((game) => game.analysis[game.playerColor].accuracy ?? []))! }),
      errorRate: moves.length === 0 ? 0 : rounded(errors.length / moves.length * 100),
      representativeGames: [...group].sort((left, right) => right.playedAt.localeCompare(left.playedAt)).slice(0, 3).map((game) => game.gameId),
      problemPositions: group.flatMap((game) => playerMoves(game)
        .filter((move) => move.phase === "opening" && ERROR_QUALITIES.has(move.quality))
        .map((move) => evidence(game, move)))
        .sort((left, right) => right.winPercentLoss - left.winPercentLoss)
        .slice(0, 3),
    };
  }).sort((left, right) => right.gameCount - left.gameCount || right.averageWinPercentLoss - left.averageWinPercentLoss);
}

function phaseProfiles(games: StudyGameInputV2[]): Record<GamePhase, PhaseProfileV2> {
  return Object.fromEntries(PHASES.map((phase) => {
    const phaseMoves = games.flatMap((game) => playerMoves(game).map((move) => ({ game, move })))
      .filter(({ move }) => move.phase === phase);
    const recentCutoff = [...games].sort((left, right) => left.playedAt.localeCompare(right.playedAt)).slice(-5);
    const recentMoves = recentCutoff.flatMap(playerMoves).filter((move) => move.phase === phase);
    const errors = phaseMoves.filter(({ move }) => ERROR_QUALITIES.has(move.quality));
    const advantages = phaseMoves.filter(({ move }) => move.classificationReason.winPercentBefore >= 70);
    const defensive = phaseMoves.filter(({ move }) => move.classificationReason.winPercentBefore <= 30);
    const profile: PhaseProfileV2 = {
      phase,
      moveCount: phaseMoves.length,
      errorCount: errors.length,
      errorRate: phaseMoves.length === 0 ? 0 : rounded(errors.length / phaseMoves.length * 100),
      ...(average(phaseMoves.map(({ move }) => move.accuracy)) === undefined ? {} : { averageAccuracy: average(phaseMoves.map(({ move }) => move.accuracy))! }),
      averageWinPercentLoss: average(phaseMoves.map(({ move }) => move.classificationReason.winPercentLoss)) ?? 0,
      ...(average(recentMoves.map((move) => move.accuracy)) === undefined ? {} : { recentAccuracy: average(recentMoves.map((move) => move.accuracy))! }),
      advantageOpportunities: advantages.length,
      advantagePreserved: advantages.filter(({ move }) => move.classificationReason.winPercentAfter >= 65).length,
      defensivePositions: defensive.length,
      defensiveHolds: defensive.filter(({ move }) => move.classificationReason.winPercentAfter >= move.classificationReason.winPercentBefore - 2).length,
      missedOpportunities: phaseMoves.filter(({ move }) => move.annotations.some((annotation) => MISSED_ANNOTATIONS.has(annotation))).length,
    };
    return [phase, profile];
  })) as Record<GamePhase, PhaseProfileV2>;
}

function gameHighlights(games: StudyGameInputV2[]): StudyGameHighlightV2[] {
  const highlights: StudyGameHighlightV2[] = [];
  for (const game of games) {
    const moves = playerMoves(game);
    const accuracy = game.analysis[game.playerColor].accuracy;
    if (moves.length >= 10 && accuracy !== undefined) highlights.push({
      gameId: game.gameId, title: game.title, playedAt: game.playedAt, kind: "best-game", accuracy,
    });
    const low = moves.find((move) => move.classificationReason.winPercentBefore <= 20);
    if (low && game.result === "win") highlights.push({
      gameId: game.gameId, title: game.title, playedAt: game.playedAt, kind: "comeback", ...(accuracy === undefined ? {} : { accuracy }), referencePly: low.ply,
    });
    if (low && game.result === "draw") highlights.push({
      gameId: game.gameId, title: game.title, playedAt: game.playedAt, kind: "save", ...(accuracy === undefined ? {} : { accuracy }), referencePly: low.ply,
    });
    const winning = moves.findIndex((move) => move.classificationReason.winPercentBefore >= 75);
    if (winning >= 0 && game.result === "win" && moves.slice(winning).every((move) => move.classificationReason.winPercentLoss < 5)) {
      highlights.push({
        gameId: game.gameId, title: game.title, playedAt: game.playedAt, kind: "clean-conversion", ...(accuracy === undefined ? {} : { accuracy }), referencePly: moves[winning]!.ply,
      });
    }
  }
  const order: Record<StudyGameHighlightV2["kind"], number> = { comeback: 0, save: 1, "clean-conversion": 2, "best-game": 3 };
  return highlights.sort((left, right) => order[left.kind] - order[right.kind]
    || (right.accuracy ?? 0) - (left.accuracy ?? 0)
    || right.playedAt.localeCompare(left.playedAt)).slice(0, 24);
}

function weaknessProfiles(
  games: StudyGameInputV2[],
  weaknesses: RecurringWeakness[],
  minimumSampleSize: number,
): WeaknessProfileV2[] {
  const ordered = [...games].sort((left, right) => left.playedAt.localeCompare(right.playedAt));
  const midpoint = Math.ceil(ordered.length / 2);
  return weaknesses.filter((weakness) => weakness.gameCount >= Math.max(2, minimumSampleSize)).map((weakness) => {
    const earlyIds = new Set(ordered.slice(0, midpoint).map((game) => game.gameId));
    const lateIds = new Set(ordered.slice(midpoint).map((game) => game.gameId));
    const early = weakness.evidence.filter((item) => earlyIds.has(item.gameId)).length / Math.max(1, earlyIds.size);
    const late = weakness.evidence.filter((item) => lateIds.has(item.gameId)).length / Math.max(1, lateIds.size);
    return {
      ...weakness,
      sampleSize: games.length,
      frequency: games.length === 0 ? 0 : rounded(weakness.gameCount / games.length * 100),
      confidence: confidence(weakness.gameCount),
      trend: late > early + 0.1 ? "worsening" : late < early - 0.1 ? "improving" : "stable",
    };
  });
}

function trainingPlan(weaknesses: WeaknessProfileV2[]): TrainingRecommendationV2[] {
  const titles: Record<RecurringWeakness["kind"], string> = {
    "opening-decisions": "Repair recurring opening decisions",
    "middlegame-decisions": "Calculate critical middlegame choices",
    "endgame-decisions": "Practice structural endgame decisions",
    "missed-opportunities": "Convert objective opportunities",
  };
  return weaknesses.slice(0, 3).map((weakness, index) => ({
    rank: index + 1,
    weaknessKind: weakness.kind,
    title: titles[weakness.kind],
    rationale: `${weakness.incidentCount} incidents across ${weakness.gameCount} games; ${weakness.trend} recent frequency.`,
    targetPositionCount: Math.min(5, weakness.evidence.length),
    evidence: weakness.evidence.slice(0, 5),
  }));
}

export function buildAdvancedStudyReportV2(
  inputs: readonly StudyGameInputV2[],
  filters: StudyReportFiltersV2,
  coverage?: StudyCoverageV2,
  generatedAt = new Date().toISOString(),
): AdvancedStudyReportV2 {
  const minimumSampleSize = Math.max(1, Math.floor(filters.minimumSampleSize));
  const games = inputs
    .filter((game) => game.analysis.version === 2)
    .filter((game) => studyGameMatchesFilters(game, filters))
    .sort((left, right) => left.playedAt.localeCompare(right.playedAt));
  const objectiveVersions = new Set(games.map((game) => game.analysis.algorithmVersion));
  if (objectiveVersions.size > 1) throw new Error("One player-intelligence report cannot mix objective algorithm versions.");
  const legacy = buildAdvancedStudyReport(games);
  const resolvedCoverage = coverage ?? {
    eligibleGames: games.length,
    analyzedGames: games.length,
    staleGames: 0,
    failedGames: 0,
    excludedGames: Math.max(0, inputs.length - games.length),
  };
  const coverageRate = resolvedCoverage.eligibleGames === 0
    ? 0
    : rounded(resolvedCoverage.analyzedGames / resolvedCoverage.eligibleGames * 100);
  const mistakes = games.flatMap((game) => playerMoves(game)
    .filter((move) => ERROR_QUALITIES.has(move.quality) || move.annotations.some((annotation) => MISSED_ANNOTATIONS.has(annotation)))
    .map((move) => evidence(game, move)))
    .sort((left, right) => right.winPercentLoss - left.winPercentLoss || right.playedAt.localeCompare(left.playedAt));
  const specialMoves = games.flatMap((game) => playerMoves(game)
    .filter((move) => move.classificationReason.verification?.status === "verified"
      && move.annotations.some((annotation) => annotation === "brilliant" || annotation === "critical"))
    .map((move) => evidence(game, move)))
    .sort((left, right) => right.winPercentLoss - left.winPercentLoss || right.playedAt.localeCompare(left.playedAt));
  const weaknesses = weaknessProfiles(games, legacy.weaknesses, minimumSampleSize);
  const knownResults = games.map((game) => score(game.result)).filter((value): value is number => value !== undefined);
  const allPlayerMoves = games.flatMap(playerMoves);
  const errorCount = allPlayerMoves.filter((move) => ERROR_QUALITIES.has(move.quality)).length;
  const distribution = <T extends string>(values: T[]): Array<{ key: T; gameCount: number; share: number }> => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .map(([key, gameCount]) => ({ key, gameCount, share: games.length === 0 ? 0 : rounded(gameCount / games.length * 100) }))
      .sort((left, right) => right.gameCount - left.gameCount || left.key.localeCompare(right.key));
  };
  return {
    version: 2,
    algorithmVersion: STUDY_ALGORITHM_V2,
    objectiveAlgorithmVersion: [...objectiveVersions][0] ?? "no-compatible-games",
    generatedAt,
    filters: {
      ...filters,
      providers: [...filters.providers],
      timeClasses: [...filters.timeClasses],
      playerColors: [...filters.playerColors],
      openingKeys: [...filters.openingKeys],
      minimumSampleSize,
    },
    coverage: {
      ...resolvedCoverage,
      coverageRate,
      partial: resolvedCoverage.analyzedGames < resolvedCoverage.eligibleGames || resolvedCoverage.staleGames > 0 || resolvedCoverage.failedGames > 0,
    },
    overview: {
      ...legacy.trends,
      ...(knownResults.length === 0 ? {} : { scoreRate: rounded(knownResults.reduce((sum, value) => sum + value, 0) / knownResults.length * 100) }),
      errorRate: allPlayerMoves.length === 0 ? 0 : rounded(errorCount / allPlayerMoves.length * 100),
      platformDistribution: distribution(games.flatMap((game) => game.source?.provider ?? [])),
      timeControlDistribution: distribution(games.flatMap((game) => game.source?.timeClass ?? [])),
    },
    ratings: ratingBands(games, minimumSampleSize),
    openings: openingProfiles(games, minimumSampleSize),
    phases: phaseProfiles(games),
    mistakes: mistakes.slice(0, 100),
    specialMoves: specialMoves.slice(0, 100),
    gameHighlights: gameHighlights(games),
    weaknesses,
    trainingPlan: trainingPlan(weaknesses),
    engineConfigurations: legacy.engineConfigurations,
  };
}
