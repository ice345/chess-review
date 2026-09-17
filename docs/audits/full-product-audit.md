Status: Historical
Baseline: 2026-08-26
Superseded by: [FIX.md](../../FIX.md)
Do not use as the current product contract.

# Full product release-readiness audit

Audit date: 2026-08-26
Repository: `ice345/chess-review`
Audited commit: `0a46eb6c8da31958abcadfdd69a47583586b49f2` (`master`, equal to `origin/master` at audit start)
Release judgment: **NO-GO for hosted public launch.** Path B (public GitHub / self-host) product work for Phase 11 is implemented on the local tree: history-aware Stockfish, local-ai launch token, Chess.com allowlisting, local deletion, promotion chooser, LICENSE. Remaining before recommending the tree to others: land/push the dirty working tree, pin GitHub Actions SHAs, and make CI green on `master`. Desktop CSP and store packages stay Phase 12.

## Scope and method

This is an audit of the commit above, not of roadmap checkboxes. It covered package boundaries, canonical chess and analysis code, React state, IndexedDB, browser Stockfish, Maia/local-ai, coach providers, external sync, OAuth, exports, responsive UI, accessibility, Tauri, dependencies, CI, tests, and the current public WintrChess contract.

The working tree was already dirty before audit work:

- modified `apps/web/next-env.d.ts` (Next development-generated type paths);
- untracked `docs/dev-workflow-guide.md`.

Those user-owned changes were not modified by this audit.

## Baseline

### Runtime and notable versions

| Item | Version/state |
|---|---|
| Node | 26.7.0 locally; CI uses 24 |
| pnpm | 11.19.0 |
| Python | 3.14.7 |
| uv | 0.12.5 |
| Rust | 1.97.1 |
| Next.js | 16.3.2 |
| React | 19.2.8 |
| chess.js | 1.4.0 |
| Zustand | 5.0.15 |
| Stockfish browser bundle | Stockfish 18, 7.0 MiB WASM + 24 KiB loader |
| Tauri | 2.11.x |
| Product package version | 0.1.0 |

### Checks actually run

| Check | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 134 tests (10 shared, 11 chess-core, 41 analysis, 2 openings, 10 stockfish, 60 web) |
| `pnpm build` | PASS — web, desktop frontend, mobile frontend |
| `uv run --project services/local-ai --extra dev pytest services/local-ai/tests` | PASS — 26 tests; one Starlette/httpx deprecation warning |
| desktop `cargo test --locked` | PASS — 4 tests |
| mobile `cargo test --locked` | PASS — host compiles, 0 tests |
| `pnpm test:e2e` | PASS — 14 Chromium workflows/visual checks |
| `pnpm audit` and `pnpm audit --prod` | PASS — no known pnpm advisories |
| `pnpm dev:check` | PASS — Ollama and configured model found; local-ai offline; no process started |
| `cargo audit` | **NOT VERIFIED** — command is not installed; it was not installed automatically |

The production web output contained about 1.5 MiB of static JS/CSS chunks before compression. The largest individual emitted JS chunks were about 452 KiB and 224 KiB; Stockfish is separately served as a 7.0 MiB WASM asset.

### Responsive observation

The current app was inspected at 1366×768, 1024×768, and 390×844 in addition to the existing 1440×900, 1728×1117, and 1920×1080 visual fixtures. Home and Review had no document-level horizontal overflow. At 390 px the board remained full-width and usable, with the timeline and objective panel stacked below. Seventeen visible links/buttons were smaller than 44×44 CSS pixels, including the 35×35 move controls.

## What is sound

- White-POV score normalization and mate separation are canonical and tested.
- Lichess-compatible WinPercent/Accuracy, weighted game Accuracy, and structural Divider logic live in `packages/analysis`, not React.
- Move classification is evidence-bearing and keeps Great/Brilliant semantics deterministic.
- Exact UCI identity is used for Stockfish/Maia candidates; shared destination squares cannot conflate `Nxd5` and `Qxd5`.
- Canonical cursor, position candidates, reviewed-move Maia identity, position Maia identity, and branch root/index separation are internally consistent in audited workflows.
- Coach prompts are built from structured facts and engine lines are validated through the chess rules layer.
- Lichess OAuth uses PKCE and encrypted HttpOnly state/token cookies; no token was found in client exports, URLs, or logging.
- React rendering escapes PGN/provider/coach strings; no `dangerouslySetInnerHTML`, raw `innerHTML`, `eval`, or script injection sink was found.
- Every audited JSX `<button>` outside third-party code has an explicit `type`.
- The Quality Icon system is already V3, retains the inline `QualityIcon` API, and passed its 20/24/28/36 px visual fixture on all current surfaces. It must not be replaced.
- Browser Core remains usable when Maia/Ollama are absent, and the launcher stops only processes it owns.

## Finding summary

| ID | Severity | Area | Finding | Evidence | Fix size |
|---|---|---|---|---|---|
| OCR-001 | P0 | Chess/Stockfish | Repetition history is discarded before engine search | **Fixed (Phase 11):** `position fen <startFen> moves <uci…>` + history in cache identity + `drawStatus` | L |
| OCR-002 | P0 | Local-ai security | Model-download POST lacks an authentication/browser-origin boundary | **Fixed (Phase 11):** per-launch token on mutating routes; origin check already shipped | M |
| OCR-003 | P1 | API security | Chess.com archive URLs are fetched without host validation | **Fixed (Phase 11):** `https` + `api.chess.com` + player/month allowlist | S |
| OCR-004 | P1 | Privacy/data lifecycle | No review/synced-game deletion, cache clearing, or full local reset | **Fixed (Phase 11):** History delete, cache clear, full reset, disconnect keep-or-delete | M |
| OCR-005 | P1 | Performance | Full Chess.com sync rereads all stored games for every batch | **Fixed (Phase 11):** per-key get+put upsert | M |
| OCR-006 | P1 | Integration reliability | Chess.com resume cursor uses shifting archive indexes | **Fixed (Phase 11):** year/month cursor, not reversed array index | M |
| OCR-007 | P1 | Export | Position PNG can export the canonical position while showing a branch; FEN export is disabled | **Fixed (Phase 11):** displayed FEN/orientation/branch export, including FEN-only | M |
| OCR-008 | P1 | Board interaction | Underpromotion is supported in core but impossible through UI | **Fixed (Phase 11):** queen/rook/bishop/knight chooser + cancel | M |
| OCR-009 | P1 | Local service security | Any process answering `/health` can be trusted as local-ai | **Fixed (Phase 11):** product/version/capability nonce + launch token | L |
| OCR-010 | P1 | Desktop security | Desktop Tauri CSP is `null` | `apps/desktop/src-tauri/tauri.conf.json` | S |
| OCR-011 | P1 | Accessibility | Global arrow navigation conflicts with focused controls; board is mouse-centric | **Partial (Phase 11):** arrows skip focused controls; board remains mouse-first | M |
| OCR-012 | P1 | Accessibility/mobile | Core mobile controls miss minimum touch target guidance | **Partial (Phase 11):** mute/flip/transport are 44×44; header nav still compact | S |
| OCR-013 | P1 | API resilience | Routes lack resource limits/rate control and provider parsing fails coarsely | unbounded `request.json`, `JSON.parse` NDJSON | M |
| OCR-014 | P1 | Privacy UX | Remote coach/off-device facts are not disclosed at the decision point | **Fixed (Phase 11):** Settings discloses off-device facts when choosing OpenAI-compatible | S |
| OCR-015 | P1 | Persistence | IndexedDB objects are trusted and analysis cache is unbounded | `getAll` casts, no eviction/recovery | L |
| OCR-016 | P1 | Test quality | Critical chess and worker failure contracts are not covered | no repetition/EP/castling/underpromotion/lifecycle matrix | M |
| OCR-017 | P1 | Desktop readiness | Desktop is a foundation shell, not the reviewed product | import/status UI only; unsigned artifacts | XL |
| OCR-018 | P2 | Performance | Review mounts two health pollers and health repeats Ollama catalog calls | Human + Coach each call health hook | S |
| OCR-019 | P2 | Accessibility | Reduced motion and live progress semantics are incomplete | web has no reduced-motion rule; unlabeled progress | S |
| OCR-020 | P2 | Audio/product polish | Audited HEAD has no centralized chess audio | no audio asset, resolver, settings, or mute control | M |
| OCR-021 | P2 | Supply chain/CI | Most Actions use mutable tags; desktop host tests are absent from normal CI | **Open:** uv is SHA-pinned; checkout/setup-node/pnpm still use tags | M |
| OCR-022 | P2 | Provider security | OpenAI-compatible endpoint can be arbitrary cleartext/nonlocal URL | environment base URL is used without transport policy | M |
| OCR-023 | P2 | Export fidelity | Annotated PGN reconstruction drops original comments/NAGs/variations | export rebuilds mainline | M |
| OCR-024 | P2 | Performance evidence | 1000-game, all-Maia-size, offline, and long-review budgets are not measured | no performance suite/budget | L |
| OCR-025 | P2 | Variants | Unsupported variant/Chess960 boundary is implicit | **Fixed (Phase 11):** import rejects named variants / Chess960 | S |
| OCR-026 | P2 | Accessibility | Repeated quality icons can add duplicate screen-reader labels | **Fixed (Phase 11):** decorative quality icons omit duplicate names | S |

## Detailed findings

### OCR-001 — Repetition history is discarded before engine search

**Severity:** P0
**Area:** Chess correctness, Stockfish, cache identity
**Files:** `packages/chess-core/src/game.ts` (`parsePgn`, `noLegalMoveTerminalStatus`); `packages/stockfish/src/browser-engine.ts` (`search`); `packages/stockfish/src/game-review.ts` (`analyzeGame`); current-position/branch Stockfish hooks

**Observed behavior:** `NormalizedGame` records FENs and plies, but every engine job sends only `position fen <fen>`. Terminal synthesis recognizes only positions with no legal moves. Threefold repetition is history-dependent and is therefore lost. Cache identity is also FEN-based, so a repetition-claimable state and the same board reached once share an analysis entry.

**Expected behavior:** Canonical game analysis must preserve enough initial-position and UCI history to represent repetition state. A claimable/terminal draw policy must be explicit and cache keys must distinguish history when history changes objective status.

**Why it matters:** The product can analyze the actual repeated game state as an ordinary non-drawn position, violating chess truth and the internal claim that Stockfish facts are canonical.

**Reproduction steps:** Parse `[Result "1/2-1/2"] 1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 1/2-1/2`. `Chess` with its history reports threefold repetition. A new `Chess(finalFen)` reports false. Full-game search receives only that final FEN.

**Root cause:** The engine boundary and cache were designed around position-only analysis. History-sensitive draw state was not represented in the shared/core contract.

**Recommended fix:** Introduce a typed engine position command containing base FEN plus ordered UCI moves for canonical and branch searches. Add an explicit draw-status structure (claimable versus automatic) in chess-core. Include the relevant history signature and engine parameters in cache identity. Do not flatten draw state into centipawns silently.

**Tests required:** Threefold from starting position; repetition after a nonstandard FEN; same FEN with/without repetition has distinct identity; fifty-/seventy-five-move boundary policy; branch repetition; cancellation and cache reuse with history.

### OCR-002 — Model-download POST lacks a browser/authentication boundary

**Severity:** P0
**Area:** Local-ai security, privacy, resource use
**Files:** `services/local-ai/src/chess_review_local_ai/main.py` (model download route/CORS); `apps/web/src/lib/local-ai.ts` (`downloadMaiaModel`); local-ai tests

**Observed behavior:** POSTing to `/maia/models/{model}/download` calls `prepare_model`. The service is unauthenticated. CORS controls response reading, not whether a simple cross-origin form POST reaches the server; the endpoint requires no JSON confirmation header/body or per-launch secret.

**Expected behavior:** Only the trusted local UI, after explicit user approval, can initiate a large model download. A web page from another origin must not be able to trigger it.

**Why it matters:** A malicious page can cause network, disk, CPU, and potentially metered-bandwidth use on localhost. It breaks the documented promise that a model is never downloaded without explicit approval.

**Reproduction steps:** With local-ai running, submit a cross-origin HTML form POST to `http://127.0.0.1:8000/maia/models/maia3-79m/download`. The browser may block reading the response, but the request can reach the handler.

**Root cause:** Loopback binding and CORS were treated as an authentication/CSRF boundary.

**Recommended fix:** Add a per-launch capability token shared through the managed launcher and required on mutating local-ai requests. As immediate defense-in-depth, require an allowed `Origin`, JSON `Content-Type`, and `{confirm:true}` body, reject missing/cross-site fetch metadata, and serialize download tasks by model.

**Tests required:** evil origin, null/missing origin policy, simple-form POST, wrong token, expired/restarted token, duplicate click, concurrent different-model requests, partial download cleanup, explicit authorized success.

### OCR-003 — Chess.com archive fetch accepts provider-controlled URLs

**Severity:** P1
**Area:** API security, SSRF
**Files:** `apps/web/src/app/api/platforms/chesscom/sync/route.ts` (`POST` archive loop)

**Observed behavior:** Archive URLs returned by `api.chess.com/pub/player/.../games/archives` are used directly in server-side `fetch`.

**Expected behavior:** Every archive URL must be HTTPS, have the exact approved Chess.com API host, and match the expected player/month path before it is fetched.

**Why it matters:** A compromised, redirected, or malformed upstream response can turn the route into an internal-network fetch primitive.

**Reproduction steps:** Mock the archive-index response with `{"archives":["http://127.0.0.1:.../"]}` and invoke sync. The current route attempts that URL.

**Root cause:** Trust in the first-party provider response crosses a second outbound-request boundary without revalidation.

**Recommended fix:** Parse with `URL`, allowlist `https:` plus `api.chess.com`, validate path/user/month, disable or validate redirects, and give malformed archives a typed provider error.

**Tests required:** loopback/private IP, alternate domain, credentials in URL, non-HTTPS, redirect to private host, invalid path, valid archive URL.

### OCR-004 — Local data has no deletion or retention lifecycle

**Severity:** P1
**Area:** Privacy, local-first, data lifecycle
**Files:** `apps/web/src/lib/review-library.ts`; `analysis-cache.ts`; `platform-library.ts`; History and Settings UI

**Observed behavior:** Review, synced-game, and analysis stores provide save/get/list behavior but no user-facing per-record delete, account-data purge, cache clear, or full reset. Disconnecting an account removes credentials/sync state but leaves imported games and reviews.

**Expected behavior:** Users can delete one review, remove games imported from an account, clear derived analysis only, and erase all local product data with clear scope.

**Why it matters:** PGNs can contain names, ratings, events, sites, and study notes. Local-first is not privacy-complete without deletion and retention control.

**Reproduction steps:** Import and analyze a game, disconnect its account, then inspect History/Settings and IndexedDB. The game/review/analysis remain and have no deletion action.

**Root cause:** Persistence APIs were built for accumulation and resume, not lifecycle management.

**Recommended fix:** Add transactional delete APIs and UI confirmations, explicit derived-cache versus source-record scope, account-origin indexes, a full reset, and documented retention defaults.

**Tests required:** per-review delete, synced source purge, disconnect-with-keep and disconnect-with-delete, cache-only clear, all-data reset, failure rollback, multi-tab refresh.

### OCR-005 — Full-history sync is O(N²) across batches

**Severity:** P1
**Area:** Performance, IndexedDB, connected accounts
**Files:** `apps/web/src/lib/platform-library.ts` (`saveSyncedGames`); connected-account sync loop

**Observed behavior:** Every received batch calls a store-wide `readAll`, builds a full Map, merges the batch, then writes. Repeating this for hundreds of archives rereads all previously stored games each time.

**Expected behavior:** Each batch performs key lookups or upserts proportional to batch size, with indexes/pagination for display.

**Why it matters:** Full histories with thousands of games become progressively slower and allocate increasingly large arrays, while blocking a core connected workflow.

**Reproduction steps:** Seed N games, then save 100-game batches while increasing N. IndexedDB reads and elapsed time grow with the entire store rather than the new batch.

**Root cause:** Duplicate prevention is implemented as an in-memory whole-store merge rather than key-based transactions.

**Recommended fix:** Use deterministic provider/game keys and `put` in one transaction; add provider/account/date indexes; query only needed pages.

**Tests required:** 1k/10k-game benchmarks, duplicate idempotency, concurrent batches, order stability, quota failure, route transition during sync.

### OCR-006 — Chess.com resume cursor is unstable when archives change

**Severity:** P1
**Area:** Integration reliability
**Files:** `apps/web/src/lib/platform-sync.ts`; `apps/web/src/app/api/platforms/chesscom/sync/route.ts`

**Observed behavior:** The cursor encodes archive array index and game offset after reversing the provider's archive list. When a new monthly archive appears, earlier indices shift.

**Expected behavior:** Resume identity is based on an immutable archive key (year/month or validated URL) plus offset/game timestamp.

**Why it matters:** Paused long-running sync can skip or repeat archive data after a month boundary.

**Reproduction steps:** Pause with cursor `cc:1:50`; insert a new newest archive into the mocked index; resume. Index 1 now identifies a different month.

**Root cause:** Cursor identity is tied to presentation order rather than provider resource identity.

**Recommended fix:** Version the cursor and encode archive month/key, offset, and a monotonic newest timestamp; migrate old cursors conservatively.

**Tests required:** new month before resume, removed/missing archive, re-ordered provider list, old cursor migration, zero games, duplicate overlap.

### OCR-007 — Position PNG does not follow the displayed position

**Severity:** P1
**Area:** Export correctness, branch state
**Files:** `apps/web/src/components/review-shell.tsx` (`exportPositionPng`); PNG exporter

**Observed behavior:** The board can display `branch.positionFen`, but Position PNG is built from canonical `currentAnalysis`. A branch export can silently show/export the canonical position. FEN-only studies have no `currentAnalysis`, so Position PNG is disabled despite having a displayed position.

**Expected behavior:** Position export uses the exact displayed FEN, orientation, selected branch move/evidence, and explicit source label. FEN studies export without game analysis.

**Why it matters:** An export is a durable artifact; silently exporting the wrong position breaks trust and study records.

**Reproduction steps:** Select a Stockfish candidate, advance the branch, and export Position PNG; compare it with the visible board. Separately import a FEN and observe Position PNG disabled.

**Root cause:** The export boundary consumes canonical move analysis rather than the canonical display-position model.

**Recommended fix:** Build a typed `DisplayedPositionExport` from `positionFen`, orientation, branch/canonical identity, and optional analysis. Render absent verdicts honestly.

**Tests required:** canonical ply, branch root, deep branch, return to game, FEN-only, black orientation, Unicode players, deterministic filename.

### OCR-008 — UI cannot underpromote

**Severity:** P1
**Area:** Chess interaction, accessibility
**Files:** `apps/web/src/components/review-shell.tsx` board handlers; `packages/chess-core/src/game.ts` (`playLegalBoardMove`)

**Observed behavior:** The rules helper supports a promotion piece. Click selection chooses the queen destination first and drag calls the move action without a promotion, causing the helper's queen default.

**Expected behavior:** Click, drag, and keyboard paths prompt for queen/rook/bishop/knight before committing, and cancel leaves the board unchanged.

**Why it matters:** Underpromotion is legal and sometimes uniquely correct. The current board cannot express every legal move.

**Reproduction steps:** Load `8/P7/8/8/8/8/7k/7K w - - 0 1`, move `a7` to `a8`, and try to choose a knight. No chooser exists.

**Root cause:** Presentation defaults were built around common queen promotion, while the explicit core parameter was not exposed.

**Recommended fix:** Add an accessible modal/popover promotion chooser keyed by exact `from+to`, shared by click/drag/keyboard, then pass explicit UCI promotion.

**Tests required:** all four promotions, capture-underpromotion, black promotion, cancel, rapid double activation, branch/canonical isolation, keyboard focus return.

### OCR-009 — Local service identity is not authenticated

**Severity:** P1
**Area:** Local-ai security, privacy, process ownership
**Files:** `scripts/dev.mjs`; `apps/desktop/src-tauri/src/native_services.rs`; `apps/web/src/lib/use-local-ai-health.ts`; local-ai health schema

**Observed behavior:** Development and desktop probes treat any JSON response at the configured `/health` as the expected service. Browser requests then send FENs, moves, and coach facts to that address. There is no product/version/capability nonce or per-launch authentication.

**Expected behavior:** The client verifies service identity and authenticates sensitive/mutating requests to the process launched or explicitly configured by the user.

**Why it matters:** A stale or malicious process occupying port 8000 can receive game data or impersonate model/provider status.

**Reproduction steps:** Bind another JSON server to port 8000 before `pnpm dev`; the launcher can report it as reusable, and the browser targets that origin.

**Root cause:** Liveness and identity are conflated; process ownership is tracked only for shutdown.

**Recommended fix:** Add a versioned capability document, managed per-launch token, strict schema, expected product ID, and explicit trust UX for custom service URLs.

**Tests required:** wrong product JSON, old protocol version, port collision, token rotation, process restart, malformed health, custom URL opt-in, no data sent before verification.

### OCR-010 — Desktop CSP is disabled

**Severity:** P1
**Area:** Desktop/Tauri security
**Files:** `apps/desktop/src-tauri/tauri.conf.json`; desktop frontend network use

**Observed behavior:** `app.security.csp` is `null` in the desktop shell, while the mobile shell defines a policy.

**Expected behavior:** A least-privilege CSP allows only packaged assets and explicitly required Tauri IPC/local service connections.

**Why it matters:** Desktop webviews have native integration and a larger consequence if content injection occurs. A null CSP removes a major containment layer.

**Reproduction steps:** Inspect the desktop Tauri configuration and built webview response policy.

**Root cause:** Foundation packaging was prioritized before a production security policy.

**Recommended fix:** Define/test `default-src 'self'`, narrow `connect-src`, image/font/style rules, worker/WASM needs, and Tauri IPC requirements. Avoid broad wildcards and document every exception.

**Tests required:** packaged startup on macOS/Windows/Linux, local-ai health, file import, blocked remote script/image/connect attempts, production CSP console clean.

### OCR-011 — Global arrow navigation conflicts with keyboard interaction

**Severity:** P1
**Area:** Accessibility, state/events
**Files:** `apps/web/src/components/review-shell.tsx` global key effect and board handlers; review tabs/candidates/menus

**Observed behavior:** Document-level ArrowLeft/ArrowRight navigation ignores input, textarea, and select, but not buttons, links, summaries, contenteditable regions, or graph points. Arrow keys on a focused control can unexpectedly change ply. Board play itself is exposed primarily through square click/drag handlers, with no first-class keyboard square-selection model.

**Expected behavior:** Shortcuts run only when focus is outside interactive widgets (or require a modifier), announce the resulting move, and coexist with a keyboard-operable board.

**Why it matters:** Keyboard and assistive-technology users can lose context or trigger a chess navigation action while operating another control.

**Reproduction steps:** Focus a candidate, timeline point, menu summary, or review tab and press ArrowLeft/ArrowRight. The document handler can navigate the game.

**Root cause:** The shortcut guard uses a small tag denylist instead of an interaction-context policy.

**Recommended fix:** Use `closest` against interactive/contenteditable/widget roles, ignore modified/repeated events where appropriate, add shortcut help, and implement roving keyboard board focus with legal-destination announcements.

**Tests required:** every interactive element class, contenteditable, graph point, held key, autoplay, screen-reader browse/focus modes, board move/cancel/promotion via keyboard.

### OCR-012 — Mobile controls are below recommended touch size

**Severity:** P1
**Area:** Responsive UX, accessibility
**Files:** web header/review navigation CSS; board utilities; playback controls; analysis mode buttons

**Observed behavior:** At 390×844 there was no horizontal overflow, but 17 visible controls were below 44×44 CSS pixels. Flip and playback controls were 32–35 px; top links, section tabs, and source buttons were 27–32 px high.

**Expected behavior:** Primary touch targets are at least 44×44 px or have equivalent nonoverlapping target area, without shrinking the board.

**Why it matters:** Navigation and analysis-source switching are frequent actions and currently demand precision on phones.

**Reproduction steps:** Open a reviewed game at 390×844 and measure visible `button`/`a` bounding boxes.

**Root cause:** Compact desktop control dimensions were retained at the mobile breakpoint.

**Recommended fix:** Increase hit areas with padding/pseudo-elements, preserve quiet visual glyph size, and reflow source tabs where needed.

**Tests required:** automated target-size audit at 320/360/390/430 px, zoom 200%, no overlaps, board remains unobscured.

### OCR-013 — API resource and provider failure boundaries are incomplete

**Severity:** P1
**Area:** API security, availability, integration resilience
**Files:** all `apps/web/src/app/api/**/route.ts`; local-ai Pydantic schemas/routes; Lichess NDJSON and Chess.com JSON parsing

**Observed behavior:** JSON bodies, PGNs, move arrays, PV arrays, and coach facts have no explicit request-size budget or rate control. Public provider proxy routes can consume upstream quotas. Lichess NDJSON is parsed with an all-or-nothing `JSON.parse` map; malformed provider payloads mostly become generic failures rather than typed retryable/permanent states.

**Expected behavior:** Bounded requests, per-route concurrency/rate budgets, strict provider schemas, redirect policy, and typed 404/429/5xx/malformed/offline results.

**Why it matters:** One client or malformed provider response can consume memory, local model time, or provider quota and leave sync resume state ambiguous.

**Reproduction steps:** Submit a very large JSON body/move list; return one malformed Lichess NDJSON line; return Chess.com HTML with HTTP 200; send rapid public username requests.

**Root cause:** Routes focus on happy-path adapter behavior and delegate default limits to runtimes/providers.

**Recommended fix:** Add explicit body/content limits before parsing, bounded schema lengths, per-account operation locks, provider timeouts/retries with jitter and `Retry-After`, and stable error codes.

**Tests required:** oversized bodies, slowloris/timeout boundary, 429 with retry-after, 404, 500, HTML 200, one bad NDJSON line, cancellation and resume after partial batch.

### OCR-014 — Off-device coach data flow is not disclosed at choice time

**Severity:** P1
**Area:** Privacy UX, coach
**Files:** `apps/web/src/components/settings-page.tsx`; coach panel/status copy; `docs/ai-coach.md`

**Observed behavior:** Ollama is labeled local. The OpenAI-compatible option says it is configured server-side but does not state, beside the selector/generate action, that structured PGN-derived facts, FENs, moves, names/metadata where included, and engine/Maia evidence can leave the device.

**Expected behavior:** The provider selection and first remote generation clearly identify what is sent, destination class, retention dependency, and how to return to local/deterministic mode.

**Why it matters:** The home page's local-storage promise is technically qualified, but a user can still make a privacy-relevant choice without informed context.

**Reproduction steps:** Select OpenAI-compatible in Settings and inspect the provider and Study generate affordances.

**Root cause:** Runtime readiness copy is used as privacy disclosure.

**Recommended fix:** Add concise inline data-flow copy and a first-use confirmation stored locally; exclude unnecessary headers/identifiers from coach facts; link to a data-flow document.

**Tests required:** provider switching, first-use disclosure, deterministic fallback, no remote request before confirmation, exported data contains no provider secret.

### OCR-015 — IndexedDB trusts objects and has no eviction/recovery policy

**Severity:** P1
**Area:** Persistence, reliability, performance
**Files:** `apps/web/src/lib/browser-storage.ts`; `analysis-cache.ts`; library consumers

**Observed behavior:** Version 4 migration creates stores but does not validate existing records or establish query indexes. `getAll` results are cast to domain types. Sort paths assume strings/dates exist. Analysis cache records are accepted without robust schema/version verification and never evicted.

**Expected behavior:** Every read is schema-validated/migrated, corrupt records are quarantined or recoverable, deterministic cache entries have TTL/LRU/quota policy, and lists are indexed/paged.

**Why it matters:** One stale/corrupt object can break startup or History, and analysis/coach data grows indefinitely.

**Reproduction steps:** Insert a review without its date/title fields or a cache object with mismatched algorithm version, then load the relevant list/review. Repeatedly analyze unique positions and observe no cleanup.

**Root cause:** IndexedDB versioning is structural only; runtime domain-schema evolution and quota behavior are not modeled.

**Recommended fix:** Add versioned Zod/manual validators, transactional migrations, corrupt-record quarantine/export, last-access metadata, LRU/size limits, and indexed pagination.

**Tests required:** every historical schema version, corrupt/missing fields, quota exception, aborted migration, cache version mismatch, eviction order, multi-tab upgrade.

### OCR-016 — Critical rules and engine lifecycle lack regression coverage

**Severity:** P1
**Area:** Test quality, chess correctness
**Files:** `packages/chess-core/src/game.test.ts`; `packages/stockfish/src/browser-engine.test.ts`; E2E suites

**Observed behavior:** Core tests cover basic PGN/FEN, legal/illegal play, checkmate/stalemate terminal synthesis, and default queen promotion. They do not cover castling, en passant, explicit underpromotion, threefold, move-count draws, malformed SAN/PGN, or variant rejection. BrowserStockfish tests do not exercise a realistic Worker lifecycle, UCI initialization failure, abort races, MultiPV assembly, no-PV error, or repeated teardown.

**Expected behavior:** Release-critical chess rules and asynchronous engine lifecycle have deterministic contract tests independent of a single happy-path E2E run.

**Why it matters:** The passing suite gives false confidence exactly at the boundaries most likely to produce wrong chess facts or worker leaks.

**Reproduction steps:** Review the named test files and map the requested rule/lifecycle matrix to test cases.

**Root cause:** Tests grew around implemented features and regressions rather than a release-oriented boundary matrix.

**Recommended fix:** Add table-driven rule fixtures, upstream compatibility fixtures where applicable, a controllable fake UCI Worker, and history-sensitive engine command tests.

**Tests required:** the full matrix in the recommendation plus branch/canonical invariants and mate score POV at both colors.

### OCR-017 — Desktop is not the reviewed product yet

**Severity:** P1
**Area:** Desktop readiness, release packaging
**Files:** `apps/desktop/src/app.tsx`; desktop Tauri configuration/Rust commands; `docs/desktop.md`; artifact workflow

**Observed behavior:** Desktop imports/parses PGN, displays service status, and manages local-ai/Ollama ownership, but does not provide the web review, Stockfish, library, settings, Maia compare, or coach workflow. Artifacts are unsigned; the macOS job explicitly uses `--no-sign`.

**Expected behavior:** If advertised as a desktop product, it reuses canonical packages for the complete core review flow and is signed/notarized with upgrade/crash-recovery behavior.

**Why it matters:** Packaging a service-control proof of concept as the product would mislead users and create platform trust warnings.

**Reproduction steps:** Build/run desktop and compare its route/feature surface with the web application and desktop documentation.

**Root cause:** The roadmap correctly calls this a Phase 6 foundation, but release language can outpace implementation.

**Recommended fix:** Keep desktop explicitly experimental. Resolve CSP/service auth first, then share web composition without copying analysis semantics; add signing, notarization, updater policy, file-open handoff, and crash recovery.

**Tests required:** three-platform packaged smoke, signed artifact verification, file association, port collision, child crash/restart, upgrade preserving library, offline review.

### OCR-018 — Review duplicates health and Ollama polling

**Severity:** P2
**Area:** Performance, local services
**Files:** `apps/web/src/hooks/use-review-human.ts`; `use-review-coach.ts`; `use-local-ai-health.ts`; `services/local-ai/src/chess_review_local_ai/coach_provider.py`

**Observed behavior:** Human and Coach hooks each mount `useLocalAiHealth`, creating two `/health` polling lifecycles. One health calculation performs separate Ollama `/api/tags` calls for status, model status, and available models.

**Expected behavior:** One shared external-store/provider supplies health to all review consumers, and one catalog request populates all Ollama fields.

**Why it matters:** The idle Review page can make six redundant Ollama calls per polling interval and multiplies work on focus/reconnect.

**Reproduction steps:** Open Review with local-ai and Ollama online and count `/health` and `/api/tags` requests over 15 seconds.

**Root cause:** Hooks own polling independently and provider status methods do not share a snapshot.

**Recommended fix:** Add a context/useSyncExternalStore health service with request coalescing; fetch Ollama catalog once per health TTL.

**Tests required:** one poll for multiple consumers, focus refresh coalescing, unmount, offline backoff, shared abort, one catalog request.

### OCR-019 — Reduced-motion and progress semantics are incomplete

**Severity:** P2
**Area:** Accessibility
**Files:** web CSS; `review-route-panels.tsx`; `connected-accounts.tsx`; analysis completion notices

**Observed behavior:** Web styles do not implement `prefers-reduced-motion`; board transitions remain enabled. Several `<progress>` elements lack accessible labels, and progress/completion changes are not consistently exposed through `role=status`/`aria-live`.

**Expected behavior:** Reduced-motion disables nonessential movement, every progressbar has a name/value context, and asynchronous completion/error is announced once.

**Why it matters:** Motion-sensitive and screen-reader users receive less usable feedback in long-running core operations.

**Reproduction steps:** Enable reduced motion and inspect board animation; run review/sync with a screen reader or accessibility tree.

**Root cause:** Visual progress and animation were implemented before accessibility acceptance criteria.

**Recommended fix:** Add reduced-motion tokens/rules, labeled progress components, and a centralized polite status region with deduplication.

**Tests required:** computed motion duration under media query, accessible names/values, one announcement per state transition, cancellation/error.

### OCR-020 — No centralized chess audio in audited HEAD

**Severity:** P2
**Area:** Audio, product polish, accessibility
**Files:** Review playback/branch actions, Settings, public assets

**Observed behavior:** Audited HEAD contains no sound assets, resolver, persisted sound preference, volume/theme setting, quick mute, or navigation sound semantics.

**Expected behavior:** A single sound controller derives quiet/capture/castle/check/checkmate events from legal chess transitions, obeys precedence, unlocks after user gesture, and plays once per displayed move transition.

**Why it matters:** Move feedback is a meaningful parity/polish gap and improves navigation confirmation, provided mute is immediate.

**Reproduction steps:** Navigate/play moves and inspect Settings/board utilities; no audio facility exists.

**Root cause:** Audio was deferred while objective/human analysis matured.

**Recommended fix:** Implement the requested centralized layer using locally stored, source-pinned WintrChess MP3s; document GPL-3.0 provenance and unit-test resolver/dedup/navigation.

**Tests required:** quiet, capture, castle, check, capture-check precedence, promotion fallback, checkmate; forward/back/jump/autoplay; initial-load silence; mute/volume persistence; rejected `play()`.

### OCR-021 — CI/supply-chain coverage is incomplete

**Severity:** P2
**Area:** CI, dependencies, supply chain
**Files:** `.github/workflows/ci.yml`; `desktop-artifacts.yml`; lockfiles

**Observed behavior:** Core CI is broad and avoids live providers, but regular CI tests mobile Rust only, not desktop Rust. Visual tests are not in CI. Most GitHub Actions use mutable major tags (`actions/checkout@v6`, setup actions, rust-cache). Rust advisories are not checked locally/CI.

**Expected behavior:** All native hosts compile/test in PR CI; privileged third-party Actions are pinned to reviewed SHAs; advisory checks are reproducible and policy-driven.

**Why it matters:** A desktop regression or upstream Action tag compromise can bypass the current gates.

**Reproduction steps:** Inspect workflows; attempt `cargo audit` in the baseline environment.

**Root cause:** CI optimizes duration and convenience; only `setup-uv` in the main CI is SHA-pinned.

**Recommended fix:** Add desktop host test job, pin actions, enable Dependabot/Renovate policy, add cargo-deny/audit with an allowlist, and run a small deterministic visual set in CI.

**Tests required:** workflow dry run on PR/fork, action SHA update process, advisory allowlist expiry, desktop compile on supported host.

### OCR-022 — Remote provider transport policy is permissive

**Severity:** P2
**Area:** Provider security, privacy
**Files:** local-ai coach provider configuration/client

**Observed behavior:** The OpenAI-compatible base URL is environment-configured and used as supplied. There is no explicit policy requiring HTTPS for remote hosts, allowing only loopback HTTP, or validating redirect destinations.

**Expected behavior:** Remote providers require HTTPS, loopback HTTP is an explicit local exception, redirects are disabled or revalidated, and API keys never cross scheme/host changes.

**Why it matters:** A misconfiguration can transmit API credentials and chess facts in cleartext or to an unexpected redirect target.

**Reproduction steps:** Configure an `http://` non-loopback base URL or redirecting endpoint and invoke coach generation.

**Root cause:** Provider compatibility accepts arbitrary OpenAI-compatible endpoints without a transport trust model.

**Recommended fix:** Parse/validate base URLs at startup, require HTTPS unless loopback, reject embedded credentials/fragments, disable redirects, and report a safe configuration error.

**Tests required:** HTTPS, loopback HTTP, remote HTTP rejection, redirect host/scheme change, IPv6 loopback, no key in errors/logs.

### OCR-023 — Annotated PGN is not round-trip faithful

**Severity:** P2
**Area:** Export correctness
**Files:** annotated PGN exporter and tests

**Observed behavior:** Export reconstructs a clean mainline with review annotations, losing original comments, NAGs, and variations.

**Expected behavior:** Either preserve source movetext structure while adding namespaced annotations, or explicitly label the export as a flattened reviewed mainline and provide the original PGN separately.

**Why it matters:** User-authored study content can disappear from a derived artifact without warning.

**Reproduction steps:** Import a PGN with comments, `$` NAGs, and a variation; export Annotated PGN and compare.

**Root cause:** `NormalizedGame` stores canonical plies but not a lossless PGN AST.

**Recommended fix:** Choose and document one contract: lossless parser/AST augmentation, or dual original + flattened annotated export with explicit UI copy.

**Tests required:** comments, NAGs, nested variations, Unicode, custom FEN, malformed-but-tolerated PGN, deterministic output.

### OCR-024 — Required performance budgets are not measured

**Severity:** P2
**Area:** Performance, reliability evidence
**Files:** test/benchmark infrastructure; CI

**Observed behavior:** Bundle and E2E smoke data exist, but there is no budget for first WASM analysis, full long game, MultiPV, 1,000/10,000-game library, IndexedDB restore, timeline size, route transition, or Maia 5M/23M/79M latency/memory. The larger models were not downloaded or benchmarked during this audit.

**Expected behavior:** Versioned representative fixtures and budgets detect regressions without depending on live external services.

**Why it matters:** Resource contention is central to the architecture, and correctness tests cannot show that the app remains interactive on ordinary hardware.

**Reproduction steps:** Search test/CI scripts for performance budgets and large-library fixtures; none cover the requested matrix.

**Root cause:** Optimization is architectural but not instrumented as an acceptance gate.

**Recommended fix:** Add opt-in local benchmarks plus stable CI smoke budgets; record device class, cold/warm cache, depth/MultiPV/model, and peak worker memory.

**Tests required:** the complete matrix above, board input latency during background review/Maia, repeated route cycles, worker count after teardown.

### OCR-025 — Variant boundary is implicit

**Severity:** P2
**Area:** Chess import, documentation
**Files:** `packages/chess-core/src/game.ts` (`parsePgn`); import UI/docs

**Observed behavior:** PGN parsing runs chess.js in standard chess mode and does not explicitly inspect/reject `Variant` headers. Chess960 castling notation/semantics are not supported or described at import time.

**Expected behavior:** Unsupported variants fail with a precise, user-facing message before any canonical analysis record is created.

**Why it matters:** Silent standard-chess interpretation or a generic parse error is unsafe for a chess-analysis product.

**Reproduction steps:** Import a Chess960/variant PGN with a `Variant` header and castling semantics outside standard chess.

**Root cause:** Standard chess is assumed as an implicit product boundary.

**Recommended fix:** Validate recognized headers/starting position and reject unsupported variants with an enumerated error; document standard chess only.

**Tests required:** Standard, Chess960, From Position, unsupported named variant, conflicting FEN/Variant, user-facing error.

### OCR-026 — Repeated quality icons can be verbose to screen readers

**Severity:** P2
**Area:** Accessibility, UI component API
**Files:** `packages/ui/src/quality-icon.tsx`; move list, graph, summary consumers

**Observed behavior:** `QualityIcon` defaults to a labeled image. In rows where adjacent visible text or the parent button already includes the classification, this can announce the same label twice.

**Expected behavior:** Decorative usage is hidden; standalone usage remains labeled. The shared API makes the choice explicit without changing icon semantics.

**Why it matters:** A graph or summary with many badges becomes noisy and harder to scan nonvisually.

**Reproduction steps:** Inspect the accessibility tree for a move-quality row/button containing both `QualityIcon` and classification text.

**Root cause:** A safe standalone default is reused in composite controls without consumer-level decoration semantics.

**Recommended fix:** Add a documented `decorative`/`aria-hidden` path or require an accessible label only when standalone; audit every consumer.

**Tests required:** accessibility tree for standalone and composite icons, all 14 classifications, no loss of button names.

## Explicit data-flow map

| Data | Created/received | Storage and retention | Access | Leaves device? | Deletion in audited HEAD |
|---|---|---|---|---|---|
| PGN | paste/example/file/provider sync | IndexedDB review/synced-game records; indefinite | browser app; exported artifacts; local-ai coach facts derived from it | provider PGN arrives over network; remote coach can receive structured derivatives | no review/game delete UI (**gap**) |
| FEN | PGN replay, explicit import, branches | records/cache; branch in React/Zustand | browser Stockfish, chess-core, local-ai Maia/coach | to loopback Maia; to remote coach if selected | only by browser-site data clearing (**gap**) |
| Chess.com username | user/public profile link | platform account + sync state in IndexedDB | browser and Next Chess.com adapter | sent to Chess.com public API | disconnect removes account/sync state; imported games remain |
| Lichess identity | OAuth profile | public account metadata in IndexedDB | browser | OAuth/API requests to Lichess | disconnect clears account and server cookie; games remain |
| Lichess OAuth token | OAuth callback | AES-GCM encrypted HttpOnly cookie | Next server routes only | sent only to Lichess API | disconnect/revocation clears cookie |
| Ratings/profile | provider response/PGN | IndexedDB account/game/review metadata | browser UI/export where included | source provider already has it; can enter remote coach facts depending schema | account disconnect only; derived records remain |
| Game history | provider sync/import | IndexedDB synced games/reviews | browser | provider requests fetch it; explicit full-history import may queue local Stockfish; no automatic Maia/Coach transmission | no per-game/account-origin purge (**gap**) |
| Stockfish analysis | local WASM workers | IndexedDB analysis cache/review | browser/UI/export/coach fact builder | only if remote coach is explicitly used | no cache clear/eviction (**gap**) |
| Maia analysis | loopback FastAPI model | enriched review/analysis record in IndexedDB | browser/local-ai; coach facts | local by default; structured result can enter remote coach facts | tied to undeletable review/cache (**gap**) |
| Coach prompt/facts | browser analysis package/local-ai | request memory; resulting explanation persisted in review | local-ai provider and browser | Ollama: no; OpenAI-compatible remote: yes | no explanation-only delete (**gap**) |
| Coach response | provider/local fallback | review analysis in IndexedDB | browser/export | remote provider originated it when selected | no explanation-only delete (**gap**) |
| API keys | local-ai environment | process environment | local-ai provider client | sent to configured remote provider | external to app UI; restart/config removal |
| Settings | Settings UI | localStorage indefinitely | browser | no, except behavior controls later requests | only browser-site clearing; no reset button (**gap**) |
| Avatars | provider URL | URL in account record; browser HTTP cache external to app | browser and avatar host | browser contacts the avatar host, exposing ordinary request metadata | disconnect removes account URL; browser cache is separate |
| Telemetry | none implemented by Open Chess Review | none | none | no product telemetry found | not applicable |

### Local-first claim that is accurate

- Browser Stockfish, chess rules, openings, objective classification, Accuracy, phase division, local records, and exports run locally.
- Maia and Ollama are local only when the configured loopback services are genuine and trusted.
- OpenAI-compatible coaching sends structured chess facts off-device.
- Chess.com/Lichess connection and sync necessarily contact those providers.
- External avatar URLs cause ordinary browser requests to their hosts.

The UI should say this exact boundary instead of “everything stays local.”

## State, concurrency, and resource scheduling judgment

The current cursor/branch model is substantially correct: `currentPly` is the canonical displayed ply, the reviewed move is `moves[currentPly-1]`, position candidates root at the exact displayed FEN, Maia move review binds `fenBefore+uci+ply`, Maia position analysis binds the displayed FEN, and branches preserve a root ply plus selected node identity. Stale Maia and coach responses are protected with AbortControllers, generation/identity checks, and structured-fact equality.

Full-game Stockfish uses a maximum two-worker pool. Interactive position, continuation, and branch searches have separate single workers and abort on identity change. That is a reasonable first scheduler, and cancellation terminates workers. The missing pieces are one global priority/budget policy across all Stockfish/Maia/coach work, instrumented CPU/memory budgets, repetition-aware job identity, and deeper Worker race tests. The duplicate service polling in OCR-018 is the clearest current waste.

## UI and information architecture judgment

The current structure communicates the intended hierarchy reasonably well:

- Review = analyze objective facts and compare sources;
- Moves = inspect the move ledger;
- Study = learn through grounded coaching;
- Engine Lab = advanced configuration/details.

Do not restore a separate Human route, do not present Maia as centipawns or objective quality, and do not add Lc0 to the primary flow. The main UX work is reducing operational friction and improving feedback, not adding more analysis sources.

Visual hierarchy is strong: board first, editorial typography, restrained cards, consistent V3 icons, clear source labels, useful empty states, and responsive stacking. The mobile layout is materially better than a shrunken desktop canvas. Remaining polish gaps include small touch targets, no sound in audited HEAD, limited reduced-motion behavior, sparse shortcut guidance, and long stacked pages on phone.

## Test inventory and confidence

| Class | Present | Confidence and gaps |
|---|---|---|
| Unit | shared/chess-core/analysis/openings/stockfish/web/Python/Rust | Strong analysis coverage; missing release rule matrix and Worker races |
| Integration | local-ai API/provider fakes, storage helpers, review orchestration | Good deterministic boundaries; corruption/quota/service identity weak |
| Contract | provider route fixtures, coach facts/schemas | No live dependency in CI (correct); malformed/redirect/429 matrix incomplete |
| E2E | 13 semantic Chromium workflows | Covers import, real WASM, terminal positions, candidate identity, async coach, library; keyboard/mobile/promotion/audio/offline matrix missing |
| Visual | Quality Icon V3 fixtures at 1440/1728/1920 | Passed locally; not run in CI; no complete 1024/mobile baseline |
| Performance | bundle output and ad-hoc timings | No budgets or large-library/all-model fixtures |

No CI job depends on live Chess.com, Lichess, Ollama, Maia, or OpenAI. This is the right contract-test design.

## Product scorecard

| Category | Score | Why / major blockers | What raises it to 9/10 |
|---|---:|---|---|
| Chess correctness | 7 | Strong chess.js boundary and terminal/mate handling; history draw and underpromotion UI gaps | History-aware draws, full rule/variant fixtures, accessible promotion |
| Analysis semantics | 8 | Canonical White POV, Lichess Accuracy/Divider, evidence labels | Resolve history identity and add upstream compatibility corpus |
| Human-analysis quality | 7 | Clean Maia move/position separation and Elo policy semantics | Benchmark all models, calibrate difficulty with fixtures, clearer uncertainty |
| Coach grounding | 8 | Structured facts, legal line validation, deterministic fallback | Adversarial claim tests, provider disclosure, explanation deletion |
| Privacy | 6 | Local-first core and HttpOnly OAuth token | Complete deletion/retention, remote-flow consent, service authentication |
| Security | 5 | Good PKCE/XSS posture and loopback default | Fix download CSRF/auth, SSRF, CSP, limits, provider transport, Action pins |
| UI design | 8 | Cohesive editorial system, board prominence, V3 icons | Contrast audit, appearance controls, complete visual state matrix |
| UX | 7 | Deep branch/candidate/study flow | Promotion, exact exports, audio, shortcut/help and feedback polish |
| Accessibility | 5 | Semantic base, focus styles, graph keyboard points | Keyboard board, scoped shortcuts, 44 px targets, live progress, reduced motion |
| Performance | 6 | Bounded Stockfish pool, acceptable bundle shape | O(batch) sync, shared polling, cache/index strategy, measured budgets |
| Reliability | 6 | Good stale-result guards and passing E2E | Stable cursors, corrupt storage recovery, provider error matrix, service identity |
| Offline behavior | 8 | Browser Stockfish/library and deterministic coach fallback | Offline install/cache UX and explicit offline E2E across routes |
| Connected accounts | 6 | PKCE Lichess and resumable sync without auto-analysis | SSRF fix, stable cursor, typed failures, delete/reconcile lifecycle |
| Data architecture | 6 | Strong shared schemas/package boundaries | Versioned IndexedDB validation, pagination/indexes, lifecycle APIs |
| Testing | 8 | Broad deterministic gates and real browser Stockfish | Critical rule/Worker/accessibility/performance matrix and visual CI |
| Documentation | 8 | Architecture/analysis docs largely match code | Data lifecycle/security runbook, explicit variant/audio/performance contracts |
| Desktop readiness | 3 | Solid foundation/ownership tests only | Full shared product, CSP/auth, signed/notarized three-platform artifacts |
| Product differentiation | 9 | Stockfish + Maia + grounded coach + local branches is genuinely distinctive | Make trust/polish match the analysis depth; avoid feature sprawl |

## Top 10 findings

1. OCR-001 — repetition-sensitive game state is lost before Stockfish.
2. OCR-002 — unauthenticated model-download mutation can violate explicit approval.
3. OCR-003 — Chess.com archive URL trust creates an SSRF boundary.
4. OCR-004 — local games and derived analysis cannot be deleted.
5. OCR-009 — the client cannot authenticate the local-ai process it trusts with game data.
6. OCR-010 — desktop CSP is disabled.
7. OCR-007 — Position PNG can be stale/wrong for branches and absent for FEN studies.
8. OCR-008/OCR-011 — not every legal move or board workflow is keyboard-operable.
9. OCR-005/OCR-006 — large Chess.com sync has quadratic work and an unstable resume identity.
10. OCR-015/OCR-016 — persistence and rule/worker tests do not yet justify public-release confidence.

## P0/P1 release blockers

### P0 — must fix before any public release

| ID | Work | Size |
|---|---|---:|
| OCR-001 | History-aware engine/draw/cache identity | L |
| OCR-002 | Authenticated explicit model-download boundary | M |

### P1 — should fix before beta

| ID | Work | Size |
|---|---|---:|
| OCR-003 | Validate Chess.com archive destinations/redirects | S |
| OCR-004 | Local deletion, purge, cache clear, reset | M |
| OCR-005 | Indexed upsert/pagination sync path | M |
| OCR-006 | Stable versioned Chess.com cursor | M |
| OCR-007 | Display-position export model | M |
| OCR-008 | Accessible promotion chooser | M |
| OCR-009 | Local service identity and per-launch auth | L |
| OCR-010 | Least-privilege desktop CSP | S |
| OCR-011 | Scoped shortcuts + keyboard board | M |
| OCR-012 | Mobile touch targets | S |
| OCR-013 | Body/rate/provider error limits | M |
| OCR-014 | Remote coach privacy disclosure/consent | S |
| OCR-015 | Validated migrations, indexes, eviction/recovery | L |
| OCR-016 | Critical rule and Worker regression matrix | M |
| OCR-017 | Keep desktop experimental until the full product is shared | XL |

### P2 — polish before stable

| ID | Work | Size |
|---|---|---:|
| OCR-018 | Coalesce health/catalog polling | S |
| OCR-019 | Reduced motion and accessible progress | S |
| OCR-020 | Central chess audio and preferences | M |
| OCR-021 | Action pins, desktop CI, Rust advisory gate | M |
| OCR-022 | Remote provider transport policy | M |
| OCR-023 | Explicit/lossless annotated PGN contract | M |
| OCR-024 | Large-library/model/performance budgets | L |
| OCR-025 | Explicit variant rejection boundary | S |
| OCR-026 | Decorative quality-icon semantics | S |

### P3 — future enhancements

| Work | Size |
|---|---:|
| Additional sound themes after the WintrChess set is measured | M |
| Optional privacy-preserving cloud backup | XL |
| Desktop updater and deeper OS integration | XL |
| Additional grounded teaching visualizations | L |

## Recommended execution order

1. **Trust boundary:** OCR-002, OCR-003, OCR-009, OCR-010, OCR-022.
2. **Chess truth:** OCR-001 plus OCR-016 history/rule fixtures.
3. **Data ownership:** OCR-004 and OCR-015, then document retention.
4. **Connected reliability/performance:** OCR-005, OCR-006, OCR-013.
5. **Exact interaction/artifacts:** OCR-007, OCR-008, OCR-011, OCR-012.
6. **Privacy communication:** OCR-014 and the data-flow UI.
7. **Feedback/polish:** OCR-018, OCR-019, OCR-020, OCR-026.
8. **Evidence gates:** OCR-021, OCR-024, then re-score.
9. **Desktop expansion:** OCR-017 only after web beta gates hold.

## Architecture changes needed

1. **History-aware engine request:** a typed base-FEN + UCI history structure shared by canonical/branch Stockfish and its cache.
2. **Authenticated local-service session:** launcher-issued capability, versioned health identity, and one client gateway for Maia/coach/download.
3. **Displayed-position model:** one typed selector used by board, candidates, annotations, coach context, and exports.
4. **Persistence repositories with lifecycle:** validated versioned records, indexes, transactions, delete/purge/reset, paging, and cache retention.
5. **Shared external-service health store:** coalesced polling/catalog snapshots with focus/backoff semantics.
6. **Central chess feedback bus:** semantic move transition events consumed by audio and accessible status without UI-button coupling.

None of these changes should move score conversion, Accuracy, phase division, or classification into the UI.

## Exact tests to add

### Chess and Stockfish

- `repetition-command.test`: base FEN + UCI history, same final FEN distinct cache key.
- `draw-status.test`: threefold, fivefold, 50/75-move policy, stalemate, insufficient material, both colors.
- `legal-move-matrix.test`: standard/queen/rook/bishop/knight promotion, capture promotion, en passant, both castles, illegal king exposure.
- `pgn-boundary.test`: SAN round trip, comments/NAG/variation policy, SetUp/FEN, Chess960 rejection.
- `browser-worker-lifecycle.test`: UCI handshake timeout/error, MultiPV ordering, mate POV, searchmoves, abort at init/search, termination, no PV, repeated sessions.

### State/UI/export/audio/accessibility

- Branch invariant property tests for `currentPly/rootPly/selectedIndex/displayedFen/reviewedMove`.
- Exact-UCI Compare selection with shared destinations and no implicit source priority.
- Position PNG fixtures for canonical, branch, FEN-only, orientation, Unicode.
- Promotion chooser E2E by click, drag, keyboard, cancel, rapid repeat.
- Sound resolver table: quiet, capture, castle, check, capture-check, promotion, checkmate.
- Sound sequence tests: forward/back/jump/autoplay/branch, initial silence, duplicate suppression, muted/rejected play.
- Keyboard focus matrix and 44×44 target audit at mobile widths.
- Accessible progress names/live announcements and reduced-motion computed styles.

### Persistence/integrations/security

- IndexedDB schema v1–v4 migration, corruption quarantine, quota failure, LRU eviction, multi-tab upgrade.
- 1k/10k-game upsert and list pagination benchmarks.
- Chess.com stable cursor across inserted/removed/reordered archives.
- Provider 404/429/5xx/timeout/malformed/redirect/zero-game/cancel/resume matrix.
- SSRF allowlist tests including DNS/redirect/private address cases.
- Local-ai evil-origin/simple-form/wrong-token/restart-token/concurrent-download tests.
- Service identity wrong product/version/port collision tests.
- Remote provider HTTP/redirect/key-redaction tests.
- Data deletion transactional and disconnect-scope E2E.

## NOT VERIFIED

- Live WintrChess authenticated Archive, animation, audio, exact engine behavior, and current mobile interaction; the public current Help/privacy contract was verified, but interactive page loads timed out in the audit browser.
- Maia 5M/23M/79M latency, peak memory, accuracy calibration, and model-switch performance. Larger model downloads were correctly not initiated without approval.
- 1,000/10,000-game runtime timings and storage quota behavior; code-path complexity was established, not device timing.
- Rust dependency advisories (`cargo audit` unavailable).
- Signed/notarized desktop installation on the three platforms; artifacts are currently unsigned by design.
- Screen-reader testing with VoiceOver/NVDA and high-contrast/forced-colors modes; DOM/accessibility semantics and keyboard behavior were inspected.
- Real provider rate-limit behavior. CI correctly uses deterministic mocks rather than live accounts.

## Final release decision

The project is not a prototype in its analysis architecture: objective/human/coach separation, evidence-bearing classifications, local Stockfish, branches, and deterministic tests are unusually strong. The release risk is concentrated in trust and lifecycle boundaries rather than the product idea.

Do not ship publicly until OCR-001 and OCR-002 are closed with regression tests. A beta should also close the P1 security, deletion, export, promotion, cursor, persistence, and accessibility findings. Keep desktop labeled experimental. Once those gates pass, Open Chess Review can credibly exceed WintrChess through better analysis and teaching without sacrificing local-first trust.

## Post-audit remediation started in this working tree

The audit above remains the record of CURRENT HEAD before remediation. Two
small batches were then started as requested:

1. **OCR-020 closed in the working tree.** A centralized transition-derived
   sound controller, persisted enabled/volume/WintrChess settings, quick mute,
   locally copied source-pinned WintrChess MP3s, credits, and deterministic resolver,
   navigation, deduplication and rejected-play tests were added. No objective
   analysis semantics changed.
2. **OCR-002 reduced but remains open.** The model-download route now rejects
   missing/untrusted browser Origins and requires strict JSON
   `{ "confirm": true }`; the client sends that confirmation and Python/web
   regression tests cover the boundary. This blocks ordinary remote-site form
   CSRF. It is defense-in-depth, not the final fix: a per-launch capability and
   authenticated service identity from OCR-009 are still required before the P0
   can be closed.

## Follow-up audit — 2026-09-02

This follow-up audits the current working tree on top of the commit described
above, with emphasis on the connected-history → Training path, Review layout,
Stockfish branch navigation, and local-development startup. Existing unrelated
user changes in the dirty worktree were preserved.

### Requested flows

| Area | Result | Evidence |
|---|---|---|
| Successful full-history analyses | **Verified** | `loadStudyPlayerSummaries`/`loadStudyPlayerLibrary` repair missing external review links from current cache projections and successful job items; completed items are included in the selected account's Training report while failed items remain excluded. |
| Failed-game explanation | **Verified** | Training Coverage exposes per-game errors and maps common worker/MultiPV failures to plain-language explanations; invalid provider PGNs are excluded before retry rather than reported as chess errors. |
| Parallel history analysis | **Verified** | Durable history jobs use two bounded workers (`HISTORY_ANALYSIS_CONCURRENCY = 2`), with scheduler priority preserving current-board responsiveness. |
| Evaluation timeline placement | **Fixed** | The graph now lives inside Review's Game Summary card in the right contextual panel; the panel owns the scroll on desktop and the layout stacks on mobile. |
| Variation backtracking | **Fixed** | Engine PVs keep their full display path, while Stockfish history uses only the selected prefix. Stale aborted requests can no longer overwrite a newer branch result; stepping back leaves legal piece selection active. |
| `pnpm dev` startup | **Improved** | Optional Ollama and local-ai probes/startup run in parallel and are not awaited by the browser shell. `pnpm dev:check` remains synchronous for diagnostics and `--services-only` retains fail-fast behavior. |
| Review health polling | **Fixed for Review** | Maia and Coach share one memoized local-ai health runtime, removing duplicate intervals and `/health` requests during Review route transitions. |

### Regression checks run

- `pnpm test`: **PASS** — 10 shared, 14 chess-core, 75 analysis, 2 openings,
  13 Stockfish, and 121 web tests.
- `pnpm typecheck`: **PASS** across all TypeScript workspaces.
- `pnpm lint`: **PASS**.
- `pnpm build`: **PASS** for web, desktop, and mobile frontends.
- `uv run pytest` in `services/local-ai`: **PASS** — 34 tests (one existing
  Starlette/httpx deprecation warning).
- `pnpm test:e2e e2e/workflows.spec.ts`: **PASS** — 29 workflows.
- `pnpm test:e2e e2e/visual.spec.ts`: **PASS** — visual baselines regenerated
  for the new right-panel timeline.
- `pnpm dev:check`: **PASS** with local Ollama/model and local-ai available.

The remaining release gates in the original audit (CI/SHA pinning, desktop CSP,
resource limits, persistence hardening, large-history benchmarks, and signed
desktop artifacts) are unchanged and should not be inferred as closed by this
follow-up.
