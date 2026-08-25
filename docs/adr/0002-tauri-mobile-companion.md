# ADR 0002: Tauri Mobile companion direction

- Status: accepted for the companion feasibility direction; Phase 8 complete
- Date: 2026-08-26

## Context

Phase 8 asks whether a future mobile companion should use Tauri Mobile or React
Native. It does not authorize a second implementation of chess semantics, a
publicly exposed desktop sidecar, or an assumption that ordinary phones can run
Maia-3 and a large language model together.

The repository already has:

- React and TypeScript presentation code;
- browser-compatible `chess-core`, `shared` and `ui` packages;
- a working Tauri 2 desktop host and Rust toolchain;
- DOM/CSS-based board and export surfaces;
- canonical `GameAnalysisV1`, Maia and Coach contracts.

Tauri officially supports Android/iOS development through `tauri android` and
`tauri ios`, and keeps a Rust library entry point for mobile builds. React Native
renders React components to native platform primitives and uses Native Modules
when JavaScript must call platform code. Both options still require the relevant
Android Studio/Xcode toolchains for native builds.

Primary references:

- [Tauri mobile prerequisites](https://v2.tauri.app/start/prerequisites/#configure-for-mobile-targets)
- [Tauri mobile development commands](https://v2.tauri.app/develop/#developing-your-mobile-application)
- [Tauri project structure](https://v2.tauri.app/start/project-structure/)
- [React Native platform model](https://reactnative.dev/)
- [React Native Native Platform boundary](https://reactnative.dev/docs/native-platform)

## Evaluation

| Criterion | Tauri Mobile | React Native |
| --- | --- | --- |
| Reuse current DOM/CSS React surfaces | Direct through the platform WebView | Requires native-component rewrites or a separate web layer |
| Reuse TypeScript domain packages | Direct | Direct for non-DOM code |
| Reuse existing Rust host knowledge | Direct | Requires a separate Native Module/JSI boundary |
| Native visual controls | Plugin/native bridge when needed | First-class native primitives |
| Current board/export compatibility | Higher | Requires validation or replacement |
| Stockfish WASM risk | Mobile WebView worker/memory behavior must be device-probed | Existing worker transport cannot be assumed; likely needs a native engine module |
| Repository complexity | One additional Vite/Tauri shell | A second rendering and native-module architecture |

React Native has the stronger default if native controls and platform-specific UI
are the dominant product requirement. They are not the dominant requirement for
this companion: canonical chess presentation, offline review reuse and minimal
architecture duplication are.

## Decision

Select **Tauri Mobile** for the Open Chess Review companion direction. Phase 8
implements a deliberately small `apps/mobile` feasibility slice with:

- a Vite + React frontend;
- a Tauri 2 mobile-compatible Rust library entry point;
- shared `chess-core`, `shared` and `ui` package imports;
- local PGN/FEN parsing and board navigation;
- English/Simplified Chinese presentation;
- a tested `mobile-policy-v1` capability resolver and endpoint manifest contract.

This is a framework and boundary decision, not an App Store release commitment.
The generated Android/iOS projects, signing, secure credential storage, pairing
transport and physical-device performance gate belong to a later production
mobile phase.

## Consequences

- No Flutter or React Native application is introduced.
- The mobile UI remains a separate shell; it must consume canonical facts rather
  than copy analysis algorithms from the web application.
- PGN/FEN parsing and existing review navigation form the offline baseline.
- Cached canonical analysis is preferred before any new computation.
- On-device Stockfish is conditional on a real Worker/WASM/memory/thermal probe;
  the feasibility UI's toggle is explicitly a policy simulator, not that probe.
- Maia inference is remote-only in the ordinary-phone baseline.
- Model-backed Coach generation is remote-only; deterministic grounded copy
  remains available without it.
- A remote Stockfish result may be objective truth only when it returns the
  compatible versioned canonical contract. A Coach response can never substitute
  for Stockfish analysis.
- No loopback desktop service is made reachable on a LAN by default. Remote use
  requires explicit pairing, authentication and secure transport.

The complete implemented boundary and follow-up gate are documented in
[`../mobile.md`](../mobile.md).
