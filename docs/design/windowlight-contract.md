# Windowlight Visual Contract

Status: Production design contract.

Windowlight is the established visual system for Open Chess Review.
It is not a temporary theme and it is not an anime skin.

This document defines visual intent.
Production CSS tokens remain the numerical source of truth.

## Art-direction annex

[`windowlight-bluebird-v2.md`](windowlight-bluebird-v2.md) is the adopted
art-direction annex (2026-09-18): the room environment, the composition of each
route, typography roles, the motion tiers and the icon set. It amends this
contract; it does not replace it, and it does not override the numerical tokens.

Its §0 records what was adopted and what was not: the persistent left rail, the
room photograph as the environment, the four reference mockups as the layout
authority, and the withdrawn first-visit passage. The brand mark is unchanged.
Nothing in the annex is in effect until the change that lands it.

## Environment

The application is painted on one photograph — the room the mockups were composed
on, shipped once as `apps/web/public/atmosphere/room.webp` and drawn fixed behind
the frame. `docs/design/windowlight-bluebird-v2.md` §11 owns how it is layered.

Two rules follow from it and are not negotiable:

1. **Nothing hides the room.** The frame shows the photograph at its own strength
   (about a 6% paper wash); the route column paints no veil. The rail is a column of
   the same room with the paper thickening toward its foot, and a soft glow backs the
   route head's words. A change that washes the room out to make text easy is not
   accepted.
2. **Paper carries the words.** Every group of facts sits on a paper panel, and words
   that sit on the room instead carry the primary ink tier — the muted and secondary
   tiers belong to words on paper. Contrast is measured against the pixels the browser
   paints (`e2e/room-contrast.spec.ts`), never assumed from a token pair.
3. **It never moves.** No parallax, no drift, no scroll-linked offset, and no
   `backdrop-filter` anywhere — the mockups' translucent cards are drawn as paper
   with a hairline and one soft shadow.

## North Star

The interface should feel like a quiet editorial chess-study environment:

- warm paper
- blue-gray ink
- pale watercolor-like washes
- thin boundaries
- deliberate negative space
- quiet observation
- restrained movement
- precise information

The intended atmosphere draws from ideas of transparency, pale contrast,
distance, fragility and air, rather than literal imagery from any film.

## Visual formula

Pieces = Feather Porcelain  
Board = warm paper + celadon / mist relationship  
UI = Windowlight  
Brand = Blue Bishop  
Atmosphere = air + light + paper + distance

## Material

Preferred materials:

- paper
- ink
- porcelain
- diffuse window light
- faint watercolor wash

"Glass" is an atmospheric metaphor.

It does not mean frosted-glass UI.

## Color

Use low-saturation relationships.

The primary relationship is:

warm ivory / paper
×
cool blue-gray / celadon.

Dusty rose, sage and brass may appear sparsely.

Do not make saturated blue the dominant product color.

Production values belong in the shared token files.
Do not introduce page-local color constants where an existing semantic
token is appropriate.

## Space

Whitespace is part of the design.

Prefer:

- breathing room
- thin separators
- flat ink rows
- clear hierarchy

over:

- repeated cards
- nested panels
- dense borders
- decorative containers

Not every conceptual group needs a card.

## Chessboard

The board is the primary visual workspace.

Do not decorate playable squares with:

- feathers
- birds
- watermarks
- film motifs

Board appearance should remain quiet enough for:

- pieces
- move hints
- Stockfish arrows
- Maia arrows
- Move Quality information

to remain immediately readable.

## Chess pieces

Feather Porcelain must preserve chess-role recognition before decoration.

At small sizes:

King → axial cross remains obvious  
Queen → broad crown remains obvious  
Bishop → diagonal mitre remains obvious  
Rook → battlement remains obvious  
Knight → horse silhouette remains obvious  
Pawn → simple pawn mass remains obvious

The `/design/pieces` fixture is the acceptance environment for piece changes.

## Typography

Typography should feel editorial and calm.

Functional text must remain readable.

Decorative small text must never become the primary way important information
is communicated.

Avoid replacing hierarchy with excessive uppercase micro-labels.

## Motion

Motion should communicate state, not personality.

Prefer subtle changes in:

- color
- border
- background
- opacity

Avoid:

- bouncing
- rotating
- sliding for decoration
- geometry-changing hover states
- continuous ambient animation

## Semantic information

Visual atmosphere must never obscure chess semantics.

Preserve distinguishability between:

- Stockfish objective analysis
- Maia human prediction
- Coach explanation
- Move Quality
- evaluation
- error / warning states

## Brand boundary

The product's symbolic mark is the authored bishop-and-wing illustration at
`packages/ui/assets/brand/logo.png`, derived into the app mark and every icon by
`scripts/sync-brand-assets.mjs`. The mark is the one place the wing appears; it is
not a licence to scatter birds or feathers through the interface.

The room photograph contains birds, a feather and blossom. They are part of an
environment image, not interface motifs: nothing in the interface draws a bird or
a feather, and no screen places one over content.

Do not add:

- a second bird or feather motif beyond the product mark
- a second illustration system beside the icon set in `packages/ui/src/icons.tsx`
- film artwork
- anime characters
- official logos
- film frames
- decorative feather repetition

## Acceptance question

Before accepting a visual change, ask:

1. Is the board still the primary workspace?
2. Is the information hierarchy clearer or at least preserved?
3. Did visual mass increase unnecessarily?
4. Did contrast or readability decrease?
5. Did we introduce generic SaaS visual language?
6. Did we replace subtle atmosphere with literal decoration?
7. Does the page still belong to the same Windowlight system?

If the answer exposes a regression, fix it instead of updating the baseline.
