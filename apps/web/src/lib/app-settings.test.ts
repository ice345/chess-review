import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, savePreferredHumanModel, savePreferredHumanTargetElo } from "./app-settings";
import { backupSettings } from "./library-backup-format";

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
    expect(DEFAULT_APP_SETTINGS.pieceSet).toBe("liz-blue");
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

  it("keeps the interface language independent of the coach output language", () => {
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

    expect(DEFAULT_APP_SETTINGS).toMatchObject({ uiLanguage: "en", coachLanguage: "en" });

    // The two languages are separate decisions: a Chinese lesson does not turn the
    // interface Chinese, which is the whole point of the preference.
    saveAppSettings({ ...DEFAULT_APP_SETTINGS, coachLanguage: "zh-CN" });
    expect(loadAppSettings()).toMatchObject({ uiLanguage: "en", coachLanguage: "zh-CN" });

    saveAppSettings({ ...DEFAULT_APP_SETTINGS, uiLanguage: "zh-CN", coachLanguage: "zh-CN" });
    expect(loadAppSettings()).toMatchObject({ uiLanguage: "zh-CN", coachLanguage: "zh-CN" });

    // A stored value outside the list is not a language.
    values.set("open-chess-review-settings-v1", JSON.stringify({ uiLanguage: "de", coachLanguage: "zh-CN" }));
    expect(loadAppSettings()).toMatchObject({ uiLanguage: "en", coachLanguage: "zh-CN" });
  });

  it("keeps board display preferences inside their documented options", () => {
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

    expect(DEFAULT_APP_SETTINGS).toMatchObject({
      boardCoordinates: "inside",
      boardArrows: true,
      boardQualityBadge: true,
      pieceAnimation: "natural",
      moveEmphasis: "key",
    });

    saveAppSettings({ ...DEFAULT_APP_SETTINGS, boardCoordinates: "off", boardArrows: false, boardQualityBadge: false, pieceAnimation: "fast", moveEmphasis: "all" });
    expect(loadAppSettings()).toMatchObject({ boardCoordinates: "off", boardArrows: false, boardQualityBadge: false, pieceAnimation: "fast", moveEmphasis: "all" });

    values.set("open-chess-review-settings-v1", JSON.stringify({ boardCoordinates: "outside", pieceAnimation: "arcade", moveEmphasis: "none" }));
    expect(loadAppSettings()).toMatchObject({ boardCoordinates: "inside", pieceAnimation: "natural", moveEmphasis: "key" });
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
    expect(loadAppSettings()).toMatchObject({ soundEnabled: false, soundVolume: 0.72, soundTheme: "wintrchess", pieceSet: "liz-blue" });

    saveAppSettings({ ...DEFAULT_APP_SETTINGS, pieceSet: "classic" });
    expect(loadAppSettings().pieceSet).toBe("classic");
    values.set("open-chess-review-settings-v1", JSON.stringify({ pieceSet: "unknown" }));
    expect(loadAppSettings().pieceSet).toBe("liz-blue");

    values.set("open-chess-review-settings-v1", JSON.stringify({ soundVolume: 7, soundTheme: "unknown" }));
    expect(loadAppSettings()).toMatchObject({ soundEnabled: true, soundVolume: 1, soundTheme: "wintrchess", pieceSet: "liz-blue" });
  });

  it("round-trips board display preferences through a library backup", () => {
    const stored = { ...DEFAULT_APP_SETTINGS, boardCoordinates: "off" as const, boardArrows: false, boardQualityBadge: false, pieceAnimation: "off" as const, moveEmphasis: "all" as const, boardSize: 560 };
    expect(backupSettings(JSON.parse(JSON.stringify(stored)))).toMatchObject({
      boardCoordinates: "off",
      boardArrows: false,
      boardQualityBadge: false,
      pieceAnimation: "off",
      moveEmphasis: "all",
      boardSize: 560,
    });
    // An older backup has none of these fields and must restore the defaults.
    expect(backupSettings({ ...JSON.parse(JSON.stringify(stored)), boardCoordinates: undefined, boardArrows: undefined, boardQualityBadge: undefined, pieceAnimation: undefined, moveEmphasis: undefined, boardSize: undefined }))
      .toMatchObject({ boardCoordinates: "inside", boardArrows: true, boardQualityBadge: true, pieceAnimation: "natural", moveEmphasis: "key", boardSize: null });
    expect(() => backupSettings({ ...JSON.parse(JSON.stringify(stored)), pieceAnimation: "arcade" })).toThrow();
  });
});
