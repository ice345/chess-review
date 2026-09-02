import { OBJECTIVE_ALGORITHM_VERSION, type StudyGameInput } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import type { NormalizedGame } from "@chess-review/chess-core";
import type {
  AnalysisCacheProjectionV1,
  AnyGameAnalysis,
  GameAnalysisV2,
  HistoryAnalysisJobV1,
  PlatformAccount,
  PlayerColor,
  SyncedGame,
} from "@chess-review/shared";
import {
  analysisGameFingerprint,
  gameMoveIdentity,
  getCachedAnalysisByKey,
  listAnalysisCacheProjections,
  projectionMoveIdentity,
} from "./analysis-cache";
import { listPlatformAccounts, listSyncedGames, markSyncedGameAnalyzed, syncedGameHasAnalysis } from "./platform-library";
import { listHistoryAnalysisJobs } from "./history-analysis-jobs";
import {
  buildReviewRecordFromSyncedGame,
  listReviewRecords,
  saveReviewRecord,
  type ReviewRecord,
} from "./review-library";

export interface StudyPlayerIdentity {
  kind: "connected-account" | "manual-player";
  accountId?: string;
  provider?: PlatformAccount["provider"];
}

export interface StudyPlayerSummary extends StudyPlayerIdentity {
  key: string;
  name: string;
  gameCount: number;
}

export interface StudyPlayerLibrary extends StudyPlayerIdentity {
  key: string;
  name: string;
  games: StudyGameInput[];
}

function playerNameFromHeaders(headers: Record<string, string>, color: PlayerColor): string | null {
  const value = headers[color === "white" ? "White" : "Black"]?.trim();
  if (!value || !/[\p{L}\p{N}]/u.test(value) || /^(white|black|\?)$/i.test(value)) return null;
  return value;
}

function playerName(analysis: AnyGameAnalysis, color: PlayerColor): string | null {
  return playerNameFromHeaders(analysis.game.headers, color);
}

export function studyPlayerKey(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

export function connectedStudyPlayerKey(accountId: string): string {
  return `account:${accountId}`;
}

export function manualStudyPlayerKey(name: string): string {
  return `manual:${studyPlayerKey(name)}`;
}

/**
 * Runtime study projection: retain deterministic report/evidence fields while
 * dropping large PV and optional enrichment payloads. The canonical cache is
 * unchanged and remains the source for exact review links.
 */
export function compactAnalysisForStudy(analysis: GameAnalysisV2): GameAnalysisV2 {
  const moves = analysis.moves.map((move) => {
    const compact = {
      ...move,
      stockfish: { ...move.stockfish, lines: [] },
    };
    delete compact.human;
    delete compact.coach;
    return compact;
  });
  const compact = { ...analysis, moves };
  delete compact.coachSummary;
  return compact;
}

function resultFromPgn(analysis: AnyGameAnalysis, color: PlayerColor): StudyGameInput["result"] {
  const result = analysis.game.headers.Result;
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return color === "white" ? "win" : "loss";
  if (result === "0-1") return color === "black" ? "win" : "loss";
  return "unknown";
}

function resultForRecord(record: ReviewRecord, analysis: AnyGameAnalysis, color: PlayerColor): StudyGameInput["result"] {
  if (record.preferredOrientation === color) {
    if (record.sourceResult === "win" || record.sourceResult === "loss" || record.sourceResult === "draw") return record.sourceResult;
  }
  return resultFromPgn(analysis, color);
}

interface LatestAnalysisIndex {
  byPgn: Map<string, AnyGameAnalysis>;
  byIdentity: Map<string, AnyGameAnalysis>;
}

function analysisMovesIdentity(analysis: Extract<AnyGameAnalysis, { version: 2 }>): string {
  return gameMoveIdentity(analysis.game.initialFen, analysis.moves.map((move) => move.uci));
}

function latestAnalysesIndex(analyses: AnyGameAnalysis[]): LatestAnalysisIndex {
  const index: LatestAnalysisIndex = { byPgn: new Map(), byIdentity: new Map() };
  for (const analysis of analyses) {
    if (analysis.version !== 2 || analysis.algorithmVersion !== OBJECTIVE_ALGORITHM_VERSION || !analysis.game.pgn) continue;
    const prior = index.byPgn.get(analysis.game.pgn);
    if (!prior || analysis.createdAt.localeCompare(prior.createdAt) > 0) index.byPgn.set(analysis.game.pgn, analysis);
    const identity = analysisMovesIdentity(analysis);
    const priorIdentity = index.byIdentity.get(identity);
    if (!priorIdentity || analysis.createdAt.localeCompare(priorIdentity.createdAt) > 0) index.byIdentity.set(identity, analysis);
  }
  return index;
}

function latestAnalysisForRecord(record: ReviewRecord, index: LatestAnalysisIndex): AnyGameAnalysis | null {
  const exact = record.kind === "pgn" ? index.byPgn.get(record.input) : undefined;
  if (exact) return exact;
  if (record.kind !== "pgn" || index.byIdentity.size === 0) return null;
  try {
    return index.byIdentity.get(gameAnalysisIdentity(parsePgn(record.input))) ?? null;
  } catch {
    return null;
  }
}

function headerPlayedAt(analysis: AnyGameAnalysis): string | null {
  const raw = analysis.game.headers.Date;
  if (!raw || !/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw.replaceAll(".", "-")}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function identityForRecord(
  record: ReviewRecord,
  analysis: AnyGameAnalysis,
  color: PlayerColor,
  accounts: ReadonlyMap<string, PlatformAccount>,
): { key: string; name: string; identity: StudyPlayerIdentity } | null {
  if (record.external) {
    if (record.preferredOrientation !== color) return null;
    const account = accounts.get(record.external.accountId);
    return {
      key: connectedStudyPlayerKey(record.external.accountId),
      name: account?.displayName ?? account?.username ?? record.external.username,
      identity: {
        kind: "connected-account",
        accountId: record.external.accountId,
        provider: record.external.provider,
      },
    };
  }
  const name = playerName(analysis, color);
  if (!name) return null;
  return { key: manualStudyPlayerKey(name), name, identity: { kind: "manual-player" } };
}

export function buildStudyPlayerLibraries(
  records: ReviewRecord[],
  analyses: AnyGameAnalysis[],
  syncedGames: SyncedGame[] = [],
  accounts: PlatformAccount[] = [],
): StudyPlayerLibrary[] {
  const latest = latestAnalysesIndex(analyses);
  const syncedByExternalKey = new Map(syncedGames.map((game) => [syncedGameKey(game), game]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const players = new Map<string, StudyPlayerLibrary>();

  for (const record of records) {
    if (record.kind !== "pgn") continue;
    const analysis = latestAnalysisForRecord(record, latest);
    if (!analysis) continue;
    const colors: PlayerColor[] = record.preferredOrientation ? [record.preferredOrientation] : ["white", "black"];
    for (const color of colors) {
      const identified = identityForRecord(record, analysis, color, accountsById);
      if (!identified) continue;
      const library = players.get(identified.key) ?? {
        key: identified.key,
        name: identified.name,
        ...identified.identity,
        games: [],
      };
      if (library.games.some(({ gameId }) => gameId === record.id)) continue;
      const synced = record.external
        ? syncedByExternalKey.get(`${record.external.provider}:${record.external.accountId}:${record.external.externalGameId}`)
        : undefined;
      library.games.push({
        gameId: record.id,
        title: record.title,
        playedAt: record.playedAt ?? synced?.playedAt ?? headerPlayedAt(analysis) ?? record.createdAt,
        playerColor: color,
        result: resultForRecord(record, analysis, color),
        analysis,
        ...(synced === undefined ? {} : {
          source: {
            accountId: synced.external.accountId,
            provider: synced.external.provider,
            ...(synced.timeClass === undefined ? {} : { timeClass: synced.timeClass }),
            ...(synced.rated === undefined ? {} : { rated: synced.rated }),
            ...(synced[color].rating === undefined ? {} : { playerRating: synced[color].rating }),
            ...(synced[color === "white" ? "black" : "white"].rating === undefined
              ? {}
              : { opponentRating: synced[color === "white" ? "black" : "white"].rating }),
          },
        }),
      });
      players.set(identified.key, library);
    }
  }

  return [...players.values()]
    .map((player) => ({ ...player, games: player.games.sort((left, right) => left.playedAt.localeCompare(right.playedAt)) }))
    .sort((left, right) => right.games.length - left.games.length || left.name.localeCompare(right.name));
}

async function recordProjectionPairs(
  records: ReviewRecord[],
  projections: AnalysisCacheProjectionV1[],
): Promise<Array<{ record: ReviewRecord; projection: AnalysisCacheProjectionV1 }>> {
  const latestByFingerprint = new Map<string, AnalysisCacheProjectionV1>();
  const latestByIdentity = new Map<string, AnalysisCacheProjectionV1>();
  for (const item of projections) {
    const prior = latestByFingerprint.get(item.gameFingerprint);
    if (!prior || item.createdAt.localeCompare(prior.createdAt) > 0) latestByFingerprint.set(item.gameFingerprint, item);
    const identity = projectionAnalysisIdentity(item);
    if (identity !== null) {
      const priorIdentity = latestByIdentity.get(identity);
      if (!priorIdentity || item.createdAt.localeCompare(priorIdentity.createdAt) > 0) latestByIdentity.set(identity, item);
    }
  }
  const pairs = await Promise.all(records.filter((record) => record.kind === "pgn").map(async (record) => {
    try {
      const game = parsePgn(record.input);
      const fingerprint = await analysisGameFingerprint(game);
      const item = latestByFingerprint.get(fingerprint)
        ?? (latestByIdentity.size === 0 ? undefined : latestByIdentity.get(gameAnalysisIdentity(game)));
      return item ? { record, projection: item } : null;
    } catch {
      return null;
    }
  }));
  return pairs.filter((pair): pair is { record: ReviewRecord; projection: AnalysisCacheProjectionV1 } => pair !== null);
}

function syncedGameKey(game: SyncedGame): string {
  return `${game.external.provider}:${game.external.accountId}:${game.external.externalGameId}`;
}

/**
 * Header-independent game identity. A PGN-string fingerprint changes when
 * serialization drifts between builds sharing persisted browser data, which
 * silently disconnected older cached analyses from Training. The initial FEN
 * plus the played UCI sequence names the same chess game under any
 * normalization.
 */
function gameAnalysisIdentity(game: NormalizedGame): string {
  return gameMoveIdentity(game.initialFen, game.plies.map((ply) => ply.uci));
}

function projectionAnalysisIdentity(projection: AnalysisCacheProjectionV1): string | null {
  return projectionMoveIdentity(projection);
}

function recordExternalKey(record: ReviewRecord): string | null {
  if (!record.external) return null;
  return `${record.external.provider}:${record.external.accountId}:${record.external.externalGameId}`;
}

/**
 * Older bulk-analysis runs could mark a synced game and write its objective
 * cache without creating the review record that connects that cache to a
 * Training player — and some runs left neither marker nor record behind even
 * though the cached projection exists. Repair those durable links from the
 * synced-game identity and current cache index before building summaries.
 *
 * A cache projection for the current objective version is completion evidence
 * for legacy cache-only data. When a durable history item exists, its per-game
 * status wins: only cached/completed items may repair a missing link, so a
 * duplicate PGN cannot make a failed item look successful. The operation is
 * idempotent.
 */
async function ensureConnectedReviewRecords(
  records: ReviewRecord[],
  projections: AnalysisCacheProjectionV1[],
  syncedGames: SyncedGame[],
  jobs: readonly HistoryAnalysisJobV1[] = [],
): Promise<ReviewRecord[]> {
  const latestByFingerprint = new Map<string, AnalysisCacheProjectionV1>();
  const latestByIdentity = new Map<string, AnalysisCacheProjectionV1>();
  for (const projection of projections) {
    const prior = latestByFingerprint.get(projection.gameFingerprint);
    if (!prior || projection.createdAt.localeCompare(prior.createdAt) > 0) {
      latestByFingerprint.set(projection.gameFingerprint, projection);
    }
    const identity = projectionAnalysisIdentity(projection);
    if (identity !== null) {
      const priorIdentity = latestByIdentity.get(identity);
      if (!priorIdentity || projection.createdAt.localeCompare(priorIdentity.createdAt) > 0) {
        latestByIdentity.set(identity, projection);
      }
    }
  }
  const recordsByExternalKey = new Map(records.flatMap((record) => {
    const key = recordExternalKey(record);
    return key === null ? [] : [[key, record] as const];
  }));
  const historyStatesByGame = new Map<string, Set<HistoryAnalysisJobV1["items"][number]["status"]>>();
  const successfulHistoryByGame = new Map<string, HistoryAnalysisJobV1["items"][number]>();
  for (const job of jobs) {
    for (const item of job.items) {
      const states = historyStatesByGame.get(item.gameId) ?? new Set<HistoryAnalysisJobV1["items"][number]["status"]>();
      states.add(item.status);
      historyStatesByGame.set(item.gameId, states);
      if (item.status === "cached" || item.status === "completed") {
        const prior = successfulHistoryByGame.get(item.gameId);
        if (!prior || item.updatedAt.localeCompare(prior.updatedAt) > 0) {
          successfulHistoryByGame.set(item.gameId, item);
        }
      }
    }
  }
  const syncedByExternalKey = new Map(syncedGames.map((game) => [syncedGameKey(game), game]));
  // analyzeSyncedGame creates the external review record before Stockfish
  // runs. Do not let that pending/failed shell consume a shared PGN cache in
  // Training; it becomes eligible only after its own synced marker or a
  // successful history item is present. The record remains in IndexedDB so
  // History can still offer a retry.
  const retainedRecords = records.filter((record) => {
    const key = recordExternalKey(record);
    if (key === null) return true;
    const game = syncedByExternalKey.get(key);
    if (!game) return true;
    if (syncedGameHasAnalysis(game)) return true;
    const states = historyStatesByGame.get(game.id);
    return states?.has("cached") === true || states?.has("completed") === true;
  });
  const knownExternalKeys = new Set(retainedRecords.flatMap((record) => {
    const key = recordExternalKey(record);
    return key === null ? [] : [key];
  }));
  const candidates = new Map<string, { game: SyncedGame; projection: AnalysisCacheProjectionV1 }>();
  for (const game of syncedGames) {
    const key = syncedGameKey(game);
    const existingRecord = recordsByExternalKey.get(key);
    if (existingRecord) {
      // Old records may carry a stale/colliding analysisId. Keep the synced
      // game link pointing at the external record that Training actually uses.
      if (syncedGameHasAnalysis(game) && game.analysisId !== existingRecord.id) {
        await markSyncedGameAnalyzed(game.id, existingRecord.id, {
          algorithmVersion: game.analysisAlgorithmVersion!,
          depth: game.analysisDepth!,
          ...(game.analyzedAt === undefined ? {} : { analyzedAt: game.analyzedAt }),
        });
      }
      const successfulHistory = successfulHistoryByGame.get(game.id);
      if (!syncedGameHasAnalysis(game) && successfulHistory) {
        try {
          const parsed = parsePgn(game.pgn);
          const fingerprint = await analysisGameFingerprint(parsed);
          const projection = latestByFingerprint.get(fingerprint) ?? latestByIdentity.get(gameAnalysisIdentity(parsed));
          if (projection) {
            await markSyncedGameAnalyzed(game.id, existingRecord.id, {
              algorithmVersion: projection.algorithmVersion,
              depth: projection.engine.depth,
              analyzedAt: projection.createdAt,
            });
          }
        } catch {
          // The successful history item will remain visible only if its
          // canonical projection can be paired below; do not invent a marker.
        }
      }
      continue;
    }
    if (knownExternalKeys.has(key) || candidates.has(key)) continue;
    // A stale algorithm marker can never be repaired from today's cache, but
    // the ABSENCE of a marker does not mean absence of analysis: older builds
    // wrote caches without leaving any link behind. Only current-version
    // markers are rejected outright; marker-less games fall through to the
    // fingerprint gate below.
    if (game.analysisAlgorithmVersion !== undefined && game.analysisAlgorithmVersion !== OBJECTIVE_ALGORITHM_VERSION) continue;
    const historyStates = historyStatesByGame.get(game.id);
    const hasSuccessfulHistoryItem = historyStates?.has("cached") || historyStates?.has("completed");
    // A cache entry is not proof that this particular synced game finished: a
    // duplicate PGN may belong to a different game item whose engine request
    // failed or was cancelled. Legacy cache-only games without any job record
    // are still repairable, but an explicitly unfinished/failed item must wait
    // for its own successful job item.
    if (historyStates && !hasSuccessfulHistoryItem) continue;
    try {
      const parsed = parsePgn(game.pgn);
      const fingerprint = await analysisGameFingerprint(parsed);
      const projection = latestByFingerprint.get(fingerprint) ?? latestByIdentity.get(gameAnalysisIdentity(parsed));
      if (projection) candidates.set(key, { game, projection });
    } catch {
      // An invalid legacy PGN remains visible in Coverage but cannot be a
      // canonical review record; the analysis job will expose its own error.
    }
  }
  if (candidates.size === 0) return retainedRecords;
  const additions: ReviewRecord[] = [];
  for (const [key, { game, projection }] of candidates) {
    const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game));
    // Repair the durable reverse link as well. This keeps History/Home's
    // "Open review" action valid when an older run left only cache metadata.
    // The matched projection IS completion evidence, so its algorithm version,
    // depth and creation time restore truthful metadata for marker-less games.
    await markSyncedGameAnalyzed(game.id, record.id, {
      algorithmVersion: projection.algorithmVersion,
      depth: projection.engine.depth,
      analyzedAt: projection.createdAt,
    });
    additions.push(record);
    knownExternalKeys.add(key);
  }
  return [...retainedRecords, ...additions];
}

export async function loadStudyPlayerSummaries(): Promise<StudyPlayerSummary[]> {
  const [records, projections, accounts, syncedGames, jobs] = await Promise.all([
    listReviewRecords(),
    listAnalysisCacheProjections(),
    listPlatformAccounts(),
    listSyncedGames(),
    listHistoryAnalysisJobs(),
  ]);
  const effectiveRecords = await ensureConnectedReviewRecords(records, projections, syncedGames, jobs);
  const pairs = await recordProjectionPairs(effectiveRecords, projections);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const summaries = new Map<string, StudyPlayerSummary>();
  for (const { record, projection: item } of pairs) {
    const colors: PlayerColor[] = record.preferredOrientation ? [record.preferredOrientation] : ["white", "black"];
    for (const color of colors) {
      const shape = { game: { headers: item.headers } } as AnyGameAnalysis;
      const identified = identityForRecord(record, shape, color, accountsById);
      if (!identified) continue;
      const existing = summaries.get(identified.key);
      if (existing) existing.gameCount += 1;
      else summaries.set(identified.key, {
        key: identified.key,
        name: identified.name,
        gameCount: 1,
        ...identified.identity,
      });
    }
  }
  return [...summaries.values()].sort((left, right) => right.gameCount - left.gameCount
    || Number(right.kind === "connected-account") - Number(left.kind === "connected-account")
    || left.name.localeCompare(right.name));
}

export async function loadStudyPlayerLibrary(key: string): Promise<StudyPlayerLibrary | null> {
  const [records, projections, syncedGames, accounts, jobs] = await Promise.all([
    listReviewRecords(),
    listAnalysisCacheProjections(),
    listSyncedGames(),
    listPlatformAccounts(),
    listHistoryAnalysisJobs(),
  ]);
  const effectiveRecords = await ensureConnectedReviewRecords(records, projections, syncedGames, jobs);
  const pairs = await recordProjectionPairs(effectiveRecords, projections);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const selected = pairs.filter(({ record, projection: item }) => {
    const colors: PlayerColor[] = record.preferredOrientation ? [record.preferredOrientation] : ["white", "black"];
    return colors.some((color) => identityForRecord(
      record,
      { game: { headers: item.headers } } as AnyGameAnalysis,
      color,
      accountsById,
    )?.key === key);
  });
  const analyses: GameAnalysisV2[] = [];
  for (const { projection: item } of selected) {
    const analysis = await getCachedAnalysisByKey(item.cacheKey);
    if (analysis) analyses.push(compactAnalysisForStudy(analysis));
  }
  return buildStudyPlayerLibraries(effectiveRecords, analyses, syncedGames, accounts).find((player) => player.key === key) ?? null;
}

/** Compatibility helper for deterministic tests and small callers. */
export async function loadStudyPlayerLibraries(): Promise<StudyPlayerLibrary[]> {
  const summaries = await loadStudyPlayerSummaries();
  return (await Promise.all(summaries.map((summary) => loadStudyPlayerLibrary(summary.key))))
    .filter((library): library is StudyPlayerLibrary => library !== null);
}
