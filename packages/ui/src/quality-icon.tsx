import type { MoveAnnotation, MoveClassification, UiLanguage } from "@chess-review/shared";

export type QualityMotif =
  | "diamond-double"
  | "diamond-single"
  | "circle-solid-check"
  | "circle-double-check"
  | "circle-check"
  | "square-book"
  | "square-interesting"
  | "square-forced"
  | "ring-inaccuracy"
  | "square-mistake"
  | "octagon-blunder"
  | "circle-miss"
  | "diamond-missed-win"
  | "octagon-missed-mate";

export interface QualityMeta {
  ink: string;
  wash: string;
  symbol: string;
  motif: QualityMotif;
}

/**
 * The marks only. The name of a classification is language-dependent and lives in
 * `QUALITY_LABELS`; keeping the two apart is what stops a translated screen from
 * changing the visual identity by accident.
 */
export const QUALITY_META: Record<MoveClassification, QualityMeta> = {
  brilliant: { ink: "#2f7f93", wash: "#d9eef2", symbol: "!!", motif: "diamond-double" },
  great: { ink: "#647ba9", wash: "#e2e7f2", symbol: "!", motif: "diamond-single" },
  best: { ink: "#3f7f73", wash: "#dceae5", symbol: "✓", motif: "circle-solid-check" },
  excellent: { ink: "#668c75", wash: "#e4ece3", symbol: "✓✓", motif: "circle-double-check" },
  good: { ink: "#788c72", wash: "#ebefe5", symbol: "✓", motif: "circle-check" },
  book: { ink: "#786c92", wash: "#eae5ef", symbol: "", motif: "square-book" },
  interesting: { ink: "#9c7a42", wash: "#f2e6cb", symbol: "!?", motif: "square-interesting" },
  forced: { ink: "#647985", wash: "#e5ebec", symbol: "→", motif: "square-forced" },
  inaccuracy: { ink: "#a18739", wash: "#f4e8be", symbol: "?!", motif: "ring-inaccuracy" },
  mistake: { ink: "#b26e4d", wash: "#f2ddd2", symbol: "?", motif: "square-mistake" },
  blunder: { ink: "#a34e5b", wash: "#f0d9de", symbol: "??", motif: "octagon-blunder" },
  miss: { ink: "#985263", wash: "#eedce1", symbol: "×", motif: "circle-miss" },
  missed_win: { ink: "#95566a", wash: "#eddfe5", symbol: "↘", motif: "diamond-missed-win" },
  missed_mate: { ink: "#7f4459", wash: "#e8d6de", symbol: "#?", motif: "octagon-missed-mate" },
};

/**
 * Classification names, per interface language.
 *
 * This is product vocabulary, not screen copy: the board badge, the move list, the
 * evaluation graph, the summary and the PNG export all name the same classification.
 * One table keeps them from drifting apart, the same way one table holds the marks.
 *
 * `great` is named "Critical" on purpose - the label follows the classification's
 * meaning (a critical/only move), not the internal key. See docs/move-classification.md.
 */
export const QUALITY_LABELS: Record<UiLanguage, Record<MoveClassification, string>> = {
  en: {
    brilliant: "Brilliant", great: "Critical", best: "Best", excellent: "Excellent",
    good: "Good", book: "Book", interesting: "Interesting", forced: "Forced",
    inaccuracy: "Inaccuracy", mistake: "Mistake", blunder: "Blunder", miss: "Miss",
    missed_win: "Missed win", missed_mate: "Missed mate",
  },
  "zh-CN": {
    brilliant: "精彩", great: "关键", best: "最佳", excellent: "优秀",
    good: "良好", book: "定式", interesting: "有趣", forced: "强制",
    inaccuracy: "不精确", mistake: "失误", blunder: "漏着", miss: "错过",
    missed_win: "错过胜机", missed_mate: "错过杀棋",
  },
};

export function qualityLabel(classification: MoveClassification, language: UiLanguage): string {
  return QUALITY_LABELS[language][classification];
}

/**
 * The move annotations, per interface language.
 *
 * Separate from `QUALITY_LABELS` because an annotation is not a classification: a
 * move can carry a sacrifice or a missed win *in addition to* its quality, and the
 * move list, the evidence sentence and the export all name them. `critical` here is
 * the annotation, which is not the same value as the `great` classification.
 */
export const ANNOTATION_LABELS: Record<UiLanguage, Record<MoveAnnotation, string>> = {
  en: {
    brilliant: "Brilliant", critical: "Critical", book: "Book", forced: "Forced",
    sacrifice: "Sacrifice", missed_win: "Missed win", missed_mate: "Missed mate",
  },
  "zh-CN": {
    brilliant: "精彩", critical: "关键", book: "定式", forced: "强制",
    sacrifice: "弃子", missed_win: "错过胜机", missed_mate: "错过杀棋",
  },
};

export function annotationLabel(annotation: MoveAnnotation, language: UiLanguage): string {
  return ANNOTATION_LABELS[language][annotation];
}

export interface QualityIconProps {
  classification: MoveClassification;
  size?: number;
  title?: string;
  decorative?: boolean;
  /** Which language the accessible name uses. The marks themselves do not change. */
  language?: UiLanguage;
}

const textStyle = {
  fontFamily: "ui-rounded, system-ui, sans-serif",
  fontWeight: 800,
  textAnchor: "middle" as const,
};

function Diamond({ ink, wash, inset = false }: { ink: string; wash: string; inset?: boolean }) {
  return <path d={inset ? "M16 4 28 16 16 28 4 16Z" : "M16 2.5 29.5 16 16 29.5 2.5 16Z"} fill={wash} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />;
}

function RoundedSquare({ ink, wash }: { ink: string; wash: string }) {
  return <rect x="3.5" y="3.5" width="25" height="25" rx="6" fill={wash} stroke={ink} strokeWidth="1.6" />;
}

function Octagon({ ink, wash }: { ink: string; wash: string }) {
  return <path d="m10 3 12 0 7 7 0 12-7 7H10l-7-7V10Z" fill={wash} stroke={ink} strokeWidth="1.7" strokeLinejoin="round" />;
}

function Motif({ motif, ink, wash }: { motif: QualityMotif; ink: string; wash: string }) {
  const stroke = { fill: "none", stroke: ink, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (motif) {
    case "diamond-double":
      return <><Diamond ink={ink} wash={wash} /><text {...textStyle} x="15.5" y="19.2" fontSize="8.6" fill={ink}>!!</text><path d="m25.5 3 .65 1.85L28 5.5l-1.85.65L25.5 8l-.65-1.85L23 5.5l1.85-.65Z" fill={ink} /></>;
    case "diamond-single":
      return <><Diamond ink={ink} wash={wash} inset /><text {...textStyle} x="16" y="20.2" fontSize="11" fill={ink}>!</text><path d="m25.5 5 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z" fill={ink} /></>;
    case "circle-solid-check":
      return <><circle cx="16" cy="16" r="13.2" fill={ink} /><path d="m9 16.5 4.4 4.4L23.5 10.8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>;
    case "circle-double-check":
      return <><circle cx="16" cy="16" r="13" fill={wash} stroke={ink} strokeWidth="1.7" /><circle cx="16" cy="16" r="9.8" fill="none" stroke={ink} strokeWidth=".8" opacity=".42" /><path {...stroke} d="m7.8 16.5 3.2 3.2 6.3-6.3M14 18.2l2.6 2.6 7.4-8" /></>;
    case "circle-check":
      return <><circle cx="16" cy="16" r="12.5" fill={wash} stroke={ink} strokeWidth="1.6" /><path {...stroke} d="m9.2 16.7 4.2 4.1 9.4-10" /></>;
    case "square-book":
      return <><RoundedSquare ink={ink} wash={wash} /><path {...stroke} strokeWidth="1.45" d="M7.5 10c3.4-1.2 6-.2 8.5 2.1V24c-2.5-2.2-5.1-3.1-8.5-1.9Zm17 0c-3.4-1.2-6-.2-8.5 2.1V24c2.5-2.2 5.1-3.1 8.5-1.9ZM16 12.1V24" /></>;
    case "square-interesting":
      return <><RoundedSquare ink={ink} wash={wash} /><text {...textStyle} x="16" y="19.5" fontSize="8.5" fill={ink}>!?</text></>;
    case "square-forced":
      return <><RoundedSquare ink={ink} wash={wash} /><path {...stroke} d="M8 16h15m-5-5 5 5-5 5" /></>;
    case "ring-inaccuracy":
      return <><circle cx="16" cy="16" r="12.8" fill={wash} stroke={ink} strokeWidth="1.7" /><circle cx="16" cy="16" r="9.8" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 2.4" opacity=".55" /><text {...textStyle} x="16" y="19.2" fontSize="8" fill={ink}>?!</text></>;
    case "square-mistake":
      return <><RoundedSquare ink={ink} wash={wash} /><text {...textStyle} x="16" y="20.5" fontSize="12" fill={ink}>?</text></>;
    case "octagon-blunder":
      return <><Octagon ink={ink} wash={wash} /><text {...textStyle} x="16" y="19.2" fontSize="8.2" fill={ink}>??</text></>;
    case "circle-miss":
      return <><circle cx="16" cy="16" r="12.7" fill={wash} stroke={ink} strokeWidth="1.7" /><path {...stroke} strokeWidth="2.4" d="m10.5 10.5 11 11m0-11-11 11" /></>;
    case "diamond-missed-win":
      return <><Diamond ink={ink} wash={wash} inset /><path {...stroke} d="M9 9.5c4.2 1.8 7.4 5.2 12.2 11.8m-5.8-1.1 5.8 1.1-1.2-5.8" /></>;
    case "octagon-missed-mate":
      return <><Octagon ink={ink} wash={wash} /><text {...textStyle} x="16" y="19.2" fontSize="7.5" fill={ink}>#?</text></>;
    default:
      // Every motif is listed above; this keeps the exhaustive union honest if
      // a new motif is added without a renderer.
      return null;
  }
}

export function classificationForAnnotation(annotation: MoveAnnotation): MoveClassification {
  switch (annotation) {
    case "brilliant":
      return "brilliant";
    case "critical":
      return "great";
    case "book":
      return "book";
    case "forced":
      return "forced";
    case "sacrifice":
      return "interesting";
    case "missed_win":
      return "missed_win";
    case "missed_mate":
      return "missed_mate";
  }
}

/** Project-owned Move Quality Annotation System V3, rendered as inline SVG. */
export function QualityIcon({ classification, size = 28, title, decorative = false, language = "en" }: QualityIconProps) {
  const meta = QUALITY_META[classification];
  const label = title ?? qualityLabel(classification, language);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
    >
      {decorative ? null : <title>{label}</title>}
      <Motif motif={meta.motif} ink={meta.ink} wash={meta.wash} />
    </svg>
  );
}
