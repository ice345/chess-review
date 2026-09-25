import type { HumanFindDifficultyLabel, UiLanguage } from "@chess-review/shared";

export const HUMAN_DIFFICULTY_META: Record<HumanFindDifficultyLabel, {
  symbol: string;
  ink: string;
  wash: string;
}> = {
  natural: { symbol: "≈", ink: "#718f7b", wash: "#e5eee7" },
  findable: { symbol: "◇", ink: "#6f929b", wash: "#e1edf0" },
  hard: { symbol: "△", ink: "#817d9b", wash: "#ebe7f0" },
  "very-hard": { symbol: "✧", ink: "#786d9d", wash: "#e8e3f1" },
  exceptional: { symbol: "✦", ink: "#695a91", wash: "#e5dff0" },
};

/**
 * The names of the Maia find-difficulty bands, per interface language.
 *
 * This is an experimental label, not an Elo measurement - see docs/human-analysis.md -
 * so the wording stays descriptive in both languages rather than pretending to be a rating.
 */
export const HUMAN_DIFFICULTY_LABELS: Record<UiLanguage, Record<HumanFindDifficultyLabel, string>> = {
  en: {
    natural: "Natural", findable: "Findable", hard: "Hard",
    "very-hard": "Very Hard", exceptional: "Exceptional",
  },
  "zh-CN": {
    natural: "自然", findable: "可发现", hard: "困难",
    "very-hard": "很难", exceptional: "极难",
  },
};

/** "Maia human difficulty: Hard" - the prefix is the mark's accessible name. */
const MARK_PREFIX: Record<UiLanguage, string> = {
  en: "Maia human difficulty",
  "zh-CN": "Maia 人类难度",
};
/** The full-width colon is the Chinese convention; the Latin one needs a space. */
const MARK_SEPARATOR: Record<UiLanguage, string> = { en: ": ", "zh-CN": "：" };

export function HumanDifficultyMark({
  difficulty,
  size = 28,
  language = "en",
}: {
  difficulty: HumanFindDifficultyLabel;
  size?: number;
  language?: UiLanguage;
}) {
  const meta = HUMAN_DIFFICULTY_META[difficulty];
  const label = `${MARK_PREFIX[language]}${MARK_SEPARATOR[language]}${HUMAN_DIFFICULTY_LABELS[language][difficulty]}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={label}>
      <title>{label}</title>
      <path d="M6 22c5-9 12-13 21-11" fill="none" stroke={meta.wash} strokeWidth="7" strokeLinecap="round" />
      <path d="M7 24c5-8 12-12 20-12" fill="none" stroke={meta.ink} strokeWidth="1.15" strokeLinecap="round" opacity=".65" />
      <text x="17" y="20" textAnchor="middle" fontSize="13" fontWeight="700" fill={meta.ink} fontFamily="Georgia, serif">{meta.symbol}</text>
    </svg>
  );
}
