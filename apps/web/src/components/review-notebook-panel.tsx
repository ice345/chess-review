"use client";

import Link from "next/link";
import { BluebirdMotif } from "@chess-review/ui";
import { useMemo, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { selectedBranchMoves } from "../lib/analysis-branch";
import { MAX_NOTE_LENGTH, MAX_NOTE_TITLE_LENGTH, MAX_NOTEBOOK_LINE_PLIES, notebookPositionKey, notebookPositionLabel, notebookSource, type NotebookPosition } from "../lib/review-notebook";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";
import { useUiLanguage } from "../hooks/use-ui-language";

type NotebookCopy = {
  kicker: string;
  title: string;
  introBefore: string;
  libraryBackup: string;
  introAfter: string;
  unsaved: (count: number) => string;
  returnDraft: string;
  loading: string;
  retryStorage: string;
  currentNotesAria: string;
  currentVariation: string;
  currentPosition: string;
  saveLine: (rootPly: number) => string;
  tooLong: (max: number) => string;
  entryTitle: string;
  optional: string;
  yourNote: string;
  placeholder: string;
  characters: (used: number, max: number) => string;
  bookmark: string;
  saving: string;
  saveLineAndNote: string;
  saveNoteAndBookmark: string;
  removeEntry: string;
  discardDraft: string;
  savedAt: (when: string) => string;
  savedEntriesAria: string;
  savedEntries: (count: number) => string;
  bookmarksOnly: string;
  noBookmarks: string;
  noEntries: string;
  bookmarked: string;
  savedLine: (plies: number, rootPly: number) => string;
  savedPosition: string;
  unableToOpen: string;
};

const COPY: Record<UiLanguage, NotebookCopy> = {
  en: {
    kicker: "Personal study",
    title: "Notebook",
    introBefore: "Keep notes, bookmarks and lines for this game. Saved entries stay in this browser and are included in ",
    libraryBackup: "Library backup",
    introAfter: ".",
    unsaved: (count) => `${count} unsaved ${count === 1 ? "draft" : "drafts"}. Drafts remain during page navigation in this tab; save before closing or reloading.`,
    returnDraft: "Return to an unsaved draft",
    loading: "Loading your notebook\u2026",
    retryStorage: "Retry notebook storage",
    currentNotesAria: "Current position notes",
    currentVariation: "Current variation",
    currentPosition: "Current game position",
    saveLine: (rootPly) => `Saving keeps the line from mainline ply ${rootPly} through this position. Future moves and other branches are not included. Navigate to a different endpoint to save another line.`,
    tooLong: (max) => `Save a shorter line of up to ${max} plies; use Previous to choose its endpoint.`,
    entryTitle: "Entry title ",
    optional: "(optional)",
    yourNote: "Your note",
    placeholder: "What would you like to remember about this position?",
    characters: (used, max) => `${used} / ${max} characters \u00b7 Personal notes are not engine evaluations.`,
    bookmark: "Bookmark this position",
    saving: "Saving\u2026",
    saveLineAndNote: "Save line and note",
    saveNoteAndBookmark: "Save note and bookmark",
    removeEntry: "Remove saved entry",
    discardDraft: "Discard draft and reload saved entry",
    savedAt: (when) => `Saved ${when}`,
    savedEntriesAria: "Saved notebook entries",
    savedEntries: (count) => `Saved entries \u00b7 ${count}`,
    bookmarksOnly: "Bookmarks only",
    noBookmarks: "No bookmarked entries yet. Clear the filter to see all saved entries.",
    noEntries: "No saved entries yet. Choose a game position or explore a line on the board, then save it here.",
    bookmarked: "Bookmarked: ",
    savedLine: (plies, rootPly) => `Saved line \u00b7 ${plies} plies \u00b7 from mainline ply ${rootPly}`,
    savedPosition: "Saved position",
    unableToOpen: "Unable to open this entry.",
  },
  "zh-CN": {
    kicker: "个人学习",
    title: "笔记",
    introBefore: "为本局保存注释、书签和变化。已保存条目留在这个浏览器里，并包含在",
    libraryBackup: "棋库备份",
    introAfter: "中。",
    unsaved: (count) => `${count} 条未保存草稿。草稿在本标签页导航期间会保留；关闭或重新加载前请先保存。`,
    returnDraft: "回到未保存的草稿",
    loading: "正在加载笔记…",
    retryStorage: "重试笔记存储",
    currentNotesAria: "当前局面笔记",
    currentVariation: "当前变化",
    currentPosition: "当前对局局面",
    saveLine: (rootPly) => `保存会记下从主变半回合 ${rootPly} 到此局面的变化。之后的着法和其他分支不包括在内。导航到另一个终点可再保存一条变化。`,
    tooLong: (max) => `请保存至多 ${max} 个半回合的较短变化；用「上一着」选择终点。`,
    entryTitle: "条目标题 ",
    optional: "（可选）",
    yourNote: "你的注释",
    placeholder: "关于这个局面，你想记住什么？",
    characters: (used, max) => `${used} / ${max} 字 · 个人注释不是引擎评分。`,
    bookmark: "将此局面加入书签",
    saving: "正在保存…",
    saveLineAndNote: "保存变化和注释",
    saveNoteAndBookmark: "保存注释和书签",
    removeEntry: "删除已保存条目",
    discardDraft: "丢弃草稿并重新加载已保存条目",
    savedAt: (when) => `保存于 ${when}`,
    savedEntriesAria: "已保存的笔记条目",
    savedEntries: (count) => `已保存条目 · ${count}`,
    bookmarksOnly: "仅书签",
    noBookmarks: "还没有书签条目。清除筛选即可看到全部已保存条目。",
    noEntries: "还没有已保存条目。选择一个对局局面，或在棋盘上探索一条变化，然后在这里保存。",
    bookmarked: "已加书签：",
    savedLine: (plies, rootPly) => `已保存变化 · ${plies} 个半回合 · 自主变半回合 ${rootPly}`,
    savedPosition: "已保存局面",
    unableToOpen: "无法打开此条目。",
  },
};

export function ReviewNotebookPanel() {
  const language = useUiLanguage();
  const copy = COPY[language];
  const runtime = useReviewRuntime(), { notebook, record } = runtime;
  const branch = useReviewStore((state) => state.branch), currentPly = useReviewStore((state) => state.currentPly);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const game = useMemo(() => notebookSource(record), [record]);
  const position: NotebookPosition = { rootPly: branch?.rootPly ?? currentPly, line: branch ? selectedBranchMoves(branch).map((move) => move.uci) : [] };
  const key = notebookPositionKey(position), saved = notebook.notebook.entries.find((entry) => entry.id === key);
  const draft = notebook.draft(position), dirty = Boolean(notebook.drafts[key]);
  const tooLong = position.line.length > MAX_NOTEBOOK_LINE_PLIES;
  const label = notebookPositionLabel(record, position, language, game);
  const locked = !notebook.ready || notebook.busy;
  const entries = [...notebook.notebook.entries].filter((entry) => !onlyBookmarks || entry.bookmarked).sort((a, b) => a.rootPly - b.rootPly || a.createdAt.localeCompare(b.createdAt));
  const labels = useMemo(() => new Map(notebook.notebook.entries.map((entry) => [entry.id, notebookPositionLabel(record, entry, language, game)])), [notebook.notebook.entries, record, game, language]);
  const unsaved = Object.keys(notebook.drafts).length;
  return <section className="review-notebook" aria-labelledby="notebook-title">
    <header><span className="kicker">{copy.kicker}</span><h1 id="notebook-title">{copy.title}</h1><p>{copy.introBefore}<Link href="/settings">{copy.libraryBackup}</Link>{copy.introAfter}</p></header>
    {unsaved > 0 && <div className="notebook-draft-notice"><p role="status">{copy.unsaved(unsaved)}</p><details><summary>{copy.returnDraft}</summary><ul>{Object.entries(notebook.drafts).map(([id, draft]) => <li key={id}><button type="button" className="text-button" onClick={() => runtime.openNotebookPosition(draft.position.rootPly, draft.position.line)}>{draft.title || notebookPositionLabel(record, draft.position, language, game)}</button></li>)}</ul></details></div>}
    {(!notebook.ready || notebook.error || actionError) && <div>
      {notebook.error || actionError ? <p className="error" role="alert">{notebook.error ?? actionError}</p> : <p role="status">{copy.loading}</p>}
      {!notebook.ready && notebook.error && <button type="button" className="secondary" onClick={() => void notebook.reloadEntry(position)}>{copy.retryStorage}</button>}
    </div>}
    <section className="notebook-editor" aria-label={copy.currentNotesAria}>
      <h2>{position.line.length ? copy.currentVariation : copy.currentPosition}</h2>
      <p className="notebook-line">{label}</p>
      {position.line.length > 0 && <small>{copy.saveLine(position.rootPly)}</small>}
      {tooLong && <p role="alert">{copy.tooLong(MAX_NOTEBOOK_LINE_PLIES)}</p>}
      <label><span>{copy.entryTitle}<small>{copy.optional}</small></span><input value={draft.title} maxLength={MAX_NOTE_TITLE_LENGTH} disabled={locked} onChange={(event) => notebook.edit(position, { title: event.target.value })} /></label>
      <label>{copy.yourNote}<textarea value={draft.note} maxLength={MAX_NOTE_LENGTH} rows={5} disabled={locked} placeholder={copy.placeholder} onChange={(event) => notebook.edit(position, { note: event.target.value })} /></label>
      <small>{copy.characters(draft.note.length, MAX_NOTE_LENGTH)}</small>
      <label className="notebook-bookmark"><input type="checkbox" checked={draft.bookmarked} disabled={locked} onChange={(event) => notebook.edit(position, { bookmarked: event.target.checked })} />{copy.bookmark}</label>
      <div className="notebook-actions">
        <button type="button" className="primary" disabled={locked || tooLong || (saved ? !dirty : !position.line.length && !draft.note.trim() && !draft.title.trim() && !draft.bookmarked)} onClick={() => void notebook.save(position)}>{notebook.busy ? copy.saving : position.line.length ? copy.saveLineAndNote : copy.saveNoteAndBookmark}</button>
        {saved && <button type="button" className="secondary" disabled={locked} onClick={() => void notebook.save(position, true)}>{copy.removeEntry}</button>}
        {dirty && <button type="button" className="text-button" disabled={locked} onClick={() => void notebook.reloadEntry(position)}>{copy.discardDraft}</button>}
      </div>
      {notebook.notice?.key === key && <p role="status" className="notebook-save-feedback">{saved && !dirty && <BluebirdMotif kind="feather" className="saved-feather" key={saved.updatedAt} />}{notebook.notice.text}</p>}
      {!dirty && saved && <small>{copy.savedAt(new Date(saved.updatedAt).toLocaleString())}</small>}
    </section>
    <section className="notebook-entries" aria-label={copy.savedEntriesAria}>
      <div className="notebook-list-heading"><h2>{copy.savedEntries(notebook.notebook.entries.length)}</h2><label className="notebook-bookmark"><input type="checkbox" checked={onlyBookmarks} onChange={(event) => setOnlyBookmarks(event.target.checked)} />{copy.bookmarksOnly}</label></div>
      {notebook.ready && entries.length === 0 && <p>{onlyBookmarks ? copy.noBookmarks : copy.noEntries}</p>}
      <ol>{entries.map((entry) => <li key={entry.id} aria-current={entry.id === key ? "true" : undefined}>
        <button type="button" className="notebook-entry-open" onClick={() => {
          try { runtime.openNotebookPosition(entry.rootPly, entry.line); setActionError(null); }
          catch (cause) { setActionError(cause instanceof Error ? cause.message : copy.unableToOpen); }
        }}><strong>{entry.bookmarked && <><BluebirdMotif kind="feather" className="entry-feather" /><span className="sr-only">{copy.bookmarked}</span></>}{entry.title || labels.get(entry.id)}</strong><small>{entry.line.length ? copy.savedLine(entry.line.length, entry.rootPly) : entry.title ? labels.get(entry.id) : copy.savedPosition}</small></button>
        {entry.note && <p>{entry.note}</p>}
      </li>)}</ol>
    </section>
  </section>;
}
