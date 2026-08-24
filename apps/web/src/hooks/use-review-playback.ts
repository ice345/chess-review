"use client";

import { useCallback, useEffect, useState } from "react";

export const DEFAULT_PLAYBACK_INTERVAL_MS = 900;

export function nextPlaybackPly(
  currentPly: number,
  totalPlies: number,
  inVariation: boolean,
): number | null {
  if (inVariation || totalPlies <= 0 || currentPly >= totalPlies) return null;
  return currentPly + 1;
}

export function useReviewPlayback({
  currentPly,
  totalPlies,
  inVariation,
  goToPly,
}: {
  currentPly: number;
  totalPlies: number;
  inVariation: boolean;
  goToPly: (ply: number) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => {
    if (inVariation || totalPlies <= 0) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (currentPly >= totalPlies) goToPly(0);
    setIsPlaying(true);
  }, [currentPly, goToPly, inVariation, isPlaying, totalPlies]);

  useEffect(() => {
    if (inVariation) setIsPlaying(false);
  }, [inVariation]);

  useEffect(() => {
    if (!isPlaying) return;
    const nextPly = nextPlaybackPly(currentPly, totalPlies, inVariation);
    if (nextPly === null) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => goToPly(nextPly), DEFAULT_PLAYBACK_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [currentPly, goToPly, inVariation, isPlaying, totalPlies]);

  return { isPlaying, pause, toggle };
}
