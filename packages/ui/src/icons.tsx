import type { ReactNode } from "react";

/**
 * The interface's line icons — the vocabulary the rail, the route panels and the
 * practice controls draw with. They are ours: one 16-unit grid, one stroke
 * weight, round caps, no fill, so a row of them reads as one quiet family and
 * never as a second illustration system.
 *
 * They are not Move Quality marks (`quality-icon.tsx`) and not the brand mark:
 * those carry meaning about a move and about the product, these only label a
 * control.
 */
export type IconName =
  | "home"
  | "import"
  | "review"
  | "practice"
  | "library"
  | "stats"
  | "settings"
  | "book"
  | "engine"
  | "evidence"
  | "question"
  | "moves"
  | "hint"
  | "answer"
  | "reset"
  | "chevron-right"
  | "chevron-left";

const GLYPHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M2.4 7.4 8 3l5.6 4.4" />
      <path d="M4 6.8v6.4h8V6.8" />
      <path d="M6.6 13.2V9.6h2.8v3.6" />
    </>
  ),
  import: (
    <>
      <path d="M3 10.4v2.6h10v-2.6" />
      <path d="M8 3.2v6.6" />
      <path d="M5.5 7.3 8 9.8l2.5-2.5" />
    </>
  ),
  review: (
    <>
      <rect x="2.8" y="2.8" width="10.4" height="10.4" rx="1.2" />
      <path d="M8 2.8v10.4M2.8 8h10.4" />
      <circle cx="10.6" cy="5.4" r="1.15" />
    </>
  ),
  practice: (
    <>
      <rect x="2.6" y="2.6" width="6.6" height="6.6" rx="1" />
      <path d="M12.4 6.4v5.8H6.6" />
      <path d="M6.6 10.6 8.2 12.2 6.6 13.8" />
    </>
  ),
  library: (
    <>
      <path d="M8 3.2v9.6" />
      <path d="M8 3.2H3.6A1 1 0 0 0 2.6 4.2v7.4A1 1 0 0 0 3.6 12.6H8" />
      <path d="M8 3.2h4.4A1 1 0 0 1 13.4 4.2v7.4A1 1 0 0 1 12.4 12.6H8" />
      <path d="M5 6.4h2M5 8.4h2M9.6 6.4h1.6" />
    </>
  ),
  stats: (
    <>
      <path d="M2.6 11.2 5.4 8.2 7.6 9.5 10.6 4.8 13.4 7.2" />
      <path d="M2.6 12.8h10.8" />
    </>
  ),

  settings: (
    <>
      <path d="M2.8 5.6h10.4" />
      <path d="M2.8 10.4h10.4" />
      <circle cx="6.2" cy="5.6" r="1.6" />
      <circle cx="10.2" cy="10.4" r="1.6" />
    </>
  ),
  book: (
    <>
      <path d="M3.2 3.6h6a2.4 2.4 0 0 1 2.4 2.4v6.4H5.6a2.4 2.4 0 0 1-2.4-2.4z" />
      <path d="M5.6 12.4h6" />
    </>
  ),
  engine: (
    <>
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.9v1.6M8 12.5v1.6M14.1 8h-1.6M3.5 8H1.9" />
      <path d="M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1M12.3 12.3l-1.1-1.1M4.8 4.8 3.7 3.7" />
    </>
  ),
  evidence: (
    <>
      <path d="M4.4 2.8h4.8l2.4 2.4v8H4.4z" />
      <path d="M9.2 2.8v2.6h2.4" />
      <path d="M6.2 8.6h3.6M6.2 11h3.6" />
    </>
  ),
  question: (
    <>
      <path d="M6.1 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.4v.3" />
      <circle cx="8" cy="12.2" r="0.4" />
    </>
  ),
  moves: (
    <>
      <path d="M3 4.6h10" />
      <path d="M3 8h10" />
      <path d="M3 11.4h6.4" />
    </>
  ),
  hint: (
    <>
      <path d="M8 3.2a3.4 3.4 0 0 1 2.1 6.1c-.4.3-.7.7-.7 1.2v.3H6.6v-.3c0-.5-.3-.9-.7-1.2A3.4 3.4 0 0 1 8 3.2z" />
      <path d="M6.9 12.8h2.2" />
    </>
  ),
  answer: (
    <>
      <path d="M1.9 8S4.3 4.3 8 4.3 14.1 8 14.1 8 11.7 11.7 8 11.7 1.9 8 1.9 8z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  reset: (
    <>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13.2 2.6v2.8h-2.8" />
    </>
  ),
  "chevron-right": <path d="M6.4 3.8 10.6 8l-4.2 4.2" />,
  "chevron-left": <path d="M9.6 3.8 5.4 8l4.2 4.2" />,
};

export interface IconProps {
  name: IconName;
  /** Rendered size in pixels; the box is square. */
  size?: number;
  /** Accessible name. Leave out for a decorative icon beside a visible label. */
  title?: string;
  className?: string;
}

export function Icon({ name, size = 16, title, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[name]}
    </svg>
  );
}
