"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INVALIDATION_EVENT, subscribeLocalData } from "../lib/browser-storage";
import type { ReviewRecord } from "../lib/review-library";
import { emptyNotebook, MAX_NOTEBOOK_ENTRIES, notebookPositionKey, type NotebookPosition, type NotebookText, type ReviewNotebookV1 } from "../lib/review-notebook";
import { getReviewNotebook, saveNotebookEntry } from "../lib/review-notebook-storage";

interface Draft extends NotebookText { position: NotebookPosition; baseRevision: string | null }
type Drafts = Record<string, Draft>;
// Drafts survive client-side navigation (including browser Back). A full reload
// still requires Save; beforeunload warns while any unsaved draft exists.
const sessionDrafts = new Map<string, Drafts>();
const emptyText: NotebookText = { title: "", note: "", bookmarked: false };

export function useReviewNotebook(record: ReviewRecord | null) {
  const [book, setBook] = useState<ReviewNotebookV1 | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; text: string } | null>(null);
  const activeId = useRef(record?.id);
  activeId.current = record?.id;
  const source = useRef(record);
  const refreshNumber = useRef(0);
  source.current = record;

  const refresh = useCallback(async () => {
    const current = source.current;
    if (!current) return;
    const requestNumber = ++refreshNumber.current;
    const loaded = await getReviewNotebook(current);
    if (activeId.current === current.id && requestNumber === refreshNumber.current) { setBook(loaded); setReady(true); setLoadError(null); }
    return loaded;
  }, []);

  useEffect(() => {
    let active = true;
    setBook(null); setReady(false); setError(null); setLoadError(null); setNotice(null);
    setDrafts(record ? sessionDrafts.get(record.id) ?? {} : {});
    const load = () => { void refresh().catch((cause) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : "Unable to load this notebook.");
    }); };
    load();
    const unsubscribe = subscribeLocalData(load);
    const invalidate = () => { sessionDrafts.clear(); setReady(false); setError("Local data changed. Copy any unsaved note before reloading this page."); };
    window.addEventListener(INVALIDATION_EVENT, invalidate);
    return () => { active = false; unsubscribe(); window.removeEventListener(INVALIDATION_EVENT, invalidate); };
  }, [record?.id, record?.input, refresh]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (![...sessionDrafts.values()].some((entries) => Object.keys(entries).length)) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  function replaceDrafts(next: Drafts) {
    if (!record) return;
    if (Object.keys(next).length) sessionDrafts.set(record.id, next);
    else sessionDrafts.delete(record.id);
    setDrafts(next);
  }
  const notebook = book && book.id === record?.id ? book : emptyNotebook(record?.id ?? "");
  function draft(position: NotebookPosition): Draft {
    const key = notebookPositionKey(position), saved = notebook.entries.find((entry) => entry.id === key);
    return drafts[key] ?? { ...emptyText, ...saved, position, baseRevision: saved?.revision ?? null };
  }
  function edit(position: NotebookPosition, patch: Partial<NotebookText>) {
    if (!drafts[notebookPositionKey(position)] && [...sessionDrafts.values()].reduce((count, entries) => count + Object.keys(entries).length, 0) >= MAX_NOTEBOOK_ENTRIES) {
      setError(`Save or discard a draft before opening more than ${MAX_NOTEBOOK_ENTRIES} unsaved entries.`); return;
    }
    setNotice(null);
    replaceDrafts({ ...drafts, [notebookPositionKey(position)]: { ...draft(position), ...patch } });
  }
  async function save(position: NotebookPosition, remove = false) {
    if (!record || !ready || working.current) return;
    const id = record.id, key = notebookPositionKey(position), current = draft(position);
    working.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await saveNotebookEntry(record, position, remove ? null : current, current.baseRevision);
      const remaining = { ...sessionDrafts.get(id) }; delete remaining[key];
      if (Object.keys(remaining).length) sessionDrafts.set(id, remaining); else sessionDrafts.delete(id);
      if (activeId.current !== id) return;
      setBook(saved); setDrafts(remaining);
      setNotice({ key, text: remove ? "Entry removed from this notebook." : "Saved in this browser. Library backup includes this entry." });
    } catch (cause) {
      if (activeId.current === id) setError(cause instanceof Error ? cause.message : "Unable to save. Your draft is still here.");
    } finally { working.current = false; setBusy(false); }
  }
  async function reloadEntry(position: NotebookPosition) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    const id = record?.id;
    try {
      await refresh();
      if (activeId.current !== id) return;
      const remaining = { ...drafts }; delete remaining[notebookPositionKey(position)];
      replaceDrafts(remaining); setNotice({ key: notebookPositionKey(position), text: "Showing the latest saved entry." });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reload this entry. Your draft is still here."); }
    finally { working.current = false; setBusy(false); }
  }
  return { notebook, drafts, ready: ready && book?.id === record?.id, busy, error: error ?? loadError, notice, draft, edit, save, reloadEntry, refresh };
}

export type ReviewNotebookRuntime = ReturnType<typeof useReviewNotebook>;
