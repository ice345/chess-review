"use client";

import { useEffect, useState } from "react";
import { APP_SETTINGS_EVENT, loadAppSettings, type BoardCoordinates, type MoveEmphasis, type PieceAnimation } from "../lib/app-settings";

export interface BoardDisplaySettings {
  boardCoordinates: BoardCoordinates;
  boardArrows: boolean;
  boardQualityBadge: boolean;
  pieceAnimation: PieceAnimation;
  moveEmphasis: MoveEmphasis;
}

function read(): BoardDisplaySettings {
  const settings = loadAppSettings();
  return {
    boardCoordinates: settings.boardCoordinates,
    boardArrows: settings.boardArrows,
    boardQualityBadge: settings.boardQualityBadge,
    pieceAnimation: settings.pieceAnimation,
    moveEmphasis: settings.moveEmphasis,
  };
}

/** Milliseconds for the three motion speeds. Windowlight motion stays near-invisible. */
export const PIECE_ANIMATION_MS: Record<PieceAnimation, number> = { off: 0, fast: 90, natural: 160 };

/**
 * Board feedback preferences.
 *
 * Deliberately separate from the review shell's settings snapshot: these change
 * what the board *looks like*, so they must apply as soon as Settings saves them,
 * while the analysis settings (depth, MultiPV) must not churn the review runtime
 * that owns an in-flight engine request.
 */
export function useBoardDisplaySettings(): BoardDisplaySettings {
  const [settings, setSettings] = useState<BoardDisplaySettings>(read);
  useEffect(() => {
    const sync = () => setSettings(read());
    window.addEventListener(APP_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(APP_SETTINGS_EVENT, sync);
  }, []);
  return settings;
}
