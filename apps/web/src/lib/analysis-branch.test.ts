import { describe, expect, it } from "vitest";
import { playLegalBoardMove, replayUciLine } from "@chess-review/chess-core";
import {
  activeBranchMoves,
  appendBranchLine,
  appendBranchMove,
  createAnalysisBranch,
  selectedBranchNode,
  stepAnalysisBranch,
} from "./analysis-branch";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("analysis branch tree", () => {
  it("keeps an explicit canonical root and deterministic selected FEN", () => {
    const root = createAnalysisBranch(12, INITIAL_FEN);
    const move = playLegalBoardMove(INITIAL_FEN, { from: "e2", to: "e4" });
    const branch = appendBranchMove(root, move);
    expect(branch.rootPly).toBe(12);
    expect(root.nodes.root?.childIds).toEqual([]);
    expect(selectedBranchNode(branch).fen).toBe(move.fenAfter);
    expect(activeBranchMoves(branch).map((candidate) => candidate.san)).toEqual(["e4"]);
  });

  it("adds multiple engine candidates as sibling branches and selects the first move", () => {
    const root = createAnalysisBranch(0, INITIAL_FEN);
    const e4 = replayUciLine(INITIAL_FEN, ["e2e4", "e7e5"]);
    const d4 = replayUciLine(INITIAL_FEN, ["d2d4", "d7d5"]);
    const first = appendBranchLine(root, e4, 1);
    const backAtRoot = stepAnalysisBranch(first, -1);
    const second = appendBranchLine(backAtRoot, d4, 2);

    expect(second.nodes.root?.childIds).toHaveLength(2);
    expect(selectedBranchNode(second).move?.uci).toBe("d2d4");
    expect(selectedBranchNode(second).sources).toContainEqual({ kind: "stockfish", rank: 2 });
  });

  it("continues a user line from the selected engine node without changing the root", () => {
    const engine = appendBranchLine(
      createAnalysisBranch(7, INITIAL_FEN),
      replayUciLine(INITIAL_FEN, ["e2e4", "e7e5"]),
      1,
    );
    const reply = playLegalBoardMove(selectedBranchNode(engine).fen, { from: "c7", to: "c5" });
    const branch = appendBranchMove(engine, reply);
    expect(branch.rootPly).toBe(7);
    expect(activeBranchMoves(branch).slice(0, branch.selectedIndex).map((move) => move.uci)).toEqual(["e2e4", "c7c5"]);
    expect(selectedBranchNode(stepAnalysisBranch(branch, -1)).move?.uci).toBe("e2e4");
  });

  it("rejects a move whose FEN does not match the selected node", () => {
    const root = createAnalysisBranch(0, INITIAL_FEN);
    const wrongPosition = replayUciLine(INITIAL_FEN, ["e2e4", "e7e5"])[1];
    expect(() => wrongPosition && appendBranchMove(root, wrongPosition)).toThrow(/does not start/);
  });
});
