import type { UiLanguage } from "@chess-review/shared";

/**
 * The review workspace shortcut map.
 *
 * One table is the single source for three consumers: the key handler, the `?`
 * overlay and the Help page. Adding a key here without implementing its action
 * would surface a shortcut that does nothing, so the handler only fires actions
 * the workspace actually provides.
 *
 * The table holds what is language-independent - the action, the keys that the
 * handler matches and the group it is filed under. The wording lives in the
 * tables below, so the overlay and the Help page cannot drift apart.
 */
export type ReviewShortcutAction =
  | "previous"
  | "next"
  | "first"
  | "last"
  | "togglePlayback"
  | "leaveVariation"
  | "flipBoard"
  | "toggleFocus"
  | "toggleMoveEntry"
  | "toggleHelp";

export type ReviewShortcutGroup = "Navigation" | "Board" | "Help";

export interface ReviewShortcut {
  action: ReviewShortcutAction;
  /** `KeyboardEvent.key` values, matched case-insensitively. */
  keys: readonly string[];
  group: ReviewShortcutGroup;
}

export const REVIEW_SHORTCUTS: readonly ReviewShortcut[] = [
  { action: "previous", keys: ["ArrowLeft", "j"], group: "Navigation" },
  { action: "next", keys: ["ArrowRight", "k"], group: "Navigation" },
  { action: "first", keys: ["ArrowUp"], group: "Navigation" },
  { action: "last", keys: ["ArrowDown"], group: "Navigation" },
  { action: "togglePlayback", keys: [" "], group: "Navigation" },
  { action: "leaveVariation", keys: ["Escape"], group: "Navigation" },
  { action: "flipBoard", keys: ["f"], group: "Board" },
  { action: "toggleFocus", keys: ["z"], group: "Board" },
  { action: "toggleMoveEntry", keys: ["/"], group: "Board" },
  { action: "toggleHelp", keys: ["?"], group: "Help" },
];

export const REVIEW_SHORTCUT_GROUPS: readonly ReviewShortcutGroup[] = ["Navigation", "Board", "Help"];

type ShortcutCopy = {
  labels: Record<ReviewShortcutAction, string>;
  groups: Record<ReviewShortcutGroup, string>;
};

const COPY: Record<UiLanguage, ShortcutCopy> = {
  en: {
    labels: {
      previous: "Previous move",
      next: "Next move",
      first: "First move",
      last: "Last move",
      togglePlayback: "Play or pause",
      leaveVariation: "Leave a variation, or exit focus board",
      flipBoard: "Flip board",
      toggleFocus: "Focus board, or leave focus",
      toggleMoveEntry: "Type a move",
      toggleHelp: "Show this shortcut list",
    },
    groups: { Navigation: "Navigation", Board: "Board", Help: "Help" },
  },
  "zh-CN": {
    labels: {
      previous: "上一步",
      next: "下一步",
      first: "第一步",
      last: "最后一步",
      togglePlayback: "播放或暂停",
      leaveVariation: "离开变例，或退出专注棋盘",
      flipBoard: "翻转棋盘",
      toggleFocus: "专注棋盘，或退出专注",
      toggleMoveEntry: "输入着法",
      toggleHelp: "显示这个快捷键列表",
    },
    groups: { Navigation: "导航", Board: "棋盘", Help: "帮助" },
  },
};

/* Only the two named keys are words. The arrows are symbols in every language and
   Esc is the physical key, so it is not translated. */
const KEY_LABELS: Record<UiLanguage, Record<string, string>> = {
  en: { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", " ": "Space", Escape: "Esc" },
  "zh-CN": { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", " ": "空格", Escape: "Esc" },
};

/** Display name of the group, for the section headings of the overlay and Help. */
export function shortcutGroupLabel(group: ReviewShortcutGroup, language: UiLanguage): string {
  return COPY[language].groups[group];
}

/** Display name of the action, for the overlay and Help. */
export function shortcutLabel(shortcut: ReviewShortcut, language: UiLanguage): string {
  return COPY[language].labels[shortcut.action];
}

const KEY_ACTIONS = new Map<string, ReviewShortcutAction>();
for (const shortcut of REVIEW_SHORTCUTS) {
  for (const key of shortcut.keys) KEY_ACTIONS.set(key.toLowerCase(), shortcut.action);
}

/** Resolves a `KeyboardEvent.key` to its action. Unknown keys have no action. */
export function reviewShortcutAction(key: string): ReviewShortcutAction | undefined {
  return KEY_ACTIONS.get(key.toLowerCase());
}

/** Display form of a shortcut's keys, for the overlay and Help. */
export function shortcutKeysLabel(shortcut: ReviewShortcut, language: UiLanguage): string {
  const named = KEY_LABELS[language];
  return shortcut.keys.map((key) => named[key] ?? key.toUpperCase()).join(" / ");
}

export function shortcutsInGroup(group: ReviewShortcutGroup): ReviewShortcut[] {
  return REVIEW_SHORTCUTS.filter((shortcut) => shortcut.group === group);
}
