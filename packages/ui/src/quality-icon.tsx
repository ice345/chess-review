import type { MoveClassification } from "@chess-review/shared";

export const QUALITY_META: Record<MoveClassification, { color: string; symbol: string; label: string }> = {
  brilliant: { color: "#4fa6a3", symbol: "!!", label: "Brilliant" },
  great: { color: "#6c86b8", symbol: "!", label: "Great" },
  best: { color: "#6e9c80", symbol: "★", label: "Best" },
  excellent: { color: "#85aa8d", symbol: "+", label: "Excellent" },
  good: { color: "#96a78d", symbol: "✓", label: "Good" },
  book: { color: "#9e8db0", symbol: "▤", label: "Book" },
  interesting: { color: "#bd9461", symbol: "!?", label: "Interesting" },
  forced: { color: "#7f8d98", symbol: "□", label: "Forced" },
  inaccuracy: { color: "#c5a34d", symbol: "?!", label: "Inaccuracy" },
  mistake: { color: "#c77d5a", symbol: "?", label: "Mistake" },
  blunder: { color: "#b85e64", symbol: "??", label: "Blunder" },
  miss: { color: "#aa5361", symbol: "×", label: "Miss" },
  missed_win: { color: "#aa5361", symbol: "↘", label: "Missed win" },
  missed_mate: { color: "#8e4656", symbol: "#?", label: "Missed mate" },
};

export interface QualityIconProps {
  classification: MoveClassification;
  size?: number;
  title?: string;
}

/** Project-owned annotation language; no third-party trademark assets. */
export function QualityIcon({ classification, size = 28, title }: QualityIconProps) {
  const meta = QUALITY_META[classification];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title ?? classification}>
      <title>{title ?? classification}</title>
      <path d="M5.2 10.1c1.9-5.6 8.9-8.4 15-6.1 6.3 2.3 9.1 9.2 6.3 15.1-2.9 6.1-10 9.8-16.3 7.2C3.9 23.7 3 16.5 5.2 10.1Z" fill={meta.color} opacity=".86" />
      <path d="M8.5 7.5c4.1-3 10.9-2.5 14.4 1.7 3.2 3.9 2.5 10.4-1.6 13.7-4 3.1-10.6 2.7-14-1.3-3.5-4.2-2.9-11.2 1.2-14.1Z" fill={meta.color} opacity=".38" transform="rotate(8 16 16)" />
      <path d="M6.7 17.6c3.8 6.1 12.9 7.9 19.1 2.8" fill="none" stroke="rgba(255,255,255,.48)" strokeWidth="1.1" strokeLinecap="round" />
      <text x="16" y="20.1" textAnchor="middle" fontSize="10.5" fontWeight="750" fill="#fffdf8" fontFamily="ui-rounded, system-ui, sans-serif">
        {meta.symbol}
      </text>
    </svg>
  );
}
