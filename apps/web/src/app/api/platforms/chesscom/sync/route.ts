import type { PlatformAccount, SyncedGame } from "@chess-review/shared";

const HEADERS = { Accept: "application/json", "User-Agent": "OpenChessReview/0.1 contact: local-user" };

interface ChessComGame {
  url?: string;
  pgn?: string;
  end_time?: number;
  time_class?: string;
  time_control?: string;
  rated?: boolean;
  white?: { username?: string; rating?: number; result?: string };
  black?: { username?: string; rating?: number; result?: string };
}

function normalizedResult(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "win") return "win";
  if (["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(value)) return "draw";
  return "loss";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { account?: PlatformAccount; since?: string; limit?: number } | null;
  const account = body?.account;
  if (!account || account.provider !== "chesscom") return Response.json({ error: "A linked Chess.com account is required." }, { status: 400 });
  const response = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(account.username.toLowerCase())}/games/archives`, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) return Response.json({ error: `Chess.com archive request failed (${response.status}).` }, { status: 502 });
  const archiveBody = await response.json() as { archives?: string[] };
  const sinceMs = body.since ? Date.parse(body.since) : 0;
  const limit = Math.max(1, Math.min(100, body.limit ?? 50));
  const archiveUrls = (archiveBody.archives ?? []).filter((url) => {
    if (!sinceMs) return true;
    const match = url.match(/\/(\d{4})\/(\d{2})$/);
    return !match || Date.UTC(Number(match[1]), Number(match[2]), 1) >= sinceMs - 32 * 86_400_000;
  }).slice(-3).reverse();
  const rawGames: ChessComGame[] = [];
  for (const archiveUrl of archiveUrls) {
    if (rawGames.length >= limit) break;
    const archiveResponse = await fetch(archiveUrl, { headers: HEADERS, cache: "no-store" });
    if (archiveResponse.status === 429) return Response.json({ error: "Chess.com rate limit reached. Try syncing again shortly." }, { status: 429 });
    if (!archiveResponse.ok) continue;
    const archive = await archiveResponse.json() as { games?: ChessComGame[] };
    rawGames.push(...(archive.games ?? []).reverse());
  }
  const now = new Date().toISOString();
  const normalizedUsername = account.username.toLowerCase();
  const games: SyncedGame[] = rawGames
    .filter((game) => game.pgn && game.end_time && game.end_time * 1000 > sinceMs)
    .slice(0, limit)
    .map((game) => {
      const externalGameId = game.url?.split("/").filter(Boolean).at(-1) ?? `${game.end_time}-${game.white?.username}-${game.black?.username}`;
      const whiteName = game.white?.username ?? "White";
      const blackName = game.black?.username ?? "Black";
      const whiteResult = normalizedResult(game.white?.result);
      const blackResult = normalizedResult(game.black?.result);
      return {
        id: `chesscom:${externalGameId}`,
        external: { provider: "chesscom", externalGameId, accountId: account.id, username: account.username, ...(game.url ? { url: game.url } : {}), importedAt: now },
        pgn: game.pgn!,
        playedAt: new Date((game.end_time ?? 0) * 1000).toISOString(),
        ...(game.time_class ? { timeClass: game.time_class } : {}),
        ...(game.time_control ? { timeControl: game.time_control } : {}),
        ...(game.rated === undefined ? {} : { rated: game.rated }),
        white: { username: whiteName, ...(game.white?.rating === undefined ? {} : { rating: game.white.rating }), ...(whiteResult === undefined ? {} : { result: whiteResult }) },
        black: { username: blackName, ...(game.black?.rating === undefined ? {} : { rating: game.black.rating }), ...(blackResult === undefined ? {} : { result: blackResult }) },
        accountColor: whiteName.toLowerCase() === normalizedUsername ? "white" : "black",
        analyzed: false,
        syncedAt: now,
      };
    });
  const updatedAccount: PlatformAccount = { ...account, lastSyncAt: now };
  return Response.json({ provider: "chesscom", account: updatedAccount, games, ...(games[0] ? { cursor: games[0].playedAt } : {}) });
}
