import { fetchProvider, readProviderText } from "../../../../../lib/server/platform-response";
import { platformRequest, readSyncInput } from "../../../../../lib/server/platform-request";
import { cookies } from "next/headers";
import type { PlatformAccount, SyncedGame } from "@chess-review/shared";
import { LICHESS_SESSION_COOKIE, readLichessSession, type LichessSession } from "../../../../../lib/server/lichess-session";
import { encodeLichessCursor, lichessUntil } from "../../../../../lib/platform-sync";

interface LichessGame {
  id: string;
  rated?: boolean;
  speed?: string;
  createdAt?: number;
  lastMoveAt?: number;
  winner?: "white" | "black";
  status?: string;
  pgn?: string;
  clock?: { initial?: number; increment?: number };
  players?: {
    white?: { user?: { id?: string; name?: string }; rating?: number };
    black?: { user?: { id?: string; name?: string }; rating?: number };
  };
}

function resultFor(color: "white" | "black", winner: LichessGame["winner"], status?: string): string | undefined {
  if (winner) return winner === color ? "win" : "loss";
  if (status === "draw" || status === "stalemate") return "draw";
  return undefined;
}

export async function POST(request: Request) {
  return platformRequest(request, handleRequest, "lichess");
}

async function handleRequest(request: Request, signal: AbortSignal) {
  let session: LichessSession;
  try {
    const sealed = (await cookies()).get(LICHESS_SESSION_COOKIE)?.value;
    if (!sealed) return Response.json({ error: "Connect Lichess before syncing." }, { status: 401 });
    session = readLichessSession(sealed);
  } catch {
    return Response.json({ error: "The Lichess session is invalid. Connect again." }, { status: 401 });
  }
  const body = await readSyncInput(request, "lichess", signal);
  const limit = Math.max(1, Math.min(100, body?.limit ?? 50));
  const mode = body?.mode ?? "incremental";
  const url = new URL(`https://lichess.org/api/games/user/${encodeURIComponent(session.account.id)}`);
  url.searchParams.set("max", String(limit));
  url.searchParams.set("pgnInJson", "true");
  url.searchParams.set("opening", "true");
  url.searchParams.set("clocks", "false");
  url.searchParams.set("evals", "false");
  if (mode === "incremental" && body?.since) url.searchParams.set("since", String(Date.parse(body.since)));
  const until = lichessUntil(body?.cursor);
  if (until !== null) url.searchParams.set("until", String(until));
  const response = await fetchProvider(url, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/x-ndjson" }, cache: "no-store", signal, redirect: "error" });
  if (response.status === 429) return Response.json(
    { error: "Lichess rate limit reached. Sync can resume from the saved game checkpoint." },
    { status: 429, headers: { "Retry-After": response.headers.get("Retry-After") ?? "60" } },
  );
  if (!response.ok) return Response.json({ error: `Lichess game export failed (${response.status}).` }, { status: response.status === 401 ? 401 : 502 });
  const raw = await readProviderText(response, signal);
  const rawGames = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as LichessGame);
  const now = new Date().toISOString();
  const account: PlatformAccount = {
    id: `lichess:${session.account.id}`,
    provider: "lichess",
    username: session.account.username,
    ...(session.account.displayName ? { displayName: session.account.displayName } : {}),
    ...(session.account.avatarUrl ? { avatarUrl: session.account.avatarUrl } : {}),
    authMode: "oauth-pkce",
    verified: true,
    linkedAt: now,
    ...(rawGames.length < limit ? { lastSyncAt: now } : {}),
    ...(session.account.ratings ? { ratings: session.account.ratings } : {}),
  };
  const games: SyncedGame[] = rawGames.filter((game) => game.pgn).flatMap((game) => {
    const white = game.players?.white;
    const black = game.players?.black;
    const whiteName = white?.user?.name ?? "White";
    const blackName = black?.user?.name ?? "Black";
    const sessionId = session.account.id.toLowerCase();
    const whiteMatch = white?.user?.id?.toLowerCase() === sessionId;
    const blackMatch = black?.user?.id?.toLowerCase() === sessionId;
    if (!whiteMatch && !blackMatch) return [];
    const playedAt = new Date(game.lastMoveAt ?? game.createdAt ?? Date.now()).toISOString();
    const whiteResult = resultFor("white", game.winner, game.status);
    const blackResult = resultFor("black", game.winner, game.status);
    return [{
      id: `lichess:${game.id}`,
      external: { provider: "lichess", externalGameId: game.id, accountId: account.id, username: account.username, url: `https://lichess.org/${game.id}`, importedAt: now },
      pgn: game.pgn!,
      playedAt,
      ...(game.speed ? { timeClass: game.speed } : {}),
      ...(game.clock?.initial === undefined ? {} : { timeControl: `${game.clock.initial}+${game.clock.increment ?? 0}` }),
      ...(game.rated === undefined ? {} : { rated: game.rated }),
      white: { username: whiteName, ...(white?.rating === undefined ? {} : { rating: white.rating }), ...(whiteResult ? { result: whiteResult } : {}) },
      black: { username: blackName, ...(black?.rating === undefined ? {} : { rating: black.rating }), ...(blackResult ? { result: blackResult } : {}) },
      accountColor: whiteMatch ? "white" as const : "black" as const,
      analyzed: false,
      syncedAt: now,
    }];
  });
  const playedTimes = rawGames.flatMap((game) => {
    const value = game.lastMoveAt ?? game.createdAt;
    return value === undefined ? [] : [value];
  });
  const done = rawGames.length < limit || playedTimes.length === 0;
  const oldest = playedTimes.length === 0 ? null : Math.min(...playedTimes);
  return Response.json({
    provider: "lichess",
    account,
    games,
    done,
    ...(!done && oldest !== null ? { cursor: encodeLichessCursor(oldest) } : {}),
  });
}
