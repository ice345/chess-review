# Library backup and recovery

R3 introduced `open-chess-review-backup` in Settings → Local data. S1 exports
JSON version 2 and continues to accept version 1.
Files are read and written in the browser. The limit is 50 MiB and 10,000 entries
per collection (reviews, raw synced sources, training tasks, notebooks), with at most five
source positions per task and 20,000 deletion markers.

## Contents and exclusions

- PGN reviews, original PGN/comments when present, explicit FEN studies, titles,
  source identity and board orientation.
- Raw imported source games, including pending provider PGNs; these return as
  unanalyzed source data. Reviewed PGNs/FENs must pass canonical core parsing.
- Explicit V3 position-review acknowledgements, timestamps and existing notes.
  V1/V2 manual completion is retained as manual; aggregate counts never become
  fabricated per-position acknowledgements.
- Saved notebooks: personal notes/bookmarks and legal root-to-endpoint lines.
  Each notebook supports 200 entries, lines up to 64 plies, 5,000-character notes
  and 100-character titles. Runtime engine facts and unsaved drafts are excluded.
- Allowlisted application preferences and deliberate-deletion markers.

Analysis caches, generated Coach output, Maia enrichments, accounts, OAuth
sessions/tokens, arbitrary localStorage fields, avatars and operational job logs
are excluded. Account source identities are references, not authentication.
Reconnect accounts to sync. Reanalyze restored games to rebuild objective
results; saved tasks remain visible before analysis is available. Temporary
exploration trees are not persisted. Explicitly saved Notebook paths are
included in v2. V1 files have no notebooks and do not delete existing notebooks.

## Validate and preview before writing

The parser rejects unknown format/version, malformed/oversized JSON, duplicate
IDs, invalid reviewed games/FEN, mismatched original PGN, and training references
or acknowledgement entries outside their source games. Notebook records must
reference a review in the file; every line is replayed with chess-core and
duplicate/invalid roots, paths and metadata are rejected. Runtime reconstruction
uses an allowlist, so extra credential-like properties are not exported or
restored. Raw provider sources may remain unvalidated pending imports.

The preview shows new, identical and conflicting items for each collection.
Timestamp-only and derived analysis-state changes do not make game conflicts.
The default keeps this browser's copy of matching IDs. “Use the backup's copy”
explicitly replaces matching data, including older training progress and the entire matching notebook. Notebook
entries absent from that replacement notebook are removed; notebooks absent
from the backup are retained. Neither
mode deletes unrelated records. A review ID containing different chess input
is rejected rather than breaking retained task references. Historical PGN
serialization differences with the same position/move sequence are supported.

The current library and preferences are compared again at restore time. Changes
since preview require Refresh preview, preventing an old preview from silently
overwriting newly saved progress. Backups are portable data, not signed proof of
training, mastery or game results.

## Atomic restore and interrupted storage

All review/source/task/notebook writes, deletion-intent merging, job pauses and epoch
invalidation commit in one IndexedDB transaction. Quota errors/transaction
aborts leave those stores unchanged. Existing active history work and platform
sync are paused; review runs are cancelled. Other tabs must reload and their
old writers cannot repopulate data. Restored records clear their own deletion
markers; unrelated deletion intent remains.

Preferences live in localStorage and cannot share an IndexedDB transaction.
Their intended values are committed to a durable pending record first. If the
separate preference write fails, the UI explicitly reports that the library was
restored and preferences are pending. On reload, the global storage notice
retries; failure retains the pending record and exposes Retry local storage.
Successful recovery clears the marker and reloads only if needed to initialize
preferences. Pending unapplied preferences block exporting a misleading backup.

Database versionchange closes managed connections. A blocked upgrade prompts
other tabs to close/reload. Subsequent open requests may queue behind that
upgrade without another blocked event, so a five-second open timeout also
provides recovery text. Late connections after rejection are closed. These
behaviors are tested with fake IndexedDB and isolated Chromium tabs, not by
modifying a user's existing library.
