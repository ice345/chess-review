import type { HumanFindDifficultyLabel, UiLanguage } from "@chess-review/shared";
import { HumanDifficultyMark, HUMAN_DIFFICULTY_LABELS } from "./human-difficulty-mark";

type BadgeCopy = {
  /** "Hard to find on e4" - the badge names the square it sits on. */
  onSquare: (difficulty: string, square: string) => string;
};

const COPY: Record<UiLanguage, BadgeCopy> = {
  en: { onSquare: (difficulty, square) => `${difficulty} to find on ${square}` },
  "zh-CN": { onSquare: (difficulty, square) => `${square} 上：${difficulty}` },
};

export function BoardHumanDifficultyBadge({
  square,
  orientation,
  difficulty,
  language = "en",
}: {
  square: string;
  orientation: "white" | "black";
  difficulty: HumanFindDifficultyLabel;
  language?: UiLanguage;
}) {
  const copy = COPY[language];
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;

  return (
    <div
      className="board-human-difficulty-badge"
      style={{ left: column * 12.5 + "%", top: row * 12.5 + "%" }}
      aria-label={copy.onSquare(HUMAN_DIFFICULTY_LABELS[language][difficulty], square)}
    >
      <HumanDifficultyMark difficulty={difficulty} size={28} language={language} />
    </div>
  );
}
