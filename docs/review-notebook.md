# Personal review notebooks

S1 adds a Notebook section to the persistent review workspace for PGN games and
explicit FEN studies. It is free Browser Core functionality and requires neither
an account nor a local AI service.

## Saved data

`ReviewNotebookV1` lives in `review-notebooks`, keyed by its source review ID.
IndexedDB v8 adds this store without rewriting v7 records. Each entry contains:

- `rootPly`: a position in the original game's mainline (zero for FEN).
- `line`: legal UCI moves from that position to the saved endpoint; empty for a
  mainline position note/bookmark.
- `title`, plain-text `note`, and `bookmarked`.
- A deterministic root/path ID, an opaque edit revision, and creation/update times.

SAN and FEN are reconstructed with chess-core. Import and restore replay every
move and reject illegal lines, out-of-range roots, wrong source IDs, duplicate
entries, oversized fields and unknown record versions. Engine evaluations,
classification evidence, Maia predictions, generated Coach output and runtime
branch nodes are not notebook fields. They cannot be imported as chess facts.
Limits are 200 entries per notebook, 64 plies per line, 5,000 characters per note
and 100 per title. There is no new production dependency.

## Editing and returning to a line

Save is explicit. Only the branch through the selected node is saved; future PV
moves and siblings are excluded. To keep another branch or a longer endpoint,
navigate to it and save another entry. Opening an entry builds a fresh legal
runtime line, restores its canonical root cursor, and selects the saved endpoint.
Return to Game still returns to that root. Original PGN and canonical analysis
exports remain separate and unchanged.

Unsaved drafts stay in memory across client-side navigation in the same tab,
including changing positions, sections and returning to a review. The panel
lists draft positions so users can find them again. At most 200 drafts can be
held in the tab. While a review is open, a full reload/close with pending drafts
raises the browser's unload warning where supported. Drafts are not durable,
not in backups, and do not survive a full page reload or browser restart. Save
before leaving. A committed save acknowledgement names the saved position in
state and is shown only while that position is displayed.

Save/delete reads the source review and compares the edited entry's revision in
the same epoch-checked IndexedDB transaction. Independent positions merge;
competing edits to one entry fail without overwriting the newer version. The UI
retains the failed draft and offers an explicit discard/reload action. Quota
failure does not display a saved state. Deleting the source review or an
account's linked reviews removes their notebooks atomically. Cache-only clear
preserves notebooks; full reset clears them. Old writers cannot resurrect them.

## Backup and compatibility

Library backup v2 includes a `notebooks` collection. V1 files still restore and
leave existing notebooks intact. V2 notebooks must reference a source review in
the same backup. Validation strips arbitrary extra fields, previews whole-book
conflicts, and commits notebook/source/task writes together. The preview is
invalidated by notebook edits in another tab. Choosing the backup's copy replaces
the entire matching notebook; entries absent from that notebook are removed.
Notebooks absent from the file are retained, as with other library collections.

Older applications that only understand backup v1 reject v2. Likewise, the old
R5 database-v7 client cannot open a database already upgraded to v8. Deployment
rollback must use a v8-compatible image; it is not a browser data downgrade.
See [NUC deployment](../deploy/nuc/README.md) and [library backup](library-backup.md).

## Boundaries

This release does not provide a full PGN variation-tree/comment editor, automatic
cloud sync, shared study links, collaborative editing, scored puzzles or mastery
ratings. Notebook content is personal writing, not validated coaching. A saved
line only establishes legality and the user's selected sequence.
