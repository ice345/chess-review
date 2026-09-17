"use client";

import { useEffect } from "react";

/**
 * The review surfaces that paint over other content: Board settings, the More
 * and Export menus, the Maia quick settings, and the Why? evidence panel (all
 * absolutely positioned with a floating shadow). They
 * dismiss the way Lichess/Chess.com tool popovers do — a pointer outside closes
 * them, and Escape closes the open panel before it leaves a variation.
 *
 * These are floating surfaces, not content. Inline disclosures in the
 * contextual panel (the Game Summary, the engine lines, the evaluation timeline,
 * the evidence list on Moves) stay open while the visitor steps the game, so
 * they are deliberately not in this list: clicking Next move must not close the
 * report being read. A new floating panel belongs in this list.
 */
export const DISMISSIBLE_MENUS = [
  ".review-shell details.board-controls",
  ".review-shell .review-actions details",
  ".review-shell details.human-quick-settings",
  ".review-shell details.move-verdict-why",
].join(", ");

export function useDismissibleDetails(selector: string = DISMISSIBLE_MENUS): void {
  useEffect(() => {
    function openMenus(): HTMLDetailsElement[] {
      return [...document.querySelectorAll(selector)].filter(
        (node): node is HTMLDetailsElement => node instanceof HTMLDetailsElement && node.open,
      );
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      for (const menu of openMenus()) {
        if (!menu.contains(target)) menu.open = false;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const menus = openMenus();
      if (menus.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      menus.at(-1)!.open = false;
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [selector]);
}
