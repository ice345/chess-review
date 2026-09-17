Status: Historical
Baseline: `master @ 6c45c12` · 2026-09-14
Superseded by: [FIX.md](../FIX.md)
Do not use as the current product contract.

# Open Chess Review — Final Product Refinement Audit & Roadmap

**Date:** 2026-09-14  
**Repository:** `https://github.com/ice345/chess-review`  
**Repository baseline reviewed:** `master @ 6c45c12013f22d1289fb07c4c7aca7f229d6a182`  
**Local art state reviewed:** Feather Porcelain v1.1 K/Q/B assets generated and normalized to production-ready 512×512 PNGs, but not yet committed to `master`.  
**Purpose:** Define the final, practical improvement plan after Windowlight, after the UI/UX/layout audit, and after the K/Q/B recognition refinement.

---

# 0. Executive summary

The project is no longer in a “redesign the theme” phase.

The current repository already has a coherent and technically mature base:

- Windowlight production palette and token system;
- shared Web/mobile board appearance;
- Feather Porcelain as the default Web piece family;
- Classic SVG fallback;
- PNG export and promotion using the same authored piece contract;
- Stockfish / Maia / Coach separation;
- critical moments, Accuracy, classifications, opening recognition, evaluation graph;
- in-place mistake practice;
- multi-game Training / Study;
- Notebook;
- Chess.com and Lichess sync;
- local-first IndexedDB, backup and offline shell;
- visual fixtures;
- 12-route × 7-viewport UI/UX/layout audit already performed.

The biggest visual problem discovered after that audit was **piece-role recognition**, especially King / Queen / Bishop. That problem has now been addressed in the new Feather Porcelain v1.1 art candidates:

```text
King   → strong axial cross
Queen  → broad radial crown
Bishop → clear diagonal mitre slit
```

Therefore the next work should not be another broad CSS pass.

The final optimization direction is:

```text
1. Integrate Feather Porcelain v1.1 safely
2. Prove recognition and rendering in real board states
3. Improve board ergonomics like mature analysis platforms
4. Make Review feel more guided without hiding Self Analysis
5. Improve shortcut/settings discoverability
6. Add Opening Explorer only as a deliberate study feature
7. Add Syzygy/tablebase later as a correctness feature
8. Finish remaining low-severity accessibility/layout issues
9. Complete mobile piece parity
10. Run real-device / production acceptance
```

The central product principle should remain:

> **The board is the primary workspace.  
> Review guides the learner.  
> Engine allows free exploration.  
> Study/Training turns one-game insight into long-term learning.**

And the visual principle remains:

> **The pieces carry the feather.  
> The Blue Bishop carries the symbol.  
> The UI carries the air.**

---

# 1. What is already good and should be frozen

Before adding anything, several areas should now be treated as **locked unless a regression proves otherwise**.

## 1.1 Windowlight theme — LOCK

Current production tokens:

```text
Page          #f8f6ef
Paper         #fffef9
Raised paper  #fbf8f1
Ink           #2d4654
Secondary     #566e78

Board light   #eee8d9
Board dark    #b1c6c2
```

The repository already centralized board appearance in:

```text
packages/ui/src/board-appearance.ts
WINDOWLIGHT_BOARD_APPEARANCE
```

This is correct architecture.

Do not:

- create another Liz-specific theme;
- add a second theme provider;
- return to the old board colors;
- add literal film art;
- add blue-bird wallpaper;
- add feather watermarks to playable squares;
- alter semantic Stockfish/Maia/Move Quality colors merely for aesthetics.

### Why

The board itself is not the cause of the earlier K/Q/B recognition problem. The same recognition problem appeared on both square colors. The new K/Q/B silhouette fixes the correct layer.

---

## 1.2 Rook / Knight / Pawn art — LOCK

The current R/N/P are already successful:

### Rook
Strong battlement silhouette; role survives downscaling.

### Knight
The signature piece of the set. Horse head is immediate; feather mane supplies the art direction without weakening chess identity.

### Pawn
Simple and restrained. Sphere remains a universal pawn anchor and gives the full set visual breathing room.

Do not regenerate these pieces while integrating v1.1.

---

## 1.3 Blue Bishop identity — LOCK

The Blue Bishop mark should remain the only symbolic brand mark.

Do not replace it with a literal bird icon.

Do not make the site “more Liz” by adding movie-adjacent iconography.

The current identity is stronger because it is its own product.

---

## 1.4 Objective / Human / Coach semantic separation — LOCK

The README correctly defines:

```text
Stockfish → objective chess truth
Maia      → Elo-conditioned human move prediction
Coach     → grounded language explanation
```

Do not collapse these into one AI score.

This separation is a meaningful product differentiator from generic “AI chess coach” tools.

---

# 2. Mature-platform benchmark: what to learn, what not to copy

The goal is not to clone Chess.com or Lichess visually. The useful comparison is **interaction maturity**.

## 2.1 Chess.com patterns worth learning from

Current Chess.com Game Review and Analysis expose several proven ideas:

- a **guided Review** flow focused on important moments;
- “Retry” to solve a bad move before revealing the answer;
- explicit “Best / Show Moves” progressive disclosure;
- Self Analysis as a distinct exploratory mode;
- the ability to show only **Key Moves** rather than coloring every move;
- user controls for suggestion arrows, threat arrows, evaluation display and interface behavior;
- desktop board resizing;
- Focus Mode and Theatre Mode;
- board/piece customization;
- Opening/Game Explorer linked to the current board position.

Sources:

- `https://support.chess.com/en/articles/8584089-how-does-game-review-work`
- `https://support.chess.com/en/articles/8583757-how-do-i-use-game-analysis`
- `https://support.chess.com/en/articles/8648715-how-do-i-change-what-kinds-of-moves-are-highlighted-in-analysis`
- `https://support.chess.com/en/articles/8609533-how-do-i-change-my-board-size`
- `https://support.chess.com/en/articles/8594320-how-do-i-change-my-background-board-and-pieces`
- `https://support.chess.com/en/articles/8708732-how-do-i-use-the-game-explorer`
- `https://support.chess.com/en/articles/8708949-how-can-i-view-the-tablebase-on-chess-com`

### What Open Chess Review should borrow

Borrow:

- board-first ergonomics;
- focus/resize;
- guided vs free-analysis distinction;
- progressive answer reveal;
- key-move filtering;
- discoverable analysis preferences.

Do not borrow:

- gamified visual overload;
- green-button-heavy consumer styling;
- coach avatar dependency;
- premium gating patterns;
- excessive animation;
- theme marketplace complexity.

---

## 2.2 Lichess patterns worth learning from

Lichess Analysis is strong because it treats the board as a serious work surface:

- board resize handle / board geometry controls;
- Zen/focus behavior;
- rich keyboard navigation;
- arrows and circles;
- local engine toggle;
- threat display;
- Opening Explorer;
- compact settings;
- fast move navigation;
- analysis functionality remains usable without decorative guidance.

Current Lichess shortcut discussions/documentation also show how analysis power users expect:

```text
← / → or J/K
start/end navigation
F → flip board
A → arrows
L → local evaluation
X → threat
E → explorer
? → shortcut help
```

Sources:

- `https://lichess.org/analysis`
- `https://lichess.org/forum/lichess-feedback/keyboard-shortcuts`
- `https://lichess.org/forum/general-chess-discussion/shortcut-and-commands-when-using-analysis-board`
- `https://lichess.org/forum/lichess-feedback/board-is-smaller-and-interface-is-laggy`

### What Open Chess Review should borrow

Borrow:

- keyboard efficiency;
- shortcut discoverability;
- board resize/focus;
- minimal interruption during free analysis;
- strong explorer integration.

Do not borrow:

- every shortcut;
- every analysis-board feature at once;
- Lichess-specific information architecture.

---

# 3. Current repository status

Latest reviewed commit:

```text
6c45c12
docs: record the Windowlight pass, its follow-ups and the UI audit
```

Immediately before it:

```text
dcc3d58
feat(mobile): share the Windowlight board appearance and tokens

575c0ab
feat(web): draw the authored pieces in PNG export and promotion

e9b9abb
feat(web): converge the UI on the Windowlight theme
```

Important current facts:

### Web piece renderer

```text
apps/web/src/lib/board-pieces.tsx
```

Uses the canonical piece asset directory with `width/height: 100%`.

### Piece identity

```text
apps/web/src/lib/board-piece-assets.ts
```

Current directory:

```text
/pieces/liz_blue_chess_pieces_512
```

### Service worker

```text
apps/web/public/sw.js
CACHE_VERSION = "v2"
```

`/pieces/` is cache-first.

### Piece fixture

```text
/design/pieces
```

Already verifies:

- 12 pieces;
- 32 / 40 / 56 / 72 px;
- light/dark square;
- move hints;
- Stockfish arrows;
- Maia arrows;
- Move Quality badge;
- flipped board.

### Existing UI/UX audit

Already tested 12 routes × 7 viewports, 84 combinations.

Open low-severity findings:

```text
F6 checkbox hit targets
F7 small action/inline links
F8 orphaned Practice CTA alignment
```

Do not repeat the entire Windowlight audit again.

---

# 4. P0 — Integrate Feather Porcelain v1.1 correctly

This is the first task.

The new six production-normalized assets are:

```text
wB.png
bB.png
wQ.png
bQ.png
wK.png
bK.png
```

They are already normalized to:

```text
512×512
RGBA
transparent
sRGB
shared baseline
production visual hierarchy
```

The existing locked assets remain:

```text
wP.png bP.png
wN.png bN.png
wR.png bR.png
```

---

## 4.1 Use a versioned asset directory

Recommended:

```text
apps/web/public/pieces/feather_porcelain_v1_1/
```

Put all 12 final pieces there.

Then update:

```ts
export const PIECE_ASSET_DIR = "/pieces/feather_porcelain_v1_1";
```

### Why version the path

The service worker caches `/pieces/` cache-first.

If the same URL is overwritten, old users may continue to see v1.0 K/Q/B.

A versioned directory gives:

- no stale-asset collision;
- simple rollback;
- easy screenshot debugging;
- explicit visual version identity;
- no need to flush unrelated engine/sound cache.

### Alternative

If the old directory is overwritten instead:

```text
/pieces/liz_blue_chess_pieces_512/
```

then:

```js
CACHE_VERSION = "v3";
```

must be bumped.

Versioned directory is preferred.

---

## 4.2 Keep the stored setting id

Do not migrate:

```text
pieceSet = "liz-blue"
```

The id is already persisted and used by Settings.

Only the asset path changes.

User-facing name remains:

```text
Feather Porcelain
```

No settings migration is required.

---

# 5. P0 — Upgrade `/design/pieces` from rendering fixture to recognition fixture

The current fixture proves that assets load. It does not fully prove that users can identify the piece roles.

Add a second layer of testing.

## 5.1 Keep the current matrix

Keep:

```text
12 pieces × 32/40/56/72px × light/dark
```

It remains the main technical regression fixture.

---

## 5.2 Add “Blind position”

Create a fixed position with K/Q/B away from starting squares.

Example:

```text
black Queen  b5
black Bishop f4
black King   h6

white Bishop c3
white King   e5
white Queen  g2
```

Do not label the individual pieces around the board.

Put the answer under a collapsed:

```html
<details>
  <summary>Reveal roles</summary>
</details>
```

### Purpose

This removes starting-position context.

A piece passes only if the user can recognize it from shape.

---

## 5.3 Add silhouette mode

Render the same pieces with:

```css
filter: brightness(0) saturate(0);
```

The purpose is not aesthetic.

It tests whether:

```text
role identity = silhouette
```

rather than:

```text
role identity = blue internal shading
```

Acceptance:

```text
King   cross still unmistakable
Queen  crown still broad
Bishop diagonal mitre still readable
```

---

## 5.4 Add distance / blur stress test

Add:

```css
filter: blur(1px);
```

or render a dedicated row at:

```text
32
40
48
56
72
```

This is a diagnostic only.

If R/N/P remain obvious but K/Q/B merge, the art is still not ready.

---

## 5.5 Add Classic comparison

Show the exact same role at the same pixel size:

```text
Feather Porcelain | Classic SVG
```

Not as an aesthetic contest.

Compare:

- silhouette;
- top mass;
- negative space;
- small-size role recognition.

Classic is a benchmark, not a visual template to copy.

---

# 6. P1 — Board ergonomics: the highest-value UX improvement after pieces

The current board looks good. The next improvement is **how it behaves as a workspace**.

Mature platforms treat board size and focus as user-controlled.

Open Chess Review should do the same, but with a smaller feature set.

---

## 6.1 Add desktop board resize

### Problem

Current Review board sizing is responsive but effectively decided by layout CSS.

For analysis, different users want:

- bigger board;
- more context panel;
- different laptop aspect ratios;
- projector/teaching layouts.

Chess.com and Lichess both expose board resizing.

### Recommendation

Desktop only:

- drag handle at lower-right board corner; OR
- simple Board Size slider in an adjacent board controls menu.

Do not add both initially.

### Recommended implementation

Use a CSS custom property:

```css
--review-board-size: ...
```

Store preferred ratio/size in local settings.

Bound it:

```text
min = layout-safe minimum
max = viewport-safe maximum
```

Never let manual resize cause horizontal overflow.

### Breakpoints

Disable the drag handle on phone/tablet portrait.

Responsive sizing remains automatic there.

---

## 6.2 Add Focus Board mode

This is higher value than adding more decorative features.

### Behavior

A Focus button should:

- maximize board within viewport;
- keep player strips;
- keep eval bar;
- keep basic move transport;
- collapse/hide right context panel;
- keep an obvious “Exit focus” affordance.

Do not duplicate Chess.com Theatre + Focus + Lichess Zen as three modes.

Open Chess Review needs one mode:

```text
Focus Board
```

### Suggested shortcut

```text
Z
```

or:

```text
Shift+F
```

Avoid conflicting with `F = Flip Board`.

---

## 6.3 Persist board preference

Persist:

```text
board size
focus preference? → no, session-only
```

Focus should normally be session-only.

Board size can persist.

---

# 7. P1 — Keyboard shortcuts and discoverability

Current Review implements at least:

- Left Arrow;
- Right Arrow;
- Escape from branch.

That is too hidden and too limited for a serious analysis workspace.

## 7.1 Add a deliberate shortcut map

Recommended minimum:

```text
← / J   previous move
→ / K   next move
↑       first move
↓       last move
F       flip board
Space   play/pause
Esc     leave branch / close transient state
?       shortcut help
```

Optional later:

```text
A       toggle analysis arrows
```

Do not implement 20 shortcuts immediately.

---

## 7.2 Add `?` shortcut help overlay

This is important.

Power features are useless if undiscoverable.

Overlay should show:

```text
Navigation
Board
Analysis
Drawing
Practice
```

and only shortcuts that actually exist.

Also expose it from a small:

```text
Keyboard shortcuts
```

item in Help or board menu.

---

## 7.3 Do not steal keyboard input

Continue current good behavior:

Ignore shortcuts when focus is inside:

```text
input
textarea
select
button
a
contenteditable
slider
```

Also make promotion chooser and modal states explicit.

---

# 8. P1 — Clarify Guided Review vs Self Analysis

This is the most important product/IA refinement.

Chess.com succeeds because users understand:

```text
Game Review = guided
Analysis    = explore freely
```

Open Chess Review already has the conceptual pieces:

```text
Review → objective/key moments
Moves  → complete decision history
Study  → teaching / whole-game learning
Engine → advanced free analysis
```

The architecture is good.

The remaining improvement is to make this mental model obvious.

---

## 8.1 Review should be explicitly guided

At review start:

```text
Start with a key moment
```

already exists.

Build on it.

Add a lightweight review progress concept:

```text
Moment 1 of 5
← Previous key moment
Next key moment →
```

Do not create a wizard that locks users in.

The user must still be able to click any move.

### Benefit

The user no longer asks:

> “I opened Review. What am I supposed to do?”

---

## 8.2 Add key-moment navigation

There is already:

```text
criticalMoments
```

and Review Overview displays the first three.

Add reusable:

```ts
previousCriticalPly
nextCriticalPly
```

to the review runtime.

Expose them near the current review explanation, not as giant buttons.

---

## 8.3 Link Guided Review → Retry

The product already has in-place Mistake Practice.

Use that strength.

For a mistake/blunder critical moment:

```text
Try again
```

should be the natural primary learning action.

Flow:

```text
critical moment
↓
why it mattered
↓
Try again
↓
user plays move
↓
correct / alternative / hint
↓
show engine continuation
↓
next key moment
```

This is similar to the strongest part of Chess.com Game Review but stays grounded in your deterministic/Stockfish architecture.

---

## 8.4 Progressive answer reveal

Do not immediately expose every answer when the user wants to learn.

For critical mistakes:

```text
Try again
Hint
Reveal
Show line
```

The repository already distinguishes:

```text
solved
hinted
revealed
skipped
```

Use those states consistently.

---

# 9. P1 — Improve move-list scanning

Open Chess Review already has a stronger base than many tools:

```text
all
critical
errors
```

filter logic exists in `ReviewMoves`.

This is good.

## 9.1 Make the filter an explicit compact control

Do not hide it in route state or secondary affordances.

Recommended:

```text
All | Key | Errors
```

Use `Key` as user-facing copy even if internal value is `critical`.

Why:

- less engine jargon;
- closer to user intent;
- aligns with mature analysis systems.

---

## 9.2 Preserve full information but reduce simultaneous color

Chess.com allows “All Moves” vs “Key Moves” strength coloring.

Open Chess Review should consider a setting:

```text
Move annotations:
• Key moves only
• All analyzed moves
```

Default:

```text
Key moves only
```

for a calmer visual hierarchy.

This setting should affect emphasis, not delete data.

---

# 10. P1 — Board feedback settings

Current Settings only exposes:

```text
Piece set
Sound effects
Volume
Sound theme
```

A mature analysis tool should expose a few board-feedback preferences.

Do not build a giant customization system.

Add only high-value controls:

```text
Coordinates:
• Inside
• Off

Analysis arrows:
[on/off]

Move Quality badge on board:
[on/off]

Piece animation:
• Off
• Fast
• Natural
```

Potential later:

```text
Legal move hints
```

### Why

Chess.com exposes board-feedback controls and Lichess gives power users control over analysis overlays.

Open Chess Review should support the same principle while preserving a curated visual identity.

---

# 11. P1 — Piece animation

The new porcelain pieces will benefit from subtle motion, but not decorative animation.

Recommended:

```text
Natural: 120–160 ms
Fast:     70–100 ms
Off:      0 ms
```

Do not add:

- bounce;
- spring;
- glow;
- arcade effects.

Windowlight motion should remain almost invisible.

---

# 12. P2 — Opening Explorer

This is the largest obvious feature gap compared with mature analysis platforms.

The repo itself already documents Opening Explorer as unimplemented.

Open Chess Review already has:

```text
packages/openings
```

for opening recognition, but that is not a position-frequency explorer.

## Why Explorer matters

Current opening identification answers:

> “What opening is this?”

Explorer answers:

> “What do strong players actually play from here?”

These are different learning tools.

Chess.com and Lichess both integrate explorer behavior tightly with the board.

---

## 12.1 Do not put Explorer on Review by default

Avoid adding another permanent panel to already dense Review.

Best location:

```text
Engine
```

as an optional tab/panel:

```text
Engine | Explorer
```

or:

```text
More → Explorer
```

But the stronger information architecture is:

```text
Engine Lab
├── Evaluation
├── Explorer
└── later Tablebase
```

because all three are “position investigation”, not guided review.

---

## 12.2 Explorer MVP

Start small.

For current FEN:

- move SAN;
- games count;
- percentage;
- White/Draw/Black score;
- optionally master-game filter.

Do not start with:

- giant database UI;
- player search;
- every rating/time control;
- cloud account dependence.

---

## 12.3 Data source and privacy

Prefer a public/open data source compatible with the project’s open-source posture.

Cache position queries.

Explicitly document whether FEN is sent to a remote explorer endpoint.

This product is privacy-conscious; do not silently introduce a network call.

---

# 13. P2 — Syzygy tablebase as a correctness enhancement

At the time of this audit the docs stated that no Syzygy lookup existed, that
positions of seven or fewer pieces still used Stockfish search, and that they must
not be described as tablebase-proven.

That honesty was good. Phase 5 of this audit then shipped the Engine Lab lookup, so
the current statement lives in
[docs/analysis-spec.md](analysis-spec.md#tablebase-boundary): the lookup exists and it
is still not classification proof.

Chess.com automatically provides Tablebase behavior in eligible positions.

Open Chess Review should eventually add it because this is **correctness**, not just feature parity.

---

## 13.1 Do not fake tablebase from engine eval

Keep current rule until integration is real.

Never translate:

```text
+8.2
```

into:

```text
theoretical win
```

without tablebase evidence.

---

## 13.2 Integration priority

After Explorer, not before release-critical UX.

Suggested behavior at <=7 pieces:

```text
Engine Lab:
Tablebase
W/D/L
DTZ / relevant conversion data
legal moves grouped by result
```

Then Study metrics can explicitly distinguish:

```text
engine-inferred conversion
tablebase-proven conversion
```

---

# 14. P2 — Focus the Home page on three user intents

Current Home is already structurally good:

```text
headline
import
preview board
connected accounts
recent games
recent reviews
```

Do not redesign it.

But optimize the user-intent hierarchy.

## Intent A — Review a new game

Primary:

```text
PGN / file / FEN
Analyze
```

Already correct.

## Intent B — Continue where I left off

Current:

```text
Continue last review
```

Good.

Make sure it remains visible when recent data exists.

## Intent C — Analyze a connected recent game

Connected account sync is powerful but visually secondary.

Keep it below import.

Do not let account integrations compete with the main CTA.

---

# 15. P2 — History / library search and filtering

As the user’s local library grows, History becomes increasingly important.

Mature products make archives navigable.

If History does not already expose enough filtering, add:

```text
Search:
player / event / title

Filter:
Chess.com
Lichess
Imported PGN
FEN

Status:
Reviewed
Not analyzed
Training queued

Sort:
Recent
Oldest
```

Do not make this a database-admin UI.

A single search box + compact filter disclosure is enough.

---

# 16. P2 — Training should close the learning loop

Open Chess Review’s distinctive advantage is not just reviewing one game.

It already builds:

- recurring weaknesses;
- opening repertoire;
- trends;
- training queue.

The final product should make this loop explicit:

```text
Game Review
    ↓
Key mistake
    ↓
Retry / practice
    ↓
Save training position
    ↓
Training
    ↓
Weakness trend changes over future games
```

## Recommendation

At the end of a guided review, show a small completion summary:

```text
Review complete

3 key moments reviewed
2 positions solved
1 position added to Training

Continue:
[Study game] [Open Training] [Next recent game]
```

This gives the product a stronger end state.

---

# 17. P2 — End-of-review state

Currently analysis tools often have no “done”.

That weakens learning.

Add an end state when the user has navigated all critical moments or manually selects:

```text
Finish review
```

The completion state should show:

- most important mistake;
- best moment;
- one sentence game lesson;
- training count;
- Study link.

Do not generate new unsupported AI claims.

Use existing canonical facts.

---

# 18. P2 — Evaluation graph usability

The graph is already synchronized with board positions.

Keep that.

Potential improvements:

- current move marker should remain strongest;
- critical moments slightly stronger;
- clicking graph remains direct navigation;
- hover/touch should expose move number + score + classification;
- on phones, avoid requiring precise tiny targets.

Do not add more graph series unless a clear learning question requires them.

---

# 19. P2 — Analysis source clarity

The project’s Stockfish / Maia / Compare modes are a major differentiator.

Make the distinction continuously legible.

Recommended UI copy:

```text
Stockfish — Best chess
Maia — Likely human move at ~1500
Compare — Objective vs human tendency
```

Not necessarily all the time; a tooltip or mode explanation is enough.

Never let a Maia probability look like an objective engine score.

Never let Coach prose look like a new engine evaluation.

---

# 20. P2 — More menu / route labeling

Current route hierarchy:

```text
Review
Moves
Study
More
  Notebook
  Engine
```

This is acceptable.

Keep `More` collapsed by default.

Do not force:

```tsx
open={moreOpen}
```

Potential micro-improvement only if testing shows confusion:

```text
More · Engine
```

or an active dot.

Do not solve an unobserved problem.

---

# 21. P3 — Mobile piece parity

Current mobile already uses shared Windowlight board appearance, but still uses react-chessboard SVG pieces.

Once v1.1 is accepted, solve asset parity properly.

## Recommended canonical asset design

One source directory:

```text
packages/ui/assets/pieces/feather-porcelain-v1.1/
```

Build sync script:

```text
scripts/sync-piece-assets.mjs
```

Copies to:

```text
apps/web/public/pieces/feather_porcelain_v1_1/
apps/mobile/public/pieces/feather_porcelain_v1_1/
```

CI validates:

- exactly 12 files;
- 512×512;
- alpha;
- checksums;
- no missing piece;
- both build outputs contain assets.

Do not use a Git symlink that may create Windows/Tauri friction.

---

# 22. P3 — Remaining UI/UX audit items

These are lower priority than piece integration and board ergonomics, but should be closed.

## F6 — checkbox hit areas

Do not visually make every checkbox 44px.

Instead:

```css
.setting-row {
  min-height: 44px;
  display: flex;
  align-items: center;
}
```

The label row becomes the touch target.

Visual box remains small.

---

## F7 — small links

Classify links.

### Inline prose link
May remain inline.

### UI action link
Examples:

```text
Manage accounts
View history
Help navigation
```

Give:

```css
display: inline-flex;
min-height: 40px;
align-items: center;
```

or equivalent padding.

---

## F8 — orphan Practice CTA

When there are no positions / selector hidden, do not leave a disabled primary button alone at far right.

Use state-specific layout:

```text
empty → CTA aligns with explanation
ready → CTA aligns with controls
```

Do not rewrite the whole Practice strip.

---

# 23. P3 — Accessibility and zoom acceptance

The previous viewport audit used fixed Chromium dimensions.

Add real browser zoom tests:

```text
100%
125%
150%
200%
```

At minimum on Review.

Check:

- board still usable;
- context panel not clipped;
- titlebar controls reachable;
- promotion chooser;
- focus mode;
- shortcut modal;
- no horizontal overflow.

Also test browser text scaling where available.

---

# 24. P3 — Performance after new PNG pieces

Feather Porcelain PNGs are heavier than SVG.

This is acceptable, but verify.

## Check

- first Home board load;
- first Review load;
- decode time;
- cached revisit;
- service worker update;
- export preload;
- low-end mobile decode.

## Do not prematurely convert to SVG

The porcelain shading is part of the asset.

Automatic tracing is likely to reduce quality.

## Optional optimization

Run lossless / visually-lossless PNG optimization if it does not alter alpha edges.

Keep 512 masters.

---

# 25. P3 — Offline update correctness

Because `/pieces/` is cache-first, test release upgrade:

```text
user visits v1.0
service worker caches old pieces
deploy v1.1
user reloads
```

With a versioned path, new HTML should request the new asset directory.

Add an E2E or manual release check that verifies:

```text
new wK URL
new wQ URL
new wB URL
```

are actually loaded after update.

---

# 26. P3 — Settings organization

Settings is functionally rich.

As board-feedback settings are added, avoid a long flat page becoming overwhelming.

Recommended group structure:

```text
Review
  Objective analysis

Board
  Piece set
  Coordinates
  Arrows
  badges
  animation
  sounds

Human
  Maia

Coach
  language/provider/model

Accounts
  Chess.com / Lichess

Data
  backup / cache / reset

Runtime
  local capabilities
```

Keep paper sections, not nested dashboards.

---

# 27. P4 — Features to defer

The mature-platform comparison exposes many possible features. Not all are appropriate now.

## Defer dark theme

Still correct to defer.

Windowlight is not mechanically invertible.

## Defer large theme marketplace

Keep:

```text
Feather Porcelain
Classic SVG
```

Two sets are enough for now.

## Defer live play / matchmaking

Not the product.

## Defer giant social layer

Not the product.

## Defer coach avatars

The current product is better served by grounded evidence and text.

## Defer decorative bird/feather animation

Conflicts with the art direction and board clarity.

---

# 28. Recommended priority order

## Phase 0 — Feather Porcelain v1.1 integration

- versioned asset directory;
- all 12 final PNGs;
- update asset contract;
- recognition fixture;
- export/promotion regression;
- stale-cache test.

**Do this first.**

---

## Phase 1 — Board ergonomics

- board resize desktop;
- Focus Board mode;
- persisted board size;
- shortcut map;
- `?` shortcut overlay;
- F flip / J-K or arrows / first-last / play-pause.

This is the highest-value usability work after the art.

---

## Phase 2 — Guided Review refinement

- critical-moment next/previous;
- “Moment n of m”;
- tighter Retry/Hint/Reveal flow;
- end-of-review summary;
- review → Training/Study handoff.

This improves the core product, not just polish.

---

## Phase 3 — Board/display preferences

- coordinates;
- arrows;
- board classification badge;
- piece animation;
- move-list emphasis: Key vs All.

---

## Phase 4 — Explorer

- Opening Explorer MVP in Engine Lab;
- privacy/network disclosure;
- cache;
- current-position sync.

---

## Phase 5 — Tablebase

- Syzygy for <=7 pieces;
- explicit theoretical W/D/L;
- no claims before real evidence.

---

## Phase 6 — Remaining audit / mobile

- F6/F7/F8;
- mobile Feather Porcelain parity;
- zoom/device acceptance.

---

## Phase 7 — release gate

- Debian NUC;
- real Cloudflare HTTPS;
- Lichess OAuth;
- real phone/tablet;
- service-worker upgrade path;
- rollback.

---

# 29. File-by-file implementation map

## Piece v1.1

```text
apps/web/public/pieces/feather_porcelain_v1_1/*
apps/web/src/lib/board-piece-assets.ts
apps/web/src/app/design/pieces/page.tsx
e2e/*
docs/ui-spec.md
docs/design/*
```

Potentially:

```text
apps/web/public/sw.js
```

only if paths are not versioned.

---

## Board ergonomics

Likely:

```text
apps/web/src/components/review-shell.tsx
apps/web/src/components/review/board-flip-button.tsx
apps/web/src/components/review/*
apps/web/src/lib/app-settings.ts
apps/web/src/components/settings-page.tsx
apps/web/src/app/styles/review-workspace.css
apps/web/src/app/styles/review-shell.css
```

Create focused hooks instead of making `review-shell.tsx` even larger:

```text
useReviewKeyboardShortcuts
useBoardGeometryPreference
```

This is important.

`review-shell.tsx` is already a large orchestration component. New interaction logic should be extracted.

---

## Guided Review

Prefer new small modules:

```text
lib/critical-moment-navigation.ts
components/review/key-moment-navigation.tsx
components/review/review-completion.tsx
```

Do not add more unrelated state directly into the monolithic shell.

---

## Explorer

New package boundary should be deliberate.

Possible:

```text
packages/explorer
```

or:

```text
apps/web/src/lib/opening-explorer
```

If the data source/normalization will be shared by desktop/mobile, use a package.

---

## Tablebase

Prefer:

```text
packages/tablebase
```

with a clean schema:

```text
position identity
WDL
DTZ
move outcomes
source/version
```

The UI should consume canonical facts, matching the rest of the architecture.

---

# 30. Architecture warning: avoid expanding `review-shell.tsx`

This is one of the most important implementation-quality points.

`review-shell.tsx` already orchestrates:

- review record;
- playback;
- branch;
- Stockfish;
- Maia;
- Coach;
- notebook;
- practice;
- sound;
- export;
- sharing;
- board state;
- promotion;
- keyboard navigation;
- route state.

Do not implement every new UX feature directly inside it.

Before adding board geometry / shortcuts / focus mode / key-moment navigation, factor behavior into focused hooks/components.

Target:

```text
ReviewShell = orchestration + composition
not
ReviewShell = every interaction implementation
```

---

# 31. Product success criteria

The product is “finished enough” when the user can do this without confusion:

```text
1. Import/sync a game
2. Run review
3. Immediately understand overall result
4. Jump through the important moments
5. Try a mistake before seeing the answer
6. Compare objective best play with likely human play if Maia is available
7. Explore a variation freely
8. Understand the explanation source
9. Save a note / position if useful
10. Finish the review
11. Know what to practice next
12. Return later and continue
```

If a new feature does not improve one of these steps, it is probably lower priority.

---

# 32. Do not optimize the wrong things

Do not spend the next cycle on:

- another board color;
- another paper shade;
- another feather motif;
- SVG conversion;
- a dark theme;
- decorative animation;
- more cards;
- more move-quality icons;
- a bird illustration.

The product has crossed the point where aesthetic iteration gives the highest return.

From now on:

> **interaction clarity, learning flow and analysis ergonomics have higher ROI than visual decoration.**

---

# 33. Definition of Done — next major refinement

## Feather Porcelain v1.1

- [ ] 12 pieces in versioned production directory.
- [ ] New wK/bK/wQ/bQ/wB/bB integrated.
- [ ] R/N/P unchanged.
- [ ] Blind-position fixture added.
- [ ] Silhouette test added.
- [ ] 32/40/48/56/72px tested.
- [ ] Light/dark square tested.
- [ ] Export uses same assets.
- [ ] Promotion uses same assets.
- [ ] Classic fallback unchanged.
- [ ] Service-worker stale asset problem eliminated.

## Board workspace

- [ ] Desktop board size user-adjustable.
- [ ] Focus Board mode available.
- [ ] Board size cannot break responsive layout.
- [ ] Keyboard shortcut help available.
- [ ] Core navigation shortcuts implemented.
- [ ] Shortcuts do not fire inside form controls.

## Review flow

- [ ] Critical-moment next/previous.
- [ ] Current moment position visible.
- [ ] Retry/Hint/Reveal consistent.
- [ ] End-of-review completion state.
- [ ] Clear handoff to Study/Training.

## Preferences

- [ ] coordinates preference;
- [ ] arrows preference;
- [ ] classification badge preference;
- [ ] piece animation preference;
- [ ] move emphasis Key/All if implemented.

## Audit cleanup

- [ ] F6 resolved;
- [ ] F7 action links resolved/decided;
- [ ] F8 resolved.

## Production

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e`
- [ ] Web production build
- [ ] release Playwright suite
- [ ] real browser/device acceptance
- [ ] cache-upgrade acceptance
- [ ] real NUC/HTTPS/OAuth release gates handled before public release.

---

# 34. Recommended coding-agent handoff prompt

```text
Repository:
https://github.com/ice345/chess-review

Read first:
- AGENTS.md
- README.md
- docs/ui-spec.md
- docs/design/2026-09-13-windowlight-implementation.md
- docs/audits/2026-09-13-ui-ux-layout-audit.md
- docs/roadmap.md
- this final refinement audit

Do not redesign Windowlight.

The visual theme is accepted:
board #eee8d9 / #b1c6c2,
Feather Porcelain default,
Blue Bishop brand,
Stockfish/Maia/Move Quality semantics unchanged.

Immediate task:
integrate Feather Porcelain v1.1.

Use a versioned asset path:
  /pieces/feather_porcelain_v1_1/

The six new K/Q/B assets are final production 512x512 RGBA PNGs.
Copy the existing locked R/N/P assets to the new complete 12-piece directory.
Update PIECE_ASSET_DIR only; keep persisted pieceSet id "liz-blue".

Upgrade /design/pieces:
- keep current 12×32/40/56/72 matrix;
- add unlabeled random K/Q/B position;
- add silhouette mode;
- add blur/distance stress test;
- add Classic SVG comparison.

Verify live board, promotion and PNG export use the new directory.
Keep Classic fallback.
With a versioned directory, do not unnecessarily flush engine/sounds caches.

After piece integration, do not start another visual redesign.
The next implementation target is board ergonomics:
- desktop board resize;
- one Focus Board mode;
- persisted board size;
- ? shortcut overlay;
- ←/J previous, →/K next, ↑ first, ↓ last, F flip, Space play/pause.

Do not dump new behavior directly into review-shell.tsx.
Extract focused hooks/components.

Then refine Guided Review:
- previous/next critical moment;
- moment n/m;
- consistent Retry/Hint/Reveal;
- review completion state and handoff to Study/Training.

Only after these are accepted should you implement:
- small board-feedback preferences;
- Opening Explorer MVP;
- Syzygy tablebase.

Close the existing UI audit F6/F7/F8 in the appropriate pass.

Keep More collapsed by default.
Dark mode is out of scope.
No literal bird/feather decorations.
No chess algorithm changes unless the task explicitly concerns Explorer/Tablebase.

Run tests after each phase and inspect screenshot diffs before updating baselines.
```

---

# 35. Final recommendation

The next version of Open Chess Review should **not** be judged by whether it looks more decorated than Chess.com or Lichess.

It should be judged by whether it combines their best mature interaction lessons with its own stronger identity:

### From Lichess
Take:

```text
board-first work surface
speed
keyboard efficiency
resize/focus
free analysis
```

### From Chess.com
Take:

```text
guided review
key-moment focus
retry before reveal
progressive disclosure
clear transition to self analysis
```

### Keep uniquely Open Chess Review

```text
Stockfish / Maia / Coach separation
grounded evidence
local-first privacy
offline review
persistent Notebook
cross-game Study/Training
Windowlight
Feather Porcelain
Blue Bishop
```

The ideal result is not:

> “a prettier clone of an existing chess site.”

It is:

> **a serious analysis tool with Lichess-level board ergonomics, Chess.com-level review guidance, and a quieter evidence-first identity of its own.**

That is the highest-value path from the current repository.
