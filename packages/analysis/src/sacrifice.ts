import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type { EngineLine, EngineScore, PlayerColor, SacrificeEvidence } from "@chess-review/shared";
import { scoreToAccuracyCentipawns } from "./accuracy";
import { winPercentFromScore } from "./win-percent";

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  // The king must be selected after every ordinary attacker in SEE.
  k: 20_000,
};

function opposite(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function kingSquare(chess: Chess, color: Color): Square | null {
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (piece && piece.type === "k" && piece.color === color) return piece.square as Square;
    }
  }
  return null;
}

/**
 * Whether virtually capturing `to` from `from` would leave the mover's own king
 * attacked. chess.js `attackers()` is purely geometric, so an absolutely pinned
 * piece is otherwise treated as a legal attacker or defender; that inflates the
 * exchange value and can turn an ordinary recapture into a fabricated
 * "sacrifice". The virtual capture is undone before returning.
 */
function exposesOwnKing(chess: Chess, from: Square, to: Square): boolean {
  const moving = chess.get(from);
  if (!moving) return true;
  const captured = chess.get(to);
  const snapshot = chess.fen();
  if (captured) chess.remove(to);
  chess.remove(from);
  chess.put(moving, to);
  const king = kingSquare(chess, moving.color);
  const exposed = king === null || chess.attackers(king, opposite(moving.color)).length > 0;
  chess.load(snapshot);
  return exposed;
}

function exchangeGain(chess: Chess, square: Square, attackingColor: Color): number {
  const target = chess.get(square);
  if (!target) return 0;
  const attackers = chess.attackers(square, attackingColor)
    .filter((attacker) => chess.get(attacker)?.color === attackingColor)
    // A pinned piece cannot legally take part in the exchange on this square.
    .filter((attacker) => !exposesOwnKing(chess, attacker, square));
  if (attackers.length === 0) return 0;

  const cheapest = attackers.reduce((best, candidate) => {
    const bestPiece = chess.get(best);
    const candidatePiece = chess.get(candidate);
    if (!bestPiece || !candidatePiece) return best;
    return PIECE_VALUE[candidatePiece.type] < PIECE_VALUE[bestPiece.type] ? candidate : best;
  });
  const attacker = chess.get(cheapest);
  if (!attacker) return 0;

  const snapshot = chess.fen();
  chess.remove(cheapest);
  chess.remove(square);
  chess.put(attacker, square);
  const reply = exchangeGain(chess, square, opposite(attackingColor));
  chess.load(snapshot);

  // Either start/continue the exchange or stand pat.
  return Math.max(0, PIECE_VALUE[target.type] - reply);
}

/**
 * Static Exchange Evaluation for the side initiating a capture on `square`.
 * Recomputing attackers after each virtual capture preserves x-ray attackers.
 */
export function staticExchangeGain(fen: string, square: Square, attackingColor: Color): number {
  return exchangeGain(new Chess(fen), square, attackingColor);
}

function materialBalance(chess: Chess, color: Color): number {
  let balance = 0;
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece || piece.type === "k") continue;
      balance += (piece.color === color ? 1 : -1) * PIECE_VALUE[piece.type];
    }
  }
  return balance;
}

function applyUci(chess: Chess, uci: string): boolean {
  try {
    return chess.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: (uci[4] as PieceSymbol | undefined) ?? "q",
    }) !== null;
  } catch {
    return false;
  }
}

function moverWinPercent(score: EngineScore, color: PlayerColor): number {
  const white = winPercentFromScore(score);
  return color === "white" ? white : 100 - white;
}

function moverEquivalentCp(score: EngineScore, color: PlayerColor): number {
  const whiteCp = scoreToAccuracyCentipawns(score);
  return color === "white" ? whiteCp : -whiteCp;
}

export interface SacrificeDetectionInput {
  fenBefore: string;
  fenAfter: string;
  uci: string;
  color: PlayerColor;
  scoreBefore: EngineScore;
  playedMoveScore: EngineScore;
  playedLine: EngineLine;
}

/**
 * Produces evidence only for a material offer of at least one pawn. A
 * `genuine: false` result is retained for unsupported offers so the
 * classifier can explain why they were excluded from Brilliant.
 */
export function detectSacrifice(input: SacrificeDetectionInput): SacrificeEvidence | undefined {
  const before = new Chess(input.fenBefore);
  const from = input.uci.slice(0, 2) as Square;
  const to = input.uci.slice(2, 4) as Square;
  const movedPiece = before.get(from);
  if (!movedPiece || movedPiece.type === "p" || movedPiece.type === "k") return undefined;

  const captured = before.get(to);
  const opponent: Color = input.color === "white" ? "b" : "w";
  const opponentGain = staticExchangeGain(input.fenAfter, to, opponent);
  const recoveredOnMove = captured ? PIECE_VALUE[captured.type] : 0;
  const netSeeInvestment = Math.max(0, opponentGain - recoveredOnMove);

  const replay = new Chess(input.fenBefore);
  const initialBalance = materialBalance(replay, movedPiece.color);
  const deficits: number[] = [];
  let appliedPlies = 0;
  for (const uci of input.playedLine.pv) {
    if (!applyUci(replay, uci)) break;
    appliedPlies += 1;
    deficits.push(Math.max(0, initialBalance - materialBalance(replay, movedPiece.color)));
  }
  const pvMaximumDeficit = Math.max(0, ...deficits);
  const finalDeficit = deficits.at(-1) ?? 0;
  const sacrificedMaterial = Math.max(netSeeInvestment, pvMaximumDeficit);
  if (sacrificedMaterial < 100) return undefined;

  const recoveredWithinPv = Math.max(0, pvMaximumDeficit - finalDeficit);
  const deficitAfterBestResponse = deficits[1] ?? 0;
  const deficitAfterImmediateReply = deficits[2] ?? deficitAfterBestResponse;
  const immediatelyRecovered = deficitAfterBestResponse >= 100 && deficitAfterImmediateReply < 100;
  const winPercentLoss = Math.max(
    0,
    moverWinPercent(input.scoreBefore, input.color) - moverWinPercent(input.playedMoveScore, input.color),
  );
  const survivesBestResponse = appliedPlies >= 2 && winPercentLoss <= 1;
  const evaluationDelta = moverEquivalentCp(input.playedMoveScore, input.color)
    - moverEquivalentCp(input.scoreBefore, input.color);
  const compensationCp = Math.max(0, sacrificedMaterial + evaluationDelta);
  const see = -opponentGain;
  const genuine = PIECE_VALUE[movedPiece.type] >= PIECE_VALUE.n
    && netSeeInvestment >= 100
    && see <= -100
    && survivesBestResponse
    && compensationCp >= sacrificedMaterial - 100
    && !immediatelyRecovered;

  return {
    sacrificedMaterial,
    see,
    compensationCp,
    survivesBestResponse,
    recoveredWithinPv,
    genuine,
  };
}
