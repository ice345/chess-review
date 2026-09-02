"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyExploratoryMove } from "@chess-review/analysis";
import { BrowserStockfish } from "@chess-review/stockfish";
import { analysisScheduler } from "../lib/analysis-scheduler";
import { selectedBranchNode, uciPathBeforeNode } from "../lib/analysis-branch";
import { useReviewStore } from "../store/review-store";

export function useBranchMoveQuality(depth: number, multiPv: number) {
  const branch = useReviewStore((state) => state.branch);
  const selected = useMemo(() => branch ? selectedBranchNode(branch) : null, [branch]);
  const [retryNumber, setRetryNumber] = useState(0);
  const engine = useRef<BrowserStockfish | null>(null);
  const selectedId = selected?.id ?? null;
  const selectedUci = selected?.move?.uci ?? null;
  const selectedFenBefore = selected?.move?.fenBefore ?? null;
  const selectedFenAfter = selected?.move?.fenAfter ?? null;
  const selectedWasPlayedByUser = selected?.sources.some((source) => source.kind === "user") ?? false;
  const rootPly = branch?.rootPly ?? null;

  useEffect(() => {
    engine.current = new BrowserStockfish();
    return () => engine.current?.terminate();
  }, []);

  useEffect(() => {
    if (!selectedId || !selectedUci || !selectedFenBefore || !selectedFenAfter || !selectedWasPlayedByUser) return;
    const review = useReviewStore.getState();
    const currentBranch = review.branch;
    const node = currentBranch?.nodes[selectedId];
    if (!currentBranch || !node?.move || !engine.current) return;
    if (
      node.moveQuality?.depth === depth
      && node.moveQuality.multiPv === multiPv
      && node.moveQuality.state !== "error"
    ) return;

    const controller = new AbortController();
    let settled = false;
    review.setBranchMoveQuality(selectedId, { state: "running", depth, multiPv });

    void (async () => {
      try {
        const latest = useReviewStore.getState();
        const activeBranch = latest.branch;
        const activeNode = activeBranch?.nodes[selectedId];
        if (!activeBranch || !activeNode?.move) return;
        const parent = activeNode.parentId ? activeBranch.nodes[activeNode.parentId] : undefined;
        if (!parent) throw new Error("The exploratory move has no parent position.");

        const canonicalRoot = activeNode.parentId === "root"
          ? latest.analysis?.moves[activeBranch.rootPly]?.stockfish
          : undefined;
        const reusableRoot = canonicalRoot?.fen === activeNode.move.fenBefore
          && canonicalRoot.depth === depth
          && canonicalRoot.lines.length > 0
          ? canonicalRoot
          : null;
        const game = latest.game;
        const history = {
          startFen: game?.initialFen ?? activeNode.move.fenBefore,
          moves: [
            ...(game?.plies.slice(0, activeBranch.rootPly).map((ply) => ply.uci) ?? []),
            ...uciPathBeforeNode(activeBranch, activeNode.id),
          ],
        };
        const rootAnalysis = reusableRoot ?? await analysisScheduler.run(
          "interactive-position",
          () => engine.current!.search(activeNode.move!.fenBefore, {
            depth,
            multiPv,
            signal: controller.signal,
            ...history,
          }),
          controller.signal,
        );
        const rootLine = rootAnalysis.lines.find((line) => line.pv[0] === activeNode.move!.uci);
        const playedMoveAnalysis = rootLine ? undefined : await analysisScheduler.run(
          "interactive-position",
          () => engine.current!.search(activeNode.move!.fenBefore, {
            depth,
            multiPv: 1,
            searchMoves: [activeNode.move!.uci],
            signal: controller.signal,
            ...history,
          }),
          controller.signal,
        );
        const previousMove = parent.move ?? undefined;
        const result = classifyExploratoryMove({
          move: activeNode.move,
          rootAnalysis,
          ...(playedMoveAnalysis === undefined ? {} : { playedMoveAnalysis }),
          ...(previousMove === undefined ? {} : { previousMove }),
        });
        if (controller.signal.aborted) return;
        const current = useReviewStore.getState().branch?.nodes[selectedId];
        if (current?.move?.uci !== selectedUci || current.move.fenAfter !== selectedFenAfter) return;
        useReviewStore.getState().setBranchMoveQuality(selectedId, {
          state: "complete",
          depth,
          multiPv,
          ...result,
        });
        settled = true;
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
        useReviewStore.getState().setBranchMoveQuality(selectedId, {
          state: "error",
          depth,
          multiPv,
          error: error instanceof Error ? error.message : "Exploratory move analysis failed.",
        });
        settled = true;
      }
    })();

    return () => {
      controller.abort();
      if (!settled && useReviewStore.getState().branch?.nodes[selectedId]?.moveQuality?.state === "running") {
        useReviewStore.getState().setBranchMoveQuality(selectedId, {
          state: "error",
          depth,
          multiPv,
          error: "Move Quality analysis was cancelled when the displayed branch changed.",
        });
      }
    };
  }, [depth, multiPv, retryNumber, rootPly, selectedFenAfter, selectedFenBefore, selectedId, selectedUci, selectedWasPlayedByUser]);

  return {
    retry: useCallback(() => setRetryNumber((value) => value + 1), []),
  };
}
