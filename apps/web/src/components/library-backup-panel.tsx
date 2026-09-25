"use client";

import { useRef, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";
import { downloadBlob } from "../lib/png-export";
import { createLibraryBackup, previewLibraryRestore, restoreLibraryBackup, type BackupPreview, type RestoreMode } from "../lib/library-backup";
import { readLibraryBackup } from "../lib/library-backup-format";

type BackupCopy = {
  operationFailed: string;
  title: string;
  intro: string;
  backupPrepared: (reviews: number, sources: number, tasks: number, notebooks: number) => string;
  download: string;
  chooseBackup: string;
  chooseToRestore: string;
  formatNote: string;
  preparing: string;
  previewAria: string;
  reviewRestore: string;
  backupFrom: (when: string) => string;
  collection: string;
  added: string;
  same: string;
  conflict: string;
  collectionName: (key: "reviews" | "sources" | "tasks" | "notebooks") => string;
  differingItems: (n: number) => string;
  showingFirst20: string;
  whenIdExists: string;
  keepExisting: string;
  useBackup: string;
  useBackupNote: string;
  keepExistingNote: string;
  restorePreferences: string;
  restorePauses: string;
  restored: string;
  restoreThis: string;
  refreshPreview: string;
  cancel: string;
  reloadPractice: string;
};

const COPY: Record<UiLanguage, BackupCopy> = {
  en: {
    operationFailed: "This data operation failed. Try again.",
    title: "Library backup",
    intro: "Save games, FEN studies, notebooks, preferences and position-review progress in one file. Analysis caches, generated lessons, account sessions, credentials, avatars and background job logs are excluded. Restored games can be analyzed again; reconnect accounts to sync.",
    backupPrepared: (reviews, sources, tasks, notebooks) => `Backup prepared: ${reviews} reviews, ${sources} source games, ${tasks} tasks, ${notebooks} notebooks.`,
    download: "Download library backup",
    chooseBackup: "Choose library backup",
    chooseToRestore: "Choose backup to restore",
    formatNote: "JSON backup v2 (also restores v1) · up to 50 MiB · up to 10,000 entries per collection. Files stay on this device.",
    preparing: "Preparing local data…",
    previewAria: "Backup restore preview",
    reviewRestore: "Review this restore",
    backupFrom: (when) => `Backup from ${when}. New items will be added. Existing items absent from this file will remain.`,
    collection: "Collection",
    added: "New",
    same: "Same",
    conflict: "Conflict",
    collectionName: (key) => key === "sources" ? "Source games" : key === "tasks" ? "Review tasks" : key === "notebooks" ? "Notebooks" : "Reviews / FEN",
    differingItems: (n) => `${n} differing items`,
    showingFirst20: "Showing the first 20; the totals above include every item.",
    whenIdExists: "When an ID already exists",
    keepExisting: "Keep this browser's copy",
    useBackup: "Use the backup's copy",
    useBackupNote: "Matching records, entire notebooks and task progress will use the backup, including older notes and progress. Unrelated records remain.",
    keepExistingNote: "Existing records and their progress stay as they are; only new items are added.",
    restorePreferences: "Restore backed-up preferences",
    restorePauses: "Restore pauses background work and asks other open tabs to reload. It does not sign in to an account or start analysis.",
    restored: "Library restored. Reload to continue with your games and saved progress.",
    restoreThis: "Restore this backup",
    refreshPreview: "Refresh preview",
    cancel: "Cancel",
    reloadPractice: "Reload and open Practice",
  },
  "zh-CN": {
    operationFailed: "这次数据操作失败了。请再试一次。",
    title: "棋库备份",
    intro: "将对局、FEN 研究、笔记、偏好和局面复习进度保存在一个文件里。分析缓存、生成的讲解、账号会话、凭证、头像和后台任务日志不包括在内。恢复的对局可以重新分析；请重新连接账号以同步。",
    backupPrepared: (reviews, sources, tasks, notebooks) => `备份已准备：${reviews} 条复盘，${sources} 盘源对局，${tasks} 项任务，${notebooks} 本笔记。`,
    download: "下载棋库备份",
    chooseBackup: "选择棋库备份",
    chooseToRestore: "选择要恢复的备份",
    formatNote: "JSON 备份 v2（也可恢复 v1）· 最大 50 MiB · 每个集合最多 10,000 条。文件留在本设备上。",
    preparing: "正在准备本地数据…",
    previewAria: "备份恢复预览",
    reviewRestore: "核对这次恢复",
    backupFrom: (when) => `备份时间：${when}。将添加新项目。此文件中没有的现有项目会保留。`,
    collection: "集合",
    added: "新增",
    same: "相同",
    conflict: "冲突",
    collectionName: (key) => key === "sources" ? "源对局" : key === "tasks" ? "复盘任务" : key === "notebooks" ? "笔记" : "复盘 / FEN",
    differingItems: (n) => `${n} 个不同的项目`,
    showingFirst20: "仅显示前 20 条；上方合计包含全部项目。",
    whenIdExists: "当 ID 已存在时",
    keepExisting: "保留本浏览器中的副本",
    useBackup: "使用备份中的副本",
    useBackupNote: "匹配的记录、整本笔记和任务进度将使用备份，包括较旧的笔记和进度。不相关的记录不受影响。",
    keepExistingNote: "现有记录及其进度保持不变；只添加新项目。",
    restorePreferences: "恢复备份的偏好设置",
    restorePauses: "恢复会暂停后台工作，并请其他已打开的标签页重新加载。它不会登录账号，也不会开始分析。",
    restored: "棋库已恢复。请重新加载以继续使用你的对局和已保存的进度。",
    restoreThis: "恢复此备份",
    refreshPreview: "刷新预览",
    cancel: "取消",
    reloadPractice: "重新加载并打开训练",
  },
};

export function LibraryBackupPanel({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (value: boolean) => void }) {
  const copy = COPY[useUiLanguage()];
  const fileInput = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [mode, setMode] = useState<RestoreMode>("keep-existing");
  const [preferences, setPreferences] = useState(true);
  const [restored, setRestored] = useState(false);
  async function run(action: () => Promise<void>) {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); onBusyChange(true); setError(null); setNotice(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : copy.operationFailed); }
    finally { working.current = false; setBusy(false); onBusyChange(false); }
  }
  const locked = busy || disabled || restored;
  return <section className="library-backup" aria-labelledby="backup-title">
    <h3 id="backup-title">{copy.title}</h3>
    <p>{copy.intro}</p>
    <div className="account-sync-actions">
      <button type="button" className="secondary" disabled={locked} onClick={() => void run(async () => {
        const backup = await createLibraryBackup();
        downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `open-chess-review-backup-${backup.exportedAt.slice(0, 10)}.json`);
        setNotice(copy.backupPrepared(backup.reviews.length, backup.sources.length, backup.tasks.length, backup.notebooks.length));
      })}>{copy.download}</button>
      <input type="file" accept=".json,application/json" hidden aria-label={copy.chooseBackup} ref={fileInput} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (file) void run(async () => { setPreview(null); setPreview(await previewLibraryRestore(await readLibraryBackup(file))); });
      }} />
      <button type="button" className="secondary" disabled={locked} onClick={() => fileInput.current?.click()}>{copy.chooseToRestore}</button>
    </div>
    <small>{copy.formatNote}</small>
    {busy && <p role="status">{copy.preparing}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {preview && !restored && <section className="backup-preview" aria-label={copy.previewAria}>
      <h4>{copy.reviewRestore}</h4>
      <p>{copy.backupFrom(new Date(preview.backup.exportedAt).toLocaleString())}</p>
      <table><thead><tr><th>{copy.collection}</th><th>{copy.added}</th><th>{copy.same}</th><th>{copy.conflict}</th></tr></thead><tbody>{(["reviews", "sources", "tasks", "notebooks"] as const).map((key) => <tr key={key}><th>{copy.collectionName(key)}</th><td>{preview.counts[key].added}</td><td>{preview.counts[key].duplicates}</td><td>{preview.counts[key].conflicts}</td></tr>)}</tbody></table>
      {preview.conflicts.length > 0 && <details><summary>{copy.differingItems(preview.conflicts.length)}</summary><ul>{preview.conflicts.slice(0, 20).map((item, index) => <li key={index}>{item.kind} · {item.label}</li>)}</ul>{preview.conflicts.length > 20 && <small>{copy.showingFirst20}</small>}</details>}
      <label>{copy.whenIdExists}<select value={mode} disabled={locked} onChange={(event) => setMode(event.target.value as RestoreMode)}><option value="keep-existing">{copy.keepExisting}</option><option value="use-backup">{copy.useBackup}</option></select></label>
      <small>{mode === "use-backup" ? copy.useBackupNote : copy.keepExistingNote}</small>
      <label className="backup-preferences"><input type="checkbox" checked={preferences} disabled={locked} onChange={(event) => setPreferences(event.target.checked)} />{copy.restorePreferences}</label>
      <p>{copy.restorePauses}</p>
      <div className="account-sync-actions"><button type="button" className="primary" disabled={locked} onClick={() => void run(async () => {
        const result = await restoreLibraryBackup(preview, mode, preferences);
        setRestored(true); setPreview(null);
        setNotice(result.preferencesError ?? copy.restored);
      })}>{copy.restoreThis}</button><button type="button" className="secondary" disabled={locked} onClick={() => void run(async () => setPreview(await previewLibraryRestore(preview.backup)))}>{copy.refreshPreview}</button><button type="button" className="text-button" disabled={locked} onClick={() => setPreview(null)}>{copy.cancel}</button></div>
    </section>}
    {restored && <button type="button" className="primary" onClick={() => window.location.assign("/training")}>{copy.reloadPractice}</button>}
  </section>;
}
