"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_SIZE_MIN, normalizeBoardSizePreference } from "../lib/board-geometry";
import { loadAppSettings, savePreferredBoardSize } from "../lib/app-settings";

export interface BoardGeometryPreference {
  /** Attach to the rendered board; measurement starts as soon as it exists. */
  boardRef: (node: HTMLDivElement | null) => void;
  /** Persisted intent in CSS pixels; null keeps the responsive default. */
  size: number | null;
  /** Width the layout actually granted the board, which is what the layout clamps cover. */
  measuredSize: number;
  setSize: (size: number) => void;
  /** Persist the current size. Call when the interaction ends, not per step. */
  commitSize: () => void;
  useAutomaticSize: () => void;
}

/**
 * Desktop board geometry preference.
 *
 * The layout keeps ownership of the safe range: the CSS clamp decides what the
 * viewport allows, and this hook never fights it. It stores the intent, exposes
 * the size the board actually rendered at (so the control cannot display a size
 * the layout refused), and writes to settings only when the interaction has
 * finished — every intermediate step of a drag would otherwise re-render the
 * board for a value the visitor is still moving away from.
 *
 * It owns its element ref because the board only mounts once the review record
 * has loaded; a stable `RefObject` would have been measured while still null.
 */
export function useBoardGeometryPreference(): BoardGeometryPreference {
  const [size, setSizeState] = useState<number | null>(() => loadAppSettings().boardSize);
  const [measuredSize, setMeasuredSize] = useState(BOARD_SIZE_MIN);
  const [boardElement, setBoardElement] = useState<HTMLDivElement | null>(null);
  const latestSize = useRef<number | null>(size);
  /** `undefined` means the last write did not reach storage, so the next one retries. */
  const lastWritten = useRef<number | null | undefined>(size);
  latestSize.current = size;

  const boardRef = useCallback((node: HTMLDivElement | null) => setBoardElement(node), []);

  const persist = useCallback((next: number | null) => {
    if (lastWritten.current === next) return;
    lastWritten.current = next;
    try {
      savePreferredBoardSize(next);
    } catch {
      // Storage can be unavailable or invalidated. The session keeps the size it
      // already applied, and the next interaction retries the write.
      lastWritten.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!boardElement || typeof ResizeObserver === "undefined") return;
    const measure = () => setMeasuredSize(Math.round(boardElement.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(boardElement);
    return () => observer.disconnect();
  }, [boardElement]);

  const setSize = useCallback((next: number) => {
    setSizeState(normalizeBoardSizePreference(next) ?? BOARD_SIZE_MIN);
  }, []);

  const commitSize = useCallback(() => persist(latestSize.current), [persist]);

  const useAutomaticSize = useCallback(() => {
    setSizeState(null);
    latestSize.current = null;
    persist(null);
  }, [persist]);

  return { boardRef, size, measuredSize, setSize, commitSize, useAutomaticSize };
}
