import { create } from "zustand";
import { normalizeFen, parsePgn, type NormalizedGame, type ReplayedUciMove } from "@chess-review/chess-core";
import { divideGame } from "@chess-review/analysis";
import { recognizeOpening } from "@chess-review/openings";
import type {
  CoachExplanation,
  GameAnalysisV1,
  GameCoachSummary,
  GameDivision,
  HumanAnalysis,
  OpeningInfo,
} from "@chess-review/shared";

export interface ReviewVariation {
  rank: number;
  rootPly: number;
  rootFen: string;
  moves: ReplayedUciMove[];
  cursor: number;
}

interface ReviewState {
  game: NormalizedGame | null;
  division: GameDivision | null;
  opening: OpeningInfo | null;
  analysis: GameAnalysisV1 | null;
  currentPly: number;
  positionFen: string;
  orientation: "white" | "black";
  variation: ReviewVariation | null;
  error: string | null;
  loadPgn: (pgn: string) => void;
  loadFen: (fen: string) => void;
  goToPly: (ply: number) => void;
  setAnalysis: (analysis: GameAnalysisV1 | null) => void;
  setOrientation: (orientation: "white" | "black") => void;
  startVariation: (rank: number, moves: ReplayedUciMove[]) => void;
  stepVariation: (delta: number) => void;
  returnToGame: () => void;
  setMoveHuman: (ply: number, human: HumanAnalysis) => GameAnalysisV1 | null;
  setMoveCoach: (ply: number, coach: CoachExplanation) => GameAnalysisV1 | null;
  setGameCoachSummary: (coachSummary: GameCoachSummary) => GameAnalysisV1 | null;
}

const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const useReviewStore = create<ReviewState>((set, get) => ({
  game: null,
  division: null,
  opening: null,
  analysis: null,
  currentPly: 0,
  positionFen: initialFen,
  orientation: "white",
  variation: null,
  error: null,
  loadPgn: (pgn) => {
    try {
      const game = parsePgn(pgn);
      const division = divideGame(game);
      const opening = recognizeOpening(game) ?? null;
      set({ game, division, opening, analysis: null, currentPly: 0, positionFen: game.initialFen, variation: null, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "PGN 解析失败。" });
    }
  },
  loadFen: (fen) => {
    try {
      set({
        game: null,
        division: null,
        opening: null,
        analysis: null,
        currentPly: 0,
        positionFen: normalizeFen(fen),
        variation: null,
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "FEN 无效。" });
    }
  },
  goToPly: (ply) => {
    const game = get().game;
    if (!game) return;
    const bounded = Math.max(0, Math.min(game.plies.length, ply));
    const positionFen = bounded === 0 ? game.initialFen : game.plies[bounded - 1]?.fenAfter ?? game.initialFen;
    set({ currentPly: bounded, positionFen, variation: null });
  },
  setAnalysis: (analysis) => set({ analysis }),
  setOrientation: (orientation) => set({ orientation }),
  startVariation: (rank, moves) => {
    if (moves.length === 0) return;
    const current = get();
    const rootFen = current.variation?.rootFen ?? current.positionFen;
    const rootPly = current.variation?.rootPly ?? current.currentPly;
    set({
      variation: { rank, rootPly, rootFen, moves, cursor: 1 },
      positionFen: moves[0]?.fenAfter ?? rootFen,
    });
  },
  stepVariation: (delta) => {
    const variation = get().variation;
    if (!variation) return;
    const cursor = Math.max(0, Math.min(variation.moves.length, variation.cursor + delta));
    const positionFen = cursor === 0 ? variation.rootFen : variation.moves[cursor - 1]?.fenAfter ?? variation.rootFen;
    set({ variation: { ...variation, cursor }, positionFen });
  },
  returnToGame: () => {
    const variation = get().variation;
    if (!variation) return;
    set({ variation: null, positionFen: variation.rootFen });
  },
  setMoveHuman: (ply, human) => {
    const analysis = get().analysis;
    if (!analysis || ply < 1 || ply > analysis.moves.length) return null;
    const updated = {
      ...analysis,
      moves: analysis.moves.map((move) => move.ply === ply ? { ...move, human } : move),
    };
    set({ analysis: updated });
    return updated;
  },
  setMoveCoach: (ply, coach) => {
    const analysis = get().analysis;
    if (!analysis || ply < 1 || ply > analysis.moves.length) return null;
    const updated = {
      ...analysis,
      moves: analysis.moves.map((move) => move.ply === ply ? { ...move, coach } : move),
    };
    set({ analysis: updated });
    return updated;
  },
  setGameCoachSummary: (coachSummary) => {
    const analysis = get().analysis;
    if (!analysis) return null;
    const updated = { ...analysis, coachSummary };
    set({ analysis: updated });
    return updated;
  },
}));
