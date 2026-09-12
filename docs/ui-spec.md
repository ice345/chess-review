# UI specification

## Information architecture

The product is route-based rather than a single analysis dashboard:

- `/` owns PGN/FEN import, a decorative position preview, Chess.com/Lichess connect-and-sync, and recent reviews. Chess.com and Lichess are account actions, not import modes.
- `/review/[gameId]` is the objective review.
- `/review/[gameId]/moves` is the move explorer.
- `/review/[gameId]/coach` is the Study surface for grounded move lessons and whole-game learning (the URL remains stable).
- `/review/[gameId]/engine` is the advanced Stockfish lab.
- `/history`, `/training` and `/settings` are application utilities.

Import UI is never mounted inside the review workspace. A valid input is normalized, saved as a deterministic IndexedDB review record, and navigated to its review route. The objective cache remains separate and is not duplicated by routing.

Home places paste, Open PGN file, Analyze game and the complete Opera Game
example in its opening section. File selection/drop and pasted collections share
an explicit multi-game chooser. Mobile reading/tab order puts the form before
the non-interactive board preview. Returning users have a Continue last review
link above the form. See [PGN import and export](pgn-import-export.md) for limits,
source preservation and selection behavior.

## Persistent review shell

The nested review layout owns the board, evaluation bar, selected ply, orientation, move controls and current verdict. Review's Game Summary owns the evaluation timeline inside the contextual panel. Client-side transitions replace only the contextual right panel, so board state persists across Review, Moves, Study and Engine Lab.

At desktop sizes the opening review fits the players, board and move transport
within the viewport at the R2 acceptance sizes. Board size responds to both
width and available height: measured 424px at 1280×720, 472px at 1366×768,
540px at 1440×900 and 600px at 1920×1080. Sound/flip share the upper player row;
the titlebar is compact. The contextual column scrolls within the board column's
height. On Review, Game Summary stays in that column; the evaluation plot is
collapsed until opened. No timeline is added below the board.

Below the tablet breakpoint, the route panel stacks under the board and normal document scrolling resumes. Move navigation remains adjacent to the board. There must be no horizontal document overflow.

## Information layers

The visual language distinguishes three sources:

- Objective: Stockfish score, MultiPV, classification and Accuracy.
- Human: Maia target Elo, candidate probabilities and experimental Find Difficulty.
- Study: generated teaching from canonical facts, with concise provenance and grounding details on demand.

The primary review navigation contains Review, Moves and Study. Notebook and Engine sit under More; Settings stays in the titlebar. Stockfish/Maia/Compare selection lives in Review as `[Stockfish] [Maia · Elo] [Compare]`; target Elo and model are defaults in Settings with a lightweight Review popover. The Review route panel leads with a one-line key-moment entry when one exists (or a walk-through line when none does), the practice launcher and a compact move list, then the current-move line and analysis source. Whole-game Accuracy, phases and Move Quality stay visible in Game Summary; the evaluation timeline in that same card is collapsed until opened. Before full-game analysis, its Analyze action precedes position candidates. Engine Lab remains a separate advanced route.

Quality icons come from `packages/ui` and use Move Quality Annotation System V3 across the move list, destination-square overlay, charts, summary and PNG exports. Diamonds identify elite/special moves, circles positive and ring states, rounded squares informational/warning states, and octagons severe errors. The schema classification `great` is presented to users as **Critical**, matching its only-good-move meaning without changing the persisted classification key or algorithm. Silhouette and glyph remain readable at 20–28px without relying on color. The destination-square badge always remains the canonical Stockfish Move Quality icon in Stockfish, Maia and Compare modes; changing analysis source never relabels the played move. Human Find Difficulty keeps its quieter, separate mark family in the evidence panel. Board overlays derive square placement from orientation and square size rather than fixed pixels. The board uses warm cream and mist-blue squares; the flip control sits outside the board.

The project identity is the original Blue Bishop: a simplified bishop silhouette whose diagonal cut continues into a restrained feather/wing gesture. The mark uses a dusty-periwinkle bishop on warm cream paper, with a pale-gold inner wing. The same geometry is used for the generated Next.js favicon, square app mark, header mark and PNG export signature. The bishop remains legible at 16px; there is no literal bird character or third-party chess artwork.

The visual system uses warm paper, mist blue, dusty pink, sage and cream with blue-gray ink. Surfaces are separated mostly by whitespace and fine rules; this is an editorial study environment, not a glassmorphic dashboard. The reference mood is implemented through original tokens and shapes, without copied characters, frames or branded assets.

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
scrolling is expected; no persistent control may cover a piece.

Board transport follows First, Previous, Play/Pause, Next and Last. Keyboard
left/right navigation remains. Autoplay stops at the canonical game end and
pauses before entering or while exploring a variation. Board flip is an
icon-only, labelled control outside the squares. Flipping changes player-strip
placement and evaluation-bar presentation, never the canonical White-POV score.

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

## Service states

Public Browser Core never probes localhost AI. Settings omits provider/model
controls and Study offers grounded summaries using existing analysis. Enhanced
Local on a loopback hostname distinguishes checking, ready, unreachable and
misconfigured services; missing models have a separate setup state. Its Maia
selector and Coach poll for recovery without hiding objective review. Settings
lists the installed Ollama catalog and 5M/23M/79M Maia cache states. Choosing a
model never downloads it silently. Health responses are validated before UI use.
The interface is English; Coach output has an independent English/Chinese
preference, preserving existing choices. Home and Settings link to Help for
setup, capabilities, data destinations, backups and manual feedback.

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

Whole-history run history is secondary to the resulting data. Active/error runs
and the latest useful terminal run remain visible; older terminal runs sit under
`Past analysis runs`, and successful item lists start collapsed. `Remove from
history` and `Clear finished runs` delete only batch-job records. They never delete
synced games, review records, objective cache or Training data, and an active run
must be cancelled before removal.

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
