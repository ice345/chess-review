# Roadmap

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
- [x] normal-document Review workspace with a prominent board and full-width timeline
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
- [x] board/timeline primary column and contextual secondary column
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

## Release-readiness remediation (active)

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
- [ ] add per-launch local-service authentication and identity
- [ ] preserve repetition-sensitive history through Stockfish and cache identity
- [ ] close the P1 deletion, SSRF, export, promotion, cursor, persistence and
  accessibility findings in `docs/audits/full-product-audit.md`

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
- [x] analyze up to two history games in parallel while persisting successes independently of failures
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
