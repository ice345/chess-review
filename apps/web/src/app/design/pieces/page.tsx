"use client";

import { Chessboard } from "react-chessboard";
import type { MaiaPositionAnalysis, StockfishMoveAnalysis } from "@chess-review/shared";
import { legalBoardDestinations } from "@chess-review/chess-core";
import { BoardQualityBadge, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { humanCandidateArrows, stockfishCandidateArrows } from "../../../lib/board-analysis-arrows";
import { boardMoveHintStyles } from "../../../lib/board-move-hints";
import { chessboardPieces } from "../../../lib/board-pieces";
import { PIECE_ASSET_DIR } from "../../../lib/board-piece-assets";

/* Acceptance environment for the Feather Porcelain pieces and the Windowlight
   board. It renders the production piece renderer and the production board
   appearance on the production square tokens, so a piece or board regression is
   visible here instead of only on the starting position.

   Two layers are checked on purpose:
   - rendering: does every asset decode on both square colors at every size;
   - recognition: can a role be told apart without the starting position, and
     from silhouette alone. Feather Porcelain v1.1 carries the King/Queen/Bishop
     identity in the silhouette, so the silhouette and blind-position sections
     are the ones that accept or reject the art. */

const PIECE_KEYS = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;
const SIZES = [32, 40, 48, 56, 72] as const;
const SILHOUETTE_SIZES = [32, 56] as const;
const FIXTURE_FEN = "1k6/8/8/2p5/8/3N4/8/1K6 w - - 0 1";
/* King, Queen and Bishop away from their starting files, so role recognition
   cannot lean on opening knowledge. */
const BLIND_FEN = "8/8/7k/1q2K3/5b2/2B5/6Q1/8 w - - 0 1";
const BLIND_ROLES = [
  "h6 black King",
  "b5 black Queen",
  "f4 black Bishop",
  "e5 white King",
  "c3 white Bishop",
  "g2 white Queen",
] as const;

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

const porcelain = chessboardPieces("liz-blue");
const classic = chessboardPieces("classic");
const destinations = legalBoardDestinations(FIXTURE_FEN, "d3");
const moveHints = boardMoveHintStyles("d3", destinations);
const captureCount = destinations.filter((move) => move.isCapture).length;

function PieceCell({
  pieces,
  keyId,
  size,
  square,
  filter,
}: {
  pieces: typeof porcelain;
  keyId: (typeof PIECE_KEYS)[number];
  size: number;
  square: "light" | "dark";
  filter?: "silhouette" | "blur";
}) {
  const Piece = pieces[keyId];
  return (
    <div
      className={`piece-fixture-cell ${square}${filter ? ` ${filter}` : ""}`}
      style={{ width: size, height: size }}
      data-piece={keyId}
      data-size={size}
    >
      <span className="piece-fixture-figure">{Piece && <Piece />}</span>
    </div>
  );
}

export default function PieceFixturePage() {
  return (
    <main className="quality-fixture-page">
      <header>
        <span>LOCAL VISUAL FIXTURE</span>
        <h1>Feather Porcelain · Board and piece acceptance</h1>
        <p>
          All twelve pieces from <code>{PIECE_ASSET_DIR}</code> on the production Windowlight square colors at 32, 40,
          48, 56 and 72 px, plus the interaction states that are hardest to judge on a starting position: selection,
          quiet and capture destinations, board arrows for both analysis sources, a Move Quality badge and a flipped
          board.
        </p>
        <p>
          The recognition sections sit below the matrix: an unlabelled position, a silhouette pass, a distance blur
          pass and a side-by-side Classic comparison. Feather Porcelain is accepted only when King, Queen and Bishop
          stay identifiable in all four.
        </p>
      </header>

      <div className="quality-fixture-grid">
        <section className="piece-fixture-matrix">
          <div>
            <strong>Piece matrix</strong>
            <small>32 / 40 / 48 / 56 / 72 px · light and dark squares</small>
          </div>
          {PIECE_KEYS.map((key) => (
            <div className="piece-fixture-row" key={key}>
              <strong>{key}</strong>
              <div className="piece-fixture-cells">
                {SIZES.map((size) => <PieceCell pieces={porcelain} keyId={key} size={size} square="light" key={`light-${size}`} />)}
                {SIZES.map((size) => <PieceCell pieces={porcelain} keyId={key} size={size} square="dark" key={`dark-${size}`} />)}
              </div>
            </div>
          ))}
        </section>

        <section className="piece-fixture-boards">
          <div className="piece-fixture-board">
            <h2>Blind position</h2>
            <p>Six King, Queen and Bishop placements away from their starting squares, with no role labels on the board.</p>
            <div className="piece-fixture-board-wrap">
              <Chessboard options={{
                position: BLIND_FEN,
                pieces: porcelain,
                allowDragging: false,
                canDragPiece: () => false,
                allowDrawingArrows: false,
                boardOrientation: "white",
                arrows: [],
                squareStyles: {},
                ...WINDOWLIGHT_BOARD_APPEARANCE,
              }} />
            </div>
            <details className="piece-fixture-reveal">
              <summary>Reveal roles</summary>
              <ul>{BLIND_ROLES.map((role) => <li key={role}>{role}</li>)}</ul>
            </details>
          </div>

          <div className="piece-fixture-board">
            <h2>Blind position · silhouette</h2>
            <p>The same position with the blue shading removed, so role identity has to survive as shape alone.</p>
            <div className="piece-fixture-board-wrap piece-fixture-silhouette">
              <Chessboard options={{
                position: BLIND_FEN,
                pieces: porcelain,
                allowDragging: false,
                canDragPiece: () => false,
                allowDrawingArrows: false,
                boardOrientation: "white",
                arrows: [],
                squareStyles: {},
                ...WINDOWLIGHT_BOARD_APPEARANCE,
              }} />
            </div>
          </div>
        </section>

        <section className="piece-fixture-matrix piece-fixture-silhouette-cells">
          <div>
            <strong>Silhouette</strong>
            <small>brightness(0) saturate(0) · 32 and 56 px · role identity must come from shape</small>
          </div>
          {PIECE_KEYS.map((key) => (
            <div className="piece-fixture-row" key={key}>
              <strong>{key}</strong>
              <div className="piece-fixture-cells">
                {SILHOUETTE_SIZES.map((size) => <PieceCell pieces={porcelain} keyId={key} size={size} square="light" filter="silhouette" key={size} />)}
              </div>
            </div>
          ))}
        </section>

        <section className="piece-fixture-matrix">
          <div>
            <strong>Distance stress</strong>
            <small>blur(1px) · 32 / 40 / 48 / 56 / 72 px · a diagnostic, not an acceptance target</small>
          </div>
          {PIECE_KEYS.map((key) => (
            <div className="piece-fixture-row" key={key}>
              <strong>{key}</strong>
              <div className="piece-fixture-cells">
                {SIZES.map((size) => <PieceCell pieces={porcelain} keyId={key} size={size} square="light" filter="blur" key={size} />)}
              </div>
            </div>
          ))}
        </section>

        <section className="piece-fixture-matrix">
          <div>
            <strong>Classic comparison</strong>
            <small>Feather Porcelain then Classic SVG at the same pixel size · Classic is the benchmark, not a template</small>
          </div>
          {PIECE_KEYS.map((key) => (
            <div className="piece-fixture-row" key={key}>
              <strong>{key}</strong>
              <div className="piece-fixture-cells">
                {SIZES.map((size) => <PieceCell pieces={porcelain} keyId={key} size={size} square="light" key={`feather-${size}`} />)}
                <span className="piece-fixture-divider" aria-hidden="true" />
                {SIZES.map((size) => <PieceCell pieces={classic} keyId={key} size={size} square="light" key={`classic-${size}`} />)}
              </div>
            </div>
          ))}
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
                pieces: porcelain,
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
                pieces: porcelain,
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
