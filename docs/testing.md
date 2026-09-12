# Testing and continuous integration

## Test layers

- Package Vitest suites cover canonical TypeScript algorithms, schemas, browser orchestration helpers and state models.
- `services/local-ai/tests` covers FastAPI schemas, Maia/provider behavior, Coach validation and deterministic grounding in Python.
- Playwright workflow tests cover real uncached browser-Stockfish review (including checkmate and stalemate endings), import, canonical navigation, orientation, legal user variation moves with runtime Stockfish Move Quality badges, exact Stockfish/Maia candidate-row identity, shared destinations, unbiased Compare overlap, Return to Game, background Coach completion across Review/Moves/Study navigation, rapid source/Coach actions, explicit button types, PNG export, mocked Maia availability/offline/setup behavior, move-N versus position-N identity, model/Elo invalidation, IndexedDB restoration, matching Coach facts, progressive large-library rendering, multi-game study evidence, persistent training progress and exact-ply training deep links.
- Playwright screenshot tests cover Home, White/Black board orientation, Brilliant/Blunder marks, a user variation, combined Stockfish/Maia evidence, deterministic grounded Study copy, Library composition and the complete 14-label Move Quality V3 fixture across four sizes/background families.
- `packages/shared/src/mobile.test.ts` covers offline/cache/device/remote source routing, secure pairing requirements, exact Maia tier and Coach language compatibility, and untrusted mobile endpoint manifest rejection.

`e2e/fixtures.ts` builds review data through the real parser and analysis assembler, can seed an unanalyzed record for an actual browser-Stockfish run, writes deterministic records to IndexedDB, and mocks the local-ai HTTP boundary. Tests must not require live Chess.com, Lichess, Maia, Ollama or cloud credentials.

`packages/analysis/src/study.test.ts` verifies that Phase 7 averages existing
canonical game/phase Accuracy values rather than recalculating them, keeps
opening groups color-specific, computes result/error summaries, enforces the
two-distinct-game weakness threshold and preserves exact evidence references.
Web package tests cover current-cache/player projection and deterministic queue
state transitions.

## Commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
uv run --project services/local-ai --extra dev pytest services/local-ai/tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --locked --manifest-path apps/mobile/src-tauri/Cargo.toml
pnpm --filter @chess-review/desktop sidecar:build
```

Screenshot baselines live in `e2e/__screenshots__`. After visually reviewing an intentional UI change, regenerate them with `pnpm test:e2e:update`; do not accept a changed image only to make CI green. `style-ownership.test.ts` prevents the canonical review-shell, workspace, panel and semantic selectors from regaining multiple stylesheet owners; `button-type.test.ts` parses every TSX button and rejects an implicit HTML submit type.

The E2E web server uses `pnpm dev:web`, so browser workflows validate Browser Core's offline boundary. Development builds unregister the offline service worker, and `e2e/mistake-practice.spec.ts` blocks service workers outright because two of its workflows force an engine load failure that the worker's engine cache would otherwise mask. `e2e/offline.spec.ts` runs against the production artifact in `playwright.release.config.ts`: it verifies the cached engine and reviewed routes, offline rendering, the uncached-route fallback and `/api/*` staying unintercepted, and it is scoped to Chromium for the measured reasons in [service boundaries](web-service-boundaries.md). The CI E2E job runs the semantic workflow suite on Linux. The committed visual suite remains available for reviewed local regression runs; platform-specific baselines can be added when the release matrix is introduced.

## CI

`.github/workflows/ci.yml` has four independent, dependency-cached jobs:

1. TypeScript typecheck, lint, package tests and production build.
2. Python local-ai tests through the locked uv environment.
3. Mobile-compatible Tauri host compilation/tests on macOS using the committed Cargo lock.
4. Chromium workflow E2E with Playwright-managed browser dependencies.

No CI job starts the managed local service or contacts a chess platform. Failure traces and screenshots from the E2E job are uploaded for diagnosis.

The separate `desktop-artifacts.yml` workflow builds the frozen local-ai
sidecar on each native runner before Tauri packaging. The macOS arm64 app/DMG,
Windows x64 NSIS and Linux x64 deb/AppImage jobs all completed successfully in
[run 32721845895](https://github.com/ice345/chess-review/actions/runs/32721845895),
including strict missing-artifact checks and upload of each unsigned package.
The workflow also rejects any individual package above 768 MiB; the locked
sidecar intentionally selects CPU-only PyTorch so CUDA runtime wheels cannot
inflate the portable Linux packages.
