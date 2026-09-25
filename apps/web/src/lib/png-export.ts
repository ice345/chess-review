import { formatMoveNotation, type AnyGameAnalysis, type EngineScore, type MoveAnalysis, type UiLanguage } from "@chess-review/shared";
import { BRAND_MARK_SOURCE, QUALITY_META, phaseLabel, qualityLabel } from "@chess-review/ui";
import { PIECE_ASSET_DIR, PIECE_ASSET_KEYS, boardPieceImageKey, type PieceAssetKey, type PieceSetId } from "./board-piece-assets";

const PIECES: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

/** Canvas fallbacks mirror the `--board-square-*` tokens in `styles/tokens.css`.
    The rendered board reads the live tokens when a document is available, so the
    export follows the theme while the canvas keeps a usable offline default. */
export const BOARD_SQUARE_FALLBACK = { light: "#eee8d9", dark: "#b1c6c2" } as const;

export type BoardPieceImages = Partial<Record<PieceAssetKey, HTMLImageElement>>;

function cssToken(name: string, fallback: string): string {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

const pieceImageRequests = new Map<PieceSetId, Promise<BoardPieceImages>>();

let brandMarkRequest: Promise<HTMLImageElement | null> | null = null;

/** The product mark on every exported card. Read once per page: the asset is
    fingerprinted build output, so a failed load keeps the export usable without
    a mark rather than failing it, the same way a missing piece falls back to a
    glyph. */
export function loadBrandMark(): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  brandMarkRequest ??= loadImage(BRAND_MARK_SOURCE);
  return brandMarkRequest;
}

/** Preloads the twelve authored PNGs once per piece set. An asset the browser
    cannot decode keeps the Unicode glyph fallback, so an offline or partial
    cache degrades the export instead of failing it. */
export function loadBoardPieceImages(set: PieceSetId): Promise<BoardPieceImages> {
  if (set !== "liz-blue" || typeof Image === "undefined") return Promise.resolve({});
  const cached = pieceImageRequests.get(set);
  if (cached) return cached;
  const request = Promise.all(PIECE_ASSET_KEYS.map(async (key) => {
    const image = await loadImage(`${PIECE_ASSET_DIR}/${key}.png`);
    return image ? ([key, image] as const) : null;
  })).then((entries) => Object.fromEntries(entries.filter((entry) => entry !== null)) as BoardPieceImages);
  pieceImageRequests.set(set, request);
  // A fully failed load stays retryable: a later export in the same page session
  // can succeed once the browser has cached `/pieces/`.
  void request.then((images) => {
    if (Object.keys(images).length === 0) pieceImageRequests.delete(set);
  });
  return request;
}

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
  context.save();
  context.translate(x, y);
  context.scale(size / 32, size / 32);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = meta.ink;
  context.fillStyle = meta.wash;
  context.lineWidth = 1.7;

  const circle = (radius: number, fill = meta.wash) => {
    context.beginPath();
    context.arc(16, 16, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.stroke();
  };
  const roundedSquare = () => {
    context.beginPath();
    context.roundRect(3.5, 3.5, 25, 25, 6);
    context.fillStyle = meta.wash;
    context.fill();
    context.stroke();
  };
  const shape = (path: Path2D) => {
    context.fillStyle = meta.wash;
    context.fill(path);
    context.stroke(path);
  };
  const text = (value: string, fontSize: number, yPosition = 16) => {
    context.fillStyle = meta.ink;
    context.font = `800 ${fontSize}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(value, 16, yPosition);
  };

  switch (meta.motif) {
    case "diamond-double":
      shape(new Path2D("M16 2.5 29.5 16 16 29.5 2.5 16Z"));
      text("!!", 8.6, 16.2);
      context.fillStyle = meta.ink;
      context.fill(new Path2D("m25.5 3 .65 1.85L28 5.5l-1.85.65L25.5 8l-.65-1.85L23 5.5l1.85-.65Z"));
      break;
    case "diamond-single":
      shape(new Path2D("M16 4 28 16 16 28 4 16Z"));
      text("!", 11, 16.7);
      break;
    case "circle-solid-check":
      circle(13.2, meta.ink);
      context.strokeStyle = "#fff";
      context.lineWidth = 3;
      context.stroke(new Path2D("M9 16.5 13.4 20.9 23.5 10.8"));
      break;
    case "circle-double-check":
      circle(13);
      context.lineWidth = 2;
      context.stroke(new Path2D("M7.8 16.5 11 19.7 17.3 13.4M14 18.2l2.6 2.6 7.4-8"));
      break;
    case "circle-check":
      circle(12.5);
      context.lineWidth = 2;
      context.stroke(new Path2D("M9.2 16.7 13.4 20.8 22.8 10.8"));
      break;
    case "square-book":
      roundedSquare();
      context.lineWidth = 1.45;
      context.stroke(new Path2D("M7.5 10c3.4-1.2 6-.2 8.5 2.1V24c-2.5-2.2-5.1-3.1-8.5-1.9Zm17 0c-3.4-1.2-6-.2-8.5 2.1V24c2.5-2.2 5.1-3.1 8.5-1.9ZM16 12.1V24"));
      break;
    case "square-interesting": roundedSquare(); text("!?", 8.5, 16.2); break;
    case "square-forced": roundedSquare(); context.lineWidth = 2; context.stroke(new Path2D("M8 16h15m-5-5 5 5-5 5")); break;
    case "ring-inaccuracy":
      circle(12.8);
      context.setLineDash([2, 2.4]);
      context.lineWidth = 1;
      context.beginPath(); context.arc(16, 16, 9.8, 0, Math.PI * 2); context.stroke();
      context.setLineDash([]);
      text("?!", 8, 16.2);
      break;
    case "square-mistake": roundedSquare(); text("?", 12, 16.8); break;
    case "octagon-blunder": shape(new Path2D("m10 3 12 0 7 7 0 12-7 7H10l-7-7V10Z")); text("??", 8.2, 16.2); break;
    case "circle-miss":
      circle(12.7);
      context.lineWidth = 2.4;
      context.stroke(new Path2D("M10.5 10.5 21.5 21.5m0-11-11 11"));
      break;
    case "diamond-missed-win":
      shape(new Path2D("M16 4 28 16 16 28 4 16Z"));
      context.lineWidth = 2;
      context.stroke(new Path2D("M9 9.5c4.2 1.8 7.4 5.2 12.2 11.8m-5.8-1.1 5.8 1.1-1.2-5.8"));
      break;
    case "octagon-missed-mate": shape(new Path2D("m10 3 12 0 7 7 0 12-7 7H10l-7-7V10Z")); text("#?", 7.5, 16.2); break;
  }
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
  images: BoardPieceImages,
) {
  context.save();
  const board = boardPieces(fen);
  const square = size / 8;
  const light = cssToken("--board-square-light", BOARD_SQUARE_FALLBACK.light);
  const dark = cssToken("--board-square-dark", BOARD_SQUARE_FALLBACK.dark);
  for (let displayRank = 0; displayRank < 8; displayRank += 1) {
    for (let displayFile = 0; displayFile < 8; displayFile += 1) {
      const sourceRank = orientation === "white" ? displayRank : 7 - displayRank;
      const sourceFile = orientation === "white" ? displayFile : 7 - displayFile;
      const px = x + displayFile * square;
      const py = y + displayRank * square;
      context.fillStyle = (displayFile + displayRank) % 2 === 0 ? light : dark;
      context.fillRect(px, py, square, square);
      const piece = board[sourceRank]?.[sourceFile];
      if (!piece) continue;
      const image = images[boardPieceImageKey(piece)];
      if (image) {
        context.drawImage(image, px, py, square, square);
        continue;
      }
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
  context.restore();
}

function background(context: CanvasRenderingContext2D, title: string, subtitle: string, mark: HTMLImageElement | null) {
  const gradient = context.createLinearGradient(0, 0, 1200, 675);
  gradient.addColorStop(0, "#fbf7ef");
  gradient.addColorStop(.55, "#f5f0e7");
  gradient.addColorStop(1, "#dfeae8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 675);
  if (mark) context.drawImage(mark, 40, 15, 31, 31);
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

export async function renderDisplayedPositionCard(options: {
  fen: string;
  orientation: "white" | "black";
  title: string;
  subtitle: string;
  language: UiLanguage;
  pieceSet?: PieceSetId;
}): Promise<Blob> {
  const [element, context] = canvas();
  const [pieces, mark] = await Promise.all([loadBoardPieceImages(options.pieceSet ?? "liz-blue"), loadBrandMark()]);
  background(context, options.title, options.subtitle, mark);
  roundedRect(context, 35, 65, 550, 575, 20, "#fffdf8");
  drawBoard(context, options.fen, 50, 80, 520, options.orientation, pieces);
  context.fillStyle = "#294653";
  context.font = "800 28px system-ui";
  context.fillText(COPY[options.language].displayedPosition, 620, 174);
  context.fillStyle = "#71848d";
  context.font = "500 14px system-ui";
  context.fillText(options.fen, 620, 210);
  return toBlob(element);
}

type ExportCopy = {
  displayedPosition: string;
  objectiveGameReview: string;
  whitePov: string;
  moveAccuracy: string;
  winPercentLoss: string;
  phase: (label: string) => string;
  rule: (rule: string) => string;
  sacrifice: (material: number, see: number) => string;
  engineLine: (version: string, depth: number, multiPv: number) => string;
  white: string;
  black: string;
  whiteAccuracy: string;
  blackAccuracy: string;
  stockfishEvaluation: string;
  pliesAndMoments: (plies: number, moments: number, version: string) => string;
};

/* The cards are a product surface, so their labels follow the interface language.
   What they say *about the game* does not: the phase name comes from `phaseLabel`
   and the rule id stays the canonical analysis value the panels also print. */
const COPY: Record<UiLanguage, ExportCopy> = {
  en: {
    displayedPosition: "Displayed position",
    objectiveGameReview: "Objective game review",
    whitePov: "STOCKFISH · WHITE POV",
    moveAccuracy: "MOVE ACCURACY",
    winPercentLoss: "WIN% LOSS",
    phase: (label) => `Phase · ${label}`,
    rule: (rule) => `Rule · ${rule}`,
    sacrifice: (material, see) => `Sacrifice · ${material} cp · SEE ${see}`,
    engineLine: (version, depth, multiPv) => `Stockfish ${version} · Depth ${depth} · MultiPV ${multiPv}`,
    white: "White",
    black: "Black",
    whiteAccuracy: "WHITE ACCURACY",
    blackAccuracy: "BLACK ACCURACY",
    stockfishEvaluation: "STOCKFISH EVALUATION",
    pliesAndMoments: (plies, moments, version) => `${plies} plies · ${moments} key moments · ${version}`,
  },
  "zh-CN": {
    displayedPosition: "当前局面",
    objectiveGameReview: "客观复盘",
    whitePov: "STOCKFISH · 白方视角",
    moveAccuracy: "着法准确率",
    winPercentLoss: "胜率损失",
    phase: (label) => `阶段 · ${label}`,
    rule: (rule) => `规则 · ${rule}`,
    sacrifice: (material, see) => `弃子 · ${material} 厘兵 · SEE ${see}`,
    engineLine: (version, depth, multiPv) => `Stockfish ${version} · 深度 ${depth} · MultiPV ${multiPv}`,
    white: "白方",
    black: "黑方",
    whiteAccuracy: "白方准确率",
    blackAccuracy: "黑方准确率",
    stockfishEvaluation: "STOCKFISH 评估",
    pliesAndMoments: (plies, moments, version) => `${plies} 个半回合 · ${moments} 个关键节点 · ${version}`,
  },
};

export async function renderPositionCard(
  analysis: AnyGameAnalysis,
  move: MoveAnalysis,
  orientation: "white" | "black",
  language: UiLanguage,
  pieceSet: PieceSetId = "liz-blue",
): Promise<Blob> {
  const copy = COPY[language];
  const [element, context] = canvas();
  const [pieces, mark] = await Promise.all([loadBoardPieceImages(pieceSet), loadBrandMark()]);
  const moveNumber = formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san });
  background(context, moveNumber, analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : phaseLabel(move.phase, language), mark);
  roundedRect(context, 35, 65, 550, 575, 20, "#fffdf8");
  drawBoard(context, move.fenAfter, 50, 80, 520, orientation, pieces);

  drawBadge(context, move, 620, 128, 76);
  context.fillStyle = QUALITY_META[move.classification].ink;
  context.font = "900 34px system-ui";
  context.fillText(qualityLabel(move.classification, language).toUpperCase(), 718, 174);
  context.fillStyle = "#294653";
  context.font = "800 54px system-ui";
  context.fillText(scoreLabel(move.evaluationAfter), 620, 265);
  context.fillStyle = "#71848d";
  context.font = "600 14px system-ui";
  context.fillText(copy.whitePov, 620, 291);

  roundedRect(context, 620, 330, 245, 105, 14, "#eef3f1");
  roundedRect(context, 885, 330, 270, 105, 14, "#f0e6e9");
  context.fillStyle = "#71848d";
  context.font = "600 13px system-ui";
  context.fillText(copy.moveAccuracy, 642, 360);
  context.fillText(copy.winPercentLoss, 907, 360);
  context.fillStyle = "#4f7385";
  context.font = "900 32px system-ui";
  context.fillText(move.accuracy.toFixed(1), 642, 404);
  context.fillText(move.classificationReason.winPercentLoss.toFixed(1), 907, 404);

  context.fillStyle = "#354f5a";
  context.font = "700 16px system-ui";
  context.fillText(copy.phase(phaseLabel(move.phase, language)), 620, 493);
  context.fillText(copy.rule(move.classificationReason.precedenceRule.replaceAll("-", " ")), 620, 525);
  const sacrifice = move.classificationReason.sacrifice;
  if (sacrifice) context.fillText(copy.sacrifice(sacrifice.sacrificedMaterial, sacrifice.see), 620, 557);
  context.fillStyle = "#71848d";
  context.font = "500 12px system-ui";
  context.fillText(copy.engineLine(analysis.engine.stockfishVersion, analysis.engine.depth, analysis.engine.multiPv), 620, 618);
  return toBlob(element);
}

function graphValue(score: EngineScore): number {
  if (score.kind === "mate") return score.mateIn > 0 ? 6 : -6;
  return Math.max(-6, Math.min(6, score.cp / 100));
}

export async function renderGameReviewCard(analysis: AnyGameAnalysis, language: UiLanguage): Promise<Blob> {
  const copy = COPY[language];
  const [element, context] = canvas();
  const white = analysis.game.headers.White ?? copy.white;
  const black = analysis.game.headers.Black ?? copy.black;
  background(context, `${white} — ${black}`, analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : copy.objectiveGameReview, await loadBrandMark());

  roundedRect(context, 40, 115, 530, 205, 18, "#fffdf8");
  roundedRect(context, 590, 115, 570, 205, 18, "#fffdf8");
  context.fillStyle = "#71848d";
  context.font = "700 14px system-ui";
  context.fillText(copy.whiteAccuracy, 70, 150);
  context.fillText(copy.blackAccuracy, 620, 150);
  context.fillStyle = "#4f7385";
  context.font = "900 70px system-ui";
  context.fillText(analysis.white.accuracy?.toFixed(1) ?? "—", 70, 225);
  context.fillText(analysis.black.accuracy?.toFixed(1) ?? "—", 620, 225);

  context.fillStyle = "#71848d";
  context.font = "600 12px system-ui";
  const phases = ["opening", "middlegame", "endgame"] as const;
  phases.forEach((phase, index) => {
    const y = 260 + index * 22;
    const label = phaseLabel(phase, language).toUpperCase();
    context.fillText(`${label}  ${analysis.white.phaseAccuracy[phase]?.toFixed(1) ?? "—"}`, 70, y);
    context.fillText(`${label}  ${analysis.black.phaseAccuracy[phase]?.toFixed(1) ?? "—"}`, 620, y);
  });

  roundedRect(context, 40, 340, 1120, 250, 18, "#fffdf8");
  context.fillStyle = "#354f5a";
  context.font = "800 16px system-ui";
  context.fillText(copy.stockfishEvaluation, 70, 378);
  const graphX = 75;
  const graphY = 410;
  const graphWidth = 1040;
  const graphHeight = 135;
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
  for (const critical of analysis.criticalMoments) {
    const move = analysis.moves[critical.ply - 1];
    if (!move) continue;
    const markerX = graphX + (move.ply / Math.max(1, analysis.moves.length)) * graphWidth;
    const markerY = graphY + graphHeight / 2 - (graphValue(move.evaluationAfter) / 6) * (graphHeight / 2);
    drawBadge(context, move, markerX - 10, markerY - 10, 20);
  }
  context.fillStyle = "#71848d";
  context.font = "500 12px system-ui";
  context.fillText(copy.pliesAndMoments(analysis.moves.length, analysis.criticalMoments.length, analysis.algorithmVersion), 70, 635);
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

export function reviewFilename(analysis: AnyGameAnalysis, suffix: string): string {
  const white = analysis.game.headers.White ?? "white";
  const black = analysis.game.headers.Black ?? "black";
  const base = `${white}-${black}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chess-review";
  return `${base}-${suffix}`;
}
