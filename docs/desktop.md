# Desktop application

Phase 6 uses a separate Vite + React + Tauri 2 application in `apps/desktop`.
The Next.js application remains the Browser Core product; the desktop shell does
not embed or start an SSR server.

## Implemented foundation

- Vite owns the static React frontend and Tauri loads its `dist` output.
- The first shell imports the project-owned `BlueBishopMark` from
  `@chess-review/ui` and parses a selected PGN through
  `@chess-review/chess-core`; it contains no duplicated chess rules.
- Rust owns only native application startup. The initial capability grants the
  main window Tauri core defaults and no shell, filesystem or network plugin.
- Bundling is intentionally disabled until platform icons, signing and release
  targets are implemented and tested.

Run the browser-hosted desktop frontend with `pnpm --filter
@chess-review/desktop dev`. Run the native development window with `pnpm
--filter @chess-review/desktop tauri dev`. A static frontend build is included in
the root `pnpm build`; `cargo check --manifest-path
apps/desktop/src-tauri/Cargo.toml` validates the Rust host.

## Native lifecycle boundary

The accepted process design remains:

```text
Tauri host
  -> own a packaged local-ai sidecar only when it starts that sidecar
  -> probe an existing Ollama API before locating an executable
  -> start only `ollama serve`, never `ollama run`
  -> ask before any model download
  -> stop only child processes owned by this app
```

Sidecar packaging, Ollama lifecycle, native open-file events, bundle icons,
signing and release artifacts remain unchecked Phase 6 work. The HTML file input
in the foundation shell is a local frontend import, not a claim of native file
association support.
