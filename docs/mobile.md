# Mobile companion

Phase 8 is an implemented exploration gate. It selects Tauri Mobile, defines the
mobile product boundary and makes the local/remote routing policy executable and
testable. It does **not** claim an Android/iOS store artifact or a deployed remote
analysis service.

## Implemented feasibility slice

`apps/mobile` is an independent Vite + React + Tauri 2 shell. It currently:

- imports the existing Blue Bishop identity and shared packages;
- parses pasted PGN, `.pgn` files and explicit FEN locally through
  `@chess-review/chess-core`;
- renders the imported position with the same Feather Porcelain pieces as the Web
  app and navigates PGN plies without a network;
- presents English and Simplified Chinese copy;
- runs the versioned capability resolver against offline, cache, device-engine
  and paired-endpoint scenarios without sending a network request;
- carries a minimal `#[cfg_attr(mobile, tauri::mobile_entry_point)]` Rust host;
- builds as a static production frontend and compiles/tests as a host Tauri crate.

Run the browser feasibility view:

```bash
pnpm dev:mobile
```

Validate it:

```bash
pnpm --filter @chess-review/mobile typecheck
pnpm --filter @chess-review/mobile build
cargo test --manifest-path apps/mobile/src-tauri/Cargo.toml
```

The regular CI workflow runs the shared TypeScript tests/frontend build and a
separate macOS `cargo test --locked` job for the mobile-compatible Tauri host.

After installing the official mobile prerequisites, platform projects can be
generated through the checked-in scripts:

```bash
pnpm --filter @chess-review/mobile tauri:android:init
pnpm --filter @chess-review/mobile tauri:ios:init
```

Android requires Android Studio/JDK/SDK/NDK and Rust Android targets. iOS requires
full Xcode, CocoaPods and Rust iOS targets. Phase 8 intentionally does not commit
generated `src-tauri/gen` projects before a physical-device product gate exists.

## Capability boundary

The production companion boundary is:

| Capability | Offline baseline | Conditional device | Trusted remote |
| --- | --- | --- | --- |
| PGN/FEN import and legal replay | Required | — | Never required |
| Board and move navigation | Required | — | Never required |
| Previously stored canonical review | Required when cached/synced | — | Optional sync source |
| New Stockfish objective review | Existing cache first | Only after a real capability probe | Optional canonical engine endpoint |
| Maia probability/WDL | Cached facts only | Not a baseline workload | Paired Maia endpoint |
| Coach | Deterministic grounded copy | No local LLM assumption | Paired grounded Coach endpoint |
| Training queue/repertoire | From cached canonical reviews | — | Optional sync source |

The baseline never promises:

- an on-phone Ollama daemon or bundled large language model;
- an on-phone Maia checkpoint/runtime;
- unrestricted background full-game analysis;
- automatic desktop LAN exposure;
- OCR/screenshot position import;
- an LLM-derived evaluation, best move or Move Quality label.

On-device Stockfish remains a conditional optimization, not a requirement. A
future probe must verify Worker creation, WebAssembly support, engine readiness,
a bounded reference search, memory pressure and thermal/background behavior on
representative iOS and Android devices before setting `deviceStockfishReady`.

## Executable routing policy

`packages/shared/src/mobile.ts` owns `mobile-policy-v1`. The app supplies only
runtime facts; it does not decide source semantics inside React components.

```text
existing compatible cache
  -> use canonical cached facts

no cache + proven device Stockfish
  -> objective analysis on device

no cache + secure authenticated compatible endpoint
  -> Stockfish / Maia / Coach through their separate advertised capability

otherwise
  -> import/navigation remain local
  -> Maia is unavailable
  -> Coach uses deterministic grounded copy
```

The resolver deliberately checks Stockfish, Maia and Coach independently. A
reachable Coach endpoint cannot become an objective engine, and an endpoint that
lacks the selected Maia tier or requested Coach language does not receive that
task.

The future remote discovery response is `MobileEndpointManifestV1`:

```text
protocolVersion = mobile-endpoint-v1
endpointId
objective.available + canonical analysis schema/algorithm version + Stockfish version
human.available + exact Maia model tiers
coach.available + supported languages
```

Untrusted JSON is validated by `isMobileEndpointManifestV1()`. A manifest is
eligible only when the connection is online, securely transported and explicitly
authenticated. Version mismatch fails closed.

## Local/remote AI strategy

The desktop `local-ai` service remains bound to loopback by default. Mobile does
not discover it by scanning a LAN and Phase 8 does not weaken CORS or bind it to
`0.0.0.0`.

A production paired endpoint must add a separate relay boundary:

1. the user explicitly enables pairing on the desktop/server;
2. a short-lived pairing exchange establishes a device credential;
3. the device verifies an HTTPS endpoint and stores the credential in the native
   Keychain/Keystore, never in web local storage;
4. the relay exposes only versioned analysis endpoints and a manifest, not raw
   Ollama or shell/process APIs;
5. objective responses are validated as compatible canonical Stockfish facts;
6. Maia responses retain model/Elo identity and model-prediction labels;
7. Coach requests contain structured facts and preserve all existing grounding,
   language and legal-PV validation;
8. revoke, logout and endpoint removal delete the device credential and cached
   remote session metadata.

Cloud/OpenAI-compatible credentials stay at the relay/provider boundary. The
mobile app must not embed an API key in its bundle. Data sent for Coach generation
is opt-in and minimized to the existing structured facts; no bulk library upload
is implied.

## Production-mobile acceptance gate

A later implementation phase may generate native targets only after it can test:

- current and minimum-supported iOS/Android devices;
- board touch behavior, safe areas, rotation, text scaling and screen readers;
- WebView IndexedDB persistence and file/share-sheet import;
- Stockfish Worker/WASM readiness, bounded performance, memory and thermal use;
- background suspension/cancellation and recovery;
- secure pairing, credential storage, TLS failure and revocation;
- canonical schema mismatch and corrupt-cache rejection;
- offline-to-online transitions without source blending;
- signed store artifacts and privacy disclosures.

Framework rationale is recorded in
[`adr/0002-tauri-mobile-companion.md`](adr/0002-tauri-mobile-companion.md).
