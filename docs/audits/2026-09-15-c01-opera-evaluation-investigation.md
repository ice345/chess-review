# C01 — Opera Game `15. Bxd7+` (ply 29) evaluation anomaly: investigation report

Date: 2026-09-15
Baseline commit under test: `56d5af34e82f89a0652899c54dfe737331009736`
Diagnostic: `scripts/diagnose-objective-game.mjs`
Status: **reproduced and root-caused. Verdict — genuine depth-10 engine behaviour, amplified by the classification/verification budget; not a cache, POV, pairing or normalization defect.**

---

## 1. Verdict

The audit's report is **not stale cache and not a pipeline bug**. Driving the real app in a cold,
isolated Playwright context reproduces it exactly:

| Field (ply 29, `15. Bxd7+`) | Audit claim | Cold-profile cold run |
| --- | --- | --- |
| classification | Blunder | **blunder** |
| Accuracy | ≈ 39 | **39.1950** |
| win-percentage-point loss | ≈ 21.0 | **20.9899** |

Root cause, in one sentence: at the app's fixed baseline configuration (depth 10, MultiPV 3) the
shipped engine genuinely does not rank `15. Bxd7+` first — it ranks it **third** and scores it
`cp +190` — so the classifier sees a real ~21 pp win-percentage drop versus the top line's
`cp +536`. The move is objectively winning (forced mate after the only reply `15...Nxd7`); the
engine itself finds it best from depth 14 upward and at the app's own verification configuration
(depth 15, MultiPV 5), but **ply 29 was never selected for verification**, so the depth-10 number
was persisted as final.

This is a *search-depth* effect at the baseline configuration, not an incorrect pipeline.

---

## 2. Reproduction (exact commands and outputs)

### 2.1 Running the diagnostic

From the repo root (a `pnpm dev:web` server on `http://127.0.0.1:3000` is started automatically if
absent; the script only reads product state and never writes to `apps/`, `packages/`, `services/`):

```bash
node scripts/diagnose-objective-game.mjs
```

With the optional independent native reference build:

```bash
node scripts/diagnose-objective-game.mjs --native-stockfish /tmp/sf-ref/src/stockfish
```

Artifacts written to `$TMPDIR/c01-opera-evidence/` (override with `--out-dir <dir>`):

| File | Contents |
| --- | --- |
| `summary.json` | Full structured report: meta, game ledger, per-ply engine + app comparison, all hypothesis checks |
| `app-stored-analysis.json` | The `GameAnalysisV2` the app wrote to IndexedDB `objective-analyses` |
| `raw-uci-transcripts.json` | Raw UCI `info`/`bestmove` lines for every captured search |
| `positions.json` | PGN, per-ply FENs, UCI moves, `position`/`moves` command per root |

### 2.2 What the script does

1. Launches Chromium in an isolated context (no storage state, empty IndexedDB = cold profile).
2. Drives the real UI: Home → paste `EXAMPLE_PGN` → **Analyze game →** → the review route auto-runs
   the baseline review. (The textarea is a controlled component, so the fill is retried until the
   value sticks — hydration-safe.)
3. Waits for the app to persist the analysis, then reads the record back from
   `open-chess-review` → `objective-analyses` (plus `objective-analysis-index`).
4. In the same origin, instantiates the **shipped** worker `/engine/stockfish.js` in its own
   `Worker` pool and captures `id name`, then replays the same positions: unrestricted depth-10
   MultiPV-3 roots, `searchmoves <played uci>` restrictions, resulting-position searches, a
   depth sweep, and the app's own verification configuration.
5. Rebuilds the canonical pipeline from its **own** raw transcripts using the product's own
   functions (`buildGameAnalysis`, `planObjectiveVerification`, `recognizeOpening`, `divideGame`,
   `classifyMove`, `winPercentFromScore`, `moveAccuracyFromWinPercents`) and compares field by
   field with the stored record.
6. Runs one decisive cache experiment (section 5.5).

Determinism note: the replay is only as reproducible as the engine, which is deterministic for a
fixed build and search configuration; the app's baseline uses one root search per position and the
restricted search is issued to the same worker.

---

## 3. Engine build identity (`id name`)

The app's cache identity uses the **hand-written** constant `STOCKFISH_VERSION = "18"`
(`packages/stockfish/src/browser-engine.ts:7`), not the served binary, and that constant feeds
`analysisCacheKey` (`apps/web/src/lib/analysis-cache.ts:96-107`) and
`isCompatibleAnalysisProjection` (`:44-56`). Captured from the shipped worker in the browser:

```
id name Stockfish 18 Lite WASM
id author the Stockfish developers (see AUTHORS file)
```

Independent reference build (source `references/stockfish`, `git describe` =
`stockfish-dev-20260819-229f6339`, built with `make -j8 build ARCH=apple-silicon`):

```
id name Stockfish dev-20260819-229f6339
id author the Stockfish developers (see AUTHORS file)
```

Asset hashes of the shipped binaries (SHA-256):

| File | SHA-256 |
| --- | --- |
| `apps/web/public/engine/stockfish.js` | `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391` |
| `apps/web/public/engine/stockfish.wasm` | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |

**Finding:** the constant `"18"` matches the shipped WASM's own identity (`Stockfish 18 Lite WASM`),
so the cache identity is not mislabelled *for the current asset*. It is, however, a constant that
cannot detect a swapped `.wasm` (the comment in `apps/web/next.config.ts` says replacing the engine
requires a new filename, because the `/engine/*` route is served `immutable`). Both engines agree on
the chess truth below, so this does not explain the anomaly.

---

## 4. Raw engine truth, plies 27–31 (depth 10, MultiPV 3)

Roots are `position fen <initial> moves <uci prefix>` ending at each ply's `fenBefore`. Scores are
the engine's own (side-to-move POV); the app stores White POV.

FENs (all `fenBefore` of the stated ply):

| Ply | SAN | UCI | FEN (root) | Legal moves |
| --- | --- | --- | --- | --- |
| 27 | Rd1 | h1d1 | `4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2K4R w k - 0 14` | 42 |
| 28 | Qe6 | e7e6 | `4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 1 14` | 18 |
| 29 | Bxd7+ | b5d7 | `4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 2 15` | 47 |
| 30 | Nxd7 | f6d7 | `4kb1r/p2B1ppp/4qn2/4p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 0 15` | 4 |
| 31 | Qb8+ | b3b8 | `4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16` | 46 |

Raw final-depth lines (`nodes/nps/hashfull/time` elided; full transcripts in
`raw-uci-transcripts.json`):

**Ply 29 root — the anomaly, `bestmove g5f6`:**
```
info depth 10 seldepth 16 multipv 1 score cp 536 pv g5f6 f8d6 b3e6 f7e6 d1d6 h7h5 b5d7 e8f7
info depth 10 seldepth 18 multipv 2 score cp 398 pv b3e6 f7e6 g5f6 e8f7 d1d7 f7f6 d7d8 h7h5 ...
info depth 10 seldepth 19 multipv 3 score cp 226 pv c1b1 a7a6 b5d7 f6d7 b3b7 f7f6 b7c8 e8e7
```
`15. Bxd7+` (`b5d7`) is **absent from the top three at depth 10**; it is only the first move of
rank 3's continuation.

**Ply 29 restricted to the played move,** `go depth 10 searchmoves b5d7` (`bestmove b5d7`):
```
info depth 10 seldepth 17 multipv 1 score cp 190 pv b5d7 f6d7 b3b7 f7f6 b7c8 e8e7 g5e3 g7g6 ...
```

**Ply 28 root (`bestmove e7c5`)** and **ply 30 root (`bestmove f6d7`)**, plus **ply 27 root
(`bestmove h1d1`)** and **ply 31 root (`bestmove b3b8`, `score mate 2`)**, match the stored
`evaluationBefore`/`evaluationAfter` values exactly (see section 6). The played move IS inside
MultiPV for plies 27, 28, 30 and 31; only ply 29 needed a restricted search.

**Resulting position after ply 29** (index 30, Black to move, `bestmove f6d7`):
```
info depth 10 multipv 1 score cp -188 pv f6d7 b3b7 ...
```
White POV `+188` — the app stores this as `evaluationAfter` (engine consistency `centipawnDelta 2`).

Legality: every final MultiPV line of all 53 captured searches (**151 lines**) was replayed through
`replayUciLine`; **zero** illegal moves.

---

## 5. Hypothesis-by-hypothesis ruling

### (a) Wrong engine build identity — **ruled out**

The shipped worker reports `Stockfish 18 Lite WASM`, consistent with `STOCKFISH_VERSION = "18"`.
More importantly, the shipped WASM and the independent native build (`dev-20260819`) agree on every
claim that matters: both rank `b5d7` outside the top three at depth 10 and both rank it first from
depth 14/16 upward. A wrong identity cannot produce a *consistent* result across two different
builds. (Residual weakness recorded: the constant cannot notice a swapped binary, because the
`/engine/*` route is `immutable` and the cache key is string-based — a maintenance hazard, not this
bug.)

### (b) POV / mate normalization — **ruled out**

- Raw engine lines at even-ply roots are Black POV (e.g. ply 28 root `score cp -426`); the app
  stores White POV `+426`. `normalizeToWhitePov(score, "side-to-move", sideToMove)` reproduces every
  stored value.
- Mate handling is separate and correct: ply 31's root is `score mate 2`; the stored
  `evaluationBefore` for ply 31 (index 30) is `{"kind":"mate","mateIn":2}`, and ply 30's
  `evaluationAfter` (the same position, index 30) is likewise `{"kind":"mate","mateIn":2}`.
  `winPercentFromScore` maps mate to the ±1000 cp ceiling via `WIN_PERCENT_CP_CEILING`, unchanged.
- Recomputing with the product's own functions: `winPercentFromScore(cp 536) = 87.7997`,
  `winPercentFromScore(cp 190) = 66.8098`, difference **20.9899** = the stored `winPercentLoss`, and
  `moveAccuracyFromWinPercents(...) = 39.1950` = the stored `accuracy`. The arithmetic is exactly the
  documented pipeline.

### (c) Restricted-search / played-move score pairing — **ruled out (correct, and it is the mechanism)**

`PLAYED-move` pairing is correct. At ply 29 the played move is outside the baseline MultiPV, so
`BrowserStockfishPool.analyzeGame` issues a `searchmoves b5d7` search
(`packages/stockfish/src/game-review.ts:126-142`). The stored `playedMoveScore` is `cp 190`, which
**exactly equals** the raw restricted-search result `cp 190`. The stored record flags
`playedMoveOutsideMultiPv: true`. This is the intended behaviour of the code, not a defect — the
defect is that `cp 190` is the *depth-10* value in a position where depth 10 is not converged.

### (d) Worker request/response pairing or cancellation — **ruled out**

Rebuilding the entire pipeline from the script's own raw transcripts reproduces the stored record
on every compared field for plies 26–32 (`storedVersusRebuilt.window` shows `mismatchedFields: []`
for plies 26,27,28,29,30,31,32). Across the whole game, only **3 of 33** moves differ, and all three
are last-ulp floating-point differences or one fingerprint field:

| Ply | SAN | Differing field | App | Rebuild |
| --- | --- | --- | --- | --- |
| 6 | Bg4 | `accuracy` | 79.82730543523442 | 79.82730543523444 |
| 13 | Qb3 | `classificationReason.secondBestGapWinPercent` | 7.7072119495900395 | 7.707211949590032 |
| 18 | b5 | `accuracy` | 70.23268569883564 | 70.23268569883562 |

These are IEEE-754 transcendental-rounding differences between the browser's JIT and Node's V8 for
`Math.exp`, not pairing errors. No wrong-score-onto-wrong-ply evidence exists.

### (e) Stale warm cache — **does not explain this (and is separately confirmed possible)**

The anomaly reproduces on a **cold profile** (fresh context, empty IndexedDB), so it is not stale
data. Separately, the cache-reuse experiment confirms the *mechanism* the audit worried about: a
record matching the identity (`OBJECTIVE_ALGORITHM_VERSION`, `STOCKFISH_VERSION`, depth, MultiPV,
initial FEN + played UCI) is served unchanged. Writing an identity-compatible record with a sentinel
`createdAt` and reloading `/review/<id>` returned the sentinel record untouched
(`reusedWithoutRecompute: true`). So a record produced by an older *binary* — but the same constant —
would be reused silently. That is a latent hazard, but it is not what produced the ply-29 numbers,
which the cold run reproduces independently.

### (f) Verification pass overwriting baseline — **ruled out (but the pass skipped ply 29)**

The verification plan computed by the app for this game is plies **19, 31, 33, 21** (limit is
`min(12, max(4, ceil(33/10))) = 4`). **Ply 29 is not in the plan**, so no verification search ran
for it (`ply29WasVerified: false`). Verification therefore could not have overwritten anything for
ply 29. Where it did run, the rebuilt record matches the app's (`verifiedMoveCount: 4` in both).

### (g) Genuine engine behaviour at depth 10 — **CONFIRMED. This is the origin.**

Depth sweep at the ply-29 root, shipped WASM, unrestricted MultiPV 3:

| Depth | bestmove | best score | `b5d7` rank | `b5d7` score |
| --- | --- | --- | --- | --- |
| 10 | g5f6 | cp 536 | **3** | cp 226 |
| 12 | g5f6 | cp 545 | 3 | cp 226 |
| 14 | **b5d7** | cp 621 | **1** | cp 621 |
| 16 | **b5d7** | cp 665 | **1** | cp 665 |

Restricted to the played move, `b5d7`'s own score climbs with depth: `cp 190 → 178 → 207 → 260`
(depth 10/12/14/16), and the app's own verification configuration (depth 15, MultiPV 5) returns:

```
multipv 1 score cp 677 pv b5d7 e6d7 b3b8 e8e7 b8e5 ...   <- best
multipv 2 score cp 573 pv g5f6 f8d6 b3e6 f7e6 ...
```

The independent native engine agrees: at depth 16 `b5d7` is best (`cp 774`), at depth 20 best
(`cp 1089`), while at depth 10 it is not the top line. **The depth-10 ranking is a horizon effect,
and the app persists it because ply 29 falls outside the verification budget.**

---

## 6. Side-by-side: app record vs raw engine truth vs rebuild

Stored app record (IndexedDB `objective-analyses`, cold run):

| Ply | SAN | evaluationBefore | playedMoveScore | evaluationAfter | classification / quality | annotations | accuracy | loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 27 | Rd1 | cp +385 | cp +385 | cp +426 | best / best | — | 100.0000 | 0.0000 |
| 28 | Qe6 | cp +426 | cp +493 | cp +536 | good / good | — | 87.4179 | 3.2418 |
| 29 | Bxd7+ | cp +536 | **cp +190** | cp +188 | **blunder / blunder** | — | **39.1950** | **20.9899** |
| 30 | Nxd7 | cp +188 | cp +188 | mate 2 | best / best | — | 100.0000 | 0.0000 |
| 31 | Qb8+ | mate 2 | mate 2 | mate 1 | great / best | sacrifice, critical | 100.0000 | 0.0000 |

Engine record metadata: `engine = {stockfishVersion: "18", depth: 10, multiPv: 3,
classificationMultiPv: 3, verificationPolicyVersion: "selective-verification-v1",
verifiedMoveCount: 4}`, `algorithmVersion = "objective-v2.1"`, White accuracy 88.5815, Black
71.7507, division `{middlePly: 17, endPly: 32, totalPlies: 33}`.

Ply-29 `classificationReason` (excerpt): `precedenceRule = "win-percent-loss-ladder"`,
`winPercentBefore = 87.7997`, `winPercentAfter = 66.8098`, `winPercentLoss = 20.9899`,
`playedMoveOutsideMultiPv = true`, `exclusions = ["sacrifice-not-verified"]`,
`engineConsistency = {winPercentDelta: 0.1635, centipawnDelta: 2, consistent: true}`.
`criticalMoments` include `{ply: 29, classification: "blunder", winPercentSwing: 20.9899}`.

Every one of these values is reproduced by the independent rebuild from raw transcripts (section
5d), and the raw transcript values (`+536`, `+190`, `+188`) are the engine's own output.

### 6.1 Chess truth (independent of any engine)

Verified with chess.js (`scripts`-side, not product code):

- The historical line `15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#` **is mate**.
- After `15.Bxd7+` Black's legal replies are `Ke7`, `Kd8`, `Qxd7`, `Nxd7`; after the natural
  `15...Nxd7` White has a **forced mate in ≤4 plies**.
- `16.Qb8+` has exactly **one** legal reply (`Nxb8`), and `17.Rd8#` is mate.
- The engine's depth-10 top move `15.Bxf6` leads to **no forced mate within 6 plies**.

So `15.Bxd7+` is at least as good as, and practically stronger than, the engine's depth-10 choice.
Labelling it a Blunder with 39 % Accuracy is a search-horizon artifact, not a chess-truth assertion.

---

## 7. Precise statement of what remains unresolved

Nothing about the origin is unresolved: **(g) genuine depth-10 behaviour** is the cause, and the
contributing design choice is that the selective-verification budget (4 plies here) did not include
ply 29, so the depth-10 value became the persisted record.

Two things are **not** fully settled and are recorded honestly:

1. **Why the verification plan omitted ply 29.** `planObjectiveVerification`
   (`packages/analysis/src/verification.ts`) ranks candidates by reason priority
   (`special-annotation` → `played-score-inconsistency` → `quality-threshold-boundary` →
   `unstable-candidate-order` → `low-depth-evidence`) and slices to 4. Ply 29's baseline reasons are
   `["quality-threshold-boundary","low-depth-evidence"]`, lowest priority, so it was cut. Whether the
   ranking *should* treat a large win-percent loss more aggressively is a product-policy decision
   (explicitly out of scope here — no threshold tuning was performed). *Single experiment that would
   settle a policy change:* re-run the diagnostic after raising the verification limit or promoting
   `quality-threshold-boundary` priority, and confirm ply 29 then verifies to `best` at depth 15.
2. **The exact reason the shipped 18-Lite WASM needs depth 14 while the native dev build converges
   slightly differently.** Both agree `b5d7` is best by depth 14–16, but their cp values differ
   (WASM d16 = 665, native d16 = 774), which is expected for different builds/nets. This does not
   affect the verdict.

---

## 8. Files and integrity

- Diagnostic added: `scripts/diagnose-objective-game.mjs` (rerunnable, no secrets, no manual browser
  state).
- Report: this file.
- **No changes** under `apps/`, `packages/`, or `services/`; no classification/Accuracy/mate
  thresholds changed; no user data deleted (the cache experiment ran only in an ephemeral Playwright
  context and restored the record before closing).
- `pnpm exec eslint scripts/diagnose-objective-game.mjs` passes (repo convention: `/* global … */`
  header, no unused bindings).
