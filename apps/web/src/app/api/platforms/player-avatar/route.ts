import { allowedAvatarUrl } from "../../../../lib/player-avatar-url";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "OpenChessReview/0.1 contact: local-user",
};

const USERNAME_PATTERN = /^[\w-]{2,32}$/i;

async function chessComAvatar(username: string): Promise<string | undefined> {
  const response = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`, {
    headers: HEADERS,
    cache: "force-cache",
  });
  if (!response.ok) return undefined;
  const profile = await response.json() as { avatar?: unknown };
  return typeof profile.avatar === "string" ? allowedAvatarUrl("chesscom", profile.avatar) : undefined;
}

async function lichessAvatar(username: string): Promise<string | undefined> {
  const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`, {
    headers: { ...HEADERS, Accept: "application/json" },
    cache: "force-cache",
  });
  if (!response.ok) return undefined;
  const profile = await response.json() as { profile?: { image?: unknown; picture?: unknown }; patronColor?: unknown };
  const candidates = [profile.profile?.image, profile.profile?.picture];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const allowed = allowedAvatarUrl("lichess", candidate);
      if (allowed) return allowed;
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const username = url.searchParams.get("username")?.trim() ?? "";
  if ((provider !== "chesscom" && provider !== "lichess") || !USERNAME_PATTERN.test(username)) {
    return Response.json({ error: "A valid platform username is required." }, { status: 400 });
  }
  try {
    const avatarUrl = provider === "chesscom" ? await chessComAvatar(username) : await lichessAvatar(username);
    return Response.json({ provider, username, ...(avatarUrl ? { avatarUrl } : {}) });
  } catch {
    return Response.json({ provider, username });
  }
}
