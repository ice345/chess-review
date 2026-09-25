"use client";

import { Chessboard } from "react-chessboard";
import type { MaiaPositionAnalysis, StockfishMoveAnalysis, UiLanguage } from "@chess-review/shared";
import { legalBoardDestinations } from "@chess-review/chess-core";
import { BoardQualityBadge, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { useUiLanguage } from "../../../hooks/use-ui-language";
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

type PiecesCopy = {
  kicker: string;
  heading: string;
  introBeforeCode: string;
  introAfterCode: string;
  recognition: string;
  pieceMatrix: string;
  pieceMatrixMeta: string;
  blindPosition: string;
  blindIntro: string;
  revealRoles: string;
  blindSilhouette: string;
  blindSilhouetteIntro: string;
  silhouette: string;
  silhouetteMeta: string;
  distance: string;
  distanceMeta: string;
  classic: string;
  classicMeta: string;
  whiteStockfish: string;
  whiteIntro: (quiet: number, capture: number) => string;
  blackMaia: string;
  blackIntro: string;
  blindRoles: Record<(typeof BLIND_ROLES)[number], string>;
};

const COPY: Record<UiLanguage, PiecesCopy> = {
  en: {
    kicker: "LOCAL VISUAL FIXTURE",
    heading: "Feather Porcelain · Board and piece acceptance",
    introBeforeCode: "All twelve pieces from ",
    introAfterCode: " on the production Windowlight square colors at 32, 40, 48, 56 and 72 px, plus the interaction states that are hardest to judge on a starting position: selection, quiet and capture destinations, board arrows for both analysis sources, a Move Quality badge and a flipped board.",
    recognition: "The recognition sections sit below the matrix: an unlabelled position, a silhouette pass, a distance blur pass and a side-by-side Classic comparison. Feather Porcelain is accepted only when King, Queen and Bishop stay identifiable in all four.",
    pieceMatrix: "Piece matrix",
    pieceMatrixMeta: "32 / 40 / 48 / 56 / 72 px · light and dark squares",
    blindPosition: "Blind position",
    blindIntro: "Six King, Queen and Bishop placements away from their starting squares, with no role labels on the board.",
    revealRoles: "Reveal roles",
    blindSilhouette: "Blind position · silhouette",
    blindSilhouetteIntro: "The same position with the blue shading removed, so role identity has to survive as shape alone.",
    silhouette: "Silhouette",
    silhouetteMeta: "brightness(0) saturate(0) · 32 and 56 px · role identity must come from shape",
    distance: "Distance stress",
    distanceMeta: "blur(1px) · 32 / 40 / 48 / 56 / 72 px · a diagnostic, not an acceptance target",
    classic: "Classic comparison",
    classicMeta: "Feather Porcelain then Classic SVG at the same pixel size · Classic is the benchmark, not a template",
    whiteStockfish: "White · Stockfish",
    whiteIntro: (quiet, capture) =>
      `Selected d3 with ${quiet} quiet destinations and ${capture} capture destination, objective candidate arrows and a Brilliant badge.`,
    blackMaia: "Black · Maia",
    blackIntro: "Flipped board, human candidate arrows and a Blunder badge on the same position.",
    blindRoles: {
      "h6 black King": "h6 black King",
      "b5 black Queen": "b5 black Queen",
      "f4 black Bishop": "f4 black Bishop",
      "e5 white King": "e5 white King",
      "c3 white Bishop": "c3 white Bishop",
      "g2 white Queen": "g2 white Queen",
    },
  },
  "zh-CN": {
    kicker: "本地视觉样张",
    heading: "Feather Porcelain · 棋盘与棋子验收",
    introBeforeCode: "全部十二个棋子来自 ",
    introAfterCode: "，画在生产环境 Windowlight 浅深格上，尺寸为 32、40、48、56 和 72 px，再加上起始局面最难看清的交互状态：选中、安静与吃子落点、两种分析来源的棋盘箭头、着法质量徽记，以及翻转棋盘。",
    recognition: "识别部分在矩阵下方：无标签局面、剪影检查、远距模糊检查，以及与 Classic 并排比较。只有国王、王后和象在这四项中都能辨认，Feather Porcelain 才算通过。",
    pieceMatrix: "棋子矩阵",
    pieceMatrixMeta: "32 / 40 / 48 / 56 / 72 px · 浅格与深格",
    blindPosition: "盲测局面",
    blindIntro: "国王、王后和象离开起始直线的六个位置，棋盘上没有角色标签。",
    revealRoles: "显示角色",
    blindSilhouette: "盲测局面 · 剪影",
    blindSilhouetteIntro: "同一局面去掉蓝色渲染，角色身份必须只靠外形成立。",
    silhouette: "剪影",
    silhouetteMeta: "brightness(0) saturate(0) · 32 和 56 px · 角色身份必须来自外形",
    distance: "远距压力",
    distanceMeta: "blur(1px) · 32 / 40 / 48 / 56 / 72 px · 诊断用，不是验收目标",
    classic: "Classic 对照",
    classicMeta: "同一像素尺寸下先 Feather Porcelain 再 Classic SVG · Classic 是基准，不是模板",
    whiteStockfish: "白方 · Stockfish",
    whiteIntro: (quiet, capture) =>
      `选中 d3，有 ${quiet} 个安静落点和 ${capture} 个吃子落点，客观候选箭头和精彩徽记。`,
    blackMaia: "黑方 · Maia",
    blackIntro: "翻转棋盘、人类候选箭头，以及同一局面上的漏着徽记。",
    blindRoles: {
      "h6 black King": "h6 黑方国王",
      "b5 black Queen": "b5 黑方王后",
      "f4 black Bishop": "f4 黑方象",
      "e5 white King": "e5 白方国王",
      "c3 white Bishop": "c3 白方象",
      "g2 white Queen": "g2 白方王后",
    },
  },
};

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
  const language = useUiLanguage();
  const copy = COPY[language];
  return (
    <main className="quality-fixture-page">
      <header>
        <span>{copy.kicker}</span>
        <h1>{copy.heading}</h1>
        <p>
          {copy.introBeforeCode}<code>{PIECE_ASSET_DIR}</code>{copy.introAfterCode}
        </p>
        <p>
          {copy.recognition}
        </p>
      </header>

      <div className="quality-fixture-grid">
        <section className="piece-fixture-matrix">
          <div>
            <strong>{copy.pieceMatrix}</strong>
            <small>{copy.pieceMatrixMeta}</small>
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
            <h2>{copy.blindPosition}</h2>
            <p>{copy.blindIntro}</p>
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
              <summary>{copy.revealRoles}</summary>
              <ul>{BLIND_ROLES.map((role) => <li key={role}>{copy.blindRoles[role]}</li>)}</ul>
            </details>
          </div>

          <div className="piece-fixture-board">
            <h2>{copy.blindSilhouette}</h2>
            <p>{copy.blindSilhouetteIntro}</p>
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
            <strong>{copy.silhouette}</strong>
            <small>{copy.silhouetteMeta}</small>
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
            <strong>{copy.distance}</strong>
            <small>{copy.distanceMeta}</small>
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
            <strong>{copy.classic}</strong>
            <small>{copy.classicMeta}</small>
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
            <h2>{copy.whiteStockfish}</h2>
            <p>
              {copy.whiteIntro(destinations.length - captureCount, captureCount)}
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
              <BoardQualityBadge square="d3" orientation="white" classification="brilliant" language={language} />
            </div>
          </div>

          <div className="piece-fixture-board">
            <h2>{copy.blackMaia}</h2>
            <p>{copy.blackIntro}</p>
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
              <BoardQualityBadge square="d3" orientation="black" classification="blunder" language={language} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
