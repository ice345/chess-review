import { NOTEBOOK_STORE, REVIEW_STORE, notifyLocalDataChanged, openReviewDatabase, writeLocalData } from "./browser-storage";
import type { ReviewRecord } from "./review-library";
import { emptyNotebook, MAX_NOTEBOOK_ENTRIES, notebookPositionKey, notebookSource, validateNotebook, validateNotebookPosition, validateNotebookText, type NotebookPosition, type NotebookText, type ReviewNotebookV1 } from "./review-notebook";

export async function getReviewNotebook(record: ReviewRecord): Promise<ReviewNotebookV1> {
  const db = await openReviewDatabase();
  let value: unknown;
  try {
    value = await new Promise((resolve, reject) => {
      const request = db.transaction(NOTEBOOK_STORE).objectStore(NOTEBOOK_STORE).get(record.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to load this notebook."));
    });
  } finally { db.close(); }
  return value === undefined ? emptyNotebook(record.id) : validateNotebook(value, record);
}

/** Compare the edited entry's revision in the same transaction as the write.
 * Different positions merge; a competing edit/delete of this position fails.
 */
export async function saveNotebookEntry(record: ReviewRecord, position: NotebookPosition, draft: NotebookText | null, expectedRevision: string | null): Promise<ReviewNotebookV1> {
  const game = notebookSource(record), target = validateNotebookPosition(position, record, game);
  const clean = draft === null ? null : validateNotebookText(draft), key = notebookPositionKey(target);
  const db = await openReviewDatabase();
  let saved = emptyNotebook(record.id);
  try {
    await writeLocalData(db, [REVIEW_STORE, NOTEBOOK_STORE], (tx, fail) => {
      const source = tx.objectStore(REVIEW_STORE).get(record.id);
      const store = tx.objectStore(NOTEBOOK_STORE), read = store.get(record.id);
      let remaining = 2;
      const ready = () => {
        if (--remaining) return;
        try {
          const current = source.result as ReviewRecord | undefined;
          if (!current || current.input !== record.input || current.kind !== record.kind || current.initialFen !== record.initialFen) throw new Error("The source review changed or was deleted. Reload before saving this notebook.");
          saved = read.result === undefined ? emptyNotebook(record.id) : validateNotebook(read.result, record, game);
          const previous = saved.entries.find((entry) => entry.id === key);
          if ((previous?.revision ?? null) !== expectedRevision) throw new Error("This entry changed in another tab. Your draft is still here. Reload the saved entry before editing it again.");
          const entries = saved.entries.filter((entry) => entry.id !== key);
          if (clean) {
            if (entries.length >= MAX_NOTEBOOK_ENTRIES) throw new Error(`This notebook has reached its ${MAX_NOTEBOOK_ENTRIES}-entry limit. Remove an entry before adding another.`);
            const now = new Date().toISOString();
            const entry = { ...target, ...clean, id: key, revision: crypto.randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now };
            // Preserve the portable collection order on edit. A save that only
            // changes its revision/timestamp must not create a backup conflict.
            if (previous) entries.splice(saved.entries.indexOf(previous), 0, entry);
            else entries.push(entry);
          }
          saved = { ...saved, entries };
          if (entries.length) store.put(saved, record.id);
          else store.delete(record.id);
        } catch (error) { fail(error instanceof Error ? error : new Error("Unable to save this notebook.")); }
      };
      source.onsuccess = read.onsuccess = ready;
    });
  } finally { db.close(); }
  notifyLocalDataChanged();
  return saved;
}
