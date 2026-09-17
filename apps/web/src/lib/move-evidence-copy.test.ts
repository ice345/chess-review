import { describe, expect, it } from "vitest";
import type { MoveAnnotation } from "@chess-review/shared";
import { baselineOnlyCaveat, moveEvidenceSentence, engineChoiceLabel, sacrificeLabel, verificationLabel, winningChancesLabel } from "./move-evidence-copy";

function evidence(overrides: {
  quality?: "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  annotations?: MoveAnnotation[];
  loss?: number;
  engineRank?: number | undefined;
  isForced?: boolean;
  gap?: number;
} = {}) {
  return {
    classification: "good" as const,
    quality: overrides.quality ?? "good",
    annotations: overrides.annotations ?? [],
    classificationReason: {
      winPercentLoss: overrides.loss ?? 0,
      winPercentBefore: 60,
      winPercentAfter: 55,
      isForced: overrides.isForced ?? false,
      exclusions: [] as string[],
      ...(overrides.engineRank === undefined ? {} : { engineRank: overrides.engineRank }),
      ...(overrides.gap === undefined ? {} : { secondBestGapWinPercent: overrides.gap }),
    },
  };
}

describe("move evidence copy", () => {
  it("names the recorded annotation instead of the score", () => {
    expect(moveEvidenceSentence(evidence({ annotations: ["missed_mate"] }))).toContain("forced mate");
    expect(moveEvidenceSentence(evidence({ annotations: ["missed_win"] }))).toContain("winning continuation");
    expect(moveEvidenceSentence(evidence({ annotations: ["brilliant"], quality: "best" }))).toContain("survives the opponent's best answer");
    expect(moveEvidenceSentence(evidence({ annotations: ["book"] }))).toContain("opening theory");
    expect(moveEvidenceSentence(evidence({ annotations: ["forced"] }))).toContain("forced");
    expect(moveEvidenceSentence(evidence({ isForced: true }))).toContain("forced");
  });

  it("states the recorded gap for a critical choice", () => {
    expect(moveEvidenceSentence(evidence({ annotations: ["critical"], quality: "best", gap: 14.5 })))
      .toContain("14.5 win-percentage points worse");
    expect(moveEvidenceSentence(evidence({ annotations: ["critical"], quality: "best" })))
      .toContain("substantially worse");
  });

  it("separates what was measured from what was not", () => {
    const blunder = moveEvidenceSentence(evidence({ quality: "blunder", loss: 22.4 }));
    expect(blunder).toContain("22.4 win-percentage points");
    expect(blunder).toContain("not which idea was missed");

    const quiet = moveEvidenceSentence(evidence({ quality: "best", loss: 0 }));
    expect(quiet).toBe("It holds the engine's evaluation: the winning chances do not move.");
    expect(quiet).not.toContain("0.0");
  });

  it("keeps a small loss out of the costly wording", () => {
    expect(moveEvidenceSentence(evidence({ quality: "mistake", loss: 0.4 }))).not.toContain("not which idea was missed");
    expect(moveEvidenceSentence(evidence({ quality: "mistake", loss: 12 }))).toContain("not which idea was missed");
  });

  it("describes the engine comparison and the search that produced it", () => {
    expect(engineChoiceLabel({ engineRank: 1 })).toBe("The engine's first choice");
    expect(engineChoiceLabel({ engineRank: 3 })).toBe("Engine candidate #3");
    expect(engineChoiceLabel({})).toContain("restricted search");

    const move = { stockfish: { depth: 10 }, classificationReason: {} };
    expect(verificationLabel(move)).toBe("Baseline search at depth 10");
    expect(verificationLabel({ stockfish: { depth: 15 }, classificationReason: { verification: { status: "verified", depth: 15, multiPv: 5, reasons: [] } } }))
      .toBe("Re-searched at depth 15 with MultiPV 5");
    expect(verificationLabel({ stockfish: { depth: 12 }, classificationReason: { verification: { status: "baseline", depth: 12, multiPv: 3, reasons: [] } } }))
      .toContain("was not re-searched");
  });

  it("reports the mover's own winning chances", () => {
    expect(winningChancesLabel({ winPercentBefore: 71.4, winPercentAfter: 48.2, winPercentLoss: 23.2 }))
      .toBe("71.4% → 48.2% for the mover (23.2 lost)");
  });

  it("only claims a sacrifice when the detector recorded one", () => {
    expect(sacrificeLabel({})).toBeNull();
    expect(sacrificeLabel({ sacrifice: { sacrificedMaterial: 300, see: 120, compensationCp: 80, survivesBestResponse: true, recoveredWithinPv: 0, genuine: true } }))
      .toContain("Genuine investment of 300");
    expect(sacrificeLabel({ sacrifice: { sacrificedMaterial: 300, see: 350, compensationCp: 0, survivesBestResponse: false, recoveredWithinPv: 2, genuine: false } }))
      .toContain("comes straight back");
  });
});

describe("baseline-only caveat", () => {
  it("marks a consequential label that the verification pass never re-searched", () => {
    const blunder = baselineOnlyCaveat(evidence({ quality: "blunder", loss: 21 }));
    expect(blunder).toContain("not re-searched");
    expect(blunder).toContain("depth-sensitive");

    const brilliant = baselineOnlyCaveat(evidence({ quality: "best", annotations: ["brilliant"] }));
    expect(brilliant).toContain("not re-searched");
  });

  it("stays quiet for ordinary labels and for re-searched evidence", () => {
    expect(baselineOnlyCaveat(evidence({ quality: "good", loss: 1 }))).toBeNull();
    expect(baselineOnlyCaveat({
      ...evidence({ quality: "blunder", loss: 21 }),
      classificationReason: {
        ...evidence({ quality: "blunder", loss: 21 }).classificationReason,
        verification: { status: "verified", depth: 15, multiPv: 5, reasons: [] },
      },
    })).toBeNull();
  });

  it("names the depth the baseline label actually rests on", () => {
    expect(baselineOnlyCaveat({
      ...evidence({ quality: "mistake", loss: 12 }),
      classificationReason: {
        ...evidence({ quality: "mistake", loss: 12 }).classificationReason,
        verification: { status: "baseline", depth: 10, multiPv: 3, reasons: [] },
      },
    })).toContain("depth-10");
  });

  // A move with no recorded verification has no depth to name. The sentence must
  // still read as one sentence: the previous template left the placeholder in
  // place and rendered "the baseline baseline searchsearch" in the review panel.
  it("reads as a sentence when no verification depth was recorded", () => {
    const caveat = baselineOnlyCaveat(evidence({ quality: "blunder", loss: 21 }));
    expect(caveat).toContain("comes from the baseline search and this move was not re-searched");
    expect(caveat).not.toContain("depth- ");
    expect(caveat).not.toContain("baseline baseline");
    expect(caveat).not.toContain("searchsearch");
  });
});
