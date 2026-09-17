"use client";

import type { ReactNode, Ref } from "react";
import { BOARD_SIZE_MAX, BOARD_SIZE_MIN, BOARD_SIZE_STEP } from "../../lib/board-geometry";
import type { BoardGeometryPreference } from "../../hooks/use-board-geometry-preference";

/**
 * Board display controls. Sound, focus and typed-move entry live here so the
 * player row stays Flip plus this one menu. The size slider is desktop-only
 * and stores intent: the layout still clamps the result against the viewport,
 * which is why the row reports the size the board actually rendered at rather
 * than the slider value.
 */
export function BoardControls({
  geometry,
  onShowShortcuts,
  soundEnabled,
  onToggleSound,
  focusBoard,
  onToggleFocus,
  moveEntry,
  menuRef,
}: {
  geometry: BoardGeometryPreference;
  onShowShortcuts: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  focusBoard: boolean;
  onToggleFocus: () => void;
  moveEntry: ReactNode;
  menuRef?: Ref<HTMLDetailsElement>;
}) {
  return (
    <details className="board-controls" ref={menuRef}>
      <summary aria-label="Board settings" title="Board settings">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 8.5h16M4 15.5h16" />
          <circle cx="9.5" cy="8.5" r="2.2" />
          <circle cx="14.5" cy="15.5" r="2.2" />
        </svg>
      </summary>
      <div className="action-menu board-controls-menu">
        <button
          type="button"
          className="text-button"
          aria-pressed={!soundEnabled}
          onClick={onToggleSound}
        >
          {soundEnabled ? "Mute sounds" : "Unmute sounds"}
        </button>
        <button
          type="button"
          className="text-button"
          aria-pressed={focusBoard}
          onClick={onToggleFocus}
        >
          {focusBoard ? "Exit focus board (Z)" : "Focus board (Z)"}
        </button>
        <label className="board-size-row">
          <span>Board size</span>
          <small>{geometry.size === null ? `Automatic · ${geometry.measuredSize} px` : `${geometry.measuredSize} px`}</small>
          <input
            type="range"
            min={BOARD_SIZE_MIN}
            max={BOARD_SIZE_MAX}
            step={BOARD_SIZE_STEP}
            value={geometry.measuredSize}
            aria-label="Board size"
            onChange={(event) => geometry.setSize(Number(event.currentTarget.value))}
            onPointerUp={geometry.commitSize}
            onKeyUp={geometry.commitSize}
            onBlur={geometry.commitSize}
          />
        </label>
        {geometry.size !== null && (
          <button type="button" className="text-button" onClick={geometry.useAutomaticSize}>Use the automatic size</button>
        )}
        <small className="board-controls-note">Desktop size. Type a move with /.</small>
        {moveEntry}
        <button type="button" className="text-button board-controls-shortcuts" onClick={onShowShortcuts}>Keyboard shortcuts (?)</button>
      </div>
    </details>
  );
}
