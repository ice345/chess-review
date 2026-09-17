# Desktop application

Phase 6 uses a separate Vite + React + Tauri 2 application in `apps/desktop`.
The Next.js application remains the Browser Core product; the desktop shell does
not embed or start an SSR server.

## Implemented foundation

- Vite owns the static React frontend and Tauri loads its `dist` output.
- The first shell imports the project-owned `BrandMark` from
  `@chess-review/ui` and parses a selected PGN through
  `@chess-review/chess-core`; it contains no duplicated chess rules.
- Rust owns native application startup, PGN integration and owned-process
  lifecycle. The frontend capability grants only Tauri core defaults; shell
  execution remains private to the Rust host.
- The native PGN boundary is now implemented in Rust. A system dialog accepts
  one UTF-8 `.pgn` file up to 10 MiB, reads it in the command layer and returns
  text to the shared TypeScript parser. File-association launches are buffered
  until React is listening; macOS uses `RunEvent::Opened`, while Windows/Linux
  startup arguments and later single-instance arguments use the same reader.
- The desktop host probes loopback Ollama `/api/tags` on startup. It reuses an
  existing API without taking ownership, otherwise discovers the installed
  executable and starts only `ollama serve`. The UI reports every installed
  model and shows an explicit `ollama pull <model>` setup command when the
  configured model is missing; it never runs a pull automatically.
- `services/local-ai` is frozen as a platform-native, self-contained PyInstaller
  sidecar for release builds. The host first probes loopback `/health`, reuses a
  pre-existing service without ownership, or starts the packaged executable and
  retains its child handle. The sidecar includes the Maia runtime but no Maia or
  Ollama model checkpoints; those downloads remain explicit user actions.
- The locked packaged runtime uses the official CPU-only PyTorch index. This
  keeps the portable baseline independent of CUDA drivers and prevents Linux
  installers from silently absorbing several gigabytes of CUDA libraries.
- The project-owned Blue Bishop SVG generates the platform icon set. macOS uses
  a platform override that enables local `.app` and `.dmg` bundles
  while the base configuration stays bundle-disabled for unverified targets.

Run the browser-hosted desktop frontend with `pnpm --filter
@chess-review/desktop dev`. Run the native development window with `pnpm
--filter @chess-review/desktop tauri dev`. A static frontend build is included in
the root `pnpm build`; `cargo check --manifest-path
apps/desktop/src-tauri/Cargo.toml` validates the Rust host.

On macOS, `pnpm --filter @chess-review/desktop tauri:build:macos` creates a
local application and disk image from the arm64 host toolchain. The
command uses Tauri's CI-safe DMG path so packaging does not require Finder
automation permission. This is a reproducible local bundle check, not a
Developer ID-signed, notarized or universal release.

Windows NSIS and Linux deb/AppImage platform configurations now exist alongside
the macOS override. `.github/workflows/desktop-artifacts.yml` defines native
GitHub-hosted runners and uploads the unsigned outputs on manual runs or
`desktop-v*` tags. The macOS arm64, Windows x64 and Linux x64 jobs, including
their packaged local-ai sidecars, completed successfully in
[artifact run 32721845895](https://github.com/ice345/chess-review/actions/runs/32721845895).
Every generated package is checked against a 768 MiB ceiling before upload so a
dependency-source regression fails the workflow instead of publishing an
unexpected multi-gigabyte installer.

The verified unsigned package sizes are 161.3 MiB for the macOS app, 150.9 MiB
for its DMG, 160.3 MiB for Windows NSIS, 248.9 MiB for Linux deb and 322.6 MiB
for Linux AppImage.

## Native lifecycle boundary

The implemented Ollama lifecycle and accepted sidecar design are:

```text
Tauri host
  -> probe an existing Ollama API before locating an executable
  -> start only `ollama serve`, never `ollama run`
  -> ask before any model download
  -> stop the Ollama child only when this app started it
  -> probe and reuse an existing local-ai API without ownership
  -> otherwise start and own the packaged local-ai sidecar
  -> stop only the sidecar child created by this app
```

The loopback restriction prevents the desktop manager from treating a remote
Ollama host as an executable it may own. Exit cleanup takes only the stored
child handle; manual validation confirmed that an existing `ollama serve`
process survives application shutdown.

The macOS package was validated against the real packaged `/health` response;
closing its Tauri host stopped the owned sidecar and left the pre-existing
Ollama process running. Native Windows/Linux runners also produced and uploaded
the expected unsigned installers, completing the Phase 6 platform matrix. The
HTML file input remains only as the browser-hosted desktop-preview fallback;
packaged builds use the native dialog and registered file association.

Developer signing, notarization, universal macOS binaries and a tagged public
release are separate release-operations work. They require distribution
credentials and an explicit version decision; the artifact workflow does not
claim that unsigned CI outputs are production-signed releases.
