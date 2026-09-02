import {
  ANALYSIS_INDEX_STORE,
  ANALYSIS_STORE,
  HISTORY_ANALYSIS_JOB_STORE,
  openReviewDatabase,
  PLATFORM_ACCOUNT_STORE,
  PLATFORM_SYNC_STORE,
  REVIEW_STORE,
  SYNCED_GAME_STORE,
  TRAINING_QUEUE_STORE,
} from "./browser-storage";
import { DEFAULT_APP_SETTINGS } from "./app-settings";

const SETTINGS_KEY = "open-chess-review-settings-v1";

function clearStore(database: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Unable to clear ${storeName}.`));
  });
}

function deleteKey(database: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Unable to delete ${storeName} record.`));
  });
}

export async function deleteReviewRecord(id: string): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await deleteKey(database, REVIEW_STORE, id);
  } finally {
    database.close();
  }
}

export async function clearObjectiveAnalysisCache(): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await clearStore(database, ANALYSIS_STORE);
    await clearStore(database, ANALYSIS_INDEX_STORE);
  } finally {
    database.close();
  }
}

export async function deleteSyncedGamesForAccount(accountId: string): Promise<number> {
  const database = await openReviewDatabase();
  try {
    const games = await new Promise<Array<{ id: string; external?: { accountId?: string } }>>((resolve, reject) => {
      const request = database.transaction(SYNCED_GAME_STORE, "readonly").objectStore(SYNCED_GAME_STORE).getAll();
      request.onsuccess = () => resolve(request.result as Array<{ id: string; external?: { accountId?: string } }>);
      request.onerror = () => reject(request.error ?? new Error("Unable to list synced games."));
    });
    const matching = games.filter((game) => game.external?.accountId === accountId);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SYNCED_GAME_STORE, "readwrite");
      const store = transaction.objectStore(SYNCED_GAME_STORE);
      for (const game of matching) store.delete(game.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to delete imported games."));
    });
    return matching.length;
  } finally {
    database.close();
  }
}

export type LocalResetScope = "cache" | "all";

export async function resetLocalData(scope: LocalResetScope): Promise<void> {
  const database = await openReviewDatabase();
  try {
    if (scope === "cache") {
      await clearStore(database, ANALYSIS_STORE);
      await clearStore(database, ANALYSIS_INDEX_STORE);
      return;
    }
    for (const store of [
      ANALYSIS_STORE,
      ANALYSIS_INDEX_STORE,
      REVIEW_STORE,
      PLATFORM_ACCOUNT_STORE,
      SYNCED_GAME_STORE,
      PLATFORM_SYNC_STORE,
      TRAINING_QUEUE_STORE,
      HISTORY_ANALYSIS_JOB_STORE,
    ]) {
      await clearStore(database, store);
    }
  } finally {
    database.close();
  }
  if (scope === "all") {
    window.localStorage.removeItem(SETTINGS_KEY);
    window.dispatchEvent(new Event("open-chess-review-settings"));
  }
}

export const LOCAL_DATA_RETENTION = "Games, reviews, analysis cache, training jobs and settings stay in this browser until you delete them. Disconnecting an account does not delete imported games unless you choose that option.";

export { DEFAULT_APP_SETTINGS };
