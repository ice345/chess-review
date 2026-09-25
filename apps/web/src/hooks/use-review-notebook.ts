"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { INVALIDATION_EVENT, subscribeLocalData } from "../lib/browser-storage";
import type { ReviewRecord } from "../lib/review-library";
import { emptyNotebook, MAX_NOTEBOOK_ENTRIES, notebookPositionKey, type NotebookPosition, type NotebookText, type ReviewNotebookV1 } from "../lib/review-notebook";
import { getReviewNotebook, saveNotebookEntry } from "../lib/review-notebook-storage";
import { useUiLanguage } from "./use-ui-language";

interface Draft extends NotebookText { position: NotebookPosition; baseRevision: string | null }
type Drafts = Record<string, Draft>;
// Drafts survive client-side navigation (including browser Back). A full reload
// still requires Save; beforeunload warns while any unsaved draft exists.
const sessionDrafts = new Map<string, Drafts>();
const emptyText: NotebookText = { title: "", note: "", bookmarked: false };

type NotebookNoticeCopy = {
  removed: string;
  saved: string;
  showingLatest: string;
  unableToLoad: string;
  localDataChanged: string;
  tooManyDrafts: (max: number) => string;
  unableToSave: string;
  unableToReload: string;
};

const COPY: Record<UiLanguage, NotebookNoticeCopy> = {
  en: {
    removed: "Entry removed from this notebook.",
    saved: "Saved in this browser. Library backup includes this entry.",
    showingLatest: "Showing the latest saved entry.",
    unableToLoad: "Unable to load this notebook.",
    localDataChanged: "Local data changed. Copy any unsaved note before reloading this page.",
    tooManyDrafts: (max) => `Save or discard a draft before opening more than ${max} unsaved entries.`,
    unableToSave: "Unable to save. Your draft is still here.",
    unableToReload: "Unable to reload this entry. Your draft is still here.",
  },
  "zh-CN": {
    removed: "已从本笔记中删除该条目。",
    saved: "已保存在此浏览器中。棋库备份包含此条目。",
    showingLatest: "正在显示最近保存的条目。",
    unableToLoad: "无法加载此笔记。",
    localDataChanged: "本地数据已更改。重新加载此页前请先复制未保存的注释。",
    tooManyDrafts: (max) => `请先保存或丢弃草稿，再打开超过 ${max} 条未保存条目。`,
    unableToSave: "无法保存。草稿仍在。",
    unableToReload: "无法重新加载此条目。草稿仍在。",
  },
};

export function useReviewNotebook(record: ReviewRecord | null) {
  const copy = COPY[useUiLanguage()];
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
      if (active) setLoadError(cause instanceof Error ? cause.message : copy.unableToLoad);
    }); };
    load();
    const unsubscribe = subscribeLocalData(load);
    const invalidate = () => { sessionDrafts.clear(); setReady(false); setError(copy.localDataChanged); };
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
      setError(copy.tooManyDrafts(MAX_NOTEBOOK_ENTRIES)); return;
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
      setNotice({ key, text: remove ? copy.removed : copy.saved });
    } catch (cause) {
      if (activeId.current === id) setError(cause instanceof Error ? cause.message : copy.unableToSave);
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
      replaceDrafts(remaining); setNotice({ key: notebookPositionKey(position), text: copy.showingLatest });
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.unableToReload); }
    finally { working.current = false; setBusy(false); }
  }
  return { notebook, drafts, ready: ready && book?.id === record?.id, busy, error: error ?? loadError, notice, draft, edit, save, reloadEntry, refresh };
}

export type ReviewNotebookRuntime = ReturnType<typeof useReviewNotebook>;
