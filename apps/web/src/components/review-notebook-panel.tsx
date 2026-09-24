"use client";

import Link from "next/link";
import { BluebirdMotif } from "@chess-review/ui";
import { useMemo, useState } from "react";
import { selectedBranchMoves } from "../lib/analysis-branch";
import { MAX_NOTE_LENGTH, MAX_NOTE_TITLE_LENGTH, MAX_NOTEBOOK_LINE_PLIES, notebookPositionKey, notebookPositionLabel, notebookSource, type NotebookPosition } from "../lib/review-notebook";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";

export function ReviewNotebookPanel() {
  const runtime = useReviewRuntime(), { notebook, record } = runtime;
  const branch = useReviewStore((state) => state.branch), currentPly = useReviewStore((state) => state.currentPly);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const game = useMemo(() => notebookSource(record), [record]);
  const position: NotebookPosition = { rootPly: branch?.rootPly ?? currentPly, line: branch ? selectedBranchMoves(branch).map((move) => move.uci) : [] };
  const key = notebookPositionKey(position), saved = notebook.notebook.entries.find((entry) => entry.id === key);
  const draft = notebook.draft(position), dirty = Boolean(notebook.drafts[key]);
  const tooLong = position.line.length > MAX_NOTEBOOK_LINE_PLIES;
  const label = notebookPositionLabel(record, position, game);
  const locked = !notebook.ready || notebook.busy;
  const entries = [...notebook.notebook.entries].filter((entry) => !onlyBookmarks || entry.bookmarked).sort((a, b) => a.rootPly - b.rootPly || a.createdAt.localeCompare(b.createdAt));
  const labels = useMemo(() => new Map(notebook.notebook.entries.map((entry) => [entry.id, notebookPositionLabel(record, entry, game)])), [notebook.notebook.entries, record, game]);
  const unsaved = Object.keys(notebook.drafts).length;
  return <section className="review-notebook" aria-labelledby="notebook-title">
    <header><span className="kicker">Personal study</span><h1 id="notebook-title">Notebook</h1><p>Keep notes, bookmarks and lines for this game. Saved entries stay in this browser and are included in <Link href="/settings">Library backup</Link>.</p></header>
    {unsaved > 0 && <div className="notebook-draft-notice"><p role="status">{unsaved} unsaved {unsaved === 1 ? "draft" : "drafts"}. Drafts remain during page navigation in this tab; save before closing or reloading.</p><details><summary>Return to an unsaved draft</summary><ul>{Object.entries(notebook.drafts).map(([id, draft]) => <li key={id}><button type="button" className="text-button" onClick={() => runtime.openNotebookPosition(draft.position.rootPly, draft.position.line)}>{draft.title || notebookPositionLabel(record, draft.position, game)}</button></li>)}</ul></details></div>}
    {(!notebook.ready || notebook.error || actionError) && <div>
      {notebook.error || actionError ? <p className="error" role="alert">{notebook.error ?? actionError}</p> : <p role="status">Loading your notebook…</p>}
      {!notebook.ready && notebook.error && <button type="button" className="secondary" onClick={() => void notebook.reloadEntry(position)}>Retry notebook storage</button>}
    </div>}
    <section className="notebook-editor" aria-label="Current position notes">
      <h2>{position.line.length ? "Current variation" : "Current game position"}</h2>
      <p className="notebook-line">{label}</p>
      {position.line.length > 0 && <small>Saving keeps the line from mainline ply {position.rootPly} through this position. Future moves and other branches are not included. Navigate to a different endpoint to save another line.</small>}
      {tooLong && <p role="alert">Save a shorter line of up to {MAX_NOTEBOOK_LINE_PLIES} plies; use Previous to choose its endpoint.</p>}
      <label><span>Entry title <small>(optional)</small></span><input value={draft.title} maxLength={MAX_NOTE_TITLE_LENGTH} disabled={locked} onChange={(event) => notebook.edit(position, { title: event.target.value })} /></label>
      <label>Your note<textarea value={draft.note} maxLength={MAX_NOTE_LENGTH} rows={5} disabled={locked} placeholder="What would you like to remember about this position?" onChange={(event) => notebook.edit(position, { note: event.target.value })} /></label>
      <small>{draft.note.length} / {MAX_NOTE_LENGTH} characters · Personal notes are not engine evaluations.</small>
      <label className="notebook-bookmark"><input type="checkbox" checked={draft.bookmarked} disabled={locked} onChange={(event) => notebook.edit(position, { bookmarked: event.target.checked })} />Bookmark this position</label>
      <div className="notebook-actions">
        <button type="button" className="primary" disabled={locked || tooLong || (saved ? !dirty : !position.line.length && !draft.note.trim() && !draft.title.trim() && !draft.bookmarked)} onClick={() => void notebook.save(position)}>{notebook.busy ? "Saving…" : position.line.length ? "Save line and note" : "Save note and bookmark"}</button>
        {saved && <button type="button" className="secondary" disabled={locked} onClick={() => void notebook.save(position, true)}>Remove saved entry</button>}
        {dirty && <button type="button" className="text-button" disabled={locked} onClick={() => void notebook.reloadEntry(position)}>Discard draft and reload saved entry</button>}
      </div>
      {notebook.notice?.key === key && <p role="status" className="notebook-save-feedback">{saved && !dirty && <BluebirdMotif kind="feather" className="saved-feather" key={saved.updatedAt} />}{notebook.notice.text}</p>}
      {!dirty && saved && <small>Saved {new Date(saved.updatedAt).toLocaleString()}</small>}
    </section>
    <section className="notebook-entries" aria-label="Saved notebook entries">
      <div className="notebook-list-heading"><h2>Saved entries · {notebook.notebook.entries.length}</h2><label className="notebook-bookmark"><input type="checkbox" checked={onlyBookmarks} onChange={(event) => setOnlyBookmarks(event.target.checked)} />Bookmarks only</label></div>
      {notebook.ready && entries.length === 0 && <p>{onlyBookmarks ? "No bookmarked entries yet. Clear the filter to see all saved entries." : "No saved entries yet. Choose a game position or explore a line on the board, then save it here."}</p>}
      <ol>{entries.map((entry) => <li key={entry.id} aria-current={entry.id === key ? "true" : undefined}>
        <button type="button" className="notebook-entry-open" onClick={() => {
          try { runtime.openNotebookPosition(entry.rootPly, entry.line); setActionError(null); }
          catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to open this entry."); }
        }}><strong>{entry.bookmarked && <><BluebirdMotif kind="feather" className="entry-feather" /><span className="sr-only">Bookmarked: </span></>}{entry.title || labels.get(entry.id)}</strong><small>{entry.line.length ? `Saved line · ${entry.line.length} plies · from mainline ply ${entry.rootPly}` : entry.title ? labels.get(entry.id) : "Saved position"}</small></button>
        {entry.note && <p>{entry.note}</p>}
      </li>)}</ol>
    </section>
  </section>;
}
