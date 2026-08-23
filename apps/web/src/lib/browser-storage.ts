export const DATABASE_NAME = "open-chess-review";
export const DATABASE_VERSION = 3;
export const ANALYSIS_STORE = "objective-analyses";
export const REVIEW_STORE = "review-records";
export const PLATFORM_ACCOUNT_STORE = "platform-accounts";
export const SYNCED_GAME_STORE = "synced-games";
export const PLATFORM_SYNC_STORE = "platform-sync-state";

export function openReviewDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const store of [ANALYSIS_STORE, REVIEW_STORE, PLATFORM_ACCOUNT_STORE, SYNCED_GAME_STORE, PLATFORM_SYNC_STORE]) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open Open Chess Review storage."));
  });
}
