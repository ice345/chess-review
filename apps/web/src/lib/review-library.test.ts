import { describe, expect, it } from "vitest";
import { buildReviewRecord, buildReviewRecordFromSyncedGame } from "./review-library";

describe("review library records", () => {
  it("normalizes a FEN and produces a stable position ID", async () => {
    const left = await buildReviewRecord("fen", " 8/8/8/8/8/8/4K3/7k w - - 0 1 ");
    const right = await buildReviewRecord("fen", "8/8/8/8/8/8/4K3/7k w - - 0 1");

    expect(left.id).toBe(right.id);
    expect(left.input).toBe("8/8/8/8/8/8/4K3/7k w - - 0 1");
    expect(left.subtitle).toBe("White to move");
    expect(left.totalPlies).toBe(0);
  });

  it("derives a stable game ID and useful library metadata from normalized PGN", async () => {
    const pgn = `[Event "Casual game"]
[Date "2026.08.23"]
[White "Ada"]
[Black "Mikhail"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *`;
    const left = await buildReviewRecord("pgn", pgn);
    const right = await buildReviewRecord("pgn", pgn);

    expect(left.id).toBe(right.id);
    expect(left.title).toBe("Ada vs Mikhail");
    expect(left.subtitle).toContain("Casual game");
    expect(left.totalPlies).toBe(4);
  });

  it("rejects a header-only PGN", async () => {
    await expect(buildReviewRecord("pgn", `[Event "Empty"]\n\n*`)).rejects.toThrow("at least one move");
  });

  it("does not leak chess.js parser internals for illegal PGN", async () => {
    await expect(buildReviewRecord("pgn", "this is not a chess game 1. e4 e5 2. Ke2 illegal"))
      .rejects.toThrow("This PGN could not be parsed.");
    await expect(buildReviewRecord("pgn", `[Variant "Chess960"]\n\n1. e4 *`))
      .rejects.toThrow("This product only supports standard chess.");
  });

  it("does not expose an unknown PGN date placeholder", async () => {
    const record = await buildReviewRecord("pgn", `[White "A"]\n[Black "B"]\n\n1. e4 *`);
    expect(record.subtitle).toBe("1 ply");
  });

  it("keeps platform metadata and account-aware orientation outside canonical analysis", async () => {
    const first = await buildReviewRecordFromSyncedGame({
      id: "lichess:abc123",
      external: { provider: "lichess", externalGameId: "abc123", accountId: "lichess:ada", username: "Ada", importedAt: "2026-08-23T00:00:00.000Z" },
      pgn: `[White "Mikhail"]\n[Black "Ada"]\n\n1. e4 e5 *`,
      playedAt: "2026-08-23T00:00:00.000Z",
      timeClass: "rapid",
      white: { username: "Mikhail", result: "win" },
      black: { username: "Ada", result: "loss" },
      accountColor: "black",
      analyzed: false,
      syncedAt: "2026-08-23T00:00:00.000Z",
    });

    const second = await buildReviewRecordFromSyncedGame({
      id: "lichess:def456",
      external: { provider: "lichess", externalGameId: "def456", accountId: "lichess:ada", username: "Ada", importedAt: "2026-08-23T00:00:00.000Z" },
      pgn: `[White "Mikhail"]\n[Black "Ada"]\n\n1. e4 e5 *`,
      playedAt: "2026-08-23T00:00:00.000Z",
      timeClass: "rapid",
      white: { username: "Mikhail", result: "win" },
      black: { username: "Ada", result: "loss" },
      accountColor: "black",
      analyzed: false,
      syncedAt: "2026-08-23T00:00:00.000Z",
    });

    expect(first.preferredOrientation).toBe("black");
    expect(first.playedAt).toBe("2026-08-23T00:00:00.000Z");
    expect(first.sourceTimeClass).toBe("rapid");
    expect(first.sourceResult).toBe("loss");
    expect(first.external?.externalGameId).toBe("abc123");
    expect(first.id).not.toBe(second.id);
  });
});
