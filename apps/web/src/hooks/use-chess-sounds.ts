"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { AnalysisBranchTree } from "../lib/analysis-branch";
import { APP_SETTINGS_EVENT, loadAppSettings, saveAppSettings } from "../lib/app-settings";
import {
  ChessSoundController,
  resolveReviewSoundTransition,
  type ChessSoundPreferences,
  type ReviewSoundSnapshot,
} from "../lib/chess-sound";

const controller = new ChessSoundController();

function loadPreferences(): ChessSoundPreferences {
  const settings = loadAppSettings();
  return {
    enabled: settings.soundEnabled,
    volume: settings.soundVolume,
    theme: settings.soundTheme,
  };
}

export function useChessSounds({
  game,
  currentPly,
  branch,
}: {
  game: NormalizedGame | null;
  currentPly: number;
  branch: AnalysisBranchTree | null;
}) {
  const [preferences, setPreferences] = useState<ChessSoundPreferences>({
    enabled: true,
    volume: 0.35,
    theme: "wintrchess",
  });
  const previous = useRef<ReviewSoundSnapshot | null>(null);

  useEffect(() => {
    controller.resetSequence();
    setPreferences(loadPreferences());
    const update = () => setPreferences(loadPreferences());
    window.addEventListener(APP_SETTINGS_EVENT, update);
    return () => window.removeEventListener(APP_SETTINGS_EVENT, update);
  }, []);

  useEffect(() => {
    if (controller.isUnlocked()) return;
    const unlock = () => {
      controller.unlock();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);

  useEffect(() => {
    const next = { game, currentPly, branch };
    const transition = previous.current
      ? resolveReviewSoundTransition(previous.current, next)
      : null;
    previous.current = next;
    controller.playTransition(transition, preferences);
  }, [branch, currentPly, game, preferences]);

  const toggleMuted = useCallback(() => {
    const current = loadAppSettings();
    saveAppSettings({ ...current, soundEnabled: !current.soundEnabled });
  }, []);

  return {
    soundEnabled: preferences.enabled,
    soundVolume: preferences.volume,
    soundTheme: preferences.theme,
    toggleMuted,
  };
}
