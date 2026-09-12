import { describe, expect, it } from "vitest";
import { alignPgnAnnotations, readPgnAnnotations } from "./pgn-annotations";

describe("readPgnAnnotations", () => {
  it("attaches comments, NAGs and variations to the move they follow", () => {
    const annotations = readPgnAnnotations(`[Event "Test"]

{ A game comment }
1. e4 $1 { King's pawn } (1. d4 d5) e5 2. Nf3 $14 Nc6 ; rest of line
3. Bb5 a6 *`);

    expect(annotations.gameComment).toBe("A game comment");
    expect(annotations.plies).toHaveLength(6);
    expect(annotations.plies[0]).toEqual({ comment: "King's pawn", nags: [1], variations: ["(1. d4 d5)"] });
    expect(annotations.plies[1]).toEqual({});
    expect(annotations.plies[2]).toEqual({ nags: [14] });
    expect(annotations.plies[3]).toEqual({ comment: "rest of line" });
    expect(annotations.plies[4]).toEqual({});
    expect(annotations.plies[5]).toEqual({});
  });

  it("keeps nested variations intact and does not steal the comments inside them", () => {
    const annotations = readPgnAnnotations("1. e4 e5 (1... c5 { Sicilian } 2. Nf3 (2. Nc3)) 2. Nf3");

    expect(annotations.plies).toHaveLength(3);
    expect(annotations.plies[1]?.variations).toEqual(["(1... c5 { Sicilian } 2. Nf3 (2. Nc3))"]);
    // "Sicilian" belongs to the variation, not to the mainline move 1...e5.
    expect(annotations.plies[1]?.comment).toBeUndefined();
    expect(annotations.plies[2]).toEqual({});
  });

  it("tolerates glued move numbers and ignores results, escapes and stray brackets", () => {
    const annotations = readPgnAnnotations("%% escape line\n1.e4 e5 2.Nf3 Nc6 1-0 { after the result }");

    expect(annotations.plies).toHaveLength(4);
    expect(annotations.plies[3]).toEqual({ comment: "after the result" });
  });

  it("reads a game that starts from a non-initial move number", () => {
    const annotations = readPgnAnnotations('[SetUp "1"]\n\n20. Qd2 { from a study } Rfd8');

    expect(annotations.plies).toHaveLength(2);
    expect(annotations.plies[0]).toEqual({ comment: "from a study" });
  });

  it("aligns annotations only when the reading and the replayed mainline agree", () => {
    const aligned = alignPgnAnnotations(readPgnAnnotations("1. e4 { first } e5"), 2);
    expect(aligned.plies).toEqual([{ comment: "first" }, {}]);
    expect(aligned.gameComment).toBeUndefined();

    // A disagreement drops the per-move mapping instead of labelling wrong moves.
    const mismatched = alignPgnAnnotations(readPgnAnnotations("1. e4 { first } e5"), 3);
    expect(mismatched.plies).toEqual([{}, {}, {}]);
  });
});
