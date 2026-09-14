"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef } from "react";
import { formatMoveNumber, type GameAnalysisV2, type GamePhase, type MoveQuality } from "@chess-review/shared";
import { classificationForAnnotation, QualityIcon, QUALITY_META } from "@chess-review/ui";
import { displayPgnComment, importedAnnotations } from "../lib/imported-annotations";
import { useReviewRuntime } from "./review-runtime";
import { useBoardDisplaySettings } from "../hooks/use-board-display-settings";
import { ANNOTATION_LABEL, ANNOTATION_ORDER, displayedMoveQualityLabel, extraMoveAnnotations } from "../lib/move-quality-label";

const PHASES: Array<{ key: GamePhase; label: string }> = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];

const QUALITY_ORDER: MoveQuality[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

/** Conventional PGN glyphs ($1–$6) plus the position-evaluation marks worth showing. */
const NAG_GLYPH: Record<number, string> = { 1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!" };

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
  // Practice hides the solving ply here too: the critical list names the fault
  // and its swing, which is the answer.
  const hiddenPly = useReviewRuntime().retro.hiddenPly;
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
              {/* The overview's critical list also names the fault and its swing. */}
              {hiddenPly === critical.ply
                ? <QualityIcon classification="book" size={25} decorative title="Hidden while solving" />
                : <QualityIcon classification={iconClassification} size={25} title="Critical" />}
              <span>{formatMoveNumber(move.fenBefore, move.color)} {move.san}</span>
              <strong className={swing > 0 ? "critical-loss" : "critical-quiet"}>
                {hiddenPly === critical.ply ? "Hidden while solving" : swing > 0 ? `−${swing.toFixed(1)}%` : "Only reasonable move"}
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
  const hiddenPly = useReviewRuntime().retro.hiddenPly;
  // Emphasis and the "Key" filter share one definition of a key move, so the
  // calmer view can never disagree with what the filter shows.
  const keyOnlyEmphasis = useBoardDisplaySettings().moveEmphasis === "key";
  const listRef = useRef<HTMLDivElement>(null);
  const moves = analysis.moves.filter((move) => (
    filter === "all"
    || (filter === "critical" && criticalPlies.has(move.ply))
    || (filter === "errors" && (["inaccuracy", "mistake", "blunder"] as MoveQuality[]).includes(move.quality)
      || move.annotations.includes("missed_win")
      || move.annotations.includes("missed_mate"))
  ));
  const imported = useMemo(() => importedAnnotations(analysis), [analysis]);
  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("button.active");
    if (!list || !active || !list.closest(".objective-route")) return;
    const listBox = list.getBoundingClientRect();
    const rowBox = active.getBoundingClientRect();
    if (rowBox.top < listBox.top || rowBox.bottom > listBox.bottom) {
      list.scrollTop += rowBox.top - listBox.top - Math.max(0, (list.clientHeight - active.offsetHeight) / 2);
    }
  }, [currentPly, filter, moves.length]);
  return (
    <div className="review-move-list" ref={listRef}>
      {moves.length === 0 && <p className="quiet-empty">No moves match this filter.</p>}
      {moves.map((move) => {
        const annotation = imported?.plies[move.ply - 1];
        const glyphs = (annotation?.nags ?? []).flatMap((nag) => NAG_GLYPH[nag] ?? []);
        const variations = (annotation?.variations ?? []).flatMap((variation) => {
          const visible = displayPgnComment(variation);
          return visible === undefined ? [] : [visible];
        });
        const comment = displayPgnComment(annotation?.comment);
        const extras = hiddenPly === move.ply ? [] : extraMoveAnnotations(move);
        return (
          <button
            type="button"
            className={move.ply === currentPly ? "active" : ""}
            data-emphasis={keyOnlyEmphasis && !criticalPlies.has(move.ply) ? "quiet" : undefined}
            key={move.ply}
            onClick={() => onSelectPly(move.ply)}
          >
            <span className="move-number">{formatMoveNumber(move.fenBefore, move.color)}</span>
            {hiddenPly === move.ply
              ? <QualityIcon classification="book" size={24} decorative title="Hidden while solving" />
              : <QualityIcon classification={move.classification} size={24} />}
            <strong>{move.san}</strong>
            <span className="move-quality" data-practice-hidden={hiddenPly === move.ply ? "true" : undefined} title={hiddenPly === move.ply ? "Hidden while solving" : move.annotations.length === 0 ? QUALITY_META[move.quality].label : `Annotations: ${move.annotations.map((item) => ANNOTATION_LABEL[item]).join(", ")}`}>
              {glyphs.length > 0 && <span className="move-imported-glyph">{glyphs.join("")}</span>}
              {hiddenPly === move.ply ? "Hidden while solving" : displayedMoveQualityLabel(move)}
              {extras.map((item) => (
                <QualityIcon classification={classificationForAnnotation(item)} size={20} key={item} title={ANNOTATION_LABEL[item]} />
              ))}
            </span>
            <small>{hiddenPly === move.ply ? "—" : move.accuracy.toFixed(0)}</small>
            {comment !== undefined && <span className="move-imported-comment">{comment}</span>}
            {variations.length > 0 && <span className="move-imported-variation">{variations.join(" ")}</span>}
          </button>
        );
      })}
    </div>
  );
}
