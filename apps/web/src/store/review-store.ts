import { create } from "zustand";
import {
  normalizeFen,
  parsePgn,
  playLegalBoardMove,
  type NormalizedGame,
  type ReplayedUciMove,
} from "@chess-review/chess-core";
import { divideGame, matchesHumanAnalysisIdentity } from "@chess-review/analysis";
import { recognizeOpening } from "@chess-review/openings";
import type {
  CoachExplanation,
  GameAnalysisV2,
  GameCoachSummary,
  GameDivision,
  HumanAnalysis,
  MaiaModel,
  OpeningInfo,
} from "@chess-review/shared";
import {
  appendBranchLine,
  appendBranchMove,
  createAnalysisBranch,
  selectedBranchNode,
  setBranchMoveQuality,
  stepAnalysisBranch,
  type AnalysisBranchMoveQuality,
  type AnalysisBranchTree,
} from "../lib/analysis-branch";

interface ReviewState {
  game: NormalizedGame | null;
  division: GameDivision | null;
  opening: OpeningInfo | null;
  analysis: GameAnalysisV2 | null;
  currentPly: number;
  positionFen: string;
  orientation: "white" | "black";
  branch: AnalysisBranchTree | null;
  error: string | null;
  loadPgn: (pgn: string) => void;
  loadFen: (fen: string) => void;
  goToPly: (ply: number) => void;
  setAnalysis: (analysis: GameAnalysisV2 | null) => void;
  setOrientation: (orientation: "white" | "black") => void;
  startEngineLine: (rank: number, moves: ReplayedUciMove[]) => void;
  playAnalysisMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => boolean;
  playHumanCandidate: (uci: string, targetElo: number, probability: number) => boolean;
  stepBranch: (delta: number) => void;
  setBranchMoveQuality: (nodeId: string, quality: AnalysisBranchMoveQuality) => void;
  returnToGame: () => void;
  setMoveHuman: (ply: number, human: HumanAnalysis) => GameAnalysisV2 | null;
  invalidateHumanAnalysis: (model: MaiaModel, targetElo: number) => GameAnalysisV2 | null;
  setMoveCoach: (ply: number, coach: CoachExplanation) => GameAnalysisV2 | null;
  setGameCoachSummary: (coachSummary: GameCoachSummary) => GameAnalysisV2 | null;
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
  branch: null,
  error: null,
  loadPgn: (pgn) => {
    try {
      const game = parsePgn(pgn);
      const division = divideGame(game);
      const opening = recognizeOpening(game) ?? null;
      set({ game, division, opening, analysis: null, currentPly: 0, positionFen: game.initialFen, branch: null, error: null });
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
        branch: null,
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
    set({ currentPly: bounded, positionFen, branch: null });
  },
  setAnalysis: (analysis) => set({ analysis }),
  setOrientation: (orientation) => set({ orientation }),
  startEngineLine: (rank, moves) => {
    if (moves.length === 0) return;
    const current = get();
    const root = current.branch ?? createAnalysisBranch(current.currentPly, current.positionFen);
    const branch = appendBranchLine(root, moves, rank);
    set({ branch, positionFen: selectedBranchNode(branch).fen, error: null });
  },
  playAnalysisMove: (from, to, promotion) => {
    const current = get();
    try {
      const move = playLegalBoardMove(current.positionFen, { from, to, ...(promotion ? { promotion } : {}) });
      const root = current.branch ?? createAnalysisBranch(current.currentPly, current.positionFen);
      const branch = appendBranchMove(root, move);
      set({ branch, positionFen: selectedBranchNode(branch).fen, error: null });
      return true;
    } catch {
      return false;
    }
  },
  playHumanCandidate: (uci, targetElo, probability) => {
    const current = get();
    try {
      const promotion = uci[4];
      const move = playLegalBoardMove(current.positionFen, {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...((promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n") ? { promotion } : {}),
      });
      const root = current.branch ?? createAnalysisBranch(current.currentPly, current.positionFen);
      const branch = appendBranchMove(root, move, { kind: "maia", targetElo, probability });
      set({ branch, positionFen: selectedBranchNode(branch).fen, error: null });
      return true;
    } catch {
      return false;
    }
  },
  stepBranch: (delta) => {
    const branch = get().branch;
    if (!branch) return;
    const updated = stepAnalysisBranch(branch, delta);
    set({ branch: updated, positionFen: selectedBranchNode(updated).fen });
  },
  setBranchMoveQuality: (nodeId, quality) => {
    const branch = get().branch;
    if (!branch) return;
    const updated = setBranchMoveQuality(branch, nodeId, quality);
    if (updated !== branch) set({ branch: updated });
  },
  returnToGame: () => {
    const branch = get().branch;
    if (!branch) return;
    set({ branch: null, positionFen: branch.rootFen });
  },
  setMoveHuman: (ply, human) => {
    const analysis = get().analysis;
    if (!analysis || ply < 1 || ply > analysis.moves.length) return null;
    const updated = {
      ...analysis,
      moves: analysis.moves.map((move) => {
        if (move.ply !== ply) return move;
        const enriched = { ...move, human };
        delete enriched.coach;
        return enriched;
      }),
    };
    // Coach prose may have incorporated the previous/no-human fact set.
    delete updated.coachSummary;
    set({ analysis: updated });
    return updated;
  },
  invalidateHumanAnalysis: (model, targetElo) => {
    const analysis = get().analysis;
    if (!analysis) return null;
    let changed = false;
    const moves = analysis.moves.map((move) => {
      if (move.human === undefined || matchesHumanAnalysisIdentity(move.human, model, targetElo)) return move;
      changed = true;
      const withoutHuman = { ...move };
      delete withoutHuman.human;
      delete withoutHuman.coach;
      return withoutHuman;
    });
    if (!changed) return analysis;
    const updated = { ...analysis, moves };
    delete updated.coachSummary;
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
