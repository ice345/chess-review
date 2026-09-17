/**
 * The review workspace shortcut map.
 *
 * One table is the single source for three consumers: the key handler, the `?`
 * overlay and the Help page. Adding a key here without implementing its action
 * would surface a shortcut that does nothing, so the handler only fires actions
 * the workspace actually provides.
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
  label: string;
  group: ReviewShortcutGroup;
}

export const REVIEW_SHORTCUTS: readonly ReviewShortcut[] = [
  { action: "previous", keys: ["ArrowLeft", "j"], label: "Previous move", group: "Navigation" },
  { action: "next", keys: ["ArrowRight", "k"], label: "Next move", group: "Navigation" },
  { action: "first", keys: ["ArrowUp"], label: "First move", group: "Navigation" },
  { action: "last", keys: ["ArrowDown"], label: "Last move", group: "Navigation" },
  { action: "togglePlayback", keys: [" "], label: "Play or pause", group: "Navigation" },
  { action: "leaveVariation", keys: ["Escape"], label: "Leave a variation, or exit focus board", group: "Navigation" },
  { action: "flipBoard", keys: ["f"], label: "Flip board", group: "Board" },
  { action: "toggleFocus", keys: ["z"], label: "Focus board, or leave focus", group: "Board" },
  { action: "toggleMoveEntry", keys: ["/"], label: "Type a move", group: "Board" },
  { action: "toggleHelp", keys: ["?"], label: "Show this shortcut list", group: "Help" },
];

export const REVIEW_SHORTCUT_GROUPS: readonly ReviewShortcutGroup[] = ["Navigation", "Board", "Help"];

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  " ": "Space",
  Escape: "Esc",
};

const KEY_ACTIONS = new Map<string, ReviewShortcutAction>();
for (const shortcut of REVIEW_SHORTCUTS) {
  for (const key of shortcut.keys) KEY_ACTIONS.set(key.toLowerCase(), shortcut.action);
}

/** Resolves a `KeyboardEvent.key` to its action. Unknown keys have no action. */
export function reviewShortcutAction(key: string): ReviewShortcutAction | undefined {
  return KEY_ACTIONS.get(key.toLowerCase());
}

/** Display form of a shortcut's keys, for the overlay and Help. */
export function shortcutKeysLabel(shortcut: ReviewShortcut): string {
  return shortcut.keys.map((key) => KEY_LABELS[key] ?? key.toUpperCase()).join(" / ");
}

export function shortcutsInGroup(group: ReviewShortcutGroup): ReviewShortcut[] {
  return REVIEW_SHORTCUTS.filter((shortcut) => shortcut.group === group);
}
