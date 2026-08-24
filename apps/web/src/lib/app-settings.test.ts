import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, loadAppSettings, savePreferredHumanModel, savePreferredHumanTargetElo } from "./app-settings";

describe("application settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("persists and bounds the preferred Maia target Elo", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("CustomEvent", class {
      constructor(_name: string, _options?: unknown) {}
    });

    expect(savePreferredHumanTargetElo(1738).humanTargetElo).toBe(1738);
    expect(loadAppSettings().humanTargetElo).toBe(1738);
    expect(savePreferredHumanTargetElo(5000).humanTargetElo).toBe(3000);
  });

  it("ships a stable Human Lens default", () => {
    expect(DEFAULT_APP_SETTINGS.humanTargetElo).toBe(1400);
    expect(DEFAULT_APP_SETTINGS.humanModel).toBe("maia3-5m");
  });

  it("persists the selected Maia model independently from Elo", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("CustomEvent", class {
      constructor(_name: string, _options?: unknown) {}
    });

    expect(savePreferredHumanModel("maia3-23m").humanModel).toBe("maia3-23m");
    expect(loadAppSettings().humanModel).toBe("maia3-23m");
  });
});
