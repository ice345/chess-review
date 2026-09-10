"use client";

import { useRef, useState } from "react";
import { downloadBlob } from "../lib/png-export";
import { createLibraryBackup, previewLibraryRestore, restoreLibraryBackup, type BackupPreview, type RestoreMode } from "../lib/library-backup";
import { readLibraryBackup } from "../lib/library-backup-format";

export function LibraryBackupPanel({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (value: boolean) => void }) {
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
    catch (cause) { setError(cause instanceof Error ? cause.message : "This data operation failed. Try again."); }
    finally { working.current = false; setBusy(false); onBusyChange(false); }
  }
  const locked = busy || disabled || restored;
  return <section className="library-backup" aria-labelledby="backup-title">
    <h3 id="backup-title">Library backup</h3>
    <p>Save games, FEN studies, notebooks, preferences and position-review progress in one file. Analysis caches, generated lessons, account sessions, credentials, avatars and background job logs are excluded. Restored games can be analyzed again; reconnect accounts to sync.</p>
    <div className="account-sync-actions">
      <button type="button" className="secondary" disabled={locked} onClick={() => void run(async () => {
        const backup = await createLibraryBackup();
        downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `open-chess-review-backup-${backup.exportedAt.slice(0, 10)}.json`);
        setNotice(`Backup prepared: ${backup.reviews.length} reviews, ${backup.sources.length} source games, ${backup.tasks.length} tasks, ${backup.notebooks.length} notebooks.`);
      })}>Download library backup</button>
      <input type="file" accept=".json,application/json" hidden aria-label="Choose library backup" ref={fileInput} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (file) void run(async () => { setPreview(null); setPreview(await previewLibraryRestore(await readLibraryBackup(file))); });
      }} />
      <button type="button" className="secondary" disabled={locked} onClick={() => fileInput.current?.click()}>Choose backup to restore</button>
    </div>
    <small>JSON backup v2 (also restores v1) · up to 50 MiB · up to 10,000 entries per collection. Files stay on this device.</small>
    {busy && <p role="status">Preparing local data…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {preview && !restored && <section className="backup-preview" aria-label="Backup restore preview">
      <h4>Review this restore</h4>
      <p>Backup from {new Date(preview.backup.exportedAt).toLocaleString()}. New items will be added. Existing items absent from this file will remain.</p>
      <table><thead><tr><th>Collection</th><th>New</th><th>Same</th><th>Conflict</th></tr></thead><tbody>{(["reviews", "sources", "tasks", "notebooks"] as const).map((key) => <tr key={key}><th>{key === "sources" ? "Source games" : key === "tasks" ? "Review tasks" : key === "notebooks" ? "Notebooks" : "Reviews / FEN"}</th><td>{preview.counts[key].added}</td><td>{preview.counts[key].duplicates}</td><td>{preview.counts[key].conflicts}</td></tr>)}</tbody></table>
      {preview.conflicts.length > 0 && <details><summary>{preview.conflicts.length} differing items</summary><ul>{preview.conflicts.slice(0, 20).map((item, index) => <li key={index}>{item.kind} · {item.label}</li>)}</ul>{preview.conflicts.length > 20 && <small>Showing the first 20; the totals above include every item.</small>}</details>}
      <label>When an ID already exists<select value={mode} disabled={locked} onChange={(event) => setMode(event.target.value as RestoreMode)}><option value="keep-existing">Keep this browser's copy</option><option value="use-backup">Use the backup's copy</option></select></label>
      <small>{mode === "use-backup" ? "Matching records, entire notebooks and task progress will use the backup, including older notes and progress. Unrelated records remain." : "Existing records and their progress stay as they are; only new items are added."}</small>
      <label className="backup-preferences"><input type="checkbox" checked={preferences} disabled={locked} onChange={(event) => setPreferences(event.target.checked)} />Restore backed-up preferences</label>
      <p>Restore pauses background work and asks other open tabs to reload. It does not sign in to an account or start analysis.</p>
      <div className="account-sync-actions"><button type="button" className="primary" disabled={locked} onClick={() => void run(async () => {
        const result = await restoreLibraryBackup(preview, mode, preferences);
        setRestored(true); setPreview(null);
        setNotice(result.preferencesError ?? "Library restored. Reload to continue with your games and saved progress.");
      })}>Restore this backup</button><button type="button" className="secondary" disabled={locked} onClick={() => void run(async () => setPreview(await previewLibraryRestore(preview.backup)))}>Refresh preview</button><button type="button" className="text-button" disabled={locked} onClick={() => setPreview(null)}>Cancel</button></div>
    </section>}
    {restored && <button type="button" className="primary" onClick={() => window.location.assign("/training")}>Reload and open Training</button>}
  </section>;
}
