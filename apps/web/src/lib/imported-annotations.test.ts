import { describe, expect, it } from "vitest";
import { displayPgnComment } from "./imported-annotations";

describe("displayPgnComment", () => {
  it("strips clock and elapsed-time commands and keeps the author's note", () => {
    expect(displayPgnComment("[%clk 0:06:15] Best by test")).toBe("Best by test");
    expect(displayPgnComment("Best by test [%clk 0:06:15]")).toBe("Best by test");
    expect(displayPgnComment("[%clk 0:06:15][%emt 0:00:04] a quiet move")).toBe("a quiet move");
  });

  it("keeps imported eval commands, which are author data", () => {
    expect(displayPgnComment("[%eval 0.35] Best by test")).toBe("[%eval 0.35] Best by test");
    expect(displayPgnComment("Best by test [%eval #3]")).toBe("Best by test [%eval #3]");
  });

  it("hides a comment that is only clock telemetry", () => {
    expect(displayPgnComment("[%clk 0:06:15]")).toBeUndefined();
    expect(displayPgnComment("[%clk 0:06:15] [%emt 0:00:04]")).toBeUndefined();
    expect(displayPgnComment(undefined)).toBeUndefined();
    expect(displayPgnComment("   ")).toBeUndefined();
  });

  it("strips clocks nested inside a variation without dropping the line", () => {
    expect(displayPgnComment("(1. d4 { [%clk 0:09:57] } d5)")).toBe("(1. d4 d5)");
  });

  it("leaves a human comment untouched", () => {
    expect(displayPgnComment("Best by test")).toBe("Best by test");
  });
});
