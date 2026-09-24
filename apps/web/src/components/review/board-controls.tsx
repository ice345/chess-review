"use client";

import type { ReactNode, Ref } from "react";
import { Icon } from "@chess-review/ui";
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
        <Icon name="settings" size={16} />
      </summary>
      <div className="action-menu board-controls-menu">
        <button
          type="button"
          className="text-button"
          aria-pressed={!soundEnabled}
          onClick={onToggleSound}
        >
          <Icon name={soundEnabled ? "sound" : "sound-off"} size={16} />
          {soundEnabled ? "Mute sounds" : "Unmute sounds"}
        </button>
        <button
          type="button"
          className="text-button"
          aria-pressed={focusBoard}
          onClick={onToggleFocus}
        >
          <Icon name={focusBoard ? "focus-exit" : "focus"} size={16} />
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
