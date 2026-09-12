# PGN import and export

Web R2 (2026-09-06) adds local `.pgn` file selection and file drop to Home.
Pasted PGN uses the same validation and game chooser. FEN remains a separate,
explicit position input; image/OCR import is outside the product boundary.

## Input contract

- Read one UTF-8 `.pgn` file at a time, up to 1 MiB (1,048,576 bytes).
- Accept up to 100 games in that file or pasted collection.
- Validate every game before offering the collection. An invalid game reports
  its index; nothing is partially saved.
- A single valid game fills the editable input. Analyze game starts its review.
- Multiple games require an explicit selection. Only the selected game is saved
  and analyzed; the UI states that the others remain in the original file.
- A rejected file leaves the previously entered game intact. Opening a file
  does not upload it to a server.

`apps/web/src/lib/pgn-import.ts` frames games, then delegates PGN validation and
legal mainline parsing to `packages/chess-core`. The framing scan recognizes
quoted/escaped tags, non-nesting brace comments, line comments, recursive
variations, top-level result markers, and a new header section after movetext.
Result-like text in comments, tags or variations cannot split a game. Unclosed
comments/tags/variations produce an actionable error. This does not introduce a
second chess parser or change analysis semantics.

Framing follows the [PGN specification, sections 7 and 8](https://www.saremba.de/chessgml/standards/pgn/pgn-complete.htm).
The application requires at least one legal mainline move for a game review;
use FEN for a position without moves. Comments, NAGs and variations are read as
source text and shown on the move they annotate (see below). Interactive review
and analysis still operate on the canonical mainline, not on every imported
variation.

## Source versus analysis exports

The Export menu offers **Original PGN** for PGN records, including before engine
analysis completes. The application-level optional `ReviewRecord.originalPgn`
retains the selected game's original decoded text, including comments, NAGs,
variations and line endings. Editing the input makes the edited text the new
source. Export does not incorporate exploratory moves.

Older records without that field export `record.input`, which already retains
their imported PGN. Outer whitespace trimmed by an older import cannot be
reconstructed. A selected game from a collection exports only its own framed
text. This is source-text preservation, not a promise to preserve the source
file's byte encoding or byte-order mark.

**Annotated PGN** is the mainline export with objective analysis annotations. As
of S4 it is a superset of the imported source rather than a replacement for it:
the author's comments, NAGs and recursive variations are re-emitted alongside
the generated evidence. They stay display-and-export only — no imported text
enters classification, Accuracy or the coach facts, so "why this label" remains
answerable from canonical evidence alone.

The exporter must hold one hard constraint: the PGN grammar in `chess.js` 1.4.0
accepts **at most one comment per move**, in the order `SAN NAG* comment?
variation*`. A second comment after the same move makes the whole file
unparseable. The author's note is therefore merged into the single generated
comment as an `Imported note:` entry rather than emitted as a second comment.
`packages/analysis/src/export-roundtrip.test.ts` re-imports the annotated export
through this product's own parser to keep that guarantee.

Reading the annotations is `packages/shared/src/pgn-annotations.ts`, the
counterpart to the PGN writer. It maps comments, NAGs and variations onto ply
indexes and drops the mapping when its move count disagrees with the replayed
mainline, so a mis-read annotation can never be attached to the wrong move. The
review's Moves view shows the imported comment, the conventional `$1`–`$6`
glyphs and the variation text next to the move they annotate.

This is still not a variation *tree*: imported variations are shown and
re-exported verbatim, not replayed as playable branches. Editing a variation and
exporting it back is not implemented. FEN-only records carry no annotations.

## Sharing a reviewed game by link

**Copy share link** in the Export menu builds `/share#pgn=<base64url>`. The
payload travels in the URL **fragment**, which browsers never send to the
server, so the host sees only `GET /share` and no game content is uploaded. The
recipient's browser decodes the fragment, imports the game into its own local
library and opens the review.

- Budget: `MAX_SHARE_PGN_BYTES = 4096` of raw UTF-8 PGN. A larger game returns
  no link and the menu says to use **Original PGN** instead.
- The link is always shown as a selectable field as well as copied, because the
  clipboard API is unavailable or permission-gated on some browsers.
- `/share` is `noindex`, and an unreadable payload explains itself instead of
  failing silently. Changing only the fragment does not reload the document, so
  the page also re-reads on `hashchange`.

The optional source field does not change deterministic record IDs, database
version, cache identity, canonical analysis schemas or algorithm versions.

## Complete example and learning entry

Home loads the 33-ply Opera Game, ending with `17. Rd8#`, from
`apps/web/src/lib/example-game.ts`. The historical game is Morphy versus Duke
Karl / Count Isouard, Paris, 1858; context is documented by
[Chess.com's Opera Game reference](https://www.chess.com/terms/opera-game-chess)
and [Morphy biography](https://www.chess.com/players/paul-morphy).
The fixture contains the game moves and identifying tags, without third-party
commentary. Unit coverage verifies legal parsing and checkmate. Browser E2E
runs actual Stockfish WASM with local-ai unavailable and verifies the completed
review, canonical critical-moment navigation and grounded Study entry.

The opening review panel links to the first available canonical critical
moment. It does not assign new labels, change scores or invent a pedagogical
ranking. If none was flagged, it offers ordinary move exploration and Study
with an honest empty-state message. No LLM explanation runs automatically.

Exploratory variations display **Temporary variation · not saved**. Return to
game / Escape uses the existing runtime-tree exit behavior. Durable personal
variations and training progress are separate future work.
