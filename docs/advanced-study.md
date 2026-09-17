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
reports the latest known platform rating, the last-ten-game observed range, result
score, sample size and confidence (`low <5`, `medium 5–14`, `high >=15`). The
label **Estimated recent performance** is an Elo expected-score inversion using
the same games for both known result and opponent rating; it is shown only with
at least five matched games and is bounded to avoid extreme small-sample claims.
Missing result, player rating or opponent rating metadata is excluded from the
relevant estimate rather than silently mixed with another population. Accuracy is
never converted into a rating estimate.

Targets are deterministic and intentionally modest. With medium/high confidence,
the next 100-point milestone is shown; when the current rating is within 25 points
of that milestone, the UI shows **Stabilize** at the milestone and moves the
longer-term next target to the following 100-point milestone (for example,
1398 → stabilize 1400 → next target 1500). Low-confidence bands do not receive a
target.

## Openings and phases

Opening groups remain color-specific and use canonical ECO/name/variation. Each
entry reports population share, W/D/L, score, overall/recent Accuracy, average
WinPercent loss, error rate, representative games and up to three exact problem
positions.

Middlegame and endgame profiles share deterministic phase evidence but use
different emphasis: Middlegame highlights decision errors, average WinPercent
loss and missed opportunities; Endgame highlights winning-chance conversion,
defensive holds and missed wins/mates. Advantage preservation means a move that
started at least 70 mover WinPercent and remained at least 65. A defensive hold
means a move starting at most 30 that lost no more than two WinPercent points.
These are bounded decision metrics, not tablebase claims. Syzygy is not currently
used, so the product does not claim theoretical wins/draws or perfect conversion.

### Phase Accuracy is two different measures

Each phase profile carries machine-readable metric identity:

| Field | Value | Meaning |
| --- | --- | --- |
| `accuracyMetric.metricId` | `mean-move-accuracy` | the number is a mean of per-move Accuracy |
| `accuracyMetric.aggregation` | `arithmetic-mean-per-move` | every player move in the phase counts once; games are not weighted equally |
| `accuracyMetric.sampleGames` | count | games that contributed at least one move to this phase |
| `accuracyMetric.sampleMoves` | count | moves averaged |

This is **not** the canonical single-game phase Accuracy that Review shows for one
game, which is the Lichess-compatible phase score computed from that game's
WinPercent sequence. A cross-game mean of moves and a single game's phase score
answer different questions and can differ by several points, so the Training
surfaces label theirs **Average move Accuracy** and state the sample they were
averaged from. The overview's game-level figure is a mean of per-game Accuracy and
is labelled **Accuracy per game**.

Phase values are never zero-filled for a phase with no moves: `averageAccuracy`
and `recentAccuracy` stay absent and the UI renders `—`.

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
positions. `TrainingQueueItemV3` records explicit source-position review. Start
opens the first unreviewed decision; confirmation records game ID, ply and time
only after the source position and its objective evidence are displayed. Next
position and Continue resume from that ledger, including across games. Reopening
or confirming twice does not add credit. All source positions must be confirmed
for review completion; there is no scored answer, mastery or spaced repetition.

The separate [Mistake practice](mistake-practice.md) flow now lets users solve
errors within a single analyzed game. Its session-only results do not count as
Training V3 reviewed positions and do not yet schedule future reviews.

Saved tasks are visible independently of cache/report availability. Legacy V1/V2
manual completions are identified as manual, and their aggregate counts are not
converted to specific reviewed positions. Concurrent acknowledgements use a
transactional read-modify-write; a stale Add to queue cannot reset progress.
Deleting a source removes its references and acknowledgements while retaining
other progress. [Library backup](library-backup.md) preserves this ledger.

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
the Settings page to stay mounted. Training polls the durable job record every 1.5s while work is active so the
quiet status line can show `47 / 95 games analyzed · analysis running` on every
section. Full player-library and report rebuilds are throttled to about 8s and
run immediately when a job becomes terminal, so a completing game does not
reload every cached analysis. Incremental Home syncs keep their separate newest-game setting
and do not create a duplicate full-history run. A failed item keeps its exact
error text and can be retried on its own; duplicate jobs with the same scope
and game set are collapsed in the Training list. A later compatible job that
covers an older paused, queued or failed job for the same people and settings
supersedes it in the orchestration layer: the older run is cancelled with
`supersededBy` and hidden from the primary Coverage card, so a 5-game paused
resume cannot sit beside a 95-game partial of the same work. Structurally
invalid provider PGNs are excluded before queueing and, on retry, removed from
`items` so they cannot keep an otherwise complete range in Partial/Failed.

The Training page keeps the latest active/error run visible and nests older
finished runs under **Past analysis runs**. Successful game lists are collapsed by
default because the reports themselves are the useful result. Finished, failed
and cancelled run records can be removed with **Remove from history**, or in one
scoped **Clear finished runs** action. These operations delete only entries in
`history-analysis-jobs`; synced games, review records, Stockfish payloads,
projections and all Training aggregates remain intact. Active jobs must be
cancelled before their run record can be removed.

## Storage and large libraries

The canonical V2 payload remains in `objective-analyses`. A compact
`objective-analysis-index` stores hashes, engine/provenance data, player/phase
summaries, opening data, counts and an approximate byte size. Pre-index V2
records are backfilled one payload at a time. The Training player list reads only
review records plus projections; selecting a player then loads only matching
canonical analyses. Thousands of full records are therefore not eagerly mounted
to discover identities or coverage. On read, Training also repairs legacy
completed synced games whose cache projection exists but whose external review
record was not persisted, using a successful history item when one is available
(or the legacy cache-only path when no job record exists). Pending or failed
games are not promoted merely because an identical PGN happens to share a cache
entry.

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

## Per-game Study route

`/training` is this player-intelligence report. The per-game Study surface is
`/review/[gameId]/coach` (`CoachPanel`). It is a different task: one game's
lesson, not a cross-game profile.

That first screen is **action, then lesson, then provenance**:

1. The primary button is **Build whole-game study** (zh-CN: **生成本局总结**).
   Browser Core and a missing local service still offer that action. The screen
   says a summary can be built from this game's own analysis; it does not open
   as a service-status or failure page.
2. After generation, the lesson is the main reading. Internals such as
   `deterministic`, `canonical-facts` and bare confidence tokens stay inside
   **Why this explanation?**. Move references use chess notation (`10. Nxb5`),
   never `Ply N`. With `zh-CN` selected, Study teaching headings, buttons, empty
   states and fallback text are Chinese; outer review navigation stays English.
3. Provider, language and configuration sit last. A working facts fallback is
   not styled as an error.

When the game has no key moments, no Maia facts and no re-checked lines, Study
states that the summary is a numerical overview and offers a concrete check
instead of presenting the generic template as personalised guidance. Whole-game
generation remains lazy, on demand and abortable. See [ai-coach.md](ai-coach.md).

## Training leads with today's task

Opening Training used to lead with the report: statistics, scope filters and tabs
first, with the actionable task somewhere below. The page now renders one block
before both:

- the task to work on — the one already in progress, otherwise the
  highest-priority open one (`todaysTrainingTask`, `lib/training-queue.ts`), so
  the rule lives in one place and the queue below is not re-sorted by a second
  screen;
- why it was chosen, taken from the same report analysis the rest of the page
  shows, so the reason and the report cannot disagree;
- the progress the session itself recorded (`N / M positions reviewed`, `Reviewed
  means looked at, not mastered`) and the position that is next;
- one primary action, **Start today's review** / **Continue today's review**,
  which marks the task in progress and opens its next position. The rows in *Your
  review tasks* stay available for every task, but they no longer carry the
  page's primary emphasis.

`?player=` selects the population the visitor came from and `?task=` names the
task, which is what the end-of-review handoff links with; the block then says
"This is the task you came from." A `?task=` that is not in the current queue,
or that is already completed, is ignored rather than trusted. With nothing
queued, the block offers the top recorded weakness as a task to add; with no
weakness recorded either, it says what would produce one instead of inventing a
task.

Regression coverage: `apps/web/src/lib/training-queue.test.ts` states the
selection rule; `e2e/r3.spec.ts` asserts the block precedes the report, that its
action opens the task's own first position, and that the handoff link names the
task and reports the progress the session just made.

## Report gate and the run journal

The report is shown when the selected player has at least five games or when a
training task is queued. Below that population the page keeps today's task and the
run journal and folds the statistics: a report built from one imported game is a
set of empty aggregates, not evidence.

Two rules keep that gate from hiding work or moving under the visitor:

- The gate reads the player's own population, not the current filter population.
  Narrowing the scope to zero games leaves the report standing so it can say the
  scope is empty; it must not fold the page while a filter is being changed.
- The run journal is operational state, not statistics. Whenever a run exists it
  renders with its own controls (`Resume`, `Cancel`, `Remove`, `Clear finished
  runs`), including at a population too small for the report. The status line
  (`0 / 1 games analyzed · paused`) reports the run, so the control that continues
  it has to be reachable from the same page.

## Reviewed is not mastered

A training review records what the visitor did with the position, and mastery is built
only from that:

| Outcome | When | Effect |
| --- | --- | --- |
| `unaided` | the move was produced before the evidence was shown | streak +1, promotes |
| `hinted` | the move was reached with help | a lapse: streak 0, learned again, due tomorrow |
| `exposed` | the answer was already on screen | a review, never recall evidence: streak 0, due tomorrow |
| `legacy` | recorded before outcomes existed | kept as a review, never counted as mastery |

States are `learning → review → mastered`, and a position is mastered after three
consecutive unaided reviews, **each on a day the position had come due**. Only a review the
schedule is waiting for counts: reviewing a position again before it comes round records the
attempt and leaves the state, the streak and the due date untouched, because recalling a move
minutes after seeing it is not evidence of knowing it. Without that rule three clicks in one
sitting would earn mastery and the ladder would mean nothing. The schedule is a fixed ladder in days — 1, 3, 7, 21 —
chosen by the streak: the same history always produces the same due date, there is no
randomness and no hidden ease factor, and the panel states the date it chose.

The schedule is only meaningful if positions come round again, so:

- reviewing the same position again **updates its record** (`attempts`, streak, state and
  next due date) instead of being ignored, and the panel offers the outcome actions for a
  position that is due even though it was reviewed before;
- a task is **completed when every position is mastered**, not when every position has
  been looked at once. A task reviewed once per position stays open and says when its next
  review is due, so the ladder can actually run;
- `nextTrainingPosition` offers the position that has been waiting longest, then the first
  never-reviewed one, and nothing at all when everything is reviewed and nothing is due —
  the panel then says when to come back;
- `todaysTrainingTask` offers a task with due work before a task that was merely started;
- a library backup carries each review's outcome, mastery, streak, attempts and due date,
  so a restored library keeps its schedule instead of treating every review as due at once.

Training states `N due now` or the next due date, and a task row states
`mastered/reviewed`, never just "reviewed".

Regression coverage: `apps/web/src/lib/training-mastery.test.ts` states the ladder,
promotion, lapses, legacy records and the due query; `apps/web/src/lib/training-queue.test.ts`
covers the today rule; `apps/web/src/lib/r3-data.test.ts` covers the stored record, repeat
reviews, completion by mastery and the schedule surviving a backup round trip;
`e2e/r3.spec.ts` and `e2e/workflows.spec.ts` drive the panel through exposed and unaided
reviews and assert that Training reports `0/N mastered` and keeps the task open.

## Coverage describes the report's own population

`coverage` answers for the games the report describes: the filters are applied
before it is counted, for every player kind. It also names its own state.

- `empty` — no game matches the scope. There is nothing to cover, so the view says
  that instead of claiming complete coverage of zero games.
- `partial` — some eligible game is missing, stale or failed.
- `complete` — every eligible game in the scope has a current compatible analysis.

A manual import has no sync backlog to count, so its eligible population is exactly
the games the current filters select. Counting every analyzed game of the player
instead let the Coverage view claim "complete current analysis coverage: 5 of 5
games" while the report itself was describing none of them. Connected accounts count
their imported games, which is what the sync checkpoint describes.

Regression coverage: `packages/analysis/src/study-v2.test.ts` states the three
states and the rate for each; `e2e/workflows.spec.ts` asserts that a scope with no
games says it is empty and does not claim complete coverage.

## An imported account is a population before it is a report

A linked account appears in Training as soon as it has imported games, counted by
its imported population, even when none of those games has an objective analysis
yet. The report still waits for the minimum population, so the page shows today's
task, the run journal and — for an account whose games have not been analyzed — the
analysis start control (`Analyse imported games`, freshness, start). That action is scoped to the selected account, so it
queues work for the population the visitor is looking at. Without this rule an
account with 129 imported games and no analyses was invisible behind any manual
player that had one analyzed game, and the page could not reach the work that would
give the account a report.

Regression coverage: `apps/web/src/lib/advanced-study-library.test.ts` states that
an account with imported games is listed with an empty game list and keeps its entry
once a game is analyzed; `e2e/workflows.spec.ts` asserts the account is selectable,
the page stays folded, and the start control is reachable.

Regression coverage: `e2e/workflows.spec.ts` asserts the run journal and its
failure reasons at a two-game population, that a paused one-game run can be
resumed without opening another view, and that the report's own filter changes do
not fold the report (`apps/web/src/components/advanced-study-page.tsx`).
