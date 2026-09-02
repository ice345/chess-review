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

function readOne<T>(database: IDBDatabase, storeName: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error(`Unable to read ${storeName}.`));
  });
}

/**
 * A synced game is review-ready only when the durable link to its canonical
 * objective analysis is present. Older builds briefly set `analyzed` when a
 * review record was opened, before Stockfish/cache work existed; treating that
 * legacy shape as pending lets the next full-history job repair it.
 */
export function syncedGameHasAnalysis(game: SyncedGame): boolean {
  return game.analyzed
    && typeof game.analysisId === "string"
    && game.analysisId.length > 0
    && typeof game.analysisAlgorithmVersion === "string"
    && game.analysisAlgorithmVersion.length > 0
    && typeof game.analysisDepth === "number";
}

function normalizeSyncedGame(game: SyncedGame): SyncedGame {
  if (!game.analyzed || syncedGameHasAnalysis(game)) return game;
  const repaired = { ...game, analyzed: false };
  delete repaired.analysisId;
  delete repaired.analysisAlgorithmVersion;
  delete repaired.analysisDepth;
  delete repaired.analyzedAt;
  return repaired;
}

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const database = await openReviewDatabase();
  try {
    return (await readAll<PlatformAccount>(database, PLATFORM_ACCOUNT_STORE)).sort((left, right) => left.linkedAt.localeCompare(right.linkedAt));
  } finally {
    database.close();
  }
}

export async function getPlatformAccount(accountId: string): Promise<PlatformAccount | null> {
  const database = await openReviewDatabase();
  try {
    return await readOne<PlatformAccount>(database, PLATFORM_ACCOUNT_STORE, accountId);
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
    const games = (await readAll<SyncedGame>(database, SYNCED_GAME_STORE)).map(normalizeSyncedGame);
    return games
      .filter((game) => filters.provider === undefined || game.external.provider === filters.provider)
      .filter((game) => filters.analyzed === undefined || game.analyzed === filters.analyzed)
      .sort((left, right) => right.playedAt.localeCompare(left.playedAt));
  } finally {
    database.close();
  }
}

export async function getSyncedGame(gameId: string): Promise<SyncedGame | null> {
  const database = await openReviewDatabase();
  try {
    const game = await readOne<SyncedGame>(database, SYNCED_GAME_STORE, gameId);
    return game ? normalizeSyncedGame(game) : null;
  } finally {
    database.close();
  }
}

export async function saveSyncedGames(games: SyncedGame[]): Promise<SyncedGame[]> {
  if (games.length === 0) return [];
  const database = await openReviewDatabase();
  try {
    const added: SyncedGame[] = [];
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SYNCED_GAME_STORE, "readwrite");
      const store = transaction.objectStore(SYNCED_GAME_STORE);
      for (const game of games) {
        const request = store.get(game.id);
        request.onsuccess = () => {
          const prior = request.result as SyncedGame | undefined;
          store.put({
            ...game,
            analyzed: prior?.analyzed ?? game.analyzed,
            ...(prior?.analysisId ? { analysisId: prior.analysisId } : {}),
            ...(prior?.analysisAlgorithmVersion ? { analysisAlgorithmVersion: prior.analysisAlgorithmVersion } : {}),
            ...(prior?.analysisDepth === undefined ? {} : { analysisDepth: prior.analysisDepth }),
            ...(prior?.analyzedAt ? { analyzedAt: prior.analyzedAt } : {}),
          }, game.id);
          if (!prior) added.push(game);
        };
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to store synced games."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Synced-game write was aborted."));
    });
    return added;
  } finally {
    database.close();
  }
}

export async function markSyncedGameAnalyzed(
  id: string,
  analysisId: string,
  metadata?: { algorithmVersion: string; depth: number; analyzedAt?: string },
): Promise<void> {
  const database = await openReviewDatabase();
  try {
    const game = await new Promise<SyncedGame | undefined>((resolve, reject) => {
      const request = database.transaction(SYNCED_GAME_STORE, "readonly").objectStore(SYNCED_GAME_STORE).get(id);
      request.onsuccess = () => resolve(request.result as SyncedGame | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read synced game."));
    });
    if (game) await write(database, SYNCED_GAME_STORE, id, {
      ...game,
      analyzed: true,
      analysisId,
      ...(metadata === undefined ? {} : {
        analysisAlgorithmVersion: metadata.algorithmVersion,
        analysisDepth: metadata.depth,
        analyzedAt: metadata.analyzedAt ?? new Date().toISOString(),
      }),
    });
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
