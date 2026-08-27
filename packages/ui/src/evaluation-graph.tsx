import { useState } from "react";
import type { AnyGameAnalysis, EngineScore, MoveAnalysis } from "@chess-review/shared";
import { QUALITY_META, QualityIcon } from "./quality-icon";

export interface EvaluationGraphProps {
  analysis: AnyGameAnalysis;
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

function graphValue(score: EngineScore): number {
  if (score.kind === "mate") return score.mateIn > 0 ? 6 : -6;
  return Math.max(-6, Math.min(6, score.cp / 100));
}

function scoreLabel(score: EngineScore): string {
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

export function EvaluationGraph({ analysis, currentPly, onSelectPly }: EvaluationGraphProps) {
  const [hoveredPly, setHoveredPly] = useState<number | null>(null);
  const width = 1040;
  const height = 292;
  const left = 48;
  const right = 20;
  const top = 42;
  const bottom = 35;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const total = Math.max(1, analysis.moves.length);
  const x = (ply: number) => left + (ply / total) * plotWidth;
  const y = (score: EngineScore) => top + ((6 - graphValue(score)) / 12) * plotHeight;
  const points: Array<{ ply: number; score: EngineScore; move?: MoveAnalysis }> = [
    ...(analysis.moves[0] ? [{ ply: 0, score: analysis.moves[0].evaluationBefore }] : []),
    ...analysis.moves.map((move) => ({ ply: move.ply, score: move.evaluationAfter, move })),
  ];
  const line = points.map((point) => `${x(point.ply)},${y(point.score)}`).join(" ");
  const boundaries = [
    ...(analysis.division.middlePly === undefined ? [] : [{ ply: analysis.division.middlePly, label: "Middlegame" }]),
    ...(analysis.division.endPly === undefined ? [] : [{ ply: analysis.division.endPly, label: "Endgame" }]),
  ];
  const hovered = points.find((point) => point.ply === hoveredPly) ?? points.find((point) => point.ply === currentPly) ?? points[0];
  const phaseSegments = [
    { start: 0, end: analysis.division.middlePly ?? total, label: "Opening", color: "#f3e8cf" },
    ...(analysis.division.middlePly === undefined ? [] : [{ start: analysis.division.middlePly, end: analysis.division.endPly ?? total, label: "Middlegame", color: "#dce8e5" }]),
    ...(analysis.division.endPly === undefined ? [] : [{ start: analysis.division.endPly, end: total, label: "Endgame", color: "#eadfe5" }]),
  ];

  return (
    <div className="evaluation-graph" aria-label="Stockfish evaluation graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Stockfish evaluation by ply; select a point to navigate</title>
        <rect x={left} y={top} width={plotWidth} height={plotHeight} rx="8" fill="#fbf8f1" />
        <clipPath id="evaluation-plot-clip"><rect x={left} y={top} width={plotWidth} height={plotHeight} rx="8" /></clipPath>
        <g clipPath="url(#evaluation-plot-clip)">
          {phaseSegments.map((segment) => <rect key={segment.label} x={x(segment.start)} y={top} width={Math.max(0, x(segment.end) - x(segment.start))} height={plotHeight} fill={segment.color} opacity=".54" />)}
        </g>
        {[3, 0, -3].map((value) => {
          const rowY = top + ((6 - value) / 12) * plotHeight;
          return (
            <g key={value}>
              <line x1={left} x2={width - right} y1={rowY} y2={rowY} stroke={value === 0 ? "#8d9aa0" : "#cad0ce"} strokeWidth={value === 0 ? 1.3 : 1} strokeDasharray={value === 0 ? undefined : "2 5"} />
              <text x={left - 9} y={rowY + 4} textAnchor="end" fill="#78878e" fontSize="12">{value > 0 ? `+${value}` : value}</text>
            </g>
          );
        })}
        {phaseSegments.map((segment) => <text key={`${segment.label}-label`} x={x(segment.start) + 8} y="26" fill="#687b85" fontSize="11" fontWeight="700" letterSpacing="1">{segment.label.toUpperCase()}</text>)}
        {boundaries.map((boundary) => (
          <g key={boundary.label}>
            <line x1={x(boundary.ply)} x2={x(boundary.ply)} y1={top} y2={height - bottom} stroke="#8999a0" strokeDasharray="4 6" />
          </g>
        ))}
        <polyline points={line} fill="none" stroke="#496f82" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(currentPly)} x2={x(currentPly)} y1={top} y2={height - bottom} stroke="#344f5c" strokeWidth="1.3" opacity=".54" />
        {points.map((point) => {
          const move = point.move;
          const critical = move && analysis.criticalMoments.some((moment) => moment.ply === move.ply);
          const markerSize = point.ply === currentPly ? 18 : critical ? 15 : 12;
          return (
            <g
              key={point.ply}
              role="button"
              tabIndex={0}
              aria-label={move ? `Go to ply ${point.ply}, ${QUALITY_META[move.classification].label}` : "Go to starting position"}
              onClick={() => onSelectPly(point.ply)}
              onMouseEnter={() => setHoveredPly(point.ply)}
              onMouseLeave={() => setHoveredPly(null)}
              onFocus={() => setHoveredPly(point.ply)}
              onBlur={() => setHoveredPly(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelectPly(point.ply);
              }}
              style={{ cursor: "pointer" }}
            >
              <title>{move ? `Ply ${point.ply} · ${move.san} · ${QUALITY_META[move.classification].label} · ${scoreLabel(point.score)}` : `Starting position · ${scoreLabel(point.score)}`}</title>
              <circle cx={x(point.ply)} cy={y(point.score)} r="12" fill="transparent" />
              {move ? (
                <g transform={`translate(${x(point.ply) - markerSize / 2} ${y(point.score) - markerSize / 2})`} pointerEvents="none">
                  <QualityIcon classification={move.classification} size={markerSize} />
                </g>
              ) : (
                <circle cx={x(point.ply)} cy={y(point.score)} r="4" fill="#fffdf8" />
              )}
              <circle cx={x(point.ply)} cy={y(point.score)} r={point.ply === currentPly ? 10 : 7} fill="transparent" stroke={point.ply === currentPly ? "#294754" : "transparent"} strokeWidth="1.8" />
            </g>
          );
        })}
      </svg>
      {hovered && <div className="evaluation-graph-detail"><strong>{hovered.move ? `${hovered.move.ply}. ${hovered.move.san}` : "Starting position"}</strong><span>{scoreLabel(hovered.score)}</span>{hovered.move && <><span>{QUALITY_META[hovered.move.classification].label}</span><small>Accuracy {hovered.move.accuracy.toFixed(1)}</small></>}</div>}
    </div>
  );
}
