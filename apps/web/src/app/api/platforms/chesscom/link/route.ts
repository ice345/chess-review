import { fetchProvider, readProviderJson } from "../../../../../lib/server/platform-response";
import { platformRequest, readLinkInput } from "../../../../../lib/server/platform-request";
import type { PlatformAccount } from "@chess-review/shared";

const CHESSCOM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "OpenChessReview/0.1 https://github.com/ice345/chess-review",
};

function ratings(stats: Record<string, unknown>): Partial<Record<string, number>> {
  const result: Partial<Record<string, number>> = {};
  for (const key of ["chess_bullet", "chess_blitz", "chess_rapid", "chess_daily"] as const) {
    const value = stats[key] as { last?: { rating?: unknown } } | undefined;
    if (typeof value?.last?.rating === "number") result[key.replace("chess_", "")] = value.last.rating;
  }
  return result;
}

export async function POST(request: Request) {
  return platformRequest(request, handleRequest, "chesscom");
}

async function handleRequest(request: Request, signal: AbortSignal) {
  const username = await readLinkInput(request, signal);
  const encoded = encodeURIComponent(username.toLowerCase());
  const profileResponse = await fetchProvider(`https://api.chess.com/pub/player/${encoded}`, { headers: CHESSCOM_HEADERS, cache: "no-store", signal, redirect: "error" });
  if (profileResponse.status === 429) return Response.json({ error: "Chess.com rate limit reached. Try again later." }, { status: 429, headers: { "Retry-After": profileResponse.headers.get("Retry-After") ?? "60" } });
  if (profileResponse.status === 404) return Response.json({ error: "Chess.com player not found." }, { status: 404 });
  if (!profileResponse.ok) return Response.json({ error: `Chess.com profile request failed (${profileResponse.status}).` }, { status: 502 });
  const profile = await readProviderJson(profileResponse, signal, 1_048_576) as { player_id?: number; username?: string; name?: string; avatar?: string };
  const statsResponse = await fetchProvider(`https://api.chess.com/pub/player/${encoded}/stats`, { headers: CHESSCOM_HEADERS, cache: "no-store", signal, redirect: "error" });
  if (statsResponse.status === 429) return Response.json({ error: "Chess.com rate limit reached. Try linking again shortly." }, { status: 429, headers: { "Retry-After": statsResponse.headers.get("Retry-After") ?? "60" } });
  const stats = statsResponse.ok ? await readProviderJson(statsResponse, signal, 1_048_576) as Record<string, unknown> : {};
  const linkedAt = new Date().toISOString();
  const account: PlatformAccount = {
    id: `chesscom:${profile.player_id ?? profile.username?.toLowerCase() ?? encoded}`,
    provider: "chesscom",
    username: profile.username ?? username,
    ...(profile.name ? { displayName: profile.name } : {}),
    ...(profile.avatar ? { avatarUrl: profile.avatar } : {}),
    authMode: "public-username",
    verified: false,
    linkedAt,
    ratings: ratings(stats),
  };
  return Response.json({ account, notice: "Public username link; account ownership is not verified." });
}
