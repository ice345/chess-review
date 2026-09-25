import type { MoveClassification, UiLanguage } from "@chess-review/shared";
import { QualityIcon, qualityLabel } from "./quality-icon";

export interface BoardQualityBadgeProps {
  square: string;
  orientation: "white" | "black";
  classification: MoveClassification;
  language?: UiLanguage;
}

export function BoardQualityBadge({ square, orientation, classification, language = "en" }: BoardQualityBadgeProps) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  const label = qualityLabel(classification, language);

  return (
    <div
      className="board-quality-badge"
      style={{ left: `${column * 12.5}%`, top: `${row * 12.5}%` }}
      aria-label={label}
    >
      <QualityIcon classification={classification} language={language} title={label} />
    </div>
  );
}
