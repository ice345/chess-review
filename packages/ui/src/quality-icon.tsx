import type { MoveClassification } from "@chess-review/shared";

export type QualityMotif =
  | "twin-glints"
  | "feather-rise"
  | "check"
  | "open-arc"
  | "dot-check"
  | "book"
  | "warm-brush"
  | "single-path"
  | "ripple"
  | "interrupted"
  | "broken-pair"
  | "cross"
  | "falling"
  | "fractured";

export interface QualityMeta {
  ink: string;
  wash: string;
  symbol: string;
  motif: QualityMotif;
  label: string;
}

export const QUALITY_META: Record<MoveClassification, QualityMeta> = {
  brilliant: { ink: "#4d93a6", wash: "#dceef2", symbol: "!!", motif: "twin-glints", label: "Brilliant" },
  great: { ink: "#7188b6", wash: "#e5e7f2", symbol: "!", motif: "feather-rise", label: "Great" },
  best: { ink: "#568d82", wash: "#deece7", symbol: "✓", motif: "check", label: "Best" },
  excellent: { ink: "#789b87", wash: "#e5eee5", symbol: "+", motif: "open-arc", label: "Excellent" },
  good: { ink: "#8b9f8a", wash: "#edf0e6", symbol: "·✓", motif: "dot-check", label: "Good" },
  book: { ink: "#887ba2", wash: "#ece7f0", symbol: "", motif: "book", label: "Book" },
  interesting: { ink: "#a58658", wash: "#f1e6d3", symbol: "!?", motif: "warm-brush", label: "Interesting" },
  forced: { ink: "#71838c", wash: "#e5ebeb", symbol: "→", motif: "single-path", label: "Forced" },
  inaccuracy: { ink: "#ae9349", wash: "#f3e9c9", symbol: "?!", motif: "ripple", label: "Inaccuracy" },
  mistake: { ink: "#b8755d", wash: "#f1ddd4", symbol: "?", motif: "interrupted", label: "Mistake" },
  blunder: { ink: "#a95567", wash: "#f0dbe1", symbol: "??", motif: "broken-pair", label: "Blunder" },
  miss: { ink: "#9e5768", wash: "#efdce2", symbol: "×", motif: "cross", label: "Miss" },
  missed_win: { ink: "#a15f73", wash: "#efdee5", symbol: "↘", motif: "falling", label: "Missed win" },
  missed_mate: { ink: "#87495f", wash: "#ead6de", symbol: "#?", motif: "fractured", label: "Missed mate" },
};

export interface QualityIconProps {
  classification: MoveClassification;
  size?: number;
  title?: string;
}

function Motif({ motif, ink }: { motif: QualityMotif; ink: string }) {
  const props = { fill: "none", stroke: ink, strokeWidth: 1.45, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (motif) {
    case "twin-glints":
      return <><path {...props} d="M5 23c5-1 9-5 11-12" /><path {...props} d="m21 5 .7 2.3L24 8l-2.3.7L21 11l-.7-2.3L18 8l2.3-.7zM27 12l.5 1.5L29 14l-1.5.5L27 16l-.5-1.5L25 14l1.5-.5z" /></>;
    case "feather-rise":
      return <><path {...props} d="M7 25C13 21 17 13 23 5c1 7-2 13-9 17" /><path {...props} d="m14 18 6-2M17 13l5-2" /></>;
    case "check":
      return <path {...props} strokeWidth="2" d="m6 17 6 6L26 8" />;
    case "open-arc":
      return <><path {...props} d="M6 22C8 10 17 5 26 10" /><path {...props} d="m20 21 4-4" /></>;
    case "dot-check":
      return <><circle cx="7" cy="21" r="1.7" fill={ink} /><path {...props} d="m11 18 4 4 10-11" /></>;
    case "book":
      return <><path {...props} d="M5 9c5-2 8 0 11 3v14c-3-3-6-4-11-2zM27 9c-5-2-8 0-11 3v14c3-3 6-4 11-2z" /><path {...props} d="M16 12v14" /></>;
    case "warm-brush":
      return <><path {...props} strokeWidth="4" opacity=".45" d="M6 23 25 8" /><path {...props} d="M10 8c4 2 7 2 11 0" /></>;
    case "single-path":
      return <><path {...props} strokeWidth="1.9" d="M5 16h20" /><path {...props} d="m21 11 5 5-5 5" /></>;
    case "ripple":
      return <><path {...props} d="M5 22c5-3 9-3 14 0M8 26c4-2 7-2 11 0" /><path {...props} d="M21 6c4 2 4 7 1 10" /></>;
    case "interrupted":
      return <><path {...props} strokeWidth="2" d="M8 9c4-4 13-3 14 3 .5 4-4 5-6 7" /><path {...props} d="M16 26h.1" /></>;
    case "broken-pair":
      return <><path {...props} strokeWidth="2" d="M5 9c3-3 8-2 8 2 0 3-3 4-4 6M19 8c4-2 8 0 7 4-.5 2-3 3-4 5" /><path {...props} d="m8 24 3-2M21 24l4-3" /></>;
    case "cross":
      return <><path {...props} strokeWidth="2" d="M7 8 24 25M24 7 8 24" /><path {...props} opacity=".45" d="m5 18 3 1M23 13l4-1" /></>;
    case "falling":
      return <><path {...props} d="M6 8c7 2 12 7 18 17" /><path {...props} d="m18 23 6 2-1-6" /><circle cx="8" cy="8" r="1.5" fill={ink} opacity=".55" /></>;
    case "fractured":
      return <><path {...props} strokeWidth="2" d="M8 7v18M4 13h9M20 7c5 1 7 6 3 10l-3 2" /><path {...props} d="m17 24 3-3 3 4" /></>;
  }
}

/** Project-owned Feather Annotation icon: open wash, asymmetric ink and a distinct silhouette. */
export function QualityIcon({ classification, size = 28, title }: QualityIconProps) {
  const meta = QUALITY_META[classification];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title ?? meta.label}>
      <title>{title ?? meta.label}</title>
      <path d="M4 21C8 9 18 4 28 9" fill="none" stroke={meta.wash} strokeWidth="8" strokeLinecap="round" opacity=".78" />
      <Motif motif={meta.motif} ink={meta.ink} />
      {meta.symbol && (
        <text x="16" y="19.5" textAnchor="middle" fontSize="8.7" fontWeight="760" fill={meta.ink} fontFamily="ui-rounded, system-ui, sans-serif">
          {meta.symbol}
        </text>
      )}
    </svg>
  );
}
