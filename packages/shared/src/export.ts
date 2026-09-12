import { alignPgnAnnotations, readPgnAnnotations } from "./pgn-annotations";
import type { AnyGameAnalysis, EngineScore, MoveAnalysis } from "./schema";

const STANDARD_INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const HEADER_ORDER = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];

function escapeTag(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function scoreAnnotation(score: EngineScore): string {
  if (score.kind === "mate") return score.mateIn > 0 ? `#${score.mateIn}` : `#-${Math.abs(score.mateIn)}`;
  return (score.cp / 100).toFixed(2);
}

function safeComment(value: string): string {
  return value.replaceAll("{", "(").replaceAll("}", ")");
}

/**
 * One comment per move, always. The PGN parser accepts at most a single
 * comment after a move's NAGs and before its variations, so the imported
 * author note is merged into the generated evidence block instead of being
 * emitted as a second comment (which would make the file unreadable by this
 * very product's importer). Evidence stays first so `[%eval …]` remains at the
 * start of the comment for other tools.
 */
function moveComment(move: MoveAnalysis, importedComment?: string): string {
  const objectiveV2 = "quality" in move
    ? move as MoveAnalysis & { quality: string; annotations: string[] }
    : null;
  const evidence = [
    `[%eval ${scoreAnnotation(move.evaluationAfter)}]`,
    objectiveV2 ? `Quality ${objectiveV2.quality}` : move.classification.replaceAll("_", " "),
    ...(objectiveV2?.annotations ?? []).map((annotation) => `Annotation ${annotation.replaceAll("_", " ")}`),
    `Accuracy ${move.accuracy.toFixed(1)}%`,
    `Win% loss ${move.classificationReason.winPercentLoss.toFixed(1)}`,
    `Rule ${move.classificationReason.precedenceRule}`,
    ...(move.classificationReason.sacrifice?.genuine === true
      ? [`Sacrifice ${move.classificationReason.sacrifice.sacrificedMaterial}cp; SEE ${move.classificationReason.sacrifice.see}cp`]
      : []),
    ...(importedComment === undefined ? [] : [`Imported note: ${importedComment}`]),
  ];
  return `{ ${safeComment(evidence.join("; "))} }`;
}

function orderedHeaders(analysis: AnyGameAnalysis): Array<[string, string]> {
  const headers: Record<string, string> = { ...analysis.game.headers };
  headers.Result ??= "*";
  headers.Annotator = `Open Chess Review ${analysis.algorithmVersion}`;
  headers.AnalysisEngine = `Stockfish ${analysis.engine.stockfishVersion} depth ${analysis.engine.depth} MultiPV ${analysis.engine.multiPv}`;
  if (analysis.game.initialFen !== STANDARD_INITIAL_FEN) {
    headers.SetUp = "1";
    headers.FEN = analysis.game.initialFen;
  }
  const ordered = HEADER_ORDER.flatMap((name) => headers[name] === undefined ? [] : [[name, headers[name]!] as [string, string]]);
  const remaining = Object.entries(headers)
    .filter(([name]) => !HEADER_ORDER.includes(name))
    .sort(([left], [right]) => left.localeCompare(right));
  return [...ordered, ...remaining];
}

function annotatedMovetext(analysis: AnyGameAnalysis): string {
  const fenFields = analysis.game.initialFen.split(" ");
  let moveNumber = Number(fenFields[5] ?? "1");
  if (!Number.isFinite(moveNumber) || moveNumber < 1) moveNumber = 1;
  // The analysis carries the imported PGN, so annotations the author wrote are
  // restored here instead of being flattened away. Annotated export is meant to
  // be a superset of the original, not a replacement for it.
  const imported = analysis.game.pgn === undefined
    ? null
    : alignPgnAnnotations(readPgnAnnotations(analysis.game.pgn), analysis.moves.length);
  const tokens: string[] = [];
  let previousColor: "white" | "black" | undefined;

  if (imported?.gameComment !== undefined) tokens.push(`{ ${safeComment(imported.gameComment)} }`);
  analysis.moves.forEach((move, index) => {
    if (move.color === "white") tokens.push(`${moveNumber}.`);
    else if (previousColor !== "white") tokens.push(`${moveNumber}...`);
    tokens.push(move.san);
    // Order matters: the parser accepts only `SAN NAG* comment? variation*`.
    const annotation = imported?.plies[index];
    for (const nag of annotation?.nags ?? []) tokens.push(`$${nag}`);
    tokens.push(moveComment(move, annotation?.comment));
    // Variations are re-emitted verbatim: reading them back as a tree is a
    // separate feature, and rewriting them would silently corrupt the author's
    // line. They keep their position immediately after the move they annotate.
    for (const variation of annotation?.variations ?? []) tokens.push(variation);
    if (move.color === "black") moveNumber += 1;
    previousColor = move.color;
  });
  tokens.push(analysis.game.headers.Result ?? "*");

  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (current.length > 0 && current.length + token.length + 1 > 100) {
      lines.push(current);
      current = token;
    } else {
      current = current.length === 0 ? token : `${current} ${token}`;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

export function exportAnalysisJson(analysis: AnyGameAnalysis): string {
  return `${JSON.stringify(analysis, null, 2)}\n`;
}

export function exportAnnotatedPgn(analysis: AnyGameAnalysis): string {
  const tags = orderedHeaders(analysis).map(([name, value]) => `[${name} "${escapeTag(value)}"]`).join("\n");
  return `${tags}\n\n${annotatedMovetext(analysis)}\n`;
}
