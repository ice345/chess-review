# UI specification

## Information architecture

The product is route-based rather than a single analysis dashboard:

- `/` owns PGN/FEN import and recent reviews.
- `/review/[gameId]` is the objective review.
- `/review/[gameId]/moves` is the move explorer.
- `/review/[gameId]/coach` is grounded coaching.
- `/review/[gameId]/engine` is the advanced Stockfish lab.
- `/history` and `/settings` are application utilities.

Import UI is never mounted inside the review workspace. A valid input is normalized, saved as a deterministic IndexedDB review record, and navigated to its review route. The objective cache remains separate and is not duplicated by routing.

## Persistent review shell

The nested review layout owns the board, evaluation bar, selected ply, orientation, move controls, current verdict and evaluation timeline. Client-side transitions replace only the contextual right panel, so board state persists across Review, Moves, Coach and Engine.

At desktop sizes the review is a normal document, typically about 1.3–1.6 viewports for an ordinary game. The opening spread gives the board roughly 540–610 CSS pixels and places current-position study beside it. The 240–320-pixel plot area sits full-width below. Dense route content extends the document instead of creating a nested scrolling dashboard.

Below the tablet breakpoint, the route panel stacks under the board and normal document scrolling resumes. Move navigation remains adjacent to the board. There must be no horizontal document overflow.

## Information layers

The visual language distinguishes three sources:

- Objective: Stockfish score, MultiPV, classification and Accuracy.
- Human: Maia target Elo, candidate probabilities and experimental Find Difficulty.
- Coach: generated explanation with source, confidence and grounding details.

The primary review navigation contains Review, Moves and Coach. Engine Lab is deliberately placed under the secondary More menu. Stockfish/Maia/Compare selection, target Elo and Maia model live in Review. Exports are grouped in one menu and retain Canonical JSON, Annotated PGN, Position PNG and Game Review PNG.

Quality icons come from `packages/ui` and use the original Feather Annotation V2 language across move list, destination-square overlay, charts, summary and PNG exports. Every objective classification has a distinct open watercolor motif and readable non-color symbol; no common enclosed badge shape carries the semantics. Human Find Difficulty uses a quieter separate mark family. Board overlays derive square placement from orientation and square size rather than fixed pixels. The board uses warm cream and mist-blue squares; the flip control sits outside the board.

The project identity is the original Blue Bishop: a simplified bishop silhouette whose diagonal cut continues into a restrained feather/wing gesture. The same geometry is used for the generated Next.js favicon, square app mark, header mark and PNG export signature. The bishop remains legible at 16px; there is no literal bird character or third-party chess artwork.

The visual system uses warm paper, mist blue, dusty pink, sage and cream with blue-gray ink. Surfaces are separated mostly by whitespace and fine rules; this is an editorial study environment, not a glassmorphic dashboard. The reference mood is implemented through original tokens and shapes, without copied characters, frames or branded assets.

CSS follows the same component boundary. `tokens.css` owns the palette, type and
shared measurements; `base.css` owns document defaults; `chrome.css`, `home.css`
and `utilities.css` own route-level composition. Review shell, panels, board
workspace and source-aware semantics each have a named stylesheet owner, while
Human, Coach, connected-platform and visual-identity rules stay in their focused
modules. There is no fallback `globals.css` review layer. A regression test locks
the key selector owners so new route-specific styles extend the correct module.

Coach move lessons use one decision sequence: What to notice, Your idea, The problem, What happens next, A practical alternative and Remember this. Only slots supported by the response are shown. The short consequence line remains a separate rules-validated UCI/SAN artifact, and objective and Maia source cards remain visually distinct from generated prose.

Continuation line count (1–5) and displayed PV length (6/8/10/12/16) are configured only in Settings. Review has no separate Top Continuations card: compact Stockfish SAN lines support the board arrows when Stockfish is selected. Selecting an arrow endpoint or line creates a rules-validated engine path in the analysis tree. Arrow keys walk that branch and Escape returns to the canonical game.

## Phase 5.1 workspace contract

The board is the primary interaction surface. The refined desktop composition
uses one visual column for player strips, board, board-width transport and the
full Evaluation Timeline. Move quality, move list, critical moments and route
context form the adjacent column. A modest amount of document scrolling is
expected; no persistent control may cover a piece.

Board transport follows First, Previous, Play/Pause, Next and Last. Keyboard
left/right navigation remains. Autoplay stops at the canonical game end and
pauses before entering or while exploring a variation. Board flip is an
icon-only, labelled control outside the squares. Flipping changes player-strip
placement and evaluation-bar presentation, never the canonical White-POV score.

Player strips consume PGN headers first and enrich a synced game from its exact
IndexedDB account/game record. Ratings come from sync metadata or `WhiteElo` /
`BlackElo`; only the connected player's provider avatar is requested. If that
remote image is unavailable, the strip keeps a readable initials fallback.
Opponent profiles are not fetched during sync or ordinary review.

Analysis arrows have explicit source semantics. Stockfish arrows are objective
MultiPV candidates; Maia arrows are policy probabilities at the selected target
Elo; Compare shows both and uses a distinct dual-source arrow when they overlap.
No synthetic chess score is calculated. The evaluation bar uses Stockfish
WinPercent in Stockfish mode, exact-position root human-game WDL in Maia mode,
and a Stockfish bar plus Maia marker in Compare. Recommendation comparison shows
both top moves, Maia probability and Stockfish rank as separate evidence. Text
continuations remain compact supporting evidence. Maia target Elo and model are
persisted in Settings.

Clicking a side-to-move piece highlights legal destinations with dots for quiet
moves and rings for captures; clicking a destination moves it. Dragging remains
available. Either interaction from any historical position creates or extends a
runtime analysis branch. The UI clearly leaves canonical autoplay, retains the branch
root ply, automatically analyzes each resulting FEN with the active Review source,
and offers Return to Game. Canonical PGN,
Accuracy, classifications and cached `GameAnalysisV1` are never edited by this
interaction. Promotion drops currently default to a queen; the rules helper
already accepts an explicit underpromotion for a future chooser. The branch
model is detailed in [`analysis-variations.md`](analysis-variations.md), and the
implementation status for each workspace part is kept in `docs/roadmap.md`.

## Service states

Browser Core remains useful when local-ai is offline. Review's Maia selector and Coach use short capability-specific copy, poll for recovery, and never hide objective review. Settings lists every model returned by Ollama's local catalog and lets the user choose one. Maia Settings separately shows 5M/23M/79M cache status and an explicit Download model action. Selecting either an Ollama or Maia model never triggers a silent download.

## Connected identity and Library

Home shows compact connected identities with avatar/initials fallback, useful
ratings, sync status and a Settings link. Account linking, disconnect and explicit
full-history import remain in Settings. Sync controls expose Sync newest,
Import full history, Pause and Resume; progress and retry/error copy come from the
persisted checkpoint rather than transient component state.

Library keeps source, review status, time-control, result and text filters. It
sorts the merged reviewed/pending collection by date and renders at most 60 rows
per page, with an explicit Load more control for larger collections. Syncing never
mounts or analyzes every imported game automatically.
