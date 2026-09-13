import type { CSSProperties } from "react";

/**
 * Canonical chessboard appearance for every react-chessboard surface.
 *
 * Shared by the Web app and the mobile companion so both render one board.
 * Colors are CSS custom properties: each app defines the `--board-*` tokens in
 * its own stylesheet, and no board hex value is repeated in component code.
 */
export const WINDOWLIGHT_BOARD_APPEARANCE = {
  lightSquareStyle: {
    backgroundColor: "var(--board-square-light)",
  } satisfies CSSProperties,

  darkSquareStyle: {
    backgroundColor: "var(--board-square-dark)",
  } satisfies CSSProperties,

  lightSquareNotationStyle: {
    color: "var(--board-notation-light)",
  } satisfies CSSProperties,

  darkSquareNotationStyle: {
    color: "var(--board-notation-dark)",
  } satisfies CSSProperties,

  boardStyle: {
    borderRadius: "6px",
    outline: "1px solid var(--board-outline)",
    boxShadow: "var(--shadow-board)",
  } satisfies CSSProperties,
} as const;
