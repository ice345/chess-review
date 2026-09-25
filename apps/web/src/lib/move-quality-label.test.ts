import { describe, expect, it } from "vitest";
import { displayedMoveQualityLabel } from "./move-quality-label";

describe("displayed move quality label", () => {
  it("uses the classification projection so Brilliant matches the icon", () => {
    expect(displayedMoveQualityLabel({ classification: "brilliant" }, "en")).toBe("Brilliant");
    expect(displayedMoveQualityLabel({ classification: "great" }, "en")).toBe("Critical");
    expect(displayedMoveQualityLabel({ classification: "best" }, "en")).toBe("Best");
    expect(displayedMoveQualityLabel({ classification: "missed_mate" }, "en")).toBe("Missed mate");
  });

  it("names the same classification in Chinese", () => {
    expect(displayedMoveQualityLabel({ classification: "great" }, "zh-CN")).toBe("关键");
    expect(displayedMoveQualityLabel({ classification: "blunder" }, "zh-CN")).toBe("漏着");
  });
});
