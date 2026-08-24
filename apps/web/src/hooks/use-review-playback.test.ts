import { describe, expect, it } from "vitest";
import { nextPlaybackPly } from "./use-review-playback";

describe("review playback", () => {
  it("advances exactly one canonical ply", () => {
    expect(nextPlaybackPly(4, 10, false)).toBe(5);
  });

  it("stops at game end", () => {
    expect(nextPlaybackPly(10, 10, false)).toBeNull();
  });

  it("never advances a variation as canonical autoplay", () => {
    expect(nextPlaybackPly(4, 10, true)).toBeNull();
  });
});
