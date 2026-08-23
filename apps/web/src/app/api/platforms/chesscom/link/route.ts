import type { PlatformAccount } from "@chess-review/shared";

const CHESSCOM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "OpenChessReview/0.1 contact: local-user",
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
  const body = await request.json().catch(() => null) as { username?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!/^[\w-]{2,32}$/i.test(username)) return Response.json({ error: "Enter a valid Chess.com username." }, { status: 400 });
  const encoded = encodeURIComponent(username.toLowerCase());
  const [profileResponse, statsResponse] = await Promise.all([
    fetch(`https://api.chess.com/pub/player/${encoded}`, { headers: CHESSCOM_HEADERS, cache: "no-store" }),
    fetch(`https://api.chess.com/pub/player/${encoded}/stats`, { headers: CHESSCOM_HEADERS, cache: "no-store" }),
  ]);
  if (profileResponse.status === 404) return Response.json({ error: "Chess.com player not found." }, { status: 404 });
  if (!profileResponse.ok) return Response.json({ error: `Chess.com profile request failed (${profileResponse.status}).` }, { status: 502 });
  const profile = await profileResponse.json() as { player_id?: number; username?: string; name?: string; avatar?: string };
  const stats = statsResponse.ok ? await statsResponse.json() as Record<string, unknown> : {};
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
