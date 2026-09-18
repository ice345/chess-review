# Open Chess Review — Windowlight / Bluebird Design System V2

Status: Adopted design direction (2026-09-18)  
Purpose: Product/UI art direction, interaction system, motion rules, and implementation guidance  
Scope: Web first; desktop/mobile companions should inherit compatible tokens and assets  
Reference set: `references/windowlight-bluebird-v2/01-home.png` through `04-practice.png`  
Authority: [`windowlight-contract.md`](windowlight-contract.md) remains the normative visual
contract. This document is the adopted art-direction annex that amends it; production tokens
stay the numerical source of truth.

Implementation state: **not implemented as a whole.** Where a rule already matches the shipped
product it is marked *implemented* below; everything else is target behaviour. Do not read this
document as a description of current behaviour.

## 0. Adoption record — 2026-09-18

Adopted in this round:

1. **Navigation becomes a persistent left rail** at desktop sizes across the application
   routes. It supersedes the top `AppHeader` bar and rewrites the IA section of
   [`../ui-spec.md`](../ui-spec.md) in the same change that lands it. Below the desktop
   breakpoint the rail becomes a drawer behind a top-bar trigger, not a persistent
   column. Review keeps its own titlebar as game context inside the rail frame.
2. **The room photograph is the product's environment, and nothing hides it.**
   `background_pic.png` ships as `apps/web/public/atmosphere/room.webp` and is painted
   once, fixed, behind the whole application, at its own strength: the reference's
   background measures as the photograph under roughly a 6% paper wash
   (`--room-wash`), and the route column paints no veil of its own. The rail is a
   column of the same room with rules drawn on it — the paper thickens only toward
   its foot, where the quiet line and the imprint sit over the desk. Words never sit
   on a washed-out room: they carry the primary ink tier, and a soft glow behind the
   route head keeps the room's light where the head's words are. Contrast is measured
   against the painted pixels (see §11). This supersedes §11's "do not ship a
   photographic wallpaper" — the mockups were made *on* this image, and separating
   them was what made the built screens read as a different product.
3. **The four reference mockups are the layout authority.** `01-home`, `02-review-start`,
   `03-key-moment` and `04-practice` define the composition of those screens: the route
   head (kicker, serif display line, lede, step trail), the paper panels, the board card
   with its header and footer rows, the right-hand panel column, and the rows of
   icon + label + meta that open. Where this document and the images disagree about
   *composition*, the images win. Where they disagree about *semantics* — what a label
   means, which fact is claimed — the product's own vocabulary and canonical data win.
4. **One authored line-icon set** (`packages/ui/src/icons.tsx`) carries the interface's
   iconography: one 16-unit grid, one stroke weight, no fill. It is not the brand mark and
   not the Move Quality family.

**Removed by the owner, later the same day:** the first-visit Bluebird Passage. There is
no introductory overlay, no `introSeen` flag and no setting to replay it. The bird that
appears in the room photograph is part of the environment image, not an interface motif,
and no interface element draws a bird or a feather. V3 does **not** add a second
environmental bird, flute/oboe still-life, or official provider logos. `room.webp` stays
the shipped photograph.


Explicitly **not** adopted:

- Replacing the brand mark with a bluebird. `packages/ui/assets/brand/`,
  `scripts/sync-brand-assets.mjs`, the favicon, the manifest icons, the Tauri and mobile
  icon sets, the PNG-export cards and the existing Blue Bishop wording all stay as they
  are.
- Glassmorphism. The mockups lay translucent cards over the photograph; the product keeps
  paper panels with a hairline and one soft shadow, and there is no `backdrop-filter`
  anywhere.

If a **Brand Mark V2** task is ever opened, it starts by authoring a master SVG for human
review. Until that review approves it, none of the derivation chain, the icon sets, the
export cards or the identity wording may change.

Implementation state, 2026-09-18:

| Name | State |
| --- | --- |
| Persistent left rail, drawer below 1080px | implemented — `components/app-shell.tsx`, `styles/chrome.css` |
| Seven rail destinations | implemented — `/`, `/import`, `/review`, `/training`, `/history`, `/stats`, `/settings`; each marks itself current, and a review workspace keeps Review marked |
| Route head variants | implemented — `.head-threshold` / `.head-task` / `.head-focus` / `.head-instrument` in `chrome.css`; utility screens no longer share Home's editorial display |
| Room environment + route presence | implemented — `.app-frame::before` with `--room-presence` / `--room-veil` per `data-route` and review `data-mode` |
| Icon set | family implemented; Review focus-dot and Practice recall-arc optically separated from dashboard/undo — `packages/ui/src/icons.tsx` |
| ProviderMark | implemented — original C/L/P/F outline marks in `packages/ui/src/provider-mark.tsx`; used on Home Sources, Import accounts, Review Index, Library, Stats, synced games, Practice profile |
| Typography roles (§6) | implemented — serif for Home and Key Moment questions; sans for instrument pages |
| Home composition (§7.1) | implemented — one `.home-scene`; interactive board; Sources with ProviderMark; Continue as an open ruled list; mobile order head → import → board → sources → continue |
| Import desk composition | implemented — `components/import-page.tsx`; Recent reviews removed; the form itself is shared with Home (`components/import-desk.tsx`) |
| Library / Stats / Review composition | implemented — open archive rows and a Stats score sheet over canonical stored data; no derived number is computed in a component |
| Practice vocabulary | implemented — the rail, the hub's display line and every user-facing label say Practice; `training-*` keeps its module names |
| Review Start, Key Moment, Practice composition (§7.2–§7.4) | implemented — First key moment CTA; desktop titlebar without BrandMark; More is Notebook only; active Practice setup collapses to a summary |

| Tier A and Tier B motion (§8) | implemented — `--motion-micro` / `--motion-mode`, review mode transitions, practice stagger, answer reveal |

| Tier C first-visit passage (§8, §9) | **not adopted** — removed by the owner |
| Surfaces policy (§10) | superseded by §0.3: the mockups' paper panels are the target |
| Brand mark | **unchanged**; Brand Mark V2 is a separate future task |
| Phase D player intelligence (from `FIX.md`) | out of scope for this round |

Previously implemented, and still true:

- §7.4 Practice setup contract — both sides always render with their counts, an empty side
  stays selectable, and selecting a side never starts practice
  (`apps/web/src/lib/practice-setup.ts`, `apps/web/src/components/retro-practice.tsx`).
- §7.2 Review Start primary action — the start ply gives the guided route the one primary
  action and keeps practice secondary (`apps/web/src/components/review-route-panels.tsx`).

---

## 1. Product idea

Open Chess Review should feel like **a quiet chess desk beside a cool window**.

The visual goal is not “anime styling” and not merely “pastel chess”. The design should translate the qualities associated with *Liz and the Blue Bird* into an original chess product language:

- transparency / clear air
- delicacy
- fragility without weakness
- emotional distance
- breathing room
- pale cool/warm contrast
- the feeling of observing through glass
- small changes accumulating over time
- quiet intensity

The product goal remains practical:

> Import a game → understand what mattered → try the position → inspect evidence → keep the lesson → return later and remember it.

The aesthetic must support that sequence rather than compete with it.

---

## 2. Two-system model

### 2.1 Windowlight — static visual system

Windowlight defines what the product looks like:

- color tokens
- surfaces
- typography
- spacing
- borders and rules
- board appearance
- piece appearance
- iconography
- background atmosphere
- illustration/environmental motifs

### 2.2 Bluebird — motion and spatial system

Bluebird defines how the product reveals itself and changes state:

- landing entrance
- scene transitions
- focus shifts
- reveal/hide behavior
- practice-mode transition
- answer reveal
- completion/return states
- scroll choreography on the landing experience

Windowlight must still look complete with motion disabled. Bluebird is enhancement, not a dependency.

---

## 3. Non-negotiable aesthetic rules

### 3.1 What to preserve

- warm ivory paper-like base
- cool blue-gray daylight
- celadon / pale green-blue board tones
- very restrained rose/brass semantic accents
- thin rules and quiet borders
- Feather Porcelain piece language
- large amounts of meaningful negative space
- editorial serif only where narrative value exists
- operational UI primarily in sans-serif

### 3.2 What not to do

Do not add:

- anime characters or direct film imagery
- literal recreation of copyrighted scenes
- mascot-heavy bird treatment
- glassmorphism everywhere
- saturated gradients
- floating particle systems
- confetti / XP / gamification
- springy/bouncy animations
- magnetic cursor effects
- cyber/glitch aesthetics
- decorative cards for every information group
- permanent ambient motion behind the board during analysis

The app must remain a chess instrument first.

---

## 4. Visual motifs

Use motifs sparingly. Their purpose is to create atmosphere, not decoration density.

### 4.1 Window / glass

Primary environmental motif.

Use:

- tall vertical or softly arched window framing
- pale mullion lines
- cold daylight gradients
- barely visible reflected foliage
- occasional soft shadow bands

Avoid obvious glass blur on every panel. “Transparency” should mostly come from air, hierarchy, and lack of heavy containers.

### 4.2 Blue bird

**Not an interface motif.** §0 records the decision: the first-visit passage was removed,
and no interface element draws a bird. The bluebird visible in the product belongs to the
room photograph, which is an environment image, not a symbol. The product's own mark stays
the bishop-and-wing artwork.

### 4.3 Feather

**Not used.** The Feather Porcelain pieces carry the feather language; no interface element
draws one. The room photograph contains a feather, and it is part of the image.

If a divider ornament is ever needed, it is a hairline or a wash — never a feather.

### 4.4 Foliage and blossom shadows

Use as background atmosphere:

- 2–5% visible tonal difference
- soft-edged shadows
- no high-frequency texture behind body text
- fixed or near-static during analysis

### 4.5 White blossoms / glass vase / desk still-life

These belong primarily to:

- landing/home
- completion
- empty states
- promotional screenshots

Do not make every review screen look like a literal room. In the actual application, this should usually reduce to a suggestion of window light and soft foliage rather than fully rendered decor.

---

## 5. Color system

The current Windowlight family remains the base.

Suggested semantic mapping:

```css
--surface-page:       #f8f6ef;
--surface-paper:      #fffef9;
--surface-raised:     #fbf8f1;

--wash-blue:          #e6efee;
--wash-pink:          #f0e7e9;
--wash-sage:          #e8eee4;
--wash-cream:         #f3ecdf;

--ink-primary:        #2d4654;
--ink-secondary:      #546a73;
--ink-muted:          #6f8188;
--ink-faint:          #91a0a5;

--accent-primary:     #54708f;
--accent-hover:       #496783;
--accent-rose:        #82495c;
--accent-brass:       #b7a270;

--board-light:        #eee8d9;
--board-dark:         #b1c6c2;
```

### 5.1 Environmental light layer

Add a separate non-semantic atmosphere layer rather than changing component colors:

```css
--light-cool: rgba(201, 220, 229, 0.20);
--light-warm: rgba(251, 244, 226, 0.20);
/* The one veil the reference keeps over the room photograph, measured from its own
   background: about six percent of paper. */
--room-wash: color-mix(in srgb, var(--surface-page) 6%, transparent);
```

The washes above are the *pre-load* fallback behind the photograph; on the painted
frame the room supplies the light. Functional contrast is measured against the pixels
the browser actually paints — the photograph, the wash and the local glows included —
not against a token pair.

---

## 6. Typography

### 6.1 Narrative layer

Use serif / Mincho selectively for:

- landing hero
- page-level narrative title
- key-moment question
- study/lesson title
- completion reflection
- intentionally quiet empty states

### 6.2 Operational layer

Use sans-serif for:

- navigation
- buttons
- move list
- labels
- engine data
- settings
- filters
- training state
- accessibility-critical status text

### 6.3 Rule

A screen should not become “more literary” simply by adding more serif. Serif marks reflection; sans marks action/instrumentation.

---

## 7. Layout grammar

The current product should stop looking like one page template repeated across routes.

The same design language should allow different scene compositions.

### 7.1 Home — threshold / desk

Reference: `01-home.png`

Purpose:

- establish identity
- make the chessboard the first true product object
- offer import and connected-account entry points
- reveal recent activity without becoming a dashboard

Composition:

- persistent narrow left rail
- large hero copy above board/import area
- board visually dominant
- import column narrower and lighter
- account/recent sections secondary
- environmental light strongest here

Home can contain the richest atmospheric background because cognitive load is low.

### 7.2 Review Start — invitation to review

Reference: `02-review-start.png`

Primary question:

> What should I do next?

Right-side hierarchy:

1. one primary message
2. one primary CTA: first key moment
3. game journey/timeline
4. secondary paths grouped below

Do not present Practice / Moves / Summary / Engine with the same weight as the main CTA.

### 7.3 Key Moment — one decision at a time

Reference: `03-key-moment.png`

Primary question:

> Why did this move matter, and should I try the position myself?

Right-side hierarchy:

1. THE MOMENT label
2. key question
3. concise explanation
4. quiet verdict/evidence summary
5. Try it yourself
6. collapsed secondary evidence rows
7. next key moment

The more important the moment, the fewer competing controls should surround it.

### 7.4 Practice — cognitive mode change

Reference: `04-practice.png`

Practice is not “another accordion on Review”. It is a distinct cognitive mode.

Primary question:

> What would I play here?

During active practice:

- board dominates
- answer-revealing engine surfaces are hidden or folded
- side-to-move is unmistakable
- one primary action is present
- hint and show-answer are clearly secondary
- practice setup remains visible but visually quieter

#### Practice setup contract

The White/Black selector must remain visible after selection.

A valid structure:

```text
Practice setup
Play as     [ White (3) | Black (2) ]
Order       In game order
Feedback    On
...
```

The user must always know:

- selected side
- available position count
- how to change side
- what options affect the session

Never replace the selector with plain status text after selection.

---

## 8. Motion design — required, but restrained

Motion is recommended because the new art direction depends on **small spatial changes**, but motion must never be required to understand the interface.

Use three tiers only.

### Tier A — micro-interactions

Duration: `120–180ms`

Used for:

- hover/focus color transitions
- selected segmented control
- disclosure indicator rotation
- subtle wash appearance
- divider emphasis

Allowed properties:

- opacity
- color
- background-color
- border-color
- transform up to 2px

Avoid scaling controls on hover.

### Tier B — cognitive mode transitions

Duration: `180–320ms`

Used for:

- Review Start → Key Moment
- Key Moment → Practice
- answer reveal
- panel focus changes

Pattern:

1. secondary information fades to 55–70%
2. current task moves by no more than 4–8px
3. new content becomes clear
4. board position updates last or concurrently without bounce

Example Practice entrance:

```text
0ms      secondary review tools begin fading
80ms     practice heading appears
120ms    engine/evidence controls collapse
180ms    board interaction becomes active
240ms    "Your turn" reaches full opacity
```

No full-screen wipe is needed in core Review.

### Tier C — first-visit passage

**Not adopted.** The owner removed it after seeing it built; §0 records the decision.
There is no introductory overlay, no scroll-driven reveal, no `introSeen` flag and no
setting to replay one. Tier B remains the longest motion in the product.

Whether the landing page should greet a first-time visitor at all is a product question,
not a motion question, and it is not answered here.

### 8.1 Reduced motion

With `prefers-reduced-motion: reduce`:

- no scroll-linked or decorative movement runs at all
- the final composition is revealed immediately, or with a simple opacity change of at
  most 100ms
- every state change and focus behaviour is retained

---

## 9. Ambient motion policy

Do **not** keep decorative objects moving while the user is analyzing a game.

Production rules:

- The room photograph is static. It never animates, parallaxes or drifts.
- Home: no ambient movement.
- Review: no ambient movement; the only motion is the Tier B mode change.
- Key Moment and Practice: no decorative animation of any kind.
- Empty, loading and completion states: a one-shot opacity or colour change at most.

The reference images contain more environmental motifs than production should use — they
are composition references, not pixel mandates. What the product takes from them is the
arrangement: head, board card, panel column, rows of icon and label.

---

## 10. Surfaces and card policy

Prefer separation in this order:

1. whitespace
2. alignment
3. typography
4. thin rule
5. subtle surface wash
6. card only when interaction/data grouping genuinely benefits

Recommended surface types:

### Open surface
No border; use for narrative copy and page-level context.

### Instrument surface
Very subtle border and paper fill; use for board, engine, practice controls.

### Focus surface
Slightly stronger border/wash; use only for current cognitive task.

Avoid nested card-inside-card stacks.

---

## 11. Background implementation strategy

Superseded by §0.2. The environment is the room photograph the mockups were composed on,
shipped once as a compressed WebP and painted fixed behind the application:

```text
.app-frame::before      the room, fixed, cover, never animated, + --room-wash (6%)
.app-content            no surface of its own — the room is the page
.app-rail               the room again, paper thickening toward the foot (46% → 86%)
.page-head              a soft paper glow behind the head's words (radial, 88% → 0)
.paper-panel            paper at 88% with one hairline and one soft shadow
body                    the paper and the two light washes: the pre-load fallback
```

Measured from the reference (1586×992): the rail ends 11.5% into the window; the content
column starts 7% past the rail, is 67.7% wide, and leaves the room open on the right
rather than centring; the board keeps a 38px margin inside its card. Those numbers live in
`tokens.css` (`--rail-width`) and the `.page-head` / `.home-stage` rules.

Rules:

- **One photograph, one place.** It is not a per-screen asset, not a hero image and not a
  second background. A new screen uses the frame it already has.
- **The room is never the only thing holding a word up.** Text on the room carries the
  primary ink tier; the muted and secondary tiers belong to words that sit on paper. The
  rail thickens its paper toward its foot and the head carries its own glow, so a 10px
  kicker or a 13px rail label stays legible wherever the composition puts it.
- **Contrast is measured, not assumed.** `e2e/room-contrast.spec.ts` hides every glyph,
  screenshots the page, and checks each room-sitting element against the darkest
  background sample behind its own line boxes: the kicker, lede, step trail, rail labels,
  quote and imprint all clear 4.5:1, and the display line clears 3:1 as large text.
- **It never moves.** No parallax, no drift, no scroll-linked offset, and no
  `background-attachment: fixed` on a scrolling element — the layer is a fixed element.
- **It stays small.** The shipped file is a compressed WebP under 100 KB at the
  reference's own resolution; `docs/design/references/` keeps the original PNG as the
  design record and is never served.

Target composition should survive on:

- the room WebP
- the paper veil and the paper panels
- current board/piece assets
- the authored icon set

---

## 12. Asset inventory

```text
apps/web/public/atmosphere/
  room.webp                   # the environment, compressed from background_pic.png

packages/ui/src/
  icons.tsx                   # the interface's line-icon set
```

Rules for this inventory:

- The brand mark is unchanged. `packages/ui/assets/brand/` and everything
  `scripts/sync-brand-assets.mjs` derives from it stay as they are; do not add a bird
  there, and do not touch the favicon, manifest, Tauri or mobile icons, or the PNG-export
  cards.
- `room.webp` is the only image the application environment loads. It is derived from
  `docs/design/references/windowlight-bluebird-v2/background_pic.png`; the PNG itself stays
  a design record in `docs/`, is never served and never bundled.
- No `feather-01.svg`, no `bluebird-passage.svg`, no `window-light-mask.svg`: the passage
  is gone (§0) and the light is a CSS layer, not a file.
- Icons are drawn, not imported. A new interface icon is added to `icons.tsx` on the same
  16-unit grid; the product does not take an icon font or a third-party icon set.

---

## 13. Repository integration guidance

Likely implementation surfaces to inspect before editing:

- `FIX.md` — local maintainer/current remediation context; read first if present
- `AGENTS.md`
- `docs/design/windowlight-contract.md`
- `apps/web/src/app/styles/tokens.css`
- `apps/web/src/app/styles/review-shell.css`
- `apps/web/src/app/styles/review-workspace.css`
- Home workspace component/styles
- Review start/key-moment components
- Practice components/styles
- current visual acceptance skill/tests

Historical audits marked superseded should not override `FIX.md` or current implementation.

---

## 14. Responsive design

### Desktop >= 1280

- left rail persistent
- board + context composition
- atmospheric background may appear at page edges
- keep board dominant

### Tablet / small laptop

- reduce environmental illustration first, not board size first
- simplify right-side decoration
- keep context panel functional

### Mobile <= 640

- remove literal room/still-life decoration
- retain only color, light wash, thin rules, typography, and possibly one tiny brand motif
- board first
- Practice selector must remain easy to change
- landing Bluebird Passage should be shorter or skipped

The aesthetic must not depend on desktop-only decoration.

---

## 15. Accessibility

Requirements:

- functional text >= WCAG AA contrast
- selected state cannot rely only on color
- visible focus rings
- 44px touch targets where appropriate
- keyboard-reachable practice selector
- `aria-live` for analysis/practice result updates where necessary
- no focus movement caused by decorative transitions
- no content hidden exclusively behind hover
- 200% zoom acceptance
- full reduced-motion path

Background imagery must never lower text contrast.

---

## 16. Performance budgets

Do not trade local-first responsiveness for atmosphere.

Targets:

- core functional UI should render before decorative assets
- no layout shift when atmosphere loads
- image assets appropriately compressed
- no long-running requestAnimationFrame loops after landing intro settles
- scroll-linked animation should only run while landing scene is visible
- suspend observers/animation when tab is hidden

Use transforms/opacity for motion; avoid animating layout dimensions continuously.

---

## 17. Acceptance checklist

### Home

- feels recognizably Open Chess Review before reading text
- chessboard remains first-class, not decorative
- atmosphere is present but does not reduce import clarity
- the form still reaches the first screen at 320×740

### Review Start

- within 2 seconds the user knows the primary next action
- no equal-weight competition between first key moment and secondary tools

### Key Moment

- user can answer “what happened?” and “what should I do next?” without opening multiple panels
- evidence remains available but secondary

### Practice

- entering practice visibly changes cognitive mode
- answer-leaking information is hidden/folded
- White/Black selector remains reversible and visible
- no decorative motion competes with board calculation

### Visual

- not generic SaaS
- not anime-themed
- not Project Kylin recolored
- no card soup
- no excessive blue-bird motifs
- strong sense of cool daylight, air, distance and quietness

---

## 18. Implementation phases

### Phase A — design contract

1. add this design spec to the repository
2. link it from the current Windowlight contract / relevant agent instructions
3. add the four reference screenshots
4. mark them explicitly as design references, not pixel-perfect golden files

### Phase B — static Windowlight V2

1. add atmosphere tokens
2. refine Home composition
3. refine Review Start hierarchy
4. refine Key Moment hierarchy
5. redesign Practice selector/setup
6. keep all motion disabled while validating static design

### Phase C — core Bluebird transitions

1. micro-interaction timings
2. Review → Key Moment transition
3. Key Moment → Practice transition
4. answer reveal behavior
5. reduced-motion tests

### Phase D — first-visit passage (withdrawn)

The owner withdrew this phase after seeing it built: there is no introductory overlay.
Tier B is the longest motion the product uses, and the environment is the room photograph
(§0.2, §11) rather than a scroll-driven scene.

---

## 19. Reference-image policy for coding agents

The four images in `references/` should be given to Codex/Claude together with this document.

They are useful because text alone cannot reliably communicate:

- proportion
- negative space
- panel weight
- window-light intensity
- relationship between environment and functional UI
- board dominance
- serif/sans balance
- how restrained the blue-bird motif should feel

However, agents must be instructed:

> Follow the composition: the head, the board card, the panel column and the rows. Do not
> trace pixels, and never let the images decide a product fact. Preserve current product
> semantics, accessibility, responsive behaviour and real data flows.

Do not put the PNGs in `public/` or ship them in the app bundle. `background_pic.png` is
the exception in form only: its compressed WebP derivative is served as the environment
(§11), while the PNG itself stays in `docs/`.

Recommended repository location:

```text
docs/design/references/windowlight-bluebird-v2/
  01-home.png
  02-review-start.png
  03-key-moment.png
  04-practice.png
```

---

## 20. Final design test

When uncertain about a UI decision, ask:

> Does this make the chess position easier to notice, understand, try, and remember — while preserving the feeling of a quiet desk beside a cool window?

If the answer is only “it looks more cinematic,” reject the change.
