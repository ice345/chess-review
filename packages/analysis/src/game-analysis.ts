import { Chess } from "chess.js";
import type { NormalizedGame, NormalizedPly, ReplayedUciMove } from "@chess-review/chess-core";
import type {
  ClassificationReason,
  CriticalMoment,
  EngineConsistencyEvidence,
  EngineScore,
  GameAnalysisV2,
  GameDivision,
  MoveAnalysisV2,
  MoveAnnotation,
  MoveClassification,
  MoveQuality,
  ObjectiveVerificationReason,
  OpeningInfo,
  PlayerAnalysisV2,
  PlayerColor,
  StockfishMoveAnalysis,
} from "@chess-review/shared";
import { gameAccuracy, moveAccuracyFromWinPercents, phaseAccuracies, scoreToAccuracyCentipawns } from "./accuracy";
import { classifyMove } from "./classification";
import { divideGame, phaseForPly } from "./divider";
import { detectSacrifice } from "./sacrifice";
import { winPercentFromScore } from "./win-percent";

/**
 * v2.1 changes classification output: a move that preserves the top evaluation
 * now counts as the engine's best choice even when MultiPV ordered it below
 * rank 1 (rank alone labelled tied moves "excellent"), and Static Exchange
 * Evaluation no longer counts an absolutely pinned piece as an attacker or
 * defender (which inflated exchanges and could fabricate sacrifice evidence).
 * Bumping this identity is what makes stored v2.0 analyses recompute instead of
 * being reused with labels the current rules would not produce.
 */
export const OBJECTIVE_ALGORITHM_VERSION = "objective-v2.1";
export const CLASSIFICATION_MULTI_PV = 3;
export const VERIFICATION_POLICY_VERSION = "selective-verification-v1";
export const ENGINE_CONSISTENCY_TOLERANCE_WIN_PERCENT = 5;

const CLASSIFICATIONS: MoveClassification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "interesting",
  "forced",
  "inaccuracy",
  "mistake",
  "blunder",
  "miss",
  "missed_win",
  "missed_mate",
];

const QUALITIES: MoveQuality[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

export interface BuildGameAnalysisInput {
  game: NormalizedGame;
  positionAnalyses: StockfishMoveAnalysis[];
  playedMoveAnalyses?: ReadonlyMap<number, StockfishMoveAnalysis>;
  opening?: OpeningInfo;
  division?: GameDivision;
  stockfishVersion: string;
  depth: number;
  multiPv: number;
  createdAt: string;
  verifiedPlies?: ReadonlySet<number>;
  verificationReasons?: ReadonlyMap<number, readonly ObjectiveVerificationReason[]>;
  requireVerifiedSpecialAnnotations?: boolean;
}

export interface ClassifyExploratoryMoveInput {
  move: ReplayedUciMove;
  rootAnalysis: StockfishMoveAnalysis;
  playedMoveAnalysis?: StockfishMoveAnalysis;
  previousMove?: ReplayedUciMove;
}

export interface ExploratoryMoveClassification {
  quality: MoveQuality;
  annotations: MoveAnnotation[];
  classification: MoveClassification;
  classificationReason: ClassificationReason;
  playedMoveScore: EngineScore;
  playedMoveOutsideMultiPv: boolean;
  accuracy: number;
}

function assertPositionSequence(game: NormalizedGame, analyses: StockfishMoveAnalysis[]): void {
  if (analyses.length !== game.plies.length + 1) {
    throw new Error(`Expected ${game.plies.length + 1} position analyses, received ${analyses.length}.`);
  }
  const expectedFens = [game.initialFen, ...game.plies.map((ply) => ply.fenAfter)];
  for (let index = 0; index < expectedFens.length; index += 1) {
    if (analyses[index]?.fen !== expectedFens[index]) {
      throw new Error(`Position analysis ${index} does not match the normalized game FEN.`);
    }
  }
}

function immediateRecapture(game: NormalizedGame, index: number): boolean {
  const current = game.plies[index];
  const previous = game.plies[index - 1];
  if (!current?.isCapture || !previous?.isCapture) return false;
  return current.uci.slice(2, 4) === previous.uci.slice(2, 4);
}

function trivialCheckEscape(ply: NormalizedPly): boolean {
  return new Chess(ply.fenBefore).inCheck() && ply.legalMoveCountBefore <= 2;
}

function replayedMoveIsCapture(move: ReplayedUciMove): boolean {
  const chess = new Chess(move.fenBefore);
  return chess.move({
    from: move.uci.slice(0, 2),
    to: move.uci.slice(2, 4),
    ...(move.uci[4] === undefined ? {} : { promotion: move.uci[4] }),
  })?.isCapture() ?? false;
}

/**
 * Classifies one temporary analysis-board move with the same objective
 * classifier used by full-game review. The result deliberately omits phase,
 * opening-book and game-summary semantics: an exploratory branch is runtime
 * state, not a mutation of the imported game.
 */
export function classifyExploratoryMove(input: ClassifyExploratoryMoveInput): ExploratoryMoveClassification {
  const { move, rootAnalysis, playedMoveAnalysis } = input;
  if (rootAnalysis.fen !== move.fenBefore) {
    throw new Error("Exploratory move root analysis does not match fenBefore.");
  }
  if (playedMoveAnalysis && playedMoveAnalysis.fen !== move.fenBefore) {
    throw new Error("Exploratory restricted analysis does not match fenBefore.");
  }

  const rootLine = rootAnalysis.lines.find((line) => line.pv[0] === move.uci);
  const playedMoveOutsideMultiPv = rootLine === undefined;
  const playedMoveScore = rootLine?.score ?? playedMoveAnalysis?.score;
  const playedLine = rootLine ?? playedMoveAnalysis?.lines[0];
  if (!playedMoveScore || !playedLine) {
    throw new Error(`Exploratory move ${move.uci} has no root or restricted Stockfish score.`);
  }
  if (playedMoveOutsideMultiPv && !playedMoveAnalysis?.searchMoves?.includes(move.uci)) {
    throw new Error(`Exploratory move ${move.uci} is outside MultiPV and has no matching restricted search.`);
  }

  const before = new Chess(move.fenBefore);
  const color: PlayerColor = before.turn() === "w" ? "white" : "black";
  const legalMoveCount = before.moves().length;
  const previousMove = input.previousMove;
  const isObviousRecapture = previousMove !== undefined
    && replayedMoveIsCapture(previousMove)
    && replayedMoveIsCapture(move)
    && previousMove.uci.slice(2, 4) === move.uci.slice(2, 4);
  const sacrifice = detectSacrifice({
    fenBefore: move.fenBefore,
    fenAfter: move.fenAfter,
    uci: move.uci,
    color,
    scoreBefore: rootAnalysis.score,
    playedMoveScore,
    playedLine,
  });
  const result = classifyMove({
    color,
    scoreBefore: rootAnalysis.score,
    scoreAfter: playedMoveScore,
    ...(rootLine === undefined ? {} : { playedMoveRank: rootLine.rank }),
    ...(rootAnalysis.lines[1]?.score === undefined ? {} : { secondBestScore: rootAnalysis.lines[1].score }),
    legalMoveCount,
    // Temporary branches do not have canonical opening-theory provenance.
    isBook: false,
    isCheckmate: new Chess(move.fenAfter).isCheckmate(),
    isObviousRecapture,
    isTrivialCheckEscape: before.inCheck() && legalMoveCount <= 2,
    playedMoveOutsideMultiPv,
    ...(sacrifice === undefined ? {} : { sacrifice }),
  });

  return {
    quality: result.quality,
    annotations: result.annotations,
    classification: result.classification,
    classificationReason: result.reason,
    playedMoveScore,
    playedMoveOutsideMultiPv,
    accuracy: moveAccuracyFromWinPercents(
      result.reason.winPercentBefore,
      result.reason.winPercentAfter,
    ),
  };
}

function emptyCounts(): Record<MoveClassification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<MoveClassification, number>;
}

function emptyQualityCounts(): Record<MoveQuality, number> {
  return Object.fromEntries(QUALITIES.map((quality) => [quality, 0])) as Record<MoveQuality, number>;
}

function engineConsistency(playedMoveScore: EngineScore, evaluationAfter: EngineScore): EngineConsistencyEvidence {
  const winPercentDelta = Math.abs(winPercentFromScore(playedMoveScore) - winPercentFromScore(evaluationAfter));
  const centipawnDelta = playedMoveScore.kind === "cp" && evaluationAfter.kind === "cp"
    ? Math.abs(playedMoveScore.cp - evaluationAfter.cp)
    : undefined;
  return {
    winPercentDelta,
    ...(centipawnDelta === undefined ? {} : { centipawnDelta }),
    toleranceWinPercent: ENGINE_CONSISTENCY_TOLERANCE_WIN_PERCENT,
    consistent: winPercentDelta <= ENGINE_CONSISTENCY_TOLERANCE_WIN_PERCENT,
  };
}

function verificationReasons(
  classification: ReturnType<typeof classifyMove>,
  consistency: EngineConsistencyEvidence,
  depth: number,
  extra: readonly ObjectiveVerificationReason[],
): ObjectiveVerificationReason[] {
  const reasons = new Set<ObjectiveVerificationReason>(extra);
  if (classification.annotations.some((annotation) => (
    ["critical", "brilliant", "missed_win", "missed_mate"] as MoveAnnotation[]
  ).includes(annotation))) reasons.add("special-annotation");
  if ([2, 5, 10, 20].some((threshold) => Math.abs(classification.reason.winPercentLoss - threshold) <= 1)) {
    reasons.add("quality-threshold-boundary");
  }
  if (!consistency.consistent) reasons.add("played-score-inconsistency");
  if (reasons.size > 0 && depth < 15) reasons.add("low-depth-evidence");
  return [...reasons];
}

function playerAnalysis(
  color: PlayerColor,
  overall: { white: number; black: number } | null,
  phases: { white: PlayerAnalysisV2["phaseAccuracy"]; black: PlayerAnalysisV2["phaseAccuracy"] },
  moves: MoveAnalysisV2[],
): PlayerAnalysisV2 {
  const counts = emptyCounts();
  const qualityCounts = emptyQualityCounts();
  const annotationCounts: Partial<Record<MoveAnnotation, number>> = {};
  for (const move of moves) {
    if (move.color !== color) continue;
    counts[move.classification] += 1;
    qualityCounts[move.quality] += 1;
    for (const annotation of move.annotations) annotationCounts[annotation] = (annotationCounts[annotation] ?? 0) + 1;
  }
  const accuracy = overall?.[color];
  return {
    color,
    ...(accuracy === undefined ? {} : { accuracy }),
    phaseAccuracy: phases[color],
    classificationCounts: counts,
    qualityCounts,
    annotationCounts,
  };
}

function isCritical(move: MoveAnalysisV2): boolean {
  return move.annotations.some((annotation) => ["brilliant", "critical", "missed_win", "missed_mate"].includes(annotation))
    || ["mistake", "blunder"].includes(move.quality)
    || move.classificationReason.winPercentLoss >= 15;
}

export function buildGameAnalysis(input: BuildGameAnalysisInput): GameAnalysisV2 {
  assertPositionSequence(input.game, input.positionAnalyses);
  const division = input.division ?? divideGame(input.game);

  const moves: MoveAnalysisV2[] = input.game.plies.map((ply, index) => {
    const before = input.positionAnalyses[index];
    const after = input.positionAnalyses[index + 1];
    if (!before || !after) throw new Error(`Missing engine analysis for ply ${ply.ply}.`);

    const rootLine = before.lines.find((line) => line.pv[0] === ply.uci);
    const playedOverride = input.playedMoveAnalyses?.get(ply.ply);
    const playedMoveOutsideMultiPv = rootLine === undefined;
    if (playedMoveOutsideMultiPv && !playedOverride) {
      throw new Error(`Played move ${ply.uci} at ply ${ply.ply} is outside MultiPV and has no restricted search.`);
    }
    const playedMoveScore = rootLine?.score ?? playedOverride?.score;
    if (!playedMoveScore) throw new Error(`Missing played-move score at ply ${ply.ply}.`);
    const playedLine = rootLine ?? playedOverride?.lines[0];
    if (!playedLine) throw new Error(`Missing played-move principal variation at ply ${ply.ply}.`);
    const sacrifice = detectSacrifice({
      fenBefore: ply.fenBefore,
      fenAfter: ply.fenAfter,
      uci: ply.uci,
      color: ply.color,
      scoreBefore: before.score,
      playedMoveScore,
      playedLine,
    });
    const classificationInput = {
      color: ply.color,
      scoreBefore: before.score,
      scoreAfter: playedMoveScore,
      ...(rootLine === undefined ? {} : { playedMoveRank: rootLine.rank }),
      ...(before.lines[1]?.score === undefined ? {} : { secondBestScore: before.lines[1].score }),
      legalMoveCount: ply.legalMoveCountBefore,
      isBook: input.opening !== undefined && ply.ply <= input.opening.theoryUntilPly,
      isCheckmate: new Chess(ply.fenAfter).isCheckmate(),
      isObviousRecapture: immediateRecapture(input.game, index),
      isTrivialCheckEscape: trivialCheckEscape(ply),
      playedMoveOutsideMultiPv,
      ...(sacrifice === undefined ? {} : { sacrifice }),
      ...(input.requireVerifiedSpecialAnnotations === true
        ? { specialAnnotationsVerified: input.verifiedPlies?.has(ply.ply) === true }
        : {}),
    } as const;
    const baselineClassification = classifyMove(classificationInput);
    const consistency = engineConsistency(playedMoveScore, after.score);
    const reasons = verificationReasons(
      baselineClassification,
      consistency,
      before.depth,
      input.verificationReasons?.get(ply.ply) ?? [],
    );
    const classification = classifyMove({
      ...classificationInput,
      engineConsistency: consistency,
      ...(reasons.length === 0 ? {} : {
        verification: {
          status: input.verifiedPlies?.has(ply.ply) ? "verified" as const : "baseline" as const,
          depth: before.depth,
          multiPv: before.lines.length,
          reasons,
        },
      }),
    });

    return {
      ply: ply.ply,
      color: ply.color,
      san: ply.san,
      uci: ply.uci,
      fenBefore: ply.fenBefore,
      fenAfter: ply.fenAfter,
      phase: phaseForPly(ply.ply, division),
      evaluationBefore: before.score,
      evaluationAfter: after.score,
      playedMoveScore,
      playedMoveOutsideMultiPv,
      quality: classification.quality,
      annotations: classification.annotations,
      objectiveVersion: "move-quality-v2",
      classification: classification.classification,
      classificationReason: classification.reason,
      stockfish: before,
      accuracy: moveAccuracyFromWinPercents(
        classification.reason.winPercentBefore,
        classification.reason.winPercentAfter,
      ),
      motifs: sacrifice?.genuine === true ? ["sacrifice"] : [],
    };
  });

  const startColor: PlayerColor = input.game.initialFen.split(" ")[1] === "b" ? "black" : "white";
  const afterCps = input.positionAnalyses.slice(1).map((analysis) => scoreToAccuracyCentipawns(analysis.score));
  const overall = gameAccuracy(startColor, afterCps);
  const phases = phaseAccuracies(
    division,
    input.game.plies.map((ply, index) => {
      const analysis = input.positionAnalyses[index + 1];
      if (!analysis) throw new Error(`Missing resulting-position score at ply ${ply.ply}.`);
      return {
        ply: ply.ply,
        color: ply.color,
        centipawns: scoreToAccuracyCentipawns(analysis.score),
      };
    }),
  );
  const criticalMoments: CriticalMoment[] = moves.filter(isCritical).map((move) => ({
    ply: move.ply,
    classification: move.classification,
    winPercentSwing: move.classificationReason.winPercentLoss,
  }));

  return {
    version: 2,
    algorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    game: {
      headers: input.game.headers,
      pgn: input.game.pgn,
      initialFen: input.game.initialFen,
    },
    engine: {
      stockfishVersion: input.stockfishVersion,
      depth: input.depth,
      multiPv: input.multiPv,
      classificationMultiPv: input.multiPv,
      verificationPolicyVersion: VERIFICATION_POLICY_VERSION,
      verifiedMoveCount: input.verifiedPlies?.size ?? 0,
    },
    ...(input.opening === undefined ? {} : { opening: input.opening }),
    division,
    white: playerAnalysis("white", overall, phases, moves),
    black: playerAnalysis("black", overall, phases, moves),
    moves,
    criticalMoments,
    createdAt: input.createdAt,
  };
}
