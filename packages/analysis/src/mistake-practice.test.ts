import { expect, it } from "vitest";
import { judgePracticeScore, practiceMoves } from "./mistake-practice";
import { parsePgn } from "@chess-review/chess-core";
import type { MoveAnalysisV2 } from "@chess-review/shared";

it('accepts equally strong alternatives for either color using White POV', () => {
  expect(judgePracticeScore({ kind: 'cp', cp: 100 }, { kind: 'cp', cp: 90 }, 'white').accepted).toBe(true);
  expect(judgePracticeScore({ kind: 'cp', cp: -100 }, { kind: 'cp', cp: -90 }, 'black').accepted).toBe(true);
  expect(judgePracticeScore({ kind: 'cp', cp: -100 }, { kind: 'cp', cp: 100 }, 'black').accepted).toBe(false);
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
  const move = { ...ply, quality: 'mistake', annotations: [], stockfish: { fen: ply.fenBefore, bestMove: 'd2d4', score: { kind: 'cp', cp: 100 }, lines: [], depth: 12 } } satisfies Pick<MoveAnalysisV2, 'color' | 'quality' | 'annotations' | 'stockfish' | 'fenBefore' | 'uci'>;
  expect(practiceMoves([move], 'white')).toHaveLength(1);
  expect(practiceMoves([move], 'black')).toHaveLength(0);
  expect(practiceMoves([{ ...move, quality: 'inaccuracy' }], 'white')).toHaveLength(0);
  expect(practiceMoves([{ ...move, quality: 'inaccuracy' }], 'white', true)).toHaveLength(1);
  expect(practiceMoves([{ ...move, quality: 'good', annotations: ['missed_mate'] }], 'white')).toHaveLength(1);
  for (const bestMove of ['e2e4', 'e2e5', '']) expect(practiceMoves([{ ...move, stockfish: { ...move.stockfish, bestMove } }], 'white')).toHaveLength(0);
  expect(practiceMoves([{ ...move, stockfish: { ...move.stockfish, fen: ply.fenAfter } }], 'white')).toHaveLength(0);
});
