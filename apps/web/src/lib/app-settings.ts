import type { CoachLanguage } from "@chess-review/shared";
import type { CoachRequestProvider } from "./local-ai";

export interface AppSettings {
  coachProvider: CoachRequestProvider;
  coachLanguage: CoachLanguage;
  coachModel: string;
  reviewDepth: 10 | 12 | 15;
  reviewMultiPv: 1 | 2 | 3 | 4 | 5;
  continuationLines: 1 | 2 | 3 | 4 | 5;
  continuationLength: 6 | 8 | 10 | 12 | 16;
  autoAnalyzeImported: 0 | 1 | 3 | 5;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  coachProvider: "ollama",
  coachLanguage: "zh-CN",
  coachModel: "gemma4:12b-it-qat",
  reviewDepth: 10,
  reviewMultiPv: 3,
  continuationLines: 3,
  continuationLength: 10,
  autoAnalyzeImported: 0,
};

const STORAGE_KEY = "open-chess-review-settings-v1";

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<AppSettings>;
    return { ...DEFAULT_APP_SETTINGS, ...stored };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("open-chess-review-settings", { detail: settings }));
}
