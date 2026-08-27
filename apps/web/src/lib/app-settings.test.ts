import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, savePreferredHumanModel, savePreferredHumanTargetElo } from "./app-settings";

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
    expect(DEFAULT_APP_SETTINGS.soundEnabled).toBe(true);
    expect(DEFAULT_APP_SETTINGS.soundVolume).toBe(0.35);
    expect(DEFAULT_APP_SETTINGS.soundTheme).toBe("wintrchess");
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

  it("persists and bounds quiet chess sound preferences", () => {
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

    saveAppSettings({ ...DEFAULT_APP_SETTINGS, soundEnabled: false, soundVolume: 0.72 });
    expect(loadAppSettings()).toMatchObject({ soundEnabled: false, soundVolume: 0.72, soundTheme: "wintrchess" });

    values.set("open-chess-review-settings-v1", JSON.stringify({ soundVolume: 7, soundTheme: "unknown" }));
    expect(loadAppSettings()).toMatchObject({ soundEnabled: true, soundVolume: 1, soundTheme: "wintrchess" });
  });
});
