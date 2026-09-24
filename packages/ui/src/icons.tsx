import type { ReactNode } from "react";

/**
 * Windowlight line icons — one 16-unit grid, stroke 1.4, round caps/joins.
 * Rail nav (F-P1-16) and working controls (F-P1-17) share this family.
 * Not Quality / HumanDifficulty / ProviderMark / BrandMark.
 *
 * No birds, feathers, music notes, or instrument glyphs in this set.
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
  | "undo"
  | "chevron-right"
  | "chevron-left"
  | "flip"
  | "focus"
  | "focus-exit"
  | "menu"
  | "play"
  | "pause"
  | "first"
  | "previous"
  | "next"
  | "last"
  | "sound"
  | "sound-off"
  | "edit"
  | "close"
  | "more"
  | "export";

/** Alias for control call sites (F-P1-17). */
export type ControlIconName = IconName;

const GLYPHS: Record<IconName, ReactNode> = {
  /* Window + desk baseline — threshold beside the “Home” label. */
  home: (
    <>
      <rect x="3.3" y="2.2" width="9.4" height="9.6" rx="0.45" />
      <path d="M8 2.2v9.6M3.3 6.2h9.4" />
      <path d="M2.4 13.2h11.2" />
    </>
  ),
  /* Sheet arriving on the desk — short inward cue, not cloud/download. */
  import: (
    <>
      <path d="M5.2 3h5.6v7H5.2z" />
      <path d="M6.5 5h3M6.5 6.8h2.2" />
      <path d="M2.6 12.8h10.8" />
      <path d="M3 7.2h2.2M4.1 6.2 5.2 7.2 4.1 8.2" />
    </>
  ),
  /* Mini board + focus entirely inside one square (~1.2 unit gap at 16px). */
  review: (
    <>
      <rect x="2.8" y="2.8" width="10.4" height="10.4" rx="1.1" />
      <path d="M8 2.8v10.4M2.8 8h10.4" />
      <circle cx="10.85" cy="5.15" r="0.85" />
    </>
  ),
  /* Anchor square reads first; open recall arc; end tip is a ring, not a badge. */
  practice: (
    <>
      <rect x="2.5" y="2.5" width="6.2" height="6.2" rx="0.9" />
      <path d="M11.5 4a4.35 4.35 0 1 1-1.35 6.55" />
      <circle cx="12.35" cy="11.35" r="0.95" />
    </>
  ),
  /* Open folio — score / notebook without literal music. */
  library: (
    <>
      <path d="M8 3.2v9.6" />
      <path d="M8 3.2H3.6A1 1 0 0 0 2.6 4.2v7.4A1 1 0 0 0 3.6 12.6H8" />
      <path d="M8 3.2h4.4A1 1 0 0 1 13.4 4.2v7.4A1 1 0 0 1 12.4 12.6H8" />
      <path d="M5 6.4h2M5 8.4h2M9.6 6.4h1.6" />
    </>
  ),
  /* One thin eval trace + baseline — not a financial bar chart. */
  stats: (
    <>
      <path d="M2.8 11 6.4 7.2 9.6 8.8 13.2 4.6" />
      <path d="M2.8 12.8h10.4" />
    </>
  ),
  settings: (
    <>
      <path d="M2.8 5.6h10.4" />
      <path d="M2.8 10.4h10.4" />
      <circle cx="6.2" cy="5.6" r="1.55" />
      <circle cx="10.2" cy="10.4" r="1.55" />
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
  undo: (
    <>
      <path d="M3 8a5 5 0 1 0 1.5-3.6" />
      <path d="M2.8 2.6v2.8h2.8" />
    </>
  ),
  "chevron-right": <path d="M6.4 3.8 10.6 8l-4.2 4.2" />,
  "chevron-left": <path d="M9.6 3.8 5.4 8l4.2 4.2" />,
  flip: (
    <>
      <path d="M4.8 4.4h6.4l-1.6-1.6" />
      <path d="M11.2 11.6H4.8l1.6 1.6" />
      <path d="M11.2 4.4v3.4M4.8 11.6V8.2" />
    </>
  ),
  focus: (
    <>
      <path d="M3.2 6.2V3.2h3M12.8 6.2V3.2h-3M3.2 9.8v3h3M12.8 9.8v3h-3" />
    </>
  ),
  "focus-exit": (
    <>
      <path d="M6.2 3.2v3h-3M9.8 3.2v3h3M6.2 12.8v-3h-3M9.8 12.8v-3h3" />
    </>
  ),
  menu: (
    <>
      <path d="M2.4 4.2h11.2M2.4 8h11.2M2.4 11.8h11.2" />
    </>
  ),
  /* Sole filled glyph in the family. */
  play: <path d="M5.6 3.6 12.4 8 5.6 12.4z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M5.2 3.6h2.2v8.8H5.2z" />
      <path d="M8.6 3.6h2.2v8.8H8.6z" />
    </>
  ),
  /* Stroke-only transport — no fill except play. */
  first: (
    <>
      <path d="M4.2 3.8v8.4" />
      <path d="M12.2 3.8 6.6 8l5.6 4.2" />
    </>
  ),
  previous: <path d="M11.4 3.8 5.8 8l5.6 4.2" />,
  next: <path d="M4.6 3.8 10.2 8 4.6 12.2" />,
  last: (
    <>
      <path d="M11.8 3.8v8.4" />
      <path d="M3.8 3.8 9.4 8 3.8 12.2" />
    </>
  ),
  sound: (
    <>
      <path d="M3.2 6.2h2.4L8.4 3.8v8.4L5.6 9.8H3.2z" />
      <path d="M10.4 6.2a2.4 2.4 0 0 1 0 3.6" />
      <path d="M11.8 4.6a4.4 4.4 0 0 1 0 6.8" />
    </>
  ),
  "sound-off": (
    <>
      <path d="M3.2 6.2h2.4L8.4 3.8v8.4L5.6 9.8H3.2z" />
      <path d="M10.2 5.6 13.4 10.4M13.4 5.6 10.2 10.4" />
    </>
  ),
  edit: (
    <>
      <path d="M9.2 3.6 12.4 6.8 6 13.2H2.8V10z" />
      <path d="M8.2 4.6 11.4 7.8" />
    </>
  ),
  close: (
    <>
      <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" />
    </>
  ),
  more: (
    <>
      <circle cx="3.6" cy="8" r="1.05" />
      <circle cx="8" cy="8" r="1.05" />
      <circle cx="12.4" cy="8" r="1.05" />
    </>
  ),
  export: (
    <>
      <path d="M5.2 3h5.6v7H5.2z" />
      <path d="M6.5 5h3M6.5 6.8h2.2" />
      <path d="M2.6 12.8h10.8" />
      <path d="M13 7.2h-2.2M11.9 6.2 10.8 7.2 11.9 8.2" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
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

/** Same as Icon — named export for F-P1-17 call sites. */
export function ControlIcon(props: IconProps) {
  return <Icon {...props} />;
}
