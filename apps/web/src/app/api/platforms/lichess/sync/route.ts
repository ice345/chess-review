import { cookies } from "next/headers";
import type { PlatformAccount, SyncedGame } from "@chess-review/shared";
import { LICHESS_SESSION_COOKIE, openLichessValue, type LichessSession } from "../../../../../lib/server/lichess-session";

interface LichessGame {
  id: string;
  rated?: boolean;
  speed?: string;
  createdAt?: number;
  lastMoveAt?: number;
  winner?: "white" | "black";
  pgn?: string;
  clock?: { initial?: number; increment?: number };
  players?: {
    white?: { user?: { id?: string; name?: string }; rating?: number };
    black?: { user?: { id?: string; name?: string }; rating?: number };
  };
}

function resultFor(color: "white" | "black", winner: LichessGame["winner"]): string {
  if (!winner) return "draw";
  return winner === color ? "win" : "loss";
}

export async function POST(request: Request) {
  let session: LichessSession;
  try {
    const sealed = (await cookies()).get(LICHESS_SESSION_COOKIE)?.value;
    if (!sealed) return Response.json({ error: "Connect Lichess before syncing." }, { status: 401 });
    session = openLichessValue<LichessSession>(sealed);
  } catch {
    return Response.json({ error: "The Lichess session is invalid. Connect again." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { since?: string; limit?: number } | null;
  const limit = Math.max(1, Math.min(100, body?.limit ?? 50));
  const url = new URL(`https://lichess.org/api/games/user/${encodeURIComponent(session.account.id)}`);
  url.searchParams.set("max", String(limit));
  url.searchParams.set("pgnInJson", "true");
  url.searchParams.set("opening", "true");
  url.searchParams.set("clocks", "false");
  url.searchParams.set("evals", "false");
  if (body?.since) url.searchParams.set("since", String(Date.parse(body.since)));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/x-ndjson" }, cache: "no-store" });
  if (response.status === 429) return Response.json({ error: "Lichess rate limit reached. Try again after one minute." }, { status: 429 });
  if (!response.ok) return Response.json({ error: `Lichess game export failed (${response.status}).` }, { status: response.status === 401 ? 401 : 502 });
  const raw = await response.text();
  const rawGames = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as LichessGame);
  const now = new Date().toISOString();
  const account: PlatformAccount = {
    id: `lichess:${session.account.id}`,
    provider: "lichess",
    username: session.account.username,
    ...(session.account.displayName ? { displayName: session.account.displayName } : {}),
    authMode: "oauth-pkce",
    verified: true,
    linkedAt: now,
    lastSyncAt: now,
  };
  const games: SyncedGame[] = rawGames.filter((game) => game.pgn).map((game) => {
    const white = game.players?.white;
    const black = game.players?.black;
    const whiteName = white?.user?.name ?? "White";
    const blackName = black?.user?.name ?? "Black";
    const accountColor = white?.user?.id?.toLowerCase() === session.account.id.toLowerCase() ? "white" : "black";
    const playedAt = new Date(game.lastMoveAt ?? game.createdAt ?? Date.now()).toISOString();
    return {
      id: `lichess:${game.id}`,
      external: { provider: "lichess", externalGameId: game.id, accountId: account.id, username: account.username, url: `https://lichess.org/${game.id}`, importedAt: now },
      pgn: game.pgn!,
      playedAt,
      ...(game.speed ? { timeClass: game.speed } : {}),
      ...(game.clock?.initial === undefined ? {} : { timeControl: `${game.clock.initial}+${game.clock.increment ?? 0}` }),
      ...(game.rated === undefined ? {} : { rated: game.rated }),
      white: { username: whiteName, ...(white?.rating === undefined ? {} : { rating: white.rating }), result: resultFor("white", game.winner) },
      black: { username: blackName, ...(black?.rating === undefined ? {} : { rating: black.rating }), result: resultFor("black", game.winner) },
      accountColor,
      analyzed: false,
      syncedAt: now,
    };
  });
  return Response.json({ provider: "lichess", account, games, ...(games[0] ? { cursor: games[0].playedAt } : {}) });
}
