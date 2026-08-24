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
- [x] no automatic bulk Stockfish, Maia or Coach analysis

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

## Phase 6 — desktop application

- [x] Tauri 2 application shell
- [x] shared React/TypeScript packages
- [x] arm64 macOS `.app` and `.dmg` local build (ad-hoc only)
- [ ] Windows build
- [ ] Linux build
- [x] managed packaged local-ai sidecar
- [x] managed Ollama discovery/startup
- [x] local model setup workflow with explicit download approval
- [x] process ownership and shutdown for Ollama and local-ai
- [x] native PGN file open/import
- [x] native Windows/Linux bundle configuration and artifact workflow (runner results pending)
- [ ] packaged releases and CI artifacts

Phase 6 opened on 2026-08-24 with the independent Vite/React/Tauri shell. The
preview imports the project-owned UI mark plus PGN parser from workspace
packages. Its first platform milestone now produces ad-hoc arm64 macOS `.app`
and `.dmg` bundles using generated Blue Bishop platform icons. This does not yet
claim signing, notarization, a universal or other operating-system build, or a
published release artifact. Native PGN association/import, the Ollama ownership
boundary and a self-contained PyInstaller local-ai sidecar were subsequently
implemented and validated in the rebuilt macOS app. The sidecar exposes the
real FastAPI health contract and is stopped with the app, while a pre-existing
Ollama process remains untouched. Windows/Linux native configurations and an artifact
matrix are committed but do not count as completed builds before their runners
pass. During the
Phase 6 gate, two shared Review-runtime gaps were also closed: Coach generation
now survives navigation among nested review routes, and user-played temporary
variations receive runtime-only Stockfish Move Quality through the canonical
classifier without mutating the imported game or objective cache.

## Phase 7 — advanced study

- [ ] multi-game trends
- [ ] opening repertoire analysis
- [ ] recurring weakness detection
- [ ] training queue

## Phase 8 — mobile companion exploration

- [ ] evaluate Tauri Mobile versus React Native
- [ ] define mobile capability boundaries
- [ ] design a local/remote AI strategy

Each algorithm step ships with deterministic fixtures and documentation before the next phase depends on it. Phases 5–5.3 do not change Accuracy, Divider, WinPercent, score POV or objective classification semantics.
