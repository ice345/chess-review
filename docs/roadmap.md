# Roadmap

## Free/open-source Web release — R1–R5 + S1 (2026-09-08)

R1–R5 have been implemented and locally verified. S1 adds personal notebooks and
fixes section navigation and export failure feedback. Chess algorithms and their
semantics are unchanged.

**Visual status (2026-09-13).** The palette and board are no longer the pre-release
values: the Windowlight pass converged the light theme and the authored piece set
into the production system (board `#eee8d9` / `#b1c6c2`, Feather Porcelain pieces,
tokens in `apps/web/src/app/styles/tokens.css`). PNG export and the promotion
chooser now render the same piece family as the board, with a Unicode fallback for
the Classic set or an undecodable asset. The mobile companion shares the same board
appearance and board tokens; only its own shell palette and the piece assets are
still separate. The follow-up UI/UX/layout sweep covered 12 routes over 7 viewports
and fixed the phone overflow, practice `Filters` affordance, Study touch targets,
phase-label size and Home phone rows. What remains is scoped, not open-ended: three
low-severity items (checkbox and inline-link touch sizes, the practice CTA
alignment) wait for the next forms/art-direction review, and a dark theme is a
future feature rather than an inverted Windowlight.

The first public release is free Browser Core, with local browser storage and
portable backups. Payment, accounts, cloud sync and hosted AI are not launch
requirements. Real Debian NUC / Cloudflare HTTPS / OAuth / physical-device
acceptance is still required; local test results are not proof of public launch.
The phases below are implementation history, not an independent current backlog.

## Phase 0 — runnable baseline

- [x] pnpm monorepo and canonical package boundaries
- [x] PGN/FEN parsing
- [x] responsive board and move navigation
- [x] Stockfish 18 WASM current-position MultiPV
- [x] build-time 3,810-position Lichess opening index
- [x] structural Divider display

## Phase 1 — objective review

- [x] White-POV score types and UCI normalization
- [x] canonical WinPercent port and tests
- [x] Lichess game Accuracy port and tests
- [x] Divider port and tests
- [x] explainable classification contract and initial rules
- [x] full-game bounded Stockfish queue, progress and cancellation
- [x] played-move search when outside MultiPV
- [x] full `GameAnalysisV1` assembly and IndexedDB cache
- [x] full lichess opening dataset build and transposition fixture
- [x] SEE/best-response/PV sacrifice evidence
- [x] phase Accuracy integration and initial critical moments
- [x] evaluation graph

## Phase 2 — review presentation

- [x] shared quality icon language in move list, board and summary
- [x] orientation-aware destination-square badge
- [x] Overview and Moves panels
- [x] overall/phase Accuracy and classification summary
- [x] critical-moment navigation
- [x] graph-to-board synchronization
- [x] annotated PGN and canonical JSON export
- [x] position/game-review PNG cards

## Phase 3 — human analysis

- [x] pinned optional Maia-3 FastAPI provider and graceful availability status
- [x] rating/model selector and current-move human analysis
- [x] human candidates, played-move probability and human WDL
- [x] experimental Human Find Difficulty with evidence
- [x] Stockfish/Maia comparison UI

## Phase 4 — coach

- [x] versioned structured move/game coach facts
- [x] provider-neutral Ollama and OpenAI Responses-compatible adapters
- [x] lazy move explanation and whole-game summary endpoints
- [x] strict JSON-schema validation and structured provider errors
- [x] canonical-PV prefix and sequential move-legality validation
- [x] unsupported human/tactical claim removal and grounding report
- [x] training recommendations and deterministic browser fallback
- [x] Objective/Human/Coach-separated UI with provider, language and model controls
- [x] IndexedDB persistence with prompt-version invalidation

## Phase 5 — connected review and product design

- [x] polished Home / Import route
- [x] import-to-review navigation and persisted review IDs
- [x] normal-document Review workspace with a prominent board and Game Summary timeline
- [x] persistent board across review sub-routes
- [x] Review / Moves / Study route separation with Human Lens inside Review
- [x] advanced Engine Lab separation
- [x] simplified export controls
- [x] compact critical moments
- [x] History and Settings routes
- [x] responsive desktop/tablet layouts
- [x] full visual hierarchy and accessibility pass
- [x] managed local development startup with browser-only alternative
- [x] independent current-position line count and displayed PV length
- [x] on-demand browser MultiPV with deterministic engine cache reuse
- [x] rules-validated SAN and temporary variation navigation
- [x] original light editorial palette, board colors and annotation-style quality icons
- [x] concise Human/Coach service copy with automatic runtime reconnection
- [x] provider-neutral connected-account boundary
- [x] Chess.com public username linking and incremental Published Data API sync
- [x] Lichess OAuth 2 Authorization Code + PKCE with S256 and encrypted HttpOnly session storage
- [x] account-aware default board orientation with persisted manual override
- [x] synced-game library and source/status/time-control/result filters
- [x] optional sequential newest-1/3/5 objective analysis policy, off by default

## Phase 5.1 — analysis workspace refinement

Phase 5.1 is a product-completion gate between the connected web product and the
desktop shell. Checkboxes describe shipped, tested behavior; architecture notes
alone do not complete an item.

### Milestone A — workspace architecture

- [x] document the immutable canonical-game / interactive-analysis boundary
- [x] split ReviewShell engine and presentation responsibilities
- [x] reuse canonical `winPercentFromScore()` in the evaluation bar with regression tests
- [x] disable the Next.js development Route Info indicator through supported configuration

### Milestone B — board workspace

- [x] player strips with orientation-aware top/bottom identity
- [x] icon-only accessible board flip outside the board
- [x] orientation-aware evaluation-bar presentation without changing White POV truth
- [x] board-width First / Previous / Play-Pause / Next / Last transport
- [x] autoplay with end-of-game and variation pause behavior
- [x] board plus scroll-aligned Game Summary timeline and contextual secondary column
- [x] manual desktop visual validation at 1440×900, 1728×1117 and 1920×1080

### Milestone C — Stockfish interactive analysis

- [x] selectable Stockfish MultiPV arrows with compact supporting text
- [x] real branch tree rooted at an explicit canonical ply
- [x] rules-validated user moves from any historical position
- [x] branch continuation and reliable Return to Game
- [x] branch-position Stockfish analysis without canonical classification mutation
- [x] deterministic branch/store regression tests

### Milestone D — Human Lens

- [x] persisted preferred Maia target Elo
- [x] direct Stockfish / Maia analysis selection in Review (expanded by Phase 5.2)
- [x] Maia probability arrows with explicit model-prediction semantics
- [x] Stockfish/Maia recommendation disagreement as first-class evidence
- [x] Maia target Elo and candidate evidence merged into Review; Human Lab removed
- [x] offline Maia behavior validated

### Milestone E — connected library

- [x] account cards with avatar and useful rating/profile information
- [x] Chess.com complete archive import with checkpoints
- [x] Lichess complete history import with rate-limit-aware checkpoints
- [x] persistent progress plus cancel/resume for both providers
- [x] simplified connected identity on Home
- [x] paginated or virtualized Library suitable for thousands of games
- [x] no automatic Maia or Coach analysis; explicit full-history imports queue objective Stockfish work only

### Milestone F — grounded Coach refinement

- [x] broader deterministic position-understanding facts
- [x] validated short future-consequence line in move teaching
- [x] structured notice / idea / problem / consequence / alternative / takeaway presentation
- [x] practical human alternative only when supported by Stockfish and Maia
- [x] existing schema, legality, unsupported-claim and grounding safeguards preserved

### Milestone G — visual identity

- [x] initial original move-quality icon refinement (later replaced by the geometric V3 system)
- [x] original Blue Bishop logo, app mark and favicon
- [x] final board/review visual polish and coherent export language

### Milestone H — engineering quality

- [x] decompose global CSS while preserving design tokens
- [x] bounded priority policy for interactive and background analysis jobs
- [x] deterministic Playwright workflow coverage
- [x] representative visual-regression screenshots
- [x] dependency-cached GitHub Actions CI without live external services
- [x] root README with architecture, modes, integrations and development workflow
- [x] complete TypeScript, Python, E2E, build and manual visual validation
- [x] final Phase 5.1 workflow audit before Phase 6 begins

Phase 5.1 closed on 2026-08-24 after frozen dependency installation, complete
TypeScript typecheck/lint/package tests, 18 local-ai tests, five deterministic
Playwright workflow/visual tests, a production Next.js build, diff/whitespace
audit, and manual review of the seven committed workspace screenshots. The gate
did not change canonical Accuracy, Divider, WinPercent, White-POV or move-quality
classification semantics.

## Phase 5.2 — dual analysis semantics and review polish

Phase 5.2 was inserted as a repair gate after the Phase 3 and Phase 5.1 audit.
It separates the already-played move from the exact position currently displayed
and verifies shipped behavior rather than preserving ambiguous or aspirational
checkboxes.

### Milestone A — explicit Maia contracts

- [x] `MaiaMoveReview` keyed by canonical `fenBefore + played UCI + model + target Elo`
- [x] `MaiaPositionAnalysis` keyed by exact displayed FEN, model and target Elo
- [x] exact played-move policy probability/rank and played-move WDL
- [x] exact-position root WDL from the side-to-move perspective
- [x] stale-request protection across ply, branch, model and Elo changes
- [x] identity-checked `human-v2` move persistence in IndexedDB
- [x] mismatched human and dependent Coach enrichment invalidation

### Milestone B — real source modes

- [x] Stockfish, Maia and Compare modes with distinct arrows and verdicts
- [x] source-aware evaluation bar: canonical Stockfish WinPercent, Maia root WDL, Compare marker
- [x] objective Move Quality remains separate from Human Find Difficulty
- [x] Move Quality summary remains discoverable in ordinary Review
- [x] branch positions never invent a played-move verdict

### Milestone C — model selection and bounded inference

- [x] real Maia-3 5M / 23M / 79M setting wired through requests and persistence
- [x] per-tier health/setup status and explicit checkpoint download action
- [x] no checkpoint download during selection or analysis
- [x] one resident Maia model with release-before-allocation tier switching
- [x] one all-legal root policy pass and bounded candidate-value union
- [x] root and candidate human-game WDL exposed without centipawn reinterpretation

### Milestone D — visual and stylesheet completion

- [x] distinct objective motif groundwork across every classification (later replaced by V3)
- [x] quieter Human Find Difficulty mark family
- [x] shared icon semantics across board, lists, summary, graph and PNG export
- [x] 14-label visual fixture at 20/24/28/36 px on paper and board backgrounds
- [x] remove stale global review CSS and assign shell/workspace/panel/semantic ownership
- [x] regression guard for duplicate review selector owners

### Milestone E — acceptance gate

- [x] deterministic move-N / position-N request-alignment coverage
- [x] model/Elo invalidation, IndexedDB restoration and Coach-fact coverage
- [x] offline Browser Stockfish fallback and explicit model-setup coverage
- [x] all semantic browser workflows and existing visual baselines preserved
- [x] complete icon-gallery visual baseline added and manually reviewed
- [x] objective Accuracy, Divider, WinPercent, White-POV and classification semantics unchanged

Phase 5.2 closed on 2026-08-24 after the contract, persistence, Coach, CSS and
visual audits passed. The repair gate is complete, so work may continue on the
remaining Phase 6 desktop items without inheriting the ambiguous Maia semantics.

## Phase 5.3 — interaction semantics, Study boundary and Move Quality V3

Phase 5.3 is a focused repair gate over the shipped Phase 5.2 workspace. It does
not change Accuracy, Divider, WinPercent, White-POV score handling, objective
classification or Human Find Difficulty.

### Milestone A — exact interaction identity

- [x] remove destination-square Stockfish/Maia candidate lookup
- [x] make board arrows visual hints rather than ambiguous branch controls
- [x] validate Stockfish rows by root FEN, rank, exact UCI and complete PV
- [x] validate Maia rows by FEN, model, target Elo and exact UCI
- [x] mark Compare overlap only for exact full-UCI equality
- [x] cover shared destinations, differing recommendations, overlapping arrows and Return to Game

### Milestone B — button and asynchronous safety

- [x] explicit `type="button"` for every non-submit TSX button
- [x] AST regression test rejecting implicit button types
- [x] one-flight guards for analysis, Maia/model setup, Coach generation, imports and account sync
- [x] stale Coach request cancellation across ply, provider, model and language changes
- [x] rapid Stockfish/Maia/Compare and duplicate Coach action coverage
- [x] real uncached Analyze-game coverage, including no-legal-move checkmate and stalemate endings

### Milestone C — Analyze / Inspect / Learn hierarchy

- [x] Review remains the only Stockfish/Maia/Compare analysis workspace
- [x] Maia defaults move to Settings with a lightweight Review quick popover
- [x] visible Coach navigation becomes Study while the stable URL remains unchanged
- [x] contextual “Explain this move” preserves the persistent board and current ply
- [x] Study prioritizes whole-game learning and removes duplicated analysis dashboards
- [x] compact provenance plus on-demand grounding replaces large source fact cards
- [x] Human route remains removed; primary Review modes stay Stockfish, Maia and Compare

### Milestone D — Move Quality Annotation System V3

- [x] 14 geometric inline-SVG motifs with coherent diamond/circle/square/octagon families
- [x] specified restrained palettes and 20–28px silhouette readability
- [x] unchanged `QUALITY_META` and `QualityIcon` consumer API
- [x] shared V3 representation across board, verdict, Moves, summary, critical moments, timeline and PNG export
- [x] Human Find Difficulty keeps its separate quiet mark family
- [x] `/design/quality-icons` updated and reviewed at 20/24/28/36px on all four backgrounds

Phase 5.3 closed on 2026-08-24 after package tests, typecheck, lint, production
build, Python regression tests, semantic/visual Playwright coverage, both PNG
exports, both board orientations and the complete V3 fixture were reviewed.
The terminal-position repair was revalidated with real browser Stockfish runs
before further Phase 6 work. Further Phase 6 work must start from this
exact-interaction and Study product boundary.

## Phase 6 — desktop application (complete)

- [x] Tauri 2 application shell
- [x] shared React/TypeScript packages
- [x] arm64 macOS `.app` and `.dmg` local build (ad-hoc only)
- [x] Windows x64 NSIS build on a native runner
- [x] Linux x64 deb/AppImage build on a native runner
- [x] managed packaged local-ai sidecar
- [x] managed Ollama discovery/startup
- [x] local model setup workflow with explicit download approval
- [x] process ownership and shutdown for Ollama and local-ai
- [x] native PGN file open/import
- [x] native Windows/Linux bundle configuration and verified artifact workflow
- [x] unsigned packaged CI artifacts for macOS arm64, Windows x64 and Linux x64

Phase 6 opened and completed on 2026-08-24. The independent Vite/React/Tauri
shell imports shared packages, owns native PGN integration and manages both the
packaged PyInstaller local-ai sidecar and Ollama without taking ownership of
pre-existing processes. The macOS app/DMG was exercised locally against the real
sidecar lifecycle. The native artifact matrix then completed successfully for
macOS arm64 app/DMG, Windows x64 NSIS and Linux x64 deb/AppImage in
[Desktop artifacts run 32721845895](https://github.com/ice345/chess-review/actions/runs/32721845895).
During the Phase 6 gate, two shared Review-runtime gaps were also closed: Coach
generation now survives navigation among nested review routes, and user-played
temporary variations receive runtime-only Stockfish Move Quality through the
canonical classifier without mutating the imported game or objective cache.

Developer signing, macOS notarization/universal binaries and publishing a
versioned GitHub release remain release-operations follow-ups. They require
distribution credentials and an explicit release/version decision and are not
part of the Phase 6 implementation gate.

## Phase 7 — advanced study (complete)

- [x] multi-game trends
- [x] opening repertoire analysis
- [x] recurring weakness detection
- [x] training queue

Phase 7 completed on 2026-08-26. The current-version browser analysis cache now
feeds a player-specific `AdvancedStudyReport`: game and phase Accuracy are
aggregated from canonical results, opening repertoire is separated by player
color, and weak signals require matching evidence in at least two distinct
games. The `/training` workflow persists queued/in-progress/completed tasks in a
versioned IndexedDB store and deep-links every saved source to its exact review
ply. Package fixtures and a deterministic Playwright workflow cover aggregation,
cache/player projection, queue persistence and deep links. The phase does not
change Accuracy, Divider, WinPercent, White-POV score handling, classification or
Human Find Difficulty. Lc0 is intentionally not part of this product phase; it is
not required by any advanced-study calculation.

## Phase 8 — mobile companion exploration (complete)

- [x] evaluate Tauri Mobile versus React Native
- [x] define mobile capability boundaries
- [x] design a local/remote AI strategy

Phase 8 completed on 2026-08-26 with an accepted Tauri Mobile decision, a
mobile-compatible Vite/React/Tauri feasibility shell and the tested
`mobile-policy-v1` resolver. The companion parses PGN/FEN and navigates imported
games on-device, while a versioned endpoint manifest keeps cached Stockfish,
conditional device Stockfish, remote Maia and grounded Coach lanes separate.
Remote access requires explicit pairing, authentication and secure transport;
the existing loopback desktop service is not exposed. Android/iOS generated
projects, signing and device/store validation belong to a future production
mobile gate rather than this exploration phase.

Each algorithm step ships with deterministic fixtures and documentation before the next phase depends on it. Phases 5–5.3 do not change Accuracy, Divider, WinPercent, score POV or objective classification semantics.

## Release-readiness remediation (historical; see Phase 11 and R1–R5)

The 2026-08-26 full-product audit is the release gate after the numbered feature
phases. “Complete” above means the documented phase scope was implemented; it
does not mean the product is approved for public release. Desktop remains an
experimental foundation until it reuses the complete review product and ships
with CSP, service authentication and signed distribution.

- [x] publish the full product and current WintrChess comparison audits
- [x] add centralized transition-derived WintrChess chess audio, persistent
  enabled/volume/theme settings, quick mute, source-pinned assets and resolver
  tests
- [x] add immediate model-download origin and strict JSON confirmation defenses
- [x] add per-launch local-service authentication and identity (Phase 11 B)
- [x] preserve repetition-sensitive history through Stockfish and cache identity (Phase 11 A)
- [x] implement the Web fixes for deletion, SSRF, export, promotion, cursor, persistence and
  accessibility (Phase 11, R1–R5; remaining acceptance below and in the current audit)

This remediation does not change Accuracy, Divider, WinPercent, score POV,
objective classification or Human Find Difficulty.

## Phase 9 — Objective Analysis V2 / Correctness Gate

Phase 9 is a semantic replacement for the persisted
`objective-v1-preview.3` classification contract. Phases 0–8 remain completed
history; existing V1 records remain readable as stale data but cannot be mixed
into V2 player intelligence.

### Milestone A — versioned classification semantics

- [x] introduce an explicit V2 quality plus annotation schema and compatibility projection
- [x] make ordinary quality WinPercent-loss-led and preserve CP as evidence
- [x] remove `interesting` from canonical objective output and never invent an engine rank
- [x] remove/defer unreachable tactical `miss` until a production detector exists
- [x] redesign Critical around outcome-relevant MultiPV uniqueness
- [x] tighten Brilliant with non-triviality, outcome and verification evidence

### Milestone B — canonical engine evidence

- [x] separate classification MultiPV from presentation line count
- [x] retain restricted `searchmoves` evidence for outside-MultiPV moves
- [x] add played-score/resulting-position consistency evidence without substituting scores
- [x] add selective deeper/wider verification for unstable or high-impact candidates
- [x] preserve interactive priority and bounded background engine use

### Milestone C — compatibility and correctness gate

- [x] bump objective schema/algorithm identity and invalidate incompatible cache reuse
- [x] add a golden classification corpus and POV/property invariants
- [x] prove retained special annotations are reachable through the full-game assembler
- [x] update analysis, data-model, cache and Move Quality documentation
- [x] document Syzygy <=7-piece support as a later correctness enhancement
- [x] pass package, type, lint, build and browser acceptance checks

## Phase 10 — Whole-History Player Intelligence & Training

Phase 10 consumes only version-compatible Phase 9 evidence. Browser background
analysis means low-priority work while the app is open; it never claims to keep
computing after browser shutdown.

### Milestone A — bulk analysis infrastructure

- [x] add explicit provider/date/time-control/rated/stale history scopes
- [x] persist deterministic queued/running/paused/cancelled/failed/completed jobs
- [x] resume after refresh, reuse current cache, retry individual failures and deduplicate games
- [x] keep whole-history Stockfish at the scheduler's lowest bounded priority
- [x] persist each history-game success independently; R5 now limits background
      analysis to one job, reserving the second engine slot for foreground work
- [x] show partial Training data immediately and keep per-item failure reasons secondary
- [x] add compact analysis-cache projections and storage/coverage accounting

### Milestone B — versioned player-intelligence report

- [x] add `advanced-study-v2` provenance, filters and partial-coverage semantics
- [x] use explicit linked-account identity across Chess.com and Lichess
- [x] keep manual-PGN player selection separate from connected identity
- [x] prevent incompatible objective versions from entering one report

### Milestone C — rating and form

- [x] separate rating bands by platform and time control
- [x] calculate documented recent range, performance evidence, confidence and conservative next target
- [x] degrade honestly for missing Elo or insufficient sample size

### Milestone D — opening intelligence

- [x] expand color-specific repertoire with share, W/D/L, Accuracy, loss and recent metrics
- [x] expose representative games and deterministic problem positions
- [x] apply the shared dataset filter to every opening conclusion

### Milestone E — middlegame and endgame intelligence

- [x] add phase loss/error rates and recent trends
- [x] add evidence-bounded conversion, hold, save and missed-opportunity metrics
- [x] avoid tablebase-like claims without tablebase evidence

### Milestone F — highlights

- [x] add version-aware Brilliant/Critical galleries and exact ply links
- [x] add minimum-length best games, comebacks, saves and clean conversions
- [x] keep every highlight traceable to canonical moves and evaluations

### Milestone G — weakness and training plan

- [x] add sample size, frequency, severity, confidence, trend and representative evidence
- [x] rank deterministic training recommendations with measurable source positions
- [x] evolve queue progress metadata without claiming fake spaced repetition

### Milestone H — Training UX

- [x] add Overview, Rating & Form, Openings, Middlegame, Endgame, Mistakes, Highlights, Plan and Coverage hierarchy
- [x] add explicit Analyze history, Pause, Resume, Cancel and retry controls
- [x] propagate one filter population through the whole report
- [x] preserve responsive, accessible and bounded rendering

### Milestone I — large-dataset performance

- [x] avoid mounting or eagerly projecting thousands of full game records
- [x] document IndexedDB growth, canonical payload and report aggregation tradeoffs
- [x] verify incremental aggregation and compact materialized indexes

### Milestone J — acceptance gate

- [x] add deterministic queue, report, identity, filter, highlight and training-plan tests
- [x] add empty/partial/full Training and bulk-control browser workflows
- [x] inspect intentional visual changes before updating representative baselines
- [x] pass full TypeScript, Python, build and E2E validation

## Phase 10.1 — Training release-readiness refinement

Phase 10.1 is a focused product/data pass on the completed Phase 10 surface. It
keeps the objective-analysis algorithms stable while making the durable result
of whole-history analysis visible and maintainable.

### Milestone A — connected-data continuity

- [x] repair legacy cache-only connected games into durable review links
- [x] join projections by header-independent initial-FEN plus UCI identity when
  PGN serialization has drifted
- [x] keep successful items in Training and Overview when another item in the
  same batch fails
- [x] explain the common outside-MultiPV failure as incomplete engine evidence,
  not an illegal provider game

### Milestone B — quiet Training hierarchy

- [x] formalize Paper Card, Wash Card and Ink Row surface tokens
- [x] collapse advanced scope controls behind a concise population summary
- [x] promote player profile, form, phase signal, focus, highlights and coverage
  on Overview
- [x] keep successful game lists collapsed and nest older finished runs
- [x] add responsive/reduced-motion styling for the refined hierarchy

### Milestone C — run lifecycle and rating truth

- [x] remove only finished/cancelled/failed history-job records
- [x] clear finished run records with confirmation while protecting games,
  reviews, objective cache and Training data
- [x] protect active runs from deletion until cancelled
- [x] calculate estimated performance from one matched result/opponent sample
- [x] expose stabilize/next-target milestones near 100-point boundaries
- [x] add deterministic unit and browser coverage for the above behavior

Phase 10.1 follow-ups moved into Phase 11. Feature phases 0–10.1 remain
completed history; they do not mean the product is approved for public
release.

## Historical tree hygiene (before Phase 11)

This was the pre-Phase-11 Git snapshot, not the current commit count. Use actual
Git status and the current release audit for today’s operations gate.

- [ ] land or discard the uncommitted Training/UI/cache/e2e work
- [ ] publish the reviewed release commits (check current branch state first)
- [ ] make GitHub Actions green on `master` (typecheck already passes
      locally; re-run `pnpm test`, `pnpm lint`, `pnpm build`,
      `pnpm test:e2e`, and the Python suite on the landed tree)
- [ ] do not update visual baselines except after an intentional,
      reviewed visual change
- [ ] keep `references/` and generated screenshots out of the product
      commit

This gate does not change chess semantics.

## Phase 11 — Trust and local-first release gate

Phase 11 is the public-readiness gate after Phases 0–10.1. Feature
phases are complete; this phase makes the shipped web product honest
enough to recommend to other people.

Success means a Browser Core user can import, review, study, train,
delete local data, and understand failures without leaking chess.js
internals or mixing locales. Enhanced Local remains optional. Desktop
and mobile stay foundation shells.

The intended release path is public GitHub / self-host (path B):
Browser Core plus documented local-ai, LICENSE, chess-history identity,
deletion, and Chess.com URL allowlisting. Hosted public deployment
additionally requires the rate-limit and OAuth-production items in
Milestone C. Signed desktop and mobile stores are Phase 12 / later.

Non-goals for Phase 11:

- embedding the full Review workspace into Tauri
- Android/iOS store packages
- Syzygy tablebases
- Lc0
- changing V2 classification, Accuracy, Divider, WinPercent, White POV
  or Human Find Difficulty
- replacing Move Quality Annotation System V3

### Milestone 0 — first-session friction (small, user-visible)

Close the holes found in the 2026-09-01 localhost walkthrough. None of
these change engine truth.

- [x] wrap PGN/FEN import errors in a short user message; keep parser
      diagnostics in the console
- [x] stop claiming “Opening position of the pasted game” when
      `previewFen()` fell back to the starting position
- [x] make “Load example game” start the review, or rename it so it
      does not imply analysis has begun
- [x] use one UI locale for chrome, Settings, Study buttons and Coach
      copy (English or Simplified Chinese, not both on one screen)
- [x] if a zh-CN Coach request fails the language gate, keep a valid
      English explanation when one exists; deterministic fallback must
      paraphrase facts, not describe “the core layer”
- [x] stop showing Review opening/middlegame/endgame as “—” while
      Training calls Opening “Strongest phase” for the same opening-only
      game; pick one honest empty/partial rule and apply it on both
      surfaces
- [x] Critical Moments: do not paint `−0.0%` as a loss; use the
      Critical annotation mark, not the Book quality icon, and say why
      the ply is critical
- [x] replace developer Settings copy (`Configure OAuth in .env.local`,
      “canonical 3PV”) with user-facing language; keep the technical
      detail in docs
- [x] add regression coverage for invalid PGN, example-import, locale
      consistency and opening-only phase presentation

### Milestone A — chess history identity (OCR-001, P0)

Canonical Stockfish search must see enough history to represent
repetition and fifty-move state. FEN-only `position fen` is not
canonical truth.

- [x] introduce a typed engine position command: base FEN plus ordered
      UCI moves for canonical, current-position and branch searches
- [x] keep internal scores White POV; do not flatten draws into
      centipawns
- [x] add an explicit claimable-versus-automatic draw status in
      chess-core (threefold, fivefold, fifty, seventy-five)
- [x] include the history signature in cache identity so the same board
      with/without repetition cannot collide
- [x] reject or label Chess960 / named variants at import (OCR-025)
      rather than silently parsing them as standard chess
- [x] tests: threefold from start; repetition after a nonstandard FEN;
      same FEN distinct identity; fifty-move policy; branch repetition;
      cancellation and cache reuse with history

This is the only Phase 11 item that may touch engine command shape and
cache keys. Classification thresholds stay unchanged.

### Milestone B — local-service identity (OCR-002 remainder, OCR-009)

Origin + JSON confirmation for model download is already shipped. That
is not authentication.

- [x] per-launch capability token from the managed launcher / desktop
      sidecar
- [x] require the token on mutating local-ai routes (download, Maia
      inference, Coach)
- [x] health responses include a product/version/capability nonce the
      client must verify before sending FEN, moves or coach facts
- [x] reject a process that only answers JSON `/health` on port 8000
- [x] tests: missing/wrong/expired token, evil origin, form POST,
      stale port occupant, authorized success

### Milestone C — connected-platform hardening (OCR-003, OCR-005, OCR-006, OCR-013)

Required before any hosted Next.js deployment; still worth doing for
self-host.

- [x] allowlist Chess.com archive fetches: `https:` + `api.chess.com` +
      expected player/month path; no provider-controlled arbitrary URL
- [x] version the Chess.com cursor on archive year/month (or validated
      URL), not a reversed array index
- [x] make `saveSyncedGames` proportional to batch size, not a full
      store `readAll` per batch
- [x] bound `request.json` / NDJSON parse size on platform routes;
      keep typed provider errors for 429/502
- [x] tests: loopback/private host, non-HTTPS, wrong domain, new month
      before resume, duplicate upsert, oversized body

### Milestone D — local data lifecycle (OCR-004, OCR-015)

Local-first is incomplete without deletion.

- [x] delete one review record
- [x] delete games imported from one linked account, with
      keep-or-delete on disconnect
- [x] clear derived analysis cache only
- [x] full local reset (reviews, synced games, jobs, queue, settings)
      with an explicit confirmation scope
- [x] document retention defaults
- [x] optional later: cache eviction policy; do not block D on a
      perfect LRU
- [x] tests: History per-review delete in Chromium; disconnect confirm
      and cache/reset remain confirm-dialog UI
- [x] IndexedDB unit coverage for source purge, cache-only clear,
      all-data reset, and multi-tab refresh (R1/R3)

### Milestone E — board, export and legal completeness (OCR-007, OCR-008)

- [x] promotion chooser for click, drag and keyboard: queen/rook/bishop
      /knight, cancel leaves the position unchanged
- [x] Position PNG exports the displayed FEN/orientation/branch, not
      only canonical `currentAnalysis`; FEN-only studies can export
- [x] remote Coach / off-device facts disclosed at the moment the user
      chooses a cloud provider (OCR-014)
- [x] tests: queen/rook/bishop/knight chooser plus cancel in Chromium;
      capture-underpromotion and PNG identity remain unit/manual
- [ ] dedicated capture-underpromotion and canonical-vs-branch PNG e2e

### Milestone F — accessibility and small-viewport (OCR-011, OCR-012, OCR-019, OCR-026)

- [x] 44×44 CSS px minimum for mute, flip and transport controls
- [x] stop exposing 32 disabled dnd-kit piece buttons on the Home
      preview board
- [x] arrow-key game navigation must not steal keys from focused
      controls or custom boards
- [x] mobile copy cannot say “Hover for details”
- [x] mobile review chrome: one Settings entry, visible Export or an
      explicit overflow menu; nav must not collide with the mark
- [x] decorative quality icons do not add duplicate accessible names
- [x] desktop Review: the board, eval bar, player strips and transport
      must be reachable without scrolling away the board at 1440×900

### Milestone G — open-source packaging

- [x] add a root LICENSE consistent with Stockfish.js (GPLv3) and the
      WintrChess sound files already documented in
      `docs/third-party-notes.md`
- [x] README points at LICENSE and third-party notes
- [ ] pin GitHub Actions to commit SHAs where practical (OCR-021)
- [x] no secrets in the tree; `.env.example` remains the only env
      template

### Milestone H — acceptance gate

- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- [x] `uv run --project services/local-ai --extra dev pytest services/local-ai/tests`
- [x] Chromium workflow e2e for invalid PGN, example import, deletion,
      promotion, opening-only phase presentation, and Review desk
      layout (`e2e/workflows.spec.ts` subset; `visual.spec.ts` not
      re-baselined)
- [x] manual visual pass at 390×844 and 1440×900; 1728×1117 not
      re-shot this pass
- [x] update `docs/audits/full-product-audit.md` statuses; do not
      claim public release until A–G that are in-scope for path B
      are checked
- [x] this gate still does not ship signed desktop or mobile stores

## Phase 12 — Desktop as the reviewed product (deferred)

Do not start Phase 12 until Phase 11 path B is accepted.

- [ ] reuse the web Review/Moves/Study/Training workspace inside the
      Tauri shell (no second analysis semantics)
- [ ] non-null CSP (OCR-010)
- [ ] sidecar uses the same per-launch token as Milestone B
- [ ] signed/notarized distribution is a release-operations follow-up,
      not an implementation checkbox

## Explicitly later

- Syzygy ≤7-piece **as analysis evidence**. The Engine Lab lookup shipped on
  2026-09-14; what remains later is a versioned `TablebaseEvidenceV1` that
  classification, Accuracy or Training metrics may read
  ([analysis-spec.md](analysis-spec.md#tablebase-boundary))
- Chess960 as a supported variant (Phase 11 only rejects it)
- 1000-game performance budget suite (OCR-024)
- annotated PGN comment/NAG round-trip (OCR-023)
- OpenAI-compatible base-URL transport policy (OCR-022)
- unbounded IndexedDB eviction (partially covered by D)
- production mobile device/store gate
