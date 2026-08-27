import type { MoveAnnotation, MoveClassification, MoveQuality } from "@chess-review/shared";
import type { ClassificationInput } from "../classification";

export interface ClassificationGoldenCase {
  name: string;
  input: ClassificationInput;
  expected: {
    quality: MoveQuality;
    annotations: MoveAnnotation[];
    classification: MoveClassification;
    engineRank?: number;
  };
}

const BASE: ClassificationInput = {
  color: "white",
  scoreBefore: { kind: "cp", cp: 0 },
  scoreAfter: { kind: "cp", cp: 0 },
  playedMoveRank: 1,
  secondBestScore: { kind: "cp", cp: -20 },
  legalMoveCount: 24,
  isBook: false,
  isCheckmate: false,
};
const BASE_WITHOUT_RANK: ClassificationInput = {
  color: BASE.color,
  scoreBefore: BASE.scoreBefore,
  scoreAfter: BASE.scoreAfter,
  secondBestScore: { kind: "cp", cp: -20 },
  legalMoveCount: BASE.legalMoveCount,
  isBook: BASE.isBook,
  isCheckmate: BASE.isCheckmate,
};

/** Locked Phase 9 semantics for boundary and regression review. */
export const CLASSIFICATION_V2_GOLDEN: ClassificationGoldenCase[] = [
  {
    name: "third candidate is ordinary quality, never Interesting",
    input: { ...BASE, scoreBefore: { kind: "cp", cp: 32 }, scoreAfter: { kind: "cp", cp: 8 }, playedMoveRank: 3 },
    expected: { quality: "good", annotations: [], classification: "good", engineRank: 3 },
  },
  {
    name: "saturated winning evaluations with zero outcome loss are not errors",
    input: { ...BASE, scoreBefore: { kind: "cp", cp: 1200 }, scoreAfter: { kind: "cp", cp: 900 }, playedMoveRank: 2 },
    expected: { quality: "excellent", annotations: [], classification: "excellent", engineRank: 2 },
  },
  {
    name: "outcome-unique top choice is Critical",
    input: { ...BASE, secondBestScore: { kind: "cp", cp: -400 } },
    expected: { quality: "best", annotations: ["critical"], classification: "great", engineRank: 1 },
  },
  {
    name: "decided equivalent lines are not Critical despite a large cp gap",
    input: { ...BASE, scoreBefore: { kind: "cp", cp: 1200 }, scoreAfter: { kind: "cp", cp: 1200 }, secondBestScore: { kind: "cp", cp: 900 } },
    expected: { quality: "best", annotations: [], classification: "best", engineRank: 1 },
  },
  {
    name: "outside-MultiPV restricted evidence has no invented rank",
    input: { ...BASE_WITHOUT_RANK, scoreBefore: { kind: "cp", cp: 80 }, scoreAfter: { kind: "cp", cp: -180 }, playedMoveOutsideMultiPv: true },
    expected: { quality: "blunder", annotations: [], classification: "blunder" },
  },
  {
    name: "lost forced mate remains an explicit missed-mate annotation",
    input: { ...BASE, scoreBefore: { kind: "mate", mateIn: 4 }, scoreAfter: { kind: "cp", cp: 0 }, playedMoveRank: 2 },
    expected: { quality: "blunder", annotations: ["missed_mate"], classification: "missed_mate", engineRank: 2 },
  },
  {
    name: "verified nontrivial sacrifice retains separate Critical and Brilliant semantics",
    input: {
      ...BASE,
      scoreBefore: { kind: "cp", cp: 20 },
      scoreAfter: { kind: "cp", cp: 30 },
      secondBestScore: { kind: "cp", cp: -350 },
      sacrifice: { sacrificedMaterial: 230, see: -230, compensationCp: 260, survivesBestResponse: true, recoveredWithinPv: 0, genuine: true },
      verification: { status: "verified", depth: 18, multiPv: 5, reasons: ["special-annotation"] },
    },
    expected: { quality: "best", annotations: ["sacrifice", "critical", "brilliant"], classification: "brilliant", engineRank: 1 },
  },
];
