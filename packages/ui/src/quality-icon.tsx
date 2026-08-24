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

/** Project-owned watercolor annotation seal; no third-party trademark assets. */
export function QualityIcon({ classification, size = 28, title }: QualityIconProps) {
  const meta = QUALITY_META[classification];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title ?? classification}>
      <title>{title ?? classification}</title>
      <path d="M5.7 10.2C8.2 4.8 15 2.4 21 4.8c5.6 2.2 8.4 8.4 6.2 14.2-1.8 4.8-6.5 8.3-11.5 8.2-4.9-.1-9.4-3.4-10.8-8" fill={meta.color} opacity=".09" />
      <path d="M5.7 10.2C8.2 4.8 15 2.4 21 4.8c5.6 2.2 8.4 8.4 6.2 14.2-1.8 4.8-6.5 8.3-11.5 8.2-4.9-.1-9.4-3.4-10.8-8" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.2 7.9c4.2-3.1 10.2-3.4 14.3-.4M25.7 22.2c-2.7 3.2-7 4.7-11.2 4.1" fill="none" stroke={meta.color} strokeWidth=".8" strokeLinecap="round" opacity=".5" />
      <circle cx="6.1" cy="17.1" r=".9" fill={meta.color} opacity=".62" />
      <text x="16" y="19.8" textAnchor="middle" fontSize="10.2" fontWeight="760" fill="#3d5661" fontFamily="ui-rounded, system-ui, sans-serif">
        {meta.symbol}
      </text>
    </svg>
  );
}
