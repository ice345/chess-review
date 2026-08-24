# Canonical data model

The source of truth is `packages/shared/src/schema.ts`. Persisted analysis uses `GameAnalysisV1` with both `version` and `algorithmVersion` so schema compatibility and product-algorithm compatibility are not conflated.

Engine scores are a discriminated union:

```ts
type EngineScore =
  | { kind: "cp"; cp: number }
  | { kind: "mate"; mateIn: number };
```

Stored engine scores are White POV. A positive mate means White has the forced mate; a negative mate means Black does. Raw worker scores are normalized once at the Stockfish boundary.

Each move stores SAN/UCI, before/after FEN, phase, Stockfish MultiPV, accuracy, classification and `ClassificationReason`. It preserves three distinct White-POV scores:

- `evaluationBefore`: best evaluation at the root before the move.
- `playedMoveScore`: root evaluation for the chosen move, from MultiPV or a restricted `searchmoves` search.
- `evaluationAfter`: best evaluation of the resulting position.

`playedMoveOutsideMultiPv` records why the restricted search was needed. These fields must not be substituted for one another. Human analysis and coach prose are optional enrichments and cannot overwrite objective fields.

`MoveAnalysis.human`, when requested from Enhanced Local Mode, is the `human-v2` move-review enrichment. It stores Maia model identity, target/self/opponent Elo, raw candidate policy plus exact policy ranks, displayed probability mass, exact played-move probability/rank, expected human move, played-move WDL and `modelPrediction: true`. It can be built only when the response `fenBefore` and played UCI match that canonical move. `HumanFindDifficulty` is a nested experimental object with a 0–100 score, label and every input/adjustment used by the deterministic heuristic. Neither field changes Stockfish scores, Accuracy or classification.

Phase 4 derives `CoachMoveFacts` and `CoachGameFacts` from this canonical record. The facts are versioned independently and contain no provider-generated chess truth. Phase 5.1 expands move facts with deterministic before/after position indicators, a bounded post-move consequence PV and an optional practical alternative backed by matching Stockfish and Maia candidates. The position indicators describe directly calculable board state rather than semantic prose. `MoveAnalysis.coach` and `GameAnalysisV1.coachSummary` are optional enrichments. Each response includes validated lines, a grounding report and `CoachSource` metadata (`provider`, `model`, `promptVersion`, `generatedAt`, and a fallback reason when deterministic copy was used).

`CoachValidatedLine` contains UCI/SAN pairs produced by the rules layer after the provider line matches a canonical PV prefix. `CoachFutureConsequenceFacts` is restricted to one to four plies beginning at `fenAfter`; the local service verifies it against `afterCandidates` again. `CoachPracticalAlternativeFacts` stores its Stockfish rank/score, Maia probability, objective-best reference and canonical win-percent cost so the claim can be audited without an LLM. `CoachGrounding` records removed move mentions, unsupported sections and the accepted line count. A cached coach enrichment whose prompt version differs from the current `COACH_PROMPT_VERSION` is discarded without invalidating the objective analysis.

The browser persists completed, human-enriched and coach-enriched `GameAnalysisV1` objects in IndexedDB. Cache identity includes the objective algorithm version, Stockfish version, depth, MultiPV, initial FEN and PGN, so an algorithm or engine configuration change cannot silently reuse stale objective facts. Human enrichment has its own identity `(human-v2, Maia model, target Elo, move fenBefore, played UCI)`; changing model or Elo removes only incompatible human/Coach-dependent enrichment and does not invalidate objective analysis.

External imports remain outside `GameAnalysisV1`. `PlatformAccount` records provider identity, authentication mode, public avatar/rating metadata and sync timestamps; `ExternalGameReference` records provider/game/account identifiers; `SyncedGame` stores PGN plus import-facing player, result and time-control metadata. `PlatformSyncState` records incremental/full-history mode, an opaque provider cursor, batch/provider progress, pause/rate-limit/error state and retry time. These records live in separate IndexedDB stores and never imply that a game has objective analysis. `SyncedGame.analyzed` becomes true only after a deterministic review record/cache is prepared.

Lichess access tokens are deliberately absent from all shared schemas and IndexedDB. The Next.js server encrypts them into an HttpOnly session cookie. A future Tauri client must replace that web-session mechanism with operating-system credential storage.

Interactive engine exploration is not canonical analysis. The web runtime owns
an analysis tree separate from `GameAnalysisV1`.
Its durable contract is:

- an explicit canonical root ply and root FEN;
- rules-validated UCI/SAN on every edge;
- deterministic FEN before/after for every node;
- an explicit selected node/path;
- optional source metadata for user, Stockfish or Maia candidates;
- no objective classification or Accuracy field on exploratory moves.

Returning to the game restores the root canonical position. The tree is runtime
state in Phase 5.1; future persistence may version it independently without
changing the canonical analysis schema. See
[`analysis-variations.md`](analysis-variations.md) for node/path invariants and
Return-to-Game behavior.

`MaiaPositionAnalysis` is runtime state, separate from stored
`MoveAnalysis.human`. It is associated with an exact displayed FEN, Maia model and
target Elo, records the root side to move and `rootWdl`, and exposes a bounded
`evaluatedCandidates` union for comparison. `MaiaMoveReview` instead identifies a
canonical played move by `fenBefore + playedMove + model + targetElo` and is the
only Maia response that may produce stored `human-v2` facts or Human Find
Difficulty. A Maia-created branch edge may store
`{ kind: "maia", targetElo, probability }` as source evidence; it does not gain
Accuracy, classification or an engine score from that metadata.

`ClassificationReason.sacrifice` uses centipawns for material and compensation. `see` is signed from the mover's perspective, so a negative value means the opponent can gain material by accepting the offer. `survivesBestResponse` requires an opponent reply in the Stockfish root PV plus evaluation preservation; `recoveredWithinPv` reports material recovered after the largest observed PV deficit.

`GameDivision.middlePly` and `endPly` are zero-based indices into positions immediately before moves, matching the selected Divider port. Public move records use one-based `ply`. `phaseForPly()` is the canonical conversion.
