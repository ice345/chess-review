import { expect, it } from "vitest";
import { judgePracticeScore, practiceHumanComparison, practiceMoves, practiceQueue } from "./mistake-practice";
import { parsePgn } from "@chess-review/chess-core";
import type { MoveAnalysisV2 } from "@chess-review/shared";

it('accepts near-best alternatives for either color using White POV', () => {
  expect(judgePracticeScore({ kind: 'cp', cp: 100 }, { kind: 'cp', cp: 90 }, 'white').accepted).toBe(true);
  expect(judgePracticeScore({ kind: 'cp', cp: -100 }, { kind: 'cp', cp: -90 }, 'black').accepted).toBe(true);
  expect(judgePracticeScore({ kind: 'cp', cp: -100 }, { kind: 'cp', cp: 100 }, 'black').accepted).toBe(false);
});
it('pins the Lichess-aligned four-point practice tolerance', () => {
  // These two pairs straddle the threshold (3.73 versus 4.15 mover WinPercent
  // points), so the comparative relaxation from 2 to 4 cannot drift unnoticed.
  expect(judgePracticeScore({ kind: 'cp', cp: 200 }, { kind: 'cp', cp: 155 }, 'white')).toMatchObject({ accepted: true, reason: 'near-best' });
  expect(judgePracticeScore({ kind: 'cp', cp: 200 }, { kind: 'cp', cp: 150 }, 'white')).toMatchObject({ accepted: false, reason: 'too-costly' });
  // Black mirrors the same tolerance from the other point of view.
  expect(judgePracticeScore({ kind: 'cp', cp: -200 }, { kind: 'cp', cp: -155 }, 'black')).toMatchObject({ accepted: true, reason: 'near-best' });
  expect(judgePracticeScore({ kind: 'cp', cp: -200 }, { kind: 'cp', cp: -150 }, 'black')).toMatchObject({ accepted: false, reason: 'too-costly' });
});
it('does not flatten mate preservation into saturated winning chances', () => {
  expect(judgePracticeScore({ kind: 'mate', mateIn: 3 }, { kind: 'cp', cp: 1500 }, 'white').reason).toBe('lost-mate');
  expect(judgePracticeScore({ kind: 'mate', mateIn: -3 }, { kind: 'cp', cp: -1500 }, 'black').reason).toBe('lost-mate');
  expect(judgePracticeScore({ kind: 'mate', mateIn: 3 }, { kind: 'mate', mateIn: 5 }, 'white').accepted).toBe(true);
});
it('rejects allowing mate even when both numeric winning chances are saturated', () => {
  expect(judgePracticeScore({ kind: 'cp', cp: -1500 }, { kind: 'mate', mateIn: -3 }, 'white').reason).toBe('allows-mate');
});
it('selects only the requested side with a legal alternative and consistent root evidence', () => {
  const ply = parsePgn('1. e4 e5 *').plies[0]!;
  const move = { ...ply, quality: 'mistake', annotations: [], classificationReason: { isBook: false }, stockfish: { fen: ply.fenBefore, bestMove: 'd2d4', score: { kind: 'cp', cp: 100 }, lines: [], depth: 12 } } satisfies Pick<MoveAnalysisV2, 'color' | 'quality' | 'annotations' | 'stockfish' | 'fenBefore' | 'uci'> & { classificationReason: { isBook: boolean } };
  expect(practiceMoves([move], 'white')).toHaveLength(1);
  expect(practiceMoves([move], 'black')).toHaveLength(0);
  expect(practiceMoves([{ ...move, quality: 'inaccuracy' }], 'white')).toHaveLength(0);
  expect(practiceMoves([{ ...move, quality: 'inaccuracy' }], 'white', true)).toHaveLength(1);
  expect(practiceMoves([{ ...move, quality: 'good', annotations: ['missed_mate'] }], 'white')).toHaveLength(1);
  for (const bestMove of ['e2e4', 'e2e5', '']) expect(practiceMoves([{ ...move, stockfish: { ...move.stockfish, bestMove } }], 'white')).toHaveLength(0);
  expect(practiceMoves([{ ...move, stockfish: { ...move.stockfish, fen: ply.fenAfter } }], 'white')).toHaveLength(0);
});

it('skips a move that is still recognised opening theory', () => {
  const ply = parsePgn('1. e4 e5 *').plies[0]!;
  const move = { ...ply, quality: 'mistake', annotations: [], classificationReason: { isBook: true }, stockfish: { fen: ply.fenBefore, bestMove: 'd2d4', score: { kind: 'cp', cp: 100 }, lines: [], depth: 12 } } satisfies Pick<MoveAnalysisV2, 'color' | 'quality' | 'annotations' | 'stockfish' | 'fenBefore' | 'uci'> & { classificationReason: { isBook: boolean } };
  expect(practiceMoves([move], 'white')).toHaveLength(0);
  // Leaving theory restores the exercise.
  expect(practiceMoves([{ ...move, classificationReason: { isBook: false } }], 'white')).toHaveLength(1);
});

it("reports why a fault is not an exercise instead of leaving the UI to guess", () => {
  const ply = parsePgn("1. e4 e5 *").plies[0]!;
  const base = { ...ply, quality: "mistake" as const, annotations: [] as [], classificationReason: { isBook: false }, stockfish: { fen: ply.fenBefore, bestMove: "d2d4", score: { kind: "cp" as const, cp: 100 }, lines: [], depth: 12 } } satisfies Pick<MoveAnalysisV2, "color" | "quality" | "annotations" | "stockfish" | "fenBefore" | "uci"> & { classificationReason: { isBook: boolean } };
  const theory = practiceQueue([{ ...base, classificationReason: { isBook: true } }], "white");
  expect(theory.eligible).toHaveLength(0);
  expect(theory.excluded.map((item) => item.reason)).toEqual(["opening-theory"]);
  const broken = practiceQueue([{ ...base, stockfish: { ...base.stockfish, fen: ply.fenAfter } }], "white");
  expect(broken.eligible).toHaveLength(0);
  expect(broken.excluded.map((item) => item.reason)).toEqual(["missing-engine-evidence"]);
  const none = practiceQueue([{ ...base, quality: "best", annotations: [] }], "white");
  expect(none.eligible).toHaveLength(0);
  expect(none.excluded).toHaveLength(0);
});


it('explains a mistake through human behaviour when the played move was the popular one', () => {
  const comparison = practiceHumanComparison({
    human: {
      targetElo: 1400,
      model: 'maia3-5m',
      playedMoveProbability: 0.31,
      playedMoveRank: 1,
      candidates: [{ uci: 'f3d4', san: 'Nd4', probability: 0.02, policyRank: 7 }],
    },
    bestMove: 'f3d4',
    legalMoveCount: 30,
    isForced: false,
    isForcing: false,
    isSacrifice: false,
    isEngineBest: false,
    tacticalMotifCount: 0,
  });

  expect(comparison.playedMoveProbability).toBeCloseTo(0.31);
  expect(comparison.bestMoveProbability).toBeCloseTo(0.02);
  expect(comparison.playedMoveWasNatural).toBe(true);
  // 0.02 sits exactly on the heuristic's "rare" boundary; the engine's move is
  // rare at this level, which is the point of the explanation.
  expect(comparison.bestMoveDifficulty?.evidence.probabilityBand).toBe('rare');
  expect(comparison.summary).toContain('1400');
});

it('still explains a mistake whose played move Maia never listed', () => {
  // The realistic blunder: Maia's move review returns only its top policy moves,
  // so a move humans rarely pick is absent from `candidates`. The explanation
  // must come from the dedicated probability/rank fields instead of vanishing,
  // and it must not claim a fabricated percentage for the engine's move.
  const comparison = practiceHumanComparison({
    human: {
      targetElo: 1200,
      model: 'maia3-5m',
      playedMoveProbability: 0.004,
      playedMoveRank: 23,
      candidates: [{ uci: 'd2d4', san: 'd4', probability: 0.09, policyRank: 2 }],
    },
    bestMove: 'g1f3',
    legalMoveCount: 30,
    isForced: false,
    isForcing: false,
    isSacrifice: false,
    isEngineBest: false,
    tacticalMotifCount: 0,
  });

  expect(comparison.playedMovePolicyRank).toBe(23);
  expect(comparison.bestMoveProbability).toBeUndefined();
  // No fabricated difficulty either: the heuristic would read a placeholder zero
  // as "exceptional", which would be invented evidence.
  expect(comparison.bestMoveDifficulty).toBeUndefined();
  // The rank must appear once, not once per clause.
  expect(comparison.summary.match(/rank #23/g)).toHaveLength(1);
  expect(comparison.summary).toContain('<1%');
  expect(comparison.summary).not.toContain('0%');
});
