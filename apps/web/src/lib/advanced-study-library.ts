import { OBJECTIVE_ALGORITHM_VERSION, type StudyGameInput } from "@chess-review/analysis";
import type { GameAnalysisV1, PlayerColor, SyncedGame } from "@chess-review/shared";
import { listCachedAnalyses } from "./analysis-cache";
import { listSyncedGames } from "./platform-library";
import { listReviewRecords, type ReviewRecord } from "./review-library";

export interface StudyPlayerLibrary {
  key: string;
  name: string;
  games: StudyGameInput[];
}

function playerName(analysis: GameAnalysisV1, color: PlayerColor): string | null {
  const value = analysis.game.headers[color === "white" ? "White" : "Black"]?.trim();
  if (!value || !/[\p{L}\p{N}]/u.test(value) || /^(white|black|\?)$/i.test(value)) return null;
  return value;
}

export function studyPlayerKey(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

function resultFromPgn(analysis: GameAnalysisV1, color: PlayerColor): StudyGameInput["result"] {
  const result = analysis.game.headers.Result;
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return color === "white" ? "win" : "loss";
  if (result === "0-1") return color === "black" ? "win" : "loss";
  return "unknown";
}

function resultForRecord(record: ReviewRecord, analysis: GameAnalysisV1, color: PlayerColor): StudyGameInput["result"] {
  if (record.preferredOrientation === color) {
    if (record.sourceResult === "win" || record.sourceResult === "loss" || record.sourceResult === "draw") return record.sourceResult;
  }
  return resultFromPgn(analysis, color);
}

function latestAnalysesByPgn(analyses: GameAnalysisV1[]): Map<string, GameAnalysisV1> {
  const latest = new Map<string, GameAnalysisV1>();
  for (const analysis of analyses) {
    if (analysis.algorithmVersion !== OBJECTIVE_ALGORITHM_VERSION || !analysis.game.pgn) continue;
    const prior = latest.get(analysis.game.pgn);
    if (!prior || analysis.createdAt.localeCompare(prior.createdAt) > 0) latest.set(analysis.game.pgn, analysis);
  }
  return latest;
}

function headerPlayedAt(analysis: GameAnalysisV1): string | null {
  const raw = analysis.game.headers.Date;
  if (!raw || !/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw.replaceAll(".", "-")}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildStudyPlayerLibraries(
  records: ReviewRecord[],
  analyses: GameAnalysisV1[],
  syncedGames: SyncedGame[] = [],
): StudyPlayerLibrary[] {
  const latest = latestAnalysesByPgn(analyses);
  const syncedById = new Map(syncedGames.map((game) => [game.id, game]));
  const players = new Map<string, StudyPlayerLibrary>();

  for (const record of records) {
    if (record.kind !== "pgn") continue;
    const analysis = latest.get(record.input);
    if (!analysis) continue;
    const colors: PlayerColor[] = record.preferredOrientation ? [record.preferredOrientation] : ["white", "black"];
    for (const color of colors) {
      const name = playerName(analysis, color);
      if (!name) continue;
      const key = studyPlayerKey(name);
      const library = players.get(key) ?? { key, name, games: [] };
      if (library.games.some(({ gameId }) => gameId === record.id)) continue;
      library.games.push({
        gameId: record.id,
        title: record.title,
        playedAt: record.playedAt
          ?? (record.external ? syncedById.get(`${record.external.provider}:${record.external.externalGameId}`)?.playedAt : undefined)
          ?? headerPlayedAt(analysis)
          ?? record.createdAt,
        playerColor: color,
        result: resultForRecord(record, analysis, color),
        analysis,
      });
      players.set(key, library);
    }
  }

  return [...players.values()]
    .map((player) => ({ ...player, games: player.games.sort((left, right) => left.playedAt.localeCompare(right.playedAt)) }))
    .sort((left, right) => right.games.length - left.games.length || left.name.localeCompare(right.name));
}

export async function loadStudyPlayerLibraries(): Promise<StudyPlayerLibrary[]> {
  const [records, analyses, syncedGames] = await Promise.all([listReviewRecords(), listCachedAnalyses(), listSyncedGames()]);
  return buildStudyPlayerLibraries(records, analyses, syncedGames);
}
