import { describe, expect, it } from "vitest";
import { QUALITY_META } from "@chess-review/ui";

describe("Feather Annotation Move Quality metadata", () => {
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
});
