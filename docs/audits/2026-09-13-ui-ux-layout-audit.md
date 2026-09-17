Status: Historical
Baseline: `master` after the 2026-09-13 Windowlight pass
Superseded by: [docs/ui-spec.md](../ui-spec.md)
Do not use as the current product contract.

# UI/UX/layout audit — post-Windowlight

Date: 2026-09-13. Baseline: `master` after the
[Windowlight pass](../design/2026-09-13-windowlight-implementation.md).
Scope: Web routes, layout and UI/UX only. No chess-analysis semantics were
reviewed or changed.

## Method

A measurement sweep ran 12 routes across 7 acceptance viewports
(390×844, 768×1024, 1280×720, 1366×768, 1440×900, 1728×1117, 1920×1080) — 84
combinations — with a seeded connected library, a seeded analysed review and a
seeded study report. Routes: `/`, `/review/[gameId]` and its `/moves`, `/coach`,
`/engine`, `/notebook` sections, `/history`, `/training`, `/settings`, `/help`,
`/design/quality-icons`, `/design/pieces`.

For each combination the sweep recorded:

- document horizontal overflow (`scrollWidth - innerWidth`),
- visible non-uppercase text below 11px,
- interactive targets shorter than 32px,
- document height.

Full-page screenshots were captured at 390px and 1280px for every route and
reviewed for hierarchy, crowding, overlap and clipping.

## Findings

| # | Severity | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F1 | High | `/design/quality-icons` overflowed the phone viewport by 21px: 48px page padding plus a two-column grid whose icon rows need 4×38px fixed cells. | `overflow: 21` at 390×844, only occurrence in 84 combinations | Fixed |
| F2 | High | The practice `Filters` disclosure rendered as bare text with no affordance, so the control read as half-rendered. | `.practice-filters summary` had no border, background or caret; confirmed at 1280 | Fixed |
| F3 | Medium | Study section tabs were 30px tall at every width, below the 44px touch guidance on tablet and phone. | `.study-nav button` measured 30px at 768 and above | Fixed at ≤820px |
| F4 | Medium | The Study phase label (`.study-phase-row .eyebrow`) rendered `opening`/`endgame` at 10px, under the 11px functional floor, because `capitalize` overrides the uppercase kicker style. | measured 10px, non-uppercase, on `/training` | Fixed |
| F5 | Medium | Home's recent-review rows wrapped their metadata to 2–3 lines beside a vertically centred right-aligned action, producing a ragged second column on phones. | 390px screenshot, three rows | Fixed at ≤560px |
| F6 | Low | Three checkboxes (20×20 sound toggle, 18×18 notebook, 13×13 review) are below the touch guidance. Their row labels are the effective target, and enlarging them reflows dense forms. | `smallTargets` on 7 viewports each | Open — next forms pass |
| F7 | Low | Several inline text links are 13–18px tall (Home helper links, Help navigation, `manage-accounts`, `view-history`). WCAG exempts inline text targets, but they stay small on phones. | `smallTargets` across the sweep | Open — product decision |
| F8 | Low | The practice strip's primary action uses `margin-left: auto`, so with the side selector hidden and 0 positions it sits alone at the far right, and a disabled CTA reads as orphaned. | 1280 review screenshot | Open — art-direction review |
| F9 | Info | Long documents: `/help` 5925px, `/history` 4160px, `/settings` 3970px at 1280. History paginates at 60 rows by contract; Help is a document. | document heights | No action |

### Verified non-findings

Checked and deliberately unchanged, so a later pass does not re-litigate them:

- **Sub-11px text** is limited to decorative uppercase kickers (`.record-kind`
  9px, `.recent-grid span` 10px) and the `<text>` glyphs *inside* the quality
  icons (7.5–8.6px, icon artwork, not readable copy). The sweep's uppercase test
  flagged the kickers only because their literal content is already uppercase.
- **30px controls at desktop widths** are the Study tab strip, a compact
  mouse-first disclosure; it is 44px at touch widths after F3.
- **The board is the primary object on Review at every viewport**, and the right
  column reads calmer than the board — the audit's Phase 5.1 intent holds after
  the density changes.
- **`a1` is dark and `a2` is light** on both the board and the export canvas
  (verified by computed style), matching standard orientation.
- **The evaluation bar's visible seam** between its white and black segments
  exists in the pre-change baseline too, so it is pre-existing, not a Windowlight
  regression.
- A vision pass read "Liches" in the connected-accounts copy; the source spells
  "Lichess" everywhere. OCR artifact, no change.

## Fixes applied

`review-semantics.css`: fixture shell becomes one column below 900px with 24px
padding, and 16px padding with 28px icon cells below 560px.
`practice.css`: the `Filters` summary becomes a bordered chip with a caret,
matching the existing `.study-scope` disclosure convention.
`study.css`: Study tabs reach 44px at ≤820px; the phase label moves to
`--type-caption`.
`home.css`: recent-review rows stack at ≤560px with the action on its own line.

After the fixes the sweep reports **zero horizontal overflow in all 84
combinations**, and the only remaining sub-11px text and sub-32px controls are
the items listed as F6–F7 plus the icon-internal glyphs.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (308 web tests), `pnpm test:e2e`
(86 Playwright tests) and `pnpm --filter @chess-review/web build` pass. Visual
baselines were regenerated and inspected: the fixes changed no committed
snapshot beyond sub-pixel antialiasing (maximum channel delta 23, under one
pixel of difference), so the previous baselines were kept rather than committing
noise-only binary churn.

## Not covered

- Interaction and error states beyond the seeded ones (empty library, failed
  sync, in-progress analysis) were not re-shot; the deterministic suites cover
  them behaviourally rather than visually.
- Real mobile OS fonts, dynamic type and browser zoom were not exercised; the
  sweep uses Chromium at fixed device pixel ratios.
- Touch gesture behaviour (arrow drawing is still desktop-only) is unchanged by
  this audit and remains a documented product limit.
