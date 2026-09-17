import { Chess, SQUARES, type Color, type Square } from "chess.js";
import type {
  CoachCandidateFacts,
  CoachExplanation,
  CoachGameFacts,
  CoachGameMoveFacts,
  CoachGamePlayerFacts,
  CoachLanguage,
  CoachMaterialFacts,
  CoachMoveFacts,
  CoachPositionUnderstanding,
  CoachPracticalAlternativeFacts,
  CoachValidatedLine,
  CriticalMoment,
  EngineScore,
  AnyGameAnalysis,
  GameCoachSummary,
  MoveAnalysis,
  MoveAnnotation,
  MoveClassification,
  MoveQuality,
  PlayerAnalysis,
  PlayerAnalysisV2,
  PlayerColor,
} from "@chess-review/shared";
import { winPercentFromScore } from "./win-percent";

export const COACH_PROMPT_VERSION = "coach-v4";

const MATERIAL_CP = { p: 100, n: 320, b: 330, r: 500, q: 900 } as const;
const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" } as const;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const CENTER = ["d4", "e4", "d5", "e5"] as const satisfies readonly Square[];

function playerColor(color: Color): PlayerColor {
  return color === "w" ? "white" : "black";
}

function uci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function pawnFiles(board: Chess, color: Color): Map<string, Square[]> {
  const files = new Map<string, Square[]>();
  for (const square of board.findPiece({ type: "p", color })) {
    const file = square[0];
    if (!file) continue;
    files.set(file, [...(files.get(file) ?? []), square]);
  }
  return files;
}

function passedPawns(board: Chess, color: Color): string[] {
  const opponent: Color = color === "w" ? "b" : "w";
  const opponentPawns = board.findPiece({ type: "p", color: opponent });
  return board.findPiece({ type: "p", color }).filter((square) => {
    const fileIndex = FILES.indexOf(square[0] as typeof FILES[number]);
    const rank = Number(square[1]);
    return !opponentPawns.some((candidate) => {
      const opponentFile = FILES.indexOf(candidate[0] as typeof FILES[number]);
      const opponentRank = Number(candidate[1]);
      return Math.abs(fileIndex - opponentFile) <= 1 && (color === "w" ? opponentRank > rank : opponentRank < rank);
    });
  });
}

function pawnShield(board: Chess, color: Color, kingSquare: Square | undefined): number {
  if (!kingSquare) return 0;
  const kingFile = FILES.indexOf(kingSquare[0] as typeof FILES[number]);
  const shieldRank = Number(kingSquare[1]) + (color === "w" ? 1 : -1);
  if (shieldRank < 1 || shieldRank > 8) return 0;
  return [-1, 0, 1].filter((delta) => {
    const file = FILES[kingFile + delta];
    if (!file) return false;
    const piece = board.get(`${file}${shieldRank}` as Square);
    return piece?.color === color && piece.type === "p";
  }).length;
}

function sidePositionFacts(board: Chess, color: Color): CoachPositionUnderstanding["white"] {
  const pawns = pawnFiles(board, color);
  const kingSquare = board.findPiece({ type: "k", color })[0];
  const opponent: Color = color === "w" ? "b" : "w";
  const startingMinorSquares = color === "w"
    ? (["b1", "c1", "f1", "g1"] as const)
    : (["b8", "c8", "f8", "g8"] as const);
  return {
    inCheck: kingSquare ? board.isAttacked(kingSquare, opponent) : false,
    castled: kingSquare === (color === "w" ? "g1" : "g8") || kingSquare === (color === "w" ? "c1" : "c8"),
    pawnShieldCount: pawnShield(board, color, kingSquare),
    undevelopedMinorSquares: startingMinorSquares.filter((square) => {
      const piece = board.get(square);
      return piece?.color === color && (piece.type === "n" || piece.type === "b");
    }),
    doubledPawnFiles: [...pawns.entries()].filter(([, squares]) => squares.length > 1).map(([file]) => file),
    isolatedPawnFiles: [...pawns.keys()].filter((file) => {
      const index = FILES.indexOf(file as typeof FILES[number]);
      return !pawns.has(FILES[index - 1] ?? "") && !pawns.has(FILES[index + 1] ?? "");
    }),
    passedPawnSquares: passedPawns(board, color),
  };
}

function positionUnderstanding(fen: string): CoachPositionUnderstanding {
  const board = new Chess(fen);
  const whitePawns = pawnFiles(board, "w");
  const blackPawns = pawnFiles(board, "b");
  const moves = board.moves({ verbose: true });
  const checks = moves.filter((move) => move.san.includes("+") || move.san.includes("#")).map(uci);
  const captures = moves.filter((move) => move.isCapture()).map(uci);
  const forcingCandidates = [...new Set([...checks, ...captures])];
  const attackedUndefendedPieces = SQUARES.flatMap((square) => {
    const piece = board.get(square);
    if (!piece || piece.type === "k") return [];
    const opponent: Color = piece.color === "w" ? "b" : "w";
    if (board.attackers(square, opponent).length === 0 || board.attackers(square, piece.color).length > 0) return [];
    return [{ color: playerColor(piece.color), piece: PIECE_NAMES[piece.type], square }];
  });
  const occupied = (color: Color) => CENTER.filter((square) => board.get(square)?.color === color);
  return {
    sideToMove: playerColor(board.turn()),
    legalMoveCount: moves.length,
    checks,
    captures,
    forcingCandidates,
    attackedUndefendedPieces,
    center: {
      whiteOccupied: occupied("w"),
      blackOccupied: occupied("b"),
      contested: CENTER.filter((square) => board.isAttacked(square, "w") && board.isAttacked(square, "b")),
    },
    openFiles: FILES.filter((file) => !whitePawns.has(file) && !blackPawns.has(file)),
    whiteSemiOpenFiles: FILES.filter((file) => !whitePawns.has(file) && blackPawns.has(file)),
    blackSemiOpenFiles: FILES.filter((file) => !blackPawns.has(file) && whitePawns.has(file)),
    white: sidePositionFacts(board, "w"),
    black: sidePositionFacts(board, "b"),
  };
}

function legalPrefix(fen: string, moves: readonly string[], maximum: number): string[] {
  const board = new Chess(fen);
  const accepted: string[] = [];
  for (const candidate of moves.slice(0, maximum)) {
    try {
      const played = board.move({
        from: candidate.slice(0, 2),
        to: candidate.slice(2, 4),
        ...(candidate.length === 5 ? { promotion: candidate[4] } : {}),
      });
      if (!played) break;
      accepted.push(candidate);
    } catch {
      break;
    }
  }
  return accepted;
}

function moverWinPercent(score: EngineScore, color: PlayerColor): number {
  const white = winPercentFromScore(score);
  return color === "white" ? white : 100 - white;
}

function currentHuman(move: MoveAnalysis) {
  return move.human?.version === "human-v2" ? move.human : undefined;
}

/** A practical alternative is exposed only when it is in both Stockfish and
 * Maia, costs at most four canonical win-percentage points, and gains at least
 * eight Maia probability points over the objective first choice. */
function practicalAlternative(move: MoveAnalysis): CoachPracticalAlternativeFacts | undefined {
  const human = currentHuman(move);
  const best = move.stockfish.lines.find((line) => line.rank === 1);
  const objectiveBestUci = best?.pv[0];
  if (!human || !best || !objectiveBestUci) return undefined;
  const objectiveBestMaiaProbability = human.candidates.find((candidate) => candidate.uci === objectiveBestUci)?.probability;
  if (objectiveBestMaiaProbability === undefined) return undefined;
  const bestWinPercent = moverWinPercent(best.score, move.color);
  const supported = move.stockfish.lines.flatMap((line) => {
    const candidateUci = line.pv[0];
    if (!candidateUci || candidateUci === objectiveBestUci) return [];
    const maia = human.candidates.find((candidate) => candidate.uci === candidateUci);
    if (!maia) return [];
    const winPercentCost = Math.max(0, bestWinPercent - moverWinPercent(line.score, move.color));
    if (winPercentCost > 4 || maia.probability < 0.12 || maia.probability - objectiveBestMaiaProbability < 0.08) return [];
    return [{
      uci: candidateUci,
      san: maia.san,
      stockfishRank: line.rank,
      score: line.score,
      maiaProbability: maia.probability,
      objectiveBestUci,
      objectiveBestMaiaProbability,
      winPercentCost,
    }];
  });
  return supported.sort((left, right) => (
    right.maiaProbability - left.maiaProbability || left.winPercentCost - right.winPercentCost
  ))[0];
}

function materialFacts(fen: string): CoachMaterialFacts {
  const white: CoachMaterialFacts["white"] = { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 };
  const black: CoachMaterialFacts["black"] = { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 };
  for (const row of new Chess(fen).board()) {
    for (const piece of row) {
      if (!piece || piece.type === "k") continue;
      const name = PIECE_NAMES[piece.type];
      const side = piece.color === "w" ? white : black;
      side[name] += 1;
    }
  }
  const value = (pieces: CoachMaterialFacts["white"]) => (
    pieces.pawn * MATERIAL_CP.p
    + pieces.knight * MATERIAL_CP.n
    + pieces.bishop * MATERIAL_CP.b
    + pieces.rook * MATERIAL_CP.r
    + pieces.queen * MATERIAL_CP.q
  );
  return { white, black, balanceCp: value(white) - value(black) };
}

function candidateFacts(lines: MoveAnalysis["stockfish"]["lines"]): CoachCandidateFacts[] {
  return lines.map((line) => ({ rank: line.rank, score: line.score, pv: [...line.pv] }));
}

function replayMoveFacts(move: MoveAnalysis): { isCapture: boolean; givesCheck: boolean } {
  const board = new Chess(move.fenBefore);
  const played = board.move({
    from: move.uci.slice(0, 2),
    to: move.uci.slice(2, 4),
    ...(move.uci.length === 5 ? { promotion: move.uci[4] } : {}),
  });
  if (!played) throw new Error(`Canonical move ${move.uci} is not legal in its stored FEN.`);
  return { isCapture: played.isCapture(), givesCheck: board.inCheck() };
}

export function buildMoveCoachFacts(analysis: AnyGameAnalysis, ply: number): CoachMoveFacts {
  const move = analysis.moves[ply - 1];
  if (!move || move.ply !== ply) throw new RangeError(`No canonical move analysis exists for ply ${ply}.`);
  const nextPosition = analysis.moves[ply]?.stockfish;
  const replay = replayMoveFacts(move);
  const consequenceMoves = nextPosition?.fen === move.fenAfter
    ? legalPrefix(move.fenAfter, nextPosition.lines[0]?.pv ?? [], 4)
    : [];
  const alternative = practicalAlternative(move);
  const human = currentHuman(move);
  return {
    factsVersion: 1,
    position: { fenBefore: move.fenBefore, fenAfter: move.fenAfter, phase: move.phase },
    move: {
      ply: move.ply,
      color: move.color,
      san: move.san,
      uci: move.uci,
      classification: move.classification,
      ...("quality" in move ? { quality: move.quality, annotations: [...move.annotations] } : {}),
      accuracy: move.accuracy,
    },
    objective: {
      evaluationBefore: move.evaluationBefore,
      playedMoveScore: move.playedMoveScore,
      evaluationAfter: move.evaluationAfter,
      ...(move.stockfish.bestMove === undefined ? {} : { bestMove: move.stockfish.bestMove }),
      candidates: candidateFacts(move.stockfish.lines),
      afterCandidates: nextPosition?.fen === move.fenAfter ? candidateFacts(nextPosition.lines) : [],
      classificationReason: move.classificationReason,
    },
    ...(human === undefined ? {} : { human }),
    boardFacts: {
      materialBefore: materialFacts(move.fenBefore),
      materialAfter: materialFacts(move.fenAfter),
      isCapture: replay.isCapture,
      givesCheck: replay.givesCheck,
      motifs: [...move.motifs],
      positionBefore: positionUnderstanding(move.fenBefore),
      positionAfter: positionUnderstanding(move.fenAfter),
      ...(consequenceMoves.length === 0 ? {} : {
        futureConsequence: {
          start: "after" as const,
          moves: consequenceMoves,
          ...(consequenceMoves[0] === undefined ? {} : { opponentBestResponse: consequenceMoves[0] }),
        },
      }),
      ...(alternative === undefined ? {} : { practicalAlternative: alternative }),
    },
    ...(analysis.opening === undefined ? {} : { opening: analysis.opening }),
    phaseAccuracy: {
      ...(analysis.white.phaseAccuracy[move.phase] === undefined
        ? {}
        : { white: analysis.white.phaseAccuracy[move.phase] }),
      ...(analysis.black.phaseAccuracy[move.phase] === undefined
        ? {}
        : { black: analysis.black.phaseAccuracy[move.phase] }),
    },
  };
}

/**
 * One side's facts, copied from the canonical record.
 *
 * A V1 analysis has no quality/annotation layers, so they are simply absent
 * rather than invented; the deterministic summary falls back to the projection
 * only in that case.
 */
function playerFacts(player: PlayerAnalysis): CoachGamePlayerFacts {
  // A V1 record is a PlayerAnalysis and a V2 record is its extension, so the
  // optional layers are read through the V2 shape and simply stay absent on V1.
  const v2 = player as Partial<PlayerAnalysisV2>;
  return {
    color: player.color,
    ...(player.accuracy === undefined ? {} : { accuracy: player.accuracy }),
    phaseAccuracy: { ...player.phaseAccuracy },
    classificationCounts: { ...player.classificationCounts },
    ...(v2.qualityCounts === undefined ? {} : { qualityCounts: { ...v2.qualityCounts } }),
    ...(v2.annotationCounts === undefined ? {} : { annotationCounts: { ...v2.annotationCounts } }),
  };
}

export function buildGameCoachFacts(analysis: AnyGameAnalysis): CoachGameFacts {
  return {
    factsVersion: 1,
    headers: { ...analysis.game.headers },
    ...(analysis.opening === undefined ? {} : { opening: analysis.opening }),
    division: analysis.division,
    players: { white: playerFacts(analysis.white), black: playerFacts(analysis.black) },
    moves: analysis.moves.map((move) => {
      const human = currentHuman(move);
      return {
        ply: move.ply,
        color: move.color,
        san: move.san,
        uci: move.uci,
        phase: move.phase,
        classification: move.classification,
        ...("quality" in move ? { quality: move.quality, annotations: [...move.annotations] } : {}),
        accuracy: move.accuracy,
        winPercentLoss: move.classificationReason.winPercentLoss,
        ...(move.classificationReason.verification?.status === "verified" ? { verified: true } : {}),
        ...(human === undefined ? {} : { humanProbability: human.playedMoveProbability }),
        ...(human === undefined ? {} : { humanDifficulty: human.findDifficulty.label }),
      };
    }),
    criticalMoments: analysis.criticalMoments.map((moment) => ({ ...moment })),
  };
}

function scoreLabel(score: EngineScore): string {
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `-M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function validatePv(fen: string, pv: string[], maximum = 6): Array<{ uci: string; san: string }> {
  const board = new Chess(fen);
  const moves: Array<{ uci: string; san: string }> = [];
  for (const uci of pv.slice(0, maximum)) {
    const move = board.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length === 5 ? { promotion: uci[4] } : {}),
    });
    if (!move) break;
    moves.push({ uci, san: move.san });
  }
  return moves;
}

function deterministicLine(facts: CoachMoveFacts, language: CoachLanguage): CoachValidatedLine[] {
  const consequence = facts.boardFacts.futureConsequence;
  if (consequence && consequence.moves.length > 0) {
    const moves = validatePv(facts.position.fenAfter, consequence.moves, 4);
    if (moves.length > 0) return [{
      label: language === "zh-CN" ? "接下来会发生什么" : "What happens next",
      start: "after",
      moves,
    }];
  }
  const played = facts.objective.candidates.find((candidate) => candidate.pv[0] === facts.move.uci);
  const candidate = played ?? facts.objective.candidates[0];
  if (!candidate) return [];
  const moves = validatePv(facts.position.fenBefore, candidate.pv, 4);
  if (moves.length === 0) return [];
  return [{
    label: language === "zh-CN"
      ? (played ? "实战着法的引擎变化" : "引擎最佳变化")
      : (played ? "Engine line after the played move" : "Engine-best line"),
    start: "before",
    moves,
  }];
}

const COSTLY_CLASSIFICATIONS: MoveClassification[] = ["inaccuracy", "mistake", "blunder", "miss", "missed_win", "missed_mate"];

export function buildDeterministicMoveCoach(
  facts: CoachMoveFacts,
  language: CoachLanguage,
  fallbackReason: string,
): CoachExplanation {
  const costly = COSTLY_CLASSIFICATIONS.includes(facts.move.classification);
  const human = facts.human;
  const scoreTransition = `${scoreLabel(facts.objective.evaluationBefore)} → ${scoreLabel(facts.objective.playedMoveScore)}`;
  const source = {
    provider: "deterministic" as const,
    model: "canonical-facts",
    language,
    promptVersion: COACH_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    fallbackReason,
  };
  const lines = deterministicLine(facts, language);
  const after = facts.boardFacts.positionAfter;
  const practical = facts.boardFacts.practicalAlternative;
  const forcingCount = after.forcingCandidates.length;
  const looseCount = after.attackedUndefendedPieces.length;
  if (language === "zh-CN") {
    return {
      headline: `${facts.move.san}：${facts.move.classification.replaceAll("_", " ")}`,
      summary: `这步的客观标签为 ${facts.move.classification}，准确率 ${facts.move.accuracy.toFixed(1)}。Stockfish 白方视角评分为 ${scoreTransition}。`,
      ...(costly
        ? { whatWentWrong: `这步让行棋方损失了 ${facts.objective.classificationReason.winPercentLoss.toFixed(1)} 个胜率百分点。` }
        : { whyMoveWorks: "这步保持了已记录的客观局面质量。" }),
      ...(facts.objective.bestMove === undefined || facts.objective.bestMove === facts.move.uci
        ? {}
        : { betterPlan: "可查看下方经过规则验证的引擎最佳变化。" }),
      ...(human === undefined ? {} : {
        humanPerspective: `Maia ${human.model} 在 ${human.targetElo} Elo 条件下给这步 ${(human.playedMoveProbability * 100).toFixed(1)}% 的模型概率；这不是实测人群频率。`,
      }),
      ...(facts.boardFacts.motifs.length === 0 ? {} : { tacticalIdea: `已验证的战术证据：${facts.boardFacts.motifs.join("、")}。` }),
      trainingTip: costly ? "训练时先列出至少两个候选着法，再比较强制应手。" : "复盘时尝试在不看引擎的情况下重建这步的候选变化。",
      notice: looseCount > 0
        ? `先注意：走后局面有 ${looseCount} 个受攻且无保护的非王棋子。`
        : `先注意：走后局面有 ${forcingCount} 个可验证的将军或吃子候选。`,
      moveIdea: facts.boardFacts.givesCheck
        ? "你的着法直接将军。"
        : facts.boardFacts.isCapture ? "你的着法改变了确定性的子力关系。" : "你的着法应从候选着法与引擎评分变化来理解。",
      ...(costly ? { problem: `问题是这步损失了 ${facts.objective.classificationReason.winPercentLoss.toFixed(1)} 个胜率百分点。` } : {}),
      ...(facts.boardFacts.futureConsequence === undefined ? {} : { consequence: `走后局面有一条最多四步的合法 Stockfish 后果线。` }),
      ...(practical === undefined ? {} : {
        practicalAlternative: `${practical.san} 是 Stockfish 第 ${practical.stockfishRank} 候选，客观代价 ${practical.winPercentCost.toFixed(1)} 个胜率百分点；Maia 在 ${facts.human?.targetElo ?? "所选"} Elo 下给出 ${(practical.maiaProbability * 100).toFixed(1)}% 模型概率。`,
      }),
      takeaway: costly ? "记住：先比较强制应手，再决定候选着法。" : "记住：把这步的想法和经过验证的后续着法连起来。",
      confidence: "high",
      validatedLines: lines,
      grounding: { factsVersion: 1, structuredFactsOnly: true, removedMoveMentions: [], removedUnsupportedClaims: [], validatedLineCount: lines.length },
      source,
    };
  }
  return {
    headline: `${facts.move.san}: ${facts.move.classification.replaceAll("_", " ")}`,
    summary: `The objective label is ${facts.move.classification} with ${facts.move.accuracy.toFixed(1)} Accuracy. The Stockfish White-POV score is ${scoreTransition}.`,
    ...(costly
      ? { whatWentWrong: `The move cost the mover ${facts.objective.classificationReason.winPercentLoss.toFixed(1)} win-percentage points.` }
      : { whyMoveWorks: "The move preserves the objective position quality recorded by the canonical analysis." }),
    ...(facts.objective.bestMove === undefined || facts.objective.bestMove === facts.move.uci
      ? {}
      : { betterPlan: "Use the rules-validated engine line below to compare the stronger plan." }),
    ...(human === undefined ? {} : {
      humanPerspective: `Maia ${human.model} assigns this move ${(human.playedMoveProbability * 100).toFixed(1)}% model probability at ${human.targetElo} Elo; this is not an observed population frequency.`,
    }),
    ...(facts.boardFacts.motifs.length === 0 ? {} : { tacticalIdea: `Validated tactical evidence: ${facts.boardFacts.motifs.join(", ")}.` }),
    trainingTip: costly ? "List at least two candidates and compare forcing replies before committing." : "Reconstruct the candidate line without the engine during review.",
    notice: looseCount > 0
      ? `First notice the ${looseCount} attacked and undefended non-king piece${looseCount === 1 ? "" : "s"} in the resulting position.`
      : `First notice the ${forcingCount} rules-verified check or capture candidate${forcingCount === 1 ? "" : "s"} in the resulting position.`,
    moveIdea: facts.boardFacts.givesCheck
      ? "Your move gives check directly."
      : facts.boardFacts.isCapture ? "Your move changes the deterministic material count." : "Understand the move through its candidate status and verified score transition.",
    ...(costly ? { problem: `The problem is a ${facts.objective.classificationReason.winPercentLoss.toFixed(1)}-point loss in winning chances.` } : {}),
    ...(facts.boardFacts.futureConsequence === undefined ? {} : { consequence: "The canonical facts provide a legal Stockfish consequence line of up to four plies from the resulting position." }),
    ...(practical === undefined ? {} : {
      practicalAlternative: `${practical.san} is Stockfish candidate #${practical.stockfishRank} with a ${practical.winPercentCost.toFixed(1)}-point objective cost and ${(practical.maiaProbability * 100).toFixed(1)}% Maia model probability at ${facts.human?.targetElo ?? "the selected"} Elo.`,
    }),
    takeaway: costly ? "Remember: compare forcing replies before choosing between candidates." : "Remember: connect the move's idea to its rules-validated consequence line.",
    confidence: "high",
    validatedLines: lines,
    grounding: { factsVersion: 1, structuredFactsOnly: true, removedMoveMentions: [], removedUnsupportedClaims: [], validatedLineCount: lines.length },
    source,
  };
}

function countLabel(value: number, singular: string): string {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Ordinary quality counts.
 *
 * A V2 record separates continuous `quality` from special `annotations`, and the
 * summary must consume the same two layers as the Review tables. A V1 record has
 * only the compatibility projection, which is the only quality evidence it has.
 */
function playerQuality(player: CoachGamePlayerFacts, quality: MoveQuality): number {
  if (player.qualityCounts !== undefined) return player.qualityCounts[quality] ?? 0;
  return player.classificationCounts[quality] ?? 0;
}

/**
 * A V1 record has no annotations. Its compatibility projection uses the same
 * word for most of them, projects Critical as `great`, and has no Sacrifice.
 */
const ANNOTATION_PROJECTION: Partial<Record<MoveAnnotation, MoveClassification>> = {
  brilliant: "brilliant",
  critical: "great",
  book: "book",
  forced: "forced",
  missed_win: "missed_win",
  missed_mate: "missed_mate",
};

/** Special-semantics annotation counts, with the same V1 fallback as quality. */
function playerAnnotation(player: CoachGamePlayerFacts, annotation: MoveAnnotation): number {
  if (player.annotationCounts !== undefined) return player.annotationCounts[annotation] ?? 0;
  const projected = ANNOTATION_PROJECTION[annotation];
  return projected === undefined ? 0 : player.classificationCounts[projected] ?? 0;
}

function bothSides(facts: CoachGameFacts, count: (player: CoachGamePlayerFacts) => number): number {
  return count(facts.players.white) + count(facts.players.black);
}

const COSTLY_QUALITIES: readonly MoveQuality[] = ["inaccuracy", "mistake", "blunder"];

/**
 * One short sentence per key moment, chosen from that move's own canonical
 * evidence.
 *
 * A verified annotation says why the moment matters. Without one, the sentence
 * states the recorded change and nothing more: a blunder label is evidence of a
 * large loss, never evidence of which tactic was missed.
 */
function criticalInsight(move: CoachGameMoveFacts | undefined, moment: CriticalMoment, language: CoachLanguage): string {
  const swing = moment.winPercentSwing;
  const annotations = move?.annotations ?? [];
  const zh = language === "zh-CN";
  if (annotations.includes("missed_mate")) return zh ? "这里本有强制将杀，实战着法放弃了它。" : "A forced mate was available here and the move let it go.";
  if (annotations.includes("missed_win")) return zh ? "这里本有取胜的连续着法，实战着法放弃了它。" : "A winning continuation was available here and the move let it go.";
  if (annotations.includes("brilliant")) return zh ? "经过验证的精彩着法：它投入了真实子力，而引擎的最佳应手仍然保留补偿。" : "A verified brilliant move: it invests material and the engine's best reply keeps the compensation.";
  if (annotations.includes("critical")) return zh ? "这里只有唯一合理选择，其他候选至少差十个胜率百分点。" : "This was the only reasonable choice: every alternative was at least ten win-percentage points worse.";
  if (move !== undefined && (move.quality === undefined ? COSTLY_CLASSIFICATIONS.includes(move.classification) : COSTLY_QUALITIES.includes(move.quality))) {
    return zh ? `这步损失了 ${swing.toFixed(1)} 个胜率百分点。` : `This move cost ${swing.toFixed(1)} win-percentage points.`;
  }
  return swing > 0
    ? (zh ? `本局在这步记录了 ${swing.toFixed(1)} 个胜率百分点的波动。` : `The analysis records a ${swing.toFixed(1)}-point win-percentage swing at this move.`)
    : (zh ? "这步被记录为关键节点，但没有记录胜率损失。" : "This move was recorded as a key moment without a win-percentage loss.");
}

export function buildDeterministicGameCoach(
  facts: CoachGameFacts,
  language: CoachLanguage,
  fallbackReason: string,
): GameCoachSummary {
  const bestMoves = bothSides(facts, (player) => playerQuality(player, "best"));
  const excellentMoves = bothSides(facts, (player) => playerQuality(player, "excellent"));
  const blunders = bothSides(facts, (player) => playerQuality(player, "blunder"));
  const mistakes = bothSides(facts, (player) => playerQuality(player, "mistake"));
  const inaccuracies = bothSides(facts, (player) => playerQuality(player, "inaccuracy"));
  const brilliantMoves = bothSides(facts, (player) => playerAnnotation(player, "brilliant"));
  const criticalChoices = bothSides(facts, (player) => playerAnnotation(player, "critical"));
  const missedWins = bothSides(facts, (player) => playerAnnotation(player, "missed_win"));
  const missedMates = bothSides(facts, (player) => playerAnnotation(player, "missed_mate"));
  const whiteAccuracy = facts.players.white.accuracy;
  const blackAccuracy = facts.players.black.accuracy;
  // Confidence describes how much of the record was re-searched, which is what
  // the summary's claims actually rest on. It is not a fixed value.
  const verifiedMoves = facts.moves.filter((move) => move.verified === true).length;
  const searchState = verifiedMoves === 0 ? "baseline" : verifiedMoves === facts.moves.length ? "verified" : "partial";
  const confidence = searchState === "verified" ? "high" : searchState === "partial" ? "medium" : "low";
  const source = {
    provider: "deterministic" as const,
    model: "canonical-facts",
    language,
    promptVersion: COACH_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    fallbackReason,
  };
  const criticalMoments = facts.criticalMoments.slice(0, 5).map((moment) => ({
    ply: moment.ply,
    insight: criticalInsight(facts.moves[moment.ply - 1], moment, language),
  }));
  const severeErrors = [
    blunders > 0 ? countLabel(blunders, language === "zh-CN" ? "个严重失误" : "blunder") : "",
    missedWins > 0 ? (language === "zh-CN" ? `${missedWins} 次胜势遗漏` : countLabel(missedWins, "missed win")) : "",
    missedMates > 0 ? (language === "zh-CN" ? `${missedMates} 次将杀遗漏` : countLabel(missedMates, "missed mate")) : "",
  ].filter((part) => part !== "");
  const lesserErrors = mistakes + inaccuracies;

  if (language === "zh-CN") {
    const recommendations = [
      ...(severeErrors.length > 0 ? [{ title: "失误复查", reason: `本局记录了 ${joinList(severeErrors)}。`, focus: "每步先列出将军、吃子与直接威胁，再决定着法。" }] : []),
      ...(lesserErrors > 0 ? [{ title: "候选着法比较", reason: `本局记录了 ${countLabel(lesserErrors, "处不准确或错误")}。`, focus: "在安静局面固定比较两个候选计划。" }] : []),
      { title: "关键节点重放", reason: `复盘标记了 ${facts.criticalMoments.length} 个关键节点。`, focus: "隐藏引擎后重新计算这些局面。" },
    ].slice(0, 3);
    const strengths = [
      ...(brilliantMoves > 0 ? [`有 ${brilliantMoves} 步经过验证的精彩着法。`] : []),
      ...(criticalChoices > 0 ? [`有 ${criticalChoices} 个局面只有唯一合理选择，并且走对了。`] : []),
      ...(bestMoves > 0 ? [`有 ${bestMoves} 步与引擎首选一致。`] : []),
    ].slice(0, 2);
    return {
      headline: "结构化整盘复盘",
      summary: `白方准确率 ${whiteAccuracy?.toFixed(1) ?? "—"}，黑方准确率 ${blackAccuracy?.toFixed(1) ?? "—"}；${bestMoves > 0 ? `${countLabel(bestMoves, "步与引擎首选一致")}${excellentMoves > 0 ? `，另有 ${excellentMoves} 步的损失在两个胜率百分点以内` : ""}。` : "没有与引擎首选一致的着法。"}`,
      strengths: strengths.length > 0 ? strengths : ["没有足够证据标记引擎首选着法。"],
      weaknesses: [severeErrors.length > 0
        ? `本局记录了 ${joinList(severeErrors)}。`
        : lesserErrors > 0 ? `本局记录了 ${countLabel(lesserErrors, "处不准确或错误")}。` : "没有错误超过记录的阈值。"],
      criticalMoments,
      trainingRecommendations: recommendations,
      confidence,
      grounding: { factsVersion: 1, structuredFactsOnly: true, removedMoveMentions: [], removedUnsupportedClaims: [], validatedLineCount: 0 },
      source,
    };
  }
  const recommendations = [
    ...(severeErrors.length > 0 ? [{ title: "Error review", reason: `The game recorded ${joinList(severeErrors)}.`, focus: "List forcing moves, captures and direct threats before choosing a move." }] : []),
    ...(lesserErrors > 0 ? [{ title: "Candidate comparison", reason: `${countLabel(lesserErrors, "inaccuracy or mistake")} were recorded.`, focus: "Compare two candidate plans in quiet positions." }] : []),
    { title: "Key-moment replay", reason: `${facts.criticalMoments.length} key moments were recorded.`, focus: "Recalculate those positions with the engine hidden." },
  ].slice(0, 3);
  const strengths = [
    ...(brilliantMoves > 0 ? [`${countLabel(brilliantMoves, "verified brilliant move")} ${brilliantMoves === 1 ? "was" : "were"} recorded.`] : []),
    ...(criticalChoices > 0 ? [`${countLabel(criticalChoices, "position")} had one reasonable choice, and it was played.`] : []),
    ...(bestMoves > 0 ? [`${countLabel(bestMoves, "move")} matched the engine's first choice.`] : []),
  ].slice(0, 2);
  return {
    headline: "Structured game review",
    summary: `White Accuracy is ${whiteAccuracy?.toFixed(1) ?? "—"} and Black Accuracy is ${blackAccuracy?.toFixed(1) ?? "—"}; ${bestMoves > 0 ? `${countLabel(bestMoves, "move")} matched the engine's first choice${excellentMoves > 0 ? `, and ${excellentMoves} more stayed within two win-percentage points` : ""}.` : "no move matched the engine's first choice."}`,
    strengths: strengths.length > 0 ? strengths : ["There is not enough evidence for a best-move claim."],
    weaknesses: [severeErrors.length > 0
      ? `The game recorded ${joinList(severeErrors)}.`
      : lesserErrors > 0 ? `${countLabel(lesserErrors, "inaccuracy or mistake")} were recorded.` : "No error crossed the recorded thresholds."],
    criticalMoments,
    trainingRecommendations: recommendations,
    confidence,
    grounding: { factsVersion: 1, structuredFactsOnly: true, removedMoveMentions: [], removedUnsupportedClaims: [], validatedLineCount: 0 },
    source,
  };
}
