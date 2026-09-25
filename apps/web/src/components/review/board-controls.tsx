"use client";

import type { ReactNode, Ref } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { Icon } from "@chess-review/ui";
import { BOARD_SIZE_MAX, BOARD_SIZE_MIN, BOARD_SIZE_STEP } from "../../lib/board-geometry";
import type { BoardGeometryPreference } from "../../hooks/use-board-geometry-preference";
import { useUiLanguage } from "../../hooks/use-ui-language";

type BoardControlsCopy = {
  settings: string;
  mute: string;
  unmute: string;
  exitFocus: string;
  focus: string;
  boardSize: string;
  automaticSize: (px: number) => string;
  measuredSize: (px: number) => string;
  useAutomatic: string;
  note: string;
  shortcuts: string;
};

const COPY: Record<UiLanguage, BoardControlsCopy> = {
  en: {
    settings: "Board settings",
    mute: "Mute sounds",
    unmute: "Unmute sounds",
    exitFocus: "Exit focus board (Z)",
    focus: "Focus board (Z)",
    boardSize: "Board size",
    automaticSize: (px) => `Automatic \u00b7 ${px} px`,
    measuredSize: (px) => `${px} px`,
    useAutomatic: "Use the automatic size",
    note: "Desktop size. Type a move with /.",
    shortcuts: "Keyboard shortcuts (?)",
  },
  "zh-CN": {
    settings: "棋盘设置",
    mute: "静音",
    unmute: "取消静音",
    exitFocus: "退出专注棋盘（Z）",
    focus: "专注棋盘（Z）",
    boardSize: "棋盘大小",
    automaticSize: (px) => `自动 \u00b7 ${px} px`,
    measuredSize: (px) => `${px} px`,
    useAutomatic: "使用自动大小",
    note: "桌面尺寸。按 / 输入着法。",
    shortcuts: "键盘快捷键（?）",
  },
};

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
  const copy = COPY[useUiLanguage()];
  return (
    <details className="board-controls" ref={menuRef}>
      <summary aria-label={copy.settings} title={copy.settings}>
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
          {soundEnabled ? copy.mute : copy.unmute}
        </button>
        <button
          type="button"
          className="text-button"
          aria-pressed={focusBoard}
          onClick={onToggleFocus}
        >
          <Icon name={focusBoard ? "focus-exit" : "focus"} size={16} />
          {focusBoard ? copy.exitFocus : copy.focus}
        </button>
        <label className="board-size-row">
          <span>{copy.boardSize}</span>
          <small>{geometry.size === null ? copy.automaticSize(geometry.measuredSize) : copy.measuredSize(geometry.measuredSize)}</small>
          <input
            type="range"
            min={BOARD_SIZE_MIN}
            max={BOARD_SIZE_MAX}
            step={BOARD_SIZE_STEP}
            value={geometry.measuredSize}
            aria-label={copy.boardSize}
            onChange={(event) => geometry.setSize(Number(event.currentTarget.value))}
            onPointerUp={geometry.commitSize}
            onKeyUp={geometry.commitSize}
            onBlur={geometry.commitSize}
          />
        </label>
        {geometry.size !== null && (
          <button type="button" className="text-button" onClick={geometry.useAutomaticSize}>{copy.useAutomatic}</button>
        )}
        <small className="board-controls-note">{copy.note}</small>
        {moveEntry}
        <button type="button" className="text-button board-controls-shortcuts" onClick={onShowShortcuts}>{copy.shortcuts}</button>
      </div>
    </details>
  );
}
