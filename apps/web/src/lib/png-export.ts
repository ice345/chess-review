import type { EngineScore, GameAnalysisV1, MoveAnalysis } from "@chess-review/shared";
import { QUALITY_META } from "@chess-review/ui";

const PIECES: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

function canvas(width = 1200, height = 675): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  return [element, context];
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function scoreLabel(score: EngineScore): string {
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function drawBadge(context: CanvasRenderingContext2D, move: MoveAnalysis, x: number, y: number, size: number) {
  const meta = QUALITY_META[move.classification];
  context.beginPath();
  context.moveTo(x + size * .17, y + size * .35);
  context.bezierCurveTo(x + size * .29, y + size * .02, x + size * .73, y - size * .01, x + size * .89, y + size * .28);
  context.bezierCurveTo(x + size * 1.04, y + size * .57, x + size * .78, y + size * .91, x + size * .48, y + size * .91);
  context.bezierCurveTo(x + size * .22, y + size * .91, x + size * .07, y + size * .75, x + size * .04, y + size * .58);
  context.fillStyle = meta.color;
  context.globalAlpha = .1;
  context.fill();
  context.globalAlpha = .9;
  context.strokeStyle = meta.color;
  context.lineWidth = Math.max(1.5, size * .025);
  context.lineCap = "round";
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = "#3d5661";
  context.font = `800 ${Math.round(size * 0.35)}px system-ui`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(meta.symbol, x + size / 2, y + size * 0.49);
}

function drawBlueBishopMark(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save();
  context.translate(x, y);
  context.scale(size / 48, size / 48);
  context.fillStyle = "#608899";
  context.beginPath();
  context.moveTo(24, 3.7);
  context.bezierCurveTo(19.3, 3.7, 15.9, 7.4, 15.9, 11.8);
  context.bezierCurveTo(15.9, 14.7, 17.3, 16.9, 19.1, 18.8);
  context.bezierCurveTo(14, 22, 10.8, 27.1, 10.6, 33);
  context.lineTo(37.4, 33);
  context.bezierCurveTo(37.2, 27.1, 34, 22, 28.9, 18.8);
  context.bezierCurveTo(30.7, 16.9, 32.1, 14.7, 32.1, 11.8);
  context.bezierCurveTo(32.1, 7.4, 28.7, 3.7, 24, 3.7);
  context.fill();
  context.strokeStyle = "#fbf7ef";
  context.lineWidth = 3.1;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(19.2, 7.8);
  context.lineTo(28.8, 17.2);
  context.stroke();
  context.strokeStyle = "#608899";
  context.beginPath();
  context.moveTo(7.6, 36.2);
  context.lineTo(40.4, 36.2);
  context.moveTo(10.7, 40.1);
  context.lineTo(37.3, 40.1);
  context.stroke();
  context.restore();
}

function boardPieces(fen: string): Array<Array<string | null>> {
  return fen.split(" ")[0]!.split("/").map((rank) => {
    const squares: Array<string | null> = [];
    for (const value of rank) {
      if (/\d/.test(value)) squares.push(...Array.from({ length: Number(value) }, () => null));
      else squares.push(value);
    }
    return squares;
  });
}

function drawBoard(
  context: CanvasRenderingContext2D,
  fen: string,
  x: number,
  y: number,
  size: number,
  orientation: "white" | "black",
) {
  const board = boardPieces(fen);
  const square = size / 8;
  for (let displayRank = 0; displayRank < 8; displayRank += 1) {
    for (let displayFile = 0; displayFile < 8; displayFile += 1) {
      const sourceRank = orientation === "white" ? displayRank : 7 - displayRank;
      const sourceFile = orientation === "white" ? displayFile : 7 - displayFile;
      const px = x + displayFile * square;
      const py = y + displayRank * square;
      context.fillStyle = (displayFile + displayRank) % 2 === 0 ? "#f2e5cf" : "#91aeb6";
      context.fillRect(px, py, square, square);
      const piece = board[sourceRank]?.[sourceFile];
      if (!piece) continue;
      context.font = `${Math.round(square * 0.78)}px "Arial Unicode MS", "Noto Sans Symbols 2", serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = piece === piece.toUpperCase() ? "#f7f5eb" : "#151a17";
      context.strokeStyle = piece === piece.toUpperCase() ? "#20251f" : "#e8e4d4";
      context.lineWidth = 1.1;
      const glyph = PIECES[piece] ?? "";
      context.strokeText(glyph, px + square / 2, py + square * 0.53);
      context.fillText(glyph, px + square / 2, py + square * 0.53);
    }
  }
}

function background(context: CanvasRenderingContext2D, title: string, subtitle: string) {
  const gradient = context.createLinearGradient(0, 0, 1200, 675);
  gradient.addColorStop(0, "#fbf7ef");
  gradient.addColorStop(.55, "#f5f0e7");
  gradient.addColorStop(1, "#dfeae8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 675);
  drawBlueBishopMark(context, 40, 15, 31);
  context.fillStyle = "#6c8c99";
  context.font = "900 20px system-ui";
  context.textAlign = "left";
  context.fillText("OPEN CHESS REVIEW", 82, 42);
  context.fillStyle = "#294653";
  context.font = "800 30px system-ui";
  context.fillText(title, 620, 72);
  context.fillStyle = "#71848d";
  context.font = "500 14px system-ui";
  context.fillText(subtitle, 620, 99);
}

function toBlob(element: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    element.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png");
  });
}

export async function renderPositionCard(
  analysis: GameAnalysisV1,
  move: MoveAnalysis,
  orientation: "white" | "black",
): Promise<Blob> {
  const [element, context] = canvas();
  const moveNumber = `${Math.ceil(move.ply / 2)}${move.color === "white" ? "." : "…"} ${move.san}`;
  background(context, moveNumber, analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : move.phase);
  roundedRect(context, 35, 65, 550, 575, 20, "#fffdf8");
  drawBoard(context, move.fenAfter, 50, 80, 520, orientation);

  drawBadge(context, move, 620, 128, 76);
  context.fillStyle = QUALITY_META[move.classification].color;
  context.font = "900 34px system-ui";
  context.fillText(QUALITY_META[move.classification].label.toUpperCase(), 718, 174);
  context.fillStyle = "#294653";
  context.font = "800 54px system-ui";
  context.fillText(scoreLabel(move.evaluationAfter), 620, 265);
  context.fillStyle = "#71848d";
  context.font = "600 14px system-ui";
  context.fillText("STOCKFISH · WHITE POV", 620, 291);

  roundedRect(context, 620, 330, 245, 105, 14, "#eef3f1");
  roundedRect(context, 885, 330, 270, 105, 14, "#f0e6e9");
  context.fillStyle = "#71848d";
  context.font = "600 13px system-ui";
  context.fillText("MOVE ACCURACY", 642, 360);
  context.fillText("WIN% LOSS", 907, 360);
  context.fillStyle = "#4f7385";
  context.font = "900 32px system-ui";
  context.fillText(move.accuracy.toFixed(1), 642, 404);
  context.fillText(move.classificationReason.winPercentLoss.toFixed(1), 907, 404);

  context.fillStyle = "#354f5a";
  context.font = "700 16px system-ui";
  context.fillText(`Phase · ${move.phase}`, 620, 493);
  context.fillText(`Rule · ${move.classificationReason.precedenceRule.replaceAll("-", " ")}`, 620, 525);
  const sacrifice = move.classificationReason.sacrifice;
  if (sacrifice) context.fillText(`Sacrifice · ${sacrifice.sacrificedMaterial} cp · SEE ${sacrifice.see}`, 620, 557);
  context.fillStyle = "#71848d";
  context.font = "500 12px system-ui";
  context.fillText(`Stockfish ${analysis.engine.stockfishVersion} · Depth ${analysis.engine.depth} · MultiPV ${analysis.engine.multiPv}`, 620, 618);
  return toBlob(element);
}

function graphValue(score: EngineScore): number {
  if (score.kind === "mate") return score.mateIn > 0 ? 6 : -6;
  return Math.max(-6, Math.min(6, score.cp / 100));
}

export async function renderGameReviewCard(analysis: GameAnalysisV1): Promise<Blob> {
  const [element, context] = canvas();
  const white = analysis.game.headers.White ?? "White";
  const black = analysis.game.headers.Black ?? "Black";
  background(context, `${white} — ${black}`, analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : "Objective game review");

  roundedRect(context, 40, 90, 530, 210, 18, "#fffdf8");
  roundedRect(context, 590, 90, 570, 210, 18, "#fffdf8");
  context.fillStyle = "#71848d";
  context.font = "700 14px system-ui";
  context.fillText("WHITE ACCURACY", 70, 130);
  context.fillText("BLACK ACCURACY", 620, 130);
  context.fillStyle = "#4f7385";
  context.font = "900 70px system-ui";
  context.fillText(analysis.white.accuracy?.toFixed(1) ?? "—", 70, 215);
  context.fillText(analysis.black.accuracy?.toFixed(1) ?? "—", 620, 215);

  context.fillStyle = "#71848d";
  context.font = "600 12px system-ui";
  const phases = ["opening", "middlegame", "endgame"] as const;
  phases.forEach((phase, index) => {
    const y = 270 + index * 25;
    context.fillText(`${phase.toUpperCase()}  ${analysis.white.phaseAccuracy[phase]?.toFixed(1) ?? "—"}`, 70, y);
    context.fillText(`${phase.toUpperCase()}  ${analysis.black.phaseAccuracy[phase]?.toFixed(1) ?? "—"}`, 620, y);
  });

  roundedRect(context, 40, 330, 1120, 270, 18, "#fffdf8");
  context.fillStyle = "#354f5a";
  context.font = "800 16px system-ui";
  context.fillText("STOCKFISH EVALUATION", 70, 370);
  const graphX = 75;
  const graphY = 405;
  const graphWidth = 1040;
  const graphHeight = 145;
  context.strokeStyle = "#bfcac9";
  context.beginPath();
  context.moveTo(graphX, graphY + graphHeight / 2);
  context.lineTo(graphX + graphWidth, graphY + graphHeight / 2);
  context.stroke();
  const scores = [analysis.moves[0]?.evaluationBefore, ...analysis.moves.map((move) => move.evaluationAfter)].filter((score): score is EngineScore => score !== undefined);
  context.strokeStyle = "#4f7385";
  context.lineWidth = 3;
  context.beginPath();
  scores.forEach((score, index) => {
    const x = graphX + (index / Math.max(1, scores.length - 1)) * graphWidth;
    const y = graphY + graphHeight / 2 - (graphValue(score) / 6) * (graphHeight / 2);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.fillStyle = "#71848d";
  context.font = "500 12px system-ui";
  context.fillText(`${analysis.moves.length} plies · ${analysis.criticalMoments.length} critical moments · ${analysis.algorithmVersion}`, 70, 635);
  return toBlob(element);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reviewFilename(analysis: GameAnalysisV1, suffix: string): string {
  const white = analysis.game.headers.White ?? "white";
  const black = analysis.game.headers.Black ?? "black";
  const base = `${white}-${black}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chess-review";
  return `${base}-${suffix}`;
}
