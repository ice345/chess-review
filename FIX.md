# Open Chess Review — development brief (2026-09-17)

This document **replaces** the earlier `test.md` / product-audit brief.

It is written after a read-only audit of https://github.com/ice345/chess-review at commit `3250a6e` (2026-09-17), a live visit to https://projectkylin.org.cn/ (no login), and official staff materials for 『リズと青い鳥』 / *Liz and the Blue Bird*.

Do not treat this file as a request to clone Chess.com or Lichess. Do not treat it as a request to restyle the product as Project Kylin’s lime-on-black instrument, or as Kyoto Animation decoration.

---

## 0. Verdict on the previous brief

The previous brief is **correct as product direction** and **mostly correct as a defect list**. It is **partly stale as an implement-now ticket**.

| Previous claim | Verdict at `3250a6e` |
|---|---|
| Stockfish 18, MultiPV, Accuracy / WinPercent, classifications, Maia / Compare, Coach, Explorer, tablebase **UI**, Training mastery 1/3/7/21, Chess.com + Lichess import, Windowlight / Feather Porcelain | **Correct. Present.** |
| Docs drift: `advanced-study.md` denies then defines mastery; Help says acknowledgements not mastery; Explorer filters “absent”; Syzygy “not integrated” | **Correct. Still true. P0.** |
| Practice White/Black becomes irreversible after a side with positions is chosen | **Correct. Confirmed in `retro-practice.tsx`.** |
| Home board is an inert preview | **Correct. `inert` / `aria-hidden` / no drag.** |
| Clock intelligence, personal “My games” explorer, practice↔Training attempt unification | **Correct as missing.** Still not built. These are Phase D, design first. |
| “Inspect every viewport and run the full suite before changing analysis semantics” | Process instruction. **Not executed** in this audit pass. |
| Project Kylin as a visual reference | **Was missing.** Now inspected. Borrow structure, not palette. |
| Liz and the Blue Bird as atmosphere | Direction was right. Official-source analysis is now attached in §5. |

**Do not reopen analysis semantics** (Accuracy, WinPercent, score POV, Divider, Brilliant/Great, Human Find Difficulty) unless a concrete bug is shown with fixtures.

---

## 1. Non-negotiable product identity

Open Chess Review is a **local-first chess review and learning desk**.

It is not:

- a clone of Chess.com
- a clone of Lichess
- a clone of Project Kylin
- an anime skin, a blue-bird mascot, or a SaaS analytics dashboard

Source-of-truth boundaries:

1. Stockfish objective facts are canonical.
2. Maia is human prediction, never objective evaluation.
3. Coach explains grounded facts and may not override them.
4. UI does not recompute chess semantics.
5. Local user data must not be silently destroyed.

Emotional north star:

> A quiet chess study desk beside a cool window.

Not: a chess analytics SaaS dashboard.

---

## 2. Current baseline (HEAD `3250a6e`)

Treat this as what exists. Do not report these as missing.

**Analysis:** Stockfish 18 WASM, MultiPV, Accuracy / WinPercent, move classification with evidence, selective verification, opening recognition, evaluation timeline.

**Human vs objective:** Stockfish / Maia-3 / Compare modes. Grounded Coach. Maia is optional Enhanced Local.

**Openings / endgame:** Opening Explorer (Lichess + Masters, with rating/speed population filters in code). Tablebase as an **Engine Lab lookup tool**, not classification proof.

**Learning:** Key moments, guided review / withheld answers, in-game mistake practice, Training queue, recurring weaknesses, mastery ladder `1 / 3 / 7 / 21` days, outcomes `unaided / hinted / exposed / legacy`.

**Library:** IndexedDB, Chess.com public sync, Lichess OAuth when configured, Notebook, backup/restore, Browser Core offline.

**Visual:** Windowlight contract, Feather Porcelain pieces, default appearance `liz-blue`.

**Confirmed defects (code):**

- Practice side selector disappears once a side with `count > 0` is chosen. If learner color is already known, there is **no** switcher at all (`apps/web/src/components/retro-practice.tsx`).
- Home board is a non-interactive preview.

**Confirmed missing (not bugs, product gaps):**

- Clock / `[%clk]` intelligence (tags are stripped from display).
- Personal Opening Explorer (“My games”) over the local library.
- Shared AttemptEvent between in-game practice and Training mastery.

---

## 3. Remaining problems vs Chess.com and Lichess

Compare **review / analysis / training only**. Do not compete on live pairing, tournaments, social, chat, clubs, anti-cheat, or subscriptions.

### 3.1 Real missing capability (worth a staged design)

| Gap | Official reference | Why it matters | Class |
|---|---|---|---|
| Personal opening evidence | Lichess Explorer **Player** tab; Chess.com “times you’ve played” | Local library already exists; Explorer is only Lichess/Masters | Phase D design |
| Time-pressure intelligence | Chess.com / Lichess show clocks; review often uses them | PGN already may contain `[%clk]` / `[%emt]`; currently discarded | Phase D design |
| Discoverable one-path review | Chess.com “Next key move” / Coach | OCR can answer six questions at once on the start ply | Phase B UX |
| Practice setup clarity | Chess.com “Review As”; Lichess practice keeps side | Confirmed P1 bug | Phase B, do now |

### 3.2 UX / IA (not a missing engine)

- Chess.com’s guided narrative is easier to follow. OCR is deeper on **truth separation** (Stockfish ≠ Maia ≠ Coach). Keep the separation. Improve the path, do not collapse it.
- Tablebase exists but lives in Engine Lab. Lichess puts endgame facts closer to the position. Improve discoverability; do **not** let a Stockfish +8.2 become “theoretical win” without tablebase evidence.
- Nearby move rows can show a bare `100` next to Book. If that number is Accuracy, it must be discoverable without repeating the word on every row.

### 3.3 Intentionally out of scope / do not copy

- Chess.com Game Rating as a pseudo-Elo badge without population caveats.
- Torch Human blending human preference into the “objective” engine.
- Paywalled unlimited cloud review as product identity.
- Lichess social Study / realtime collaboration as a near-term requirement.
- WintrChess-style server retention of user PGNs.
- Project Kylin community rankings, creator channels, engagement counts, `6.5/10` scores.
- Saturated CTAs, XP, confetti, glassmorphism, nested SaaS cards.

WintrChess was **not interactively verified** in this pass (public URL returned an empty SPA shell). Treat the 2026-08-26 in-repo comparison as **historical**.

---

## 4. Project Kylin — what to borrow

Live browse 2026-09-17, no login.

**Accessible:** landing, system directory, public library, public study workspace, settings.  
**Blocked:** Smart Review — 「请先登录后使用智能复盘。」

Kylin is a Chinese chess **knowledge / archive** product: shared opening libraries, PGN studies, opening training, creator content, a login-gated smart-review. It feels like an editorial system, not a dashboard.

### Visual (observe, do not copy)

- Near-black field + fluorescent chartreuse signal
- Pale warm off-white panels against the dark
- Large Chinese headlines, condensed English metadata, ghost/outlined type, oversized chapter numbers
- Thin grid, crosshair framing, persistent rails
- Sage-gray board, sculptural pieces, lime move highlights
- Atmosphere from typography, grid, and negative space — not illustration

### Information architecture worth translating

1. **Chapter rail** — the product is a sequence of scenes, not a pile of apps.
2. **Board as a stage inside a system frame** — the board is not a card; it sits in the visual center with quiet metadata rails.
3. **Right panel bound to the current position** — moves / comments / annotations / evaluation stay tied to the ply.
4. **Sparse “current position” note** — one moment of attention, not a dashboard of scores.
5. **Variation tree on the left** — the game is a chaptered score, not a flat dump.
6. **Reduced-motion and high-contrast in settings** — already aligned with a delicate product.

### Translate into Windowlight / Liz language

| Kylin idea | Why it works | Liz / Windowlight translation | Where it belongs |
|---|---|---|---|
| Chapter navigation | Makes the product a sequence, not a dashboard | Quiet study **movements**: Import → Key moment → Practice → Evidence. No lime numbers, no “CHAPTER 01” chrome | Home / Review information architecture |
| Persistent hairline frame | Structure without cards | Fine rules, paper surfaces, observational margin | Review chrome, Study, Engine Lab |
| Ghost oversized figures / outlined titles | Distance and air | Use **very rarely** (one kicker, one empty-state figure). Paper / ivory, not black | Home hero, completion, empty states |
| Board as stage | Chess is the object | Keep board dominance; surplus space becomes board or breath, not panel mass | Review left column |
| Right panel = current position | One cognitive task | Encode the six Review states: start / move / key moment / practice / variation / engine | `review-route-panels` |
| Left variation tree | The game has chapters | Nearby moves should read as a short table of this game, not a second product | Review move list |
| Reduced motion / contrast | Delicacy is optional, not assumed | Keep; motion 120–180ms, state not decoration | Settings + Windowlight motion |

### Do not copy from Kylin

- Lime-on-black industrial tone
- Dense micro-labels and rigid grid density
- Feature-directory tiles as SaaS navigation
- Public rankings, favorites, creator scoring
- Login-gated empty Smart Review as a product model (OCR is local-first)
- Cyber “SERVER SYNC / LIVE DATA” theatre

Kylin’s **structure** (chapter, stage, bound annotation) is the useful reference. Its **palette and density** fight 透明感.

---

## 5. 『リズと青い鳥』 — official art direction

Official sources still live (checked 2026-09-17):

- https://liz-bluebird.com/
- https://liz-bluebird.com/interview/ (山田尚子)
- https://liz-bluebird.com/news/?id=3 (staff comments)
- https://liz-bluebird.com/news/?id=31 (countdown staff comments)
- https://www.kyotoanimation.co.jp/works/liz/

### Two registers (do not mix)

Official materials themselves split the film:

1. **School / observation** — glass-like air, pale contrast, taut classroom, faint breath, distance, quiet heat, small changes. **This is Windowlight.**
2. **Picture book / fairy tale** — warmer storybook world. Color designer 石田奈央美 notes that the picture-book blue bird and forest animals were made *可愛く*. **This is an anti-pattern for the UI.**

Do **not** add: character art, floating feathers, blue-bird icons, KyoAni pastiche, pastel cute cards, glassmorphism, saturated “brand blue.”

### Official language → product

| Quality | Official anchor | UI translation |
|---|---|---|
| 透明感 | 山田: 「透明な、作り物ではない空気感」; 篠原: 「ガラスを覗いたような透明感」 | Light visual weight. Fine rules. Fewer containers. Transparency ≠ CSS blur. |
| 繊細 / 線の細さ | 西屋: 線の細さや透明感 | Hairline separators, precise type. Not chunky chrome. |
| 儚さ | 山田: ふれると消えてしまいそうな脆さ | Accents that can disappear. No loud error red. |
| 距離 | 山田 / 西屋: 二人の距離; camera through glass | Board and explanation have a deliberate spatial relationship. Do not fill every pixel. Distance is composition, not waste. |
| 呼吸 | 西屋: かすかな息づかい | 120–180ms state changes. Near-silent motion. |
| 静かな熱量 | 西屋 | Intensity without noise. A blunder uses restrained rose + stronger ink, not a siren. |
| 小さな変化 | 山田: 小さな変化を積み重ねる | Thin rule appears, ink shifts, slight wash. No bounce, scale, rotate, confetti. |
| 淡い色の対比 | 篠原 | Warm paper / ivory × cool blue-gray / celadon. Rare rose/brass. Not monochrome beige. Not neon. |
| 水彩 | 篠原 | Faint page washes. Not painted anime panels as chrome. |
| 緊張した教室の空気 | 西屋 | Board is the workspace. Analysis stays sharp. The more important the moment, the fewer competing elements. |
| ガラス越し | 山田; 篠原 | Metaphor for observation. **Not** frosted glass UI. |

Palette to **preserve** unless evidence says otherwise:

- warm paper / ivory environmental surface
- cool daylight / blue-gray ink
- celadon / mist board
- very restrained rose / brass accents

Home, completion, and empty states may carry slightly more color vitality. Review stays the most restrained.

### Typography rule

- **Instrument / operational UI** (Review controls, move list, engine, Training, settings): sans.
- **Narrative / reflective UI** (Home hero, Study title, completion, selected empty state): serif / mincho, sparingly.

Do not use serif headings everywhere to manufacture a “literary” feeling.

---

## 6. Practice side selection (confirmed defect)

Reproduce in Review. Current code (`retro-practice.tsx`):

- Empty side: White / Black stay on the row.
- Side with `count > 0`: those buttons leave the row; the CTA becomes “Practice {side}'s N positions”.
- The chooser returns only inside **Options**, and only if `!knownColor`.
- If the learner color is known from an imported account, **there is no side switcher** when `count > 0`.
- Selecting a side does **not** start practice (keep that).

This is a UX defect, not a missing feature.

### Required interaction

Do **not** add a “Back” text link.

Design a **stable Practice Setup** whose structure stays before and after selection:

- White and Black remain visible after selection
- each side shows its position count (`0` is not an error)
- selected state is obvious
- changing side is immediate
- filters stay attached to Practice
- one clear action starts practice; selection alone never starts it
- keyboard and touch remain usable
- no hidden irreversible state
- no duplicated source of truth

Visual: Windowlight, not a SaaS card. Fine rule, slight surface distinction, one quiet heading, one primary action only when practice is available. Unavailable side: muted ink, still part of the selector.

### Contract to document

Choose and write down whether side selection is:

- session-local
- persisted while staying in this review
- persisted per game
- reset when leaving practice

Recommended default: **persist for the current review session**; reset is not required when leaving practice if the user returns to the same game.

### Regression tests (minimum)

1. White 0 / Black > 0
2. White > 0 / Black 0
3. both > 0
4. both 0
5. switch White → Black → White
6. filters change the count
7. selected side stays coherent after filters
8. practice begins with the currently selected side
9. exiting practice returns to setup cleanly
10. keyboard navigation
11. narrow mobile
12. refresh / route transition if selection is meant to persist

---

## 7. Review workspace

The right panel must answer **one primary question** at a time:

| State | Question |
|---|---|
| Start | What should I do next? |
| Normal move | What happened on this move? |
| Key moment | Why does this matter, and should I try it? |
| Practice | What move would I play? |
| Variation | What am I exploring? |
| Analysis | What does Stockfish / Maia say about this exact position? |

At the starting position, do not let key-moment CTA, practice, nearby moves, engine lines, and Game Summary compete with equal weight.

Preferred hierarchy:

1. **Primary:** start review → first key moment
2. **Secondary:** practice mistakes
3. **Background:** moves / engine / summary, visually quiet

When practice actually begins, the right side must simplify. Hide or reduce answer-leaking surfaces (engine candidates, exact evaluation, best line, Explorer, tablebase, move verdict). After the attempt: result, evidence, one next action.

Board remains the dominant object. Surplus space becomes board or breathing room, not panel mass. Re-measure at 1280×720 and 1366×768.

---

## 8. Player intelligence (design first, do not ship schema blindly)

### 8.1 MoveTimeEvidence

PGN clock tags exist and are currently stripped. Do not display raw `[%clk]` as copy.

Propose a canonical evidence object (`elapsedMs`, `remainingMs`, `remainingRatio`, source, inferred vs exact, time-control context, pressure bucket). Use it for **player intelligence**, never to rewrite objective move quality.

Every metric must state its population and coverage. Do not invent elapsed time when only remaining time cannot safely determine it.

### 8.2 Personal Opening Explorer

Local source: **My games**, using the already-imported library. Must not upload the library.

Explorer tabs conceptually: `My games | Lichess | Masters`.

Thousands of games must not require replaying the library on every position query. Design a local position index or bounded derived projection before implementation.

### 8.3 Practice / Training attempts

Do **not** let a same-session practice solve advance spaced-repetition mastery.

Shared `AttemptEvent` (source: review-practice | training; outcome: unaided | hinted | exposed | failed; timestamp; position identity; whether the review was due). Only a **due unaided** recall advances the current mastery ladder.

Audit `TrainingQueueItem` evolution without a destructive migration.

### 8.4 Tablebase boundary

Keep: Engine Lab lookup is available. Canonical classification / Training metrics do **not** treat Stockfish search as tablebase proof.

A future `TablebaseEvidenceV1` may attach to eligible positions only when real WDL/DTZ evidence exists. Do not implement semantic changes without versioning and fixtures.

---

## 9. Documentation — still the first ship

An incorrect spec can make an agent “fix” correct implementation into incorrect behavior.

### Active contracts (must describe current truth)

README, AGENTS.md, `docs/architecture.md`, `docs/data-model.md`, `docs/ui-spec.md`, `docs/analysis-spec.md`, `docs/advanced-study.md`, `docs/move-classification.md`, `docs/ai-coach.md`, `docs/mistake-practice.md`, `docs/human-analysis.md`, `docs/connected-platforms.md`, `docs/library-backup.md`, `docs/web-service-boundaries.md`, `docs/design/windowlight-contract.md`, current release roadmap.

### Dangerous if read as current

- `docs/advanced-study.md` early Training section (“no mastery / no spaced repetition”) vs later 1/3/7/21
- Help: “Position-review counts record acknowledgements, not mastery”
- `docs/analysis-spec.md` “Syzygy is not integrated in Browser Core” (tool exists; it is not classification proof)
- `docs/design/2026-09-14-opening-explorer.md` filters implemented **and** “deliberately absent”
- Pre-Windowlight / pre-Feather-Porcelain audits

### Historical documents

`docs/audits/*`, dated `docs/design/2026-09-13*` … `2026-09-15*` implementation logs, `docs/audits/wintrchess-comparison.md` (2026-08-26).

Add a lightweight header where useful:

```
Status: Historical
Baseline: <commit/date>
Superseded by: <document>
Do not use as the current product contract.
```

Do not mass-delete. Produce the inventory, then mark or rewrite the dangerous ones.

Help copy must distinguish:

- **reviewed count** = acknowledgement ledger
- **Training mastery** = due-date ladder

Those are two concepts. Do not conflate them.

---

## 10. Home page

The board is attractive and inert. That wastes the most recognizably chess surface.

Direction (prototype before implementation): the board becomes a real workspace — paste PGN, open PGN, connect account, or make a move — without destroying the simple import path.

Home should feel: “Here is a chessboard.”  
Not: “Here is a SaaS form with a chess illustration.”

Optional, after Phase B. Not a blocker for A–C.

---

## 11. Implementation phases

### Phase A — Contract cleanup (do first)

No product semantics changed.

- Rewrite the early mastery denial in `docs/advanced-study.md`
- Fix Help copy: reviewed count vs Training mastery
- Clarify Syzygy in `docs/analysis-spec.md`: lookup tool ≠ classification proof
- Fix the Explorer filters contradiction
- Add Status / Baseline headers to dangerous historical docs
- One-line README notes for Training mastery + Engine Lab tablebase/explorer if omitted

### Phase B — Review UX (immediately after A)

- Practice Setup redesign (always-visible sides + counts; no start-on-select)
- Regression tests in §6
- Start-ply right-panel hierarchy
- Nearby move-list Accuracy / Book check in a real browser
- Inspect 1280×720, 1366×768, 390×844
- Preserve board dominance

### Phase C — Windowlight / Liz refinement (after B)

- Typography roles (instrument sans vs narrative serif)
- Spacing rhythm: board → concise decision → evidence → space
- Motion 120–180ms, state not decoration
- Fewer unnecessary containers
- Warm paper × cool celadon, rare rose/brass
- Borrow Kylin’s **chapter / stage / bound annotation** without borrowing its palette or density
- No theme replacement

### Phase D — Player intelligence (design only until migration is shown)

- `MoveTimeEvidence` proposal + coverage rules
- Personal explorer local index
- `AttemptEvent` without auto-advancing mastery from same-session practice
- Optional `TablebaseEvidenceV1` boundary

Do not implement schema changes until the migration is written down.

### Phase E — Release acceptance

- `pnpm typecheck / lint / test / build / test:e2e` plus relevant Python tests if local-ai is touched
- Browser inspection of Home / Review (all states in the previous brief §17) / Training / Study / Engine
- Viewports: 1280×720, 1440×900, 1920×1080, 390×844, 320×740
- Do not regenerate screenshot baselines blindly

---

## 12. How this repository should develop

Judge success by this loop, not by feature count:

Import a game  
→ understand what mattered  
→ try the position yourself  
→ read the evidence  
→ save or explore it  
→ turn a recurring problem into practice  
→ return days later  
→ actually remember the lesson

while the experience stays quiet, precise, light, evidence-first, board-first, local-first, and recognizably Open Chess Review.

**Near term (A → B → C):** make the existing product tell the truth in its docs, make Practice a stable setup, make Review answer one question at a time, and let Windowlight behave like the school-observation register of the film.

**Next (D, designed then built):** clocks as evidence, personal opening explorer over the local library, one attempt history that does not weaken due-date discipline.

**Later, optional:** Home as a real board; tablebase facts on eligible positions; richer Study.

**Never:** live play, clubs, anti-cheat, subscriptions, Chess.com Game Rating as truth, Maia folded into Stockfish, Kylin’s lime archive skin, picture-book bird chrome.

---

## 13. After implementation, report

1. What changed / why  
2. Files changed  
3. Docs updated / marked historical  
4. Behavior before / after  
5. Visual before / after  
6. Tests run  
7. Viewports inspected  
8. Remaining issues  
9. Items deliberately not changed  

---

## 14. Reference files from this audit pass

On the working computer (not the GitHub repo):

- Liz official-source notes: school/observation vs picture-book register
- Project Kylin live notes + screenshots (landing, study workspace, smart-review login wall)
- Full code/docs audit at commit `3250a6e`

Official Liz URLs to keep open while doing Phase C: `liz-bluebird.com/interview/`, `liz-bluebird.com/news/?id=3`, `liz-bluebird.com/news/?id=31`.  
Kylin URLs for structure only: `projectkylin.org.cn`, `/system`, `/system/shared-library`, `/system/settings`. Smart Review remains login-gated; do not wait on it.
