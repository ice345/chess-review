# UI specification

## Information architecture

The product is route-based rather than a single analysis dashboard:

- `/` owns PGN/FEN import, a live (non-interactive) position preview, a compact Chess.com/Lichess connect row, and recent reviews. Chess.com and Lichess are account actions, not import modes.
- `/review/[gameId]` is the objective review.
- `/review/[gameId]/moves` is the move explorer.
- `/review/[gameId]/coach` is the Study surface for grounded move lessons and whole-game learning (the URL remains stable).
- `/review/[gameId]/engine` is the advanced Stockfish lab.
- `/history`, `/training` and `/settings` are application utilities.

### Application frame

Every route renders inside one application frame: a persistent rail beside the
route content, and that same rail as a drawer behind a top-bar trigger below the
rail breakpoint (1080px). The rail carries the product mark — which is also the
link to `/` — and the three utility routes; the current route is marked with
`aria-current="page"` plus a wash and an inset rule, so the selected state never
depends on color alone.

Two rules the implementation must keep:

- **One navigation landmark.** The drawer is the same `<nav>` element as the
  rail, switched by CSS. A second copy would give assistive technology two
  identical landmarks and would make every role-based link query ambiguous.
- **A rail column never covers content.** At desktop sizes the rail is a grid
  column, so nothing can sit under it. Below the breakpoint the bar scrolls with
  the document rather than sticking: a bar that stays on screen covers the top of
  the board in Review, which is reachability the zoom acceptance pass checks.

The rail is chrome, not a card: a column of the room with one inner hairline, no
radius, no shadow, no blur. Its paper thickens toward the foot — where the quiet line
and the imprint sit — so the room reads through the navigation while the rail's small
print keeps its contrast. Its width tracks the reference proportion
(`clamp(166px, 11.54vw, 190px)`; the reference's own column ends 11.5% into its window)
and its bar height is 48px below the breakpoint; both live in `tokens.css` as
`--rail-width` and `--rail-bar-height`, and every layout that measures the viewport
subtracts one of them. The review workspace bounds its board
with container-query units against the frame (`100cqw`) rather than `100vw`, so a
document-scale zoom cannot make the board overflow its column.

The rail's contents follow the reference: the mark, a two-line serif wordmark and a
two-line tagline above a short rule, then one row per destination with an icon and its
label (rows flush with the column's edge, the current one washed and accented), the
quiet line just under the navigation, and the product's two micro-caps words at the
foot. The register at the
foot changes with the current row, the way the reference's does per screen. All of
it is decorative: nothing in the rail is load-bearing except the links.

The seven rows are the reference's seven, and each one is a real destination:

| Row | Route | What it is |
| --- | --- | --- |
| Home | `/` | the desk: board preview beside the import, account and recent panels |
| Import | `/import` | the import desk: paste, file and account in one place, with the library's own tools |
| Review | `/review` | the reviews you have, newest first, each one a way back in |
| Practice | `/training` | recurring decisions across analysed games and today's task |
| Library | `/history` | every imported game and review, with filters, open and delete |
| Stats | `/stats` | counts from what this browser has saved |
| Settings | `/settings` | local data, engine, coach and library settings |

A review workspace lives under Review, so that row stays marked while one is open.
Practice is the reference's word for the training hub and is now the product's
word too: every user-facing label that pointed at `/training` says Practice. The
data structures and modules keep their `training-*` names; those are
implementation names, not interface copy.

### Route head

Desktop routes open with a head — a kicker, a serif display line, a lede and a step
trail — above the screen's own stage (`.page-head`, `.page-kicker`,
`.page-display`, `.page-lede`, `.page-steps` in `chrome.css`). The steps are a
position, not a control. On desktop the column is the reference's, measured from its own
mockups: it starts 7% of the window past the rail and is 67.7% wide, so the room stays
open on the right instead of the column being centred; the display line scales with it
(`clamp(28px, 2.77vw, 46px)`) so the headline keeps one line at every width. Review keeps
its own head aligned with the workspace below it rather than with that offset, because the
game's board card is the widest thing on the screen. Below 820px the head collapses to the
display line and the lede: a phone's first screen belongs to the job, not to the
threshold, and the import form must still reach the first screen at 320×740. Inside Review the budget
is tighter still — below 560px the head drops its kicker and the board card drops
its event line, because the move transport has to be on that first screen.

### Icons

Every interface icon comes from one authored set, `packages/ui/src/icons.tsx`: one
16-unit grid, one stroke weight, round caps, no fill, current colour. It is not the
brand mark and not the Move Quality family. A new interface icon is added there;
the product takes no icon font and no third-party icon set.

Import UI is never mounted inside the review workspace. A valid input is normalized, saved as a deterministic IndexedDB review record, and navigated to its review route. The objective cache remains separate and is not duplicated by routing.

Home places paste, Open PGN file, Analyze game and the complete Opera Game
example in its opening section. File selection/drop and pasted collections share
an explicit multi-game chooser. The board preview follows the paste; it is not
a second analysis workspace. Home's stage is the reference's arrangement: the
board panel on the left with its own header and footer, and one column on the
right of paper panels — the import form, the connected accounts and the recent
reviews. The board panel is a preview and says so; it does not promise a drag it
cannot accept, and it has no move transport. Unlinked Chess.com/Lichess intake on Home is one
quiet row, not identity cards. Mobile reading/tab order puts the form before
the non-interactive board preview. Returning users have a Continue last review
link above the form. See [PGN import and export](pgn-import-export.md) for limits,
source preservation and selection behavior.

## Persistent review shell

The nested review layout owns the board, evaluation bar, selected ply, orientation, move controls and current verdict. Review's Game Summary owns the evaluation timeline inside the contextual panel. Client-side transitions replace only the contextual right panel, so board state persists across Review, Moves, Study and Engine Lab.

At desktop sizes the opening review fits the players, board and move transport
within the viewport at the R2 acceptance sizes. Review uses one titlebar (mark,
game title, Review/Moves/Study, More, Export) inside the application frame, so
the rail is the left edge of the page and the titlebar is the game's own context
within it. Board size responds to both
width and available height; after the single-titlebar pass the default is
about 488px at 1280×720 and about 662px at 1440×900, clamped by
`100dvh - 232px` and `46vw` so the transport stays in the viewport, and capped by
`100cqw - --rail-width - 434px` so a persisted board preference can never push
the contextual column off-screen. The rail therefore removes width from the
contextual column before it removes it from the board. Flip stays on the player row; sound, focus board
and typed-move entry live in Board settings (`/` opens the move field).
The contextual column scrolls within the board column's height. On Review,
Game Summary is collapsed until opened, and engine lines are behind a
disclosure. No timeline is added below the board.

Below the tablet breakpoint, the route panel stacks under the board and normal document scrolling resumes. Move navigation remains adjacent to the board. There must be no horizontal document overflow.

## Vocabulary

One word per meaning, in the interface and in the documentation. A term that
names a measurement is stated as a measurement, and a term that names a judgement
is stated as a judgement.

| Term in the interface | Means | Never means |
| --- | --- | --- |
| **Key moment** | a ply this game's review navigates to, from the canonical critical-moment set | the annotation *Critical*, or a move's quality |
| **Critical** (annotation) | the classification for an only-move that kept the game's outcome | a key moment; a mistake |
| **Quality** / the annotation label | the classification assigned to one move (`Best`, `Blunder`, …) | Accuracy, or an evaluation |
| **Winning chances** | the WinPercent metric behind Accuracy, 0–100 from the mover's side | an engine evaluation, or Maia's probability |
| **Evaluation** | the engine's score, always normalised to White's point of view, in pawns | an outcome prediction |
| **Maia probability** | how often humans near the target Elo played that move | a quality judgement |
| **Accuracy** | the aggregate of per-move accuracy over a stated set of moves | an average loss, or a reliability that grows with sample size |
| **Move N** / **N.** / **N…** | the move number, read from the position | a ply |
| **Ply** | the internal one-based cursor over half-moves; a branch cursor says *branch ply*, a saved line says *from mainline ply* | a move number, or a count worth reading on its own |
| An **evidence reference** | the move itself, named by its SAN | a move number derived from the ply: a game may start from a non-1 fullmove, so only a recorded FEN can produce the number |
| **Game** | one imported or synced chess game | a position, or a Training item |
| **Position** | one board state, identified by its FEN | a game |
| **Reviewed** | the position was looked at in a Training session | solved, known, or mastered |
| **Offline** | the request failed because the network or the local service was unreachable | misconfigured, or empty |
| **Unavailable** | the service answered that it cannot serve this request | offline |
| **Not configured** | no provider or model is set | unavailable, or an error |

Rules that follow from the table:

- A number is never shown without saying what it measures. Accuracy and winning
  chances carry their own labels; a bare percentage is not used for either.
- Maia and Stockfish numbers are never merged into one score.
- "Reviewed" is not a mastery claim anywhere in the interface, including the
  Training report and the review completion.
- Failure states name the cause they actually observed; a failure is never
  presented as an empty result.

## Information layers

The visual language distinguishes three sources:

- Objective: Stockfish score, MultiPV, classification and Accuracy.
- Human: Maia target Elo, candidate probabilities and experimental Find Difficulty.
- Study: generated teaching from canonical facts, with concise provenance and grounding details on demand.

The primary review navigation contains Review, Moves, Study and Analysis — the Engine Lab route under the name that says what it is for. Notebook, Library, Practice and Settings sit under More. Stockfish/Maia/Compare selection lives in Review as `[Stockfish] [Maia · Elo] [Compare]`; target Elo and model are defaults in Settings with a lightweight Review popover. The Review route panel leads with one key-moment action when one exists (or a walk-through line when none does), the current-move line, a single practice text action and a compact nearby-move list. Side and filter controls stay behind Options unless the visitor must pick a side. Engine lines and Game Summary stay collapsed until opened, and both say how they open. Before full-game analysis, its Analyze action precedes position candidates. Engine Lab remains a separate advanced route; its MultiPV rows are the same selectable rows Review shows, in raw UCI form, and the panel's Score and rows always describe the position the board is actually on.

Quality icons come from `packages/ui` and use Move Quality Annotation System V3 across the move list, destination-square overlay, charts, summary and PNG exports. Diamonds identify elite/special moves, circles positive and ring states, rounded squares informational/warning states, and octagons severe errors. The schema classification `great` is presented to users as **Critical**, matching its only-good-move meaning without changing the persisted classification key or algorithm. Silhouette and glyph remain readable at 20–28px without relying on color. The destination-square badge always remains the canonical Stockfish Move Quality icon in Stockfish, Maia and Compare modes; changing analysis source never relabels the played move. Human Find Difficulty keeps its quieter, separate mark family in the evidence panel. Board overlays derive square placement from orientation and square size rather than fixed pixels. The board is warm paper `--board-square-light` `#eee8d9` with celadon/mist `--board-square-dark` `#b1c6c2`, notation `#516a75`/`#38525e`, a 6px radius, one fine outline and the shared board shadow; the flip control sits outside the board.

The project identity is the authored bishop-and-wing artwork kept at `packages/ui/assets/brand/logo.png`: a bishop whose diagonal cut continues into a wing, standing in a window arch with faint foliage and a reflection, painted in dusty periwinkle on warm cream paper. Every mark the product shows is derived from that one file by `scripts/sync-brand-assets.mjs` — the favicon, the app and install icons, the header and review-shell badge, the desktop and mobile shells and the PNG export signature — cropped to the piece alone so the bishop still reads at 16px, with the window frame surviving as background at 180px and above. The crop, the derived sizes and the reason for them are documented in `packages/ui/assets/brand/README.md`. The mark is the only place the bird gesture appears: no literal bird character, mascot, second logo or third-party chess artwork is added anywhere in the product.

The visual system is **Windowlight**: warm paper, mist blue, dusty pink, sage and cream with blue-gray ink. Surfaces are separated mostly by whitespace and fine rules; this is an editorial study environment, not a glassmorphic dashboard. The reference mood is implemented through original tokens and shapes, without copied characters, frames or branded assets.

There is one production light theme. `tokens.css` is the color source of truth: `--surface-page` `#f8f6ef`, `--surface-paper` `#fffef9`, `--surface-raised` `#fbf8f1`, the `--wash-*` atmosphere colors, `--ink-primary`/`-secondary`/`-muted`/`-faint`, `--line`/`--line-soft`/`--line-accent`, `--accent-primary` `#587493` with `--accent-hover` and `--focus-ring`, the board tokens, `--danger`/`--success-soft`/`--warning-soft` semantics, the three paper shadows, the `--rail-*` frame metrics, the two motion durations, and the fallback light layer `--light-cool` / `--light-warm`. The legacy aliases (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--paper`, `--mist`, `--pink`, `--sage`, `--cream`) remain for existing feature stylesheets. There is no second switchable theme and no theme provider: the piece-set preference stays an independent setting.

The environment is the room: `apps/web/public/atmosphere/room.webp`, a compressed
derivative of the reference's `background_pic.png`, painted once and fixed behind the whole
application (`.app-frame::before` in `chrome.css`). Nothing hides it: the frame paints the
photograph under `--room-wash` (6% paper, the veil the reference's own background measures),
the route column adds no surface of its own, the rail thickens its paper only toward its
foot, and the route head carries a soft glow where its words are. Words on the room use the
primary ink tier; the muted and secondary tiers belong to words on paper, and
`e2e/room-contrast.spec.ts` measures every room-sitting element against the pixels the
browser paints. `body` keeps the paper plus the two light washes as the pre-load fallback
(`--light-cool`, `--light-warm`). The photograph never moves and is never a per-screen hero.

Board appearance is centralized in `apps/web/src/lib/board-appearance.ts` as `WINDOWLIGHT_BOARD_APPEARANCE`; Home, Review and the design fixtures spread it into their react-chessboard options instead of repeating hex values, and it references the board tokens by CSS variable. Board interaction states live in `board-move-hints.ts`: a dusty-rose selection with a restrained brass wash, a rose ring for legal captures and a rose dot for quiet moves, all token-owned and kept more visible than the theme. Stockfish (blue), Maia (green), fault (rose) and overlap (teal) arrow families keep their source-aware semantics and are never folded into one aesthetic palette.

Motion stays nearly invisible and has exactly two tiers, both token-owned in `tokens.css`: micro-interactions on controls (`--motion-micro`, 160ms) and the review panel's cognitive-mode changes (`--motion-mode`, 240ms). The review contextual panel fades and travels no more than a few pixels when the visitor moves from the start ply to a key moment, from a key moment into practice, or when a withheld answer is revealed; ordinary ply stepping inside one mode does not animate, and the board column never moves, resizes or bounces. Hover must not change geometry — no rotation, scale, card lift or negative-margin width expansion — and no ambient or looping animation is used. Transparency means reduced visual weight rather than blur: no `backdrop-filter` on the rail, the app header or review titlebar, and repeated dense content is an ink row (transparent with a fine divider) rather than another translucent card. Rare sections such as Game Summary, real popovers and the promotion chooser may remain paper with a shadow. Functional text is at least 11px; 9–10px is reserved for decorative uppercase kickers. Under `prefers-reduced-motion: reduce` every transition and animation collapses to an instant state change, and JS-driven motion does not run at all (`usePrefersReducedMotion`).

The default piece family is **Feather Porcelain**, the authored 512×512 RGBA PNG set served from the versioned directory `/pieces/feather_porcelain_v1_1/`; its persisted setting id remains `liz-blue` for compatibility, and Settings exposes it as “Feather Porcelain” beside the optional `classic` react-chessboard SVG set. The authored masters live once, in `packages/ui/assets/pieces/feather-porcelain-v1.1/`; `scripts/sync-piece-assets.mjs` validates them (exactly twelve files, 512×512, PNG with an alpha channel) and writes the Web copy in `apps/web/public/pieces/feather_porcelain_v1_1/`, and its `--check` mode fails on any drift, so an art revision cannot land in one place only. The mobile companion imports the canonical files through Vite and needs no copy. Piece bytes are cache-first under `/pieces/`, so an art pass publishes into a new version directory instead of overwriting the previous URLs; overwriting bytes at the same URLs instead requires a `CACHE_VERSION` bump in `apps/web/public/sw.js`. PNG export and the promotion chooser use the same piece vocabulary as the board: Feather Porcelain draws the authored PNGs onto the export canvas and the promotion buttons, Classic SVG keeps the Unicode glyph export and its own SVG pieces, and any asset the browser cannot decode falls back to the Unicode glyph so an offline or partial cache never fails an export. The export canvas reads `--board-square-light`/`--board-square-dark` from the document and carries identical literal fallbacks in `png-export.ts`, which a regression test keeps equal to `tokens.css`. Two internal routes are the acceptance environments for this system: `/design/quality-icons` for the Move Quality icons and `/design/pieces` for all twelve pieces at 32/40/48/56/72px on both square colors plus selection, quiet, capture, arrow and badge states. `/design/pieces` also owns the recognition passes — an unlabelled King/Queen/Bishop position behind a reveal, a silhouette pass, a distance blur pass and a side-by-side Classic comparison — because rendering correctly is not the same as being identifiable. `docs/design/2026-09-13-windowlight-implementation.md` records the theme pass and `docs/design/2026-09-14-feather-porcelain-v1-1-integration.md` records the v1.1 art integration and its recognition findings; the older 2026-09-05 proposal is historical.

CSS follows the same component boundary. `tokens.css` owns the palette, type and
shared measurements; `base.css` owns document defaults; `chrome.css`, `home.css`
and `utilities.css` own route-level composition. Review shell, panels, board
workspace and source-aware semantics each have a named stylesheet owner, while
Human, Coach, connected-platform and visual-identity rules stay in their focused
modules. There is no fallback `globals.css` review layer. A regression test locks
the key selector owners so new route-specific styles extend the correct module.

Study move lessons use one decision sequence: What to notice, Your idea, The problem, What happens next, A practical alternative and Remember this. Only slots supported by the response are shown. The short consequence line remains a separate rules-validated UCI/SAN artifact. Review owns the detailed Stockfish/Maia presentation; Study shows only a compact provenance line and places detailed evidence behind “Why this explanation?”. The whole-game lesson is the primary Study action. Review exposes a contextual “Explain this move” action that preserves the board and current ply while opening Study.

Continuation line count (1–5) and displayed PV length (6/8/10/12/16) are configured only in Settings. Review has no separate Top Continuations card: compact Stockfish SAN lines support the board arrows when Stockfish is selected. Arrows are visual hints and are never selected by destination square. An explicit Stockfish row is identified by root FEN, rank, exact UCI and complete PV; an explicit Maia row is identified by FEN, model, target Elo and exact UCI. Selecting a row creates a rules-validated path in the analysis tree. Arrow keys walk the selected branch prefix; stored future PV nodes are only revealed as the user steps forward, and Escape returns to the canonical game.

## Phase 5.1 workspace contract

The board is the primary interaction surface. The refined desktop composition
uses one visual column for player strips, board and board-width transport; the
adjacent contextual column contains current-position evidence and, on Review,
Game Summary with the Evaluation Timeline. A modest amount of panel/document
scrolling is expected; no persistent control may cover a piece. The floating
surfaces — Board settings, More, Export, the practice Options menu and the Maia
quick settings — dismiss with a pointer outside or with Escape, which closes the
open one before it leaves a variation. Inline disclosures in the contextual panel
— Engine lines, Game Summary, the evaluation timeline, the Why? evidence and the
move evidence list — are content rather than floating panels: they stay open
while the visitor steps the game, and they open inside the column that holds them
instead of painting over it. A surface that closes under the pointer re-renders
the column between pointerdown and click, which swallows the click that closed
it; that is why the classification evidence opened in place rather than as a
280px card hanging off its own trigger. Every trigger of a floating
surface says that it opens: the labelled chips and text triggers (More, Export,
the practice Options and Maia settings) carry one small chevron that turns while
the panel is open, the Board settings trigger keeps its icon, and the Why?
summary keeps the disclosure marker it draws as an inline disclosure. No trigger relies on a hidden
marker alone.

Board transport follows First, Previous, Play/Pause, Next and Last. Autoplay
stops at the canonical game end and pauses before entering or while exploring a
variation. Board flip is an icon-only, labelled control outside the squares.
Flipping changes player-strip placement and evaluation-bar presentation, never
the canonical White-POV score.

Board ergonomics are user-controlled on desktop. `lib/review-shortcuts.ts` is the
single shortcut table: the key handler, the `?` overlay and the Help page all read
it, so a shortcut cannot be documented without existing. The current map is
`←`/`J` previous, `→`/`K` next, `↑` first, `↓` last, `Space` play/pause, `Esc`
leave a variation or exit Focus board, `F` flip, `Z` Focus board, `/` type a
move, `?` the overlay. Shortcuts never fire from a form control, a link, a button or a slider,
and the whole map is suspended while the promotion chooser or the overlay owns
the keyboard. The board-size preference is stored in settings and applied as
`--review-board-preference` on the workspace; the CSS clamp `--review-board-max`
keeps a stored size inside what the viewport can afford and the responsive
default applies below 901px, where the size control is hidden. The control
displays the width the board actually rendered at, not the requested value, and
writes only when the interaction ends. Focus board is one session-only mode:
one column, no context panel, board bounded by the viewport, player strips, eval
bar and transport kept, and an Exit focus board control in Board settings that
reports its state. Focus is never persisted.

Board feedback preferences live in Settings under *Board and display* and are
applied by `useBoardDisplaySettings()`, which subscribes to the settings event
instead of joining the review shell's analysis snapshot — a display change must
apply immediately, while a depth change must not churn an in-flight engine
request. Coordinates are *inside the squares* or *off*; analysis arrows are the
Stockfish/Maia candidates only, and the red practice arrow is never hidden by
them; the Move Quality badge can be turned off; piece animation is *Off* (0 ms),
*Fast* (90 ms) or *Natural* (160 ms), and no other motion is offered; move-list
emphasis is *Key moves only* (default) or *All analyzed moves* and only changes how
strongly a row is drawn, never whether it is listed. Emphasis and the *Key* filter
share one definition of a key move — the canonical critical moments — so the two
can never disagree.

Player strips consume PGN headers first and enrich a synced game from its exact
IndexedDB account/game record. Ratings come from sync metadata or `WhiteElo` /
`BlackElo`. When Site/Link/Source identifies Chess.com or Lichess, or the game
was imported from a connected account, both players' public avatars are fetched
through an allowlisted server route and cached in IndexedDB for seven days.
If a remote image is unavailable, the strip keeps a readable initials fallback.
Lichess accounts often have no uploaded photo.

Analysis arrows have explicit source semantics. Stockfish arrows are objective
MultiPV candidates; Maia arrows are policy probabilities at the selected target
Elo; Compare shows both and uses a distinct dual-source arrow when they overlap.
Overlap means exact full UCI equality, including promotion—not merely a shared
destination square. Compare never gives one source priority during selection.
No synthetic chess score is calculated. The evaluation bar uses Stockfish
WinPercent in Stockfish mode, exact-position root human-game WDL in Maia mode,
and a Stockfish bar plus Maia marker in Compare. Recommendation comparison shows
both top moves, Maia probability and Stockfish rank as separate evidence. Text
continuations remain compact supporting evidence. Maia target Elo and model are
persisted in Settings.

Both arrow sources are hints the user can inspect, and the visitor may also draw
their own: a right-click drag on the review board adds an arrow, right-click
clears it, and moving to another position clears drawings because an arrow
describes one position. Drawn arrows are merged with the engine arrows rather
than replacing them, and they are session state — never written to the record,
the analysis or the export. This is a pointer gesture: touch devices have no
equivalent gesture implemented yet, so arrow drawing is desktop-only for now.

Clicking a side-to-move piece highlights legal destinations with dots for quiet
moves and rings for captures; clicking a destination moves it. Dragging remains
available. Either interaction from any historical position creates or extends a
runtime analysis branch. The UI clearly leaves canonical autoplay, retains the branch
root ply, automatically analyzes each resulting FEN with the active Review source,
and offers Return to Game with a visible “Temporary variation · not saved” notice. Canonical PGN,
Accuracy, classifications and cached canonical game analysis are never edited by this
interaction. Promotion drops currently default to a queen; the rules helper
already accepts an explicit underpromotion for a future chooser. The branch
model is detailed in [`analysis-variations.md`](analysis-variations.md), and the
implementation status for each workspace part is kept in `docs/roadmap.md`.

## Tablebase

Engine Lab's third tab is **Tablebase**, and it is correctness rather than
parity: a tablebase result is a provable outcome, which is a different class of
claim from an engine evaluation. It appears only when the standard seven-piece
Syzygy tables cover the position. Above that limit the panel says how many pieces
are on the board and states that the engine evaluation is the only evidence
available — an engine score is never translated into "winning". The tab is hidden
during practice for the same reason the other analysis surfaces are.

For a covered position the panel shows the position result, DTZ and DTM when the
tables report them, the piece count and the table identity, and every legal move
grouped by its own proven outcome. Outcome categories are kept as the tables
report them: `cursed-win` and `blessed-loss` are not collapsed into win and loss,
because the fifty-move rule can still save those positions. A move that reaches a
position the tables do not carry is labelled as a conversion.

`packages/tablebase` owns the contract, the piece-count rule and the
normalization; `GET /api/tablebase` is the only code that talks to
`tablebase.lichess.ovh`, forwards only the position identity (EPD), and rejects an
over-limit position rather than returning a result. Answers are cached in the
`remote-positions` IndexedDB store with the Opening Explorer, under the same
stale-labelling rule.

## Opening Explorer

Engine Lab carries three tabs: **Engine** (the existing evaluation workspace),
**Explorer** and **Tablebase**. They share one panel because all three investigate
the current position; the Explorer is not part of guided Review and never feeds the
objective analysis.
Tabs are hidden while a practice answer is owed, because "what is usually played
here" is a spoiler for the exercise.

The Explorer answers *what is played from here*, which is a different question
from opening recognition. It shows, for the current position: the total games, the
White/Draw/Black split, each candidate move's SAN, game count and split ordered by
frequency, and the recognised opening name when the database supplies one. The
visitor can switch between *All players* (human games at a chosen rating floor and
time-control set, 1600+ and blitz/rapid/classical by default) and *Masters* (one
elite database with no rating floor, filtered by time control only); selecting a
move explores it on the board as a variation. Frequencies
are other players' games, never an evaluation — Stockfish still decides what is
best, and the panel says so. The numbers always carry their context: which
database, which population it covers and the exact position (the board's FEN) they
describe, so "these are human frequencies", "this is a position nobody has
played" and "this lookup failed" cannot be confused. Frequency data never replaces
a Maia probability or a Stockfish evaluation.

The panel's state is explicit and its own: **loading**, **fresh**, **stale**
(an expired cached answer whose refresh failed, labelled with its age),
**empty** (the database carries no game that reached this position),
**unreachable/offline**, **rate-limited** (HTTP 429) and **failed**. Each
non-loading failure state offers **Retry explorer**, which re-issues this panel's
request alone — it never reloads the route, re-runs the game review or disturbs
the board or the loaded analysis. A late answer for a position the visitor has
left is discarded, so the numbers on screen always belong to the position named
beside them.

The data is third-party reference data from the public lichess.org opening
explorer, which has required an API token on every request since March 2026. The token
is deployment configuration (`LICHESS_EXPLORER_TOKEN`) held only on the server; without
it the panel says the lookup is unconfigured rather than showing an upstream 401 as a
broken site. The browser never calls lichess.org directly: `GET /api/explorer`
validates the request, forwards only the position identity (EPD) and the chosen
database, validates the upstream payload, and returns the normalized structure
defined in `packages/openings/src/explorer.ts`. An unusable upstream payload is
reported as an error rather than rendered as a partial table, because a partial
table would show missing games as zero games. Answers are cached in the
`remote-positions` IndexedDB store; an expired answer is used only when the
refresh fails, and it is then labelled with its age. The panel and the Help page
both state that the position is sent to lichess.org — this product does not
introduce a network call silently.

The population is chosen in the panel: a rating floor (1200+, 1600+, 2000+, 2200+ or
every rating) and a speed set (blitz/rapid/classical, one speed, or every speed). The
numbers name the population they count beside them ("All players database · rated
2000+ · rapid"), the choice is part of the cache identity so two populations can never
answer for each other, and the request carries the position, the database and the
population — never a game, account or identifier from the local library. The masters
cohort has no rating buckets, so that control is not offered for it and no rating floor
is sent to it.

## Service states

Public Browser Core never probes localhost AI. Settings omits provider/model
controls and Study offers grounded summaries using existing analysis. Enhanced
Local on a loopback hostname distinguishes checking, ready, unreachable and
misconfigured services; missing models have a separate setup state. Its Maia
selector and Coach poll for recovery without hiding objective review. Settings
lists the installed Ollama catalog and 5M/23M/79M Maia cache states. Choosing a
model never downloads it silently. Health responses are validated before UI use.
The interface language is its own preference — English or 简体中文, English by
default — and covers the lesson panel, which is the translated surface today;
Coach output has an independent English/Chinese preference, preserving existing
choices. Choosing a Chinese lesson does not translate the controls around it.
Home and Settings link to Help for setup, capabilities, data destinations,
backups and manual feedback.

## Chess audio

Chess sound is centralized in the web sound controller and derived from a
legal `fenBefore + UCI` transition. Components must not construct `Audio`
objects or choose sounds from button identity. Move precedence is checkmate,
stalemate, check, castle, promotion, capture, then quiet move. Navigation plays the real
move entered or undone; returning from a branch to its canonical root is
silent. Initial page load, source/Elo changes, resize, flip, and graph hover are
silent.

Audio unlocks/preloads only after a user gesture. Rejected playback never
changes chess state. Sound enabled, restrained volume, and the WintrChess theme
are persisted in application settings, with an immediate mute control beside
the board flip utility. The six MP3 sources match WintrChess; this controller
intentionally emits one cue per transition instead of overlapping game-end and
check cues.

## Connected identity and Library

Home shows compact connected identities with avatar/initials fallback, useful
ratings, sync status and a Settings link. Account linking, disconnect and explicit
full-history import remain in Settings. Sync controls expose Sync newest,
Import full history, Pause and Resume; progress and retry/error copy come from the
persisted checkpoint rather than transient component state.

Library keeps source, review status, time-control, result and text filters. It
sorts the merged reviewed/pending collection by date and renders at most 60 rows
per page, with an explicit Load more control for larger collections. Incremental
sync does not mount or analyze every imported game; an explicit full-history
import queues local objective Stockfish work and Training reveals its progress.
History uses the same inline ink statistics and disclosure treatment as Training.
Its counts describe the currently filtered merged list, including manual review
records, rather than the platform-sync collection alone.

## Advanced study and training

`/training` is a player-development workspace, not a concatenated report.
Connected games default to the linked account color; manual PGNs expose both
meaningful named players. Quiet grouped navigation switches one active view at a
time: Overview, then Analysis (Rating, Openings, Middlegame, Endgame),
Improvement (Mistakes, Highlights, Plan) and Data (Coverage). Overview is a
summary: one paper profile, up to three faint observed-phase washes, Focus now, compact
highlight counts and a short form strip. Repeated facts in dedicated views use
ink rows. Phases with zero observed moves are omitted instead of showing an
Accuracy placeholder. The trend chart links back to each review. Weakness, highlight and
queue evidence links include the exact canonical ply so Review opens on the
source decision.

Advanced filters are kept in one shared population scope disclosure
(`All platforms · ... · N games`); opening it reveals the full filter set without
changing the report population. While analysis is running, a quiet status line
(`47 / 95 games analyzed · analysis running`) stays visible above the journal.

The report itself needs a population to answer for. It renders once the selected
player has at least five games, or once a training task is queued; below that,
Training shows today's task and the run journal instead of a statistics wall built
from one or two games. The decision follows the player's own population, not the
active filter, so narrowing a filter to an empty scope leaves the report standing
and says the scope is empty. The run journal does not depend on that decision: a
queued, running, paused or failed run keeps its own controls (Resume, Cancel,
Remove) wherever its status is reported, because the status line alone would
otherwise announce work with no way to continue it.

Coverage answers for the report's own filtered population and names its state: an
empty scope says there is nothing to cover, a partial one says the report is partial,
and only a complete one claims complete current analysis coverage.

The player list includes every linked account that has imported games, counted by
its imported population, whether or not those games have been analyzed yet: an
account is a population before it is a report. When the selected account's imported
games have no analysis yet, the folded page shows the analysis start control
(*Analyse imported games*, freshness, start) scoped to that account, because that is
the work the state is asking for.

Whole-history run history is secondary to the resulting data. Active/error runs
and the latest useful terminal run remain visible; older terminal runs sit under
`Past analysis runs`, and successful item lists start collapsed. `Remove from
history` and `Clear finished runs` delete only batch-job records. They never delete
synced games, review records, objective cache or Training data, and an active run
must be cancelled before removal.

A training review carries what it was worth — produced unaided, reached with help, or
read with the evidence on screen — and only unaided reviews advance mastery
(`learning → review → mastered`) on a fixed 1/3/7/21-day ladder, and only when the position
had come due: an early review is recorded and earns nothing. A position that is not due again
says so (`This position is not due again until <date>`), and the review actions appear only for
work that is ready. Training states `N due
now` or the next due date, and a task's row states `mastered/reviewed`, so the interface
never presents "reviewed" as mastery.

No weakness is presented as recurring until the deterministic signal occurs in
at least two distinct games. Move-quality icons and labels reuse the shared V3
system. Training status supports queued, in progress and completed, remains in
IndexedDB after refresh, and is never inferred from Coach text. Start review and
Continue review open the first pending source position. A task panel beside the
desktop board (below it on mobile) offers explicit confirmation, saved progress,
Next position and Pause. Confirmation requires the canonical task position and
loaded objective evidence. Repeated visits never add credit. Completed means
all positions were explicitly reviewed, not solved or mastered; historical manual
completions remain labelled separately. Tasks remain available without analysis
caches, including after [backup restoration](library-backup.md). At mobile width,
all sections stack without document-level horizontal overflow.
