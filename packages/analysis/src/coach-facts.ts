import { Chess, SQUARES, type Color, type Square } from "chess.js";
import type {
  CoachCandidateFacts,
  CoachExplanation,
  CoachGameFacts,
  CoachLanguage,
  CoachMaterialFacts,
  CoachMoveFacts,
  CoachPositionUnderstanding,
  CoachPracticalAlternativeFacts,
  CoachValidatedLine,
  EngineScore,
  AnyGameAnalysis,
  GameCoachSummary,
  MoveAnalysis,
  MoveClassification,
  PlayerColor,
} from "@chess-review/shared";
import { winPercentFromScore } from "./win-percent";

export const COACH_PROMPT_VERSION = "coach-v3";

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

export function buildGameCoachFacts(analysis: AnyGameAnalysis): CoachGameFacts {
  return {
    factsVersion: 1,
    headers: { ...analysis.game.headers },
    ...(analysis.opening === undefined ? {} : { opening: analysis.opening }),
    division: analysis.division,
    players: { white: analysis.white, black: analysis.black },
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

function totalCounts(facts: CoachGameFacts, classifications: MoveClassification[]): number {
  return classifications.reduce((total, classification) => (
    total
    + (facts.players.white.classificationCounts[classification] ?? 0)
    + (facts.players.black.classificationCounts[classification] ?? 0)
  ), 0);
}

export function buildDeterministicGameCoach(
  facts: CoachGameFacts,
  language: CoachLanguage,
  fallbackReason: string,
): GameCoachSummary {
  const tacticalErrors = totalCounts(facts, ["blunder", "miss", "missed_win", "missed_mate"]);
  const smallerErrors = totalCounts(facts, ["inaccuracy", "mistake"]);
  const strongMoves = totalCounts(facts, ["brilliant", "great", "best", "excellent"]);
  const whiteAccuracy = facts.players.white.accuracy;
  const blackAccuracy = facts.players.black.accuracy;
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
    insight: language === "zh-CN"
      ? `记录了 ${moment.winPercentSwing.toFixed(1)} 个胜率百分点的波动。`
      : `The canonical analysis records a ${moment.winPercentSwing.toFixed(1)}-point win-percentage swing.`,
  }));
  if (language === "zh-CN") {
    const trainingRecommendations = [
      ...(tacticalErrors > 0 ? [{ title: "战术扫描", reason: `本局有 ${tacticalErrors} 个严重战术或胜势遗漏。`, focus: "每步检查将军、吃子和直接威胁。" }] : []),
      ...(smallerErrors > 0 ? [{ title: "候选着法比较", reason: `本局有 ${smallerErrors} 个不准确或错误。`, focus: "在安静局面固定比较两个候选计划。" }] : []),
      { title: "关键节点重放", reason: `复盘标记了 ${facts.criticalMoments.length} 个关键节点。`, focus: "隐藏引擎后重新计算这些局面。" },
    ].slice(0, 3);
    return {
      headline: "结构化整盘复盘",
      summary: `白方准确率 ${whiteAccuracy?.toFixed(1) ?? "—"}，黑方准确率 ${blackAccuracy?.toFixed(1) ?? "—"}；共记录 ${strongMoves} 步高质量着法。`,
      strengths: [strongMoves > 0 ? `双方共走出 ${strongMoves} 步 Best 或更高质量着法。` : "本局没有足够证据标记 Best 以上着法。"],
      weaknesses: [tacticalErrors > 0 ? `需要优先处理 ${tacticalErrors} 个严重战术节点。` : "未检测到严重战术标签。"],
      criticalMoments,
      trainingRecommendations,
      confidence: "high",
      grounding: { factsVersion: 1, structuredFactsOnly: true, removedMoveMentions: [], removedUnsupportedClaims: [], validatedLineCount: 0 },
      source,
    };
  }
  const trainingRecommendations = [
    ...(tacticalErrors > 0 ? [{ title: "Tactical scan", reason: `${tacticalErrors} severe tactical or winning-chance errors were recorded.`, focus: "Check forcing moves, captures and direct threats on every move." }] : []),
    ...(smallerErrors > 0 ? [{ title: "Candidate comparison", reason: `${smallerErrors} inaccuracies or mistakes were recorded.`, focus: "Compare two candidate plans in quiet positions." }] : []),
    { title: "Critical-moment replay", reason: `${facts.criticalMoments.length} critical moments were recorded.`, focus: "Recalculate those positions with the engine hidden." },
  ].slice(0, 3);
  return {
    headline: "Structured game review",
    summary: `White Accuracy is ${whiteAccuracy?.toFixed(1) ?? "—"} and Black Accuracy is ${blackAccuracy?.toFixed(1) ?? "—"}; ${strongMoves} high-quality moves were recorded.`,
    strengths: [strongMoves > 0 ? `${strongMoves} moves were classified Best or better.` : "There is not enough evidence for a Best-or-better strength claim."],
    weaknesses: [tacticalErrors > 0 ? `Prioritize the ${tacticalErrors} severe tactical moments.` : "No severe tactical labels were detected."],
    criticalMoments,
    trainingRecommendations,
    confidence: "high",
    grounding: { factsVersion: 1, structuredFactsOnly: true, removedMoveMentions: [], removedUnsupportedClaims: [], validatedLineCount: 0 },
    source,
  };
}
