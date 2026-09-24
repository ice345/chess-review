/** Authored paper-cut motifs for the study desk, never chess-quality symbols. */
export function BluebirdMotif({ kind = "bird", className = "" }: {
  kind?: "bird" | "feather" | "flight";
  className?: string;
}) {
  return kind === "flight" ? (
    <svg className={`bluebird-motif ${className}`} viewBox="0 0 120 80" fill="none" aria-hidden="true" focusable="false">
      <path d="M53 45C34 42 21 27 12 8c22 3 40 12 51 29C76 17 90 9 109 6 97 24 87 37 70 45L81 57 64 53 40 72 46 51 25 54Z" fill="currentColor" opacity=".8" />
      <path d="M53 45C38 32 26 20 12 8c22 3 40 12 51 29" fill="currentColor" />
      <path d="m65 44 14-2-8 7" fill="var(--ink-primary, #2d4654)" />
      <circle cx="66" cy="41" r="1.5" fill="var(--surface-paper, #fffef9)" />
    </svg>
  ) : kind === "feather" ? (
    <svg className={`bluebird-motif ${className}`} viewBox="0 0 32 48" fill="none" aria-hidden="true" focusable="false">
      <path d="M26 3C10 5 4 17 7 32L12 37C26 29 29 15 26 3Z" fill="currentColor" opacity=".22" />
      <path d="M6 44 24 7M11 34l-3-12m8 1 9-5M15 27l-4-13m1 20 11-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className={`bluebird-motif ${className}`} viewBox="0 0 160 100" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 84c42-5 86-3 134-12" stroke="currentColor" opacity=".28" strokeWidth="1.2" />
      <path d="m71 71-3 11m13-11-4 10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M31 59 9 70l29-2c16 17 49 12 62-9l12-17-13-1c-3-16-25-20-36-8-6 6-7 15-15 21Z" fill="currentColor" opacity=".8" />
      <path d="M34 60c13 1 32-18 44-15-2 19-21 26-38 22" fill="currentColor" />
      <path d="M58 71c16 6 29-4 35-15-10 7-19 5-26 4" fill="var(--surface-paper, #fffef9)" opacity=".75" />
      <path d="m100 41 14 5-16 4" fill="var(--ink-primary, #2d4654)" />
      <circle cx="92" cy="39" r="1.8" fill="var(--ink-primary, #2d4654)" />
      <path d="m124 77 4-10m-3 7c-10-8-10-15-5-16 6 4 7 11 5 16Zm3-8c1-9 6-12 10-10-1 7-5 10-10 10Z" stroke="currentColor" opacity=".4" strokeWidth="1.2" />
    </svg>
  );
}
