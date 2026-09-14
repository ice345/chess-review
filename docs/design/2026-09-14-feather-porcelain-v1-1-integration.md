# Feather Porcelain v1.1 integration

Date: 2026-09-14

This pass integrates the refined King / Queen / Bishop art, and turns
`/design/pieces` from a rendering fixture into a recognition fixture. It follows
[`../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md`](../Open_Chess_Review_Final_Product_Refinement_Audit_2026-09-14.md)
phase 0.

## What changed

- The six refined assets (`wK` `bK` `wQ` `bQ` `wB` `bB`) are final 512×512 RGBA
  PNGs. The locked `wP/wN/wR/bP/bN/bR` bytes were not touched.
- The served directory is now versioned: `apps/web/public/pieces/feather_porcelain_v1_1/`
  (previously `liz_blue_chess_pieces_512`). The art was **relocated, not copied**:
  the twelve PNG bytes are identical to the ones that were in the old directory,
  and no second copy was left behind, so there is exactly one served piece
  directory. Any external art export step that wrote into
  `apps/web/public/pieces/liz_blue_chess_pieces_512/` must write into
  `apps/web/public/pieces/feather_porcelain_v1_1/` (or a new version directory)
  from now on. Only `PIECE_ASSET_DIR` in
  `apps/web/src/lib/board-piece-assets.ts` names the path, so the board renderer,
  the promotion chooser and the PNG export all moved with it.
- The persisted setting id stays `liz-blue` and the user-facing name stays
  *Feather Porcelain*; no settings migration was needed.
- `apps/web/public/sw.js` `CACHE_VERSION` stays `v2`. A versioned directory
  changes the request URL, so the cache-first `/pieces/` rule cannot serve the
  previous art to a returning visitor, and the large engine and sound entries are
  not flushed for an art change. Overwriting bytes at an unchanged URL would have
  required a version bump instead — that is the rule now recorded in `ui-spec.md`.

## Fixture: rendering *and* recognition

`/design/pieces` keeps the 12-role × 32/40/48/56/72 px × light/dark matrix (48 px
was added) and the two interactive boards that cover selection, quiet/capture
destinations, Stockfish and Maia arrows, the Move Quality badge and a flipped
board. Four recognition passes were added:

- **Blind position** — `8/8/7k/1q2K3/5b2/2B5/6Q1/8 w - - 0 1`, with no role
  labels on the board and the answer behind a collapsed *Reveal roles* disclosure,
  so starting-position context cannot do the work.
- **Silhouette** — the same position and the same roles with
  `filter: brightness(0) saturate(0)`, so role identity has to survive as shape.
- **Distance stress** — `blur(1px)` at 32/40/48/56/72 px. Diagnostic only.
- **Classic comparison** — the same role at the same size beside the Classic SVG
  set, which is the benchmark for small-size role recognition.

The filter always sits on the piece, never on the square, so negative space is
still measured against the real board color.

`e2e/piece-fixture.spec.ts` asserts the structure (6 sections, 48 rows, 324
cells, the five sizes, every raster asset decoded), that the reveal really is
collapsed first, that both filters are computed rather than intended, and that
the live board and the promotion chooser request
`/pieces/feather_porcelain_v1_1/*.png`.

## Recognition findings

The art is final for this pass, so these are observations for a future art
revision, not blockers. They come from reading the fixture with a vision model,
which is a proxy for a human at best; the numbers are the piece sizes at which the
cue is judged readable.

- Black King, Queen and Bishop were read correctly at ~80 px (3× capture of the
  blind position), including the bishop's mitre slit.
- The white **King vs Queen** pair is the weakest distinction: at ~80 px both read
  as a crown, and the cross had to be inferred from the fact that each colour must
  contain exactly one of each role. White pieces on the cream square have the
  lowest contrast in the whole set, which is what makes the cross the first
  detail to disappear.
- The black bishop's mitre slit is **not** readable at 32 px on a dark square; it
  becomes readable around 56 px. Below that the bishop reads only as a pointed
  mitre, which still separates it from the pawn and the rook.

## Baseline inspection

The eight existing visual baselines were inspected old-vs-new before being
regenerated, not accepted blindly. Every changed board screenshot differs by
0.33–0.43 % of pixels, and every diff bounding box is confined to the board area
(one 80-pixel diff on the library page corresponds to a 16×11 px element):

| Baseline | Diff pixels | Ratio | Diff bounding box |
| --- | --- | --- | --- |
| `analysis-variation-1920.png` | 6946 | 0.33 % | 544,164 – 1591,910 |
| `combined-stockfish-maia-1440.png` | 5523 | 0.43 % | 305,164 – 530,689 |
| `home-connected-1440.png` | 5425 | 0.42 % | 255,223 – 464,712 |
| `library-1920.png` | 80 | 0.00 % | 1331,342 – 1346,352 |
| `review-black-blunder-1728.png` | 6943 | 0.36 % | 225,158 – 954,749 |
| `review-white-brilliant-stockfish-1728.png` | 6943 | 0.36 % | 225,158 – 954,749 |
| `coach-grounded-fallback-1728.png` | 6912 | 0.36 % | 448,164 – 699,749 |
| `pieces-windowlight-1440.png` | full page | — | page height 1509 → 4645 px |

`quality-icons-v3-1440.png` is unchanged.

## Remaining work from this phase

Mobile still renders the react-chessboard SVG pieces. A single canonical asset
directory plus a build sync script (audit §21) is the intended fix, and is tracked
as the mobile-parity item of this roadmap.
