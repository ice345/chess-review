Status: Historical
Baseline: `b4eb09d` · 2026-09-13
Superseded by: [docs/design/windowlight-contract.md](windowlight-contract.md)
Do not use as the current product contract.

# Windowlight implementation note

Date: 2026-09-13. The pass landed.
Baseline: `master` `b4eb09dde110e0ccbc487bb45ec879a2b6b97f5a`.
Specification: [`Open_Chess_Review_Windowlight_Final_Audit.md`](../Open_Chess_Review_Windowlight_Final_Audit.md).

This pass converges the default light UI and the already-integrated authored
piece PNGs into one production visual system named **Windowlight**. It is a
refinement pass, not a new design language and not an anime theme.

## Decisions

- One production light theme. No second switchable theme, no theme provider,
  no theme toggle. The piece-set preference stays an independent setting.
- Board colors: light `#eee8d9`, dark `#b1c6c2`, notation `#516a75` / `#38525e`.
  These are board tokens in `tokens.css`, not per-page hex values.
- Default piece family keeps the persisted id `liz-blue`; the user-facing
  Settings label became **Feather Porcelain** so the name describes our own
  asset and implies no film affiliation.
- Transparency means reduced visual weight, not blur: no `backdrop-filter` on
  the app header or review titlebar, and repeated dense content uses ink rows
  instead of translucent cards.
- Motion stays nearly invisible: color/border/background/opacity at 120–180ms.
  The board-flip hover rotation and the continuation-row width expansion are
  removed; hover never changes geometry.
- Source-aware semantics are preserved: Stockfish (blue), Maia (green), fault
  (rose) and overlap (teal) arrow families, Move Quality colors, and the
  evaluation bar's black/white split are information, not decoration.
- Functional text stays at least 11px; 9–10px is reserved for decorative
  uppercase kickers.

## Changes

Phase A — board and tokens:

- `styles/tokens.css`: Windowlight palette installed (paper, washes, ink, rules,
  accent + `--accent-hover`/`--focus-ring`, board tokens, brass/rose accents,
  status, three paper shadows, `--font-sans`/`--font-serif`/`--font-mono`), with
  the legacy aliases retained.
- `lib/board-appearance.ts`: new `WINDOWLIGHT_BOARD_APPEARANCE` centralizing the
  react-chessboard square, notation and board styles behind CSS variables.
- `components/home-workspace.tsx`, `components/review-shell.tsx`: board options
  now spread the shared appearance; duplicated hex values removed.
- `lib/board-move-hints.ts`: selection, quiet and capture states moved to the
  dusty-rose selection token, the brass wash and the rose destination rings.
- `styles/review-semantics.css`: quality fixture uses the production board
  colors, the evaluation bar uses theme surfaces with its black/white split
  intact, and Game Summary is a solid paper section.

Phase B — de-glassing the shell: `base.css` (quieter page washes, `--focus-ring`
focus outline, `--accent-hover` primary hover), `chrome.css` (solid raised
header, no blur), `home.css` (paper import card at 14px radius with
`--shadow-paper`), `surfaces.css` (solid `.paper-card`, transparent `.ink-row`),
`review-shell.css` (solid titlebar and tokenized nav/menu), `review-workspace.css`
(no flip rotation, tokenized toolbar/player/transport, board radius 6px).

Phase C — review density: `review-panels.css` flattens the repeated translucent
mini-cards into ink rows, removes the continuation hover geometry change, and
keeps floating paper only for real popovers/modals.

Phase D — secondary routes: quieter Study washes with a solid reading surface,
solid Settings cards, tokenized History/platform/Coach/Human-lens/practice
styles, the Blue Bishop container aligned to Windowlight, the piece-set label
rename, and the new `/design/pieces` acceptance fixture.

Phase E — this note and the `ui-spec.md` visual-system update.

## Deliberately deferred

- `apps/mobile` still carries the legacy board colors and does not share the Web
  piece renderer; mobile parity is a separate pass.
- No dark theme. Windowlight is not mechanically invertible.

PNG export and the promotion chooser were deferred by the specification and were
delivered immediately afterwards as an explicitly requested follow-up; see the
next section.

## Follow-up: export and promotion parity

The specification deferred export and promotion piece rendering. Both now use the
board's own vocabulary:

- `apps/web/src/lib/board-piece-assets.ts` owns the piece identity (set ids, the
  asset directory, the twelve keys and the FEN→asset mapping) in a JSX-free module
  so the canvas renderer, the board renderer and their tests share one contract.
- `png-export.ts` preloads the twelve PNGs once per set and draws them into each
  square; `--board-square-light`/`--board-square-dark` are read from the document
  with literal fallbacks that a test keeps equal to `tokens.css`.
- The promotion chooser renders the same piece components as the board instead of
  Unicode glyphs, so the chooser matches the position it belongs to.
- Fallbacks are deliberate: the Classic SVG set and any asset the browser cannot
  decode keep the previous Unicode glyph path, so a classic preference, an offline
  first export or a partial `/pieces/` cache degrades instead of failing.

Verified with the export e2e (the exported position card shows the authored pieces
on the Windowlight squares), a unit test for the palette/assets contract, and a
temporary probe confirming both fallbacks — Classic exports glyphs, and aborting
every `/pieces/**` request still produces a complete card.

## Cache

The twelve piece PNGs were not modified in this pass, so
`apps/web/public/sw.js` `CACHE_VERSION` is unchanged. Replacing piece bytes at
the same `/pieces/` URLs requires a version bump (or a versioned directory).

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (all packages) and `pnpm test:e2e`
(86 Playwright tests) pass, and `pnpm --filter @chess-review/web build`
prerenders `/design/pieces`. The eight existing visual baselines were inspected
old-vs-new before being regenerated, and `pieces-windowlight-1440.png` was added
to the suite: Home's solid header and paper import card, Review's pale board and
flat panels, the flipped and variation states, the Compare arrows, the grounded
Coach rows, Library's catalog rows and the quality fixture all match the intended
change. `/design/pieces` is the standing acceptance environment for piece and
board regressions.

Two adjacent defects surfaced during verification and were handled explicitly:

- History rows overflowed their 55px source column, so `CHESS.COM` ran into the
  game title. The first grid track is now `minmax(55px, max-content)` (and
  `minmax(44px, max-content)` on mobile). This was pre-existing, but History was
  part of this pass.
- `e2e/review-second-cut-shot.spec.ts` asserted the Engine link was visible on
  `/engine` without opening the More disclosure, which the current titlebar
  cannot satisfy because `moreOpen` is applied as a class and not as the
  `<details open>` attribute (`review-shell.tsx`). The assertion failed on the
  untouched baseline commit too. The spec now opens the disclosure with the
  existing `openReviewMore` helper before asserting `aria-current`; the app's
  collapsed behavior is unchanged, since `ui-spec.md` places Notebook and Engine
  under the More disclosure. Whether the titlebar should auto-expand that
  disclosure on those routes is a product decision left open here.

The export canvas no longer carries legacy board hex values: it reads the board
tokens, with the literal fallbacks the unit test keeps equal to `tokens.css`.

## Production acceptance

The production artifact is validated, not only the development server:

- `NEXT_PUBLIC_APP_MODE=browser-core pnpm --filter @chess-review/web build`
  produces the standalone bundle, and `/design/pieces` prerenders with it.
- `pnpm exec playwright test --config playwright.release.config.ts` runs the
  release specs (Browser Core, offline, release, notebook, practice, share) on
  chromium, firefox, webkit, mobile-chromium and mobile-webkit against
  `scripts/start-web-standalone.mjs`: 188 passed, 5 skipped, plus one WebKit
  mistake-practice failure that reproduces on the untouched baseline commit and
  passes in isolation, so it is pre-existing engine flakiness rather than a
  regression from this pass.
- A production probe against the standalone server confirmed Settings reports
  Browser Core, Home and Review render `--board-square-light`/`-dark` exactly
  (`rgb(238, 232, 217)` / `rgb(177, 198, 194)`), every rendered board image
  decodes at 512px, and `/design/pieces` renders 12 rows and 96 loaded cells. The
  captured Home, Review and fixture screenshots show the authored pieces and the
  Windowlight surfaces with no unstyled or broken element.

## Follow-up: mobile parity

Per the specification's mobile scope, `apps/mobile` now renders the same board as
the Web app; the piece bytes stay where they are.

- `WINDOWLIGHT_BOARD_APPEARANCE` moved from `apps/web/src/lib/board-appearance.ts`
  into `@chess-review/ui`, so both apps import one definition instead of repeating
  board hex values. Web imports were rewired; the local module is gone.
- The companion declares the same `--board-*`, ink, line, accent and shadow
  tokens in `apps/mobile/src/styles.css` and spreads the shared appearance into
  its `Chessboard` options. Its `.brand-mark` container now uses the Windowlight
  cream/accent relationship, matching the Web Blue Bishop container.
- Piece assets are deliberately not shared yet. There is no asset directory both
  a Next.js `public/` and a Vite/Tauri bundle can serve without copying the 936 KB
  of PNGs into a second committed tree or committing a symlink that Windows
  checkouts and the Windows CI artifacts cannot rely on. The companion therefore
  keeps the react-chessboard SVG pieces until a shared asset path is designed.

Verified with `pnpm --filter @chess-review/mobile typecheck`, a full
`vite build`, and a phone-viewport probe against the built bundle: `a2` renders
`rgb(238, 232, 217)`, `a1` renders `rgb(177, 198, 194)`, notation
`rgb(81, 106, 117)`, the board radius is 6px, all 64 squares and all 32 pieces are
present, the brand container is `rgb(243, 236, 223)`, and the page has no
horizontal overflow at 390px. The companion's own shell palette is unchanged and
remains a separate mobile design pass.

## Next steps

Ordered, with dependencies:

0. Documentation consistency — keep the living docs (`roadmap.md`,
   `web-release-roadmap.md`, `ui-spec.md`) aligned with the shipped palette
   instead of the earlier "palette unchanged" statements. Done.
1. Export and promotion visual parity — delivered, see above. The authored PNGs
   are the default export and promotion vocabulary; the Unicode glyph path
   remains the deliberate fallback for the Classic SVG set or an asset the
   browser cannot decode.
2. Web production visual acceptance — repeat the visual states and the
   release-mode browser specs against the standalone production build, not only
   the dev server.
3. Mobile parity — board colors and the shared board appearance are delivered,
   see above; shared piece assets and the companion's own shell palette remain
   open because no cross-platform asset path exists yet.
4. Full UI/UX/layout audit and art-direction review — delivered as
   [`docs/audits/2026-09-13-ui-ux-layout-audit.md`](../audits/2026-09-13-ui-ux-layout-audit.md):
   12 routes × 7 acceptance viewports, with the phone overflow, practice
   `Filters` affordance, Study touch targets, phase-label size and Home phone
   rows fixed. Its remaining low-severity items (checkbox and inline-link touch
   sizes, the practice CTA alignment) stay open for the next forms pass and the
   art-direction review.
5. Dark theme — future feature. Not an inverted Windowlight; it needs its own
   design and review, and is not scheduled.
