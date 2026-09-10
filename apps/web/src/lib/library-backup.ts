import type { TrainingQueueItem } from "@chess-review/shared";
import { parsePgn } from "@chess-review/chess-core";
import { APP_SETTINGS_EVENT, APP_SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS } from "./app-settings";
import {
  DATA_STORES, EPOCH_KEY, HISTORY_ANALYSIS_JOB_STORE, LOCAL_META_STORE, NOTEBOOK_STORE, notifyLocalDataChanged,
  openReviewDatabase, PLATFORM_SYNC_STORE, REVIEW_RUN_STORE, REVIEW_STORE, SYNCED_GAME_STORE, TRAINING_QUEUE_STORE, writeLocalData,
} from "./browser-storage";
import { deletedExternalKey, deletedReviewKey } from "./local-data";
import type { ReviewRecord } from "./review-library";
import { normalizeTrainingItem } from "./training-queue";
import { backupSettings, MAX_BACKUP_BYTES, validateLibraryBackup, type LibraryBackup, type LibraryBackupV2 } from "./library-backup-format";

export const PENDING_BACKUP_SETTINGS = "pending-backup-settings-v1";
const STORES = [REVIEW_STORE, SYNCED_GAME_STORE, TRAINING_QUEUE_STORE, NOTEBOOK_STORE, LOCAL_META_STORE] as const;
type Snapshot = Record<typeof STORES[number], Array<{ key: IDBValidKey; value: unknown }>>;
export type RestoreMode = "keep-existing" | "use-backup";
export interface BackupCounts { added: number; duplicates: number; conflicts: number }
export interface BackupPreview {
  backup: LibraryBackupV2;
  baseline: Snapshot;
  preferencesBefore: string | null;
  counts: { reviews: BackupCounts; sources: BackupCounts; tasks: BackupCounts; notebooks: BackupCounts };
  conflicts: Array<{ kind: string; label: string }>;
}

function readSnapshot(tx: IDBTransaction, ready: (snapshot: Snapshot) => void): void {
  const snapshot = {} as Snapshot;
  let remaining = STORES.length;
  for (const name of STORES) {
    const entries: Snapshot[typeof name] = [];
    const request = tx.objectStore(name).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { entries.push({ key: cursor.primaryKey, value: cursor.value }); cursor.continue(); }
      else { snapshot[name] = entries; if (--remaining === 0) ready(snapshot); }
    };
  }
}
async function snapshotDatabase(): Promise<Snapshot> {
  const db = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let snapshot: Snapshot;
      const tx = db.transaction([...STORES]);
      readSnapshot(tx, (value) => { snapshot = value; });
      tx.oncomplete = () => resolve(snapshot);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Unable to read the library for backup."));
    });
  } finally { db.close(); }
}
function values(snapshot: Snapshot, store: typeof STORES[number]): unknown[] { return snapshot[store].map(({ value }) => value); }
function deletionKeys(snapshot: Snapshot): string[] {
  return snapshot[LOCAL_META_STORE].filter(({ key, value }) => value === true && typeof key === "string" && key.startsWith("deleted-")).map(({ key }) => String(key));
}

export async function createLibraryBackup(): Promise<LibraryBackupV2> {
  const preferences = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
  const snapshot = await snapshotDatabase();
  if (window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) !== preferences) throw new Error("Preferences changed while preparing the backup. Try again.");
  const pending = snapshot[LOCAL_META_STORE].find(({ key }) => key === PENDING_BACKUP_SETTINGS)?.value;
  if (pending && JSON.stringify(pending) !== preferences) throw new Error("Restored preferences are still pending. Reload and recover preference storage before exporting another backup.");
  const backup = await validateLibraryBackup({
    format: "open-chess-review-backup", version: 2, exportedAt: new Date().toISOString(),
    reviews: values(snapshot, REVIEW_STORE), sources: values(snapshot, SYNCED_GAME_STORE), tasks: values(snapshot, TRAINING_QUEUE_STORE),
    notebooks: values(snapshot, NOTEBOOK_STORE),
    settings: { ...DEFAULT_APP_SETTINGS, ...JSON.parse(preferences ?? "{}") }, deletions: deletionKeys(snapshot),
  });
  // Derived indexes are rebuilt on restore, not part of the portable format.
  for (const record of backup.reviews) delete record.identity;
  if (new TextEncoder().encode(JSON.stringify(backup)).byteLength > MAX_BACKUP_BYTES) throw new Error("This library exceeds the 50 MiB backup limit. Export individual original PGNs before reducing its size.");
  return backup;
}

function comparable(value: unknown): string {
  // Last-open timestamps and derived analysis markers do not make a source conflict.
  const ignored = new Set(["identity", "revision", "createdAt", "updatedAt", "syncedAt", "importedAt", "analyzed", "analysisId", "analysisAlgorithmVersion", "analysisDepth", "analyzedAt"]);
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([key, value]) => !ignored.has(key) && value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, stable(value)]));
    return v;
  };
  return JSON.stringify(stable(value));
}

export async function previewLibraryRestore(backup: LibraryBackup): Promise<BackupPreview> {
  // Revalidate caller-owned data: preview and restore never trust a TypeScript cast.
  const clean = await validateLibraryBackup(backup);
  const preferencesBefore = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
  const baseline = await snapshotDatabase();
  const conflicts: BackupPreview["conflicts"] = [];
  const reviewTitles = new Map(clean.reviews.map((record) => [record.id, record.title]));
  function count(name: "reviews" | "sources" | "tasks" | "notebooks", store: typeof STORES[number]): BackupCounts {
    const existing = new Map(baseline[store].map(({ key, value }) => [String(key), store === TRAINING_QUEUE_STORE ? normalizeTrainingItem(value as TrainingQueueItem) : value]));
    const result = { added: 0, duplicates: 0, conflicts: 0 };
    for (const item of clean[name]) {
      const current = existing.get(item.id);
      if (!current) result.added++;
      else if (comparable(current) === comparable(item)) result.duplicates++;
      else { result.conflicts++; conflicts.push({ kind: name, label: "title" in item ? item.title : "weaknessKind" in item ? item.weaknessKind : "white" in item ? `${item.white.username} vs ${item.black.username}` : reviewTitles.get(item.id) ?? item.id }); }
      // A collided ID with different chess input would break retained learning references.
      if (store === REVIEW_STORE && current) {
        const before = current as ReviewRecord, after = item as ReviewRecord;
        const moves = (record: ReviewRecord) => record.kind === "fen" ? "" : parsePgn(record.input).plies.map((move) => move.uci).join(" ");
        if (before.kind !== after.kind || before.initialFen !== after.initialFen || moves(before) !== moves(after)) throw new Error("A review ID conflicts with a different source game. This backup cannot be safely merged.");
      }
    }
    return result;
  }
  return { backup: clean, baseline, preferencesBefore, counts: { reviews: count("reviews", REVIEW_STORE), sources: count("sources", SYNCED_GAME_STORE), tasks: count("tasks", TRAINING_QUEUE_STORE), notebooks: count("notebooks", NOTEBOOK_STORE) }, conflicts };
}

function sameSnapshot(left: Snapshot, right: Snapshot): boolean {
  const withoutIndex = (entries: Snapshot[typeof REVIEW_STORE]) => entries.map((entry) => {
    const value = { ...entry.value as ReviewRecord }; delete value.identity;
    return { ...entry, value };
  });
  return STORES.every((name) => JSON.stringify(name === REVIEW_STORE ? withoutIndex(left[name]) : left[name]) === JSON.stringify(name === REVIEW_STORE ? withoutIndex(right[name]) : right[name]));
}

/** All library writes, tombstones, task pauses and the stale-writer epoch commit together. */
export async function restoreLibraryBackup(preview: BackupPreview, mode: RestoreMode, restorePreferences: boolean): Promise<{ preferencesError?: string }> {
  if (mode !== "keep-existing" && mode !== "use-backup") throw new Error("Choose how to resolve duplicate records.");
  const backup = await validateLibraryBackup(preview.backup);
  if (window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) !== preview.preferencesBefore) throw new Error("Preferences changed after the preview. Refresh the preview before restoring.");
  const db = await openReviewDatabase();
  try {
    await writeLocalData(db, DATA_STORES, (tx, fail) => {
      readSnapshot(tx, (current) => {
        try {
          if (!sameSnapshot(current, preview.baseline)) throw new Error("The library changed after the preview. Refresh the preview before restoring.");
          const meta = tx.objectStore(LOCAL_META_STORE);
          const restored: ReviewRecord[] = [];
          for (const [store, items] of [[REVIEW_STORE, backup.reviews], [SYNCED_GAME_STORE, backup.sources], [TRAINING_QUEUE_STORE, backup.tasks], [NOTEBOOK_STORE, backup.notebooks]] as const) {
            const existing = new Set(current[store].map(({ key }) => String(key)));
            for (const item of items) {
              if (mode === "keep-existing" && existing.has(item.id)) continue;
              tx.objectStore(store).put(item, item.id);
              if (store === REVIEW_STORE) restored.push(item as ReviewRecord);
            }
          }
          const retained = [...values(current, REVIEW_STORE) as ReviewRecord[], ...backup.reviews];
          const activeKeys = new Set(retained.flatMap((record) => [deletedReviewKey(record.id), ...(record.external ? [deletedExternalKey(record.external)] : [])]));
          for (const key of backup.deletions) if (!activeKeys.has(key)) meta.put(true, key);
          for (const record of restored) { meta.delete(deletedReviewKey(record.id)); if (record.external) meta.delete(deletedExternalKey(record.external)); }
          const epoch = current[LOCAL_META_STORE].find(({ key }) => key === EPOCH_KEY)?.value ?? 0;
          meta.put(Number(epoch) + 1, EPOCH_KEY);
          if (restorePreferences) meta.put(backup.settings, PENDING_BACKUP_SETTINGS);
          // Operational jobs aren't exported. Existing work is paused before old tabs
          // are invalidated, so nothing resumes automatically after a restore.
          for (const store of [HISTORY_ANALYSIS_JOB_STORE, PLATFORM_SYNC_STORE, REVIEW_RUN_STORE]) {
            const request = tx.objectStore(store).openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return;
              const value = cursor.value;
              if (store === HISTORY_ANALYSIS_JOB_STORE && ["queued", "running"].includes(value.status)) cursor.update({ ...value, status: "paused", updatedAt: new Date().toISOString(), items: value.items.map((item: { status: string }) => item.status === "running" ? { ...item, status: "queued" } : item) });
              if (store === PLATFORM_SYNC_STORE && ["syncing", "rate-limited"].includes(value.status)) cursor.update({ ...value, status: "paused" });
              if (store === REVIEW_RUN_STORE && value.status === "running") cursor.update({ ...value, status: "cancelled", updatedAt: new Date().toISOString() });
              cursor.continue();
            };
          }
        } catch (cause) { fail(cause instanceof Error ? cause : new Error("Unable to restore this backup.")); }
      });
    });
  } finally { db.close(); }
  let preferencesError: string | undefined;
  if (restorePreferences) {
    try { window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(backup.settings)); window.dispatchEvent(new Event(APP_SETTINGS_EVENT)); }
    catch { preferencesError = "The library was restored. Preferences are pending because browser preference storage is unavailable. Reload to retry; the pending preferences are retained safely."; }
  }
  notifyLocalDataChanged(true);
  return preferencesError ? { preferencesError } : {};
}

/** Retryable after a successful library restore if localStorage failed separately. */
export async function applyPendingBackupSettings(): Promise<boolean> {
  const db = await openReviewDatabase();
  let changed = false;
  try {
    await writeLocalData(db, [], (tx, fail) => {
      const meta = tx.objectStore(LOCAL_META_STORE), request = meta.get(PENDING_BACKUP_SETTINGS);
      request.onsuccess = () => {
        if (!request.result) return;
        try {
          const settings = backupSettings(request.result), serialized = JSON.stringify(settings);
          changed = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) !== serialized;
          window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, serialized);
          meta.delete(PENDING_BACKUP_SETTINGS);
        } catch (cause) { fail(new Error("Library restored; preferences are still pending. Allow browser storage, then retry preference recovery.", { cause })); }
      };
    });
  } finally { db.close(); }
  return changed;
}
