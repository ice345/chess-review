"use client";

import { Chessboard } from "react-chessboard";
import type { MaiaPositionAnalysis, StockfishMoveAnalysis } from "@chess-review/shared";
import { legalBoardDestinations } from "@chess-review/chess-core";
import { BoardQualityBadge, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { humanCandidateArrows, stockfishCandidateArrows } from "../../../lib/board-analysis-arrows";
import { boardMoveHintStyles } from "../../../lib/board-move-hints";
import { chessboardPieces } from "../../../lib/board-pieces";

/* Acceptance environment for the Feather Porcelain pieces and the Windowlight
   board. It renders the production piece renderer and the production board
   appearance on the production square tokens, so a piece or board regression is
   visible here instead of only on the starting position. */

const PIECE_KEYS = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;
const SIZES = [32, 40, 56, 72] as const;
const FIXTURE_FEN = "1k6/8/8/2p5/8/3N4/8/1K6 w - - 0 1";

const STOCKFISH_FIXTURE: StockfishMoveAnalysis = {
  fen: FIXTURE_FEN,
  score: { kind: "cp", cp: 24 },
  bestMove: "d3b4",
  lines: [
    { rank: 1, score: { kind: "cp", cp: 24 }, depth: 12, pv: ["d3b4"] },
    { rank: 2, score: { kind: "cp", cp: 9 }, depth: 12, pv: ["d3e5"] },
  ],
  depth: 12,
};

const candidate = (uci: string, san: string, probability: number, policyRank: number) => ({ uci, san, probability, policyRank });

const MAIA_FIXTURE: MaiaPositionAnalysis = {
  kind: "position-analysis",
  fen: FIXTURE_FEN,
  sideToMove: "white",
  model: "maia3-5m",
  targetElo: 1500,
  selfElo: 1500,
  opponentElo: 1500,
  candidates: [candidate("d3b4", "Nb4", .31, 1), candidate("d3f4", "Nf4", .22, 2)],
  evaluatedCandidates: [candidate("d3b4", "Nb4", .31, 1), candidate("d3f4", "Nf4", .22, 2)],
  candidateProbabilityMass: .53,
  rootWdl: { win: .42, draw: .3, loss: .28 },
  expectedHumanMove: "d3b4",
  modelPrediction: true,
};

const pieces = chessboardPieces("liz-blue");
const destinations = legalBoardDestinations(FIXTURE_FEN, "d3");
const moveHints = boardMoveHintStyles("d3", destinations);
const captureCount = destinations.filter((move) => move.isCapture).length;

export default function PieceFixturePage() {
  return (
    <main className="quality-fixture-page">
      <header>
        <span>LOCAL VISUAL FIXTURE</span>
        <h1>Feather Porcelain · Board and piece acceptance</h1>
        <p>
          All twelve pieces on the production Windowlight square colors at 32, 40, 56 and 72 px, plus the interaction
          states that are hardest to judge on a starting position: selection, quiet and capture destinations, board
          arrows for both analysis sources, a Move Quality badge and a flipped board.
        </p>
      </header>

      <div className="quality-fixture-grid">
        <section className="piece-fixture-matrix">
          <div>
            <strong>Piece matrix</strong>
            <small>32 / 40 / 56 / 72 px · light and dark squares</small>
          </div>
          {PIECE_KEYS.map((key) => {
            const Piece = pieces[key];
            return (
              <div className="piece-fixture-row" key={key}>
                <strong>{key}</strong>
                <div className="piece-fixture-cells">
                  {SIZES.map((size) => (
                    <div className="piece-fixture-cell light" style={{ width: size, height: size }} key={`light-${size}`}>
                      {Piece && <Piece />}
                    </div>
                  ))}
                  {SIZES.map((size) => (
                    <div className="piece-fixture-cell dark" style={{ width: size, height: size }} key={`dark-${size}`}>
                      {Piece && <Piece />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="piece-fixture-boards">
          <div className="piece-fixture-board">
            <h2>White · Stockfish</h2>
            <p>
              Selected d3 with {destinations.length - captureCount} quiet destinations and {captureCount} capture
              destination, objective candidate arrows and a Brilliant badge.
            </p>
            <div className="piece-fixture-board-wrap">
              <Chessboard options={{
                position: FIXTURE_FEN,
                pieces,
                allowDragging: false,
                canDragPiece: () => false,
                allowDrawingArrows: false,
                boardOrientation: "white",
                arrows: stockfishCandidateArrows(STOCKFISH_FIXTURE, 2, "d3b4"),
                squareStyles: moveHints,
                ...WINDOWLIGHT_BOARD_APPEARANCE,
              }} />
              <BoardQualityBadge square="d3" orientation="white" classification="brilliant" />
            </div>
          </div>

          <div className="piece-fixture-board">
            <h2>Black · Maia</h2>
            <p>Flipped board, human candidate arrows and a Blunder badge on the same position.</p>
            <div className="piece-fixture-board-wrap">
              <Chessboard options={{
                position: FIXTURE_FEN,
                pieces,
                allowDragging: false,
                canDragPiece: () => false,
                allowDrawingArrows: false,
                boardOrientation: "black",
                arrows: humanCandidateArrows(MAIA_FIXTURE, 2),
                squareStyles: moveHints,
                ...WINDOWLIGHT_BOARD_APPEARANCE,
              }} />
              <BoardQualityBadge square="d3" orientation="black" classification="blunder" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
