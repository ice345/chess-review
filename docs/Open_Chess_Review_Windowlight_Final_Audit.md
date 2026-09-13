# Open Chess Review — Bluebird / Windowlight Visual Audit & Implementation Specification

**Audit date:** 2026-09-12  
**Repository:** `ice345/chess-review`  
**Audited branch:** `master`  
**Audited commit:** `b4eb09dde110e0ccbc487bb45ec879a2b6b97f5a`  
**Scope:** Web visual system, new custom chess pieces, board, Home, Review, Study/Training, History, Settings, visual identity, accessibility, asset delivery, visual regression.  
**Not in this implementation scope unless explicitly requested:** replacing Unicode pieces in PNG export and the promotion chooser; redesigning chess analysis semantics; dark mode; copying any official *Liz and the Blue Bird* artwork.

---

## 0. Executive decision

The project does **not** need a second switchable “Liz theme”.

The correct direction is to make the existing default light visual system converge into one coherent production theme:

> **Windowlight UI + Feather Porcelain pieces + Blue Bishop identity**

Use the existing `liz-blue` PNG piece set as the default piece family, but let the rest of the product express the reference mood through **paper, window light, pale color contrast, fine rules, quiet typography, negative space, restrained motion and reduced visual weight**.

The website must **not** become an anime-themed chess site. Do not add literal blue-bird icons, feather icons, character art, film frames, Kyoto Animation artwork, official logos, or decorative “Liz” branding around the board.

The pieces already carry the feather/wing motif. The UI should carry the **air**.

### Final visual formula

```text
Pieces      = Feather Porcelain
Board       = warm paper + celadon/mist blue
UI          = Windowlight
Brand mark  = original Blue Bishop
Atmosphere  = air / glass / paper / fine lines / quiet wash / distance
```

### Canonical decisions

1. Keep `liz-blue` as the default piece-set ID.
2. Keep `Classic SVG` as an optional piece set in Settings.
3. Do **not** add a board-theme switch now; Windowlight becomes the default light theme.
4. New board colors:
   - light: `#eee8d9`
   - dark: `#b1c6c2`
5. No literal bird or feather decoration in playable squares or Review.
6. Blue Bishop remains the single symbolic brand mark outside the chess pieces.
7. Remove obvious glassmorphism; “transparent feeling” means reduced visual weight, not blur/translucent cards.
8. Preserve semantic colors for Stockfish/Maia/Move Quality; theme colors must not erase information semantics.
9. Keep export and promotion chooser Unicode pieces for now, per product decision.
10. If piece image bytes are replaced under the same `/pieces/` URLs, bump the service-worker asset cache version.

---

# 1. Reference basis: what should actually be translated from the film

This implementation is an original product design inspired by publicly described visual principles. It must not copy official artwork.

Official sources:

- Director interview: https://liz-bluebird.com/interview/
- Staff countdown comments: https://liz-bluebird.com/news/?id=31
- Staff comments: https://liz-bluebird.com/news/?id=3
- Official site: https://liz-bluebird.com/

The relevant principles are unusually clear in the official comments:

- Yamada describes wanting to translate the source’s **transparent, non-artificial atmosphere** into film.
- She emphasizes accumulating **small changes** rather than using blunt symbols.
- She describes thin lines and a sense of **limited, fragile ephemerality**.
- The color direction is described as if looking through glass, with a fragile quality that might disappear if touched.
- Art director Mutsuo Shinohara explicitly describes a theme of **glass-like transparency**, **beauty in pale color contrast**, and **watercolor expression**.
- 3D director Tetsuro Umetsu says the film contains **air**.
- Character designer Futoshi Nishiya emphasizes **thin lines, transparency, the taut atmosphere of the classroom, faint breath, and gradual changes in distance**.

### Product translation

Translate those ideas into:

```text
air
distance
paper
window light
thin rules
soft cold/warm balance
pale contrast
quiet movement
controlled asymmetry
negative space
precise observation
small changes
```

Do **not** translate them into:

```text
bird icon everywhere
feather icon everywhere
anime characters
watermarked film stills
pastel SaaS cards
frosted glass
floating decorative particles
looping falling feathers
cute blue-bird mascot
```

---

# 2. Current repository state

The current `master` already made an important step in the correct direction.

## 2.1 New custom pieces are already integrated

`apps/web/src/lib/board-pieces.tsx` defines:

```ts
export const PIECE_SET_IDS = ["liz-blue", "classic"] as const;
```

and loads the 12 PNG files from:

```text
/pieces/liz_blue_chess_pieces_512/
```

The renderer uses `width: 100%`, `height: 100%`, and the transparent canvas inside each 512×512 master controls the relative piece scale.

This is correct. Do not add per-piece CSS scaling unless an actual visual regression proves it necessary.

`DEFAULT_APP_SETTINGS.pieceSet` is already `"liz-blue"`.

## 2.2 Piece-set switching is already implemented

Settings currently offers:

```text
Liz Blue
Classic SVG
```

and `useBoardPieces()` listens for the app-settings event, so the piece family updates without requiring a new board architecture.

Keep this architecture.

### Recommended naming polish

Preserve the stored ID `liz-blue` for compatibility, but consider changing the **user-facing label only**:

```text
Liz Blue → Feather Porcelain
```

Reason:

- “Feather Porcelain” describes the actual product asset.
- It strengthens Open Chess Review’s own identity.
- It avoids implying an official or licensed film theme.
- No data migration is needed because the stored ID stays `liz-blue`.

This is recommended, not required for the first PR.

## 2.3 Current board colors are still legacy values

Home and Review currently hard-code:

```text
light #f2e5cf
dark  #91aeb6
```

The same values also appear in:

- `apps/web/src/components/home-workspace.tsx`
- `apps/web/src/components/review-shell.tsx`
- `apps/mobile/src/app.tsx`
- `apps/web/src/lib/png-export.ts`
- `apps/web/src/app/styles/review-semantics.css` quality fixture

This is the biggest immediate mismatch after introducing the new pieces.

The new pieces are ivory / powder blue / mist blue / slate navy. The legacy board’s `#91aeb6` is too assertive and “website-chess-board blue”, while `#f2e5cf` is somewhat too yellow next to the new warm-ivory pieces.

## 2.4 The current design system already points in the right direction

`docs/ui-spec.md` and `open-chess-review-ai-brief.md` already establish:

- warm paper
- mist blue
- dusty pink
- sage
- cream
- blue-gray ink
- whitespace and fine rules
- no card soup
- no glassmorphic dashboard
- Blue Bishop as original identity
- no literal bird character

Do not invent a new design language. This audit is a convergence/refinement pass.

---

# 3. Main diagnosis

The project currently has a **quality mismatch between the new pieces and the surrounding UI**.

The pieces are now specific, authored and atmospheric. Much of the surrounding UI is still one generation behind:

- board colors are stronger and more generic than the pieces;
- several surfaces use translucent card treatments;
- header uses `backdrop-filter`;
- some shadows are too large/heavy;
- repeated panels still use semi-transparent “card” fills;
- many visual colors are repeated as raw hex/rgba rather than being owned by tokens;
- Review toolbar has a noticeable `rotate(8deg)` hover;
- some row hover treatments physically expand outside their bounds;
- small metadata often uses 9–10px low-contrast text;
- selected-square UI uses strong magenta + yellow that visually jumps out of the new palette;
- quality-fixture board backgrounds still test against the old board;
- mobile and PNG export still retain the old board palette.

The direction is therefore:

> **Do less, centralize more, and make the chessboard + paper surfaces belong to the same material world as the new pieces.**

---

# 4. Theme architecture: do not create a second theme

Do not add:

```ts
theme: "default" | "liz"
```

Do not add a new theme provider.

Do not duplicate every token.

That would create unnecessary product and maintenance complexity while the current visual system is already intended to be Bluebird-inspired.

Instead:

- update the current light tokens;
- add board-specific semantic variables;
- remove stale raw colors;
- use the same default theme everywhere on Web;
- keep the piece-set setting independent.

### Internal design name

Use **Windowlight** in design docs/comments if a name is useful.

It does not need to appear prominently to users.

---

# 5. Final palette

## 5.1 Production tokens

Use this as the target light palette.

```css
:root {
  color-scheme: light;

  /* Paper */
  --surface-page: #f8f6ef;
  --surface-paper: #fffef9;
  --surface-raised: #fbf8f1;

  /* Washes: atmosphere, not component identity */
  --wash-blue: #e6efee;
  --wash-pink: #f0e7e9;
  --wash-sage: #e8eee4;
  --wash-cream: #f3ecdf;

  /* Ink */
  --ink-primary: #2d4654;
  --ink-secondary: #566e78;
  --ink-muted: #5f747d;
  --ink-faint: #829096;

  /* Rules */
  --line: #d6dfdc;
  --line-soft: #e5e9e6;
  --line-accent: #b4c6c5;

  /* Actions */
  --accent-primary: #587493;
  --accent-hover: #496783;
  --accent-ink: #fffef9;
  --focus-ring: #587493;

  /* Board */
  --board-square-light: #eee8d9;
  --board-square-dark: #b1c6c2;
  --board-notation-light: #516a75;
  --board-notation-dark: #38525e;
  --board-selection: #82495c;
  --board-selection-wash: rgba(183, 162, 112, .22);
  --board-outline: rgba(76, 101, 111, .14);

  /* Sparse warm accent */
  --accent-brass: #b7a270;
  --accent-rose: #82495c;

  /* Semantic status — preserve meaning */
  --danger: #a6535f;
  --danger-soft: #fbefeb;
  --success-soft: #edf6f5;
  --warning-soft: #fbf6e9;

  /* Shadows */
  --shadow-paper: 0 8px 24px rgba(61, 82, 88, .045);
  --shadow-floating: 0 14px 38px rgba(52, 72, 78, .10);
  --shadow-board: 0 12px 30px rgba(52, 72, 78, .09);

  /* Typography */
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: Georgia, "Songti SC", "Hiragino Mincho ProN", "Yu Mincho", serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

Then maintain the existing compatibility aliases:

```css
--bg: var(--surface-page);
--surface: var(--surface-paper);
--surface-2: var(--wash-blue);
--surface-3: #dce8e7;
--text: var(--ink-primary);
--muted: var(--ink-muted);
--accent: var(--accent-primary);
--paper: var(--surface-raised);
--mist: var(--wash-blue);
--pink: var(--wash-pink);
--sage: var(--wash-sage);
--cream: var(--wash-cream);
```

## 5.2 Contrast notes

The proposed palette is intentionally quiet, but functional text must remain readable.

Approximate WCAG contrast:

```text
#2d4654 on #f8f6ef ≈ 9.18:1
#566e78 on #f8f6ef ≈ 4.98:1
#5f747d on #f8f6ef ≈ 4.54:1
#fffef9 on #587493 ≈ 4.80:1

board notation:
#516a75 on #eee8d9 ≈ 4.68:1
#38525e on #b1c6c2 ≈ 4.62:1
```

Important: the previous idea of using `#74858b` as normal muted text would be too weak for small body text. Reserve lighter `--ink-faint` for non-essential/decorative information only.

---

# 6. Board integration — P0

This is the first implementation task.

## 6.1 Centralize board appearance

Do not continue repeating hex colors in Home and Review.

Create:

```text
apps/web/src/lib/board-appearance.ts
```

Suggested content:

```ts
import type { CSSProperties } from "react";

export const WINDOWLIGHT_BOARD_APPEARANCE = {
  lightSquareStyle: {
    backgroundColor: "var(--board-square-light)",
  } satisfies CSSProperties,

  darkSquareStyle: {
    backgroundColor: "var(--board-square-dark)",
  } satisfies CSSProperties,

  lightSquareNotationStyle: {
    color: "var(--board-notation-light)",
  } satisfies CSSProperties,

  darkSquareNotationStyle: {
    color: "var(--board-notation-dark)",
  } satisfies CSSProperties,

  boardStyle: {
    borderRadius: "6px",
    outline: "1px solid var(--board-outline)",
    boxShadow: "var(--shadow-board)",
  } satisfies CSSProperties,
} as const;
```

Using CSS variables inside the inline styles keeps `tokens.css` as the actual color source of truth while preventing Home/Review option duplication.

## 6.2 Home board

In `apps/web/src/components/home-workspace.tsx`, replace:

```ts
lightSquareStyle: { backgroundColor: "#f2e5cf" },
darkSquareStyle: { backgroundColor: "#91aeb6" },
lightSquareNotationStyle: { color: "#6d8290" },
darkSquareNotationStyle: { color: "#f4eadb" },
boardStyle: { borderRadius: "5px", boxShadow: "0 20px 54px rgba(60, 74, 84, .16)" },
```

with the centralized Windowlight appearance.

Do not alter:

- board position logic;
- responsive width;
- piece renderer;
- source order (form before decorative board in DOM is useful on mobile).

## 6.3 Review board

Apply the same board appearance in `review-shell.tsx`.

Do not create a “Review-specific blue”.

Home and Review must use the same chessboard.

## 6.4 Quality fixture

Update:

```css
.quality-fixture-grid .light-square
.quality-fixture-grid .dark-square
```

to the new board tokens.

The quality-icon fixture is part of visual QA. Leaving old board colors there would make it test the wrong environment.

Use:

```css
.quality-fixture-grid .light-square {
  background: var(--board-square-light);
}

.quality-fixture-grid .dark-square {
  background: var(--board-square-dark);
  color: var(--board-notation-dark);
}
```

## 6.5 Board coordinates

Do not use white text on every dark square.

Use the explicit notation tokens above.

This keeps coordinates visible but quiet.

## 6.6 Board frame

Do not create a large illustrated frame around Review.

The board itself needs only:

- 6px radius;
- 1px fine outline;
- subtle board shadow.

No ornamental frame, no feather corners, no bird watermark.

---

# 7. Board interaction states — P0/P1

The board is an analytical tool. Interaction states must be more visible than the theme.

## 7.1 Selected square

Current implementation uses a very saturated magenta outline plus yellow wash.

Move toward a quieter dusty-rose + brass relationship:

```ts
const SELECTED_SQUARE: CSSProperties = {
  boxShadow: "inset 0 0 0 4px var(--board-selection)",
  backgroundImage:
    "linear-gradient(var(--board-selection-wash), var(--board-selection-wash))",
};
```

If CSS variables inside `backgroundImage` cause a typing/runtime issue, use literal equivalents in this one low-level file, but document them as mirrors of the tokens.

## 7.2 Quiet destination

Suggested:

```ts
const QUIET_DESTINATION: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, rgba(130,73,92,.94) 0 12%, rgba(255,254,249,.90) 13% 19%, transparent 20%)",
};
```

## 7.3 Capture destination

Suggested:

```ts
const CAPTURE_DESTINATION: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, transparent 0 56%, rgba(255,254,249,.90) 57% 63%, rgba(130,73,92,.92) 64% 78%, transparent 79%)",
};
```

Do not make interaction markers too pale merely to match the theme.

## 7.4 Engine / Maia / fault arrows

Do **not** recolor everything to the Windowlight palette.

Current source-aware semantics are useful:

- Stockfish: blue family
- Maia: green family
- fault: red/rose family
- overlap: teal family

Keep this distinction.

Only adjust an arrow if a visual test on the new `#b1c6c2` square proves insufficient contrast.

## 7.5 Move Quality badges

Do not modify classification semantics to fit the theme.

The shared V3 geometry/color system is information, not decoration.

The theme is subordinate to this system.

---

# 8. Paper, not glass — P1

The current product brief already says “transparency is not glassmorphism”, but the code still contains glass-like treatments.

This is a high-value cleanup.

## 8.1 App header

Current:

```css
background: rgba(...);
backdrop-filter: blur(16px);
```

Target:

```css
.app-header {
  border-bottom: 1px solid var(--line-soft);
  background: var(--surface-raised);
  backdrop-filter: none;
}
```

Hover:

```css
.app-header nav a:hover {
  background: color-mix(in srgb, var(--wash-blue) 62%, var(--surface-raised));
  color: var(--ink-primary);
}
```

The header should feel like the top edge of a sheet/document, not a frosted browser panel.

## 8.2 Review titlebar

Current `review-titlebar` also uses a translucent background.

Target:

```css
.review-titlebar {
  border-bottom: 1px solid var(--line-soft);
  background: var(--surface-raised);
}
```

No blur.

No large shadow.

## 8.3 Shared paper surface

Change `.paper-card` toward a genuinely paper-like solid surface:

```css
.paper-card {
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: var(--surface-paper);
  box-shadow: var(--shadow-paper);
}
```

## 8.4 Ink rows

Repeated/dense content should not become repeated cards.

```css
.ink-row {
  border-bottom: 1px solid var(--line-soft);
  background: transparent;
}

.ink-row:hover {
  border-color: var(--line-accent);
  background: color-mix(in srgb, var(--wash-blue) 28%, transparent);
}
```

This is especially important in History, move lists, evidence lists and Training.

---

# 9. Home audit — P1

Home is allowed to be the most atmospheric page, but it still must look like a product.

## Keep

- current two-column desktop composition;
- current mobile DOM order: form before board;
- serif headline;
- board as a visual preview;
- Recent Reviews as ink rows;
- connected accounts as actual product information.

## Fix

### 9.1 Import card

Current card is too “floating SaaS”:

- 22px radius;
- translucent background;
- 70px shadow.

Target:

```css
.import-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: var(--surface-paper);
  box-shadow: var(--shadow-paper);
}
```

Do not add backdrop blur.

### 9.2 Source tabs

Keep them calm:

```css
.source-tabs {
  background: color-mix(in srgb, var(--wash-blue) 55%, var(--surface-raised));
}

.source-tabs button.active {
  background: var(--surface-paper);
  color: var(--accent-primary);
  box-shadow: 0 1px 5px rgba(52,72,78,.06);
}
```

### 9.3 Home background

Keep atmosphere very low-frequency.

Current global background has a pink and blue radial wash. That idea is correct, but make it quieter:

```css
body {
  color: var(--ink-primary);
  background:
    radial-gradient(
      circle at 88% 8%,
      color-mix(in srgb, var(--wash-blue) 46%, transparent),
      transparent 28rem
    ),
    radial-gradient(
      circle at 8% 2%,
      color-mix(in srgb, var(--wash-pink) 24%, transparent),
      transparent 22rem
    ),
    linear-gradient(
      180deg,
      var(--surface-raised) 0%,
      var(--surface-page) 72%,
      #f5f1e9 100%
    );
}
```

The user should not consciously notice the gradient.

### 9.4 Do not add a literal blue bird

If Home needs more identity, use:

- more deliberate spacing;
- Blue Bishop mark;
- board/piece art;
- pale wash;
- a fine horizontal rule;
- serif title.

Do not add a new bird icon.

---

# 10. Review audit — P1

Review must be the most disciplined page because it carries the densest information.

## 10.1 Board remains the primary object

Do not wrap the board in a large card.

Do not put thematic decoration behind the board.

The new pieces + new square colors already provide sufficient identity.

## 10.2 Player strips

Current structure is good.

Keep player strips as text/avatars, not cards.

Use tokens instead of raw colors for:

- player name;
- rating;
- avatar border;
- avatar fallback backgrounds.

## 10.3 Toolbar controls

Current `.board-flip-button:hover` rotates by 8 degrees.

Remove that.

It violates the current product principle of nearly invisible motion.

Target interaction:

```css
.board-flip-button,
.sound-toggle-button {
  border: 1px solid var(--line);
  background: var(--surface-paper);
  color: var(--ink-secondary);
  transition: background .16s ease, border-color .16s ease, color .16s ease;
}

.board-flip-button:hover,
.sound-toggle-button:hover {
  border-color: var(--line-accent);
  background: var(--wash-blue);
  color: var(--ink-primary);
}
```

No rotation.

## 10.4 Move transport

Keep the central Play/Pause button slightly stronger than the other four.

Use wash, not glass:

```css
.move-transport button:nth-child(3) {
  border: 1px solid var(--line);
  background: var(--wash-blue);
  color: var(--accent-primary);
}
```

## 10.5 Continuation rows

Current hover/active state expands beyond its normal width with negative margins.

Remove this physical expansion.

Target:

```css
.continuation-list > button:hover,
.continuation-list > button.active {
  width: 100%;
  margin-inline: 0;
  padding-inline: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--wash-blue) 55%, transparent);
}
```

The row should feel highlighted, not animated outward.

## 10.6 Repeated mini-cards

Audit `review-panels.css` for repeated patterns such as:

```css
background: rgba(255, 253, 248, .68);
border: 1px solid ...
border-radius: 10px;
```

Not all of these should survive.

Rule:

```text
rare / important concept → paper card allowed
repeated / dense evidence → ink row
```

Recommended:

- Game Summary: can remain one paper section.
- Current move verdict: row, not card.
- Continuation candidate: row.
- Move list: row.
- Evidence list: row/definition list.
- Source selector: compact segmented control.
- Service state: inline status.
- Popover/action menu: floating paper is allowed because it truly floats.
- Promotion chooser: modal/floating paper is allowed.

## 10.7 Game Summary

Keep Game Summary as an important section, but make it solid and quiet:

```css
.game-summary-section {
  margin-top: 22px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-paper);
  box-shadow: var(--shadow-paper);
}
```

Avoid quirky/asymmetric radii unless the same language is used intentionally elsewhere.

---

# 11. Evaluation bar

Do not make it decorative.

Use theme-compatible surfaces but preserve the functional white/black split.

Suggested migration:

```css
.eval-bar {
  border-color: color-mix(in srgb, var(--ink-secondary) 22%, transparent);
  background: var(--surface-raised);
  color: var(--ink-primary);
  box-shadow: 0 4px 14px rgba(53,74,81,.055);
}

.eval-top.eval-black,
.eval-bottom-black {
  background: #647b85;
}

.eval-top.eval-white,
.eval-bottom-white {
  background: var(--surface-raised);
}
```

Maia marker remains green.

---

# 12. Study / Training audit — P1/P2

This area is already the closest to the intended product identity.

Do not rewrite it wholesale.

## Keep

- journal-like section sequence;
- serif section headings;
- grouped nav;
- ink statistics;
- line-based rows;
- faint wash sections;
- paper metaphor.

## Reduce

The Study page currently layers several radial washes:

- pink 38%
- blue 44%
- sage 24%
- cream 48%

This can become visibly pastel on some screens.

Recommended lower intensities:

```css
.study-page {
  background:
    radial-gradient(
      ellipse at 8% 10%,
      color-mix(in srgb, var(--wash-pink) 18%, transparent),
      transparent 34rem
    ),
    radial-gradient(
      ellipse at 94% 6%,
      color-mix(in srgb, var(--wash-blue) 26%, transparent),
      transparent 36rem
    ),
    radial-gradient(
      ellipse at 78% 58%,
      color-mix(in srgb, var(--wash-sage) 12%, transparent),
      transparent 28rem
    ),
    radial-gradient(
      ellipse at 12% 78%,
      color-mix(in srgb, var(--wash-cream) 24%, transparent),
      transparent 26rem
    );
}
```

The result should be perceived as paper exposed to changing light, not four colored background blobs.

## Study paper

Prefer:

```css
.study-paper {
  background: var(--surface-paper);
}
```

Use transparency mainly in wash overlays, not the main reading surface.

---

# 13. History / Library audit — P2

History is already structurally correct because it uses ink rows rather than card soup.

Keep:

- list rows;
- fine dividers;
- small category label;
- title + metadata + action.

Fix:

- migrate raw link colors to tokens;
- keep functional text >= 11–12px where possible;
- ensure hover is a subtle paper/wash change rather than transform or shadow;
- keep empty state as one dashed paper region.

Do not turn History into a tile/card grid.

---

# 14. Settings audit — P2

Settings is one place where grouped cards are appropriate, but the cards should look like paper.

Current:

```css
.settings-card {
  border-radius: 16px;
  background: rgba(255,253,248,.72);
}
```

Target:

```css
.settings-card {
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: var(--surface-paper);
  box-shadow: none;
}
```

Keep strong cards only for truly distinct groups.

### Piece-set setting

Recommended user-facing copy:

```html
<option value="liz-blue">Feather Porcelain</option>
<option value="classic">Classic SVG</option>
```

Do not change the underlying `liz-blue` value.

---

# 15. Typography audit

The current serif/sans split is correct.

## Use serif for

- page H1;
- Review/Study section headings;
- major metric values;
- journal-style editorial headings.

## Use sans for

- buttons;
- tabs;
- filters;
- engine values;
- source labels;
- metadata;
- evidence rows.

## Use mono for

- SAN/PV where appropriate;
- FEN/PGN technical text;
- exact engine/code-like values.

## Important size rule

There are many 9–10px labels in the current CSS.

Do not use 9–10px for essential information.

Guideline:

```text
9–10px  → decorative kicker only
11–12px → metadata / compact controls
13–16px → body and normal interaction text
```

“Airiness” must come from spacing and weight, not unreadably small gray text.

---

# 16. Blue Bishop identity and film-related motifs

## Keep the Blue Bishop

The project already owns a strong original symbol:

- bishop silhouette;
- diagonal cut;
- restrained inner wing;
- dusty blue / cream / pale-gold relationship.

This is exactly the right place for symbolic identity.

Do not replace it with a literal blue bird.

## Recolor only if needed

The geometry should remain unchanged.

It is acceptable to tune the surrounding `.brand-mark` container to the new tokens:

```css
.brand-mark {
  background: var(--wash-cream);
  color: var(--accent-primary);
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--accent-primary) 18%, transparent);
}
```

The small pale-gold wing in the SVG may remain. It creates a useful warm/cool counterpoint.

## Literal blue bird / feather decision

**Default implementation: do not add them.**

Why:

1. The pieces already contain feather language.
2. The Blue Bishop already contains an abstract wing.
3. Review needs clarity.
4. The existing Product North Star explicitly warns against bird/feather icon theming.
5. The official source material is better translated through atmosphere than symbols.

If a future Home art experiment is explicitly requested, it must:

- be Home-only;
- be original;
- be non-interactive;
- sit outside the board;
- remain below roughly 5–8% perceived visual contrast;
- never be required to understand the product;
- not be an official film asset;
- have a no-decoration fallback for reduced visual noise.

But this is **not** part of the recommended implementation.

---

# 17. Motion audit

Current product principle: small change, almost unnoticed.

## Remove

- `.board-flip-button:hover { transform: rotate(8deg); }`
- hover scale;
- card lift;
- large translate;
- spring motion;
- looping ambient animation;
- falling feather animation.

## Allow

- color change;
- border change;
- opacity;
- underline;
- subtle wash reveal;
- <=2px shift only when it communicates state;
- 120–180ms transitions.

The existing global `prefers-reduced-motion` handling should remain.

---

# 18. Piece asset engineering

Current renderer is good:

```tsx
<img
  src={`${LIZ_BLUE_DIR}/${key}.png`}
  alt=""
  draggable={false}
  style={{
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    userSelect: "none",
    display: "block",
  }}
/>
```

Do not add `object-fit` unless a browser test shows a problem; the 512×512 source canvases already encode alignment and scale.

## Asset invariants

The directory must contain exactly:

```text
wP.png wN.png wB.png wR.png wQ.png wK.png
bP.png bN.png bB.png bR.png bQ.png bK.png
```

All should remain:

- 512×512;
- RGBA;
- transparent;
- sRGB;
- same canvas dimensions;
- no baked board background.

## Performance

The browser downloads each unique piece URL once, not once per board instance, so 32 rendered pieces do not mean 32 unique image downloads.

Still:

- keep 512px masters;
- optionally run lossless/visually-lossless PNG optimization;
- never reduce to 256px just to save bytes without testing Retina displays;
- verify alpha edges at 40–75px rendered cell sizes.

Do not introduce WebP/AVIF in this theme PR unless the rendering/cache path is deliberately redesigned.

---

# 19. Service worker cache — important

`apps/web/public/sw.js` treats `/pieces/` as cache-first:

```js
const ASSET_PREFIXES = ["/engine/", "/sounds/", "/pieces/", "/_next/static/"];
```

That means replacing a PNG at the same URL can leave returning users on an old cached piece.

### Rule

If the 12 PNG bytes change while their URLs stay the same:

- bump `CACHE_VERSION`, e.g. `v2 → v3`, **or**
- version the piece directory.

Do not silently replace same-path piece assets without cache invalidation.

If only CSS/theme values change, the piece cache does not need to be invalidated.

---

# 20. Raw-color/token cleanup

After the board and main theme changes, run a systematic raw-color audit.

Suggested command:

```bash
rg -n '#[0-9a-fA-F]{3,8}|rgba?\(' \
  apps/web/src/app/styles \
  apps/web/src/components \
  apps/web/src/lib
```

Classify every result.

## Raw color is allowed for

- Move Quality semantic colors;
- Stockfish/Maia arrow semantics;
- error/warning/success semantics;
- external provider identity where appropriate;
- Blue Bishop internal artwork;
- rare chart-specific semantic colors.

## Raw color should be replaced by a token for

- page backgrounds;
- paper surfaces;
- borders;
- normal text;
- muted text;
- links;
- board squares;
- board notations;
- generic hover;
- generic active state;
- generic controls;
- generic cards/panels;
- generic shadows.

Do not create a new token for every single hex value. Consolidate into semantic vocabulary.

---

# 21. File-by-file implementation map

## Must change — first pass

### `apps/web/src/app/styles/tokens.css`

- install final Windowlight palette;
- add board tokens;
- add focus/shadow/font tokens;
- keep compatibility aliases.

### `apps/web/src/lib/board-appearance.ts` — new

- centralize Home/Review react-chessboard appearance using CSS variables.

### `apps/web/src/components/home-workspace.tsx`

- replace hard-coded board colors/style with shared board appearance.

### `apps/web/src/components/review-shell.tsx`

- replace hard-coded board colors/style with shared board appearance.
- do not touch chess logic.

### `apps/web/src/app/styles/review-semantics.css`

- quality fixture uses new board tokens;
- optionally tokenize eval colors;
- do not alter Move Quality semantics.

### `apps/web/src/lib/board-move-hints.ts`

- tune selected/quiet/capture board feedback;
- preserve visibility and tests.

## Must change — visual convergence

### `apps/web/src/app/styles/base.css`

- quieter page washes;
- focus ring should use `--focus-ring`;
- primary hover uses `--accent-hover`.

### `apps/web/src/app/styles/chrome.css`

- remove backdrop blur;
- solid paper/raised header;
- tokenized colors.

### `apps/web/src/app/styles/home.css`

- import card becomes solid paper;
- reduce radius/shadow;
- tokenized source tabs/text/input;
- do not change mobile DOM reading order.

### `apps/web/src/app/styles/review-shell.css`

- solid titlebar;
- tokenized nav/menu colors;
- preserve responsive board sizing and layout contracts.

### `apps/web/src/app/styles/review-workspace.css`

- remove flip-button rotation;
- tokenized toolbar/player/move controls;
- keep board dimensions untouched.

### `apps/web/src/app/styles/review-panels.css`

- flatten repeated translucent cards into rows;
- preserve important paper sections/popovers;
- remove hover width expansion.

### `apps/web/src/app/styles/surfaces.css`

- solid paper semantics;
- transparent ink rows;
- subtle washes.

## Second pass

### `apps/web/src/app/styles/study.css`

- reduce wash intensity;
- main paper solid;
- preserve journal information architecture.

### `apps/web/src/app/styles/utilities.css`

- Settings paper cards solid;
- migrate raw colors;
- preserve History rows.

### `apps/web/src/app/styles/platforms.css`
### `apps/web/src/app/styles/human-lens.css`
### `apps/web/src/app/styles/coach.css`
### `apps/web/src/app/styles/practice.css`
### `apps/web/src/app/styles/notebook.css`

- only token/weight cleanup;
- do not redesign their domain semantics.

### `apps/web/src/app/styles/visual-identity.css`

- optionally align brand container colors to Windowlight;
- do not change Blue Bishop geometry.

### `apps/web/src/components/settings-page.tsx`

- optional display label rename `Liz Blue` → `Feather Porcelain`;
- do not change stored piece-set ID.

## Conditional

### `apps/web/public/sw.js`

Only bump cache version if piece files are replaced at the same paths.

---

# 22. Explicitly deferred work

Per current product decision, do not bundle these into the theme implementation unless the user asks.

## 22.1 PNG export pieces

`png-export.ts` currently draws Unicode chess glyphs.

Leave this piece-rendering migration for a dedicated pass.

Do not attempt to asynchronously load the new PNG pieces into the canvas as a side effect of the theme PR.

A later export parity task can:

- preload 12 images;
- draw them to canvas;
- use the same board palette;
- preserve offline export;
- handle image decode failures;
- add tests.

## 22.2 Promotion chooser pieces

Promotion currently uses Unicode glyphs.

Leave it unchanged for now.

Later, export + promotion can move to the same image vocabulary together.

## 22.3 Mobile

`apps/mobile` still hard-codes the legacy board colors and does not currently share the Web piece renderer.

Do not block Web polish on mobile parity.

After Web is accepted, perform a separate mobile pass:

- board colors;
- piece assets if the Vite/Tauri asset path is clean;
- Blue Bishop token alignment;
- screenshot tests.

## 22.4 Dark theme

Do not mechanically invert Windowlight.

If a dark theme is built later, design and review it independently.

---

# 23. Add a dedicated piece visual fixture

This is strongly recommended.

The repository already has `/design/quality-icons`.

Add a similar internal visual QA route:

```text
/design/pieces
```

Show:

- all 12 pieces;
- both square colors;
- 32px, 40px, 56px, 72px cells;
- light and dark square alternation;
- one selected-square state;
- one quiet destination state;
- one capture state;
- one Stockfish arrow;
- one Maia arrow;
- one Move Quality badge;
- flipped board sample if convenient.

This fixture becomes the permanent acceptance environment for future piece or board changes.

It is much safer than evaluating pieces only on the starting position.

---

# 24. Accessibility acceptance criteria

## Text

- Normal functional text: >=4.5:1.
- Large text: >=3:1.
- Do not use `--ink-faint` for essential 10–12px text.
- Controls must not communicate state by color alone.

## Focus

Change generic focus styling from a very pale line token to a clear focus token:

```css
button:focus-visible,
summary:focus-visible,
a:focus-visible,
textarea:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

## Board

Verify:

- white pieces on light squares;
- white pieces on dark squares;
- black pieces on light squares;
- black pieces on dark squares;
- coordinates;
- selected square;
- legal quiet move;
- legal capture;
- arrow;
- quality badge;
- flipped orientation.

## Touch

Preserve existing 44px touch targets.

Do not shrink controls to create “delicacy”.

---

# 25. Responsive acceptance matrix

Test at minimum:

```text
390 × 844
768 × 1024
1280 × 720
1366 × 768
1440 × 900
1728 × 1117
1920 × 1080
```

Repository-specific Review expectations already document approximately:

```text
1280×720   board ~424px
1366×768   board ~472px
1440×900   board ~540px
1920×1080  board ~600px
```

Do not break this sizing contract merely to create more whitespace.

The “air” comes from the page composition around the board, not by making the board smaller than the task requires.

---

# 26. Testing / visual regression procedure

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

Do **not** immediately overwrite visual snapshots.

Workflow:

1. run visual tests;
2. inspect every diff;
3. confirm each visual change is intentional;
4. only then run:

```bash
pnpm test:e2e:update
```

Important existing visual states include:

- Home connected 1440;
- Review white Brilliant;
- Review black Blunder / flipped;
- analysis variation;
- Stockfish + Maia compare;
- grounded Coach;
- Library;
- quality icon fixture.

Add the new piece fixture screenshot if `/design/pieces` is implemented.

---

# 27. Manual visual checklist

## Home

- [ ] New pieces feel native to board.
- [ ] Board no longer dominates through blue saturation.
- [ ] Import area looks like paper, not frosted glass.
- [ ] Headline remains strongest object after board.
- [ ] No literal bird/feather decoration.
- [ ] Mobile form appears before decorative board.
- [ ] Recent rows remain easy to scan.

## Review

- [ ] Board has highest interaction priority.
- [ ] Pieces remain readable at all supported board sizes.
- [ ] Black pieces separate from dark squares.
- [ ] White pieces separate from light squares.
- [ ] Eval bar remains distinct.
- [ ] Stockfish/Maia arrows remain distinguishable.
- [ ] Quality badge remains legible.
- [ ] Selected / legal / capture states are obvious.
- [ ] No hover causes obvious layout movement.
- [ ] No toolbar icon performs decorative rotation.
- [ ] Right panel is quieter than board.
- [ ] Game Summary is an intentional paper section, not another glass card.

## Study / Training

- [ ] Background washes are barely perceived.
- [ ] Reading surface is solid and calm.
- [ ] Journal hierarchy is more prominent than color blocks.
- [ ] Dense data remains rows, not cards.

## History

- [ ] Looks like a catalog/index.
- [ ] Hover does not lift cards.
- [ ] Metadata is readable despite small type.

## Settings

- [ ] Cards feel like grouped paper sections.
- [ ] Piece-set selector remains functional.
- [ ] Long model names still fit narrow layouts.

---

# 28. Implementation order

Use this order to reduce regressions.

## Phase A — Board + tokens

1. update `tokens.css`;
2. add `board-appearance.ts`;
3. update Home board;
4. update Review board;
5. update quality fixture;
6. adjust board move hints;
7. run tests/screenshots.

This gives immediate value and is easy to review.

## Phase B — De-glass the core shell

1. `base.css`;
2. `chrome.css`;
3. `home.css`;
4. `review-shell.css`;
5. `review-workspace.css`;
6. `surfaces.css`;
7. run visual tests.

## Phase C — Review density cleanup

1. `review-panels.css`;
2. flatten repeated card treatments;
3. remove hover layout expansion;
4. verify all objective/human semantic states;
5. run visual tests.

## Phase D — Secondary routes

1. Study wash reduction;
2. Settings paper cleanup;
3. History token cleanup;
4. platform/human/coach/practice/notebook token cleanup;
5. add `/design/pieces`;
6. final visual suite.

## Phase E — Docs

After the implementation is accepted:

- update `docs/ui-spec.md` with final board palette and default piece family;
- add a dated design implementation note;
- mark the older 2026-09-05 Bluebird proposal as historical/superseded where appropriate, without deleting it;
- keep `open-chess-review-ai-brief.md` aligned with the final implementation.

---

# 29. Things the implementing AI must NOT do

1. Do not redesign the chess pieces.
2. Do not regenerate images.
3. Do not change the 12 piece filenames.
4. Do not add literal blue birds.
5. Do not add feather icons.
6. Do not copy official film art/assets.
7. Do not create a new global theme provider.
8. Do not create pastel cards for every section.
9. Do not use backdrop blur to represent “transparency”.
10. Do not change chess rules, analysis algorithms or persisted schemas.
11. Do not recolor Move Quality semantics into one aesthetic palette.
12. Do not merge Stockfish and Maia semantics.
13. Do not reduce board size just for visual whitespace.
14. Do not replace export/promotion Unicode in this pass.
15. Do not blindly update visual snapshots without inspection.
16. Do not edit shared Blue Bishop SVG geometry merely to match the new pieces.
17. Do not introduce a new UI dependency for this work.
18. Do not make mobile parity a blocker for Web.
19. Do not make muted text unreadable.
20. Do not use “Liz” branding in a way that implies official affiliation.

---

# 30. Definition of Done

The visual integration is finished when:

- [ ] `liz-blue` remains default and all 12 custom PNGs render on Home/Review.
- [ ] Board uses `#eee8d9 / #b1c6c2`.
- [ ] Board appearance is centralized rather than duplicated in Home/Review.
- [ ] Board notation passes readable contrast.
- [ ] Selected/quiet/capture states remain immediately visible.
- [ ] Quality fixture uses the production board colors.
- [ ] App header no longer relies on backdrop blur.
- [ ] Home import surface is solid paper with restrained radius/shadow.
- [ ] Review titlebar is solid paper/raised surface.
- [ ] Flip hover no longer rotates.
- [ ] Continuation hover does not change row geometry.
- [ ] Repeated Review data is mostly rows rather than translucent mini-cards.
- [ ] Study washes are restrained.
- [ ] Settings cards are solid paper.
- [ ] Functional small text meets reasonable contrast/readability.
- [ ] Blue Bishop remains the single symbolic identity mark.
- [ ] No new literal bird/feather decoration is introduced.
- [ ] 390px mobile has no horizontal overflow.
- [ ] Review sizing contracts remain intact.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` pass.
- [ ] Visual diffs are manually reviewed before snapshot updates.
- [ ] If piece files changed at identical URLs, the service-worker cache version is bumped.
- [ ] Docs reflect the final production theme.

---

# 31. Copy-paste implementation brief for another AI

Use the following as the actual handoff prompt.

```text
You are implementing the final visual convergence pass for:
https://github.com/ice345/chess-review

Start from current master and inspect the source before editing. The audit baseline
was master b4eb09dde110e0ccbc487bb45ec879a2b6b97f5a, but current code wins if master
has advanced.

Goal:
Make the existing default light UI and the already-integrated liz-blue PNG chess
pieces feel like one coherent production system.

North Star:
Quiet Editorial Chess Study · Warm Paper · Blue-gray Ink · Faint Watercolor Wash
· Fine Rules · Deliberate Negative Space · Evidence-first · Human but Precise
· No Card Soup · No SaaS Dashboard.

This is NOT an anime-theme implementation. Do not add literal birds, feather
icons, characters, official film artwork, decorative movie frames, glassmorphism,
or looping atmospheric animation.

Use the existing Blue Bishop as the only symbolic brand mark. The new chess pieces
already carry feather/wing language; the UI should carry air, paper, window light,
distance and restraint.

Implement in phases:

A. Board + theme tokens
- update tokens.css to the approved Windowlight palette;
- add board tokens:
  light #eee8d9
  dark #b1c6c2
  light notation #516a75
  dark notation #38525e
- centralize react-chessboard appearance in a shared board-appearance module;
- remove duplicate board hex values from Home and Review;
- update quality fixture to production board colors;
- tune selected/legal/capture hints toward dusty rose + restrained brass wash;
- preserve Stockfish/Maia/Move Quality semantics.

B. Remove glass-like core treatments
- app header: no backdrop-filter; solid raised paper;
- review titlebar: solid raised paper;
- Home import card: solid paper, ~14px radius, very light shadow;
- shared paper-card: solid paper;
- repeated dense rows: transparent + fine divider.

C. Review interaction polish
- remove flip-button rotate hover;
- remove continuation row negative-margin/width expansion;
- keep board, player strips and move transport visually primary;
- flatten repeated evidence/move mini-cards into ink rows;
- retain one important Game Summary paper section and real popovers/modals.

D. Secondary routes
- reduce Study radial wash intensity;
- make main reading paper solid;
- Settings cards solid paper;
- History remains ink rows;
- migrate generic raw colors to tokens without changing domain semantics.

E. QA
- add /design/pieces fixture if practical, with all 12 pieces on both square colors
  at 32/40/56/72px and selected/legal/capture/arrow/badge states;
- run typecheck, lint, tests, e2e;
- inspect screenshots before updating visual snapshots.

Do not:
- change chess algorithms/data schemas;
- redesign/regenerate piece PNGs;
- change filenames;
- replace Unicode export or promotion pieces in this pass;
- create a new theme provider or theme toggle;
- recolor semantic analysis states for aesthetics;
- copy official Liz and the Blue Bird assets.

Important cache detail:
apps/web/public/sw.js caches /pieces/ cache-first. If PNG bytes are changed under
the same URLs, bump CACHE_VERSION or version the asset directory.

Optional naming polish:
Keep stored pieceSet ID "liz-blue", but user-facing Settings label may become
"Feather Porcelain" instead of "Liz Blue".

After implementation update docs/ui-spec.md to reflect the production board palette,
default piece family and Windowlight visual system.
```

---

# 32. Final design statement

The target should not look like:

> “a chess site decorated with *Liz and the Blue Bird* motifs.”

It should feel like:

> **a serious chess-study product that naturally exists in the same kind of quiet air: warm paper, cold window light, fragile blue-gray contrast, fine lines, long pauses, and careful observation.**

The pieces provide the feather.

The Blue Bishop provides the symbol.

The interface provides the air.
