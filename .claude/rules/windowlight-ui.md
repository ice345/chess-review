---
paths:
  - "apps/web/src/**/*.{ts,tsx,css}"
  - "apps/mobile/src/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
  - "e2e/visual.spec.ts"
  - "e2e/piece-fixture.spec.ts"
---

# Windowlight UI Rules

Windowlight is the current production art direction.

Before intentionally changing the visual language, read:

`docs/design/windowlight-contract.md`

For composition per route, typography roles, motion tiers and the atmosphere
layer, read the adopted annex:

`docs/design/windowlight-bluebird-v2.md`

The contract stays normative; the annex amends it. Where the annex's §0 records a
decision that contradicts this file, the annex wins and this file is updated in
the same change.

For the composition of Home, Review Start, Key Moment and Practice, the four
mockups in `docs/design/references/windowlight-bluebird-v2/` are the layout
authority; the room photograph (`background_pic.png`, served as
`apps/web/public/atmosphere/room.webp`) is the environment the product is painted
on. Follow their arrangement; never let them decide a product fact.

## Preserve

- warm paper rather than pure white
- blue-gray ink rather than black-heavy UI
- pale warm/cool contrast
- restrained celadon / mist-blue board relationship
- fine rules
- deliberate negative space
- low visual mass
- restrained shadows
- editorial rather than dashboard-like hierarchy
- almost invisible motion
- the chessboard as the primary workspace
- the persistent left rail as the desktop navigation frame (decided 2026-09-18)

## Identity boundaries

- Feather Porcelain carries the feather / organic motif.
- The bishop-and-wing mark at `packages/ui/assets/brand/logo.png` carries the symbolic
  brand identity. It is not being replaced; do not add a bird to the brand derivation
  chain, the icon sets or the export cards.
- The surrounding UI carries air, light, distance and paper.

One exception, and only one: the first-visit Bluebird Passage may place a single authored
bluebird as a narrative element, and Home carries it only until that passage ends.

Do not add a second bird or feather motif, decorative feathers, drifting petals,
anime characters, film frames, film artwork, official artwork or logos.

Any bird or feather outside the passage's single appearance is decoration and is
prohibited. Passages are not a licence for birds on working screens.

## Avoid

Do not introduce:

- generic SaaS card soup
- glassmorphism
- backdrop-filter for ordinary surfaces
- saturated cyan or electric blue
- heavy gradients
- oversized shadows
- excessive rounded containers
- hover animations that change geometry
- decorative looping animation
- visual effects that compete with the board

## Semantic colors

Stockfish, Maia, Move Quality, warnings and evaluation colors carry information.

Do not recolor semantic information merely to make it fit the art direction.

## Visual regression

A changed screenshot is evidence, not permission to update the snapshot.

Inspect the difference first.
