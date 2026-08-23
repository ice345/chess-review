import { describe, expect, it } from "vitest";
import { normalizeToWhitePov, scoreForColor } from "./score";

describe("engine score POV", () => {
  it("normalizes side-to-move cp scores to White POV", () => {
    expect(normalizeToWhitePov({ kind: "cp", cp: 80 }, "side-to-move", "white")).toEqual({ kind: "cp", cp: 80 });
    expect(normalizeToWhitePov({ kind: "cp", cp: 80 }, "side-to-move", "black")).toEqual({ kind: "cp", cp: -80 });
  });

  it("keeps mate separate while changing perspective", () => {
    expect(normalizeToWhitePov({ kind: "mate", mateIn: 3 }, "side-to-move", "black")).toEqual({ kind: "mate", mateIn: -3 });
    expect(scoreForColor({ kind: "mate", mateIn: -2 }, "black")).toEqual({ kind: "mate", mateIn: 2 });
  });
});
