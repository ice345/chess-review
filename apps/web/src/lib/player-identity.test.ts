import { describe, expect, it } from "vitest";
import type { PlatformAccount, SyncedGame } from "@chess-review/shared";
import { buildReviewPlayerIdentities, orderPlayersForBoard } from "./player-identity";

const account: PlatformAccount = {
  id: "chesscom:ada",
  provider: "chesscom",
  username: "Ada",
  avatarUrl: "https://images.example/ada.png",
  authMode: "public-username",
  verified: false,
  linkedAt: "2026-08-23T00:00:00.000Z",
};

const game: SyncedGame = {
  id: "chesscom:game",
  external: {
    provider: "chesscom",
    externalGameId: "game",
    accountId: account.id,
    username: account.username,
    importedAt: account.linkedAt,
  },
  pgn: "1. e4 e5 *",
  playedAt: account.linkedAt,
  white: { username: "Ada", rating: 1824 },
  black: { username: "Mikhail", rating: 1761 },
  accountColor: "white",
  analyzed: false,
  syncedAt: account.linkedAt,
};

describe("review player identity", () => {
  it("enriches only the connected player and preserves both ratings", () => {
    const players = buildReviewPlayerIdentities({}, account, game);
    expect(players.white).toMatchObject({
      username: "Ada",
      rating: 1824,
      avatarUrl: account.avatarUrl,
      provider: "chesscom",
      connected: true,
    });
    expect(players.black).toMatchObject({ username: "Mikhail", rating: 1761, connected: false });
  });

  it("uses PGN headers and flips top/bottom presentation only", () => {
    const players = buildReviewPlayerIdentities({
      White: "Long White Player",
      Black: "Long Black Player",
      WhiteElo: "1702",
      BlackElo: "1688",
    }, null, null);
    expect(orderPlayersForBoard(players, "white").bottom.username).toBe("Long White Player");
    expect(orderPlayersForBoard(players, "black").bottom.username).toBe("Long Black Player");
    expect(players.white.rating).toBe(1702);
  });
});
