# Canonical data model

The source of truth is `packages/shared/src/schema.ts`. Current persisted analysis
uses `GameAnalysisV2` with both `version` and `algorithmVersion`; V1 is retained
only as a readable stale shape and is never accepted as current objective data.

Engine scores are a discriminated union:

```ts
type EngineScore =
  | { kind: "cp"; cp: number }
  | { kind: "mate"; mateIn: number };
```

Stored engine scores are White POV. A positive mate means White has the forced mate; a negative mate means Black does. Raw worker scores are normalized once at the Stockfish boundary.

`drawStatus(startFen, uciMoves)` in chess-core reports claimable threefold/fifty-move versus automatic fivefold/seventy-five/insufficient-material draws. It is not an engine score and is never flattened into centipawns. Stockfish searches send `position fen <startFen> moves <uci…>` so that history reaches the engine. Engine cache identity includes that history.

Each move stores SAN/UCI, before/after FEN, phase, Stockfish MultiPV, Accuracy,
continuous `quality`, independent `annotations`, a compatibility `classification`
and `ClassificationReason`. It preserves three distinct White-POV scores:

- `evaluationBefore`: best evaluation at the root before the move.
- `playedMoveScore`: root evaluation for the chosen move, from MultiPV or a restricted `searchmoves` search.
- `evaluationAfter`: best evaluation of the resulting position.

`playedMoveOutsideMultiPv` records why the restricted search was needed. These
fields must not be substituted. `engineConsistency` records their WinPercent/cp
difference, tolerance and consistency result. `verification` records baseline or
verified status, depth, MultiPV and reasons. Human analysis and coach prose are
optional enrichments and cannot overwrite objective fields.

`MoveAnalysis.human`, when requested from Enhanced Local Mode, is the `human-v2` move-review enrichment. It stores Maia model identity, target/self/opponent Elo, raw candidate policy plus exact policy ranks, displayed probability mass, exact played-move probability/rank, expected human move, played-move WDL and `modelPrediction: true`. It can be built only when the response `fenBefore` and played UCI match that canonical move. `HumanFindDifficulty` is a nested experimental object with a 0–100 score, label and every input/adjustment used by the deterministic heuristic. Neither field changes Stockfish scores, Accuracy or classification.

Phase 4 derives `CoachMoveFacts` and `CoachGameFacts` from this canonical record. The facts are versioned independently and contain no provider-generated chess truth. Phase 5.1 expands move facts with deterministic before/after position indicators, a bounded post-move consequence PV and an optional practical alternative backed by matching Stockfish and Maia candidates. The position indicators describe directly calculable board state rather than semantic prose. `MoveAnalysis.coach` and `GameAnalysisV2.coachSummary` are optional enrichments. Each response includes validated lines, a grounding report and `CoachSource` metadata (`provider`, `model`, `promptVersion`, `generatedAt`, and a fallback reason when deterministic copy was used).

`CoachValidatedLine` contains UCI/SAN pairs produced by the rules layer after the provider line matches a canonical PV prefix. `CoachFutureConsequenceFacts` is restricted to one to four plies beginning at `fenAfter`; the local service verifies it against `afterCandidates` again. `CoachPracticalAlternativeFacts` stores its Stockfish rank/score, Maia probability, objective-best reference and canonical win-percent cost so the claim can be audited without an LLM. `CoachGrounding` records removed move mentions, unsupported sections and the accepted line count. A cached coach enrichment whose prompt version differs from the current `COACH_PROMPT_VERSION` is discarded without invalidating the objective analysis.

The browser persists completed, human-enriched and coach-enriched `GameAnalysisV2`
objects in IndexedDB. Cache identity includes the objective algorithm version,
Stockfish version, depth, canonical classification MultiPV, initial FEN and PGN.
The user's Engine Lab line count is not a full-game classification input. A
separate `AnalysisCacheProjectionV1` stores a game hash, compact summaries,
provenance/counts and approximate payload bytes for coverage and identity lookup.
Human enrichment has its own identity `(human-v2, Maia model, target Elo, move
fenBefore, played UCI)`; changing it invalidates only Human/Coach-dependent data.

External imports remain outside `GameAnalysisV2`. `PlatformAccount` records provider identity, authentication mode, public avatar/rating metadata and sync timestamps; `ExternalGameReference` records provider/game/account identifiers; `SyncedGame` stores PGN plus import-facing player, result and time-control metadata. `SyncedGamePlayer.avatarUrl` is optional public-profile metadata. Copied Chess.com/Lichess PGNs and history imports resolve both players through `/api/platforms/player-avatar` and cache HTTPS allowlisted URLs in the `player-avatars` IndexedDB store. `PlatformSyncState` records incremental/full-history mode, an opaque provider cursor, batch/provider progress, pause/rate-limit/error state and retry time. These records live in separate IndexedDB stores and never imply that a game has objective analysis. `SyncedGame.analyzed` becomes true only after a deterministic review record/cache is prepared. Its optional `analysisAlgorithmVersion`, `analysisDepth` and `analyzedAt` fields make stale history explicit. A legacy record with `analyzed: true` but no canonical link, algorithm or depth metadata is read as pending so full-history analysis can repair it.

When Training loads, a synced game with a compatible cache projection but no
external review record is repaired idempotently from its provider/account/game
identity. A current-version cache projection is completion evidence on its own:
older runs could write caches without leaving any link behind, so the repair
accepts marker-less games whose game fingerprint matches a projection and
rejects only games whose durable marker names a different objective version.
The projection carries an additional header-independent identity
(`initialFen` plus played UCI sequence) so library joins and Review cache
restores survive PGN serialization drift between builds sharing persisted
browser data; older projections are regenerated by the index backfill.
`getCachedAnalysis` uses that identity plus compatible engine settings
(algorithm version, Stockfish version, depth, MultiPV) after an exact key
miss. The PGN-hashed cache key remains a locator, not game identity. A shared PGN cache alone is
still not enough to promote a queued or failed game into the player report, and
structurally invalid provider PGNs never become review records.

Lichess access tokens are deliberately absent from all shared schemas and IndexedDB. The Next.js server encrypts them into an HttpOnly session cookie. A future Tauri client must replace that web-session mechanism with operating-system credential storage.

Interactive engine exploration is not canonical analysis. The web runtime owns
an analysis tree separate from `GameAnalysisV2`.
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

Cross-game facts do not get written into `GameAnalysisV2`. The analysis package
accepts a selected-player projection of multiple canonical records and produces a
runtime `AdvancedStudyReportV2`. This keeps one-game cache identity independent of
study presentation. Its provenance carries provider, time-control, rated state,
player-color, recognized-opening, date-range and minimum-sample filters; one
filtered population feeds every deterministic section. Persisted training progress uses `TrainingQueueItemV2` in a
separate IndexedDB store. Each item records a deterministic player/weakness ID,
status, priority and up to five `TrainingEvidenceReference` objects containing
`gameId`, ply, SAN, phase, canonical classification and WinPercent loss. It stores
no Coach prose and never mutates the source analysis. `HistoryAnalysisJobV1` is a
separate browser-owned record with explicit scope, status, per-game attempts and
timestamps; `running` means an open tab currently owns the job. An explicit
full-history account import automatically creates or reuses an `unanalyzed` job
for that account. The job is objective Stockfish work only; Maia and Coach
enrichment remain on-demand. Completed and cached item states are persisted
independently, allowing Training to show partial results while the
browser-owned worker continues.

`GameDivision.middlePly` and `endPly` are zero-based indices into positions immediately before moves, matching the selected Divider port. Public move records use one-based `ply`. `phaseForPly()` is the canonical conversion.
