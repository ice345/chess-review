# Live atmosphere audit — 2026-09-24 (JST) · revised

**Authorities (this revision):**
1. `docs/design/audits/2026-09-24-atmosphere-practice.md`
2. `docs/design/implementation/2026-09-24-bluebird-integration.md`
3. Prototype research only: `docs/design/prototypes/bluebird-platform-v4/` (layout direction, not production)

**Live check:** `http://127.0.0.1:3000` on ICE Mac, Chrome headless 1440×900.
**Question:** Does the current style fuse with 『リズと青い鳥』 (and lightly 『響け！ユーフォニアム』) in tone / air / color climate — without becoming anime UI?

**Verdict:** Climate is partly there. Recognition and fusion are still weak. Reads as quiet editorial SaaS more than “window-inside study / fairy-outside air.”

---

## Withdrawn (do not implement)

These appeared in the first draft of this audit and **conflict** with the approved 2026-09-24 docs. Treat as cancelled:

| Withdrawn | Why |
|-----------|-----|
| Restore fullscreen Room desk photo wallpaper | `bluebird-integration` A1 explicitly cancelled fullscreen room backgrounds |
| 88–94% translucent scene-sheet pressed over Room photo | Old Windowlight grammar; current direction is solid reading surfaces + edge crop / material / border continuity — **not** glass blur |
| Force board-centric Home as in `01-home.png` | A2 Home is watercolor overture → real recent review/practice → expandable Position desk; board primacy lives on Review |

---

## What lands (keep)

- Pale paper field, thin hairlines, generous breathing room
- Serif display + tracked sans kickers
- Practice: cool task sheet / warm method margin (`MOVEMENT` as chapter voice — later bind to real progress, not label-only)
- Small nav state (thin underline)
- Home watercolor as the **only** bird illustration sitewide
- Review board + right task column structure
- Integration honesty: A1/A2 shell done; B/C/D interiors not “全站整合完成”

---

## Gaps (aligned with atmosphere-practice §3)

| Gap | Live / current | Direction |
|-----|----------------|-----------|
| Color climate too mono | Gray-blue-green carries bg, buttons, borders; rose/brass almost only in small type | Large clear white; local window blue; rose as fairy *boundary* only; brass warm on practice/complete nodes |
| No spatial distance | Everything on one plane | Three layers: environment edge → content paper → board — via crop, whitespace, local light — **not** glassmorphism |
| Image only on Home | Natural bird banner feels pasted into a tool | Home: clear 窗内学习 / 窗外童话 composition; tool pages continue same crop / material / border only |
| MOVEMENT as label | Not bound to real task progress | Chapter progress from import → observe → try → save → revisit |
| Same page rhythm | Hero → hairline → vertical stack | Distinct rhythms: Home overture / Review workbench / Practice rehearsal / Library program / Stats growth archive |
| Motion without cause | Page fade louder than task state | Decision-before → choose → verify → compare → close; each state readable and skippable |

Air ≠ lowering text/piece contrast. Soft color lives in background and edges; main text, board, and focus stay clear.

---

## IN for Implementer (atmosphere / platform identity only)

Product P0 (real Practice attempt loop) stays owned by `atmosphere-practice` §6–8 — **not** this visual IN list.

### P1 — Platform identity (next visual batch)

1. **Home 窗内/窗外** — One main illustration only; white window-frame / desk-edge vs blue-green watercolor exterior; share one composition with primary task; real recent game facts enter “inside”; no fake “continue at ply” without analysis. Lower third: three different densities (today’s game → recent program → optional free board), not a uniform card wall.
2. **Color tokens** — Clear white field; local window blue; rose pink only as fairy boundary accents; brass/warm only at practice complete / quiet bookmark close. Soften solid navy Import brick toward quieter instrument primary.
3. **Spatial layers without blur** — Environment edge wash/crop on journey pages; solid paper for reading; board as own plane on Review. Tool pages inherit border/material, **not** a second full illustration decode.
4. **Page rhythms** — Practice = rehearsal (today / saved tasks / prepare data demoted); Library = program list with games visible in first viewport; Stats = growth archive (inventory ≠ skill); do not share one hero template.
5. **Motion** — 160–240ms color/opacity on nav; piece move kept; no looping birds, parallax, forced intros; honor `prefers-reduced-motion`.

### OUT

- Anime characters, film frames, music-note icons, bird mascots in chrome
- More low-quality bird icons / feathers on utility pages
- Fullscreen room photo wallpaper; glassmorphism / heavy blur
- Saturated gradients, metric card soup, Kylin black+neon HUD
- Copying prototype mock numbers into production
- Changing Stockfish / Maia / classification / Accuracy / mastery interval semantics

---

## Acceptance question

A stranger who knows Liz should say: “cool window air and quiet paper,” not “anime chess skin,” and not “another clean Next.js dashboard.”

Visual acceptance = real browser shots, not auto-updated screenshot baselines.

## Shots

`/workspace/ocr-live-audit/` — home, training, history, review, import, stats, settings (1440).
