import { describe, expect, it } from "vitest";
import { chessComCursor, encodeChessComCursor, encodeLichessCursor, lichessUntil, retryAt } from "./platform-sync";

describe("platform sync checkpoints", () => {
  it("round-trips Chess.com archive and in-archive offsets", () => {
    const cursor = encodeChessComCursor({ archiveIndex: 17, offset: 200 });
    expect(cursor).toBe("cc:17:200");
    expect(chessComCursor(cursor)).toEqual({ archiveIndex: 17, offset: 200 });
    expect(chessComCursor("invalid")).toEqual({ archiveIndex: 0, offset: 0 });
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
