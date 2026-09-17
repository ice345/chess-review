import { isLocalSessionInvalid, LocalDataChangedError } from "./browser-storage";
import { UI_LANGUAGES } from "@chess-review/shared";
import type { CoachLanguage, UiLanguage } from "@chess-review/shared";
import type { CoachRequestProvider, MaiaModel } from "./local-ai";
import type { ChessSoundTheme } from "./chess-sound";
import type { PieceSetId } from "./board-piece-assets";
import { normalizeBoardSizePreference } from "./board-geometry";

/** Board notation placement. Only "inside" and "off" are implemented. */
export type BoardCoordinates = "inside" | "off";
export const BOARD_COORDINATES: readonly BoardCoordinates[] = ["inside", "off"];
/** Windowlight motion stays almost invisible; these are the only three speeds. */
export type PieceAnimation = "off" | "fast" | "natural";
export const PIECE_ANIMATIONS: readonly PieceAnimation[] = ["off", "fast", "natural"];
/** How strongly the move list colours everything that is not a key moment. */
export type MoveEmphasis = "key" | "all";
export const MOVE_EMPHASIS: readonly MoveEmphasis[] = ["key", "all"];

export interface AppSettings {
  /** The language of the interface itself. CoachLanguage is a separate decision. */
  uiLanguage: UiLanguage;
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
  pieceSet: PieceSetId;
  /** Desktop review board width in CSS pixels; null keeps the responsive default. */
  boardSize: number | null;
  boardCoordinates: BoardCoordinates;
  /** Objective/Maia candidate arrows. Practice feedback arrows are never controlled by this. */
  boardArrows: boolean;
  boardQualityBadge: boolean;
  pieceAnimation: PieceAnimation;
  moveEmphasis: MoveEmphasis;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  uiLanguage: "en",
  coachProvider: "ollama",
  coachLanguage: "en",
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
  pieceSet: "liz-blue",
  boardSize: null,
  boardCoordinates: "inside",
  boardArrows: true,
  boardQualityBadge: true,
  pieceAnimation: "natural",
  moveEmphasis: "key",
};

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? value as T : fallback;
}

export const APP_SETTINGS_STORAGE_KEY = "open-chess-review-settings-v1";
const STORAGE_KEY = APP_SETTINGS_STORAGE_KEY;
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
      pieceSet: stored.pieceSet === "classic" ? "classic" : "liz-blue",
      boardSize: normalizeBoardSizePreference(stored.boardSize),
      boardCoordinates: choice(stored.boardCoordinates, BOARD_COORDINATES, "inside"),
      boardArrows: stored.boardArrows !== false,
      boardQualityBadge: stored.boardQualityBadge !== false,
      pieceAnimation: choice(stored.pieceAnimation, PIECE_ANIMATIONS, "natural"),
      moveEmphasis: choice(stored.moveEmphasis, MOVE_EMPHASIS, "key"),
      uiLanguage: choice(stored.uiLanguage, UI_LANGUAGES, "en"),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (isLocalSessionInvalid()) throw new LocalDataChangedError();
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

export function savePreferredBoardSize(boardSize: number | null): AppSettings {
  const settings = { ...loadAppSettings(), boardSize: normalizeBoardSizePreference(boardSize) };
  saveAppSettings(settings);
  return settings;
}
