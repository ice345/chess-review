import { describe, expect, it } from "vitest";
import { BOARD_SIZE_MAX, BOARD_SIZE_MIN, normalizeBoardSizePreference } from "./board-geometry";

describe("board size preference", () => {
  it("keeps a requested size inside the control bounds", () => {
    expect(normalizeBoardSizePreference(480)).toBe(480);
    expect(normalizeBoardSizePreference(100)).toBe(BOARD_SIZE_MIN);
    expect(normalizeBoardSizePreference(4000)).toBe(BOARD_SIZE_MAX);
  });

  it("step-aligns a requested size so the slider cannot store an off-step value", () => {
    expect(normalizeBoardSizePreference(487)).toBe(480);
    expect(normalizeBoardSizePreference(491)).toBe(500);
  });

  it("treats a non-numeric stored value as automatic instead of guessing", () => {
    expect(normalizeBoardSizePreference(null)).toBeNull();
    expect(normalizeBoardSizePreference(undefined)).toBeNull();
    expect(normalizeBoardSizePreference("480")).toBeNull();
    expect(normalizeBoardSizePreference(Number.NaN)).toBeNull();
    expect(normalizeBoardSizePreference(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
