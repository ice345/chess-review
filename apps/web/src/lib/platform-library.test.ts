import { describe, expect, it } from "vitest";
import type { SyncedGame } from "@chess-review/shared";
import { syncedGameHasAnalysis } from "./platform-library";

const BASE: SyncedGame = {
  id: "chesscom:fixture",
  external: {
    provider: "chesscom",
    externalGameId: "fixture",
    accountId: "chesscom:ice-345",
    username: "ice-345",
    importedAt: "2026-08-26T00:00:00.000Z",
  },
  pgn: "[Result \"*\"]\n\n1. e4 *",
  playedAt: "2026-08-26T00:00:00.000Z",
  white: { username: "ice-345" },
  black: { username: "opponent" },
  accountColor: "white",
  analyzed: false,
  syncedAt: "2026-08-26T00:00:00.000Z",
};

describe("synced game analysis readiness", () => {
  it("does not treat a pre-analysis review record as completed", () => {
    expect(syncedGameHasAnalysis({ ...BASE, analyzed: true, analysisId: "review-only" })).toBe(false);
  });

  it("requires the canonical algorithm and depth metadata", () => {
    expect(syncedGameHasAnalysis({
      ...BASE,
      analyzed: true,
      analysisId: "review",
      analysisAlgorithmVersion: "objective-v2.0",
      analysisDepth: 10,
    })).toBe(true);
  });
});
