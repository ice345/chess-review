import type { CoachLanguage } from "@chess-review/shared";
import type { CoachRequestProvider, MaiaModel } from "./local-ai";
import type { ChessSoundTheme } from "./chess-sound";

export interface AppSettings {
  coachProvider: CoachRequestProvider;
  coachLanguage: CoachLanguage;
  coachModel: string;
  reviewDepth: 10 | 12 | 15;
  reviewMultiPv: 1 | 2 | 3 | 4 | 5;
  continuationLines: 1 | 2 | 3 | 4 | 5;
  continuationLength: 6 | 8 | 10 | 12 | 16;
  humanTargetElo: number;
  humanModel: MaiaModel;
  autoAnalyzeImported: 0 | 1 | 3 | 5;
  soundEnabled: boolean;
  soundVolume: number;
  soundTheme: ChessSoundTheme;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  coachProvider: "ollama",
  coachLanguage: "zh-CN",
  coachModel: "gemma4:12b-it-qat",
  reviewDepth: 10,
  reviewMultiPv: 3,
  continuationLines: 3,
  continuationLength: 10,
  humanTargetElo: 1400,
  humanModel: "maia3-5m",
  autoAnalyzeImported: 0,
  soundEnabled: true,
  soundVolume: 0.35,
  soundTheme: "wintrchess",
};

const STORAGE_KEY = "open-chess-review-settings-v1";
export const APP_SETTINGS_EVENT = "open-chess-review-settings";

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<AppSettings>;
    const humanModel = stored.humanModel === "maia3-23m" || stored.humanModel === "maia3-79m"
      ? stored.humanModel
      : "maia3-5m";
    const soundVolume = typeof stored.soundVolume === "number" && Number.isFinite(stored.soundVolume)
      ? Math.max(0, Math.min(1, stored.soundVolume))
      : DEFAULT_APP_SETTINGS.soundVolume;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...stored,
      humanModel,
      soundEnabled: stored.soundEnabled !== false,
      soundVolume,
      soundTheme: "wintrchess",
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(APP_SETTINGS_EVENT, { detail: settings }));
}

export function savePreferredHumanTargetElo(targetElo: number): AppSettings {
  const bounded = Math.max(400, Math.min(3000, Math.round(targetElo)));
  const settings = { ...loadAppSettings(), humanTargetElo: bounded };
  saveAppSettings(settings);
  return settings;
}

export function savePreferredHumanModel(humanModel: MaiaModel): AppSettings {
  const settings = { ...loadAppSettings(), humanModel };
  saveAppSettings(settings);
  return settings;
}
