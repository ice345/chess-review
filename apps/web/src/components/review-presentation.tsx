"use client";

import Link from "next/link";
import type { GameAnalysisV2, GamePhase, MoveQuality } from "@chess-review/shared";
import { classificationForAnnotation, QualityIcon, QUALITY_META } from "@chess-review/ui";
import { ANNOTATION_LABEL, ANNOTATION_ORDER, displayedMoveQualityLabel } from "../lib/move-quality-label";

const PHASES: Array<{ key: GamePhase; label: string }> = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

const QUALITY_ORDER: MoveQuality[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

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
        {PHASES.map(({ key, label }) => {
          const openingOnly = analysis.division.middlePly === undefined;
          const white = key === "opening" && openingOnly
            ? analysis.white.phaseAccuracy.opening ?? analysis.white.accuracy
            : analysis.white.phaseAccuracy[key];
          const black = key === "opening" && openingOnly
            ? analysis.black.phaseAccuracy.opening ?? analysis.black.accuracy
            : analysis.black.phaseAccuracy[key];
          return (
            <div className="accuracy-row" key={key}>
              <span>{label}</span>
              <strong>{accuracy(white)}</strong>
              <strong>{accuracy(black)}</strong>
            </div>
          );
        })}
      </div>

      <div className="classification-summary">
        <div className="eyebrow">MOVE QUALITY</div>
        <div className="classification-heading"><span /><span /><strong>White</strong><strong>Black</strong></div>
        {counts.map(({ quality, white, black }) => (
          <div className="classification-count" key={quality}>
            <QualityIcon classification={quality} size={23} decorative />
            <span>{QUALITY_META[quality].label}</span>
            <strong>{white}</strong>
            <strong>{black}</strong>
          </div>
        ))}
      </div>

      {annotations.length > 0 && <div className="annotation-summary">
        <div className="eyebrow">ANNOTATIONS</div>
        <div className="annotation-heading"><span /><span /><strong>White</strong><strong>Black</strong></div>
        {annotations.map(({ annotation, white, black }) => (
          <div className="annotation-count" key={annotation}>
            <QualityIcon classification={classificationForAnnotation(annotation)} size={23} decorative title={ANNOTATION_LABEL[annotation]} />
            <span>{ANNOTATION_LABEL[annotation]}</span>
            <strong>{white}</strong>
            <strong>{black}</strong>
          </div>
        ))}
      </div>}

      {analysis.division.middlePly === undefined && (
        <p className="phase-note">This game stayed in the opening structurally. Opening Accuracy matches overall Accuracy; middlegame and endgame remain omitted.</p>
      )}

      <div className="critical-list">
        <div className="eyebrow">CRITICAL MOMENTS</div>
        {analysis.criticalMoments.length === 0 ? (
          <p className="quiet-empty">No critical swing crossed the current thresholds.</p>
        ) : analysis.criticalMoments.slice(0, 3).map((critical) => {
          const move = analysis.moves[critical.ply - 1];
          if (!move) return null;
          const swing = critical.winPercentSwing;
          const iconClassification = move.annotations.includes("critical") ? "great" : critical.classification;
          return (
            <button
              type="button"
              key={critical.ply}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                onSelectPly(critical.ply);
                event.currentTarget.closest(".context-panel")?.scrollTo({ top: 0 });
              }}
            >
              <QualityIcon classification={iconClassification} size={25} title="Critical" />
              <span>{Math.ceil(critical.ply / 2)}{move.color === "white" ? "." : "…"} {move.san}</span>
              <strong className={swing > 0 ? "critical-loss" : "critical-quiet"}>
                {swing > 0 ? `−${swing.toFixed(1)}%` : "Only reasonable move"}
              </strong>
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
          <span className="move-quality" title={move.annotations.length === 0 ? QUALITY_META[move.quality].label : `Annotations: ${move.annotations.map((annotation) => ANNOTATION_LABEL[annotation]).join(", ")}`}>
            {displayedMoveQualityLabel(move)}
          </span>
          <small>{move.accuracy.toFixed(0)}</small>
        </button>
      ))}
    </div>
  );
}
