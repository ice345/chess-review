"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef } from "react";
import { formatMoveNumber, type GameAnalysisV2, type GamePhase, type MoveQuality, type UiLanguage } from "@chess-review/shared";
import { annotationLabel, classificationForAnnotation, phaseLabel, QualityIcon, qualityLabel } from "@chess-review/ui";
import { displayPgnComment, importedAnnotations } from "../lib/imported-annotations";
import { useWithheldPly } from "./review-session-state";
import { useBoardDisplaySettings } from "../hooks/use-board-display-settings";
import { ANNOTATION_ORDER, extraMoveAnnotations } from "../lib/move-quality-label";
import { useUiLanguage } from "../hooks/use-ui-language";

const PHASES: GamePhase[] = ["opening", "middlegame", "endgame"];

const QUALITY_ORDER: MoveQuality[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

/** Conventional PGN glyphs ($1–$6) plus the position-evaluation marks worth showing. */
const NAG_GLYPH: Record<number, string> = { 1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!" };

type PresentationCopy = {
  openingEyebrow: string;
  unknownPosition: string;
  white: string;
  black: string;
  overall: string;
  byQuality: string;
  annotationsEyebrow: string;
  annotationsTitle: (labels: string[]) => string;
  phaseNote: string;
  keyMoments: string;
  noSwing: string;
  hidden: string;
  onlyReasonable: string;
  viewAllMoments: (count: number) => string;
  legend: string;
  noMoves: string;
  accuracy: (value: string) => string;
  accuracySr: string;
};

const COPY: Record<UiLanguage, PresentationCopy> = {
  en: {
    openingEyebrow: "OPENING",
    unknownPosition: "Unknown position",
    white: "White",
    black: "Black",
    overall: "Overall",
    byQuality: "By quality",
    annotationsEyebrow: "ANNOTATIONS",
    annotationsTitle: (labels) => `Annotations: ${labels.join(", ")}`,
    phaseNote: "This game stayed in the opening structurally. Opening Accuracy matches overall Accuracy; middlegame and endgame remain omitted.",
    keyMoments: "KEY MOMENTS",
    noSwing: "No swing crossed the current thresholds.",
    hidden: "Hidden while solving",
    onlyReasonable: "Only reasonable move",
    viewAllMoments: (count) => `View all ${count} moments \u2192`,
    legend: "Quality \u00b7 Accuracy",
    noMoves: "No moves match this filter.",
    accuracy: (value) => `Accuracy ${value}`,
    accuracySr: "Accuracy ",
  },
  "zh-CN": {
    openingEyebrow: "开局",
    unknownPosition: "未知局面",
    white: "白方",
    black: "黑方",
    overall: "总体",
    byQuality: "按质量",
    annotationsEyebrow: "注解",
    annotationsTitle: (labels) => `注解：${labels.join("、")}`,
    phaseNote: "本局在结构上仍停留在开局。开局准确率与总体准确率相同；中局和残局略去。",
    keyMoments: "关键节点",
    noSwing: "没有波动越过当前阈值。",
    hidden: "解题时隐藏",
    onlyReasonable: "唯一合理着法",
    viewAllMoments: (count) => `查看全部 ${count} 个节点 →`,
    legend: "质量 · 准确率",
    noMoves: "没有着法符合此筛选。",
    accuracy: (value) => `准确率 ${value}`,
    accuracySr: "准确率 ",
  },
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
  const language = useUiLanguage();
  const copy = COPY[language];
  // Practice and a withheld guided moment hide the solving ply here too: the
  // key-moment list names the fault and its swing, which is the answer.
  const hiddenPly = useWithheldPly();
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
        <div className="eyebrow">{copy.openingEyebrow}</div>
        <strong>{analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : copy.unknownPosition}</strong>
        {analysis.opening?.variation && <span>{analysis.opening.variation}</span>}
      </div>

      <div className="accuracy-table">
        <div className="accuracy-head"><span /><strong>{copy.white}</strong><strong>{copy.black}</strong></div>
        <div className="accuracy-row overall"><span>{copy.overall}</span><strong>{accuracy(analysis.white.accuracy)}</strong><strong>{accuracy(analysis.black.accuracy)}</strong></div>
        {PHASES.map((key) => {
          const openingOnly = analysis.division.middlePly === undefined;
          const white = key === "opening" && openingOnly
            ? analysis.white.phaseAccuracy.opening ?? analysis.white.accuracy
            : analysis.white.phaseAccuracy[key];
          const black = key === "opening" && openingOnly
            ? analysis.black.phaseAccuracy.opening ?? analysis.black.accuracy
            : analysis.black.phaseAccuracy[key];
          return (
            <div className="accuracy-row" key={key}>
              <span>{phaseLabel(key, language)}</span>
              <strong>{accuracy(white)}</strong>
              <strong>{accuracy(black)}</strong>
            </div>
          );
        })}
      </div>

      <div className="classification-summary">
        <div className="eyebrow">{copy.byQuality}</div>
        <div className="classification-heading"><span /><span /><strong>{copy.white}</strong><strong>{copy.black}</strong></div>
        {counts.map(({ quality, white, black }) => (
          <div className="classification-count" key={quality}>
            <QualityIcon classification={quality} size={23} decorative language={language} />
            <span>{qualityLabel(quality, language)}</span>
            <strong>{white}</strong>
            <strong>{black}</strong>
          </div>
        ))}
      </div>

      {annotations.length > 0 && <div className="annotation-summary">
        <div className="eyebrow">{copy.annotationsEyebrow}</div>
        <div className="annotation-heading"><span /><span /><strong>{copy.white}</strong><strong>{copy.black}</strong></div>
        {annotations.map(({ annotation, white, black }) => (
          <div className="annotation-count" key={annotation}>
            <QualityIcon classification={classificationForAnnotation(annotation)} size={23} decorative title={annotationLabel(annotation, language)} language={language} />
            <span>{annotationLabel(annotation, language)}</span>
            <strong>{white}</strong>
            <strong>{black}</strong>
          </div>
        ))}
      </div>}

      {analysis.division.middlePly === undefined && (
        <p className="phase-note">{copy.phaseNote}</p>
      )}

      <div className="critical-list">
        <div className="eyebrow">{copy.keyMoments}</div>
        {analysis.criticalMoments.length === 0 ? (
          <p className="quiet-empty">{copy.noSwing}</p>
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
              {/* The overview's key-moment list also names the fault and its swing. The
                  icon keeps the move's own label, so a Mistake reads as a Mistake and a
                  Critical choice reads as Critical. */}
              {hiddenPly === critical.ply
                ? <QualityIcon classification="book" size={25} decorative title={copy.hidden} language={language} />
                : <QualityIcon classification={iconClassification} size={25} title={qualityLabel(iconClassification, language)} language={language} />}
              <span>{formatMoveNumber(move.fenBefore, move.color)} {move.san}</span>
              <strong className={swing > 0 ? "critical-loss" : "critical-quiet"}>
                {hiddenPly === critical.ply ? copy.hidden : swing > 0 ? `−${swing.toFixed(1)}%` : copy.onlyReasonable}
              </strong>
            </button>
          );
        })}
        {analysis.criticalMoments.length > 3 && allMomentsHref && <Link className="view-all-moments" href={allMomentsHref}>{copy.viewAllMoments(analysis.criticalMoments.length)}</Link>}
      </div>
    </div>
  );
}

export function ReviewMoves({
  analysis,
  currentPly,
  onSelectPly,
  filter = "all",
  contextWindow,
}: {
  analysis: GameAnalysisV2;
  currentPly: number;
  onSelectPly: (ply: number) => void;
  filter?: "all" | "critical" | "errors";
  /** Review keeps a context window around the current ply; Moves shows the game. */
  contextWindow?: number;
}) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const criticalPlies = new Set(analysis.criticalMoments.map((moment) => moment.ply));
  const hiddenPly = useWithheldPly();
  // Emphasis and the "Key" filter share one definition of a key move, so the
  // calmer view can never disagree with what the filter shows.
  const keyOnlyEmphasis = useBoardDisplaySettings().moveEmphasis === "key";
  const listRef = useRef<HTMLDivElement>(null);
  const windowCentre = Math.max(currentPly, 1);
  const moves = analysis.moves.filter((move) => (
    (contextWindow === undefined || Math.abs(move.ply - windowCentre) <= contextWindow)
    && (filter === "all"
      || (filter === "critical" && criticalPlies.has(move.ply))
      || (filter === "errors" && (["inaccuracy", "mistake", "blunder"] as MoveQuality[]).includes(move.quality)
        || move.annotations.includes("missed_win")
        || move.annotations.includes("missed_mate")))
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
    <div className="review-moves">
      {/* The number beside a move is Accuracy, and a legend says so once for the list
          instead of the word repeating on every row. The wrapper keeps the list the
          growing child on Moves, where the route hands it the free row. */}
      <p className="move-list-legend" aria-hidden="true">{copy.legend}</p>
      <div className="review-move-list" ref={listRef}>
      {moves.length === 0 && <p className="quiet-empty">{copy.noMoves}</p>}
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
              ? <QualityIcon classification="book" size={24} decorative title={copy.hidden} language={language} />
              : <QualityIcon classification={move.classification} size={24} language={language} />}
            <strong>{move.san}</strong>
            <span className="move-quality" data-practice-hidden={hiddenPly === move.ply ? "true" : undefined} title={hiddenPly === move.ply ? copy.hidden : move.annotations.length === 0 ? qualityLabel(move.quality, language) : copy.annotationsTitle(move.annotations.map((item) => annotationLabel(item, language)))}>
              {glyphs.length > 0 && <span className="move-imported-glyph">{glyphs.join("")}</span>}
              {hiddenPly === move.ply ? copy.hidden : qualityLabel(move.classification, language)}
              {extras.map((item) => (
                <QualityIcon classification={classificationForAnnotation(item)} size={20} key={item} title={annotationLabel(item, language)} language={language} />
              ))}
            </span>
            <small title={hiddenPly === move.ply ? copy.hidden : copy.accuracy(move.accuracy.toFixed(1))}>
              <span className="sr-only">{copy.accuracySr}</span>{hiddenPly === move.ply ? "—" : move.accuracy.toFixed(0)}
            </small>
            {comment !== undefined && <span className="move-imported-comment">{comment}</span>}
            {variations.length > 0 && <span className="move-imported-variation">{variations.join(" ")}</span>}
          </button>
        );
      })}
      </div>
    </div>
  );
}
