import { describe, expect, it } from "vitest";
import {
  assertChessComArchiveUrl,
  chessComArchiveListTick,
  chessComCursor,
  encodeChessComCursor,
  encodeLichessCursor,
  locateChessComArchive,
  lichessUntil,
  retryAt,
} from "./platform-sync";

describe("platform sync checkpoints", () => {
  it("round-trips Chess.com archive year-month keys", () => {
    const cursor = encodeChessComCursor({ archiveKey: "2024-03", offset: 200 });
    expect(cursor).toBe("cc2:2024-03:200");
    expect(chessComCursor(cursor)).toEqual({ archiveKey: "2024-03", offset: 200 });
    expect(chessComCursor("invalid")).toEqual({ archiveKey: "", offset: 0 });
  });

  it("does not shift a paused month when a newer archive appears", () => {
    const paused = chessComCursor("cc2:2024-02:40");
    const before = ["https://api.chess.com/pub/player/ada/games/2024/02", "https://api.chess.com/pub/player/ada/games/2024/01"];
    const after = ["https://api.chess.com/pub/player/ada/games/2024/03", ...before];
    expect(locateChessComArchive(before, paused)).toEqual({ index: 0, offset: 40 });
    expect(locateChessComArchive(after, paused)).toEqual({ index: 1, offset: 40 });
  });

  it("exposes archive totals before the first monthly archive is fetched", () => {
    expect(chessComArchiveListTick(84, "2024-03")).toEqual({
      games: [],
      done: false,
      cursor: "cc2:2024-03:0",
      progress: { completed: 0, total: 84 },
    });
    expect(chessComArchiveListTick(0)).toMatchObject({ done: true, progress: { completed: 0, total: 0 } });
  });

  it("allowlists Chess.com monthly archive URLs", () => {
    expect(assertChessComArchiveUrl("https://api.chess.com/pub/player/ada/games/2024/03", "Ada"))
      .toBe("https://api.chess.com/pub/player/ada/games/2024/03");
    expect(() => assertChessComArchiveUrl("http://127.0.0.1/secret", "Ada")).toThrow(/invalid/);
    expect(() => assertChessComArchiveUrl("https://evil.test/pub/player/ada/games/2024/03", "Ada")).toThrow(/invalid/);
    expect(() => assertChessComArchiveUrl("https://api.chess.com/pub/player/other/games/2024/03", "Ada")).toThrow(/invalid/);
  });

  it("uses an exclusive Lichess until checkpoint", () => {
    expect(encodeLichessCursor(1_700_000_000_000)).toBe("li:1699999999999");
    expect(lichessUntil("li:1699999999999")).toBe(1_699_999_999_999);
  });

  it("turns rate-limit guidance into a persistent retry time", () => {
    expect(retryAt("60", 1_000)).toBe(new Date(61_000).toISOString());
    expect(Date.parse(retryAt(null, 1_000))).toBe(61_000);
  });
});
