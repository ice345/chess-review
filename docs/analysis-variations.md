# Interactive analysis variations

Interactive analysis is deliberately separate from the reviewed game. The
canonical PGN cursor, `GameAnalysisV1`, Accuracy, phases and classifications are
never edited when a user moves a piece or selects a candidate line.

## Runtime tree

`apps/web/src/lib/analysis-branch.ts` owns the runtime tree contract:

- `rootPly` and `rootFen` identify the canonical position where exploration began.
- The root node has no move. Every other node stores a rules-validated UCI/SAN
  edge plus deterministic `fenBefore` and `fenAfter` values.
- A node may record `user`, ranked `stockfish`, and/or Elo-conditioned `maia`
  source metadata. Source
  metadata describes how a path was selected; it is not a move-quality verdict.
- `activePath` is one root-to-leaf path, while `selectedIndex` identifies the
  displayed node on that path.
- Children are reused by parent plus UCI move, so a user move and an engine PV
  can converge without duplicating the position.

The tree is immutable at the helper boundary. Adding a user move creates one
edge from the selected node. Selecting a Stockfish candidate stores its complete
validated PV but initially displays the first move, so First/Previous/Next/Last
can navigate the known continuation without another search.

## Legal-move and analysis flow

```text
canonical position at ply N
  -> click-select/click-move, drag, or select an analysis candidate
  -> validate through chess.js in packages/chess-core
  -> append/reuse a tree edge
  -> display the selected node FEN
  -> automatically analyze the exact FEN with the active Review source
```

Selecting a side-to-move piece highlights every legal destination with a
high-contrast dot or capture ring. Illegal clicks/drops are rejected and leave the board/tree unchanged. A pawn move on
the back rank defaults to queen promotion; the core helper also accepts explicit
queen, rook, bishop or knight promotion for a future UI chooser.

Stockfish candidate arrows use one objective blue family. Rank affects visual
strength only. Selecting an arrow or its compact text line projects the validated
engine PV into the tree. A search result is tagged with its request FEN and is
discarded from presentation if the board moved before that search completed.

Maia candidate arrows use a separate sage family. Selecting one adds only its
legal move plus target-Elo/probability source evidence. Stockfish and Maia are
mutually exclusive Review displays; their scores are never blended.

## Return to Game

Return to Game (or Escape) clears only the runtime tree and restores `rootFen`.
The canonical `currentPly` never moved, so review navigation, Accuracy,
classifications, exports and cached analysis remain unchanged. Selecting a
timeline point intentionally exits the branch and establishes a new canonical
cursor.

The tree is session runtime state in Phase 5.1. If variation persistence is
added later, it must use its own versioned record rather than extending
`GameAnalysisV1` with exploratory classifications.
