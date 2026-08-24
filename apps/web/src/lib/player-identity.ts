import type {
  ExternalPlatform,
  PlatformAccount,
  PlayerColor,
  SyncedGame,
} from "@chess-review/shared";

export interface ReviewPlayerIdentity {
  color: PlayerColor;
  username: string;
  rating?: number;
  avatarUrl?: string;
  provider?: ExternalPlatform;
  connected: boolean;
}

function headerRating(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const rating = Number.parseInt(value, 10);
  return Number.isFinite(rating) && rating > 0 ? rating : undefined;
}

function usernameFor(headers: Record<string, string>, color: PlayerColor): string {
  const raw = headers[color === "white" ? "White" : "Black"]?.trim();
  return raw && /[\p{L}\p{N}]/u.test(raw) ? raw : color === "white" ? "White" : "Black";
}

export function buildReviewPlayerIdentities(
  headers: Record<string, string>,
  account: PlatformAccount | null,
  syncedGame: SyncedGame | null,
): Record<PlayerColor, ReviewPlayerIdentity> {
  const identities = {} as Record<PlayerColor, ReviewPlayerIdentity>;

  for (const color of ["white", "black"] as const) {
    const username = syncedGame?.[color].username ?? usernameFor(headers, color);
    const matchesAccount = account?.username.toLocaleLowerCase() === username.toLocaleLowerCase();
    const rating = syncedGame?.[color].rating
      ?? headerRating(headers[color === "white" ? "WhiteElo" : "BlackElo"]);
    identities[color] = {
      color,
      username,
      ...(rating === undefined ? {} : { rating }),
      ...(matchesAccount && account?.avatarUrl ? { avatarUrl: account.avatarUrl } : {}),
      ...(matchesAccount && account ? { provider: account.provider } : {}),
      connected: matchesAccount,
    };
  }

  return identities;
}

export function orderPlayersForBoard(
  players: Record<PlayerColor, ReviewPlayerIdentity>,
  orientation: PlayerColor,
): { top: ReviewPlayerIdentity; bottom: ReviewPlayerIdentity } {
  return orientation === "white"
    ? { top: players.black, bottom: players.white }
    : { top: players.white, bottom: players.black };
}
