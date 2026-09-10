# Contributing

Open Chess Review is free and open source. The public release focuses on browser
review, personal study and portable local data. Payment, hosted AI, accounts and
online play are outside the current release scope. See the
[current audit and roadmap](docs/audits/2026-09-08-free-stable-release.md).

## Start locally

Use the repository's pinned pnpm version and a supported Node.js release (CI
uses Node 24). Follow [README](README.md) for prerequisites, then:

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

Browser Core works without models. `pnpm dev` is the managed optional local AI
entry point. Do not download models as part of routine development or tests.

## Keep changes reviewable

- Read `AGENTS.md` and the instructions in the package you change.
- Use PGN or explicit FEN for input. Screenshot OCR is outside the product scope.
- Keep chess facts in canonical packages. Stockfish, Maia and Coach have distinct
  responsibilities; UI code should not recalculate Accuracy or classification.
- Explain chess-algorithm changes and add deterministic compatibility fixtures.
- For persistence changes, cover existing data, backup/restore, cleanup,
  interrupted writes and competing tabs. Document database/backup versions and
  rollback compatibility.
- Keep the existing pieces, palette and quality icons unless the change is an
  explicitly reviewed visual-design task.
- Do not commit `.env`, credentials, personal library backups, model weights,
  research clones or generated build output.

## Validate

Run the narrow relevant tests first, followed by the repository checks:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm audit --prod --audit-level high
pnpm build
```

For browser changes, run the matching Playwright spec. The release suite uses
the built standalone app and includes desktop Chromium/Firefox/WebKit and mobile
browser emulation:

```sh
pnpm exec playwright install chromium firefox webkit
NEXT_PUBLIC_APP_MODE=browser-core pnpm build
pnpm exec playwright test --config playwright.release.config.ts
```

For local-ai changes run `uv run --project services/local-ai --extra dev pytest
services/local-ai/tests`. Deployment-script changes use `python3 -m unittest
discover -s deploy/nuc -p 'test_*.py'`. Real NUC, public HTTPS/OAuth and physical
mobile acceptance are separate operations; do not describe emulation as hardware
testing. Describe checks actually run and any remaining limitations in the PR.

## Report a bug

Use the GitHub bug template with the page, expected/actual behavior and minimal
reproduction. Public issues should not contain tokens, cookies or a personal
backup file. Submit only a minimal game you intend to share. The project does not
send bug reports or telemetry automatically. License and asset provenance are
documented in [LICENSE](LICENSE) and [third-party notes](docs/third-party-notes.md).
