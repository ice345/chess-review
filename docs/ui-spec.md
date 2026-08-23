# UI specification

## Information architecture

The product is route-based rather than a single analysis dashboard:

- `/` owns PGN/FEN import and recent reviews.
- `/review/[gameId]` is the objective review.
- `/review/[gameId]/moves` is the move explorer.
- `/review/[gameId]/human` is Maia analysis.
- `/review/[gameId]/coach` is grounded coaching.
- `/review/[gameId]/engine` is the advanced Stockfish lab.
- `/history` and `/settings` are application utilities.

Import UI is never mounted inside the review workspace. A valid input is normalized, saved as a deterministic IndexedDB review record, and navigated to its review route. The objective cache remains separate and is not duplicated by routing.

## Persistent review shell

The nested review layout owns the board, evaluation bar, selected ply, orientation, move controls, current verdict and evaluation timeline. Client-side transitions replace only the contextual right panel, so board state persists across Review, Moves, Human, Coach and Engine.

At desktop sizes the review is a normal document, typically about 1.3–1.6 viewports for an ordinary game. The opening spread gives the board roughly 540–610 CSS pixels and places current-position study beside it. The 240–320-pixel plot area sits full-width below. Dense route content extends the document instead of creating a nested scrolling dashboard.

Below the tablet breakpoint, the route panel stacks under the board and normal document scrolling resumes. Move navigation remains adjacent to the board. There must be no horizontal document overflow.

## Information layers

The visual language distinguishes three sources:

- Objective: Stockfish score, MultiPV, classification and Accuracy.
- Human: Maia target Elo, candidate probabilities and experimental Find Difficulty.
- Coach: generated explanation with source, confidence and grounding details.

The primary review navigation contains Review, Moves, Human and Coach. Engine Lab is deliberately placed under the secondary More menu. Exports are grouped in one menu and retain Canonical JSON, Annotated PGN, Position PNG and Game Review PNG.

Quality icons come from `packages/ui` and use one original soft annotation/blob SVG language across move list, destination-square overlay, charts, summary and PNG exports. They retain non-color symbols. Board overlays derive square placement from orientation and square size rather than fixed pixels. The board uses warm cream and mist-blue squares; the flip control sits outside the board.

The visual system uses warm paper, mist blue, dusty pink, sage and cream with blue-gray ink. Surfaces are separated mostly by whitespace and fine rules; this is an editorial study environment, not a glassmorphic dashboard. The reference mood is implemented through original tokens and shapes, without copied characters, frames or branded assets.

Top Continuations separates requested line count (1–5 in the ordinary review) from displayed PV length (6/8/10/12/16). Clicking a line enters a clearly labeled temporary variation. Arrow keys walk that variation and Escape returns to the game.

## Service states

Browser Core remains useful when local-ai is offline. Human and Coach routes use short capability-specific copy, poll for recovery, and never hide objective review. Settings presents Maia, Ollama service and configured Ollama model as distinct states. A missing model shows an explicit setup command; it never triggers a silent download.
