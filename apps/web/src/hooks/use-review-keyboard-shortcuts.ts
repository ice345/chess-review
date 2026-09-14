"use client";

import { useEffect, useRef } from "react";
import { reviewShortcutAction, type ReviewShortcutAction } from "../lib/review-shortcuts";

/* Shortcuts never fire while the visitor is typing, dragging a control, or
   focused on something the keys belong to (a slider keeps its arrow keys, a
   link keeps Enter, and so on). */
const FORM_CONTROL = "input, textarea, select, button, a, [contenteditable='true'], [role='slider']";

/**
 * Installs the review workspace shortcut map. The handlers object is read from a
 * ref, so re-rendering the workspace does not re-subscribe on every render.
 * `suspended` disables every shortcut while a modal state owns the keyboard.
 */
export function useReviewKeyboardShortcuts(
  handlers: Partial<Record<ReviewShortcutAction, () => void>>,
  { suspended = false }: { suspended?: boolean } = {},
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (suspended) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(FORM_CONTROL)) return;
      const action = reviewShortcutAction(event.key);
      if (!action) return;
      const handler = handlersRef.current[action];
      if (!handler) return;
      event.preventDefault();
      handler();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [suspended]);
}
