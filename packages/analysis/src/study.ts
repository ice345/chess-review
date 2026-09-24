import type {
  AnyGameAnalysis,
  GamePhase,
  MoveClassification,
  PlayerColor,
  StudyWeaknessKind,
  TrainingEvidenceReference,
} from "@chess-review/shared";

export type StudyGameResult = "win" | "draw" | "loss" | "unknown";

export interface StudyGameInput {
  gameId: string;
  title: string;
  playedAt: string;
  playerColor: PlayerColor;
  result: StudyGameResult;
  analysis: AnyGameAnalysis;
  source?: {
    accountId: string;
    provider: "chesscom" | "lichess";
    timeClass?: string;
    rated?: boolean;
    playerRating?: number;
    opponentRating?: number;
  };
}

export interface StudyTrendPoint {
  gameId: string;
  title: string;
  playedAt: string;
  color: PlayerColor;
  result: StudyGameResult;
  accuracy?: number;
  phaseAccuracy: Partial<Record<GamePhase, number>>;
  errorCount: number;
}

export interface StudyTrendSummary {
  gameCount: number;
  analyzedMoveCount: number;
  averageAccuracy?: number;
  recentAccuracy?: number;
  previousAccuracy?: number;
  accuracyChange?: number;
  phaseAccuracy: Partial<Record<GamePhase, number>>;
  classificationCounts: Partial<Record<MoveClassification, number>>;
}

/** Opening groups used by internal repertoire aggregation and V1→V2 migration tests. */
export interface OpeningRepertoireEntry {
  key: string;
  eco: string;
  name: string;
  variation?: string;
  color: PlayerColor;
  gameCount: number;
  wins: number;
  draws: number;
  losses: number;
  unknownResults: number;
  scoreRate?: number;
  averageAccuracy?: number;
  averageOpeningAccuracy?: number;
  openingErrorCount: number;
  openingMoveCount: number;
  openingErrorRate: number;
  gameIds: string[];
}

export interface RecurringWeakness {
  kind: StudyWeaknessKind;
  gameCount: number;
  incidentCount: number;
  priority: number;
  averageWinPercentLoss: number;
  evidence: TrainingEvidenceReference[];
}

export interface StudyEngineConfiguration {
  stockfishVersion: string;
  depth: number;
  multiPv: number;
  gameCount: number;
}

export interface StudyTrendsSlice {
  summary: StudyTrendSummary;
  games: StudyTrendPoint[];
}

const ERROR_CLASSIFICATIONS = new Set<MoveClassification>([
  "inaccuracy",
  "mistake",
  "blunder",
  "miss",
  "missed_win",
  "missed_mate",
]);

const MISSED_OPPORTUNITIES = new Set<MoveClassification>(["miss", "missed_win", "missed_mate"]);

const SEVERITY: Partial<Record<MoveClassification, number>> = {
  inaccuracy: 1,
  mistake: 2,
  miss: 2,
  blunder: 4,
  missed_win: 4,
  missed_mate: 5,
};

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  return present.length === 0 ? undefined : rounded(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function weaknessKind(phase: GamePhase, classification: MoveClassification): StudyWeaknessKind {
  if (MISSED_OPPORTUNITIES.has(classification)) return "missed-opportunities";
  if (phase === "opening") return "opening-decisions";
  if (phase === "middlegame") return "middlegame-decisions";
  return "endgame-decisions";
}

function resultCounts(games: StudyGameInput[]) {
  return {
    wins: games.filter(({ result }) => result === "win").length,
    draws: games.filter(({ result }) => result === "draw").length,
    losses: games.filter(({ result }) => result === "loss").length,
    unknownResults: games.filter(({ result }) => result === "unknown").length,
  };
}

function buildTrendSummary(games: StudyGameInput[], points: StudyTrendPoint[]): StudyTrendSummary {
  const classifications: Partial<Record<MoveClassification, number>> = {};
  for (const game of games) {
    const player = game.analysis[game.playerColor];
    for (const [classification, count] of Object.entries(player.classificationCounts) as Array<[MoveClassification, number | undefined]>) {
      if (count !== undefined) classifications[classification] = (classifications[classification] ?? 0) + count;
    }
  }
  const accuracies = points.map(({ accuracy }) => accuracy).filter((value): value is number => value !== undefined);
  const comparisonWindow = Math.min(5, Math.floor(accuracies.length / 2));
  const recentAccuracy = comparisonWindow > 0 ? average(accuracies.slice(-comparisonWindow)) : undefined;
  const previousAccuracy = comparisonWindow > 0
    ? average(accuracies.slice(-(comparisonWindow * 2), -comparisonWindow))
    : undefined;
  const averageAccuracy = average(accuracies);
  const phaseAccuracy = Object.fromEntries(
    (["opening", "middlegame", "endgame"] as const).flatMap((phase) => {
      const value = average(points.map((point) => point.phaseAccuracy[phase]));
      return value === undefined ? [] : [[phase, value]];
    }),
  ) as Partial<Record<GamePhase, number>>;

  return {
    gameCount: games.length,
    analyzedMoveCount: games.reduce(
      (count, game) => count + game.analysis.moves.filter(({ color }) => color === game.playerColor).length,
      0,
    ),
    ...(averageAccuracy === undefined ? {} : { averageAccuracy }),
    ...(recentAccuracy === undefined ? {} : { recentAccuracy }),
    ...(previousAccuracy === undefined ? {} : { previousAccuracy }),
    ...(recentAccuracy === undefined || previousAccuracy === undefined
      ? {}
      : { accuracyChange: rounded(recentAccuracy - previousAccuracy) }),
    phaseAccuracy,
    classificationCounts: classifications,
  };
}

/**
 * Cross-game trend points and summary. Private package helper — not part of the
 * public report API (reports go through buildAdvancedStudyReportV2 only).
 */
export function buildStudyTrends(inputGames: StudyGameInput[]): StudyTrendsSlice {
  const games = [...inputGames].sort((left, right) => left.playedAt.localeCompare(right.playedAt) || left.gameId.localeCompare(right.gameId));
  const points: StudyTrendPoint[] = games.map((game) => {
    const player = game.analysis[game.playerColor];
    return {
      gameId: game.gameId,
      title: game.title,
      playedAt: game.playedAt,
      color: game.playerColor,
      result: game.result,
      ...(player.accuracy === undefined ? {} : { accuracy: rounded(player.accuracy) }),
      phaseAccuracy: Object.fromEntries(
        Object.entries(player.phaseAccuracy).map(([phase, value]) => [phase, rounded(value)]),
      ),
      errorCount: game.analysis.moves.filter(({ color, classification }) => (
        color === game.playerColor && ERROR_CLASSIFICATIONS.has(classification)
      )).length,
    };
  });
  return { summary: buildTrendSummary(games, points), games: points };
}

/**
 * Color-specific opening repertoire aggregation. Package-internal; V2 openings
 * replace this for the product report surface.
 */
export function buildOpeningRepertoire(games: StudyGameInput[]): OpeningRepertoireEntry[] {
  const groups = new Map<string, StudyGameInput[]>();
  for (const game of games) {
    const opening = game.analysis.opening;
    if (!opening) continue;
    const key = [game.playerColor, opening.eco, opening.name, opening.variation ?? ""].join("\u0000");
    groups.set(key, [...(groups.get(key) ?? []), game]);
  }

  return [...groups.entries()].map(([key, openingGames]) => {
    const first = openingGames[0]!;
    const opening = first.analysis.opening!;
    const playerMoves = openingGames.flatMap((game) => (
      game.analysis.moves.filter(({ color, phase }) => color === game.playerColor && phase === "opening")
    ));
    const openingErrorCount = playerMoves.filter(({ classification }) => ERROR_CLASSIFICATIONS.has(classification)).length;
    const counts = resultCounts(openingGames);
    const knownResults = counts.wins + counts.draws + counts.losses;
    const averageAccuracy = average(openingGames.map((game) => game.analysis[game.playerColor].accuracy));
    const averageOpeningAccuracy = average(openingGames.map((game) => game.analysis[game.playerColor].phaseAccuracy.opening));
    return {
      key,
      eco: opening.eco,
      name: opening.name,
      ...(opening.variation === undefined ? {} : { variation: opening.variation }),
      color: first.playerColor,
      gameCount: openingGames.length,
      ...counts,
      ...(knownResults === 0 ? {} : { scoreRate: rounded(((counts.wins + counts.draws * 0.5) / knownResults) * 100) }),
      ...(averageAccuracy === undefined ? {} : { averageAccuracy }),
      ...(averageOpeningAccuracy === undefined ? {} : { averageOpeningAccuracy }),
      openingErrorCount,
      openingMoveCount: playerMoves.length,
      openingErrorRate: playerMoves.length === 0 ? 0 : rounded((openingErrorCount / playerMoves.length) * 100),
      gameIds: openingGames.map(({ gameId }) => gameId),
    };
  }).sort((left, right) => right.gameCount - left.gameCount || left.eco.localeCompare(right.eco) || left.name.localeCompare(right.name));
}

/** The evidence rule, applied to one game. Never derived anywhere else. */
function gameWeaknessEvidence(analysis: AnyGameAnalysis, gameId: string, playerColor: PlayerColor): Map<StudyWeaknessKind, TrainingEvidenceReference[]> {
  const groups = new Map<StudyWeaknessKind, TrainingEvidenceReference[]>();
  for (const move of analysis.moves) {
    if (move.color !== playerColor || !ERROR_CLASSIFICATIONS.has(move.classification)) continue;
    const kind = weaknessKind(move.phase, move.classification);
    const evidence: TrainingEvidenceReference = {
      gameId,
      ply: move.ply,
      san: move.san,
      phase: move.phase,
      classification: move.classification,
      winPercentLoss: rounded(move.classificationReason.winPercentLoss),
    };
    groups.set(kind, [...(groups.get(kind) ?? []), evidence]);
  }
  return groups;
}

/** Strongest evidence first, then the later ply, then a stable game order. */
function orderEvidence(evidence: readonly TrainingEvidenceReference[]): TrainingEvidenceReference[] {
  const impact = (item: TrainingEvidenceReference) => (SEVERITY[item.classification] ?? 0) * 100 + item.winPercentLoss;
  return [...evidence].sort((left, right) => (
    impact(right) - impact(left) || right.ply - left.ply || left.gameId.localeCompare(right.gameId)
  ));
}

function weaknessProfile(kind: StudyWeaknessKind, evidence: TrainingEvidenceReference[]): RecurringWeakness {
  const gameCount = new Set(evidence.map(({ gameId }) => gameId)).size;
  const averageLoss = average(evidence.map(({ winPercentLoss }) => winPercentLoss)) ?? 0;
  const averageSeverity = evidence.reduce((sum, item) => sum + (SEVERITY[item.classification] ?? 0), 0) / evidence.length;
  const priority = Math.min(100, Math.round(averageSeverity * 16 + Math.min(40, averageLoss) * 1.3 + Math.min(15, Math.max(0, gameCount - 2) * 5)));
  return { kind, gameCount, incidentCount: evidence.length, priority, averageWinPercentLoss: averageLoss, evidence: orderEvidence(evidence) };
}

/**
 * One game's error positions, grouped by the training weakness they belong to.
 *
 * The recurring-weakness report requires two games before it calls something a
 * pattern. A single reviewed game still produces exact positions worth training,
 * and the end-of-review state offers them with this same rule, so the two paths
 * can never disagree about which positions are evidence.
 */
export function gameTrainingWeaknesses(analysis: AnyGameAnalysis, gameId: string, playerColor: PlayerColor): RecurringWeakness[] {
  return [...gameWeaknessEvidence(analysis, gameId, playerColor).entries()]
    .map(([kind, evidence]) => weaknessProfile(kind, evidence))
    .sort((left, right) => right.priority - left.priority || left.kind.localeCompare(right.kind));
}

/**
 * Recurring weaknesses across games (two-game minimum). Package-internal helper
 * for buildAdvancedStudyReportV2 — not a second public report builder.
 */
export function buildRecurringWeaknesses(games: StudyGameInput[]): RecurringWeakness[] {
  const groups = new Map<StudyWeaknessKind, TrainingEvidenceReference[]>();
  for (const game of games) {
    for (const [kind, evidence] of gameWeaknessEvidence(game.analysis, game.gameId, game.playerColor)) {
      groups.set(kind, [...(groups.get(kind) ?? []), ...evidence]);
    }
  }
  return [...groups.entries()].flatMap(([kind, evidence]) => {
    const gameCount = new Set(evidence.map(({ gameId }) => gameId)).size;
    if (gameCount < 2 || evidence.length < 2) return [];
    return [weaknessProfile(kind, evidence)];
  }).sort((left, right) => right.priority - left.priority || right.gameCount - left.gameCount || left.kind.localeCompare(right.kind));
}

/** Engine configuration histogram. Package-internal for the V2 report. */
export function buildEngineConfigurations(games: StudyGameInput[]): StudyEngineConfiguration[] {
  const configurations = new Map<string, StudyEngineConfiguration>();
  for (const { analysis } of games) {
    const { stockfishVersion, depth, multiPv } = analysis.engine;
    const key = `${stockfishVersion}\u0000${depth}\u0000${multiPv}`;
    const existing = configurations.get(key);
    configurations.set(key, existing
      ? { ...existing, gameCount: existing.gameCount + 1 }
      : { stockfishVersion, depth, multiPv, gameCount: 1 });
  }
  return [...configurations.values()].sort((left, right) => right.gameCount - left.gameCount || right.depth - left.depth || right.multiPv - left.multiPv);
}
