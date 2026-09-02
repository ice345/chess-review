import type { ReplayedUciMove } from "@chess-review/chess-core";
import type { ClassificationReason, EngineScore, MoveClassification } from "@chess-review/shared";

export type AnalysisBranchSource =
  | { kind: "user" }
  | { kind: "stockfish"; rank: number }
  | { kind: "maia"; targetElo: number; probability: number };

export type AnalysisBranchMoveQuality =
  | { state: "running"; depth: number; multiPv: number }
  | { state: "error"; depth: number; multiPv: number; error: string }
  | {
      state: "complete";
      depth: number;
      multiPv: number;
      classification: MoveClassification;
      classificationReason: ClassificationReason;
      playedMoveScore: EngineScore;
      playedMoveOutsideMultiPv: boolean;
      accuracy: number;
    };

export interface AnalysisBranchNode {
  id: string;
  parentId: string | null;
  childIds: string[];
  move: ReplayedUciMove | null;
  fen: string;
  sources: AnalysisBranchSource[];
  /** Runtime-only objective verdict for a user-played exploratory move. */
  moveQuality?: AnalysisBranchMoveQuality;
}

export interface AnalysisBranchTree {
  rootPly: number;
  rootFen: string;
  nodes: Record<string, AnalysisBranchNode>;
  activePath: string[];
  selectedIndex: number;
  nextNodeNumber: number;
}

export function createAnalysisBranch(rootPly: number, rootFen: string): AnalysisBranchTree {
  const root: AnalysisBranchNode = {
    id: "root",
    parentId: null,
    childIds: [],
    move: null,
    fen: rootFen,
    sources: [],
  };
  return {
    rootPly,
    rootFen,
    nodes: { [root.id]: root },
    activePath: [root.id],
    selectedIndex: 0,
    nextNodeNumber: 1,
  };
}

export function selectedBranchNode(tree: AnalysisBranchTree): AnalysisBranchNode {
  const id = tree.activePath[tree.selectedIndex];
  const node = id ? tree.nodes[id] : undefined;
  if (!node) throw new Error("Analysis branch selection is invalid.");
  return node;
}

export function activeBranchMoves(tree: AnalysisBranchTree): ReplayedUciMove[] {
  return tree.activePath.slice(1).flatMap((id) => {
    const move = tree.nodes[id]?.move;
    return move ? [move] : [];
  });
}

/**
 * Returns only the moves that have actually been selected in the branch.
 *
 * Engine PVs are stored as a complete path so the user can step through the
 * continuation, but nodes after `selectedIndex` are future display data. They
 * must not be sent as played history to a new Stockfish search at the current
 * node, otherwise the engine receives a position that no longer matches the
 * displayed board.
 */
export function selectedBranchMoves(tree: AnalysisBranchTree): ReplayedUciMove[] {
  return tree.activePath.slice(1, tree.selectedIndex + 1).flatMap((id) => {
    const move = tree.nodes[id]?.move;
    return move ? [move] : [];
  });
}

/** UCI path from the branch root to `nodeId`, excluding that node's own move. */
export function uciPathBeforeNode(tree: AnalysisBranchTree, nodeId: string): string[] {
  const ucis: string[] = [];
  let current = tree.nodes[nodeId];
  while (current?.parentId) {
    const parent = tree.nodes[current.parentId];
    if (parent?.move) ucis.push(parent.move.uci);
    current = parent;
  }
  return ucis.reverse();
}

function sameSource(left: AnalysisBranchSource, right: AnalysisBranchSource): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "stockfish" && right.kind === "stockfish") return left.rank === right.rank;
  if (left.kind === "maia" && right.kind === "maia") return left.targetElo === right.targetElo;
  return true;
}

function addSource(node: AnalysisBranchNode, source: AnalysisBranchSource): AnalysisBranchNode {
  if (!node.sources.some((candidate) => sameSource(candidate, source))) {
    return { ...node, sources: [...node.sources, source] };
  }
  if (source.kind !== "maia") return node;
  return {
    ...node,
    sources: node.sources.map((candidate) => sameSource(candidate, source) ? source : candidate),
  };
}

function addEdge(
  tree: AnalysisBranchTree,
  parentId: string,
  move: ReplayedUciMove,
  source: AnalysisBranchSource,
): { tree: AnalysisBranchTree; childId: string } {
  const parent = tree.nodes[parentId];
  if (!parent) throw new Error("Analysis branch parent is missing.");
  if (parent.fen !== move.fenBefore) throw new Error("Analysis move does not start from the selected branch position.");

  const existingId = parent.childIds.find((id) => tree.nodes[id]?.move?.uci === move.uci);
  if (existingId) {
    const existing = tree.nodes[existingId];
    if (!existing) throw new Error("Analysis branch child is missing.");
    return {
      tree: {
        ...tree,
        nodes: { ...tree.nodes, [existingId]: addSource(existing, source) },
      },
      childId: existingId,
    };
  }

  const childId = `node-${tree.nextNodeNumber}`;
  const child: AnalysisBranchNode = {
    id: childId,
    parentId,
    childIds: [],
    move,
    fen: move.fenAfter,
    sources: [source],
  };
  return {
    tree: {
      ...tree,
      nextNodeNumber: tree.nextNodeNumber + 1,
      nodes: {
        ...tree.nodes,
        [parentId]: { ...parent, childIds: [...parent.childIds, childId] },
        [childId]: child,
      },
    },
    childId,
  };
}

export function appendBranchMove(
  tree: AnalysisBranchTree,
  move: ReplayedUciMove,
  source: AnalysisBranchSource = { kind: "user" },
): AnalysisBranchTree {
  const parentId = tree.activePath[tree.selectedIndex];
  if (!parentId) throw new Error("Analysis branch selection is invalid.");
  const edge = addEdge(tree, parentId, move, source);
  const prefix = edge.tree.activePath.slice(0, edge.tree.selectedIndex + 1);
  return {
    ...edge.tree,
    activePath: [...prefix, edge.childId],
    selectedIndex: prefix.length,
  };
}

/** Adds a complete engine PV but selects its first move for natural exploration. */
export function appendBranchLine(
  tree: AnalysisBranchTree,
  moves: readonly ReplayedUciMove[],
  rank: number,
): AnalysisBranchTree {
  if (moves.length === 0) return tree;
  let next = tree;
  let parentId = tree.activePath[tree.selectedIndex];
  if (!parentId) throw new Error("Analysis branch selection is invalid.");
  const prefix = tree.activePath.slice(0, tree.selectedIndex + 1);
  const addedIds: string[] = [];

  for (const move of moves) {
    const edge = addEdge(next, parentId, move, { kind: "stockfish", rank });
    next = edge.tree;
    parentId = edge.childId;
    addedIds.push(edge.childId);
  }

  return {
    ...next,
    activePath: [...prefix, ...addedIds],
    selectedIndex: prefix.length,
  };
}

export function stepAnalysisBranch(tree: AnalysisBranchTree, delta: number): AnalysisBranchTree {
  const selectedIndex = Math.max(0, Math.min(tree.activePath.length - 1, tree.selectedIndex + delta));
  return selectedIndex === tree.selectedIndex ? tree : { ...tree, selectedIndex };
}

export function setBranchMoveQuality(
  tree: AnalysisBranchTree,
  nodeId: string,
  moveQuality: AnalysisBranchMoveQuality,
): AnalysisBranchTree {
  const node = tree.nodes[nodeId];
  if (!node?.move) return tree;
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: { ...node, moveQuality },
    },
  };
}
