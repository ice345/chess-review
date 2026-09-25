import { describe, expect, it } from "vitest";
import type { CriticalMoment } from "@chess-review/shared";
import {
  deserializeReviewSession,
  emptyReviewSessionProgress,
  markMomentSeen,
  reviewCompletionDetail,
  reviewCompletionHeadline,
  reviewSessionCounts,
  reviewSessionKey,
  serializeReviewSession,
  type ReviewSessionProgress,
} from "./review-session";

const moments: CriticalMoment[] = [
  { ply: 3, classification: "mistake", winPercentSwing: 12 },
  { ply: 7, classification: "blunder", winPercentSwing: 24 },
  { ply: 11, classification: "inaccuracy", winPercentSwing: 9 },
];

function session(overrides: Partial<ReviewSessionProgress> = {}): ReviewSessionProgress {
  return { ...emptyReviewSessionProgress(), ...overrides };
}

describe("review session progress", () => {
  it("reports an early finish as zero moments viewed, never as a finished review", () => {
    const counts = reviewSessionCounts(session(), moments);

    expect(counts).toMatchObject({ total: 3, seen: 0, remaining: 3, browsedEverything: false });
    expect(reviewCompletionHeadline(counts, "en")).toBe("0 of 3 key moments viewed");
    expect(reviewCompletionDetail(counts, "en")).toBe("3 moments are still unseen; they stay available in Moves and Study.");
  });

  it("counts repeated visits once", () => {
    const visited = markMomentSeen(markMomentSeen(markMomentSeen(session(), 3), 3), 7);
    const counts = reviewSessionCounts(visited, moments);

    expect(counts.seen).toBe(2);
    expect(counts.remaining).toBe(1);
    expect(reviewCompletionHeadline(counts, "en")).toBe("2 of 3 key moments viewed");
  });

  it("reports full browsing as browsing, not as learning", () => {
    const visited = moments.reduce((progress, moment) => markMomentSeen(progress, moment.ply), session());
    const counts = reviewSessionCounts(visited, moments);

    expect(counts.browsedEverything).toBe(true);
    expect(reviewCompletionHeadline(counts, "en")).toBe("All 3 key moments viewed");
    expect(reviewCompletionDetail(counts, "en")).toBe("Viewing a position is not the same as solving it; practice results are counted separately.");
  });

  it("does not credit progress to a moment the new analysis no longer places there", () => {
    // Re-analysis dropped the ply-11 moment and added one at ply 15.
    const visited = session({ seen: [3, 7, 11] });
    const counts = reviewSessionCounts(visited, [
      ...moments.slice(0, 2),
      { ply: 15, classification: "mistake", winPercentSwing: 11 },
    ]);

    expect(counts).toMatchObject({ total: 3, seen: 2, remaining: 1, browsedEverything: false });
  });

  it("carries the practice outcomes separately from browsing", () => {
    const counts = reviewSessionCounts(session({ seen: [3], attempted: 3, solvedUnassisted: 1, hinted: 1, skipped: 1 }), moments);

    expect(counts).toMatchObject({ solvedUnassisted: 1, hinted: 1, revealed: 0, skipped: 1 });
  });

  it("allows finishing a game with no key moments without inventing a count", () => {
    const counts = reviewSessionCounts(session({ seen: [3] }), []);

    expect(counts).toMatchObject({ total: 0, seen: 0, remaining: 0, browsedEverything: false });
    expect(reviewCompletionHeadline(counts, "en")).toBe("No key moment crossed the thresholds");
    expect(reviewCompletionDetail(counts, "en")).toBe("This game had no swing large enough for a guided moment.");
  });

  it("describes a single moment in the singular", () => {
    const counts = reviewSessionCounts(session({ seen: [3] }), moments.slice(0, 1));

    expect(reviewCompletionHeadline(counts, "en")).toBe("The only key moment was viewed");
    expect(reviewCompletionDetail(counts, "en")).toBe("Viewing a position is not the same as solving it; practice results are counted separately.");
  });

  it("keeps the same object when a ply was already seen", () => {
    const progress = markMomentSeen(session(), 3);

    expect(markMomentSeen(progress, 3)).toBe(progress);
    expect(markMomentSeen(progress, 7)).not.toBe(progress);
  });
});

describe("review session persistence", () => {
  const stored = session({ seen: [3, 7], attempted: 4, solvedUnassisted: 1, hinted: 2, revealed: 1, skipped: 0 });

  it("round-trips a session", () => {
    expect(deserializeReviewSession(serializeReviewSession(stored))).toEqual(stored);
  });

  it("treats anything it cannot trust as no session", () => {
    expect(deserializeReviewSession(null)).toBeNull();
    expect(deserializeReviewSession("not json")).toBeNull();
    expect(deserializeReviewSession("\"seen\"")).toBeNull();
    expect(deserializeReviewSession("{\"seen\":\"3\"}")).toBeNull();
    expect(deserializeReviewSession("{\"seen\":[0,-2,2.5,4,\"x\"]}")).toEqual(session({ seen: [4] }));
    expect(deserializeReviewSession("{\"seen\":[3],\"attempted\":-1}")).toMatchObject({ attempted: 0 });
  });

  it("keys progress to the objective record it was made against", () => {
    const analysis = { algorithmVersion: "objective-v2.0", engine: { stockfishVersion: "18", depth: 10, classificationMultiPv: 3 }, moves: [1, 2, 3], createdAt: "2026-08-01T00:00:00.000Z" };
    const key = reviewSessionKey("g1", analysis as never);

    expect(key).toBe(reviewSessionKey("g1", analysis as never));
    expect(key).not.toBe(reviewSessionKey("g2", analysis as never));
    expect(key).not.toBe(reviewSessionKey("g1", { ...analysis, engine: { ...analysis.engine, depth: 15 } } as never));
    expect(key).not.toBe(reviewSessionKey("g1", { ...analysis, createdAt: "2026-08-02T00:00:00.000Z" } as never));
  });
});
