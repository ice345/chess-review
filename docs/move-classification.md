# Move classification

Implementation: `packages/analysis/src/classification.ts`. Persisted objective
identity: `objective-v2.0` / `GameAnalysisV2`.

## Two independent results

Every move has one continuous objective `quality`:

- Best: engine top choice with at most 0.5 mover WinPercent loss, or checkmate.
  A move also counts as the engine's top choice when it preserves the top
  evaluation, even if MultiPV ordered it below rank 1. Rank alone would label a
  tied move "Excellent", because two moves can share the best score while only
  one of them can be rank 1. The tie test requires BOTH a negligible WinPercent
  loss (at most 0.1) AND a negligible centipawn loss (at most 5): in a decided
  position WinPercent saturates, so a move that is 100 centipawns worse can show
  zero WinPercent loss and must not be promoted to Best.
- Excellent: at most 2 WinPercent loss.
- Good: at most 5.
- Inaccuracy: at most 10.
- Mistake: at most 20.
- Blunder: more than 20.

The ladder is led only by mover WinPercent loss. Centipawn loss remains visible
evidence but cannot turn an outcome-equivalent move into an error. In particular,
a saturated +12 to +9 evaluation with effectively zero WinPercent loss is not a
Mistake or Blunder.

Independent `annotations` describe special semantics: Book, Forced, Critical,
Brilliant, Sacrifice, Missed win and Missed mate. The legacy `classification`
field is a compatibility projection for existing icons and exports. It does not
replace `quality + annotations` as the V2 contract.

`interesting` and generic tactical `miss` are never emitted by V2, and both stay
declared on purpose. For `interesting`, a rank-three move receives its ordinary
WinPercent quality, and locked tests assert that. For `miss`, the branch needs a
detected tactic: this project has no tactical motif detector (a move's `motifs`
only ever holds `"sacrifice"`), and the historical `hasTacticalBestLine` input was
never assigned in any revision, so `miss` was unreachable from the first commit.
It remains in the taxonomy because AGENTS.md lists it and the study and coach
layers treat it as a costly label. Missed win and Missed mate remain reachable
from explicit engine outcome facts.

## Evidence

`ClassificationReason` stores mover WinPercent before/after/loss, cp loss when
both scores are cp, real engine rank when present, top-two outcome/cp gaps,
legal-move and triviality facts, outside-MultiPV state, sacrifice evidence,
engine-consistency evidence, verification status and exclusions. An
outside-MultiPV move has no invented rank. Its score comes from a restricted UCI
`searchmoves` root search.

Static Exchange Evaluation is legality-aware. `chess.js` `attackers()` is purely
geometric, so before the exchange loop every candidate attacker is tested by
virtually playing the capture and checking whether it would leave the mover's own
king attacked. An absolutely pinned piece is therefore counted as neither an
attacker nor a defender. Without this the exchange value is inflated, which
fabricates sacrifice evidence and can mislabel an ordinary recapture as Brilliant.

The chosen move's root score and the independent resulting-position score remain
separate. Their absolute White-POV WinPercent delta is recorded with a five-point
tolerance. Inconsistency requests verification; it never causes one score to be
silently substituted for the other.

## Critical

Critical means an engine-best choice whose second-best candidate is at least ten
mover WinPercent points worse. A cp gap alone is insufficient. Only-legal moves,
obvious recaptures and trivial check escapes are excluded. A decided position can
therefore contain a large cp gap without receiving Critical when the outcome gap
is negligible. The compatibility classification for Critical is `great`.

## Brilliant

Brilliant requires all of the following:

- engine rank one and at most one WinPercent loss;
- a genuine material investment established by the deterministic sacrifice detector;
- a played root PV with an opponent best response, objective compensation and no immediate material recovery;
- a top-two outcome gap of at least five WinPercent;
- more than one legal move and no obvious recapture or trivial check escape;
- a non-decided position, between 3 and 97 mover WinPercent.

Full product orchestration first builds baseline candidates, then re-searches a
bounded selection at greater depth and MultiPV=5. The final record marks retained
special candidates `verified`. The pure assembler can still expose a baseline
candidate for deterministic planning and tests; browser persistence occurs only
after the verification pass completes.

## Selective verification

`planObjectiveVerification()` selects at most 12 moves, with a minimum budget of
four when candidates exist. Reasons are high-impact annotations, a quality
threshold within one WinPercent point, played-score inconsistency, low-depth
evidence and unstable candidate order. Verification uses at least depth 15,
three plies deeper than baseline up to depth 20, and MultiPV=5. The final analysis
is rebuilt from the stronger before/after roots and restricted played-move result.
Restricted evidence is recomputed against the final merged roots: a re-searched
resulting position is also the next ply's root and may no longer list that ply's
played move, so the transport supplies a fresh `searchmoves` override for it.

The locked regression corpus is
`packages/analysis/src/fixtures/classification-v2-golden.ts`. It covers the former
rank-three Interesting bug, saturated evaluations, Critical outcome uniqueness,
outside-MultiPV rank absence, missed mate and verified sacrifice semantics. The
tied-best rule and the pinned-piece SEE case are pinned by
`classification.test.ts` and `sacrifice.test.ts`.
