# Player intelligence and training

Implementations:

- `packages/analysis/src/study-v2.ts`: deterministic report semantics.
- `apps/web/src/lib/advanced-study-library.ts`: identity and lazy cache loading.
- `apps/web/src/lib/history-analysis-jobs.ts`: durable browser work.
- `/training`: filters, report, queue and job controls.

## Report contract

The current report is `advanced-study-v2`. It consumes only compatible
`GameAnalysisV2` records and refuses to mix objective algorithm versions. Its
provenance includes the objective version, engine configurations, report filters,
generation time and explicit coverage. Partial coverage is true whenever an
eligible game is missing, stale or failed.

One filter population—provider, time control, rated/casual, player color,
recognized opening and date range—is applied before every rating, opening,
phase, mistake, highlight, weakness and training-plan calculation. A section
cannot silently use a larger population. The minimum-sample control suppresses
rating/opening/weakness aggregates below its threshold while leaving raw,
traceable move evidence available.

Connected identity is `accountId`, not a normalized display name. Games from a
connected account use only the imported account color. Two connected accounts
with the same username remain separate. Manual PGNs use independent
`manual:<normalized-name>` player choices and are never name-merged into a
connected identity.

## Ratings and form

Ratings are grouped by `provider + timeClass`. Chess.com rapid, Chess.com blitz
and Lichess rapid are separate bands and are never averaged together. Each band
reports the latest known rating, the last-ten-game observed range, result score,
sample size and confidence (`low <5`, `medium 5–14`, `high >=15`). Performance
rating is shown only with at least five opponent ratings. A conservative next
target is the next 100-point rating milestone and is shown only at medium/high
confidence; otherwise the UI says the sample is insufficient. Accuracy is never
converted into a rating estimate.

## Openings and phases

Opening groups remain color-specific and use canonical ECO/name/variation. Each
entry reports population share, W/D/L, score, overall/recent Accuracy, average
WinPercent loss, error rate, representative games and up to three exact problem
positions.

Middlegame and endgame profiles report move count, Accuracy, recent Accuracy,
error rate and average WinPercent loss. Advantage preservation means a move that
started at least 70 mover WinPercent and remained at least 65. A defensive hold
means a move starting at most 30 that lost no more than two WinPercent points.
These are bounded decision metrics, not tablebase claims. Syzygy is not currently
used, so the product does not claim theoretical wins/draws or perfect conversion.

## Highlights, weaknesses and plan

Brilliant and Critical galleries use only V2 annotations retained by the
verification pass and keep exact game/ply links. Best-game highlights require at least ten player moves. Comeback and save
candidates require an observed position at or below 20 mover WinPercent followed
by a win or draw. Clean conversion requires an observed 75% advantage, a win and
no subsequent move losing five WinPercent points. These definitions are
deterministic and do not infer narratives from prose.

Weaknesses require at least two incidents across two games. They expose sample
size, game frequency, average loss, confidence, early-vs-recent trend and bounded
evidence. The top three create a deterministic plan backed by up to five exact
positions. `TrainingQueueItemV2` records only position-review progress; it does
not claim spaced repetition or a due-date model.

## Whole-history jobs

“Analyze my history” creates a persisted `HistoryAnalysisJobV1` with explicit
provider, account, date, time-control, rated and freshness scope. Games are
deduplicated by provider ID and PGN. Each item records queued/running/cached/
completed/failed/cancelled state and attempt count. Current cache entries are
reused; stale scope compares `objectiveAlgorithmVersion + depth`.

Jobs run with two bounded workers through the scheduler's lowest
`background-game` priority. Each game still owns one Stockfish worker, so the
browser runs at most two full-game engine tasks at once; interactive position
work keeps the higher scheduler priority. Results are persisted as each worker
finishes, even when another item later fails. Pause returns active items to
queued before aborting them. Refresh recovery changes a stranded running job to
paused and keeps completed items. Resume continues queued items, Cancel
preserves completed work, and Retry resets failed items only. Work exists only
while a browser tab is open; the UI never claims background execution after
shutdown.

An explicit “Import full history” action also creates (or reuses) an
`unanalyzed` job for that connected account and starts it without waiting for
the Settings page to stay mounted. Training polls the durable record while the
job is active, so completed games and cache hits become report data
incrementally. A failed item keeps its exact error text and can be retried on
its own; duplicate jobs with the same scope and game set are collapsed in the
Training list.

## Storage and large libraries

The canonical V2 payload remains in `objective-analyses`. A compact
`objective-analysis-index` stores hashes, engine/provenance data, player/phase
summaries, opening data, counts and an approximate byte size. Pre-index V2
records are backfilled one payload at a time. The Training player list reads only
review records plus projections; selecting a player then loads only matching
canonical analyses. Thousands of full records are therefore not eagerly mounted
to discover identities or coverage. On read, Training also repairs legacy
completed synced games whose cache and `SyncedGame` success marker exist but
whose external review record was not persisted, so an older bulk run is not
silently omitted from Overview. Pending or failed games are not promoted merely
because an identical PGN happens to share a cache entry.

Connected-player coverage is always scoped to that exact account even when the
bulk-analysis control is set to analyze all accounts. Opening is unavailable for
unanalyzed synced games, so an opening-filtered report discloses that coverage
still refers to the broader synced scope. Coverage also keeps Chess.com and
Lichess eligible/current/stale/failed counts separate.

The projection intentionally does not replace canonical move evidence. Reports
that need exact mistakes/highlights load the selected compatible population.
IndexedDB growth remains dominated by full Stockfish PV payloads; the projection
overhead is bounded to one small record per cache key and enables visible local
cache-size accounting.
