import type { ExternalPlatform, PlatformAccount, PlatformSyncState, SyncedGame } from "@chess-review/shared";
import {
  openReviewDatabase,
  PLATFORM_ACCOUNT_STORE,
  PLATFORM_SYNC_STORE,
  SYNCED_GAME_STORE,
} from "./browser-storage";

function readAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`Unable to read ${storeName}.`));
  });
}

function write<T>(database: IDBDatabase, storeName: string, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Unable to write ${storeName}.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`${storeName} write was aborted.`));
  });
}

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const database = await openReviewDatabase();
  try {
    return (await readAll<PlatformAccount>(database, PLATFORM_ACCOUNT_STORE)).sort((left, right) => left.linkedAt.localeCompare(right.linkedAt));
  } finally {
    database.close();
  }
}

export async function savePlatformAccount(account: PlatformAccount): Promise<PlatformAccount> {
  const database = await openReviewDatabase();
  try {
    await write(database, PLATFORM_ACCOUNT_STORE, account.id, account);
    return account;
  } finally {
    database.close();
  }
}

export async function removePlatformAccount(accountId: string): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([PLATFORM_ACCOUNT_STORE, PLATFORM_SYNC_STORE], "readwrite");
      transaction.objectStore(PLATFORM_ACCOUNT_STORE).delete(accountId);
      transaction.objectStore(PLATFORM_SYNC_STORE).delete(accountId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to unlink account."));
    });
  } finally {
    database.close();
  }
}

export async function listSyncedGames(filters: { provider?: ExternalPlatform; analyzed?: boolean } = {}): Promise<SyncedGame[]> {
  const database = await openReviewDatabase();
  try {
    const games = await readAll<SyncedGame>(database, SYNCED_GAME_STORE);
    return games
      .filter((game) => filters.provider === undefined || game.external.provider === filters.provider)
      .filter((game) => filters.analyzed === undefined || game.analyzed === filters.analyzed)
      .sort((left, right) => right.playedAt.localeCompare(left.playedAt));
  } finally {
    database.close();
  }
}

export async function saveSyncedGames(games: SyncedGame[]): Promise<SyncedGame[]> {
  if (games.length === 0) return [];
  const database = await openReviewDatabase();
  try {
    const existing = new Map((await readAll<SyncedGame>(database, SYNCED_GAME_STORE)).map((game) => [game.id, game]));
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SYNCED_GAME_STORE, "readwrite");
      const store = transaction.objectStore(SYNCED_GAME_STORE);
      for (const game of games) {
        const prior = existing.get(game.id);
        store.put({ ...game, analyzed: prior?.analyzed ?? game.analyzed, ...(prior?.analysisId ? { analysisId: prior.analysisId } : {}) }, game.id);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to store synced games."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Synced-game write was aborted."));
    });
    return games.filter((game) => !existing.has(game.id));
  } finally {
    database.close();
  }
}

export async function markSyncedGameAnalyzed(id: string, analysisId: string): Promise<void> {
  const database = await openReviewDatabase();
  try {
    const game = await new Promise<SyncedGame | undefined>((resolve, reject) => {
      const request = database.transaction(SYNCED_GAME_STORE, "readonly").objectStore(SYNCED_GAME_STORE).get(id);
      request.onsuccess = () => resolve(request.result as SyncedGame | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read synced game."));
    });
    if (game) await write(database, SYNCED_GAME_STORE, id, { ...game, analyzed: true, analysisId });
  } finally {
    database.close();
  }
}

export async function savePlatformSyncState(state: PlatformSyncState): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await write(database, PLATFORM_SYNC_STORE, state.accountId, state);
  } finally {
    database.close();
  }
}

export async function listPlatformSyncStates(): Promise<PlatformSyncState[]> {
  const database = await openReviewDatabase();
  try {
    return await readAll<PlatformSyncState>(database, PLATFORM_SYNC_STORE);
  } finally {
    database.close();
  }
}
