import { describe, expect, it } from "vitest";
import { displayedMoveQualityLabel } from "./move-quality-label";

describe("displayed move quality label", () => {
  it("uses the classification projection so Brilliant matches the icon", () => {
    expect(displayedMoveQualityLabel({ classification: "brilliant" })).toBe("Brilliant");
    expect(displayedMoveQualityLabel({ classification: "great" })).toBe("Critical");
    expect(displayedMoveQualityLabel({ classification: "best" })).toBe("Best");
    expect(displayedMoveQualityLabel({ classification: "missed_mate" })).toBe("Missed mate");
  });
});
