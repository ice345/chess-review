import { describe, expect, it } from "vitest";
import { humanLensServiceCopy } from "./human-lens-state";

describe("Human Lens service boundary", () => {
  it("keeps objective browser review explicit in every unavailable state", () => {
    for (const state of ["offline", "not-installed", "error"] as const) {
      expect(humanLensServiceCopy(state)).toContain("Browser Stockfish remains fully available");
    }
  });

  it("describes Maia as a position capability when available", () => {
    expect(humanLensServiceCopy("available")).toBe("Maia-3 is ready for this position.");
  });
});
