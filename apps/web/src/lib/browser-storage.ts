export const DATABASE_NAME = "open-chess-review";
export const DATABASE_VERSION = 9;
export const ANALYSIS_STORE = "objective-analyses";
export const ANALYSIS_INDEX_STORE = "objective-analysis-index";
export const REVIEW_STORE = "review-records";
export const PLATFORM_ACCOUNT_STORE = "platform-accounts";
export const SYNCED_GAME_STORE = "synced-games";
export const PLATFORM_SYNC_STORE = "platform-sync-state";
export const TRAINING_QUEUE_STORE = "training-queue";
export const HISTORY_ANALYSIS_JOB_STORE = "history-analysis-jobs";
export const PLAYER_AVATAR_STORE = "player-avatars";
export const LOCAL_META_STORE = "local-data-metadata";
export const REVIEW_RUN_STORE = "review-runs";
export const NOTEBOOK_STORE = "review-notebooks";
export const REMOTE_POSITIONS_STORE = "remote-positions";
export const DATA_STORES = [ANALYSIS_STORE, ANALYSIS_INDEX_STORE, REVIEW_STORE, PLATFORM_ACCOUNT_STORE, SYNCED_GAME_STORE, PLATFORM_SYNC_STORE, TRAINING_QUEUE_STORE, HISTORY_ANALYSIS_JOB_STORE, PLAYER_AVATAR_STORE, REVIEW_RUN_STORE, NOTEBOOK_STORE, REMOTE_POSITIONS_STORE];
export const DATA_EVENT = "open-chess-review-data";
export const INVALIDATION_EVENT = "open-chess-review-invalidated";
export const EPOCH_KEY = "epoch";
let sessionEpoch: number | undefined;
let invalidated = false;

export class LocalDataChangedError extends Error {
  constructor() { super("Local data was changed in another operation. Reload this page before continuing."); this.name = "LocalDataChangedError"; }
}

export function isLocalSessionInvalid(): boolean { return invalidated; }

export function invalidateLocalSession(): void {
  invalidated = true;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INVALIDATION_EVENT));
}

export function notifyLocalDataChanged(destructive = false): void {
  if (typeof window === "undefined") return;
  if (destructive) invalidateLocalSession();
  window.dispatchEvent(new Event(DATA_EVENT));
  // Notifications improve responsiveness; the IndexedDB epoch is the durable
  // protection and does not depend on localStorage/BroadcastChannel delivery.
  try { window.localStorage.setItem(DATA_EVENT, JSON.stringify({ id: crypto.randomUUID(), destructive })); } catch { /* IndexedDB remains authoritative. */ }
}

export function subscribeLocalData(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== DATA_EVENT) return;
    try { if (JSON.parse(event.newValue ?? "{}").destructive) invalidateLocalSession(); } catch { /* Ignore malformed notification. */ }
    listener();
  };
  window.addEventListener(DATA_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(DATA_EVENT, listener); window.removeEventListener("storage", onStorage); };
}

/** Every application write checks the page's epoch in the SAME transaction.
 * Destructive operations increment it; delayed work from any old page then
 * cannot repopulate storage. A full page reload starts a new storage session.
 */
export function writeLocalData(
  database: IDBDatabase,
  stores: string | readonly string[],
  write: (transaction: IDBTransaction, fail: (error: Error) => void) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([...new Set([...(typeof stores === "string" ? [stores] : stores), LOCAL_META_STORE])], "readwrite");
    let failure: unknown;
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Local data could not be saved. Try again."));
    const request = transaction.objectStore(LOCAL_META_STORE).get(EPOCH_KEY);
    request.onsuccess = () => {
      try {
        if (invalidated || (request.result ?? 0) !== sessionEpoch) {
          invalidateLocalSession();
          throw new LocalDataChangedError();
        }
        write(transaction, (error) => { failure = error; transaction.abort(); });
      } catch (error) { failure = error; transaction.abort(); }
    };
  });
}

export function openReviewDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => { if (!settled) { settled = true; clearTimeout(timeout); reject(error); } };
    // IndexedDB queues later open requests behind a blocked upgrade without
    // firing blocked on each one. Bound those waits as well (including React
    // remounts), and close any connection that arrives after rejection.
    const timeout = setTimeout(() => fail(new Error("Local storage is taking too long. Close other Open Chess Review tabs, then reload to retry.")), 5_000);
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const store of [...DATA_STORES, LOCAL_META_STORE]) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      }
    };
    request.onblocked = () => fail(new Error("Close other Open Chess Review tabs, then reload to finish updating local storage."));
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => { database.close(); invalidateLocalSession(); };
      const transaction = database.transaction(LOCAL_META_STORE);
      const read = transaction.objectStore(LOCAL_META_STORE).get(EPOCH_KEY);
      transaction.oncomplete = () => {
        const epoch = read.result ?? 0;
        sessionEpoch ??= epoch;
        if (invalidated || epoch !== sessionEpoch) { database.close(); invalidateLocalSession(); fail(new LocalDataChangedError()); }
        else if (settled) database.close();
        else { settled = true; clearTimeout(timeout); resolve(database); }
      };
      transaction.onerror = transaction.onabort = () => { database.close(); fail(transaction.error ?? read.error ?? new Error("Unable to read local data state.")); };
    };
    request.onerror = () => fail(request.error ?? new Error("Unable to open Open Chess Review storage."));
  });
}
