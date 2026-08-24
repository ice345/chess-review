import { beforeEach, describe, expect, it } from "vitest";
import { replayUciLine } from "@chess-review/chess-core";
import { selectedBranchNode } from "../lib/analysis-branch";
import { useReviewStore } from "./review-store";

const PGN = `[Event "Branch fixture"]
[White "Ada"]
[Black "Mikhail"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 *`;

describe("review analysis branch store", () => {
  beforeEach(() => {
    useReviewStore.getState().loadPgn(PGN);
    useReviewStore.getState().goToPly(2);
  });

  it("creates a legal branch from a historical ply without mutating the canonical game", () => {
    const before = useReviewStore.getState();
    const canonicalPgn = before.game?.pgn;
    const canonicalFen = before.positionFen;

    expect(before.playAnalysisMove("g1", "f3")).toBe(true);
    const branched = useReviewStore.getState();
    expect(branched.currentPly).toBe(2);
    expect(branched.game?.pgn).toBe(canonicalPgn);
    expect(branched.branch?.rootPly).toBe(2);
    expect(branched.positionFen).not.toBe(canonicalFen);
    expect(branched.branch && selectedBranchNode(branched.branch).move?.san).toBe("Nf3");

    branched.returnToGame();
    expect(useReviewStore.getState()).toMatchObject({ branch: null, currentPly: 2, positionFen: canonicalFen });
  });

  it("continues user moves and rejects illegal drags", () => {
    const store = useReviewStore.getState();
    expect(store.playAnalysisMove("g1", "f3")).toBe(true);
    expect(useReviewStore.getState().playAnalysisMove("b8", "c6")).toBe(true);
    const branch = useReviewStore.getState().branch;
    expect(branch?.activePath).toHaveLength(3);
    expect(branch && selectedBranchNode(branch).move?.san).toBe("Nc6");
    expect(useReviewStore.getState().playAnalysisMove("a1", "a8")).toBe(false);
    expect(useReviewStore.getState().branch?.activePath).toHaveLength(3);
  });

  it("stores an engine PV as a selectable path and returns reliably", () => {
    const rootFen = useReviewStore.getState().positionFen;
    useReviewStore.getState().startEngineLine(1, replayUciLine(rootFen, ["g1f3", "b8c6", "f1b5"]));
    let branch = useReviewStore.getState().branch;
    expect(branch?.activePath).toHaveLength(4);
    expect(branch?.selectedIndex).toBe(1);
    expect(branch && selectedBranchNode(branch).sources).toContainEqual({ kind: "stockfish", rank: 1 });

    useReviewStore.getState().stepBranch(2);
    branch = useReviewStore.getState().branch;
    expect(branch?.selectedIndex).toBe(3);
    expect(branch && selectedBranchNode(branch).move?.san).toBe("Bb5");
  });

  it("stores Maia probability as model-source evidence, not objective quality", () => {
    expect(useReviewStore.getState().playHumanCandidate("g1f3", 1600, 0.27)).toBe(true);
    const branch = useReviewStore.getState().branch;
    expect(branch && selectedBranchNode(branch).sources).toContainEqual({
      kind: "maia",
      targetElo: 1600,
      probability: 0.27,
    });
    expect(branch && selectedBranchNode(branch).sources.some((source) => source.kind === "stockfish")).toBe(false);
    expect(useReviewStore.getState().currentPly).toBe(2);
  });
});
