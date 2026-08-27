"use client";

import Link from "next/link";
import type { GameAnalysisV2, GamePhase, MoveAnnotation, MoveQuality } from "@chess-review/shared";
import { QualityIcon, QUALITY_META } from "@chess-review/ui";

const PHASES: Array<{ key: GamePhase; label: string }> = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

const QUALITY_ORDER: MoveQuality[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];
const ANNOTATION_ORDER: MoveAnnotation[] = ["brilliant", "critical", "book", "forced", "sacrifice", "missed_win", "missed_mate"];
const ANNOTATION_LABEL: Record<MoveAnnotation, string> = {
  brilliant: "Brilliant",
  critical: "Critical",
  book: "Book",
  forced: "Forced",
  sacrifice: "Sacrifice",
  missed_win: "Missed win",
  missed_mate: "Missed mate",
};

function accuracy(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(1);
}

export function ReviewOverview({
  analysis,
  onSelectPly,
  allMomentsHref,
}: {
  analysis: GameAnalysisV2;
  onSelectPly: (ply: number) => void;
  allMomentsHref?: string;
}) {
  const counts = QUALITY_ORDER.flatMap((quality) => {
    const white = analysis.white.qualityCounts[quality];
    const black = analysis.black.qualityCounts[quality];
    return white + black > 0 ? [{ quality, white, black }] : [];
  });
  const annotations = ANNOTATION_ORDER.flatMap((annotation) => {
    const white = analysis.white.annotationCounts[annotation] ?? 0;
    const black = analysis.black.annotationCounts[annotation] ?? 0;
    return white + black > 0 ? [{ annotation, white, black }] : [];
  });

  return (
    <div className="overview-tab">
      <div className="overview-opening">
        <div className="eyebrow">OPENING</div>
        <strong>{analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : "Unknown position"}</strong>
        {analysis.opening?.variation && <span>{analysis.opening.variation}</span>}
      </div>

      <div className="accuracy-table">
        <div className="accuracy-head"><span /><strong>White</strong><strong>Black</strong></div>
        <div className="accuracy-row overall"><span>Overall</span><strong>{accuracy(analysis.white.accuracy)}</strong><strong>{accuracy(analysis.black.accuracy)}</strong></div>
        {PHASES.map(({ key, label }) => (
          <div className="accuracy-row" key={key}>
            <span>{label}</span>
            <strong>{accuracy(analysis.white.phaseAccuracy[key])}</strong>
            <strong>{accuracy(analysis.black.phaseAccuracy[key])}</strong>
          </div>
        ))}
      </div>

      <div className="classification-summary">
        <div className="eyebrow">MOVE QUALITY</div>
        <div className="classification-heading"><span /><span /><strong>White</strong><strong>Black</strong></div>
        {counts.map(({ quality, white, black }) => (
          <div className="classification-count" key={quality}>
            <QualityIcon classification={quality} size={23} />
            <span>{QUALITY_META[quality].label}</span>
            <strong>{white}</strong>
            <strong>{black}</strong>
          </div>
        ))}
      </div>

      {annotations.length > 0 && <div className="annotation-summary">
        <div className="eyebrow">ANNOTATIONS</div>
        <div className="annotation-heading"><span /><strong>White</strong><strong>Black</strong></div>
        {annotations.map(({ annotation, white, black }) => <div className="annotation-count" key={annotation}><span>{ANNOTATION_LABEL[annotation]}</span><strong>{white}</strong><strong>{black}</strong></div>)}
      </div>}

      {analysis.division.middlePly === undefined && (
        <p className="phase-note">This game never crossed the structural middlegame boundary, so phase Accuracy is intentionally omitted.</p>
      )}

      <div className="critical-list">
        <div className="eyebrow">CRITICAL MOMENTS</div>
        {analysis.criticalMoments.length === 0 ? (
          <p className="quiet-empty">No critical swing crossed the current thresholds.</p>
        ) : analysis.criticalMoments.slice(0, 3).map((critical) => {
          const move = analysis.moves[critical.ply - 1];
          if (!move) return null;
          return (
            <button type="button" key={critical.ply} onClick={() => onSelectPly(critical.ply)}>
              <QualityIcon classification={critical.classification} size={25} />
              <span>{Math.ceil(critical.ply / 2)}{move.color === "white" ? "." : "…"} {move.san}</span>
              <strong>−{critical.winPercentSwing.toFixed(1)}%</strong>
            </button>
          );
        })}
        {analysis.criticalMoments.length > 3 && allMomentsHref && <Link className="view-all-moments" href={allMomentsHref}>View all {analysis.criticalMoments.length} moments →</Link>}
      </div>
    </div>
  );
}

export function ReviewMoves({
  analysis,
  currentPly,
  onSelectPly,
  filter = "all",
}: {
  analysis: GameAnalysisV2;
  currentPly: number;
  onSelectPly: (ply: number) => void;
  filter?: "all" | "critical" | "errors";
}) {
  const criticalPlies = new Set(analysis.criticalMoments.map((moment) => moment.ply));
  const moves = analysis.moves.filter((move) => (
    filter === "all"
    || (filter === "critical" && criticalPlies.has(move.ply))
    || (filter === "errors" && (["inaccuracy", "mistake", "blunder"] as MoveQuality[]).includes(move.quality)
      || move.annotations.includes("missed_win")
      || move.annotations.includes("missed_mate"))
  ));
  return (
    <div className="review-move-list">
      {moves.length === 0 && <p className="quiet-empty">No moves match this filter.</p>}
      {moves.map((move) => (
        <button type="button" className={move.ply === currentPly ? "active" : ""} key={move.ply} onClick={() => onSelectPly(move.ply)}>
          <span className="move-number">{Math.ceil(move.ply / 2)}{move.color === "white" ? "." : "…"}</span>
          <QualityIcon classification={move.classification} size={24} />
          <strong>{move.san}</strong>
          <span className="move-quality" title={move.annotations.length === 0 ? "No special annotations" : `Annotations: ${move.annotations.map((annotation) => ANNOTATION_LABEL[annotation]).join(", ")}`}>{QUALITY_META[move.quality].label}</span>
          <small>{move.accuracy.toFixed(0)}</small>
        </button>
      ))}
    </div>
  );
}
