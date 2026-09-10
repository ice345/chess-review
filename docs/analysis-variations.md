# Interactive analysis variations

Interactive analysis is deliberately separate from the reviewed game. The
canonical PGN cursor, versioned canonical game analysis, Accuracy, phases and classifications are
never edited when a user moves a piece or selects a candidate line.

## Runtime tree

`apps/web/src/lib/analysis-branch.ts` owns the runtime tree contract:

- `rootPly` and `rootFen` identify the canonical position where exploration began.
- The root node has no move. Every other node stores a rules-validated UCI/SAN
  edge plus deterministic `fenBefore` and `fenAfter` values.
- A node may record `user`, ranked `stockfish`, and/or Elo-conditioned `maia`
  source metadata. Source
  metadata describes how a path was selected; it is not a move-quality verdict.
- A user-played node may separately hold a runtime-only objective Move Quality
  result. It records the canonical classification evidence and Accuracy for
  that edge, but never enters the persisted canonical game analysis, game summaries or exports.
- `activePath` is one root-to-leaf path, while `selectedIndex` identifies the
  displayed node on that path.
- Children are reused by parent plus UCI move, so a user move and an engine PV
  can converge without duplicating the position.

The tree is immutable at the helper boundary. Adding a user move creates one
edge from the selected node. Selecting a Stockfish candidate stores its complete
validated PV but initially displays the first move, so First/Previous/Next/Last
can navigate the known continuation without another search.

Only the path through `selectedIndex` is considered played history when a new
Stockfish request is built. Future nodes from a stored PV remain display-only
until the user steps into them; this keeps the engine's reconstructed position
identical to the board position after every backtrack.

## Legal-move and analysis flow

```text
canonical position at ply N
  -> click-select/click-move, drag, or select an analysis candidate
  -> validate through chess.js in packages/chess-core
  -> append/reuse a tree edge
  -> display the selected node FEN
  -> classify a user-played edge from its parent FEN with Stockfish
  -> automatically analyze the exact FEN with the active Review source
```

Selecting a side-to-move piece highlights every legal destination with a
high-contrast dot or capture ring. Illegal clicks/drops are rejected and leave the board/tree unchanged. A pawn move on
the back rank opens the existing queen/rook/bishop/knight chooser; cancel keeps
the position unchanged. The core helper also supports explicit underpromotion.

Stockfish candidate arrows use one objective blue family. Rank affects visual
strength only. Selecting an arrow or its compact text line projects the validated
engine PV into the tree. A search result is tagged with its request FEN and is
discarded from presentation if the board moved before that search completed.

For a user-played edge, Stockfish searches the parent position with the Review
depth/MultiPV settings. If the played UCI is outside MultiPV, a restricted
`searchmoves` root search supplies its score. `classifyExploratoryMove()` then
uses the same classifier, Accuracy function, legal-choice facts and sacrifice
detector as full-game review. The resulting badge is therefore objective and
mode-independent: switching to Maia never replaces it with a policy verdict.
Opening-book and game-phase labels are intentionally absent because a runtime
branch has no canonical imported-game theory boundary. Moving away cancels the
in-flight edge search; returning retries or reuses the node's completed result.

Maia candidate arrows use a separate sage family. Selecting one adds only its
legal move plus target-Elo/probability source evidence. Stockfish and Maia are
mutually exclusive Review displays; their scores are never blended.

## Return to Game

Return to Game (or Escape) clears only the runtime tree and restores `rootFen`.
The canonical `currentPly` never moved, so review navigation, Accuracy,
classifications, exports and cached analysis remain unchanged. Selecting a
timeline point intentionally exits the branch and establishes a new canonical
cursor.

The tree, including temporary Move Quality evidence, is session runtime state.
The board's move dock labels it “Temporary variation · not saved automatically”
and links to Notebook. The source PGN export excludes this runtime tree.

## Saved personal lines (S1)

Notebook saves a separate `ReviewNotebookV1` record, with notes/bookmarks and
`{ rootPly, line: UCI[] }` for each saved endpoint. Only moves through the selected
node are saved, not future PV nodes or sibling branches. Reopening replays every
move through chess-core against the original PGN/FEN root. It restores the
canonical root cursor and a fresh runtime tree, with no saved classifications,
engine scores, Maia probabilities or generated prose. Normal objective searches
can then run again. Return to Game restores that canonical root as before.

See [personal notebooks](review-notebook.md) for persistence, conflict handling,
backup compatibility and limits. This is not a full PGN variation-tree editor.
