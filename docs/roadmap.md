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

## Phase 6 — desktop application

- [ ] Tauri 2 application shell
- [ ] shared React/TypeScript packages
- [ ] macOS build
- [ ] Windows build
- [ ] Linux build
- [ ] managed local-ai sidecar
- [ ] managed Ollama discovery/startup
- [ ] local model setup workflow with explicit download approval
- [ ] graceful process ownership and shutdown
- [ ] native PGN file open/import
- [ ] packaged releases and CI artifacts

## Phase 7 — advanced study

- [ ] multi-game trends
- [ ] opening repertoire analysis
- [ ] recurring weakness detection
- [ ] training queue
- [ ] optional Lc0 second opinion

## Phase 8 — mobile companion exploration

- [ ] evaluate Tauri Mobile versus React Native
- [ ] define mobile capability boundaries
- [ ] design a local/remote AI strategy

Each algorithm step ships with deterministic fixtures and documentation before the next phase depends on it. Phase 5 does not change Accuracy, Divider, WinPercent, score POV or classification semantics.
