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

## Identity boundaries

- Feather Porcelain carries the feather / organic motif.
- Blue Bishop carries the symbolic brand identity.
- The surrounding UI carries air, light, distance and paper.

Do not add literal film imagery, blue-bird decoration, decorative feathers,
anime characters, film frames, or official artwork.

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
