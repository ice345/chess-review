import { describe, expect, it } from "vitest";
import { QUALITY_META } from "@chess-review/ui";

describe("Move Quality Annotation System V3 metadata", () => {
  it("uses a distinct silhouette motif for every objective classification", () => {
    const metadata = Object.values(QUALITY_META);
    expect(new Set(metadata.map((entry) => entry.motif)).size).toBe(metadata.length);
  });

  it("defines independent ink and wash colors instead of color-only badges", () => {
    for (const entry of Object.values(QUALITY_META)) {
      expect(entry.ink).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.wash).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.ink).not.toBe(entry.wash);
    }
  });

  it("keeps the specified elite, positive, informational, warning and severe palettes", () => {
    expect(QUALITY_META).toMatchObject({
      brilliant: { ink: "#2f7f93", wash: "#d9eef2", motif: "diamond-double" },
      great: { ink: "#647ba9", wash: "#e2e7f2", motif: "diamond-single", label: "Critical" },
      best: { ink: "#3f7f73", wash: "#dceae5", motif: "circle-solid-check" },
      excellent: { ink: "#668c75", wash: "#e4ece3", motif: "circle-double-check" },
      good: { ink: "#788c72", wash: "#ebefe5", motif: "circle-check" },
      book: { ink: "#786c92", wash: "#eae5ef", motif: "square-book" },
      interesting: { ink: "#9c7a42", wash: "#f2e6cb", motif: "square-interesting" },
      forced: { ink: "#647985", wash: "#e5ebec", motif: "square-forced" },
      inaccuracy: { ink: "#a18739", wash: "#f4e8be", motif: "ring-inaccuracy" },
      mistake: { ink: "#b26e4d", wash: "#f2ddd2", motif: "square-mistake" },
      blunder: { ink: "#a34e5b", wash: "#f0d9de", motif: "octagon-blunder" },
      miss: { ink: "#985263", wash: "#eedce1", motif: "circle-miss" },
      missed_win: { ink: "#95566a", wash: "#eddfe5", motif: "diamond-missed-win" },
      missed_mate: { ink: "#7f4459", wash: "#e8d6de", motif: "octagon-missed-mate" },
    });
  });
});
