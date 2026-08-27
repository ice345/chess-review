import { describe, expect, it } from "vitest";
import { classifyMove } from "./classification";
import { CLASSIFICATION_V2_GOLDEN } from "./fixtures/classification-v2-golden";

describe("Objective V2 golden classification corpus", () => {
  for (const fixture of CLASSIFICATION_V2_GOLDEN) {
    it(fixture.name, () => {
      const result = classifyMove(fixture.input);
      expect({
        quality: result.quality,
        annotations: result.annotations,
        classification: result.classification,
        ...(result.reason.engineRank === undefined ? {} : { engineRank: result.reason.engineRank }),
      }).toEqual(fixture.expected);
    });
  }
});
