import { describe, expect, it } from "vitest";
import { REVIEW_SHORTCUTS, reviewShortcutAction, shortcutKeysLabel, shortcutsInGroup } from "./review-shortcuts";

describe("review shortcuts", () => {
  it("binds every key to exactly one action, so no shortcut silently shadows another", () => {
    const seen = new Map<string, string>();
    for (const shortcut of REVIEW_SHORTCUTS) {
      for (const key of shortcut.keys) {
        const normalized = key.toLowerCase();
        expect(seen.has(normalized), `${key} is bound to both ${seen.get(normalized)} and ${shortcut.action}`).toBe(false);
        seen.set(normalized, shortcut.action);
      }
    }
  });

  it("resolves documented keys and ignores everything else", () => {
    expect(reviewShortcutAction("ArrowLeft")).toBe("previous");
    expect(reviewShortcutAction("J")).toBe("previous");
    expect(reviewShortcutAction("j")).toBe("previous");
    expect(reviewShortcutAction("k")).toBe("next");
    expect(reviewShortcutAction(" ")).toBe("togglePlayback");
    expect(reviewShortcutAction("?")).toBe("toggleHelp");
    expect(reviewShortcutAction("ArrowUp")).toBe("first");
    expect(reviewShortcutAction("Enter")).toBeUndefined();
    expect(reviewShortcutAction("g")).toBeUndefined();
  });

  it("labels keys for the overlay and groups them", () => {
    expect(shortcutKeysLabel(REVIEW_SHORTCUTS.find((shortcut) => shortcut.action === "previous")!)).toBe("← / J");
    expect(shortcutKeysLabel(REVIEW_SHORTCUTS.find((shortcut) => shortcut.action === "togglePlayback")!)).toBe("Space");
    expect(shortcutsInGroup("Board").map((shortcut) => shortcut.action)).toEqual(["flipBoard", "toggleFocus", "toggleMoveEntry"]);
  });
});
