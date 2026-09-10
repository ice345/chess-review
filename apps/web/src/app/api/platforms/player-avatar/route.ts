import { PlatformLimitError, providerCooldown } from "../../../../lib/server/platform-guard";
import { platformRequest } from "../../../../lib/server/platform-request";
import { fetchProvider, readProviderJson } from "../../../../lib/server/platform-response";
import { allowedAvatarUrl } from "../../../../lib/player-avatar-url";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "OpenChessReview/0.1 https://github.com/ice345/chess-review",
};

const USERNAME_PATTERN = /^[\w-]{2,32}$/i;

async function chessComAvatar(username: string, signal: AbortSignal): Promise<string | undefined> {
  const response = await fetchProvider(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`, {
    headers: HEADERS,
    cache: "force-cache", signal, redirect: "error",
  });
  if (response.status === 429) { providerCooldown("chesscom", response.headers.get("Retry-After")); throw new PlatformLimitError("Chess.com asked us to pause profile requests."); }
  if (!response.ok) return undefined;
  const profile = await readProviderJson(response, signal, 1_048_576) as { avatar?: unknown };
  return typeof profile.avatar === "string" ? allowedAvatarUrl("chesscom", profile.avatar) : undefined;
}

async function lichessAvatar(username: string, signal: AbortSignal): Promise<string | undefined> {
  const response = await fetchProvider(`https://lichess.org/api/user/${encodeURIComponent(username)}`, {
    headers: { ...HEADERS, Accept: "application/json" },
    cache: "force-cache", signal, redirect: "error",
  });
  if (response.status === 429) { providerCooldown("lichess", response.headers.get("Retry-After")); throw new PlatformLimitError("Lichess asked us to pause profile requests."); }
  if (!response.ok) return undefined;
  const profile = await readProviderJson(response, signal, 1_048_576) as { profile?: { image?: unknown; picture?: unknown }; patronColor?: unknown };
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
    return platformRequest(request, async () => Response.json({ error: "A valid platform username is required." }, { status: 400 }));
  }
  return platformRequest(request, async (_request, signal) => {
    const avatarUrl = provider === "chesscom" ? await chessComAvatar(username, signal) : await lichessAvatar(username, signal);
    return Response.json({ provider, username, ...(avatarUrl ? { avatarUrl } : {}) });
  }, provider);
}
