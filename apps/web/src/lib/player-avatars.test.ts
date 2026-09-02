import { describe, expect, it } from "vitest";
import { allowedAvatarUrl } from "./player-avatar-url";
import { platformFromGameHeaders, playerAvatarKey } from "./player-avatars";

describe("player avatars", () => {
  it("reads Chess.com and Lichess from ordinary PGN headers", () => {
    expect(platformFromGameHeaders({ Site: "Chess.com" })).toBe("chesscom");
    expect(platformFromGameHeaders({ Link: "https://www.chess.com/game/live/123" })).toBe("chesscom");
    expect(platformFromGameHeaders({ Site: "https://lichess.org/abcdef" })).toBe("lichess");
    expect(platformFromGameHeaders({ Event: "Casual Rapid game", Site: "https://lichess.org/" })).toBe("lichess");
    expect(platformFromGameHeaders({ Event: "Casual game" })).toBeUndefined();
  });

  it("keys cache entries by provider and lowercase username", () => {
    expect(playerAvatarKey("chesscom", "Hikaru")).toBe("chesscom:hikaru");
    expect(playerAvatarKey("lichess", "DrNykterstein")).toBe("lichess:drnykterstein");
  });

  it("accepts only HTTPS CDN hosts without credentials or custom ports", () => {
    expect(allowedAvatarUrl("chesscom", "https://images.chesscomfiles.com/uploads/v1/user/a.png")).toBeDefined();
    expect(allowedAvatarUrl("chesscom", "https://www.chess.com/uploads/a.png")).toBeUndefined();
    expect(allowedAvatarUrl("chesscom", "https://user@images.chesscomfiles.com/a.png")).toBeUndefined();
    expect(allowedAvatarUrl("lichess", "https://images.lichess1.org/photo.png")).toBeDefined();
    expect(allowedAvatarUrl("lichess", "http://images.lichess1.org/photo.png")).toBeUndefined();
  });
});
