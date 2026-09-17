import type {
  ExternalPlatform,
  PlatformAccount,
  PlayerColor,
  SyncedGame,
} from "@chess-review/shared";
import { allowedAvatarUrl } from "./player-avatar-url";

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
  avatars?: Partial<Record<PlayerColor, string>>,
  provider?: ExternalPlatform,
): Record<PlayerColor, ReviewPlayerIdentity> {
  const identities = {} as Record<PlayerColor, ReviewPlayerIdentity>;
  const platform = provider ?? syncedGame?.external.provider;

  for (const color of ["white", "black"] as const) {
    const username = syncedGame?.[color].username ?? usernameFor(headers, color);
    const matchesAccount = account?.username.toLocaleLowerCase() === username.toLocaleLowerCase();
    const rating = syncedGame?.[color].rating
      ?? headerRating(headers[color === "white" ? "WhiteElo" : "BlackElo"]);
    const playerProvider = platform ?? (matchesAccount ? account?.provider : undefined);
    const rawAvatar = avatars?.[color]
      ?? syncedGame?.[color].avatarUrl
      ?? (matchesAccount ? account?.avatarUrl : undefined);
    const avatarUrl = playerProvider && rawAvatar ? allowedAvatarUrl(playerProvider, rawAvatar) : undefined;
    identities[color] = {
      color,
      username,
      ...(rating === undefined ? {} : { rating }),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(playerProvider ? { provider: playerProvider } : {}),
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

/**
 * Who the review is helping, or null for an anonymous study of two other players.
 *
 * A connected game knows which account played it, so its color is a real learner
 * identity. `preferredOrientation` on a manually imported game is only the board
 * direction the file suggested — flipping the board must not change who the
 * summary attributes mistakes to, and a famous game imported from a PGN has no
 * learner at all. Until a first-class learner identity exists, that distinction is
 * the whole rule: account-backed records have a learner, manual ones do not, and
 * an anonymous review states the mover on every fact instead of guessing.
 */
export function learnerColorForRecord(record: { external?: { accountId?: string } | undefined; preferredOrientation?: PlayerColor }): PlayerColor | null {
  if (record.external === undefined) return null;
  return record.preferredOrientation ?? null;
}
