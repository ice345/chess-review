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

`MoveAnalysis.human`, when requested from Enhanced Local Mode, stores Maia model identity, target/self/opponent Elo, raw candidate policies, displayed probability mass, exact played-move probability, expected human move, human WDL and `modelPrediction: true`. `HumanFindDifficulty` is a separate experimental object with a 0–100 score, label and every input/adjustment used by the deterministic heuristic. Neither field changes Stockfish scores, Accuracy or classification.

Phase 4 derives `CoachMoveFacts` and `CoachGameFacts` from this canonical record. The facts are versioned independently and contain no provider-generated chess truth. `MoveAnalysis.coach` and `GameAnalysisV1.coachSummary` are optional enrichments. Each response includes validated lines, a grounding report and `CoachSource` metadata (`provider`, `model`, `promptVersion`, `generatedAt`, and a fallback reason when deterministic copy was used).

`CoachValidatedLine` contains UCI/SAN pairs produced by the rules layer after the provider line matches a canonical PV prefix. `CoachGrounding` records removed move mentions, unsupported sections and the accepted line count. A cached coach enrichment whose prompt version differs from the current `COACH_PROMPT_VERSION` is discarded without invalidating the objective analysis.

The browser persists completed and coach-enriched `GameAnalysisV1` objects in IndexedDB. Cache identity includes the objective algorithm version, Stockfish version, depth, MultiPV, initial FEN and PGN, so an algorithm or engine configuration change cannot silently reuse stale objective facts.

External imports remain outside `GameAnalysisV1`. `PlatformAccount` records provider identity, authentication mode and sync timestamps; `ExternalGameReference` records provider/game/account identifiers; `SyncedGame` stores PGN plus import-facing player, result and time-control metadata. `PlatformSyncState` records incremental sync progress and errors. These records live in separate IndexedDB stores and never imply that a game has objective analysis. `SyncedGame.analyzed` becomes true only after a deterministic review record/cache is prepared.

Lichess access tokens are deliberately absent from all shared schemas and IndexedDB. The Next.js server encrypts them into an HttpOnly session cookie. A future Tauri client must replace that web-session mechanism with operating-system credential storage.

Temporary engine exploration is also not canonical analysis. The web review store holds a root FEN, root game ply, validated variation moves and a separate variation cursor. Returning to the game restores the root position without changing `GameAnalysisV1`.

`ClassificationReason.sacrifice` uses centipawns for material and compensation. `see` is signed from the mover's perspective, so a negative value means the opponent can gain material by accepting the offer. `survivesBestResponse` requires an opponent reply in the Stockfish root PV plus evaluation preservation; `recoveredWithinPv` reports material recovered after the largest observed PV deficit.

`GameDivision.middlePly` and `endPly` are zero-based indices into positions immediately before moves, matching the selected Divider port. Public move records use one-based `ply`. `phaseForPly()` is the canonical conversion.
