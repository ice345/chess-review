import type { HumanFindDifficultyLabel } from "@chess-review/shared";

export const HUMAN_DIFFICULTY_META: Record<HumanFindDifficultyLabel, {
  symbol: string;
  label: string;
  ink: string;
  wash: string;
}> = {
  natural: { symbol: "≈", label: "Natural", ink: "#718f7b", wash: "#e5eee7" },
  findable: { symbol: "◇", label: "Findable", ink: "#6f929b", wash: "#e1edf0" },
  hard: { symbol: "△", label: "Hard", ink: "#817d9b", wash: "#ebe7f0" },
  "very-hard": { symbol: "✧", label: "Very Hard", ink: "#786d9d", wash: "#e8e3f1" },
  exceptional: { symbol: "✦", label: "Exceptional", ink: "#695a91", wash: "#e5dff0" },
};

export function HumanDifficultyMark({
  difficulty,
  size = 28,
}: {
  difficulty: HumanFindDifficultyLabel;
  size?: number;
}) {
  const meta = HUMAN_DIFFICULTY_META[difficulty];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={"Maia human difficulty: " + meta.label}>
      <title>{"Maia human difficulty: " + meta.label}</title>
      <path d="M6 22c5-9 12-13 21-11" fill="none" stroke={meta.wash} strokeWidth="7" strokeLinecap="round" />
      <path d="M7 24c5-8 12-12 20-12" fill="none" stroke={meta.ink} strokeWidth="1.15" strokeLinecap="round" opacity=".65" />
      <text x="17" y="20" textAnchor="middle" fontSize="13" fontWeight="700" fill={meta.ink} fontFamily="Georgia, serif">{meta.symbol}</text>
    </svg>
  );
}
