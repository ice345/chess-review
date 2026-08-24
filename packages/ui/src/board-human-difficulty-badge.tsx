import type { HumanFindDifficultyLabel } from "@chess-review/shared";
import { HumanDifficultyMark, HUMAN_DIFFICULTY_META } from "./human-difficulty-mark";

export function BoardHumanDifficultyBadge({
  square,
  orientation,
  difficulty,
}: {
  square: string;
  orientation: "white" | "black";
  difficulty: HumanFindDifficultyLabel;
}) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;

  return (
    <div
      className="board-human-difficulty-badge"
      style={{ left: column * 12.5 + "%", top: row * 12.5 + "%" }}
      aria-label={HUMAN_DIFFICULTY_META[difficulty].label + " to find on " + square}
    >
      <HumanDifficultyMark difficulty={difficulty} size={28} />
    </div>
  );
}
