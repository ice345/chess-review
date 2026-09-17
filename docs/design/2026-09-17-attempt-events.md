Status: Proposal
Baseline: 2026-09-17

# Attempt events for Training

Date: 2026-09-17

Durable attempt records for the mistake-practice flow. Today, practice results
live only in the session (`useRetrospect` in
`apps/web/src/hooks/use-retrospect.ts`) and disappear when the browser tab
closes. This document states what a persisted attempt event would contain, how it
feeds the existing Training mastery ladder without weakening it, and what it
must never replace.

## Why

`docs/mistake-practice.md` ends with:

> Next: durable attempt records with backup/delete compatibility, then a
> training queue that schedules real attempts separately from source-position
> reviews.

A practice session produces real evidence — the visitor solved a position
unaided, or needed a hint, or viewed the solution. That evidence is lost today.
`AttemptEventV1` is the record that would make it durable.

## Evidence contract

One `AttemptEventV1` per practice attempt on one position:

| Field | Type | Description |
| --- | --- | --- |
| `version` | `1` | Event schema version |
| `id` | `string` | Unique event identifier |
| `gameId` | `string` | The game the position belongs to |
| `ply` | `number` | Zero-based ply of the fault move |
| `positionFen` | `string` | FEN of the prompt position (`fenBefore` of the fault ply) |
| `outcome` | `AttemptOutcome` | What happened: see below |
| `unaided` | `boolean` | True when the answer was not exposed and no hint was used |
| `timeMs` | `number` | Wall-clock milliseconds from prompt display to outcome |
| `hintsUsed` | `number` | Hints requested before the outcome (0 when unaided) |
| `attemptedUci` | `string \| undefined` | The move the visitor played, when one was played |
| `accepted` | `boolean \| undefined` | Whether the attempted move was accepted by the judge |
| `answerExposed` | `boolean` | Whether the analysis had been viewed before this attempt |
| `attemptedAt` | `string` | ISO timestamp of the attempt |

### Outcome values

These match the existing `ExerciseResultKind` in `use-retrospect.ts`:

| Value | Meaning |
| --- | --- |
| `"solved"` | The visitor played an accepted move |
| `"hinted"` | The visitor played an accepted move after using a hint |
| `"revealed"` | The visitor chose "View the solution" |
| `"skipped"` | The visitor chose "Skip" |
| `"unavailable"` | The engine could not judge the attempt (timeout, worker failure) |

### Identity and scheduling

The attempt's position identity is `gameId + ply`, the same key
`TrainingPositionReview` uses (`packages/shared/src/schema.ts`). The
`positionFen` is recorded for display and audit but is not the key. An attempt
event does not carry a `dueAt` field — scheduling is the mastery ladder's job;
the event records what happened, the ladder decides what it means.

## Feeding the mastery ladder

The fixed 1/3/7/21-day mastery ladder is documented in `docs/advanced-study.md`
§ "Reviewed is not mastered" and implemented in
`apps/web/src/lib/training-mastery.ts`. Its invariants:

- States are `learning → review → mastered`.
- Only an `unaided` review on a day the position had come due advances the
  streak.
- `MASTERED_STREAK` is 3 consecutive unaided reviews.
- `MASTERY_INTERVAL_DAYS` is `[1, 3, 7, 21]`.
- A review before the due date is recorded but does not advance state, streak
  or due date.

An `AttemptEventV1` feeds this ladder as follows:

| Attempt outcome | `unaided` | Ladder outcome | Effect |
| --- | --- | --- | --- |
| `solved`, not exposed, no hints | `true` | `unaided` | Streak +1, may promote |
| `solved`, after exposure | `false` | `exposed` | Streak 0, due tomorrow |
| `hinted` | `false` | `hinted` | Streak 0, due tomorrow |
| `revealed` | `false` | `exposed` | Streak 0, due tomorrow |
| `skipped` | `false` | — | Recorded, no ladder effect |
| `unavailable` | `false` | — | Recorded, no ladder effect |

The mapping is a deterministic function of the attempt fields and produces
exactly one `TrainingAttemptOutcome` (or none, for `skipped` and `unavailable`).
It does not introduce a new outcome value into the existing enum.

**The ladder is not modified.** The intervals, the streak rule, the
due-date-before-credit rule and the `masteryTransition` function are unchanged.
The attempt event is a new *input* to the existing transition, not a new
transition.

## Coverage rule

- An attempt event is written at the moment the practice session records the
  outcome — after the judge returns for a played move, or after the visitor
  chooses "View the solution" / "Skip". It is not written speculatively.
- A `skipped` or `unavailable` attempt is recorded for history but does not
  produce a mastery transition. The ladder only advances on evidence, and
  skipping is the absence of evidence.
- An attempt on a position that is not in the visitor's training queue is
  recorded as an event but does not create a queue entry. The practice session
  is broader than the training queue (it includes inaccuracies when the filter
  is on, and it covers both sides); forcing every practised position into the
  queue would conflate two scopes.
- When the position has no prior attempts, the UI states the count rather than
  suppressing it.

## Non-goals

- **No spaced-repetition algorithm replacing the documented ladder.** The fixed
  1/3/7/21-day schedule is the contract (`MASTERY_INTERVAL_DAYS`). No ease
  factor, no SM-2, no adaptive interval. The ladder is intentionally simple and
  the same history always produces the same due date.
- **No retroactive mastery from imported history.** An imported game's practice
  positions do not receive synthetic attempt events. Mastery starts from the
  first real attempt in this product.
- **No cross-device sync.** Attempt events live in IndexedDB alongside the
  training queue. The existing `library-backup.md` backup/restore mechanism is
  the transport; real-time sync is a separate concern.
- **No Elo estimation from attempt history.** An attempt is not a rated puzzle.
  The product does not claim a solving Elo from practice results.
- **No modification of objective analysis.** Attempt events cannot change
  Accuracy, classification, quality, annotations or any field owned by
  `packages/analysis`. They are session evidence, not evaluation evidence.

## Unresolved questions

1. Should `timeMs` include the engine's judging latency (up to 15s per
   `JUDGE_TIMEOUT_MS`), or only the time from prompt display to the visitor's
   move?
2. Should multiple attempts on the same position in one session each produce an
   event, or should only the first count? Today `use-retrospect.ts` keeps the
   first result per position.
3. Should `AttemptEventV1` events be included in the `library-backup.md` backup
   payload, or only the derived mastery state?
4. Should a practice attempt on a position in the training queue automatically
   satisfy its scheduled review, or remain separate per the current contract
   (`docs/mistake-practice.md` § "Deliberate limits")?
