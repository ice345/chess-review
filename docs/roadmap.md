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
- [x] Review / Moves / Human / Coach route separation
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
- [x] mutually exclusive Stockfish / Maia analysis selection in Review
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

- [x] watercolor annotation-seal quality icon refinement
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

## Phase 6 — desktop application

- [x] Tauri 2 application shell
- [x] shared React/TypeScript packages
- [ ] macOS build
- [ ] Windows build
- [ ] Linux build
- [ ] managed local-ai sidecar
- [ ] managed Ollama discovery/startup
- [ ] local model setup workflow with explicit download approval
- [ ] graceful process ownership and shutdown
- [ ] native PGN file open/import
- [ ] packaged releases and CI artifacts

Phase 6 opened on 2026-08-24 with the independent Vite/React/Tauri shell. Its
first native release build completed with bundling disabled, and the preview
imports the project-owned UI mark plus PGN parser from workspace packages. This
does not yet claim a signed macOS bundle, another operating-system build,
sidecar lifecycle, native file association or release artifact.

## Phase 7 — advanced study

- [ ] multi-game trends
- [ ] opening repertoire analysis
- [ ] recurring weakness detection
- [ ] training queue

## Phase 8 — mobile companion exploration

- [ ] evaluate Tauri Mobile versus React Native
- [ ] define mobile capability boundaries
- [ ] design a local/remote AI strategy

Each algorithm step ships with deterministic fixtures and documentation before the next phase depends on it. Phase 5 does not change Accuracy, Divider, WinPercent, score POV or classification semantics.
