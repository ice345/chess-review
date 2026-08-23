import { Chess } from "chess.js";
import type { NormalizedGame, NormalizedPly } from "@chess-review/chess-core";
import type {
  CriticalMoment,
  GameAnalysisV1,
  GameDivision,
  MoveAnalysis,
  MoveClassification,
  OpeningInfo,
  PlayerAnalysis,
  PlayerColor,
  StockfishMoveAnalysis,
} from "@chess-review/shared";
import { gameAccuracy, moveAccuracyFromWinPercents, phaseAccuracies, scoreToAccuracyCentipawns } from "./accuracy";
import { classifyMove } from "./classification";
import { divideGame, phaseForPly } from "./divider";
import { detectSacrifice } from "./sacrifice";

export const OBJECTIVE_ALGORITHM_VERSION = "objective-v1-preview.3";

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

function emptyCounts(): Record<MoveClassification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<MoveClassification, number>;
}

function playerAnalysis(
  color: PlayerColor,
  overall: { white: number; black: number } | null,
  phases: { white: PlayerAnalysis["phaseAccuracy"]; black: PlayerAnalysis["phaseAccuracy"] },
  moves: MoveAnalysis[],
): PlayerAnalysis {
  const counts = emptyCounts();
  for (const move of moves) {
    if (move.color === color) counts[move.classification] += 1;
  }
  const accuracy = overall?.[color];
  return {
    color,
    ...(accuracy === undefined ? {} : { accuracy }),
    phaseAccuracy: phases[color],
    classificationCounts: counts,
  };
}

function isCritical(move: MoveAnalysis): boolean {
  return ["brilliant", "great", "mistake", "blunder", "miss", "missed_win", "missed_mate"].includes(move.classification)
    || move.classificationReason.winPercentLoss >= 15;
}

export function buildGameAnalysis(input: BuildGameAnalysisInput): GameAnalysisV1 {
  assertPositionSequence(input.game, input.positionAnalyses);
  const division = input.division ?? divideGame(input.game);

  const moves: MoveAnalysis[] = input.game.plies.map((ply, index) => {
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
    const classification = classifyMove({
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
    version: 1,
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
